export type { ReportFormat, ReportFormatter, EnrichedAnalysisReport, HistoricalComparison } from './types.js';
export { MarkdownFormatter } from './markdown.js';
export { HtmlFormatter } from './html.js';
export { JsonFormatter } from './json.js';
export { PrettyFormatter } from './pretty.js';

import type { ReportFormat, ReportFormatter } from './types.js';
import { MarkdownFormatter } from './markdown.js';
import { HtmlFormatter } from './html.js';
import { JsonFormatter } from './json.js';
import { PrettyFormatter } from './pretty.js';

export function createFormatter(format: ReportFormat): ReportFormatter {
  switch (format) {
    case 'markdown':
      return new MarkdownFormatter();
    case 'html':
      return new HtmlFormatter();
    case 'json':
      return new JsonFormatter();
    case 'pretty':
      return new PrettyFormatter();
  }
}
