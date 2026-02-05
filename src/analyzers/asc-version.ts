/**
 * App Store Connect Version Analyzer
 *
 * Validates version information including local vs ASC version comparison,
 * build numbers, version format, and submission status.
 */

import type {
  Analyzer,
  AnalysisResult,
  AnalyzerOptions,
  Issue,
  XcodeProject,
} from '../types/index.js';
import {
  hasCredentials,
  getAppByBundleId,
  getLatestVersion,
  getLatestBuild,
  getEditableVersion,
  getVersionWithLocalizations,
  isASCError,
  type AppStoreState,
} from '../asc/index.js';
import { parsePlist } from '../parsers/plist.js';
import type { InfoPlist } from '../types/index.js';

/**
 * Version states that indicate issues
 */
const REJECTED_STATES: AppStoreState[] = ['REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY', 'DEVELOPER_REJECTED'];
const IN_REVIEW_STATES: AppStoreState[] = ['WAITING_FOR_REVIEW', 'IN_REVIEW'];
const PENDING_STATES: AppStoreState[] = ['PENDING_APPLE_RELEASE', 'PENDING_DEVELOPER_RELEASE', 'PENDING_CONTRACT'];

export class ASCVersionAnalyzer implements Analyzer {
  name = 'ASC Version Analyzer';
  description = 'Validates version and build information against App Store Connect';

  async analyze(project: XcodeProject, options?: AnalyzerOptions): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    if (!hasCredentials()) {
      issues.push({
        id: 'asc-credentials-not-configured',
        title: 'App Store Connect credentials not configured',
        description:
          'ASC credentials are not configured. Set environment variables to enable version validation.',
        severity: 'info',
        category: 'version',
      });

      return {
        analyzer: this.name,
        passed: true,
        issues,
        duration: Date.now() - startTime,
      };
    }

    const bundleId = options?.bundleId ?? this.getBundleIdFromProject(project);
    if (!bundleId) {
      issues.push({
        id: 'asc-no-bundle-id',
        title: 'No bundle ID found',
        description: 'Could not determine bundle ID from project.',
        severity: 'warning',
        category: 'version',
      });

      return {
        analyzer: this.name,
        passed: true,
        issues,
        duration: Date.now() - startTime,
      };
    }

    // Get local version info
    const localVersion = await this.getLocalVersion(project);

