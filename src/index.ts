#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { runAnalysis } from './analyzer.js';
import { AnalyzeInputSchema } from './types/index.js';

const server = new Server(
  {
    name: 'ios-app-review',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'analyze_ios_app',
        description:
          'Analyze an iOS app project for App Store review compliance. ' +
          'Checks Info.plist, privacy manifests, entitlements, and code for common rejection reasons.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the .xcodeproj or .xcworkspace directory',
            },
            analyzers: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['all', 'info-plist', 'privacy', 'entitlements', 'code'],
              },
              description: 'Specific analyzers to run (default: all)',
            },
            targetName: {
              type: 'string',
              description: 'Specific target to analyze (default: main app target)',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'check_info_plist',
        description:
          'Validate an Info.plist file for required keys, privacy descriptions, and App Transport Security configuration.',
        inputSchema: {
          type: 'object',
          properties: {
            plistPath: {
              type: 'string',
              description: 'Path to the Info.plist file',
            },
          },
          required: ['plistPath'],
        },
      },
      {
        name: 'check_privacy_manifest',
        description:
          'Validate a PrivacyInfo.xcprivacy file for iOS 17+ privacy manifest requirements.',
        inputSchema: {
          type: 'object',
          properties: {
            manifestPath: {
              type: 'string',
              description: 'Path to the PrivacyInfo.xcprivacy file',
            },
            projectPath: {
              type: 'string',
              description: 'Path to the project (for cross-referencing API usage)',
            },
          },
          required: ['manifestPath'],
        },
      },
      {
        name: 'scan_code',
        description:
          'Scan Swift/Objective-C code for issues like hardcoded IPs, debug code, secrets, and deprecated APIs.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to scan (file or directory)',
            },
            patterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific patterns to check (default: all)',
            },
          },
          required: ['path'],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'analyze_ios_app': {
        const input = AnalyzeInputSchema.parse(args);
        const report = await runAnalysis(input);
        return {
          content: [
            {
              type: 'text',
              text: formatReport(report),
            },
          ],
        };
      }

      case 'check_info_plist': {
        const { plistPath } = args as { plistPath: string };
        const { InfoPlistAnalyzer } = await import('./analyzers/info-plist.js');
        const analyzer = new InfoPlistAnalyzer();
        const result = await analyzer.analyzePlist(plistPath);
        return {
          content: [
            {
              type: 'text',
              text: formatAnalysisResult(result),
            },
          ],
        };
      }

      case 'check_privacy_manifest': {
        const { manifestPath, projectPath } = args as {
          manifestPath: string;
          projectPath?: string;
        };
        const { PrivacyAnalyzer } = await import('./analyzers/privacy.js');
        const analyzer = new PrivacyAnalyzer();
        const result = await analyzer.analyzeManifest(manifestPath, projectPath);
        return {
          content: [
            {
              type: 'text',
              text: formatAnalysisResult(result),
            },
          ],
        };
      }

      case 'scan_code': {
        const { path, patterns } = args as { path: string; patterns?: string[] };
        const { CodeScanner } = await import('./analyzers/code-scanner.js');
        const scanner = new CodeScanner();
        const result = await scanner.scanPath(path, patterns);
        return {
          content: [
            {
              type: 'text',
              text: formatAnalysisResult(result),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Format a complete analysis report
 */
function formatReport(report: import('./types/index.js').AnalysisReport): string {
  const lines: string[] = [
    '# iOS App Review Analysis Report',
    '',
    `**Project:** ${report.projectPath}`,
    `**Date:** ${report.timestamp}`,
    `**Status:** ${report.summary.passed ? '✅ PASSED' : '❌ ISSUES FOUND'}`,
    '',
    '## Summary',
    '',
    `- **Total Issues:** ${report.summary.totalIssues}`,
    `- **Errors:** ${report.summary.errors}`,
    `- **Warnings:** ${report.summary.warnings}`,
    `- **Info:** ${report.summary.info}`,
    `- **Duration:** ${report.summary.duration}ms`,
    '',
  ];

  for (const result of report.results) {
    lines.push(`## ${result.analyzer}`);
    lines.push('');

    if (result.issues.length === 0) {
      lines.push('✅ No issues found');
    } else {
      for (const issue of result.issues) {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`### ${icon} ${issue.title}`);
        lines.push('');
        lines.push(issue.description);
        if (issue.filePath) {
          const location = issue.lineNumber
            ? `${issue.filePath}:${issue.lineNumber}`
            : issue.filePath;
          lines.push(`\n**Location:** \`${location}\``);
        }
        if (issue.guideline) {
          lines.push(`\n**Guideline:** ${issue.guideline}`);
        }
        if (issue.suggestion) {
          lines.push(`\n**Suggestion:** ${issue.suggestion}`);
        }
        lines.push('');
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a single analysis result
 */
function formatAnalysisResult(result: import('./types/index.js').AnalysisResult): string {
  const lines: string[] = [
    `# ${result.analyzer} Analysis`,
    '',
    `**Status:** ${result.passed ? '✅ PASSED' : '❌ ISSUES FOUND'}`,
    `**Duration:** ${result.duration}ms`,
    '',
  ];

  if (result.issues.length === 0) {
    lines.push('No issues found.');
  } else {
    lines.push(`## Issues (${result.issues.length})`);
    lines.push('');

    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`### ${icon} ${issue.title}`);
      lines.push('');
      lines.push(issue.description);
      if (issue.filePath) {
        const location = issue.lineNumber
          ? `${issue.filePath}:${issue.lineNumber}`
          : issue.filePath;
        lines.push(`\n**Location:** \`${location}\``);
      }
      if (issue.suggestion) {
        lines.push(`\n**Suggestion:** ${issue.suggestion}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Start the MCP server
 */
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('iOS App Review MCP server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
