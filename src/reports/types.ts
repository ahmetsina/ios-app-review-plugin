import type { AnalysisReport, Issue } from '../types/index.js';
import type { EnrichedIssue } from '../guidelines/types.js';

export type ReportFormat = 'markdown' | 'html' | 'json';

export interface HistoricalComparison {
  previousScanId: string;
  previousTimestamp: string;
  previousScore: number;
  currentScore: number;
  scoreDelta: number;
  newIssues: Issue[];
  resolvedIssues: Issue[];
  ongoingIssues: Issue[];
  trend: 'improving' | 'declining' | 'stable';
}

export interface EnrichedAnalysisReport extends AnalysisReport {
  score: number;
  enrichedIssues: EnrichedIssue[];
  comparison?: HistoricalComparison | undefined;
}

export interface ReportFormatter {
  format(report: EnrichedAnalysisReport): string;
}
