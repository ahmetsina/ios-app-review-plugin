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
 * A private API pattern to detect
 */
interface PrivateAPIPattern {
  id: string;
  title: string;
  description: string;
  pattern: RegExp;
  severity: 'error' | 'warning';
  suggestion: string;
  fileTypes: string[];
}

/**
 * Known private/undocumented frameworks that cause rejection
 */
const PRIVATE_FRAMEWORKS = [
  'GraphicsServices',
  'BackBoardServices',
  'SpringBoardServices',
  'ChatKit',
  'MobileInstallation',
  'AppSupport',
  'TelephonyUtilities',
  'FrontBoard',
  'XCTest', // Not private but shouldn't ship in production
  'UIKitCore', // Direct access (vs UIKit) can indicate private usage
  'TextInput',
  'Celestial',
  'IOMobileFramebuffer',
  'BluetoothManager',
  'WirelessDiagnostics',
];

/**
 * Known private URL schemes that cause rejection
 */
const PRIVATE_URL_SCHEMES = [
  { scheme: 'cydia://', description: 'Cydia URL scheme (jailbreak-related)' },
  { scheme: 'prefs://', description: 'Private preferences URL scheme (use UIApplication.openSettingsURLString)' },
  { scheme: 'tel-prompt://', description: 'Private telephone prompt scheme' },
  { scheme: 'app-prefs://', description: 'Private app preferences URL scheme' },
  { scheme: 'dbapi://', description: 'Private debug API URL scheme' },
];

/**
 * Patterns for detecting private API usage
 */
