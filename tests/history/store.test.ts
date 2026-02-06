import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { HistoryStore } from '../../src/history/store.js';
import type { AnalysisReport } from '../../src/types/index.js';

jest.mock('child_process', () => ({
  execSync: jest.fn().mockReturnValue('abc123\n'),
}));

describe('HistoryStore', () => {
  let tempDir: string;
  let store: HistoryStore;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'history-store-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    store = new HistoryStore(tempDir);
  });

  const createMockReport = (): AnalysisReport => ({
    projectPath: tempDir,
    timestamp: new Date().toISOString(),
    results: [],
    summary: { totalIssues: 0, errors: 0, warnings: 0, info: 0, passed: true, duration: 50 },
  });

  describe('saveScan()', () => {
    it('should save and return a scan record with an ID', async () => {
      const mockReport = createMockReport();
      const record = await store.saveScan(mockReport, 95);

      expect(record).toBeDefined();
      expect(record.id).toBeDefined();
      expect(typeof record.id).toBe('string');
      expect(record.id.length).toBeGreaterThan(0);
      expect(record.projectPath).toBe(tempDir);
      expect(record.score).toBe(95);
      expect(record.report).toEqual(mockReport);
      expect(record.gitCommit).toBe('abc123');
      expect(record.gitBranch).toBe('abc123');
    });
  });

  describe('getLatestScan()', () => {
    it('should return the most recently saved scan', async () => {
      // Use a fresh subdirectory so we start with clean state
      const subDir = path.join(tempDir, 'latest-test');
      await fs.mkdir(subDir, { recursive: true });
      const freshStore = new HistoryStore(subDir);

      const report1 = createMockReport();
      report1.projectPath = subDir;
      await freshStore.saveScan(report1, 80);

      const report2 = createMockReport();
      report2.projectPath = subDir;
      const secondRecord = await freshStore.saveScan(report2, 90);

      const latest = await freshStore.getLatestScan();
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe(secondRecord.id);
      expect(latest!.score).toBe(90);
    });

    it('should return null when no scans exist', async () => {
      const emptyDir = path.join(tempDir, 'empty-latest');
      await fs.mkdir(emptyDir, { recursive: true });
      const emptyStore = new HistoryStore(emptyDir);

      const latest = await emptyStore.getLatestScan();
      expect(latest).toBeNull();
    });
  });

  describe('getScan()', () => {
    it('should return a specific scan by ID', async () => {
      const subDir = path.join(tempDir, 'get-scan-test');
      await fs.mkdir(subDir, { recursive: true });
      const freshStore = new HistoryStore(subDir);

      const report = createMockReport();
      report.projectPath = subDir;
      const saved = await freshStore.saveScan(report, 85);

      const retrieved = await freshStore.getScan(saved.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(saved.id);
      expect(retrieved!.score).toBe(85);
      expect(retrieved!.report).toEqual(report);
    });

    it('should return null for unknown ID', async () => {
      const subDir = path.join(tempDir, 'get-scan-unknown');
      await fs.mkdir(subDir, { recursive: true });
      const freshStore = new HistoryStore(subDir);

      const result = await freshStore.getScan('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('listScans()', () => {
    it('should return scans in reverse chronological order (newest first)', async () => {
      const subDir = path.join(tempDir, 'list-scans-order');
      await fs.mkdir(subDir, { recursive: true });
      const freshStore = new HistoryStore(subDir);

      const report1 = createMockReport();
      report1.projectPath = subDir;
      const first = await freshStore.saveScan(report1, 70);

      const report2 = createMockReport();
      report2.projectPath = subDir;
      const second = await freshStore.saveScan(report2, 80);

      const report3 = createMockReport();
      report3.projectPath = subDir;
      const third = await freshStore.saveScan(report3, 90);

      const scans = await freshStore.listScans();
      expect(scans).toHaveLength(3);
      expect(scans[0]!.id).toBe(third.id);
      expect(scans[1]!.id).toBe(second.id);
      expect(scans[2]!.id).toBe(first.id);
    });

    it('should respect the limit parameter', async () => {
      const subDir = path.join(tempDir, 'list-scans-limit');
      await fs.mkdir(subDir, { recursive: true });
      const freshStore = new HistoryStore(subDir);

      for (let i = 0; i < 5; i++) {
        const report = createMockReport();
        report.projectPath = subDir;
        await freshStore.saveScan(report, 50 + i * 10);
      }

      const scans = await freshStore.listScans(2);
      expect(scans).toHaveLength(2);
      // Newest first, so the last saved (score 90) should be first
      expect(scans[0]!.score).toBe(90);
      expect(scans[1]!.score).toBe(80);
    });
  });

  describe('pruneHistory()', () => {
    it('should remove oldest scans and keep specified count', async () => {
      const subDir = path.join(tempDir, 'prune-test');
      await fs.mkdir(subDir, { recursive: true });
      const freshStore = new HistoryStore(subDir);

      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const report = createMockReport();
        report.projectPath = subDir;
        const record = await freshStore.saveScan(report, 50 + i * 10);
        ids.push(record.id);
      }

      const removed = await freshStore.pruneHistory(2);
      expect(removed).toBe(3);

      const scans = await freshStore.listScans();
      expect(scans).toHaveLength(2);
      // The two newest should remain (ids[3] and ids[4])
      expect(scans[0]!.id).toBe(ids[4]);
      expect(scans[1]!.id).toBe(ids[3]);

      // Oldest should be gone
      const oldScan = await freshStore.getScan(ids[0]!);
      expect(oldScan).toBeNull();
    });

    it('should not remove anything if under limit', async () => {
      const subDir = path.join(tempDir, 'prune-under-limit');
      await fs.mkdir(subDir, { recursive: true });
      const freshStore = new HistoryStore(subDir);

      for (let i = 0; i < 3; i++) {
        const report = createMockReport();
        report.projectPath = subDir;
        await freshStore.saveScan(report, 60 + i * 10);
      }

      const removed = await freshStore.pruneHistory(5);
      expect(removed).toBe(0);

      const scans = await freshStore.listScans();
      expect(scans).toHaveLength(3);
    });
  });
});