    try {
      const versionIssues = await this.validateVersionsForBundleId(bundleId, localVersion);
      issues.push(...versionIssues);
    } catch (error) {
      if (isASCError(error)) {
        issues.push({
          id: error.code,
          title: error.name,
          description: error.message,
          severity: 'error',
          category: 'version',
        });
      } else {
        issues.push({
          id: 'asc-api-error',
          title: 'App Store Connect API Error',
          description: error instanceof Error ? error.message : String(error),
          severity: 'error',
          category: 'version',
        });
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
   * Compare versions for a bundle ID
   */
  async compareVersions(
    bundleId: string,
    localVersionString?: string,
    localBuildNumber?: string
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    if (!hasCredentials()) {
      return {
        analyzer: this.name,
        passed: false,
        issues: [
          {
            id: 'asc-credentials-not-configured',
            title: 'App Store Connect credentials not configured',
            description: 'Set ASC environment variables to enable validation.',
            severity: 'error',
            category: 'version',
          },
        ],
        duration: Date.now() - startTime,
      };
    }

    try {
      const versionIssues = await this.validateVersionsForBundleId(bundleId, {
        version: localVersionString,
        build: localBuildNumber,
      });
      issues.push(...versionIssues);
    } catch (error) {
      if (isASCError(error)) {
        issues.push({
          id: error.code,
          title: error.name,
          description: error.message,
          severity: 'error',
          category: 'version',
        });
      } else {
        throw error;
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
   * Validate versions
   */
  private async validateVersionsForBundleId(
    bundleId: string,
    localVersion?: { version?: string | undefined; build?: string | undefined }
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    const app = await getAppByBundleId(bundleId);

    // Get latest version and build from ASC
    const [latestVersion, latestBuild, editableVersion] = await Promise.all([
      getLatestVersion(app.id),
      getLatestBuild(app.id),
      getEditableVersion(app.id),
    ]);

    // Check submission status of editable version
    if (editableVersion) {
      const state = editableVersion.attributes.appStoreState;

      if (REJECTED_STATES.includes(state)) {
        issues.push({
          id: 'asc-version-rejected',
          title: 'App version rejected',
          description: `Version ${editableVersion.attributes.versionString} has been rejected (${state}). Review the rejection reason in App Store Connect.`,
          severity: 'error',
          category: 'version',
          suggestion: 'Check App Store Connect for rejection details and required changes.',
        });
      } else if (IN_REVIEW_STATES.includes(state)) {
        issues.push({
          id: 'asc-version-in-review',
          title: 'App version in review',
          description: `Version ${editableVersion.attributes.versionString} is currently ${state === 'WAITING_FOR_REVIEW' ? 'waiting for review' : 'in review'}.`,
          severity: 'info',
          category: 'version',
        });
      } else if (PENDING_STATES.includes(state)) {
        issues.push({
          id: 'asc-version-pending',
          title: 'App version pending release',
          description: `Version ${editableVersion.attributes.versionString} is ${state.toLowerCase().replace(/_/g, ' ')}.`,
          severity: 'info',
          category: 'version',
        });
      }

      // Check version localizations
      const versionData = await getVersionWithLocalizations(editableVersion.id);

      // Check "What's New" text
      for (const loc of versionData.localizations) {
        if (!loc.attributes.whatsNew) {
          issues.push({
            id: 'asc-missing-whats-new',
            title: `Missing "What's New" text (${loc.attributes.locale})`,
            description: 'Release notes are required for App Store updates.',
            severity: 'warning',
            category: 'version',
            suggestion: 'Add release notes describing what changed in this version.',
          });
        }

        // Check description
        if (!loc.attributes.description) {
          issues.push({
            id: 'asc-missing-description',
            title: `Missing description (${loc.attributes.locale})`,
            description: 'App description is required.',
            severity: 'error',
            category: 'version',
          });
        }

        // Check support URL
        if (!loc.attributes.supportUrl) {
          issues.push({
            id: 'asc-missing-support-url',
            title: `Missing support URL (${loc.attributes.locale})`,
            description: 'Support URL is required for App Store submission.',
            severity: 'error',
            category: 'version',
          });
        }
      }

      // Check if build is attached
      if (!versionData.build) {
        issues.push({
          id: 'asc-no-build-attached',
          title: 'No build attached to version',
          description: `Version ${editableVersion.attributes.versionString} does not have a build attached.`,
          severity: 'warning',
          category: 'version',
          suggestion: 'Upload a build and attach it to this version in App Store Connect.',
        });
      }
    }

    // Compare local vs ASC versions
    if (localVersion?.version && latestVersion) {
      const ascVersion = latestVersion.attributes.versionString;
      const comparison = this.compareVersionStrings(localVersion.version, ascVersion);

      if (comparison < 0) {
        issues.push({
          id: 'asc-local-version-lower',
          title: 'Local version is lower than ASC',
          description: `Local version (${localVersion.version}) is lower than the latest ASC version (${ascVersion}).`,
          severity: 'warning',
          category: 'version',
          suggestion: 'Update your local version number before submitting.',
        });
      } else if (comparison === 0 && editableVersion) {
        issues.push({
          id: 'asc-version-match',
          title: 'Version already exists in ASC',
          description: `Local version (${localVersion.version}) matches an existing version in App Store Connect.`,
          severity: 'info',
          category: 'version',
        });
      }
    }

    // Check build number
    if (localVersion?.build && latestBuild) {
      const ascBuild = latestBuild.attributes.version;
      const localBuildNum = parseInt(localVersion.build, 10);
      const ascBuildNum = parseInt(ascBuild, 10);

      if (!isNaN(localBuildNum) && !isNaN(ascBuildNum) && localBuildNum <= ascBuildNum) {
        issues.push({
          id: 'asc-build-number-not-incremented',
          title: 'Build number not incremented',
          description: `Local build number (${localVersion.build}) must be greater than the latest ASC build (${ascBuild}).`,
          severity: 'error',
          category: 'version',
          suggestion: `Increment your build number to at least ${ascBuildNum + 1}.`,
        });
      }
    }

    return issues;
  }

  /**
   * Compare version strings (semver-like)
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  private compareVersionStrings(a: string, b: string): number {
    const partsA = a.split('.').map((n) => parseInt(n, 10) || 0);
    const partsB = b.split('.').map((n) => parseInt(n, 10) || 0);

    const maxLength = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLength; i++) {
      const numA = partsA[i] ?? 0;
      const numB = partsB[i] ?? 0;

      if (numA < numB) {
        return -1;
      }
      if (numA > numB) {
        return 1;
      }
    }

    return 0;
  }

  /**
   * Get local version from project Info.plist
   */
  private async getLocalVersion(
    project: XcodeProject
  ): Promise<{ version?: string | undefined; build?: string | undefined }> {
    const appTarget = project.targets.find((t) => t.type === 'application');

    if (!appTarget?.infoPlistPath) {
      return {};
    }

    try {
      const plist = await parsePlist<InfoPlist>(appTarget.infoPlistPath);
      return {
        version: plist.CFBundleShortVersionString,
        build: plist.CFBundleVersion,
      };
    } catch {
      return {};
    }
  }

  private getBundleIdFromProject(project: XcodeProject): string | undefined {
    const appTarget = project.targets.find((t) => t.type === 'application');
    return appTarget?.bundleIdentifier;
  }
}
