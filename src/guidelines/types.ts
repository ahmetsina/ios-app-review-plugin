import type { Issue } from '../types/index.js';

export type GuidelineCategory =
  | 'safety'
  | 'performance'
  | 'business'
  | 'design'
  | 'legal';

export interface GuidelineEntry {
  section: string;
  title: string;
  excerpt: string;
  url: string;
  category: GuidelineCategory;
  severityWeight: number; // 1-10
}

export interface GuidelineMatch {
  issue: Issue;
  guideline: GuidelineEntry;
}

export interface EnrichedIssue extends Issue {
  guidelineUrl?: string | undefined;
  guidelineExcerpt?: string | undefined;
  severityScore?: number | undefined;
}
