/**
 * App Store Connect Metadata Analyzer
 *
 * Validates app metadata from ASC including app name, subtitle,
 * description, keywords, URLs, and checks for placeholder text.
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
  getAppWithInfo,
  isASCError,
  type AppInfoLocalization,
} from '../asc/index.js';

/**
 * Metadata length limits from App Store Connect
 */
const LIMITS = {
  appName: 30,
  subtitle: 30,
  description: 4000,
  keywords: 100,
  promotionalText: 170,
  whatsNew: 4000,
};

/**
 * Placeholder text patterns
 */
const PLACEHOLDER_PATTERNS = [
  /lorem\s+ipsum/i,
  /^todo/i,
  /^fixme/i,
  /^\[.*\]$/,
  /^<.*>$/,
  /^placeholder/i,
  /your\s+(app\s+)?description/i,
  /enter\s+(your\s+)?description/i,
  /add\s+(your\s+)?description/i,
  /sample\s+text/i,
  /example\s+text/i,
  /test\s+(app|description)/i,
];

/**
 * Check if text contains placeholder content
 */
function isPlaceholder(text: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

/**
 * Validate a URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export class ASCMetadataAnalyzer implements Analyzer {
  name = 'ASC Metadata Analyzer';
  description = 'Validates app metadata in App Store Connect';

  async analyze(project: XcodeProject, options?: AnalyzerOptions): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    // Check if credentials are configured
    if (!hasCredentials()) {
      issues.push({
        id: 'asc-credentials-not-configured',
        title: 'App Store Connect credentials not configured',
        description:
          'ASC credentials are not configured. Set ASC_KEY_ID, ASC_ISSUER_ID, and ASC_PRIVATE_KEY_PATH (or ASC_PRIVATE_KEY) environment variables to enable ASC validation.',
        severity: 'info',
        category: 'metadata',
        suggestion:
          'See documentation for setting up App Store Connect API credentials.',
      });

      return {
        analyzer: this.name,
        passed: true,
        issues,
        duration: Date.now() - startTime,
      };
    }

    // Get bundle ID from project
    const bundleId = options?.bundleId ?? this.getBundleIdFromProject(project);
    if (!bundleId) {
      issues.push({
        id: 'asc-no-bundle-id',
        title: 'No bundle ID found',
        description: 'Could not determine bundle ID from project to query App Store Connect.',
        severity: 'warning',
        category: 'metadata',
      });

      return {
        analyzer: this.name,
        passed: true,
        issues,
        duration: Date.now() - startTime,
      };
    }

    try {
      const appData = await getAppWithInfo(bundleId);

      // Validate app info localizations
      for (const localization of appData.localizations) {
        const locIssues = this.validateLocalization(localization, appData.app.attributes.primaryLocale);
        issues.push(...locIssues);
      }

      // Check for missing primary locale
      const primaryLocale = appData.app.attributes.primaryLocale;
      const hasPrimaryLocale = appData.localizations.some(
        (loc) => loc.attributes.locale === primaryLocale
      );

      if (!hasPrimaryLocale && appData.localizations.length > 0) {
        issues.push({
          id: 'asc-missing-primary-locale',
          title: 'Missing primary locale metadata',
          description: `App info localization for primary locale "${primaryLocale}" not found.`,
          severity: 'warning',
          category: 'metadata',
        });
      }
    } catch (error) {
      if (isASCError(error)) {
        issues.push({
          id: error.code,
          title: error.name,
          description: error.message,
          severity: 'error',
          category: 'metadata',
        });
      } else {
        issues.push({
          id: 'asc-api-error',
          title: 'App Store Connect API Error',
          description: error instanceof Error ? error.message : String(error),
          severity: 'error',
          category: 'metadata',
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
   * Validate a single localization
   */
  private validateLocalization(localization: AppInfoLocalization, primaryLocale: string): Issue[] {
    const issues: Issue[] = [];
    const locale = localization.attributes.locale;
    const isPrimary = locale === primaryLocale;

    // Validate app name
    const name = localization.attributes.name;
    if (name) {
      if (name.length > LIMITS.appName) {
        issues.push({
          id: 'asc-name-too-long',
          title: `App name too long (${locale})`,
          description: `App name is ${name.length} characters, maximum is ${LIMITS.appName}.`,
          severity: 'error',
          category: 'metadata',
          suggestion: `Shorten the app name to ${LIMITS.appName} characters or less.`,
        });
      }

      if (isPlaceholder(name)) {
        issues.push({
          id: 'asc-name-placeholder',
          title: `Placeholder app name detected (${locale})`,
          description: `App name "${name}" appears to be placeholder text.`,
          severity: 'error',
          category: 'metadata',
          guideline: 'Guideline 2.3.7 - Accurate Metadata',
        });
      }
    } else if (isPrimary) {
      issues.push({
        id: 'asc-missing-name',
        title: 'Missing app name',
        description: `App name is not set for primary locale "${locale}".`,
        severity: 'error',
        category: 'metadata',
      });
    }

    // Validate subtitle
    const subtitle = localization.attributes.subtitle;
    if (subtitle) {
      if (subtitle.length > LIMITS.subtitle) {
        issues.push({
          id: 'asc-subtitle-too-long',
          title: `Subtitle too long (${locale})`,
          description: `Subtitle is ${subtitle.length} characters, maximum is ${LIMITS.subtitle}.`,
          severity: 'error',
          category: 'metadata',
        });
      }

      if (isPlaceholder(subtitle)) {
        issues.push({
          id: 'asc-subtitle-placeholder',
          title: `Placeholder subtitle detected (${locale})`,
          description: `Subtitle "${subtitle}" appears to be placeholder text.`,
          severity: 'error',
          category: 'metadata',
        });
      }
    }

    // Validate privacy policy URL
    const privacyUrl = localization.attributes.privacyPolicyUrl;
    if (!privacyUrl && isPrimary) {
      issues.push({
        id: 'asc-missing-privacy-policy',
        title: 'Missing privacy policy URL',
        description: 'Privacy policy URL is required for App Store submission.',
        severity: 'error',
        category: 'metadata',
        guideline: 'Guideline 5.1.1 - Data Collection and Storage',
        suggestion: 'Add a privacy policy URL to your app metadata.',
      });
    } else if (privacyUrl && !isValidUrl(privacyUrl)) {
      issues.push({
        id: 'asc-invalid-privacy-url',
        title: `Invalid privacy policy URL (${locale})`,
        description: `Privacy policy URL "${privacyUrl}" is not a valid URL.`,
        severity: 'error',
        category: 'metadata',
      });
    }

    return issues;
  }

  /**
   * Standalone metadata validation by bundle ID
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
            description:
              'Set ASC_KEY_ID, ASC_ISSUER_ID, and ASC_PRIVATE_KEY_PATH environment variables.',
            severity: 'error',
            category: 'metadata',
          },
        ],
        duration: Date.now() - startTime,
      };
    }

    try {
      const appData = await getAppWithInfo(bundleId);

      for (const localization of appData.localizations) {
        const locIssues = this.validateLocalization(
          localization,
          appData.app.attributes.primaryLocale
        );
        issues.push(...locIssues);
      }
    } catch (error) {
      if (isASCError(error)) {
        issues.push({
          id: error.code,
          title: error.name,
          description: error.message,
          severity: 'error',
          category: 'metadata',
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
   * Get bundle ID from project targets
   */
  private getBundleIdFromProject(project: XcodeProject): string | undefined {
    const appTarget = project.targets.find((t) => t.type === 'application');
    return appTarget?.bundleIdentifier;
  }
}
