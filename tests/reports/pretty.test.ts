import { PrettyFormatter } from '../../src/reports/pretty.js';
import type { EnrichedAnalysisReport, HistoricalComparison } from '../../src/reports/types.js';
import type { EnrichedIssue } from '../../src/guidelines/types.js';

describe('PrettyFormatter', () => {
  let formatter: PrettyFormatter;

  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    // Save and clear color-related env vars
    savedEnv['NO_COLOR'] = process.env['NO_COLOR'];
    savedEnv['TERM'] = process.env['TERM'];
    delete process.env['NO_COLOR'];
    delete process.env['TERM'];
    formatter = new PrettyFormatter();
  });

  afterEach(() => {
    // Restore env vars
    if (savedEnv['NO_COLOR'] !== undefined) {
      process.env['NO_COLOR'] = savedEnv['NO_COLOR'];
    } else {
      delete process.env['NO_COLOR'];
    }
    if (savedEnv['TERM'] !== undefined) {
      process.env['TERM'] = savedEnv['TERM'];
    } else {
      delete process.env['TERM'];
    }
  });

  const mockEnrichedIssue: EnrichedIssue = {
    id: 'security-md5',
    title: 'MD5 usage detected',
    description: 'MD5 is insecure',
    severity: 'warning',
    category: 'security',
    filePath: 'src/Crypto/Hash.swift',
    lineNumber: 42,
    guideline: 'Guideline 2.5.4 - Security',
    guidelineUrl: 'https://developer.apple.com/app-store/review/guidelines/#software-requirements',
    guidelineExcerpt: 'Apps must use appropriate security measures.',
    suggestion: 'Use SHA-256',
    severityScore: 4,
  };

  const mockReport: EnrichedAnalysisReport = {
    projectPath: '/test/MyApp.xcodeproj',
    timestamp: '2024-01-01T00:00:00.000Z',
    results: [
      {
        analyzer: 'security',
        passed: false,
        issues: [
          {
            id: 'security-md5',
            title: 'MD5 usage detected',
            description: 'MD5 is insecure',
            severity: 'warning',
            category: 'security',
            guideline: 'Guideline 2.5.4 - Security',
          },
        ],
        duration: 142,
      },
    ],
    summary: {
      totalIssues: 1,
      errors: 0,
      warnings: 1,
      info: 0,
      passed: true,
      duration: 142,
    },
    score: 96,
    enrichedIssues: [mockEnrichedIssue],
  };

  it('should include project path in header', () => {
    const output = formatter.format(mockReport);
    expect(output).toContain('/test/MyApp.xcodeproj');
  });

  it('should show box-drawing characters in header', () => {
    const output = formatter.format(mockReport);
    expect(output).toContain('\u256D'); // ╭
    expect(output).toContain('\u256E'); // ╮
    expect(output).toContain('\u2570'); // ╰
    expect(output).toContain('\u256F'); // ╯
    expect(output).toContain('\u2502'); // │
    expect(output).toContain('App Store Review Report');
  });

  it('should show score with Unicode bar characters', () => {
    const output = formatter.format(mockReport);
    expect(output).toContain('96/100');
    expect(output).toContain('\u2588'); // █ filled block
    expect(output).toContain('\u2591'); // ░ empty block
  });

  it('should contain ANSI escape sequences when color is enabled', () => {
    const output = formatter.format(mockReport);
    expect(output).toContain('\x1b[');
  });

  it('should include summary with issue counts and duration', () => {
    const output = formatter.format(mockReport);
    expect(output).toContain('Total Issues  1');
    expect(output).toContain('Errors  0');
    expect(output).toContain('Warnings  1');
    expect(output).toContain('Info  0');
    expect(output).toContain('Duration      142ms');
  });

  it('should group issues by category', () => {
    const output = formatter.format(mockReport);
    expect(output).toContain('Security');
    expect(output).toContain('1 issue');
    expect(output).toContain('MD5 usage detected');
  });

  it('should show severity badges', () => {
    const errorIssue: EnrichedIssue = {
      id: 'api-key',
      title: 'Hardcoded API key detected',
      description: 'Hardcoded API key found',
      severity: 'error',
      category: 'security',
      filePath: 'src/Config.swift',
      lineNumber: 12,
      suggestion: 'Use environment variables',
      severityScore: 8,
    };

    const reportWithError: EnrichedAnalysisReport = {
      ...mockReport,
      summary: { ...mockReport.summary, errors: 1, passed: false },
      enrichedIssues: [errorIssue, mockEnrichedIssue],
    };

    const output = formatter.format(reportWithError);
    expect(output).toContain(' ERROR ');
    expect(output).toContain(' WARN  ');
  });

  it('should show priority remediation for error issues', () => {
    const errorIssue: EnrichedIssue = {
      id: 'api-key',
      title: 'Hardcoded API key detected',
      description: 'Hardcoded API key found',
      severity: 'error',
      category: 'security',
      filePath: 'src/Config.swift',
      lineNumber: 12,
      suggestion: 'Use environment variables',
      severityScore: 8,
    };

    const reportWithError: EnrichedAnalysisReport = {
      ...mockReport,
      summary: { ...mockReport.summary, errors: 1, passed: false },
      enrichedIssues: [errorIssue],
    };

    const output = formatter.format(reportWithError);
    expect(output).toContain('Priority Remediation');
    expect(output).toContain('Hardcoded API key detected');
    expect(output).toContain('src/Config.swift');
    expect(output).toContain('Suggestion: Use environment variables');
  });

  it('should show file paths and line numbers in issues', () => {
    const output = formatter.format(mockReport);
    expect(output).toContain('src/Crypto/Hash.swift');
    expect(output).toContain('42');
  });

  it('should show suggestions for issues', () => {
    const output = formatter.format(mockReport);
    expect(output).toContain('Suggestion: Use SHA-256');
  });

  it('should include historical comparison when present', () => {
    const comparison: HistoricalComparison = {
      previousScanId: 'scan-001',
      previousTimestamp: '2023-12-01T00:00:00.000Z',
      previousScore: 80,
      currentScore: 96,
      scoreDelta: 16,
      newIssues: [],
      resolvedIssues: [
        {
          id: 'resolved-1',
          title: 'Resolved issue',
          description: 'This was resolved',
          severity: 'warning',
          category: 'security',
        },
      ],
      ongoingIssues: [
        {
          id: 'security-md5',
          title: 'MD5 usage detected',
          description: 'MD5 is insecure',
          severity: 'warning',
          category: 'security',
        },
      ],
      trend: 'improving',
    };

    const reportWithComparison: EnrichedAnalysisReport = {
      ...mockReport,
      comparison,
    };

    const output = formatter.format(reportWithComparison);
    expect(output).toContain('Historical Comparison');
    expect(output).toContain('80/100');
    expect(output).toContain('96/100');
    expect(output).toContain('+16');
    expect(output).toContain('Improving');
  });

  it('should handle report with no issues', () => {
    const cleanReport: EnrichedAnalysisReport = {
      projectPath: '/test/clean-project',
      timestamp: '2024-01-01T00:00:00.000Z',
      results: [],
      summary: {
        totalIssues: 0,
        errors: 0,
        warnings: 0,
        info: 0,
        passed: true,
        duration: 50,
      },
      score: 100,
      enrichedIssues: [],
    };

    const output = formatter.format(cleanReport);
    expect(output).toContain('No issues found.');
    expect(output).not.toContain('Priority Remediation');
  });

  it('should not contain ANSI escapes when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    const noColorFormatter = new PrettyFormatter();
    const output = noColorFormatter.format(mockReport);
    expect(output).not.toContain('\x1b[');
    // Should still contain content
    expect(output).toContain('App Store Review Report');
    expect(output).toContain('96/100');
  });

  it('should not contain ANSI escapes when TERM=dumb', () => {
    process.env['TERM'] = 'dumb';
    const dumbFormatter = new PrettyFormatter();
    const output = dumbFormatter.format(mockReport);
    expect(output).not.toContain('\x1b[');
    expect(output).toContain('App Store Review Report');
  });

  it('should show pass status with checkmark', () => {
    const output = formatter.format(mockReport);
    expect(output).toContain('\u2714'); // ✔
    expect(output).toContain('PASSED');
  });

  it('should show fail status with cross mark', () => {
    const failReport: EnrichedAnalysisReport = {
      ...mockReport,
      summary: { ...mockReport.summary, errors: 1, passed: false },
    };

    const output = formatter.format(failReport);
    expect(output).toContain('\u2718'); // ✘
    expect(output).toContain('ISSUES FOUND');
  });
});
