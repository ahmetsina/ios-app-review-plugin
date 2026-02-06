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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function severityBadge(severity: string): string {
  const colors: Record<string, string> = {
    error: '#dc3545',
    warning: '#fd7e14',
    info: '#0d6efd',
  };
  const color = colors[severity] ?? '#6c757d';
  return `<span class="badge" style="background-color:${color}">${escapeHtml(severity.toUpperCase())}</span>`;
}

function scoreColor(score: number): string {
  if (score >= 80) return '#28a745';
  if (score >= 50) return '#fd7e14';
  return '#dc3545';
}

function trendSvg(trend: 'improving' | 'declining' | 'stable'): string {
  if (trend === 'improving') {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4L4 14H10V20H14V14H20L12 4Z" fill="#28a745"/>
    </svg>`;
  }
  if (trend === 'declining') {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 20L20 10H14V4H10V10H4L12 20Z" fill="#dc3545"/>
    </svg>`;
  }
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="10" width="16" height="4" rx="2" fill="#6c757d"/>
  </svg>`;
}

export class HtmlFormatter implements ReportFormatter {
  format(report: EnrichedAnalysisReport): string {
    const status = report.summary.passed ? 'PASSED' : 'ISSUES FOUND';
    const date = new Date(report.timestamp).toLocaleString();
    const color = scoreColor(report.score);

    const comparisonHtml = report.comparison
      ? this.buildComparison(report.comparison)
      : '';

    const errorIssues = report.enrichedIssues.filter((i) => i.severity === 'error');
    const priorityHtml =
      errorIssues.length > 0 ? this.buildPriorityRemediation(errorIssues) : '';

    const issuesHtml = this.buildIssuesByCategory(report.enrichedIssues);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>App Store Review Readiness Report</title>
<style>
  :root {
    --bg: #ffffff;
    --fg: #1a1a1a;
    --card-bg: #f8f9fa;
    --border: #dee2e6;
    --muted: #6c757d;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1a1a2e;
      --fg: #e0e0e0;
      --card-bg: #16213e;
      --border: #2a2a4a;
      --muted: #a0a0b0;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--fg);
    line-height: 1.6;
    padding: 2rem;
    max-width: 960px;
    margin: 0 auto;
  }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.4rem; margin: 1.5rem 0 0.75rem; }
  h3 { font-size: 1.1rem; margin: 1rem 0 0.5rem; }
  .meta { color: var(--muted); font-size: 0.9rem; margin-bottom: 0.25rem; }
  .status { font-weight: bold; }
  .status.passed { color: #28a745; }
  .status.failed { color: #dc3545; }
  .score-gauge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 6px solid;
    font-size: 1.6rem;
    font-weight: bold;
    margin: 1rem 0;
  }
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  .badge {
    display: inline-block;
    color: #fff;
    padding: 0.15em 0.5em;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    vertical-align: middle;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.5rem 0;
  }
  th, td {
    text-align: left;
    padding: 0.4rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }
  th { font-weight: 600; }
  details { margin-bottom: 0.5rem; }
  summary {
    cursor: pointer;
    font-weight: 600;
    padding: 0.5rem 0;
  }
  summary:hover { opacity: 0.8; }
  .issue { margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); }
  .issue:last-child { border-bottom: none; }
  .issue-title { font-weight: 600; margin-bottom: 0.25rem; }
  .issue-desc { margin-bottom: 0.25rem; }
  .issue-meta { font-size: 0.85rem; color: var(--muted); }
  .location { font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 0.85rem; }
  .suggestion { font-style: italic; color: var(--muted); margin-top: 0.25rem; }
  .trend-indicator { display: inline-flex; align-items: center; gap: 0.25rem; vertical-align: middle; }
</style>
</head>
<body>
  <h1>App Store Review Readiness Report</h1>
  <p class="meta">Project: <code>${escapeHtml(report.projectPath)}</code></p>
  <p class="meta">Date: ${escapeHtml(date)}</p>
  <p class="meta">Status: <span class="status ${report.summary.passed ? 'passed' : 'failed'}">${escapeHtml(status)}</span></p>

  <h2>Review Readiness Score</h2>
  <div class="score-gauge" style="border-color:${color};color:${color}">
    ${report.score}
  </div>

  <h2>Summary</h2>
  <div class="card">
    <table>
      <tr><th>Metric</th><th>Count</th></tr>
      <tr><td>Total Issues</td><td>${report.summary.totalIssues}</td></tr>
      <tr><td>Errors</td><td>${report.summary.errors}</td></tr>
      <tr><td>Warnings</td><td>${report.summary.warnings}</td></tr>
      <tr><td>Info</td><td>${report.summary.info}</td></tr>
      <tr><td>Duration</td><td>${report.summary.duration}ms</td></tr>
    </table>
  </div>

  ${comparisonHtml}
  ${priorityHtml}
  ${issuesHtml}
</body>
</html>`;
  }

  private buildComparison(comparison: HistoricalComparison): string {
    const deltaSign = comparison.scoreDelta > 0 ? '+' : '';
    const trend = trendSvg(comparison.trend);
    const trendLabel =
      comparison.trend === 'improving'
        ? 'Improving'
        : comparison.trend === 'declining'
          ? 'Declining'
          : 'Stable';

    return `
  <h2>Historical Comparison</h2>
  <div class="card">
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Previous Score</td><td>${comparison.previousScore}/100</td></tr>
      <tr><td>Current Score</td><td>${comparison.currentScore}/100</td></tr>
      <tr><td>Delta</td><td>${deltaSign}${comparison.scoreDelta}</td></tr>
      <tr><td>Trend</td><td><span class="trend-indicator">${trend} ${escapeHtml(trendLabel)}</span></td></tr>
      <tr><td>New Issues</td><td>${comparison.newIssues.length}</td></tr>
      <tr><td>Resolved Issues</td><td>${comparison.resolvedIssues.length}</td></tr>
      <tr><td>Ongoing Issues</td><td>${comparison.ongoingIssues.length}</td></tr>
    </table>
  </div>`;
  }

  private buildPriorityRemediation(errorIssues: EnrichedIssue[]): string {
    const sorted = [...errorIssues].sort(
      (a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0),
    );

    const items = sorted
      .map((issue) => {
        const link = issue.guidelineUrl
          ? ` — <a href="${escapeHtml(issue.guidelineUrl)}">${escapeHtml(issue.guideline ?? 'Guideline')}</a>`
          : '';
        return `<li><strong>${escapeHtml(issue.title)}</strong>: ${escapeHtml(issue.description)}${link}</li>`;
      })
      .join('\n      ');

    return `
  <h2>Priority Remediation</h2>
  <div class="card">
    <ol>
      ${items}
    </ol>
  </div>`;
  }

  private buildIssuesByCategory(issues: EnrichedIssue[]): string {
    if (issues.length === 0) {
      return '<h2>Issues</h2><p>No issues found.</p>';
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

    const sections: string[] = ['<h2>Issues by Category</h2>'];

    for (const [category, categoryIssues] of grouped) {
      const label =
        CATEGORY_LABELS[category as IssueCategory | 'custom'] ?? category;

      const issueItems = categoryIssues
        .map((issue) => {
          const parts: string[] = [
            `<div class="issue">`,
            `  <div class="issue-title">${severityBadge(issue.severity)} ${escapeHtml(issue.title)}</div>`,
            `  <div class="issue-desc">${escapeHtml(issue.description)}</div>`,
          ];

          if (issue.filePath) {
            const loc = issue.lineNumber
              ? `${issue.filePath}:${issue.lineNumber}`
              : issue.filePath;
            parts.push(
              `  <div class="issue-meta">Location: <span class="location">${escapeHtml(loc)}</span></div>`,
            );
          }

          if (issue.guidelineUrl) {
            parts.push(
              `  <div class="issue-meta">Guideline: <a href="${escapeHtml(issue.guidelineUrl)}">${escapeHtml(issue.guideline ?? issue.guidelineUrl)}</a></div>`,
            );
          }

          if (issue.suggestion) {
            parts.push(
              `  <div class="suggestion">Suggestion: ${escapeHtml(issue.suggestion)}</div>`,
            );
          }

          parts.push('</div>');
          return parts.join('\n    ');
        })
        .join('\n    ');

      sections.push(`
  <details open>
    <summary>${escapeHtml(label)} (${categoryIssues.length})</summary>
    <div class="card">
    ${issueItems}
    </div>
  </details>`);
    }

    return sections.join('\n');
  }
}
