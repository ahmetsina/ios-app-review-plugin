import * as fs from 'fs/promises';
import * as path from 'path';
import fg from 'fast-glob';
import type {
  Analyzer,
  AnalysisResult,
  AnalyzerOptions,
  Issue,
  XcodeProject,
} from '../types/index.js';

/**
 * Patterns to scan for in source code
 */
interface ScanPattern {
  id: string;
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  pattern: RegExp;
  guideline?: string;
  suggestion?: string;
  fileTypes?: string[];
}

const SCAN_PATTERNS: ScanPattern[] = [
  // IPv4 hardcoded addresses (IPv6 compliance)
  {
    id: 'hardcoded-ipv4',
    title: 'Hardcoded IPv4 address',
    description: 'Hardcoded IPv4 addresses may cause issues on IPv6-only networks.',
    severity: 'warning',
    pattern: /["'`](\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})["'`]/g,
    guideline: 'Guideline 2.5.1 - IPv6 Compatibility',
    suggestion: 'Use hostnames instead of hardcoded IP addresses for IPv6 compatibility.',
  },
  // Hardcoded API keys and secrets
  {
    id: 'hardcoded-api-key',
    title: 'Potential hardcoded API key',
    description: 'This appears to be a hardcoded API key or secret.',
    severity: 'error',
    pattern:
      /(?:api[_-]?key|apikey|secret[_-]?key|secretkey|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*["'`][A-Za-z0-9_\-]{16,}["'`]/gi,
    guideline: 'Security Best Practice',
    suggestion:
      'Store sensitive keys in environment variables, Keychain, or a secure configuration system.',
  },
  // AWS keys
  {
    id: 'aws-key',
    title: 'Potential AWS access key',
    description: 'This appears to be a hardcoded AWS access key.',
    severity: 'error',
    pattern: /["'`](AKIA[0-9A-Z]{16})["'`]/g,
    guideline: 'Security Best Practice',
    suggestion: 'Never commit AWS keys to source code. Use IAM roles or secure key management.',
  },
  // Test/Debug server URLs
  {
    id: 'test-server-url',
    title: 'Test/staging server URL',
    description: 'This appears to be a test or staging server URL that should not be in production.',
    severity: 'warning',
    pattern:
      /["'`]https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|staging\.|test\.|dev\.)[^"'`]*["'`]/gi,
    suggestion:
      'Ensure test/staging URLs are not used in release builds. Use build configurations or environment variables.',
  },
  // Print/NSLog statements
  {
    id: 'print-statement',
    title: 'Print/logging statement',
    description: 'Console logging statements should be removed or disabled in release builds.',
    severity: 'info',
    pattern: /\b(?:print|NSLog|debugPrint)\s*\(/g,
    suggestion: 'Use conditional logging that is disabled in release builds.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // TODO/FIXME comments
  {
    id: 'todo-comment',
    title: 'TODO/FIXME comment',
    description: 'Incomplete task marker found. Ensure all TODOs are addressed before release.',
    severity: 'info',
    pattern: /\/\/\s*(?:TODO|FIXME|HACK|XXX|BUG)[\s:]/gi,
    suggestion: 'Address or remove TODO/FIXME comments before App Store submission.',
  },
  // Force unwrapping
  {
    id: 'force-unwrap',
    title: 'Force unwrap operator',
    description: 'Force unwrapping (!) can cause crashes if the value is nil.',
    severity: 'info',
    pattern: /\w+\s*!\s*(?:\.|$|\)|\])/g,
    suggestion: 'Consider using optional binding (if let) or nil-coalescing (??) instead.',
    fileTypes: ['.swift'],
  },
  // Hardcoded credentials
  {
    id: 'hardcoded-password',
    title: 'Potential hardcoded password',
    description: 'This appears to be a hardcoded password or credential.',
    severity: 'error',
    pattern: /(?:password|passwd|pwd|credential)\s*[:=]\s*["'`][^"'`]{4,}["'`]/gi,
    guideline: 'Security Best Practice',
    suggestion: 'Never hardcode passwords. Use Keychain or secure credential storage.',
  },
  // HTTP URLs (non-HTTPS)
  {
    id: 'insecure-http',
    title: 'Insecure HTTP URL',
    description: 'HTTP URLs are insecure. Use HTTPS for all network connections.',
    severity: 'warning',
    pattern: /["'`]http:\/\/(?!localhost|127\.0\.0\.1)[^"'`]+["'`]/gi,
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Use HTTPS for all external URLs. Configure App Transport Security appropriately.',
  },
  // Placeholder text
  {
    id: 'placeholder-text',
    title: 'Placeholder text',
    description: 'Lorem ipsum or placeholder text detected.',
    severity: 'warning',
    pattern: /["'`](?:lorem\s+ipsum|placeholder|sample\s+text|dummy\s+text)[^"'`]*["'`]/gi,
    guideline: 'Guideline 2.3 - Accurate Metadata',
    suggestion: 'Replace placeholder text with actual content before submission.',
  },
  // #if DEBUG with potentially problematic code
  {
    id: 'debug-ifdef',
    title: '#if DEBUG block',
    description: 'Debug-only code block detected. Verify it does not affect release functionality.',
    severity: 'info',
    pattern: /#if\s+DEBUG/g,
    suggestion: 'Review DEBUG blocks to ensure they do not contain required functionality.',
    fileTypes: ['.swift'],
  },
  // Deprecated UIWebView
  {
    id: 'deprecated-uiwebview',
    title: 'Deprecated UIWebView usage',
    description:
      'UIWebView is deprecated and Apple rejects new apps using it. Use WKWebView instead.',
    severity: 'error',
    pattern: /\bUIWebView\b/g,
    guideline: 'ITMS-90809',
    suggestion: 'Migrate to WKWebView. UIWebView is no longer accepted.',
  },
  // Deprecated APIs
  {
    id: 'deprecated-addressbook',
    title: 'Deprecated AddressBook framework',
    description: 'AddressBook framework is deprecated. Use Contacts framework instead.',
    severity: 'warning',
    pattern: /\bABAddressBook\w*\b/g,
    suggestion: 'Migrate to the Contacts framework.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
];

/**
 * Code scanner for detecting common issues
 */
export class CodeScanner implements Analyzer {
  name = 'Code Scanner';
  description = 'Scans source code for common App Store rejection issues';

  async analyze(project: XcodeProject, options: AnalyzerOptions): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Get source files from targets or scan directory
    const targets = options.targetName
      ? project.targets.filter((t) => t.name === options.targetName)
      : project.targets.filter((t) => t.type === 'application');

    let sourceFiles: string[] = [];
    for (const target of targets) {
      sourceFiles.push(...target.sourceFiles);
    }

    // If no source files from project, scan directory
    if (sourceFiles.length === 0) {
      sourceFiles = await this.findSourceFiles(options.basePath);
    }

    const issues = await this.scanFiles(sourceFiles);

    return {
      analyzer: this.name,
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Scan a specific path (file or directory)
   */
  async scanPath(scanPath: string, patterns?: string[]): Promise<AnalysisResult> {
    const startTime = Date.now();

    const stats = await fs.stat(scanPath);
    const files = stats.isDirectory()
      ? await this.findSourceFiles(scanPath)
      : [scanPath];

    const activePatterns = patterns
      ? SCAN_PATTERNS.filter((p) => patterns.includes(p.id))
      : SCAN_PATTERNS;

    const issues = await this.scanFiles(files, activePatterns);

    return {
      analyzer: this.name,
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Find all source files in a directory
   */
  private async findSourceFiles(basePath: string): Promise<string[]> {
    return fg(['**/*.swift', '**/*.m', '**/*.mm', '**/*.h'], {
      cwd: basePath,
      absolute: true,
      ignore: [
        '**/Pods/**',
        '**/Carthage/**',
        '**/build/**',
        '**/DerivedData/**',
        '**/*.generated.swift',
        '**/Tests/**',
        '**/UITests/**',
      ],
    });
  }

  /**
   * Scan files for issues
   */
  private async scanFiles(
    files: string[],
    patterns: ScanPattern[] = SCAN_PATTERNS
  ): Promise<Issue[]> {
    const issues: Issue[] = [];
    const seenIssues = new Set<string>();

    for (const file of files) {
      const ext = path.extname(file);

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (const pattern of patterns) {
          // Skip if pattern is for specific file types and this isn't one
          if (pattern.fileTypes && !pattern.fileTypes.includes(ext)) {
            continue;
          }

          // Reset regex state
          pattern.pattern.lastIndex = 0;

          let match: RegExpExecArray | null;
          while ((match = pattern.pattern.exec(content)) !== null) {
            // Find line number
            const lineNumber = this.getLineNumber(content, match.index);
            const issueKey = `${pattern.id}:${file}:${lineNumber}`;

            // Avoid duplicate issues at the same location
            if (seenIssues.has(issueKey)) {
              continue;
            }
            seenIssues.add(issueKey);

            // Skip false positives
            if (this.isFalsePositive(pattern.id, match[0], lines[lineNumber - 1] ?? '')) {
              continue;
            }

            const issue: Issue = {
              id: pattern.id,
              title: pattern.title,
              description: `${pattern.description}\n\nFound: \`${this.truncate(match[0], 50)}\``,
              severity: pattern.severity,
              filePath: file,
              lineNumber,
              category: 'code',
            };
            if (pattern.guideline) {
              issue.guideline = pattern.guideline;
            }
            if (pattern.suggestion) {
              issue.suggestion = pattern.suggestion;
            }
            issues.push(issue);

            // Limit issues per pattern per file
            const issuesForPattern = issues.filter(
              (i) => i.id === pattern.id && i.filePath === file
            );
            if (issuesForPattern.length >= 5) {
              break;
            }
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return issues;
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Check if a match is a false positive
   */
  private isFalsePositive(patternId: string, match: string, line: string): boolean {
    // Skip commented lines
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
      // Allow TODO/FIXME in comments (that's what we're looking for)
      if (patternId !== 'todo-comment') {
        return true;
      }
    }

    // Skip test files content
    if (line.includes('XCTest') || line.includes('@testable')) {
      return true;
    }

    // Pattern-specific false positive handling
    switch (patternId) {
      case 'hardcoded-ipv4':
        // Skip version numbers that look like IPs
        if (/\d+\.\d+\.\d+\.\d+/.test(match)) {
          const ip = match.match(/\d+\.\d+\.\d+\.\d+/)?.[0];
          if (ip) {
            const parts = ip.split('.').map(Number);
            // Skip if any part > 255 (not a valid IP)
            if (parts.some((p) => p !== undefined && p > 255)) {
              return true;
            }
            // Skip localhost
            if (ip === '127.0.0.1' || ip === '0.0.0.0') {
              return true;
            }
          }
        }
        break;

      case 'force-unwrap':
        // Skip IBOutlets and known safe patterns
        if (line.includes('@IBOutlet') || line.includes('@IBAction')) {
          return true;
        }
        // Skip try! and as!
        if (/try\s*!/.test(match) || /as\s*!/.test(match)) {
          // These are separate issues, not force unwrap
          return true;
        }
        break;

      case 'print-statement':
        // Skip if inside #if DEBUG
        if (line.includes('#if DEBUG') || line.includes('#if debug')) {
          return true;
        }
        break;

      case 'insecure-http':
        // Skip App Transport Security exception domains
        if (line.includes('NSExceptionDomains') || line.includes('Exception')) {
          return true;
        }
        break;
    }

    return false;
  }

  /**
   * Truncate string for display
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 3) + '...';
  }
}