const PRIVATE_API_PATTERNS: PrivateAPIPattern[] = [
  // Known private selectors with underscore prefix
  {
    id: 'private-underscore-selector',
    title: 'Private selector access',
    description: 'Accessing a selector that starts with underscore indicates private API usage.',
    pattern: /NSSelectorFromString\(\s*["'`]_\w+[^"'`]*["'`]\s*\)/g,
    severity: 'error',
    suggestion: 'Remove usage of private selectors. Use only public APIs.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // NSClassFromString with private classes
  {
    id: 'private-class-from-string',
    title: 'Private class access via NSClassFromString',
    description: 'Accessing a private class by name using NSClassFromString.',
    pattern: /NSClassFromString\(\s*["'`](?:_UI\w+|_NS\w+|UIStatusBar\w*Internal|_CK\w+|_MF\w+)["'`]\s*\)/g,
    severity: 'error',
    suggestion: 'Do not use private classes. Use only documented public APIs.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // performSelector with private selectors
  {
    id: 'private-perform-selector',
    title: 'performSelector with private selector',
    description: 'Using performSelector with a selector starting with underscore.',
    pattern: /perform(?:Selector|#selector)\s*\(\s*(?:NSSelectorFromString\(\s*)?["'`]_\w+/g,
    severity: 'error',
    suggestion: 'Do not call private selectors. Use documented public APIs.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // valueForKey accessing private properties
  {
    id: 'private-value-for-key',
    title: 'Accessing private property via valueForKey',
    description: 'Using valueForKey/setValue to access properties starting with underscore.',
    pattern: /(?:value|setValue)\s*\(\s*(?:forKey|forKeyPath)\s*:\s*["'`]_\w+["'`]\s*\)/g,
    severity: 'warning',
    suggestion: 'Avoid accessing private properties via KVC. Use public APIs.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // dlopen for private frameworks
  {
    id: 'private-dlopen',
    title: 'Dynamic loading of framework',
    description: 'Using dlopen to dynamically load frameworks may indicate private API access.',
    pattern: /dlopen\s*\(\s*["'`][^"'`]*(?:PrivateFrameworks|private)[^"'`]*["'`]/gi,
    severity: 'error',
    suggestion: 'Do not load private frameworks. Use only public frameworks.',
    fileTypes: ['.swift', '.m', '.mm', '.c', '.cpp'],
  },
  // dlsym usage (suspicious in iOS apps)
  {
    id: 'private-dlsym',
    title: 'Dynamic symbol lookup (dlsym)',
    description: 'Using dlsym to look up symbols dynamically may indicate private API usage.',
    pattern: /dlsym\s*\(/g,
    severity: 'warning',
    suggestion: 'Avoid dlsym in iOS apps. Use documented public APIs directly.',
    fileTypes: ['.swift', '.m', '.mm', '.c', '.cpp'],
  },
  // objc_msgSend with private selectors
  {
    id: 'private-objc-msgsend',
    title: 'Direct objc_msgSend call',
    description: 'Direct objc_msgSend usage may be used to call private APIs.',
    pattern: /objc_msgSend\s*\(/g,
    severity: 'warning',
    suggestion: 'Avoid direct objc_msgSend calls. Use standard method invocations.',
    fileTypes: ['.m', '.mm', '.c', '.cpp'],
  },
  // IOKit private APIs
  {
    id: 'private-iokit',
    title: 'IOKit private API usage',
    description: 'IOKit APIs are mostly private on iOS and can cause rejection.',
    pattern: /\b(?:IOServiceGetMatchingService|IORegistryEntryCreateCFProperties|IOMasterPort|IOServiceMatching)\b/g,
    severity: 'error',
    suggestion: 'IOKit is a private framework on iOS. Use public APIs (e.g., UIDevice) instead.',
    fileTypes: ['.swift', '.m', '.mm', '.c', '.cpp'],
  },
  // Private status bar manipulation
  {
    id: 'private-statusbar',
    title: 'Private status bar API',
    description: 'Accessing private UIStatusBar APIs.',
    pattern: /\b_(?:setStatusBarHidden|setStatusBarStyle|statusBarHeight|statusBarWindow)\b/g,
    severity: 'error',
    suggestion: 'Use the public UIViewController status bar appearance APIs.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // Accessing app container paths that suggest sandbox escape
  {
    id: 'private-sandbox-escape',
    title: 'Potential sandbox escape',
    description: 'Accessing file paths outside the app sandbox.',
    pattern: /["'`]\/(?:var\/mobile|private\/var\/(?!mobile\/Containers)|Applications\/|usr\/lib\/)[^"'`]*["'`]/g,
    severity: 'error',
    suggestion: 'Apps must operate within their sandbox. Use FileManager APIs for app directories.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
];

/**
 * Analyzer that detects usage of private iOS APIs
 */
export class PrivateAPIAnalyzer implements Analyzer {
  name = 'Private API Scanner';
  description = 'Detects usage of private iOS APIs that cause App Store rejection';

  async analyze(project: XcodeProject, options: AnalyzerOptions): Promise<AnalysisResult> {
    const startTime = Date.now();

    const targets = options.targetName
      ? project.targets.filter((t) => t.name === options.targetName)
      : project.targets.filter((t) => t.type === 'application');

    let sourceFiles: string[] = [];
    for (const target of targets) {
      sourceFiles.push(...target.sourceFiles);
    }

    if (sourceFiles.length === 0) {
      sourceFiles = await this.findSourceFiles(options.basePath);
    }

    // Filter to changed files for incremental scanning
    if (options.changedFiles) {
      const changedSet = new Set(options.changedFiles);
      sourceFiles = sourceFiles.filter((f) => changedSet.has(f));
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
   * Scan a specific path for private API usage
   */
  async scanPath(scanPath: string): Promise<AnalysisResult> {
    const startTime = Date.now();

    const stats = await fs.stat(scanPath);
    const files = stats.isDirectory()
      ? await this.findSourceFiles(scanPath)
      : [scanPath];

    const issues = await this.scanFiles(files);

    return {
      analyzer: this.name,
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  private async findSourceFiles(basePath: string): Promise<string[]> {
    return fg(['**/*.swift', '**/*.m', '**/*.mm', '**/*.h', '**/*.c', '**/*.cpp'], {
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

  private async scanFiles(files: string[]): Promise<Issue[]> {
    const issues: Issue[] = [];
    const seenIssues = new Set<string>();

    for (const file of files) {
      const ext = path.extname(file);

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        // Check for private framework imports
        this.checkPrivateFrameworks(content, lines, file, issues, seenIssues);

        // Check for private URL schemes
        this.checkPrivateURLSchemes(content, file, issues, seenIssues);

        // Check regex patterns
        for (const apiPattern of PRIVATE_API_PATTERNS) {
          if (!apiPattern.fileTypes.includes(ext)) continue;

          apiPattern.pattern.lastIndex = 0;

          let match: RegExpExecArray | null;
          while ((match = apiPattern.pattern.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;
            const issueKey = `${apiPattern.id}:${file}:${lineNumber}`;

            if (seenIssues.has(issueKey)) continue;
            seenIssues.add(issueKey);

            // Skip commented lines
            const line = lines[lineNumber - 1] ?? '';
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
              continue;
            }

            issues.push({
              id: apiPattern.id,
              title: apiPattern.title,
              description: `${apiPattern.description}\n\nFound: \`${match[0].substring(0, 60)}\``,
              severity: apiPattern.severity,
              filePath: file,
              lineNumber,
              category: 'private-api',
              guideline: 'Guideline 2.5.1 - Use of Non-Public APIs',
              suggestion: apiPattern.suggestion,
            });

            const count = issues.filter((i) => i.id === apiPattern.id && i.filePath === file).length;
            if (count >= 5) break;
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return issues;
  }

  private checkPrivateFrameworks(
    content: string,
    lines: string[],
    file: string,
    issues: Issue[],
    seenIssues: Set<string>
  ): void {
    for (const framework of PRIVATE_FRAMEWORKS) {
      const importPatterns = [
        new RegExp(`import\\s+${framework}\\b`, 'g'),
        new RegExp(`#import\\s*<${framework}/`, 'g'),
        new RegExp(`@import\\s+${framework}\\b`, 'g'),
      ];

      for (const pattern of importPatterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split('\n').length;
          const issueKey = `private-framework-${framework}:${file}:${lineNumber}`;

          if (seenIssues.has(issueKey)) continue;
          seenIssues.add(issueKey);

          const line = lines[lineNumber - 1] ?? '';
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue;
          }

          issues.push({
            id: `private-framework-${framework.toLowerCase()}`,
            title: `Private framework: ${framework}`,
            description: `Importing private/undocumented framework \`${framework}\` will cause App Store rejection.\n\nFound: \`${match[0]}\``,
            severity: 'error',
            filePath: file,
            lineNumber,
            category: 'private-api',
            guideline: 'Guideline 2.5.1 - Use of Non-Public APIs',
            suggestion: `Remove the \`${framework}\` import. Use only public Apple frameworks.`,
          });
        }
      }
    }
  }

  private checkPrivateURLSchemes(
    content: string,
    file: string,
    issues: Issue[],
    seenIssues: Set<string>
  ): void {
    for (const urlScheme of PRIVATE_URL_SCHEMES) {
      const pattern = new RegExp(`["'\`]${urlScheme.scheme.replace('://', '://')}`, 'gi');
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const issueKey = `private-url-scheme:${urlScheme.scheme}:${file}:${lineNumber}`;

        if (seenIssues.has(issueKey)) continue;
        seenIssues.add(issueKey);

        issues.push({
          id: 'private-url-scheme',
          title: `Private URL scheme: ${urlScheme.scheme}`,
          description: `${urlScheme.description}\n\nFound: \`${match[0]}\``,
          severity: 'error',
          filePath: file,
          lineNumber,
          category: 'private-api',
          guideline: 'Guideline 2.5.1 - Use of Non-Public APIs',
          suggestion: 'Use only public URL schemes documented by Apple.',
        });
      }
    }
  }
}
