import type { ReportFormatter, EnrichedAnalysisReport, HistoricalComparison } from './types.js';
import type { EnrichedIssue } from '../guidelines/types.js';
import type { IssueCategory } from '../types/index.js';

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

const LINE_WIDTH = 56;

export class PrettyFormatter implements ReportFormatter {
  private readonly noColor: boolean;

  constructor() {
    this.noColor = 'NO_COLOR' in process.env || process.env['TERM'] === 'dumb';
  }

  format(report: EnrichedAnalysisReport): string {
    const sections: string[] = [];

    sections.push(this.buildHeader(report));
    sections.push(this.buildScore(report.score));
    sections.push(this.buildSummary(report));

    if (report.comparison) {
      sections.push(this.buildComparison(report.comparison));
    }

    const priorityIssues = [...report.enrichedIssues]
      .filter((i) => i.severity === 'error')
      .sort((a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0));
    if (priorityIssues.length > 0) {
      sections.push(this.buildPriorityRemediation(priorityIssues));
    }

    sections.push(this.buildIssuesByCategory(report.enrichedIssues));

    sections.push(this.c('2') + '\u2500'.repeat(LINE_WIDTH) + this.c('0'));

    return sections.filter((s) => s.length > 0).join('\n\n') + '\n';
  }

  /** Emit an ANSI escape code, or empty string when color is off. */
  private c(code: string): string {
    return this.noColor ? '' : `\x1b[${code}m`;
  }

  // ── Section builders ──────────────────────────────────────

  private buildHeader(report: EnrichedAnalysisReport): string {
    const title = '  App Store Review Report';
    const inner = LINE_WIDTH - 2;
    const padded = title + ' '.repeat(Math.max(0, inner - title.length));

    const top = `\u256D${ '\u2500'.repeat(inner) }\u256E`;
    const mid = `\u2502${padded}\u2502`;
    const bot = `\u2570${ '\u2500'.repeat(inner) }\u256F`;

    const date = new Date(report.timestamp).toLocaleString();
    const passed = report.summary.passed;
    const statusLabel = passed
      ? `${this.c('32')}\u2714 PASSED${this.c('0')}`
      : `${this.c('31')}\u2718 ISSUES FOUND${this.c('0')}`;

    const lines: string[] = [
      `${this.c('1')}${top}${this.c('0')}`,
      `${this.c('1')}${mid}${this.c('0')}`,
      `${this.c('1')}${bot}${this.c('0')}`,
      `  Project:  ${this.c('4;36')}${report.projectPath}${this.c('0')}`,
      `  Date:     ${date}`,
      `  Status:   ${statusLabel}`,
    ];
    return lines.join('\n');
  }

  private buildScore(score: number): string {
    const header = this.sectionHeader('Score');
    const bar = this.scoreBar(score);

    let colorCode: string;
    if (score >= 80) colorCode = '1;32';
    else if (score >= 50) colorCode = '1;33';
    else colorCode = '1;31';

    return [header, `  ${this.c(colorCode)}${score}/100${this.c('0')}  ${bar}`].join('\n');
  }

  private buildSummary(report: EnrichedAnalysisReport): string {
    const header = this.sectionHeader('Summary');
    const { totalIssues, errors, warnings, info, duration } = report.summary;
    const line1 = `  Total Issues  ${totalIssues}     Errors  ${errors}     Warnings  ${warnings}     Info  ${info}`;
    const line2 = `  Duration      ${duration}ms`;
    return [header, line1, line2].join('\n');
  }

  private buildComparison(comparison: HistoricalComparison): string {
    const header = this.sectionHeader('Historical Comparison');
    const deltaSign = comparison.scoreDelta > 0 ? '+' : '';
    const trendLabel =
      comparison.trend === 'improving'
        ? `${this.c('32')}Improving${this.c('0')}`
        : comparison.trend === 'declining'
          ? `${this.c('31')}Declining${this.c('0')}`
          : `${this.c('33')}Stable${this.c('0')}`;

    const lines = [
      header,
      `  Previous  ${comparison.previousScore}/100  \u2192  Current  ${comparison.currentScore}/100  (${deltaSign}${comparison.scoreDelta})`,
      `  Trend     ${trendLabel}`,
      `  New ${comparison.newIssues.length}  |  Resolved ${comparison.resolvedIssues.length}  |  Ongoing ${comparison.ongoingIssues.length}`,
    ];
    return lines.join('\n');
  }

