/**
 * App Store Connect In-App Purchase Analyzer
 *
 * Validates IAPs including review screenshots, localizations,
 * price points, and review status.
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
  validateAllIAPs,
  getIAPStateDescription,
  isASCError,
  type IAPValidation,
} from '../asc/index.js';

export class ASCIAPAnalyzer implements Analyzer {
  name = 'ASC IAP Analyzer';
  description = 'Validates in-app purchases in App Store Connect';

  async analyze(project: XcodeProject, options?: AnalyzerOptions): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    if (!hasCredentials()) {
      issues.push({
        id: 'asc-credentials-not-configured',
        title: 'App Store Connect credentials not configured',
        description:
          'ASC credentials are not configured. Set environment variables to enable IAP validation.',
        severity: 'info',
        category: 'iap',
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
        category: 'iap',
      });

      return {
        analyzer: this.name,
        passed: true,
        issues,
        duration: Date.now() - startTime,
      };
    }

    try {
      const iapIssues = await this.validateIAPsForBundleId(bundleId);
      issues.push(...iapIssues);
    } catch (error) {
      if (isASCError(error)) {
        issues.push({
          id: error.code,
          title: error.name,
          description: error.message,
          severity: 'error',
          category: 'iap',
        });
      } else {
        issues.push({
          id: 'asc-api-error',
          title: 'App Store Connect API Error',
          description: error instanceof Error ? error.message : String(error),
          severity: 'error',
          category: 'iap',
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
   * Validate IAPs by bundle ID
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
            category: 'iap',
          },
        ],
        duration: Date.now() - startTime,
      };
    }

    try {
      const iapIssues = await this.validateIAPsForBundleId(bundleId);
      issues.push(...iapIssues);
    } catch (error) {
      if (isASCError(error)) {
        issues.push({
          id: error.code,
          title: error.name,
          description: error.message,
          severity: 'error',
          category: 'iap',
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
   * Validate all IAPs for a bundle ID
   */
  private async validateIAPsForBundleId(bundleId: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    const app = await getAppByBundleId(bundleId);
    const validations = await validateAllIAPs(app.id);

    if (validations.length === 0) {
      issues.push({
        id: 'asc-no-iaps',
        title: 'No in-app purchases configured',
        description: 'No in-app purchases found for this app in App Store Connect.',
        severity: 'info',
        category: 'iap',
      });
      return issues;
    }

    // Check each IAP
    for (const validation of validations) {
      const iapIssues = this.convertValidationToIssues(validation);
      issues.push(...iapIssues);
    }

    // Summary stats
    const readyCount = validations.filter((v) => v.isReadyForSubmission).length;
    const notReadyCount = validations.length - readyCount;

    if (notReadyCount > 0) {
      issues.push({
        id: 'asc-iaps-not-ready',
        title: 'Some IAPs not ready for submission',
        description: `${notReadyCount} of ${validations.length} in-app purchases are not ready for submission.`,
        severity: notReadyCount === validations.length ? 'error' : 'warning',
        category: 'iap',
      });
    }

    return issues;
  }

  /**
   * Convert IAP validation result to issues
   */
  private convertValidationToIssues(validation: IAPValidation): Issue[] {
    const issues: Issue[] = [];
    const iapName = validation.iap.attributes.name;
    const productId = validation.iap.attributes.productId;
    const state = validation.iap.attributes.state;

    // Check state
    const stateDescription = getIAPStateDescription(state);

    if (state === 'MISSING_METADATA') {
      issues.push({
        id: 'asc-iap-missing-metadata',
        title: `IAP missing metadata: ${iapName}`,
        description: `In-app purchase "${productId}" is missing required metadata.`,
        severity: 'error',
        category: 'iap',
        suggestion: 'Complete all required fields in App Store Connect.',
      });
    } else if (state === 'DEVELOPER_ACTION_NEEDED') {
      issues.push({
        id: 'asc-iap-action-needed',
        title: `IAP requires action: ${iapName}`,
        description: `In-app purchase "${productId}" requires developer action. Current state: ${stateDescription}`,
        severity: 'error',
        category: 'iap',
        suggestion: 'Review the IAP in App Store Connect and address any issues.',
      });
    } else if (state === 'REJECTED') {
      issues.push({
        id: 'asc-iap-rejected',
        title: `IAP rejected: ${iapName}`,
        description: `In-app purchase "${productId}" has been rejected by App Store review.`,
        severity: 'error',
        category: 'iap',
        suggestion: 'Review the rejection reason in App Store Connect and make required changes.',
      });
    }

    // Check localizations
    if (validation.localizations.length === 0) {
      issues.push({
        id: 'asc-iap-no-localizations',
        title: `IAP has no localizations: ${iapName}`,
        description: `In-app purchase "${productId}" has no localizations configured.`,
        severity: 'error',
        category: 'iap',
      });
    } else {
      // Check each localization
      for (const loc of validation.localizations) {
        if (!loc.attributes.name) {
          issues.push({
            id: 'asc-iap-missing-name',
            title: `IAP missing name (${loc.attributes.locale})`,
            description: `In-app purchase "${productId}" is missing display name for locale ${loc.attributes.locale}.`,
            severity: 'error',
            category: 'iap',
          });
        }
        if (!loc.attributes.description) {
          issues.push({
            id: 'asc-iap-missing-description',
            title: `IAP missing description (${loc.attributes.locale})`,
            description: `In-app purchase "${productId}" is missing description for locale ${loc.attributes.locale}.`,
            severity: 'error',
            category: 'iap',
          });
        }
      }
    }

    // Check review screenshot for consumable/non-consumable
    const requiresScreenshot = ['CONSUMABLE', 'NON_CONSUMABLE'].includes(
      validation.iap.attributes.inAppPurchaseType
    );

    if (requiresScreenshot && !validation.reviewScreenshot) {
      issues.push({
        id: 'asc-iap-missing-screenshot',
        title: `IAP missing review screenshot: ${iapName}`,
        description: `In-app purchase "${productId}" requires a review screenshot for App Store review.`,
        severity: 'error',
        category: 'iap',
        guideline: 'Guideline 3.1.1 - In-App Purchase',
        suggestion: 'Upload a screenshot showing the IAP in use within your app.',
      });
    } else if (
      validation.reviewScreenshot?.attributes.assetDeliveryState?.state === 'FAILED'
    ) {
      issues.push({
        id: 'asc-iap-screenshot-failed',
        title: `IAP review screenshot failed: ${iapName}`,
        description: `Review screenshot for "${productId}" failed to process.`,
        severity: 'error',
        category: 'iap',
        suggestion: 'Re-upload the review screenshot.',
      });
    }

    return issues;
  }

  private getBundleIdFromProject(project: XcodeProject): string | undefined {
    const appTarget = project.targets.find((t) => t.type === 'application');
    return appTarget?.bundleIdentifier;
  }
}
