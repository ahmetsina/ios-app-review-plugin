import * as path from 'path';
import * as fs from 'fs/promises';
import fg from 'fast-glob';
import { parsePlist, fileExists } from '../parsers/plist.js';
import type {
  Analyzer,
  AnalysisResult,
  AnalyzerOptions,
  Issue,
  XcodeProject,
  PrivacyManifest,
} from '../types/index.js';

/**
 * Required Reason APIs that need declaration in privacy manifest
 * https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api
 */
const REQUIRED_REASON_APIS: Record<
  string,
  {
    description: string;
    patterns: RegExp[];
    validReasons: string[];
  }
> = {
  'NSPrivacyAccessedAPICategoryFileTimestamp': {
    description: 'File timestamp APIs',
    patterns: [
      /NSFileCreationDate/,
      /NSFileModificationDate/,
      /NSURLContentModificationDateKey/,
      /NSURLCreationDateKey/,
      /getattrlist.*ATTR_CMN_CRTIME/,
      /getattrlist.*ATTR_CMN_MODTIME/,
      /stat\.st_mtime/,
      /stat\.st_ctime/,
    ],
    validReasons: ['C617.1', 'DDA9.1', '3B52.1', '0A2A.1'],
  },
  'NSPrivacyAccessedAPICategorySystemBootTime': {
    description: 'System boot time APIs',
    patterns: [/systemUptime/, /mach_absolute_time/, /ProcessInfo.*systemUptime/],
    validReasons: ['35F9.1', '8FFB.1', '3D61.1'],
  },
  'NSPrivacyAccessedAPICategoryDiskSpace': {
    description: 'Disk space APIs',
    patterns: [
      /volumeAvailableCapacity/,
      /volumeTotalCapacity/,
      /NSFileSystemFreeSize/,
      /NSFileSystemSize/,
      /statfs/,
      /statvfs/,
    ],
    validReasons: ['85F4.1', 'E174.1', '7D9E.1', 'B728.1'],
  },
  'NSPrivacyAccessedAPICategoryActiveKeyboards': {
    description: 'Active keyboards APIs',
    patterns: [/activeInputModes/],
    validReasons: ['3EC4.1', '54BD.1'],
  },
  'NSPrivacyAccessedAPICategoryUserDefaults': {
    description: 'User defaults APIs (accessing outside app container)',
    patterns: [
      /UserDefaults\(suiteName:/,
      /NSUserDefaults.*initWithSuiteName/,
      /CFPreferences.*kCFPreferencesAnyApplication/,
    ],
    validReasons: ['1C8F.1', 'AC6B.1', 'CA92.1'],
  },
};

/**
 * Privacy Manifest Analyzer for iOS 17+ requirements
 */
export class PrivacyAnalyzer implements Analyzer {
  name = 'Privacy Manifest Analyzer';
  description = 'Validates PrivacyInfo.xcprivacy for iOS 17+ requirements';

  async analyze(project: XcodeProject, options: AnalyzerOptions): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    // Find app targets
    const targets = options.targetName
      ? project.targets.filter((t) => t.name === options.targetName)
      : project.targets.filter((t) => t.type === 'application');

    for (const target of targets) {
      // Check if privacy manifest exists
      const manifestPath = await this.findPrivacyManifest(options.basePath, target.name);

      // Scan source files for required reason API usage
      const sourceFiles = target.sourceFiles.length > 0
        ? target.sourceFiles
        : await this.findSourceFiles(options.basePath);

      const detectedApis = await this.scanForRequiredReasonApis(sourceFiles);

      if (detectedApis.length > 0 && !manifestPath) {
        issues.push({
          id: 'missing-privacy-manifest',
          title: 'Missing Privacy Manifest',
          description: `Your app uses Required Reason APIs but no PrivacyInfo.xcprivacy file was found. Starting Spring 2024, Apple requires apps using these APIs to include a privacy manifest.`,
          severity: 'error',
          category: 'privacy',
          guideline: 'Guideline 5.1.1 - Data Collection and Storage',
          suggestion: `Create a PrivacyInfo.xcprivacy file and declare the following API categories: ${detectedApis.map((a) => a.category).join(', ')}`,
        });
      }

      if (manifestPath) {
        const manifestIssues = await this.analyzeManifestFile(
          manifestPath,
          detectedApis
        );
        issues.push(...manifestIssues);
      }
    }

    return {
      analyzer: this.name,
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Analyze a specific privacy manifest file
   */
  async analyzeManifest(
    manifestPath: string,
    projectPath?: string
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    if (!(await fileExists(manifestPath))) {
      return {
        analyzer: this.name,
        passed: false,
        issues: [
          {
            id: 'privacy-manifest-not-found',
            title: 'Privacy manifest not found',
            description: `PrivacyInfo.xcprivacy not found at ${manifestPath}`,
            severity: 'error',
            filePath: manifestPath,
            category: 'privacy',
          },
        ],
        duration: Date.now() - startTime,
      };
    }

    // Scan for API usage if project path provided
    let detectedApis: DetectedApi[] = [];
    if (projectPath) {
      const sourceFiles = await this.findSourceFiles(projectPath);
      detectedApis = await this.scanForRequiredReasonApis(sourceFiles);
    }

    const manifestIssues = await this.analyzeManifestFile(manifestPath, detectedApis);
    issues.push(...manifestIssues);

    return {
      analyzer: this.name,
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Find privacy manifest in project
   */
  private async findPrivacyManifest(
    basePath: string,
    targetName: string
  ): Promise<string | null> {
    const possiblePaths = [
      path.join(basePath, 'PrivacyInfo.xcprivacy'),
      path.join(basePath, targetName, 'PrivacyInfo.xcprivacy'),
      path.join(basePath, 'Resources', 'PrivacyInfo.xcprivacy'),
      path.join(basePath, targetName, 'Resources', 'PrivacyInfo.xcprivacy'),
    ];

    for (const p of possiblePaths) {
      if (await fileExists(p)) {
        return p;
      }
    }

    // Search with glob
    const found = await fg('**/PrivacyInfo.xcprivacy', {
      cwd: basePath,
      absolute: true,
      ignore: ['**/Pods/**', '**/Carthage/**', '**/build/**'],
    });

    return found[0] ?? null;
  }

  /**
   * Find all Swift and Objective-C source files
   */
  private async findSourceFiles(basePath: string): Promise<string[]> {
    return fg(['**/*.swift', '**/*.m', '**/*.mm'], {
      cwd: basePath,
      absolute: true,
      ignore: ['**/Pods/**', '**/Carthage/**', '**/build/**', '**/*.generated.swift'],
    });
  }

  /**
   * Scan source files for Required Reason API usage
   */
  private async scanForRequiredReasonApis(files: string[]): Promise<DetectedApi[]> {
    const detected: DetectedApi[] = [];
    const seenCategories = new Set<string>();

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        for (const [category, api] of Object.entries(REQUIRED_REASON_APIS)) {
          if (seenCategories.has(category)) {
            continue;
          }

          for (const pattern of api.patterns) {
            if (pattern.test(content)) {
              detected.push({
                category,
                description: api.description,
                file,
                validReasons: api.validReasons,
              });
              seenCategories.add(category);
              break;
            }
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return detected;
  }

  /**
   * Analyze privacy manifest file contents
   */
  private async analyzeManifestFile(
    manifestPath: string,
    detectedApis: DetectedApi[]
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    let manifest: PrivacyManifest;
    try {
      manifest = await parsePlist<PrivacyManifest>(manifestPath);
    } catch (error) {
      issues.push({
        id: 'privacy-manifest-parse-error',
        title: 'Failed to parse privacy manifest',
        description: `Could not parse PrivacyInfo.xcprivacy: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
        filePath: manifestPath,
        category: 'privacy',
      });
      return issues;
    }

    // Check if tracking is declared but no tracking domains
    if (manifest.NSPrivacyTracking === true) {
      if (!manifest.NSPrivacyTrackingDomains || manifest.NSPrivacyTrackingDomains.length === 0) {
        issues.push({
          id: 'tracking-no-domains',
          title: 'Tracking enabled but no domains declared',
          description:
            'NSPrivacyTracking is true but no tracking domains are declared in NSPrivacyTrackingDomains.',
          severity: 'warning',
          filePath: manifestPath,
          category: 'privacy',
          suggestion: 'Add tracking domains to NSPrivacyTrackingDomains or set NSPrivacyTracking to false.',
        });
      }
    }

    // Check for undeclared Required Reason APIs
    const declaredApiTypes = new Set(
      manifest.NSPrivacyAccessedAPITypes?.map((api) => api.NSPrivacyAccessedAPIType) ?? []
    );

    for (const api of detectedApis) {
      if (!declaredApiTypes.has(api.category)) {
        issues.push({
          id: `undeclared-api-${api.category}`,
          title: `Undeclared Required Reason API: ${api.description}`,
          description: `Your code uses ${api.description} APIs (detected in ${path.basename(api.file)}) but this is not declared in your privacy manifest.`,
          severity: 'error',
          filePath: manifestPath,
          category: 'privacy',
          guideline: 'Required Reason API documentation',
          suggestion: `Add ${api.category} to NSPrivacyAccessedAPITypes with one of these valid reasons: ${api.validReasons.join(', ')}`,
        });
      }
    }

    // Validate declared API reasons
    for (const apiType of manifest.NSPrivacyAccessedAPITypes ?? []) {
      const category = apiType.NSPrivacyAccessedAPIType;
      const apiInfo = REQUIRED_REASON_APIS[category];

      if (apiInfo) {
        const declaredReasons = apiType.NSPrivacyAccessedAPITypeReasons ?? [];

        // Check for empty reasons
        if (declaredReasons.length === 0) {
          issues.push({
            id: `no-reasons-${category}`,
            title: `No reasons declared for ${apiInfo.description}`,
            description: `${category} is declared but no reasons are provided.`,
            severity: 'error',
            filePath: manifestPath,
            category: 'privacy',
            suggestion: `Add valid reasons: ${apiInfo.validReasons.join(', ')}`,
          });
        }

        // Check for invalid reasons
        for (const reason of declaredReasons) {
          if (!apiInfo.validReasons.includes(reason)) {
            issues.push({
              id: `invalid-reason-${category}-${reason}`,
              title: `Invalid reason for ${apiInfo.description}`,
              description: `"${reason}" is not a valid reason for ${category}.`,
              severity: 'error',
              filePath: manifestPath,
              category: 'privacy',
              suggestion: `Valid reasons are: ${apiInfo.validReasons.join(', ')}`,
            });
          }
        }
      }
    }

    // Check for collected data types without purposes
    for (const dataType of manifest.NSPrivacyCollectedDataTypes ?? []) {
      if (!dataType.NSPrivacyCollectedDataTypePurposes ||
          dataType.NSPrivacyCollectedDataTypePurposes.length === 0) {
        issues.push({
          id: `no-purpose-${dataType.NSPrivacyCollectedDataType}`,
          title: `No purpose declared for collected data`,
          description: `Data type "${dataType.NSPrivacyCollectedDataType}" is declared as collected but no purposes are specified.`,
          severity: 'warning',
          filePath: manifestPath,
          category: 'privacy',
          suggestion: 'Add appropriate purposes to NSPrivacyCollectedDataTypePurposes.',
        });
      }
    }

    return issues;
  }
}

interface DetectedApi {
  category: string;
  description: string;
  file: string;
  validReasons: string[];
}
