import { HtmlFormatter } from '../../src/reports/html.js';
import type { EnrichedAnalysisReport, HistoricalComparison } from '../../src/reports/types.js';
import type { EnrichedIssue } from '../../src/guidelines/types.js';

describe('HtmlFormatter', () => {
  let formatter: HtmlFormatter;

  beforeEach(() => {
    jest.clearAllMocks();
    formatter = new HtmlFormatter();
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

  it('should produce valid HTML structure', () => {
    const output = formatter.format(mockReport);

    expect(output).toContain('<html');
    expect(output).toContain('<head>');
    expect(output).toContain('<body>');
    expect(output).toContain('</html>');
    expect(output).toContain('<!DOCTYPE html>');
  });

  it('should include score gauge', () => {
    const output = formatter.format(mockReport);

    expect(output).toContain('score-gauge');
    expect(output).toContain('96');
  });

  it('should include severity badges', () => {
    const output = formatter.format(mockReport);

    expect(output).toContain('class="badge"');
    expect(output).toContain('WARNING');
  });

  it('should include collapsible sections', () => {
    const output = formatter.format(mockReport);

    expect(output).toContain('<details');
    expect(output).toContain('<summary>');
    expect(output).toContain('</details>');
  });

  it('should support dark mode via prefers-color-scheme', () => {
    const output = formatter.format(mockReport);

    expect(output).toContain('prefers-color-scheme: dark');
  });

  it('should include trend SVG when comparison data exists', () => {
    const comparison: HistoricalComparison = {
      previousScanId: 'scan-001',
      previousTimestamp: '2023-12-01T00:00:00.000Z',
      previousScore: 80,
      currentScore: 96,
      scoreDelta: 16,
      newIssues: [],
      resolvedIssues: [],
      ongoingIssues: [],
      trend: 'improving',
    };

    const reportWithComparison: EnrichedAnalysisReport = {
      ...mockReport,
      comparison,
    };

    const output = formatter.format(reportWithComparison);

    expect(output).toContain('<svg');
    expect(output).toContain('Historical Comparison');
    expect(output).toContain('Improving');
  });

  it('should escape HTML special characters', () => {
    const issueWithSpecialChars: EnrichedIssue = {
      id: 'test-special',
      title: 'Issue with <script> & "quotes"',
      description: 'Description with <b>bold</b> & special chars',
      severity: 'warning',
      category: 'security',
      severityScore: 4,
    };

    const reportWithSpecialChars: EnrichedAnalysisReport = {
      ...mockReport,
      projectPath: '/test/<project>&"name"',
      enrichedIssues: [issueWithSpecialChars],
    };

    const output = formatter.format(reportWithSpecialChars);

    // Verify that special characters are escaped
    expect(output).toContain('&lt;script&gt;');
    expect(output).toContain('&amp;');
    expect(output).toContain('&quot;quotes&quot;');
    expect(output).not.toContain('<script>');
    expect(output).toContain('&lt;project&gt;');
  });

  it('should include error issues in priority remediation', () => {
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

    expect(output).toContain('Priority Remediation');
    expect(output).toContain('Insecure HTTP detected');
  });
});
