import { JsonFormatter } from '../../src/reports/json.js';
import type { EnrichedAnalysisReport, HistoricalComparison } from '../../src/reports/types.js';
import type { EnrichedIssue } from '../../src/guidelines/types.js';

describe('JsonFormatter', () => {
  let formatter: JsonFormatter;

  beforeEach(() => {
    jest.clearAllMocks();
    formatter = new JsonFormatter();
  });

  const mockEnrichedIssues: EnrichedIssue[] = [
    {
      id: 'security-md5',
      title: 'MD5 usage detected',
      description: 'MD5 is insecure',
      severity: 'warning',
      category: 'security',
      guideline: 'Guideline 2.5.4 - Security',
      guidelineUrl: 'https://developer.apple.com/app-store/review/guidelines/#software-requirements',
      guidelineExcerpt: 'Apps must use appropriate security measures.',
      severityScore: 4,
    },
    {
      id: 'deprecated-uiwebview',
      title: 'UIWebView usage detected',
      description: 'UIWebView is deprecated',
      severity: 'error',
      category: 'deprecated-api',
      filePath: '/test/project/ViewController.swift',
      lineNumber: 42,
      guidelineUrl: 'https://developer.apple.com/app-store/review/guidelines/#software-requirements',
      guidelineExcerpt: 'Apps must use public APIs.',
      severityScore: 9,
    },
  ];

  const mockReport: EnrichedAnalysisReport = {
    projectPath: '/test/project',
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
          },
        ],
        duration: 50,
      },
      {
        analyzer: 'deprecated-api',
        passed: false,
        issues: [
          {
            id: 'deprecated-uiwebview',
            title: 'UIWebView usage detected',
            description: 'UIWebView is deprecated',
            severity: 'error',
            category: 'deprecated-api',
          },
        ],
        duration: 50,
      },
    ],
    summary: {
      totalIssues: 2,
      errors: 1,
      warnings: 1,
      info: 0,
      passed: false,
      duration: 100,
    },
    score: 83,
    enrichedIssues: mockEnrichedIssues,
  };

  it('should produce valid JSON', () => {
    const output = formatter.format(mockReport);

    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should set schemaVersion to 1.0', () => {
    const output = formatter.format(mockReport);
    const parsed = JSON.parse(output);

    expect(parsed.schemaVersion).toBe('1.0');
  });

  it('should set exitCode to 0 when no errors', () => {
    const reportNoErrors: EnrichedAnalysisReport = {
      projectPath: '/test/project',
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
            },
          ],
          duration: 100,
        },
      ],
      summary: {
        totalIssues: 1,
        errors: 0,
        warnings: 1,
        info: 0,
        passed: true,
        duration: 100,
      },
      score: 96,
      enrichedIssues: [mockEnrichedIssues[0]],
    };

    const output = formatter.format(reportNoErrors);
    const parsed = JSON.parse(output);

    expect(parsed.exitCode).toBe(0);
  });

  it('should set exitCode to 1 when errors exist', () => {
    const output = formatter.format(mockReport);
    const parsed = JSON.parse(output);

    expect(parsed.exitCode).toBe(1);
  });

  it('should include all enriched issues', () => {
    const output = formatter.format(mockReport);
    const parsed = JSON.parse(output);

    expect(parsed.issues).toHaveLength(2);
    expect(parsed.issues[0].id).toBe('security-md5');
    expect(parsed.issues[0].guidelineUrl).toBe(
      'https://developer.apple.com/app-store/review/guidelines/#software-requirements',
    );
    expect(parsed.issues[0].guidelineExcerpt).toBe('Apps must use appropriate security measures.');
    expect(parsed.issues[0].severityScore).toBe(4);
    expect(parsed.issues[1].id).toBe('deprecated-uiwebview');
    expect(parsed.issues[1].filePath).toBe('/test/project/ViewController.swift');
    expect(parsed.issues[1].lineNumber).toBe(42);
  });

  it('should include score', () => {
    const output = formatter.format(mockReport);
    const parsed = JSON.parse(output);

    expect(parsed.score).toBe(83);
  });

  it('should include comparison data when present', () => {
    const comparison: HistoricalComparison = {
      previousScanId: 'scan-001',
      previousTimestamp: '2023-12-01T00:00:00.000Z',
      previousScore: 70,
      currentScore: 83,
      scoreDelta: 13,
      newIssues: [
        {
          id: 'new-issue',
          title: 'New issue',
          description: 'Newly detected',
          severity: 'info',
          category: 'code',
        },
      ],
      resolvedIssues: [
        {
          id: 'old-issue',
          title: 'Old issue',
          description: 'Resolved',
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
    const parsed = JSON.parse(output);

    expect(parsed.comparison).toBeDefined();
    expect(parsed.comparison.previousScanId).toBe('scan-001');
    expect(parsed.comparison.previousScore).toBe(70);
    expect(parsed.comparison.currentScore).toBe(83);
    expect(parsed.comparison.scoreDelta).toBe(13);
    expect(parsed.comparison.trend).toBe('improving');
    expect(parsed.comparison.newIssuesCount).toBe(1);
    expect(parsed.comparison.resolvedIssuesCount).toBe(1);
    expect(parsed.comparison.ongoingIssuesCount).toBe(1);
  });

  it('should not include comparison when not present', () => {
    const output = formatter.format(mockReport);
    const parsed = JSON.parse(output);

    expect(parsed.comparison).toBeUndefined();
  });

  it('should include project path and timestamp', () => {
    const output = formatter.format(mockReport);
    const parsed = JSON.parse(output);

    expect(parsed.projectPath).toBe('/test/project');
    expect(parsed.timestamp).toBe('2024-01-01T00:00:00.000Z');
  });
});
