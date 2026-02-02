import { parsePlist, fileExists } from '../parsers/plist.js';
import type {
  Analyzer,
  AnalysisResult,
  AnalyzerOptions,
  Issue,
  XcodeProject,
} from '../types/index.js';

/**
 * Known entitlement keys and their purposes
 */
const ENTITLEMENT_INFO: Record<
  string,
  {
    description: string;
    debugOnly?: boolean;
    requiresCapability?: string;
  }
> = {
  'com.apple.developer.team-identifier': {
    description: 'Team identifier',
  },
  'application-identifier': {
    description: 'Application identifier',
  },
  'keychain-access-groups': {
    description: 'Keychain sharing',
    requiresCapability: 'Keychain Sharing',
  },
  'com.apple.security.application-groups': {
    description: 'App Groups',
    requiresCapability: 'App Groups',
  },
  'com.apple.developer.associated-domains': {
    description: 'Associated Domains',
    requiresCapability: 'Associated Domains',
  },
  'aps-environment': {
    description: 'Push Notifications',
    requiresCapability: 'Push Notifications',
  },
  'com.apple.developer.icloud-container-identifiers': {
    description: 'iCloud Containers',
    requiresCapability: 'iCloud',
  },
  'com.apple.developer.icloud-services': {
    description: 'iCloud Services',
    requiresCapability: 'iCloud',
  },
  'com.apple.developer.ubiquity-kvstore-identifier': {
    description: 'iCloud Key-Value Store',
    requiresCapability: 'iCloud',
  },
  'com.apple.developer.healthkit': {
    description: 'HealthKit',
    requiresCapability: 'HealthKit',
  },
  'com.apple.developer.homekit': {
    description: 'HomeKit',
    requiresCapability: 'HomeKit',
  },
  'com.apple.developer.in-app-payments': {
    description: 'Apple Pay',
    requiresCapability: 'Apple Pay',
  },
  'com.apple.developer.nfc.readersession.formats': {
    description: 'NFC Tag Reading',
    requiresCapability: 'Near Field Communication Tag Reading',
  },
  'com.apple.developer.siri': {
    description: 'Siri',
    requiresCapability: 'Siri',
  },
  'com.apple.developer.networking.wifi-info': {
    description: 'Access WiFi Information',
    requiresCapability: 'Access WiFi Information',
  },
  'com.apple.developer.networking.HotspotHelper': {
    description: 'Hotspot Helper',
    requiresCapability: 'Hotspot',
  },
  'com.apple.developer.networking.multipath': {
    description: 'Multipath Networking',
    requiresCapability: 'Multipath',
  },
  'com.apple.developer.networking.vpn.api': {
    description: 'Personal VPN',
    requiresCapability: 'Personal VPN',
  },
  'get-task-allow': {
    description: 'Debugging (get-task-allow)',
    debugOnly: true,
  },
  'com.apple.developer.kernel.increased-memory-limit': {
    description: 'Increased Memory Limit',
  },
  'com.apple.developer.kernel.extended-virtual-addressing': {
    description: 'Extended Virtual Addressing',
  },
  'com.apple.external-accessory.wireless-configuration': {
    description: 'Wireless Accessory Configuration',
    requiresCapability: 'Wireless Accessory Configuration',
  },
  'inter-app-audio': {
    description: 'Inter-App Audio',
    requiresCapability: 'Inter-App Audio',
  },
  'com.apple.developer.applesignin': {
    description: 'Sign in with Apple',
    requiresCapability: 'Sign in with Apple',
  },
};

/**
 * Entitlements file analyzer
 */
export class EntitlementsAnalyzer implements Analyzer {
  name = 'Entitlements Analyzer';
  description = 'Validates entitlements against capabilities and detects misconfigurations';

  async analyze(project: XcodeProject, options: AnalyzerOptions): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    // Find app targets
    const targets = options.targetName
      ? project.targets.filter((t) => t.name === options.targetName)
      : project.targets.filter((t) => t.type === 'application');

    for (const target of targets) {
      if (!target.entitlementsPath) {
        // Entitlements are optional - only warn if the target seems to need them
        issues.push({
          id: 'no-entitlements-file',
          title: 'No entitlements file configured',
          description: `Target "${target.name}" does not have an entitlements file. This is fine if you don't use any capabilities requiring entitlements.`,
          severity: 'info',
          category: 'entitlements',
        });
        continue;
      }

      const entitlementsPath = target.entitlementsPath;

      if (!(await fileExists(entitlementsPath))) {
        issues.push({
          id: 'entitlements-not-found',
          title: 'Entitlements file not found',
          description: `Entitlements file not found at configured path: ${entitlementsPath}`,
          severity: 'error',
          filePath: entitlementsPath,
          category: 'entitlements',
          suggestion: 'Create the entitlements file or update CODE_SIGN_ENTITLEMENTS in build settings.',
        });
        continue;
      }

      const entitlementIssues = await this.analyzeEntitlementsFile(entitlementsPath);
      issues.push(...entitlementIssues);
    }

