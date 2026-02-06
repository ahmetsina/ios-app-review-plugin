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
import { RuleLoader, CustomRuleEngine } from './rules/index.js';
import { GuidelineMatcher } from './guidelines/index.js';
import { getChangedFiles } from './git/index.js';
import { ProgressReporter } from './progress/index.js';
import type { EnrichedAnalysisReport } from './guidelines/index.js';
import type { ProgressCallback } from './progress/index.js';
import type { FileCache } from './cache/index.js';
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

export interface RunAnalysisOptions {
  onProgress?: ProgressCallback;
  cache?: FileCache;
}

/**
 * Run analysis on an iOS project
 */
export async function runAnalysis(
  input: AnalyzeInput,
  options?: RunAnalysisOptions,
): Promise<EnrichedAnalysisReport> {
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

  // Resolve changed files for incremental scanning
  const basePath = path.dirname(projectPath);
  let changedFiles: string[] | undefined;
  if (input.changedSince) {
    changedFiles = getChangedFiles(basePath, input.changedSince);
    if (changedFiles.length === 0) {
      changedFiles = undefined; // fall back to full scan
    }
  }

  // Setup progress reporter
  const progress = new ProgressReporter(options?.onProgress);
  progress.scanStart(analyzerNames.length);

  // Split into core and ASC analyzers
  const coreNames = analyzerNames.filter((n) => n in ANALYZERS);
  const ascNames = analyzerNames.filter((n) => n in ASC_ANALYZERS);

  // Run core analyzers in parallel
  const corePromises = coreNames.map(async (name) => {
    const createAnalyzer = ANALYZERS[name];
    if (!createAnalyzer) return null;
    progress.analyzerStart(name);
    const analyzerStart = Date.now();
    const analyzer = createAnalyzer();
    const result = await analyzer.analyze(project, {
      targetName: input.targetName,
      basePath,
      bundleId: input.bundleId,
      changedFiles,
    });
    progress.analyzerComplete(name, Date.now() - analyzerStart);
    return result;
  });

  const coreSettled = await Promise.allSettled(corePromises);
  const results: AnalysisResult[] = [];

  for (const settled of coreSettled) {
    if (settled.status === 'fulfilled' && settled.value) {
      results.push(settled.value);
    }
  }

  // Run ASC analyzers in parallel
  if (ascNames.length > 0) {
    const ascPromises = ascNames.map(async (name) => {
      const createAnalyzer = ASC_ANALYZERS[name];
      if (!createAnalyzer) return null;
      progress.analyzerStart(name);
      const analyzerStart = Date.now();
      const analyzer = createAnalyzer();
      const result = await analyzer.analyze(project, {
        targetName: input.targetName,
        basePath,
        bundleId: input.bundleId,
        changedFiles,
      });
      progress.analyzerComplete(name, Date.now() - analyzerStart);
      return result;
    });

    const ascSettled = await Promise.allSettled(ascPromises);
    for (const settled of ascSettled) {
      if (settled.status === 'fulfilled' && settled.value) {
        results.push(settled.value);
      }
    }
  }

  // Run custom rules if available
  try {
    const loader = new RuleLoader();
    const loaded = input.customRulesPath
      ? await loader.loadConfig(input.customRulesPath).then((config) => ({
          config,
          rules: loader.compileRules(config),
        }))
      : await loader.loadFromProject(basePath);

    if (loaded) {
      const engine = new CustomRuleEngine(loaded.config);
      const customResult = await engine.scan(basePath, loaded.rules);
      if (customResult.issues.length > 0) {
        results.push(customResult);
      }
    }
  } catch {
    // Custom rules are optional; silently skip on error
  }

  // Calculate summary
  const totalDuration = Date.now() - startTime;
  const summary = calculateSummary(results, totalDuration);

  progress.scanComplete(totalDuration);

  const report: AnalysisReport = {
    projectPath,
    timestamp: new Date().toISOString(),
    results,
    summary,
  };

  // Enrich with guideline cross-references and score
  const matcher = new GuidelineMatcher();
  return matcher.enrichReport(report);
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
