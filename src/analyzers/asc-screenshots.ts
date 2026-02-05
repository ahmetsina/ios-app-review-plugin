/**
 * App Store Connect Screenshot Analyzer
 *
 * Validates screenshots in ASC including required device sizes,
 * screenshot counts, processing status, and localized presence.
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
  getEditableVersion,
  getVersionLocalizations,
  getScreenshotSetsWithScreenshots,
  REQUIRED_IPHONE_DISPLAY_TYPES,
  REQUIRED_IPAD_DISPLAY_TYPES,
  getDisplayTypeDescription,
  validateScreenshotSet,
  isASCError,
  type ScreenshotDisplayType,
  type AppStoreVersionLocalization,
} from '../asc/index.js';

/**
 * Screenshot requirements
 */
const MAX_SCREENSHOTS = 10;

export class ASCScreenshotAnalyzer implements Analyzer {
  name = 'ASC Screenshot Analyzer';
  description = 'Validates screenshots in App Store Connect';

  async analyze(project: XcodeProject, options?: AnalyzerOptions): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    if (!hasCredentials()) {
      issues.push({
        id: 'asc-credentials-not-configured',
        title: 'App Store Connect credentials not configured',
        description:
          'ASC credentials are not configured. Set environment variables to enable screenshot validation.',
        severity: 'info',
        category: 'screenshots',
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
        category: 'screenshots',
      });

      return {
        analyzer: this.name,
        passed: true,
        issues,
        duration: Date.now() - startTime,
      };
    }

    try {
      const screenshotIssues = await this.validateScreenshotsForBundleId(bundleId);
      issues.push(...screenshotIssues);
    } catch (error) {
      if (isASCError(error)) {
        issues.push({
          id: error.code,
          title: error.name,
          description: error.message,
          severity: 'error',
          category: 'screenshots',
        });
      } else {
        issues.push({
          id: 'asc-api-error',
          title: 'App Store Connect API Error',
          description: error instanceof Error ? error.message : String(error),
          severity: 'error',
          category: 'screenshots',
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
   * Validate screenshots for a bundle ID
   */
  async validateByBundleId(bundleId: string): Promise<AnalysisResult> {
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
            category: 'screenshots',
          },
        ],
        duration: Date.now() - startTime,
      };
    }

    try {
      const screenshotIssues = await this.validateScreenshotsForBundleId(bundleId);
      issues.push(...screenshotIssues);
    } catch (error) {
      if (isASCError(error)) {
        issues.push({
          id: error.code,
          title: error.name,
          description: error.message,
          severity: 'error',
          category: 'screenshots',
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
   * Internal screenshot validation
   */
  private async validateScreenshotsForBundleId(bundleId: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    const app = await getAppByBundleId(bundleId);
    const version = await getEditableVersion(app.id);

    if (!version) {
      issues.push({
        id: 'asc-no-editable-version',
        title: 'No editable version found',
        description:
          'No app version in editable state (PREPARE_FOR_SUBMISSION, etc.) found in App Store Connect.',
        severity: 'info',
        category: 'screenshots',
      });
      return issues;
    }

    const localizations = await getVersionLocalizations(version.id);

    if (localizations.length === 0) {
      issues.push({
        id: 'asc-no-localizations',
        title: 'No version localizations found',
        description: 'No localizations configured for the current app version.',
        severity: 'warning',
        category: 'screenshots',
      });
      return issues;
    }

    // Check each localization
    for (const localization of localizations) {
      const locIssues = await this.validateLocalizationScreenshots(localization);
      issues.push(...locIssues);
    }

    return issues;
  }

  /**
   * Validate screenshots for a single localization
   */
  private async validateLocalizationScreenshots(
    localization: AppStoreVersionLocalization
  ): Promise<Issue[]> {
    const issues: Issue[] = [];
    const locale = localization.attributes.locale;

    const screenshotSets = await getScreenshotSetsWithScreenshots(localization.id);

    // Track which required types are present
    const presentTypes = new Set<ScreenshotDisplayType>(
      screenshotSets.map((s) => s.set.attributes.screenshotDisplayType)
    );

    // Check required iPhone sizes
    const missingIPhoneTypes = REQUIRED_IPHONE_DISPLAY_TYPES.filter(
      (type) => !presentTypes.has(type)
    );

    if (missingIPhoneTypes.length > 0) {
      // At least one iPhone size is required
      const hasAnyIPhoneScreenshots = REQUIRED_IPHONE_DISPLAY_TYPES.some((type) =>
        presentTypes.has(type)
      );

      if (!hasAnyIPhoneScreenshots) {
        issues.push({
          id: 'asc-missing-iphone-screenshots',
          title: `Missing iPhone screenshots (${locale})`,
          description: `No iPhone screenshots found. At least one of these sizes is required: ${missingIPhoneTypes.map(getDisplayTypeDescription).join(', ')}`,
          severity: 'error',
          category: 'screenshots',
          suggestion: 'Upload screenshots for at least iPhone 6.5" or 5.5" display.',
        });
      } else {
        issues.push({
          id: 'asc-incomplete-iphone-screenshots',
          title: `Incomplete iPhone screenshot sizes (${locale})`,
          description: `Missing screenshots for: ${missingIPhoneTypes.map(getDisplayTypeDescription).join(', ')}`,
          severity: 'warning',
          category: 'screenshots',
        });
      }
    }

    // Check iPad sizes if app supports iPad
    const missingIPadTypes = REQUIRED_IPAD_DISPLAY_TYPES.filter(
      (type) => !presentTypes.has(type)
    );

    if (missingIPadTypes.length === REQUIRED_IPAD_DISPLAY_TYPES.length) {
      // No iPad screenshots - this might be intentional if app is iPhone-only
      issues.push({
        id: 'asc-no-ipad-screenshots',
        title: `No iPad screenshots (${locale})`,
        description:
          'No iPad screenshots found. If your app supports iPad, screenshots are required for iPad Pro 12.9".',
        severity: 'info',
        category: 'screenshots',
      });
    }

    // Validate each screenshot set
    for (const { set, screenshots } of screenshotSets) {
      const validation = validateScreenshotSet(set, screenshots);

      // Check count
      if (screenshots.length === 0) {
        issues.push({
          id: 'asc-empty-screenshot-set',
          title: `Empty screenshot set (${locale})`,
          description: `Screenshot set for ${getDisplayTypeDescription(set.attributes.screenshotDisplayType)} has no screenshots.`,
          severity: 'warning',
          category: 'screenshots',
        });
      } else if (screenshots.length > MAX_SCREENSHOTS) {
        issues.push({
          id: 'asc-too-many-screenshots',
          title: `Too many screenshots (${locale})`,
          description: `Screenshot set for ${getDisplayTypeDescription(set.attributes.screenshotDisplayType)} has ${screenshots.length} screenshots (max ${MAX_SCREENSHOTS}).`,
          severity: 'error',
          category: 'screenshots',
        });
      }

      // Check processing errors
      if (validation.hasProcessingErrors) {
        for (const issue of validation.issues) {
          issues.push({
            id: 'asc-screenshot-processing-error',
            title: `Screenshot processing error (${locale})`,
            description: issue,
            severity: 'error',
            category: 'screenshots',
          });
        }
      }
    }

    return issues;
  }

  private getBundleIdFromProject(project: XcodeProject): string | undefined {
    const appTarget = project.targets.find((t) => t.type === 'application');
    return appTarget?.bundleIdentifier;
  }
}
