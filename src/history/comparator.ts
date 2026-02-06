import type { Issue } from '../types/index.js';
import type { ScanRecord, HistoricalComparison, TrendReport } from './types.js';
import * as path from 'path';

export class ScanComparator {
  /**
   * Create a fingerprint for an issue that is stable across scans.
   * Uses id + category + relative file path (excluding line number which can shift).
   */
  fingerprint(issue: Issue, projectPath: string): string {
    const relativePath = issue.filePath
      ? path.relative(projectPath, issue.filePath)
      : '';
    return `${issue.id}::${issue.category}::${relativePath}`;
  }

  compare(previous: ScanRecord, current: ScanRecord): HistoricalComparison {
    const prevFingerprints = new Set<string>();
    const currFingerprints = new Set<string>();

    for (const result of previous.report.results) {
      for (const issue of result.issues) {
        prevFingerprints.add(this.fingerprint(issue, previous.projectPath));
      }
    }

    for (const result of current.report.results) {
      for (const issue of result.issues) {
        currFingerprints.add(this.fingerprint(issue, current.projectPath));
      }
    }

    const newIssues: string[] = [];
    const resolvedIssues: string[] = [];
    const ongoingIssues: string[] = [];

    for (const fp of currFingerprints) {
      if (prevFingerprints.has(fp)) {
        ongoingIssues.push(fp);
      } else {
        newIssues.push(fp);
      }
    }

    for (const fp of prevFingerprints) {
      if (!currFingerprints.has(fp)) {
        resolvedIssues.push(fp);
      }
    }

    const scoreDelta = current.score - previous.score;
    let trend: 'improving' | 'declining' | 'stable';
    if (scoreDelta > 2) {
      trend = 'improving';
    } else if (scoreDelta < -2) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return {
      previousScan: previous,
      currentScan: current,
      newIssues,
      resolvedIssues,
      ongoingIssues,
      scoreDelta,
      trend,
    };
  }

  analyzeTrend(scans: ScanRecord[]): TrendReport {
    const scanData = scans.map((s) => ({
      id: s.id,
      timestamp: s.timestamp,
      score: s.score,
    }));

    const scores = scanData.map((s) => s.score);

    // Determine trend from last 3 scores
    let overallTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (scores.length >= 3) {
      const recent = scores.slice(-3);
      const first = recent[0]!;
      const last = recent[recent.length - 1]!;
      const delta = last - first;
      if (delta > 5) {
        overallTrend = 'improving';
      } else if (delta < -5) {
        overallTrend = 'declining';
      }
    } else if (scores.length >= 2) {
      const first = scores[0]!;
      const last = scores[scores.length - 1]!;
      const delta = last - first;
      if (delta > 2) {
        overallTrend = 'improving';
      } else if (delta < -2) {
        overallTrend = 'declining';
      }
    }

    const sum = scores.reduce((a, b) => a + b, 0);

    return {
      scans: scanData,
      overallTrend,
      averageScore: scores.length > 0 ? Math.round(sum / scores.length) : 0,
      bestScore: scores.length > 0 ? Math.max(...scores) : 0,
      worstScore: scores.length > 0 ? Math.min(...scores) : 0,
    };
  }
}