  private buildPriorityRemediation(issues: EnrichedIssue[]): string {
    const header = this.sectionHeader('Priority Remediation');
    const lines: string[] = [header];

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i]!;
      const num = `${i + 1}.`;
      const badge = this.severityBadge(issue.severity);
      lines.push(`  ${num}  ${badge}  ${issue.title}`);
      if (issue.filePath) {
        lines.push(`      ${this.formatLocation(issue.filePath, issue.lineNumber)}`);
      }
      if (issue.suggestion) {
        lines.push(`      ${this.c('2;32')}Suggestion: ${issue.suggestion}${this.c('0')}`);
      }
      if (issue.guidelineUrl) {
        lines.push(`      ${this.c('2;34;4')}${issue.guideline ?? issue.guidelineUrl}${this.c('0')}`);
      }
    }

    return lines.join('\n');
  }

  private buildIssuesByCategory(issues: EnrichedIssue[]): string {
    if (issues.length === 0) {
      const header = this.sectionHeader('Issues');
      return [header, `  ${this.c('2')}No issues found.${this.c('0')}`].join('\n');
    }

    const header = this.sectionHeader('Issues by Category');
    const lines: string[] = [header];

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

    for (const [category, categoryIssues] of grouped) {
      const label =
        CATEGORY_LABELS[category as IssueCategory | 'custom'] ?? category;
      lines.push('');
      lines.push(
        `  ${this.c('1')}${label}${this.c('0')} ${this.c('2')}(${categoryIssues.length} issue${categoryIssues.length === 1 ? '' : 's'})${this.c('0')}`,
      );

      for (const issue of categoryIssues) {
        const badge = this.severityBadge(issue.severity);
        lines.push(`   ${badge}  ${issue.title}`);
        if (issue.filePath) {
          lines.push(`          ${this.formatLocation(issue.filePath, issue.lineNumber)}`);
        }
        if (issue.suggestion) {
          lines.push(`          ${this.c('2;32')}Suggestion: ${issue.suggestion}${this.c('0')}`);
        }
        if (issue.guidelineUrl) {
          lines.push(`          ${this.c('2;34;4')}${issue.guideline ?? issue.guidelineUrl}${this.c('0')}`);
        }
      }
    }

    return lines.join('\n');
  }

  // ── Helpers ───────────────────────────────────────────────

  private severityBadge(severity: string): string {
    switch (severity) {
      case 'error':
        return `${this.c('41;97')} ERROR ${this.c('0')}`;
      case 'warning':
        return `${this.c('43;30')} WARN  ${this.c('0')}`;
      case 'info':
        return `${this.c('44;97')} INFO  ${this.c('0')}`;
      default:
        return `${this.c('2')} ${severity.toUpperCase()} ${this.c('0')}`;
    }
  }

  private scoreBar(score: number): string {
    const barWidth = 40;
    const filled = Math.round((score / 100) * barWidth);
    const empty = barWidth - filled;
    const filledStr = `${this.c('32')}\u2588`.repeat(filled) + this.c('0');
    const emptyStr = `${this.c('2')}\u2591`.repeat(empty) + this.c('0');
    return filledStr + emptyStr;
  }

  private sectionHeader(title: string): string {
    const prefix = `\u2500\u2500 ${title} `;
    const lineLen = Math.max(0, LINE_WIDTH - prefix.length);
    return `${this.c('1;35')}${prefix}${'\u2500'.repeat(lineLen)}${this.c('0')}`;
  }

  private formatLocation(filePath: string, lineNumber?: number | undefined): string {
    const path = `${this.c('4;36')}${filePath}${this.c('0')}`;
    if (lineNumber != null) {
      return `${path}:${this.c('33')}${lineNumber}${this.c('0')}`;
    }
    return path;
  }
}
