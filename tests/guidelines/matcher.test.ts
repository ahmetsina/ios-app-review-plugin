import { GuidelineMatcher } from '../../src/guidelines/matcher.js';
import type { AnalysisReport, Issue } from '../../src/types/index.js';

describe('GuidelineMatcher', () => {
  let matcher: GuidelineMatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    matcher = new GuidelineMatcher();
  });

  const mockReport: AnalysisReport = {
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
  };

  describe('matchIssue', () => {
    it('should match by ISSUE_GUIDELINE_MAP (e.g., security-md5 -> guideline 2.5.4)', () => {
      const issue: Issue = {
        id: 'security-md5',
        title: 'MD5 usage detected',
        description: 'MD5 is insecure',
        severity: 'warning',
        category: 'security',
      };

      const matches = matcher.matchIssue(issue);

      expect(matches).toHaveLength(1);
      expect(matches[0].section).toBe('2.5.4');
      expect(matches[0].title).toBe('Security');
    });

    it('should parse section from guideline string as fallback', () => {
      const issue: Issue = {
        id: 'some-unmapped-issue',
        title: 'Some issue',
        description: 'Description',
        severity: 'warning',
        category: 'security',
        guideline: 'Guideline 3.1.1 - In-App Purchase',
      };

      const matches = matcher.matchIssue(issue);

      expect(matches).toHaveLength(1);
      expect(matches[0].section).toBe('3.1.1');
      expect(matches[0].title).toBe('In-App Purchase');
    });

    it('should return empty array for unmapped issues', () => {
      const issue: Issue = {
        id: 'totally-unknown-issue',
        title: 'Unknown issue',
        description: 'Description',
        severity: 'info',
        category: 'code',
      };

      const matches = matcher.matchIssue(issue);

      expect(matches).toHaveLength(0);
    });
  });

  describe('calculateScore', () => {
    it('should return 100 for report with no issues', () => {
      const emptyReport: AnalysisReport = {
        projectPath: '/test/project',
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
      };

      const score = matcher.calculateScore(emptyReport);

      expect(score).toBe(100);
    });

    it('should deduct based on severity weights', () => {
      const score = matcher.calculateScore(mockReport);

      // security-md5 maps to guideline 2.5.4 with severityWeight 8
      // severity 'warning' has multiplier 0.5
      // deduction = 8 * 0.5 = 4
      // score = 100 - 4 = 96
      expect(score).toBe(96);
    });

    it('should deduct more for error severity', () => {
      const errorReport: AnalysisReport = {
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
                severity: 'error',
                category: 'security',
              },
            ],
            duration: 100,
          },
        ],
        summary: {
          totalIssues: 1,
          errors: 1,
          warnings: 0,
          info: 0,
          passed: false,
          duration: 100,
        },
      };

      const score = matcher.calculateScore(errorReport);

      // security-md5 maps to guideline 2.5.4 with severityWeight 8
      // severity 'error' has multiplier 1.0
      // deduction = 8 * 1.0 = 8
      // score = 100 - 8 = 92
      expect(score).toBe(92);
    });
  });

  describe('enrichReport', () => {
    it('should add guidelineUrl and guidelineExcerpt to enriched issues', () => {
      const enriched = matcher.enrichReport(mockReport);

      expect(enriched.enrichedIssues).toHaveLength(1);
      const issue = enriched.enrichedIssues[0];
      expect(issue.guidelineUrl).toBe(
        'https://developer.apple.com/app-store/review/guidelines/#software-requirements',
      );
      expect(issue.guidelineExcerpt).toContain('appropriate security measures');
    });

    it('should include score in enriched report', () => {
      const enriched = matcher.enrichReport(mockReport);

      expect(enriched.score).toBeDefined();
      expect(typeof enriched.score).toBe('number');
      expect(enriched.score).toBeLessThanOrEqual(100);
      expect(enriched.score).toBeGreaterThanOrEqual(0);
    });

    it('should include severityScore on enriched issues', () => {
      const enriched = matcher.enrichReport(mockReport);

      const issue = enriched.enrichedIssues[0];
      // severityWeight 8 * SEVERITY_MULTIPLIER warning 0.5 = 4
      expect(issue.severityScore).toBe(4);
    });

    it('should preserve original issue properties', () => {
      const enriched = matcher.enrichReport(mockReport);

      const issue = enriched.enrichedIssues[0];
      expect(issue.id).toBe('security-md5');
      expect(issue.title).toBe('MD5 usage detected');
      expect(issue.description).toBe('MD5 is insecure');
      expect(issue.severity).toBe('warning');
      expect(issue.category).toBe('security');
    });
  });
});
