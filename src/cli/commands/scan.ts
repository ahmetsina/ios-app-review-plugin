import * as fs from 'fs/promises';
import * as path from 'path';
import { runAnalysis } from '../../analyzer.js';
import { createFormatter } from '../../reports/index.js';
import type { EnrichedAnalysisReport } from '../../reports/index.js';
import { generateBadge } from '../../badge/index.js';
import type { ScanOptions } from '../types.js';

export async function runScan(options: ScanOptions): Promise<number> {
  const input = {
    projectPath: options.projectPath,
    analyzers: options.analyzers as Array<'all' | 'info-plist' | 'privacy' | 'entitlements' | 'code' | 'deprecated-api' | 'private-api' | 'security' | 'ui-ux' | 'asc-metadata' | 'asc-screenshots' | 'asc-version' | 'asc-iap'> | undefined,
    includeASC: options.includeAsc,
    customRulesPath: options.config,
    changedSince: options.changedSince,
    saveToHistory: options.saveHistory,
  };

  const report = await runAnalysis(input);
  const enriched: EnrichedAnalysisReport = { ...report };

  const formatter = createFormatter(options.format);
  const output = formatter.format(enriched);

  if (options.output) {
    const outputDir = path.dirname(path.resolve(options.output));
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.resolve(options.output), output, 'utf-8');
    console.error(`Report written to ${path.resolve(options.output)}`);
  } else {
    console.log(output);
  }

  if (options.badge) {
    const badgeSvg = generateBadge(report.score, report.summary.passed);
    const badgePath = options.output
      ? path.join(path.dirname(path.resolve(options.output)), 'badge.svg')
      : 'badge.svg';
    await fs.writeFile(badgePath, badgeSvg, 'utf-8');
    console.error(`Badge written to ${badgePath}`);
  }

  return report.summary.passed ? 0 : 1;
}
