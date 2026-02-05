import { z } from 'zod';

/**
 * Severity levels for analysis issues
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * An issue found during analysis
 */
export interface Issue {
  /** Unique identifier for the issue type */
  id: string;
  /** Human-readable title */
  title: string;
  /** Detailed description of the issue */
  description: string;
  /** Severity level */
  severity: Severity;
  /** File path where the issue was found (if applicable) */
  filePath?: string | undefined;
  /** Line number in the file (if applicable) */
  lineNumber?: number | undefined;
  /** Related App Store Guideline (if applicable) */
  guideline?: string | undefined;
  /** Suggested fix or remediation */
  suggestion?: string | undefined;
  /** Category of the issue */
  category: IssueCategory;
}

/**
 * Categories for grouping issues
 */
export type IssueCategory =
  | 'info-plist'
  | 'privacy'
  | 'entitlements'
  | 'code'
  | 'security'
  | 'metadata'
  | 'screenshots'
  | 'version'
  | 'iap'
  | 'asc'
  | 'deprecated-api'
  | 'private-api'
  | 'ui-ux';

/**
 * Result from an analyzer
 */
export interface AnalysisResult {
  /** Name of the analyzer */
  analyzer: string;
  /** Whether the analysis passed (no errors) */
  passed: boolean;
  /** List of issues found */
  issues: Issue[];
  /** Time taken in milliseconds */
  duration: number;
}

/**
 * Complete analysis report
 */
export interface AnalysisReport {
  /** Project path that was analyzed */
  projectPath: string;
  /** Timestamp of the analysis */
  timestamp: string;
  /** Results from each analyzer */
  results: AnalysisResult[];
  /** Summary statistics */
  summary: AnalysisSummary;
}

/**
 * Summary statistics for an analysis
 */
export interface AnalysisSummary {
  /** Total number of issues */
  totalIssues: number;
  /** Number of errors */
  errors: number;
  /** Number of warnings */
  warnings: number;
  /** Number of info items */
  info: number;
  /** Overall pass/fail status */
  passed: boolean;
  /** Total analysis duration in milliseconds */
  duration: number;
}

/**
 * Xcode project information
 */
export interface XcodeProject {
  /** Path to the .xcodeproj directory */
  path: string;
  /** Project name */
  name: string;
  /** Build targets */
  targets: XcodeTarget[];
  /** Build configurations */
  configurations: string[];
}

/**
 * Xcode build target
 */
export interface XcodeTarget {
  /** Target name */
  name: string;
  /** Target type (app, framework, extension, etc.) */
  type: TargetType;
  /** Bundle identifier */
  bundleIdentifier?: string | undefined;
  /** Path to Info.plist */
  infoPlistPath?: string | undefined;
  /** Path to entitlements file */
  entitlementsPath?: string | undefined;
  /** Minimum deployment target */
  deploymentTarget?: string | undefined;
  /** Source files */
  sourceFiles: string[];
}

export type TargetType =
  | 'application'
  | 'framework'
  | 'staticLibrary'
  | 'dynamicLibrary'
  | 'appExtension'
  | 'watchApp'
  | 'watchExtension'
  | 'tvExtension'
  | 'unitTest'
  | 'uiTest'
  | 'unknown';

/**
 * Parsed Info.plist contents
 */
export interface InfoPlist {
  /** Bundle identifier */
  CFBundleIdentifier?: string;
  /** Bundle name */
  CFBundleName?: string;
  /** Bundle display name */
  CFBundleDisplayName?: string;
  /** Bundle version (build number) */
  CFBundleVersion?: string;
  /** Short version string (marketing version) */
  CFBundleShortVersionString?: string;
  /** Minimum iOS version */
  MinimumOSVersion?: string;
  /** Privacy usage descriptions */
  [key: `NS${string}UsageDescription`]: string | undefined;
  /** App Transport Security settings */
  NSAppTransportSecurity?: {
    NSAllowsArbitraryLoads?: boolean;
    NSExceptionDomains?: Record<string, unknown>;
  };
  /** All other properties */
  [key: string]: unknown;
}

/**
 * Privacy manifest (PrivacyInfo.xcprivacy) contents
 */
export interface PrivacyManifest {
  /** Privacy tracking enabled */
  NSPrivacyTracking?: boolean;
  /** Tracking domains */
  NSPrivacyTrackingDomains?: string[];
  /** Collected data types */
  NSPrivacyCollectedDataTypes?: PrivacyCollectedDataType[];
  /** Accessed API types */
  NSPrivacyAccessedAPITypes?: PrivacyAccessedAPIType[];
}

export interface PrivacyCollectedDataType {
  NSPrivacyCollectedDataType: string;
  NSPrivacyCollectedDataTypeLinked: boolean;
  NSPrivacyCollectedDataTypeTracking: boolean;
  NSPrivacyCollectedDataTypePurposes: string[];
}

export interface PrivacyAccessedAPIType {
  NSPrivacyAccessedAPIType: string;
  NSPrivacyAccessedAPITypeReasons: string[];
}

/**
 * Input schema for the analyze tool
 */
export const AnalyzeInputSchema = z.object({
  projectPath: z.string().describe('Path to the .xcodeproj or .xcworkspace directory'),
  analyzers: z
    .array(z.enum(['all', 'info-plist', 'privacy', 'entitlements', 'code', 'deprecated-api', 'private-api', 'security', 'ui-ux', 'asc-metadata', 'asc-screenshots', 'asc-version', 'asc-iap']))
    .optional()
    .describe('Specific analyzers to run (default: all)'),
  targetName: z.string().optional().describe('Specific target to analyze'),
  includeASC: z.boolean().optional().describe('Include App Store Connect validation (requires ASC credentials)'),
  bundleId: z.string().optional().describe('Bundle ID for ASC validation (auto-detected if not provided)'),
});

export type AnalyzeInput = z.infer<typeof AnalyzeInputSchema>;

/**
 * Analyzer interface that all analyzers must implement
 */
export interface Analyzer {
  /** Unique name of the analyzer */
  name: string;
  /** Description of what the analyzer checks */
  description: string;
  /** Run the analysis on a project */
  analyze(project: XcodeProject, options?: AnalyzerOptions): Promise<AnalysisResult>;
}

export interface AnalyzerOptions {
  /** Specific target to analyze */
  targetName?: string | undefined;
  /** Base path for resolving relative paths */
  basePath: string;
  /** Bundle ID for ASC validation (auto-detected from project if not provided) */
  bundleId?: string | undefined;
}
