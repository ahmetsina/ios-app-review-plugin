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
 * A security pattern to detect
 */
interface SecurityPattern {
  id: string;
  title: string;
  description: string;
  pattern: RegExp;
  severity: 'error' | 'warning' | 'info';
  guideline: string;
  suggestion: string;
  fileTypes: string[];
}

/**
 * Security patterns to scan for in source code
 */
const SECURITY_PATTERNS: SecurityPattern[] = [
  // Weak cryptography
  {
    id: 'security-md5',
    title: 'Weak hash function (MD5)',
    description: 'MD5 is cryptographically broken. Do not use it for security-sensitive hashing.',
    pattern: /\b(?:CC_MD5|MD5\s*\(|\.md5|kCCHmacAlgMD5)\b/g,
    severity: 'warning',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Use SHA-256 or stronger hash functions (CC_SHA256, CryptoKit SHA256).',
    fileTypes: ['.swift', '.m', '.mm', '.c', '.cpp'],
  },
  {
    id: 'security-sha1',
    title: 'Weak hash function (SHA-1)',
    description: 'SHA-1 is deprecated for security purposes. Use SHA-256 or stronger.',
    pattern: /\b(?:CC_SHA1|\.sha1|kCCHmacAlgSHA1)\b/g,
    severity: 'warning',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Use SHA-256 or stronger (CC_SHA256, CryptoKit SHA256).',
    fileTypes: ['.swift', '.m', '.mm', '.c', '.cpp'],
  },
  {
    id: 'security-des',
    title: 'Weak encryption algorithm (DES/3DES)',
    description: 'DES and 3DES are considered weak encryption. Use AES instead.',
    pattern: /\b(?:kCCAlgorithmDES|kCCAlgorithm3DES|CCAlgorithm\.des)\b/g,
    severity: 'error',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Use AES-256 encryption (kCCAlgorithmAES, CryptoKit AES.GCM).',
    fileTypes: ['.swift', '.m', '.mm', '.c', '.cpp'],
  },
  {
    id: 'security-ecb-mode',
    title: 'Insecure ECB encryption mode',
    description: 'ECB mode does not provide serious message confidentiality. Use CBC or GCM.',
    pattern: /\b(?:kCCOptionECBMode|\.ecb)\b/g,
    severity: 'error',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Use CBC mode with random IV, or preferably GCM mode (CryptoKit AES.GCM).',
    fileTypes: ['.swift', '.m', '.mm', '.c', '.cpp'],
  },
  // Insecure data storage
  {
    id: 'security-userdefaults-sensitive',
    title: 'Sensitive data in UserDefaults',
    description: 'UserDefaults is not encrypted. Do not store sensitive data like passwords or tokens.',
    pattern: /UserDefaults\b[^}]*\b(?:password|token|secret|apiKey|api_key|credential|auth)\b/gi,
    severity: 'error',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Store sensitive data in the Keychain using Security framework.',
    fileTypes: ['.swift'],
  },
  {
    id: 'security-userdefaults-sensitive-set',
    title: 'Storing sensitive value in UserDefaults',
    description: 'UserDefaults is not secure storage. Sensitive data should use Keychain.',
    pattern: /\.set\([^)]+,\s*forKey\s*:\s*["'`](?:password|token|secret|apiKey|api_key|credential|auth\w*|session\w*|private\w*Key)["'`]\)/gi,
    severity: 'error',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Use Keychain Services (SecItemAdd) to store sensitive data securely.',
    fileTypes: ['.swift'],
  },
  // Insecure random number generation
  {
    id: 'security-insecure-random',
    title: 'Insecure random number generation',
    description: 'rand()/srand()/random() are not cryptographically secure.',
    pattern: /\b(?:srand|(?<!arc4)rand|srandom)\s*\(/g,
    severity: 'warning',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Use SecRandomCopyBytes or SystemRandomNumberGenerator for security-sensitive randomness.',
    fileTypes: ['.swift', '.m', '.mm', '.c', '.cpp'],
  },
  // Insecure keychain configuration
  {
    id: 'security-keychain-accessible-always',
    title: 'Insecure Keychain accessibility',
    description: 'kSecAttrAccessibleAlways is deprecated and insecure. Data is accessible even when device is locked.',
    pattern: /\bkSecAttrAccessibleAlways\b/g,
    severity: 'error',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Use kSecAttrAccessibleWhenUnlocked or kSecAttrAccessibleAfterFirstUnlock.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  {
    id: 'security-keychain-accessible-always-this-device',
    title: 'Insecure Keychain accessibility (ThisDeviceOnly)',
    description: 'kSecAttrAccessibleAlwaysThisDeviceOnly is deprecated and insecure.',
    pattern: /\bkSecAttrAccessibleAlwaysThisDeviceOnly\b/g,
    severity: 'error',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Use kSecAttrAccessibleWhenUnlockedThisDeviceOnly or kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // Clipboard sensitive data
  {
    id: 'security-clipboard-sensitive',
    title: 'Sensitive data on clipboard',
    description: 'Copying sensitive data to the clipboard exposes it to other apps.',
    pattern: /UIPasteboard\b[^}]*\b(?:password|token|secret|credential)\b/gi,
    severity: 'warning',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Avoid putting sensitive data on the clipboard. If needed, set expiration with localOnly option.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // SQL injection
  {
    id: 'security-sql-injection',
    title: 'Potential SQL injection',
    description: 'String interpolation in SQL queries can lead to SQL injection attacks.',
    pattern: /["'`](?:SELECT|INSERT|UPDATE|DELETE|DROP)\s[^"'`]*\\?\([^"'`]*\)/gi,
    severity: 'error',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Use parameterized queries or prepared statements instead of string interpolation.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // Logging sensitive data
  {
    id: 'security-logging-sensitive',
    title: 'Logging potentially sensitive data',
    description: 'Logging sensitive information like passwords or tokens can expose them.',
    pattern: /(?:print|NSLog|os_log|Logger\.\w+)\s*\([^)]*\b(?:password|token|secret|apiKey|credential|ssn|creditCard)\b/gi,
    severity: 'warning',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Never log sensitive data. Redact or mask sensitive values in log output.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // Hardcoded encryption keys
  {
    id: 'security-hardcoded-encryption-key',
    title: 'Hardcoded encryption key',
    description: 'Encryption keys should not be hardcoded in source code.',
    pattern: /(?:encryptionKey|aesKey|cryptKey|cipherKey|symmetricKey)\s*[:=]\s*["'`][A-Za-z0-9+/=]{16,}["'`]/gi,
    severity: 'error',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Derive encryption keys dynamically or store them securely in the Keychain.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // WebView JavaScript injection
  {
    id: 'security-webview-js-injection',
    title: 'WebView JavaScript evaluation',
    description: 'Evaluating JavaScript in WebViews with user-supplied data can lead to XSS attacks.',
    pattern: /\.evaluateJavaScript\s*\(\s*["'`].*\\?\(/g,
    severity: 'warning',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Sanitize any user input before evaluating JavaScript. Consider using WKScriptMessageHandler instead.',
    fileTypes: ['.swift'],
  },
  // Disabled certificate validation
  {
    id: 'security-disabled-ssl',
    title: 'Disabled SSL/TLS certificate validation',
    description: 'Disabling certificate validation makes connections vulnerable to MITM attacks.',
    pattern: /(?:\.serverTrust|\.performDefaultHandling|allowsExpiredCertificates|allowsExpiredRoots|validatesDomainName\s*=\s*false|NSExceptionAllowsInsecureHTTPLoads)/g,
    severity: 'warning',
    guideline: 'Guideline 2.5.4 - Security',
    suggestion: 'Always validate SSL certificates in production. Implement proper certificate pinning.',
    fileTypes: ['.swift', '.m', '.mm'],
  },
];

/**
 * Security analyzer for detecting common security vulnerabilities
 */
export class SecurityAnalyzer implements Analyzer {
  name = 'Security Analyzer';
  description = 'Detects security vulnerabilities and insecure patterns';

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
   * Scan a specific path for security issues
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

        for (const pattern of SECURITY_PATTERNS) {
          if (!pattern.fileTypes.includes(ext)) continue;

          pattern.pattern.lastIndex = 0;

          let match: RegExpExecArray | null;
          while ((match = pattern.pattern.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;
            const issueKey = `${pattern.id}:${file}:${lineNumber}`;

            if (seenIssues.has(issueKey)) continue;
            seenIssues.add(issueKey);

            // Skip commented lines
            const line = lines[lineNumber - 1] ?? '';
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
              continue;
            }

            issues.push({
              id: pattern.id,
              title: pattern.title,
              description: `${pattern.description}\n\nFound: \`${this.truncate(match[0], 60)}\``,
              severity: pattern.severity,
              filePath: file,
              lineNumber,
              category: 'security',
              guideline: pattern.guideline,
              suggestion: pattern.suggestion,
            });

            const count = issues.filter((i) => i.id === pattern.id && i.filePath === file).length;
            if (count >= 5) break;
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return issues;
  }

  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }
}
