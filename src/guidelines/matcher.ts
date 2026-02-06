import type { Issue, AnalysisReport, Severity } from '../types/index.js';
import type { GuidelineEntry, EnrichedIssue } from './types.js';
import { GUIDELINES, ISSUE_GUIDELINE_MAP } from './database.js';

export interface EnrichedAnalysisReport extends AnalysisReport {
  score: number;
  enrichedIssues: EnrichedIssue[];
}

const SEVERITY_MULTIPLIER: Record<Severity, number> = {
  error: 1.0,
  warning: 0.5,
  info: 0.1,
};

export class GuidelineMatcher {
  matchIssue(issue: Issue): GuidelineEntry[] {
    const matches: GuidelineEntry[] = [];

    // First try ISSUE_GUIDELINE_MAP for the issue id
    const mappedSections = ISSUE_GUIDELINE_MAP[issue.id];
    if (mappedSections) {
      for (const section of mappedSections) {
        const entry = GUIDELINES[section];
        if (entry) {
          matches.push(entry);
        }
      }
    }

    // Fallback: parse section from guideline string like "Guideline 2.5.4 - Security"
    if (matches.length === 0 && issue.guideline) {
      const sectionMatch = issue.guideline.match(/(\d+\.\d+(?:\.\d+)?)/);
      if (sectionMatch?.[1]) {
        const entry = GUIDELINES[sectionMatch[1]];
        if (entry) {
          matches.push(entry);
        }
      }
    }

    return matches;
  }

  enrichReport(report: AnalysisReport): EnrichedAnalysisReport {
    const enrichedIssues: EnrichedIssue[] = [];

    for (const result of report.results) {
      for (const issue of result.issues) {
        const guidelines = this.matchIssue(issue);
        const primary = guidelines[0];
        const enriched: EnrichedIssue = {
          ...issue,
        };
        if (primary) {
          enriched.guidelineUrl = primary.url;
          enriched.guidelineExcerpt = primary.excerpt;
          enriched.severityScore = primary.severityWeight * SEVERITY_MULTIPLIER[issue.severity];
        }
        enrichedIssues.push(enriched);
      }
    }

    return {
      ...report,
      score: this.calculateScore(report),
      enrichedIssues,
    };
  }

  calculateScore(report: AnalysisReport): number {
    let totalDeduction = 0;

    for (const result of report.results) {
      for (const issue of result.issues) {
        const guidelines = this.matchIssue(issue);
        const weight = guidelines[0]?.severityWeight ?? 3; // default weight for unmapped issues
        totalDeduction += weight * SEVERITY_MULTIPLIER[issue.severity];
      }
    }

    return Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));
  }
}