    return {
      analyzer: this.name,
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Analyze a specific entitlements file
   */
  async analyzeEntitlementsFile(entitlementsPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    let entitlements: Record<string, unknown>;
    try {
      entitlements = await parsePlist<Record<string, unknown>>(entitlementsPath);
    } catch (error) {
      issues.push({
        id: 'entitlements-parse-error',
        title: 'Failed to parse entitlements',
        description: `Could not parse entitlements file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
        filePath: entitlementsPath,
        category: 'entitlements',
      });
      return issues;
    }

    // Check for debug-only entitlements
    for (const [key, info] of Object.entries(ENTITLEMENT_INFO)) {
      if (info.debugOnly && key in entitlements) {
        const value = entitlements[key];
        if (value === true) {
          issues.push({
            id: `debug-entitlement-${key}`,
            title: `Debug entitlement present: ${key}`,
            description: `The entitlement "${key}" (${info.description}) should not be present in release builds. This is typically handled by the signing process but verify your release configuration.`,
            severity: 'warning',
            filePath: entitlementsPath,
            category: 'entitlements',
            suggestion:
              'Ensure you have separate entitlements files for Debug and Release, or verify your build configuration handles this automatically.',
          });
        }
      }
    }

    // Check aps-environment for push notifications
    if ('aps-environment' in entitlements) {
      const apsEnv = entitlements['aps-environment'];
      if (apsEnv !== 'development' && apsEnv !== 'production') {
        issues.push({
          id: 'invalid-aps-environment',
          title: 'Invalid push notification environment',
          description: `aps-environment is set to "${apsEnv}" but must be either "development" or "production".`,
          severity: 'error',
          filePath: entitlementsPath,
          category: 'entitlements',
          suggestion: 'Set aps-environment to "development" or "production".',
        });
      }
    }

    // Check App Groups format
    const appGroups = entitlements['com.apple.security.application-groups'];
    if (Array.isArray(appGroups)) {
      for (const group of appGroups) {
        if (typeof group === 'string') {
          if (!group.startsWith('group.')) {
            issues.push({
              id: 'invalid-app-group-format',
              title: 'Invalid App Group identifier format',
              description: `App Group "${group}" should start with "group."`,
              severity: 'error',
              filePath: entitlementsPath,
              category: 'entitlements',
              suggestion: 'App Group identifiers must start with "group." prefix.',
            });
          }
        }
      }
    }

    // Check Associated Domains format
    const associatedDomains = entitlements['com.apple.developer.associated-domains'];
    if (Array.isArray(associatedDomains)) {
      for (const domain of associatedDomains) {
        if (typeof domain === 'string') {
          // Valid formats: applinks:example.com, webcredentials:example.com, activitycontinuation:example.com
          if (!/^(applinks|webcredentials|activitycontinuation|appclips):/.test(domain)) {
            issues.push({
              id: 'invalid-associated-domain-format',
              title: 'Invalid Associated Domain format',
              description: `Associated Domain "${domain}" has an invalid format.`,
              severity: 'error',
              filePath: entitlementsPath,
              category: 'entitlements',
              suggestion:
                'Use format: applinks:example.com, webcredentials:example.com, or activitycontinuation:example.com',
            });
          }
        }
      }
    }

    // Check Keychain Access Groups format
    const keychainGroups = entitlements['keychain-access-groups'];
    if (Array.isArray(keychainGroups)) {
      for (const group of keychainGroups) {
        if (typeof group === 'string') {
          // Should contain team ID prefix or $(AppIdentifierPrefix)
          if (!group.includes('.') && !group.includes('$(')) {
            issues.push({
              id: 'invalid-keychain-group-format',
              title: 'Invalid Keychain Access Group format',
              description: `Keychain Access Group "${group}" appears to be missing the team ID prefix.`,
              severity: 'warning',
              filePath: entitlementsPath,
              category: 'entitlements',
              suggestion:
                'Keychain groups should be prefixed with $(AppIdentifierPrefix) or your team ID.',
            });
          }
        }
      }
    }

    // Check iCloud container identifiers
    const icloudContainers = entitlements['com.apple.developer.icloud-container-identifiers'];
    if (Array.isArray(icloudContainers)) {
      for (const container of icloudContainers) {
        if (typeof container === 'string') {
          if (!container.startsWith('iCloud.')) {
            issues.push({
              id: 'invalid-icloud-container-format',
              title: 'Invalid iCloud container identifier format',
              description: `iCloud container "${container}" should start with "iCloud."`,
              severity: 'error',
              filePath: entitlementsPath,
              category: 'entitlements',
              suggestion: 'iCloud container identifiers must start with "iCloud." prefix.',
            });
          }
        }
      }
    }

    // Check Sign in with Apple configuration
    const signInWithApple = entitlements['com.apple.developer.applesignin'];
    if (Array.isArray(signInWithApple)) {
      if (!signInWithApple.includes('Default')) {
        issues.push({
          id: 'siwa-missing-default',
          title: 'Sign in with Apple missing Default capability',
          description: 'Sign in with Apple entitlement should include "Default" in the array.',
          severity: 'warning',
          filePath: entitlementsPath,
          category: 'entitlements',
          suggestion: 'Add "Default" to the com.apple.developer.applesignin array.',
        });
      }
    }

    // Report all declared entitlements for informational purposes
    const declaredEntitlements = Object.keys(entitlements).filter(
      (key) => key !== 'application-identifier' && key !== 'com.apple.developer.team-identifier'
    );

    if (declaredEntitlements.length > 0) {
      issues.push({
        id: 'entitlements-summary',
        title: 'Declared entitlements',
        description: `This target uses the following entitlements: ${declaredEntitlements.join(', ')}. Ensure all corresponding capabilities are enabled in App Store Connect.`,
        severity: 'info',
        filePath: entitlementsPath,
        category: 'entitlements',
      });
    }

    return issues;
  }
}
