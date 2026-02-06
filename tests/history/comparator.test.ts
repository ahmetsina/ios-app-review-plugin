import { ScanComparator } from '../../src/history/comparator.js';
import type { ScanRecord } from '../../src/history/types.js';
import type { AnalysisReport, Issue } from '../../src/types/index.js';

describe('ScanComparator', () => {
  let comparator: ScanComparator;

  beforeEach(() => {
    jest.clearAllMocks();
    comparator = new ScanComparator();
  });

  const createIssue = (overrides: Partial<Issue> = {}): Issue => ({
    id: 'test-issue',
    title: 'Test Issue',
    description: 'A test issue',
    severity: 'warning',
    category: 'code',
    ...overrides,
  });

  const createScanRecord = (overrides: Partial<ScanRecord> = {}): ScanRecord => ({
    id: 'scan-1',
    timestamp: new Date().toISOString(),
    projectPath: '/project',
    score: 80,
    report: {
      projectPath: '/project',
      timestamp: new Date().toISOString(),
      results: [],
      summary: { totalIssues: 0, errors: 0, warnings: 0, info: 0, passed: true, duration: 50 },
    },
    ...overrides,
  });

  describe('fingerprint()', () => {
    it('should create stable fingerprint from issue', () => {
      const issue = createIssue({
        id: 'plist-missing-key',
        category: 'info-plist',
        filePath: '/project/src/Info.plist',
      });

      const fp1 = comparator.fingerprint(issue, '/project');
      const fp2 = comparator.fingerprint(issue, '/project');
      expect(fp1).toBe(fp2);
      expect(fp1).toBe('plist-missing-key::info-plist::src/Info.plist');
    });

    it('should use relative path', () => {
      const issue = createIssue({
        id: 'code-issue',
        category: 'code',
        filePath: '/project/Sources/App/ViewController.swift',
      });

      const fp = comparator.fingerprint(issue, '/project');
      expect(fp).toBe('code-issue::code::Sources/App/ViewController.swift');
      expect(fp).not.toContain('/project/');
    });

    it('should handle missing filePath', () => {
      const issue = createIssue({
        id: 'general-issue',
        category: 'privacy',
        filePath: undefined,
      });

      const fp = comparator.fingerprint(issue, '/project');
      expect(fp).toBe('general-issue::privacy::');
    });
  });

  describe('compare()', () => {
    it('should detect new issues', () => {
      const previous = createScanRecord({
        id: 'prev',
        score: 90,
        report: {
          projectPath: '/project',
          timestamp: new Date().toISOString(),
          results: [],
          summary: { totalIssues: 0, errors: 0, warnings: 0, info: 0, passed: true, duration: 50 },
        },
      });

      const current = createScanRecord({
        id: 'curr',
        score: 70,
        report: {
          projectPath: '/project',
          timestamp: new Date().toISOString(),
          results: [
            {
              analyzer: 'Code Scanner',
              passed: false,
              issues: [
                createIssue({ id: 'new-issue', category: 'code', filePath: '/project/src/file.swift' }),
              ],
              duration: 30,
            },
          ],
          summary: { totalIssues: 1, errors: 0, warnings: 1, info: 0, passed: true, duration: 50 },
        },
      });

      const result = comparator.compare(previous, current);
      expect(result.newIssues).toHaveLength(1);
      expect(result.resolvedIssues).toHaveLength(0);
      expect(result.ongoingIssues).toHaveLength(0);
    });

    it('should detect resolved issues', () => {
      const previous = createScanRecord({
        id: 'prev',
        score: 70,
        report: {
          projectPath: '/project',
          timestamp: new Date().toISOString(),
          results: [
            {
              analyzer: 'Code Scanner',
              passed: false,
              issues: [
                createIssue({ id: 'old-issue', category: 'code', filePath: '/project/src/file.swift' }),
              ],
              duration: 30,
            },
          ],
          summary: { totalIssues: 1, errors: 0, warnings: 1, info: 0, passed: true, duration: 50 },
        },
      });

      const current = createScanRecord({
        id: 'curr',
        score: 95,
        report: {
          projectPath: '/project',
          timestamp: new Date().toISOString(),
          results: [],
          summary: { totalIssues: 0, errors: 0, warnings: 0, info: 0, passed: true, duration: 50 },
        },
      });

      const result = comparator.compare(previous, current);
      expect(result.newIssues).toHaveLength(0);
      expect(result.resolvedIssues).toHaveLength(1);
      expect(result.ongoingIssues).toHaveLength(0);
    });

    it('should detect ongoing issues', () => {
      const sharedIssue = createIssue({
        id: 'ongoing-issue',
        category: 'security',
        filePath: '/project/src/Crypto.swift',
      });

      const previous = createScanRecord({
        id: 'prev',
        score: 75,
        report: {
          projectPath: '/project',
          timestamp: new Date().toISOString(),
          results: [
            { analyzer: 'Security', passed: false, issues: [sharedIssue], duration: 30 },
          ],
          summary: { totalIssues: 1, errors: 0, warnings: 1, info: 0, passed: true, duration: 50 },
        },
      });

      const current = createScanRecord({
        id: 'curr',
        score: 75,
        report: {
          projectPath: '/project',
          timestamp: new Date().toISOString(),
          results: [
            { analyzer: 'Security', passed: false, issues: [sharedIssue], duration: 25 },
          ],
          summary: { totalIssues: 1, errors: 0, warnings: 1, info: 0, passed: true, duration: 50 },
        },
      });

      const result = comparator.compare(previous, current);
      expect(result.ongoingIssues).toHaveLength(1);
      expect(result.newIssues).toHaveLength(0);
      expect(result.resolvedIssues).toHaveLength(0);
    });

    it('should calculate score delta', () => {
      const previous = createScanRecord({ id: 'prev', score: 60 });
      const current = createScanRecord({ id: 'curr', score: 85 });

      const result = comparator.compare(previous, current);
      expect(result.scoreDelta).toBe(25);
    });

    it('should set trend to improving when score increases significantly', () => {
      const previous = createScanRecord({ id: 'prev', score: 60 });
      const current = createScanRecord({ id: 'curr', score: 80 });

      const result = comparator.compare(previous, current);
      expect(result.trend).toBe('improving');
    });

    it('should set trend to declining when score decreases significantly', () => {
      const previous = createScanRecord({ id: 'prev', score: 90 });
      const current = createScanRecord({ id: 'curr', score: 60 });

      const result = comparator.compare(previous, current);
      expect(result.trend).toBe('declining');
    });

    it('should set trend to stable for small changes', () => {
      const previous = createScanRecord({ id: 'prev', score: 80 });
      const current = createScanRecord({ id: 'curr', score: 81 });

      const result = comparator.compare(previous, current);
      expect(result.trend).toBe('stable');
    });
  });

  describe('analyzeTrend()', () => {
    it('should compute trend from multiple scans', () => {
      const scans: ScanRecord[] = [
        createScanRecord({ id: 'scan-1', timestamp: '2024-01-01T00:00:00Z', score: 50 }),
        createScanRecord({ id: 'scan-2', timestamp: '2024-01-02T00:00:00Z', score: 60 }),
        createScanRecord({ id: 'scan-3', timestamp: '2024-01-03T00:00:00Z', score: 70 }),
        createScanRecord({ id: 'scan-4', timestamp: '2024-01-04T00:00:00Z', score: 80 }),
      ];

      const trend = comparator.analyzeTrend(scans);

      expect(trend.scans).toHaveLength(4);
      expect(trend.overallTrend).toBe('improving');
      expect(trend.averageScore).toBe(65); // Math.round((50+60+70+80)/4) = 65
      expect(trend.bestScore).toBe(80);
      expect(trend.worstScore).toBe(50);
    });

    it('should detect declining trend', () => {
      const scans: ScanRecord[] = [
        createScanRecord({ id: 'scan-1', timestamp: '2024-01-01T00:00:00Z', score: 90 }),
        createScanRecord({ id: 'scan-2', timestamp: '2024-01-02T00:00:00Z', score: 80 }),
        createScanRecord({ id: 'scan-3', timestamp: '2024-01-03T00:00:00Z', score: 70 }),
      ];

      const trend = comparator.analyzeTrend(scans);
      expect(trend.overallTrend).toBe('declining');
    });

    it('should detect stable trend', () => {
      const scans: ScanRecord[] = [
        createScanRecord({ id: 'scan-1', timestamp: '2024-01-01T00:00:00Z', score: 80 }),
        createScanRecord({ id: 'scan-2', timestamp: '2024-01-02T00:00:00Z', score: 81 }),
        createScanRecord({ id: 'scan-3', timestamp: '2024-01-03T00:00:00Z', score: 82 }),
      ];

      const trend = comparator.analyzeTrend(scans);
      expect(trend.overallTrend).toBe('stable');
    });

    it('should handle empty scans array', () => {
      const trend = comparator.analyzeTrend([]);
      expect(trend.scans).toHaveLength(0);
      expect(trend.overallTrend).toBe('stable');
      expect(trend.averageScore).toBe(0);
      expect(trend.bestScore).toBe(0);
      expect(trend.worstScore).toBe(0);
    });
  });
});
