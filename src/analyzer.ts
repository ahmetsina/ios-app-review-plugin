import * as path from 'path';
import { parseXcodeProject } from './parsers/xcodeproj.js';
import { InfoPlistAnalyzer } from './analyzers/info-plist.js';
import { PrivacyAnalyzer } from './analyzers/privacy.js';
import { EntitlementsAnalyzer } from './analyzers/entitlements.js';
import { CodeScanner } from './analyzers/code-scanner.js';
import { ASCMetadataAnalyzer } from './analyzers/asc-metadata.js';
import { ASCScreenshotAnalyzer } from './analyzers/asc-screenshots.js';
import { ASCVersionAnalyzer } from './analyzers/asc-version.js';
import { ASCIAPAnalyzer } from './analyzers/asc-iap.js';
import { DeprecatedAPIAnalyzer } from './analyzers/deprecated-api.js';
import { PrivateAPIAnalyzer } from './analyzers/private-api.js';
import { SecurityAnalyzer } from './analyzers/security.js';
import { UIUXAnalyzer } from './analyzers/ui-ux.js';
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
  'deprecated-api': () => new DeprecatedAPIAnalyzer(),
  'private-api': () => new PrivateAPIAnalyzer(),
  security: () => new SecurityAnalyzer(),
  'ui-ux': () => new UIUXAnalyzer(),
};

/**
 * ASC analyzers (optional, require credentials)
 */
const ASC_ANALYZERS: Record<string, () => Analyzer> = {
  'asc-metadata': () => new ASCMetadataAnalyzer(),
  'asc-screenshots': () => new ASCScreenshotAnalyzer(),
  'asc-version': () => new ASCVersionAnalyzer(),
  'asc-iap': () => new ASCIAPAnalyzer(),
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
  let analyzerNames: string[];

  if (!input.analyzers || input.analyzers.includes('all')) {
    analyzerNames = Object.keys(ANALYZERS);
    if (input.includeASC) {
      analyzerNames.push(...Object.keys(ASC_ANALYZERS));
    }
  } else {
    analyzerNames = input.analyzers.filter(
      (a) => a !== 'all' && (a in ANALYZERS || a in ASC_ANALYZERS)
    );
  }

  // Run analyzers
  const results: AnalysisResult[] = [];
  const basePath = path.dirname(projectPath);

  for (const name of analyzerNames) {
    const createAnalyzer = ANALYZERS[name] ?? ASC_ANALYZERS[name];
    if (createAnalyzer) {
      const analyzer = createAnalyzer();
      const result = await analyzer.analyze(project, {
        targetName: input.targetName,
        basePath,
        bundleId: input.bundleId,
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
