import * as path from 'path';
import { parseXcodeProject } from './parsers/xcodeproj.js';
import { InfoPlistAnalyzer } from './analyzers/info-plist.js';
import { PrivacyAnalyzer } from './analyzers/privacy.js';
import { EntitlementsAnalyzer } from './analyzers/entitlements.js';
import { CodeScanner } from './analyzers/code-scanner.js';
import type {
  AnalyzeInput,
  AnalysisReport,
  AnalysisResult,
  AnalysisSummary,
  Analyzer,
} from './types/index.js';

/**
 * Available analyzers
 */
const ANALYZERS: Record<string, () => Analyzer> = {
  'info-plist': () => new InfoPlistAnalyzer(),
  privacy: () => new PrivacyAnalyzer(),
  entitlements: () => new EntitlementsAnalyzer(),
  code: () => new CodeScanner(),
};

/**
 * Run analysis on an iOS project
 */
export async function runAnalysis(input: AnalyzeInput): Promise<AnalysisReport> {
  const startTime = Date.now();
  const projectPath = path.resolve(input.projectPath);

  // Parse the Xcode project
  const project = await parseXcodeProject(projectPath);

  // Determine which analyzers to run
  const analyzerNames =
    !input.analyzers || input.analyzers.includes('all')
      ? Object.keys(ANALYZERS)
      : input.analyzers.filter((a) => a !== 'all' && a in ANALYZERS);

  // Run analyzers
  const results: AnalysisResult[] = [];
  const basePath = path.dirname(projectPath);

  for (const name of analyzerNames) {
    const createAnalyzer = ANALYZERS[name];
    if (createAnalyzer) {
      const analyzer = createAnalyzer();
      const result = await analyzer.analyze(project, {
        targetName: input.targetName,
        basePath,
      });
      results.push(result);
    }
  }

  // Calculate summary
  const summary = calculateSummary(results, Date.now() - startTime);

  return {
    projectPath,
    timestamp: new Date().toISOString(),
    results,
    summary,
  };
}

/**
 * Calculate summary statistics from analysis results
 */
function calculateSummary(results: AnalysisResult[], duration: number): AnalysisSummary {
  let errors = 0;
  let warnings = 0;
  let info = 0;

  for (const result of results) {
    for (const issue of result.issues) {
      switch (issue.severity) {
        case 'error':
          errors++;
          break;
        case 'warning':
          warnings++;
          break;
        case 'info':
          info++;
          break;
      }
    }
  }

  return {
    totalIssues: errors + warnings + info,
    errors,
    warnings,
    info,
    passed: errors === 0,
    duration,
  };
}
