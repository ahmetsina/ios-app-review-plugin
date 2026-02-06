#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { runAnalysis } from './analyzer.js';
import { AnalyzeInputSchema } from './types/index.js';
import type { AnalysisResult, AnalysisSummary } from './types/index.js';
import { createFormatter } from './reports/index.js';
import type { EnrichedAnalysisReport } from './reports/index.js';
import { HistoryStore, ScanComparator } from './history/index.js';
import { GUIDELINES } from './guidelines/index.js';
import { RuleLoader } from './rules/index.js';

const server = new Server(
  {
    name: 'ios-app-review',
    version: '0.4.0',
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
          'Checks Info.plist, privacy manifests, entitlements, and code for common rejection reasons. ' +
          'Optionally includes App Store Connect validation when credentials are configured.',
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
                enum: [
                  'all',
                  'info-plist',
                  'privacy',
                  'entitlements',
                  'code',
                  'deprecated-api',
                  'private-api',
                  'security',
                  'ui-ux',
                  'asc-metadata',
                  'asc-screenshots',
                  'asc-version',
                  'asc-iap',
                ],
              },
              description: 'Specific analyzers to run (default: all)',
            },
            targetName: {
              type: 'string',
              description: 'Specific target to analyze (default: main app target)',
            },
            includeASC: {
              type: 'boolean',
              description:
                'Include App Store Connect validation (requires ASC_KEY_ID, ASC_ISSUER_ID, and ASC_PRIVATE_KEY_PATH environment variables)',
            },
            bundleId: {
              type: 'string',
              description: 'Bundle ID for ASC validation (auto-detected from project if not provided)',
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
      {
        name: 'check_deprecated_apis',
        description:
          'Scan Swift/Objective-C code for deprecated iOS API usage. ' +
          'Detects APIs deprecated or removed at your deployment target version.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to scan (file or directory)',
            },
            deploymentTarget: {
              type: 'string',
              description: 'iOS deployment target version (e.g. "15.0"). Default: "13.0"',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'check_private_apis',
        description:
          'Scan code for private/undocumented iOS API usage that causes App Store rejection. ' +
          'Detects private selectors, undocumented frameworks, runtime API access, and private URL schemes.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to scan (file or directory)',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'check_security',
        description:
          'Scan code for security vulnerabilities including weak cryptography, insecure data storage, ' +
          'insecure keychain configuration, SQL injection, and hardcoded secrets.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to scan (file or directory)',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'check_ui_ux',
        description:
          'Check UI/UX compliance including launch screen, app icons, iPad support, ' +
          'placeholder text in storyboards, and accessibility basics.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project directory or .xcodeproj',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'validate_asc_metadata',
        description:
          'Validate app metadata in App Store Connect including name, subtitle, description, keywords, ' +
          'privacy policy URL, and support URL. Requires ASC credentials.',
        inputSchema: {
          type: 'object',
          properties: {
            bundleId: {
              type: 'string',
              description: 'Bundle identifier of the app to validate',
            },
          },
          required: ['bundleId'],
        },
      },
      {
        name: 'validate_asc_screenshots',
        description:
          'Validate app screenshots in App Store Connect including required device sizes, screenshot counts, ' +
          'and processing status. Requires ASC credentials.',
        inputSchema: {
          type: 'object',
          properties: {
            bundleId: {
              type: 'string',
              description: 'Bundle identifier of the app to validate',
            },
          },
          required: ['bundleId'],
        },
      },
      {
        name: 'compare_versions',
        description:
          'Compare local app version with App Store Connect version. Checks version numbers, build numbers, ' +
          'submission status, and release notes. Requires ASC credentials.',
        inputSchema: {
          type: 'object',
          properties: {
            bundleId: {
              type: 'string',
              description: 'Bundle identifier of the app',
            },
            localVersion: {
              type: 'string',
              description: 'Local version string (e.g. "1.2.0")',
            },
            localBuild: {
              type: 'string',
              description: 'Local build number (e.g. "42")',
            },
          },
          required: ['bundleId'],
        },
      },
      {
        name: 'validate_iap',
        description:
          'Validate in-app purchases in App Store Connect including localizations, review screenshots, ' +
          'and submission readiness. Requires ASC credentials.',
        inputSchema: {
          type: 'object',
          properties: {
            bundleId: {
              type: 'string',
              description: 'Bundle identifier of the app',
            },
          },
          required: ['bundleId'],
        },
      },
      {
        name: 'full_asc_validation',
        description:
          'Run all App Store Connect validations: metadata, screenshots, versions, and in-app purchases. ' +
          'Requires ASC credentials (ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY_PATH).',
        inputSchema: {
          type: 'object',
          properties: {
            bundleId: {
              type: 'string',
              description: 'Bundle identifier of the app',
            },
          },
          required: ['bundleId'],
        },
      },
      // Phase 4: New tools
      {
        name: 'generate_report',
        description:
          'Run full analysis and generate an enriched report with review readiness score, ' +
          'guideline cross-references, and optional historical comparison. Supports markdown, HTML, and JSON output.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the .xcodeproj or .xcworkspace directory',
            },
            format: {
              type: 'string',
              enum: ['markdown', 'html', 'json'],
              description: 'Report output format (default: markdown)',
            },
            includeHistory: {
              type: 'boolean',
              description: 'Include comparison with the most recent previous scan',
            },
            saveToHistory: {
              type: 'boolean',
              description: 'Save this scan to history for future comparisons',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'compare_scans',
        description:
          'Compare the current scan with a previous scan to see new, resolved, and ongoing issues.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the .xcodeproj or .xcworkspace directory',
            },
            previousScanId: {
              type: 'string',
              description: 'ID of a specific previous scan to compare against (default: latest)',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'view_scan_history',
        description: 'List past scan records with scores and trend analysis for a project.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project directory',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of scans to return (default: 10)',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'lookup_guideline',
        description:
          'Look up an Apple App Store Review Guideline by section number. Returns the title, excerpt, and URL.',
        inputSchema: {
          type: 'object',
          properties: {
            section: {
              type: 'string',
              description: 'Guideline section number (e.g., "2.5.1", "5.1.1")',
            },
          },
          required: ['section'],
        },
      },
      {
        name: 'validate_custom_rules',
        description:
          'Validate and preview a custom rules configuration file (.ios-review-rules.json).',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project directory',
            },
            configPath: {
              type: 'string',
              description: 'Explicit path to the rules config file (default: auto-discover)',
            },
          },
          required: ['projectPath'],
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
        const formatter = createFormatter('markdown');
        return {
          content: [
            {
              type: 'text',
              text: formatter.format(report as EnrichedAnalysisReport),
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

      case 'check_deprecated_apis': {
        const { path: scanPath, deploymentTarget } = args as {
          path: string;
          deploymentTarget?: string;
        };
        const { DeprecatedAPIAnalyzer } = await import('./analyzers/deprecated-api.js');
        const depAnalyzer = new DeprecatedAPIAnalyzer();
        const result = await depAnalyzer.scanPath(scanPath, deploymentTarget);
        return {
          content: [
            {
              type: 'text',
              text: formatAnalysisResult(result),
            },
          ],
        };
      }

      case 'check_private_apis': {
        const { path: scanPath } = args as { path: string };
        const { PrivateAPIAnalyzer } = await import('./analyzers/private-api.js');
        const privAnalyzer = new PrivateAPIAnalyzer();
        const result = await privAnalyzer.scanPath(scanPath);
        return {
          content: [
            {
              type: 'text',
              text: formatAnalysisResult(result),
            },
          ],
        };
      }

      case 'check_security': {
        const { path: scanPath } = args as { path: string };
        const { SecurityAnalyzer } = await import('./analyzers/security.js');
        const secAnalyzer = new SecurityAnalyzer();
        const result = await secAnalyzer.scanPath(scanPath);
        return {
          content: [
            {
              type: 'text',
              text: formatAnalysisResult(result),
            },
          ],
        };
      }

      case 'check_ui_ux': {
        const { projectPath } = args as { projectPath: string };
        const { UIUXAnalyzer } = await import('./analyzers/ui-ux.js');
        const uiuxAnalyzer = new UIUXAnalyzer();
        const result = await uiuxAnalyzer.validateProject(projectPath);
        return {
          content: [
            {
              type: 'text',
              text: formatAnalysisResult(result),
            },
          ],
        };
      }

      case 'validate_asc_metadata': {
        const { bundleId } = args as { bundleId: string };
        const { ASCMetadataAnalyzer } = await import('./analyzers/asc-metadata.js');
        const analyzer = new ASCMetadataAnalyzer();
        const result = await analyzer.validateByBundleId(bundleId);
        return {
          content: [
            {
              type: 'text',
              text: formatAnalysisResult(result),
            },
          ],
        };
      }

      case 'validate_asc_screenshots': {
        const { bundleId } = args as { bundleId: string };
        const { ASCScreenshotAnalyzer } = await import('./analyzers/asc-screenshots.js');
        const analyzer = new ASCScreenshotAnalyzer();
        const result = await analyzer.validateByBundleId(bundleId);
        return {
          content: [
            {
              type: 'text',
              text: formatAnalysisResult(result),
            },
          ],
        };
      }

      case 'compare_versions': {
        const { bundleId, localVersion, localBuild } = args as {
          bundleId: string;
          localVersion?: string;
          localBuild?: string;
        };
        const { ASCVersionAnalyzer } = await import('./analyzers/asc-version.js');
        const analyzer = new ASCVersionAnalyzer();
        const result = await analyzer.compareVersions(bundleId, localVersion, localBuild);
        return {
          content: [
            {
              type: 'text',
              text: formatAnalysisResult(result),
            },
          ],
        };
      }

      case 'validate_iap': {
        const { bundleId } = args as { bundleId: string };
        const { ASCIAPAnalyzer } = await import('./analyzers/asc-iap.js');
        const analyzer = new ASCIAPAnalyzer();
        const result = await analyzer.validateByBundleId(bundleId);
        return {
          content: [
            {
              type: 'text',
              text: formatAnalysisResult(result),
            },
          ],
        };
      }

      case 'full_asc_validation': {
        const { bundleId } = args as { bundleId: string };
        const results = await runFullASCValidation(bundleId);
        const summary = calculateSummary(results);
        return {
          content: [
            {
              type: 'text',
              text: formatASCReport(bundleId, results, summary),
            },
          ],
        };
      }

      // Phase 4: New tool handlers

      case 'generate_report': {
        const { projectPath, format, includeHistory, saveToHistory } = args as {
          projectPath: string;
          format?: string;
          includeHistory?: boolean;
          saveToHistory?: boolean;
        };

        const input = AnalyzeInputSchema.parse({ projectPath });
        const report = await runAnalysis(input);
        const enriched: EnrichedAnalysisReport = { ...report };

        const basePath = (await import('path')).dirname((await import('path')).resolve(projectPath));
        const store = new HistoryStore(basePath);

        // Historical comparison
        if (includeHistory) {
          const previousScan = await store.getLatestScan();
          if (previousScan) {
            const comparator = new ScanComparator();
            const currentScanRecord = {
              id: 'current',
              timestamp: report.timestamp,
              projectPath: report.projectPath,
              report,
              score: report.score,
            };
            const comparison = comparator.compare(previousScan, currentScanRecord);
            enriched.comparison = {
              previousScanId: previousScan.id,
              previousTimestamp: previousScan.timestamp,
              previousScore: previousScan.score,
              currentScore: report.score,
              scoreDelta: comparison.scoreDelta,
              newIssues: comparison.newIssues.map((fp) => ({
                id: fp,
                title: fp,
                description: '',
                severity: 'info' as const,
                category: 'code' as const,
              })),
              resolvedIssues: comparison.resolvedIssues.map((fp) => ({
                id: fp,
                title: fp,
                description: '',
                severity: 'info' as const,
                category: 'code' as const,
              })),
              ongoingIssues: comparison.ongoingIssues.map((fp) => ({
                id: fp,
                title: fp,
                description: '',
                severity: 'info' as const,
                category: 'code' as const,
              })),
              trend: comparison.trend,
            };
          }
        }

        // Save to history
        if (saveToHistory) {
          await store.saveScan(report, report.score);
        }

        const reportFormat = (format === 'html' || format === 'json') ? format : 'markdown' as const;
        const formatter = createFormatter(reportFormat);
        return {
          content: [
            {
              type: 'text',
              text: formatter.format(enriched),
            },
          ],
        };
      }

      case 'compare_scans': {
        const { projectPath, previousScanId } = args as {
          projectPath: string;
          previousScanId?: string;
        };

        const resolvedPath = (await import('path')).resolve(projectPath);
        const basePath = (await import('path')).dirname(resolvedPath);
        const store = new HistoryStore(basePath);

        const previousScan = previousScanId
          ? await store.getScan(previousScanId)
          : await store.getLatestScan();

        if (!previousScan) {
          return {
            content: [
              {
                type: 'text',
                text: 'No previous scan found. Run `generate_report` with `saveToHistory: true` first.',
              },
            ],
          };
        }

        const input = AnalyzeInputSchema.parse({ projectPath });
        const report = await runAnalysis(input);

        const comparator = new ScanComparator();
        const currentScanRecord = {
          id: 'current',
          timestamp: report.timestamp,
          projectPath: report.projectPath,
          report,
          score: report.score,
        };
        const comparison = comparator.compare(previousScan, currentScanRecord);

        const lines = [
          '# Scan Comparison',
          '',
          `**Previous scan:** ${previousScan.id} (${previousScan.timestamp})`,
          `**Previous score:** ${previousScan.score}/100`,
          `**Current score:** ${report.score}/100`,
          `**Delta:** ${comparison.scoreDelta > 0 ? '+' : ''}${comparison.scoreDelta}`,
          `**Trend:** ${comparison.trend}`,
          '',
          `| Metric | Count |`,
          `|--------|-------|`,
          `| New issues | ${comparison.newIssues.length} |`,
          `| Resolved issues | ${comparison.resolvedIssues.length} |`,
          `| Ongoing issues | ${comparison.ongoingIssues.length} |`,
        ];

        if (comparison.newIssues.length > 0) {
          lines.push('', '## New Issues', '');
          for (const fp of comparison.newIssues) {
            lines.push(`- ${fp}`);
          }
        }

        if (comparison.resolvedIssues.length > 0) {
          lines.push('', '## Resolved Issues', '');
          for (const fp of comparison.resolvedIssues) {
            lines.push(`- ${fp}`);
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: lines.join('\n'),
            },
          ],
        };
      }

      case 'view_scan_history': {
        const { projectPath, limit } = args as { projectPath: string; limit?: number };

        const resolvedPath = (await import('path')).resolve(projectPath);
        const basePath = (await import('path')).dirname(resolvedPath);
        const store = new HistoryStore(basePath);
        const scans = await store.listScans(limit ?? 10);

        if (scans.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No scan history found. Run `generate_report` with `saveToHistory: true` to start tracking.',
              },
            ],
          };
        }

        const lines = [
          '# Scan History',
          '',
          `| # | Date | Score | Git Branch | Git Commit |`,
          `|---|------|-------|------------|------------|`,
        ];

        for (let i = 0; i < scans.length; i++) {
          const scan = scans[i]!;
          const date = new Date(scan.timestamp).toLocaleString();
          lines.push(
            `| ${i + 1} | ${date} | ${scan.score}/100 | ${scan.gitBranch ?? '-'} | ${scan.gitCommit ? scan.gitCommit.substring(0, 7) : '-'} |`
          );
        }

        // Trend analysis
        if (scans.length >= 2) {
          const scores = scans.map((s) => s.score).reverse(); // oldest first
          const first = scores[0]!;
          const last = scores[scores.length - 1]!;
          const delta = last - first;
          const trend = delta > 5 ? 'Improving' : delta < -5 ? 'Declining' : 'Stable';
          lines.push('', `**Trend:** ${trend} (${delta > 0 ? '+' : ''}${delta} over ${scans.length} scans)`);
        }

        return {
          content: [
            {
              type: 'text',
              text: lines.join('\n'),
            },
          ],
        };
      }

      case 'lookup_guideline': {
        const { section } = args as { section: string };
        const guideline = GUIDELINES[section];

        if (!guideline) {
          const available = Object.keys(GUIDELINES).sort().join(', ');
          return {
            content: [
              {
                type: 'text',
                text: `Guideline section "${section}" not found.\n\nAvailable sections: ${available}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: [
                `# Guideline ${guideline.section}: ${guideline.title}`,
                '',
                `**Category:** ${guideline.category}`,
                `**Severity Weight:** ${guideline.severityWeight}/10`,
                '',
                guideline.excerpt,
                '',
                `**Reference:** ${guideline.url}`,
              ].join('\n'),
            },
          ],
        };
      }

      case 'validate_custom_rules': {
        const { projectPath, configPath } = args as {
          projectPath: string;
          configPath?: string;
        };

        const loader = new RuleLoader();
        const resolvedPath = (await import('path')).resolve(projectPath);
        const basePath = (await import('path')).dirname(resolvedPath);

        const foundPath = configPath ?? await loader.findConfig(basePath);

        if (!foundPath) {
          return {
            content: [
              {
                type: 'text',
                text: 'No `.ios-review-rules.json` found in the project directory hierarchy.',
              },
            ],
          };
        }

        try {
          const config = await loader.loadConfig(foundPath);
          const compiled = loader.compileRules(config);

          const lines = [
            '# Custom Rules Validation',
            '',
            `**Config file:** ${foundPath}`,
            `**Version:** ${config.version}`,
            `**Rules:** ${config.rules.length}`,
            `**Disabled rules:** ${config.disabledRules?.length ?? 0}`,
            `**Severity overrides:** ${config.severityOverrides ? Object.keys(config.severityOverrides).length : 0}`,
            '',
            '## Rules',
            '',
            '| ID | Title | Severity | Pattern | File Types |',
            '|----|-------|----------|---------|------------|',
          ];

          for (const rule of compiled) {
            const fileTypes = rule.fileTypes?.join(', ') ?? 'all';
            lines.push(
              `| ${rule.id} | ${rule.title} | ${rule.severity} | \`${rule.pattern}\` | ${fileTypes} |`
            );
          }

          if (config.disabledRules && config.disabledRules.length > 0) {
            lines.push('', '## Disabled Rules', '');
            for (const id of config.disabledRules) {
              lines.push(`- ${id}`);
            }
          }

          lines.push('', 'Validation: PASSED');

          return {
            content: [
              {
                type: 'text',
                text: lines.join('\n'),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text',
                text: `Custom rules validation FAILED:\n\n${message}`,
              },
            ],
            isError: true,
          };
        }
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
 * Run all ASC validators for a bundle ID
 */
async function runFullASCValidation(bundleId: string): Promise<AnalysisResult[]> {
  const { ASCMetadataAnalyzer } = await import('./analyzers/asc-metadata.js');
  const { ASCScreenshotAnalyzer } = await import('./analyzers/asc-screenshots.js');
  const { ASCVersionAnalyzer } = await import('./analyzers/asc-version.js');
  const { ASCIAPAnalyzer } = await import('./analyzers/asc-iap.js');

  const results = await Promise.all([
    new ASCMetadataAnalyzer().validateByBundleId(bundleId),
    new ASCScreenshotAnalyzer().validateByBundleId(bundleId),
    new ASCVersionAnalyzer().compareVersions(bundleId),
    new ASCIAPAnalyzer().validateByBundleId(bundleId),
  ]);

  return results;
}

/**
 * Calculate summary from analysis results
 */
function calculateSummary(results: AnalysisResult[]): AnalysisSummary {
  let errors = 0;
  let warnings = 0;
  let info = 0;
  let totalDuration = 0;

  for (const result of results) {
    totalDuration += result.duration;
    for (const issue of result.issues) {
      switch (issue.severity) {
        case 'error':
          errors++;
          break;
        case 'warning':
          warnings++;
          break;
        case 'info':
          info++;
          break;
      }
    }
  }

  return {
    totalIssues: errors + warnings + info,
    errors,
    warnings,
    info,
    passed: errors === 0,
    duration: totalDuration,
  };
}

/**
 * Format a single analysis result
 */
function formatAnalysisResult(result: AnalysisResult): string {
  const lines: string[] = [
    `# ${result.analyzer} Analysis`,
    '',
    `**Status:** ${result.passed ? 'PASSED' : 'ISSUES FOUND'}`,
    `**Duration:** ${result.duration}ms`,
    '',
  ];

  if (result.issues.length === 0) {
    lines.push('No issues found.');
  } else {
    lines.push(`## Issues (${result.issues.length})`);
    lines.push('');

    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? '[ERROR]' : issue.severity === 'warning' ? '[WARN]' : '[INFO]';
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
 * Format a full ASC validation report
 */
function formatASCReport(
  bundleId: string,
  results: AnalysisResult[],
  summary: AnalysisSummary
): string {
  const lines: string[] = [
    '# App Store Connect Validation Report',
    '',
    `**Bundle ID:** ${bundleId}`,
    `**Date:** ${new Date().toISOString()}`,
    `**Status:** ${summary.passed ? 'PASSED' : 'ISSUES FOUND'}`,
    '',
    '## Summary',
    '',
    `- **Total Issues:** ${summary.totalIssues}`,
    `- **Errors:** ${summary.errors}`,
    `- **Warnings:** ${summary.warnings}`,
    `- **Info:** ${summary.info}`,
    `- **Duration:** ${summary.duration}ms`,
    '',
  ];

  for (const result of results) {
    lines.push(`## ${result.analyzer}`);
    lines.push('');

    if (result.issues.length === 0) {
      lines.push('No issues found');
    } else {
      for (const issue of result.issues) {
        const icon = issue.severity === 'error' ? '[ERROR]' : issue.severity === 'warning' ? '[WARN]' : '[INFO]';
        lines.push(`### ${icon} ${issue.title}`);
        lines.push('');
        lines.push(issue.description);
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
