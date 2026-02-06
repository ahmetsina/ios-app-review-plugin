import { MarkdownFormatter } from '../../src/reports/markdown.js';
import type { EnrichedAnalysisReport, HistoricalComparison } from '../../src/reports/types.js';
import type { EnrichedIssue } from '../../src/guidelines/types.js';

describe('MarkdownFormatter', () => {
  let formatter: MarkdownFormatter;

  beforeEach(() => {
    jest.clearAllMocks();
    formatter = new MarkdownFormatter();
  });

  const mockEnrichedIssue: EnrichedIssue = {
    id: 'security-md5',
    title: 'MD5 usage detected',
    description: 'MD5 is insecure',
    severity: 'warning',
    category: 'security',
    guideline: 'Guideline 2.5.4 - Security',
    guidelineUrl: 'https://developer.apple.com/app-store/review/guidelines/#software-requirements',
    guidelineExcerpt: 'Apps must use appropriate security measures.',
    severityScore: 4,
  };

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
            guideline: 'Guideline 2.5.4 - Security',
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
    enrichedIssues: [mockEnrichedIssue],
  };

  it('should include project path in output', () => {
    const output = formatter.format(mockReport);

    expect(output).toContain('`/test/project`');
  });

  it('should include score section with score bar', () => {
    const output = formatter.format(mockReport);

    expect(output).toContain('## Review Readiness Score');
    expect(output).toContain('**Score: 96/100**');
    // Score of 96 => filled = 10 (Math.round(96/10)=10), empty = 0
    expect(output).toContain('[==========]');
  });

  it('should include summary section', () => {
    const output = formatter.format(mockReport);

    expect(output).toContain('## Summary');
    expect(output).toContain('| Total Issues | 1 |');
    expect(output).toContain('| Errors | 0 |');
    expect(output).toContain('| Warnings | 1 |');
    expect(output).toContain('| Info | 0 |');
    expect(output).toContain('| Duration | 100ms |');
  });

  it('should group issues by category', () => {
    const output = formatter.format(mockReport);

    expect(output).toContain('## Issues by Category');
    expect(output).toContain('### Security');
    expect(output).toContain('MD5 usage detected');
  });

  it('should show priority remediation for error-severity issues', () => {
    const errorIssue: EnrichedIssue = {
      id: 'insecure-http',
      title: 'Insecure HTTP detected',
      description: 'HTTP connections are insecure',
      severity: 'error',
      category: 'security',
      guidelineUrl: 'https://developer.apple.com/app-store/review/guidelines/#software-requirements',
      guideline: 'Guideline 2.5.4',
      severityScore: 8,
    };

    const reportWithErrors: EnrichedAnalysisReport = {
      ...mockReport,
      summary: {
        totalIssues: 1,
        errors: 1,
        warnings: 0,
        info: 0,
        passed: false,
        duration: 100,
      },
      enrichedIssues: [errorIssue],
    };

    const output = formatter.format(reportWithErrors);

    expect(output).toContain('## Priority Remediation');
    expect(output).toContain('**Insecure HTTP detected**');
  });

  it('should include historical comparison table when comparison data exists', () => {
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

    expect(output).toContain('## Historical Comparison');
    expect(output).toContain('| Previous Score | 80/100 |');
    expect(output).toContain('| Current Score | 96/100 |');
    expect(output).toContain('| Delta | +16 |');
    expect(output).toContain('| Trend | Improving |');
    expect(output).toContain('| Resolved Issues | 1 |');
    expect(output).toContain('| Ongoing Issues | 1 |');
  });

  it('should handle report with no issues', () => {
    const cleanReport: EnrichedAnalysisReport = {
      projectPath: '/test/clean-project',
      timestamp: '2024-01-01T00:00:00.000Z',
      results: [
        {
          analyzer: 'security',
          passed: true,
          issues: [],
          duration: 50,
        },
      ],
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
    expect(output).not.toContain('## Priority Remediation');
  });
});
