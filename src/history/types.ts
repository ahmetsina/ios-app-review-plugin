import type { AnalysisReport } from '../types/index.js';

export interface ScanRecord {
  id: string;
  timestamp: string;
  projectPath: string;
  gitCommit?: string | undefined;
  gitBranch?: string | undefined;
  report: AnalysisReport;
  score: number;
}

export interface HistoricalComparison {
  previousScan: ScanRecord;
  currentScan: ScanRecord;
  newIssues: string[];      // fingerprints
  resolvedIssues: string[]; // fingerprints
  ongoingIssues: string[];  // fingerprints
  scoreDelta: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface TrendReport {
  scans: Array<{ id: string; timestamp: string; score: number }>;
  overallTrend: 'improving' | 'declining' | 'stable';
  averageScore: number;
  bestScore: number;
  worstScore: number;
}

export interface ScanIndex {
  scans: Array<{
    id: string;
    timestamp: string;
    projectPath: string;
    score: number;
    gitCommit?: string | undefined;
    gitBranch?: string | undefined;
  }>;
}
