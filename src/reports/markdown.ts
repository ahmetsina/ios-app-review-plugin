import type { ReportFormatter, EnrichedAnalysisReport, HistoricalComparison } from './types.js';
import type { EnrichedIssue } from '../guidelines/types.js';
import type { IssueCategory } from '../types/index.js';

const SEVERITY_ICON: Record<string, string> = {
  error: '[ERROR]',
  warning: '[WARN]',
  info: '[INFO]',
};

const CATEGORY_LABELS: Record<IssueCategory | 'custom', string> = {
  'info-plist': 'Info.plist',
  privacy: 'Privacy',
  entitlements: 'Entitlements',
  code: 'Code Quality',
  security: 'Security',
  metadata: 'App Store Metadata',
  screenshots: 'Screenshots',
  version: 'Version',
  iap: 'In-App Purchases',
  asc: 'App Store Connect',
  'deprecated-api': 'Deprecated APIs',
  'private-api': 'Private APIs',
  'ui-ux': 'UI/UX Compliance',
  custom: 'Custom Rules',
};

export class MarkdownFormatter implements ReportFormatter {
  format(report: EnrichedAnalysisReport): string {
    const sections: string[] = [];

    sections.push(this.buildHeader(report));
    sections.push(this.buildScoreSection(report.score));
    sections.push(this.buildSummary(report));

    if (report.comparison) {
      sections.push(this.buildComparison(report.comparison));
    }

    const errorIssues = report.enrichedIssues.filter((i) => i.severity === 'error');
    if (errorIssues.length > 0) {
      sections.push(this.buildPriorityRemediation(errorIssues));
    }

    sections.push(this.buildIssuesByCategory(report.enrichedIssues));

    return sections.filter((s) => s.length > 0).join('\n\n');
  }

  private buildHeader(report: EnrichedAnalysisReport): string {
    const status = report.summary.passed ? 'PASSED' : 'ISSUES FOUND';
    const date = new Date(report.timestamp).toLocaleString();
    const lines: string[] = [
      '# App Store Review Readiness Report',
      '',
      `**Project:** \`${report.projectPath}\``,
      `**Date:** ${date}`,
      `**Status:** ${status}`,
    ];
    return lines.join('\n');
  }

  private buildScoreSection(score: number): string {
    const filled = Math.round(score / 10);
    const empty = 10 - filled;
    const bar = '[' + '='.repeat(filled) + '-'.repeat(empty) + ']';

    const lines: string[] = [
      '## Review Readiness Score',
      '',
      `**Score: ${score}/100** ${bar}`,
    ];
    return lines.join('\n');
  }

  private buildSummary(report: EnrichedAnalysisReport): string {
    const { totalIssues, errors, warnings, info, duration } = report.summary;
    const lines: string[] = [
      '## Summary',
      '',
      `| Metric | Count |`,
      `| ------ | ----- |`,
      `| Total Issues | ${totalIssues} |`,
      `| Errors | ${errors} |`,
      `| Warnings | ${warnings} |`,
      `| Info | ${info} |`,
      `| Duration | ${duration}ms |`,
    ];
    return lines.join('\n');
  }

  private buildComparison(comparison: HistoricalComparison): string {
    const deltaSign = comparison.scoreDelta > 0 ? '+' : '';
    const trendLabel =
      comparison.trend === 'improving'
        ? 'Improving'
        : comparison.trend === 'declining'
          ? 'Declining'
          : 'Stable';

    const lines: string[] = [
      '## Historical Comparison',
      '',
      `| Metric | Value |`,
      `| ------ | ----- |`,
      `| Previous Score | ${comparison.previousScore}/100 |`,
      `| Current Score | ${comparison.currentScore}/100 |`,
      `| Delta | ${deltaSign}${comparison.scoreDelta} |`,
      `| Trend | ${trendLabel} |`,
      `| New Issues | ${comparison.newIssues.length} |`,
      `| Resolved Issues | ${comparison.resolvedIssues.length} |`,
      `| Ongoing Issues | ${comparison.ongoingIssues.length} |`,
    ];
    return lines.join('\n');
  }

  private buildPriorityRemediation(errorIssues: EnrichedIssue[]): string {
    const sorted = [...errorIssues].sort(
      (a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0),
    );

    const lines: string[] = ['## Priority Remediation', ''];

    for (const issue of sorted) {
      lines.push(`1. **${issue.title}** — ${issue.description}`);
      if (issue.guidelineUrl) {
        lines.push(`   - Guideline: [${issue.guideline ?? issue.guidelineUrl}](${issue.guidelineUrl})`);
      }
    }

    return lines.join('\n');
  }

  private buildIssuesByCategory(issues: EnrichedIssue[]): string {
    if (issues.length === 0) {
      return '## Issues\n\nNo issues found.';
    }

    const grouped = new Map<string, EnrichedIssue[]>();
    for (const issue of issues) {
      const key = issue.category;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(issue);
      } else {
        grouped.set(key, [issue]);
      }
    }

    const lines: string[] = ['## Issues by Category'];

    for (const [category, categoryIssues] of grouped) {
      const label =
        CATEGORY_LABELS[category as IssueCategory | 'custom'] ?? category;
      lines.push('', `### ${label}`, '');

      for (const issue of categoryIssues) {
        const icon = SEVERITY_ICON[issue.severity] ?? '[INFO]';
        lines.push(`#### ${icon} ${issue.title}`);
        lines.push('');
        lines.push(issue.description);

        if (issue.filePath) {
          const location = issue.lineNumber
            ? `\`${issue.filePath}:${issue.lineNumber}\``
            : `\`${issue.filePath}\``;
          lines.push('', `**Location:** ${location}`);
        }

        if (issue.guidelineUrl) {
          lines.push(
            '',
            `**Guideline:** [${issue.guideline ?? issue.guidelineUrl}](${issue.guidelineUrl})`,
          );
        }

        if (issue.suggestion) {
          lines.push('', `**Suggestion:** ${issue.suggestion}`);
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
