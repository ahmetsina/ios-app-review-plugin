import type { ReportFormatter, EnrichedAnalysisReport } from './types.js';

interface JsonReportOutput {
  schemaVersion: string;
  exitCode: 0 | 1;
  score: number;
  timestamp: string;
  projectPath: string;
  summary: {
    totalIssues: number;
    errors: number;
    warnings: number;
    info: number;
    passed: boolean;
    duration: number;
  };
  issues: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    category: string;
    filePath?: string | undefined;
    lineNumber?: number | undefined;
    guideline?: string | undefined;
    suggestion?: string | undefined;
    guidelineUrl?: string | undefined;
    guidelineExcerpt?: string | undefined;
    severityScore?: number | undefined;
  }>;
  comparison?: {
    previousScanId: string;
    previousTimestamp: string;
    previousScore: number;
    currentScore: number;
    scoreDelta: number;
    trend: string;
    newIssuesCount: number;
    resolvedIssuesCount: number;
    ongoingIssuesCount: number;
  } | undefined;
}

export class JsonFormatter implements ReportFormatter {
  format(report: EnrichedAnalysisReport): string {
    const output: JsonReportOutput = {
      schemaVersion: '1.0',
      exitCode: report.summary.errors > 0 ? 1 : 0,
      score: report.score,
      timestamp: report.timestamp,
      projectPath: report.projectPath,
      summary: {
        totalIssues: report.summary.totalIssues,
        errors: report.summary.errors,
        warnings: report.summary.warnings,
        info: report.summary.info,
        passed: report.summary.passed,
        duration: report.summary.duration,
      },
      issues: report.enrichedIssues.map((issue) => ({
        id: issue.id,
        title: issue.title,
        description: issue.description,
        severity: issue.severity,
        category: issue.category,
        filePath: issue.filePath,
        lineNumber: issue.lineNumber,
        guideline: issue.guideline,
        suggestion: issue.suggestion,
        guidelineUrl: issue.guidelineUrl,
        guidelineExcerpt: issue.guidelineExcerpt,
        severityScore: issue.severityScore,
      })),
    };

    if (report.comparison) {
      output.comparison = {
        previousScanId: report.comparison.previousScanId,
        previousTimestamp: report.comparison.previousTimestamp,
        previousScore: report.comparison.previousScore,
        currentScore: report.comparison.currentScore,
        scoreDelta: report.comparison.scoreDelta,
        trend: report.comparison.trend,
        newIssuesCount: report.comparison.newIssues.length,
        resolvedIssuesCount: report.comparison.resolvedIssues.length,
        ongoingIssuesCount: report.comparison.ongoingIssues.length,
      };
    }

    return JSON.stringify(output, null, 2);
  }
}
