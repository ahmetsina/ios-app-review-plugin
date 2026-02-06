import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import * as crypto from 'crypto';
import type { AnalysisReport } from '../types/index.js';
import type { ScanRecord, ScanIndex } from './types.js';

export class HistoryStore {
  private baseDir: string;

  constructor(projectPath: string) {
    this.baseDir = path.join(projectPath, '.ios-review-history');
  }

  private get scansDir(): string {
    return path.join(this.baseDir, 'scans');
  }

  private get indexPath(): string {
    return path.join(this.baseDir, 'index.json');
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(this.scansDir, { recursive: true });
  }

  private async loadIndex(): Promise<ScanIndex> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(data) as ScanIndex;
    } catch {
      return { scans: [] };
    }
  }

  private async saveIndex(index: ScanIndex): Promise<void> {
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2));
  }

  private getGitInfo(projectPath: string): { commit?: string; branch?: string } {
    try {
      const commit = execSync('git rev-parse HEAD', { cwd: projectPath, encoding: 'utf-8' }).trim();
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath, encoding: 'utf-8' }).trim();
      return { commit, branch };
    } catch {
      return {};
    }
  }

  async saveScan(report: AnalysisReport, score: number): Promise<ScanRecord> {
    await this.ensureDirs();

    const id = crypto.randomUUID();
    const gitInfo = this.getGitInfo(report.projectPath);

    const record: ScanRecord = {
      id,
      timestamp: report.timestamp,
      projectPath: report.projectPath,
      gitCommit: gitInfo.commit,
      gitBranch: gitInfo.branch,
      report,
      score,
    };

    // Save scan file
    const scanPath = path.join(this.scansDir, `${id}.json`);
    await fs.writeFile(scanPath, JSON.stringify(record, null, 2));

    // Update index
    const index = await this.loadIndex();
    index.scans.push({
      id,
      timestamp: record.timestamp,
      projectPath: record.projectPath,
      score,
      gitCommit: gitInfo.commit,
      gitBranch: gitInfo.branch,
    });
    await this.saveIndex(index);

    return record;
  }

  async getLatestScan(): Promise<ScanRecord | null> {
    const index = await this.loadIndex();
    if (index.scans.length === 0) return null;

    const latest = index.scans[index.scans.length - 1];
    if (!latest) return null;

    try {
      const data = await fs.readFile(path.join(this.scansDir, `${latest.id}.json`), 'utf-8');
      return JSON.parse(data) as ScanRecord;
    } catch {
      return null;
    }
  }

  async getScan(id: string): Promise<ScanRecord | null> {
    try {
      const data = await fs.readFile(path.join(this.scansDir, `${id}.json`), 'utf-8');
      return JSON.parse(data) as ScanRecord;
    } catch {
      return null;
    }
  }

  async listScans(limit?: number): Promise<ScanIndex['scans']> {
    const index = await this.loadIndex();
    const scans = index.scans.slice().reverse(); // newest first
    return limit ? scans.slice(0, limit) : scans;
  }

  async pruneHistory(keepCount: number): Promise<number> {
    const index = await this.loadIndex();
    if (index.scans.length <= keepCount) return 0;

    const toRemove = index.scans.slice(0, index.scans.length - keepCount);
    const kept = index.scans.slice(index.scans.length - keepCount);

    for (const scan of toRemove) {
      try {
        await fs.unlink(path.join(this.scansDir, `${scan.id}.json`));
      } catch {
        // Ignore missing files
      }
    }

    index.scans = kept;
    await this.saveIndex(index);

    return toRemove.length;
  }
}
