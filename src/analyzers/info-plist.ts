import { parsePlist, fileExists } from '../parsers/plist.js';
import type {
  Analyzer,
  AnalysisResult,
  AnalyzerOptions,
  Issue,
  XcodeProject,
  InfoPlist,
} from '../types/index.js';

/**
 * Required keys that must be present in Info.plist
 */
const REQUIRED_KEYS = [
  'CFBundleIdentifier',
  'CFBundleName',
  'CFBundleVersion',
  'CFBundleShortVersionString',
  'CFBundleExecutable',
  'CFBundlePackageType',
] as const;

/**
 * Privacy usage description keys and their purposes
 */
const PRIVACY_KEYS: Record<string, { description: string; frameworks: string[] }> = {
  NSCameraUsageDescription: {
    description: 'Camera access',
    frameworks: ['AVFoundation', 'UIImagePickerController'],
  },
  NSPhotoLibraryUsageDescription: {
    description: 'Photo library read access',
    frameworks: ['Photos', 'UIImagePickerController'],
  },
  NSPhotoLibraryAddUsageDescription: {
    description: 'Photo library write access',
    frameworks: ['Photos'],
  },
  NSMicrophoneUsageDescription: {
    description: 'Microphone access',
    frameworks: ['AVFoundation', 'AVAudioSession'],
  },
  NSLocationWhenInUseUsageDescription: {
    description: 'Location access while in use',
    frameworks: ['CoreLocation'],
  },
  NSLocationAlwaysUsageDescription: {
    description: 'Location access always',
    frameworks: ['CoreLocation'],
  },
  NSLocationAlwaysAndWhenInUseUsageDescription: {
    description: 'Location access always and when in use',
    frameworks: ['CoreLocation'],
  },
  NSContactsUsageDescription: {
    description: 'Contacts access',
    frameworks: ['Contacts', 'AddressBook'],
  },
  NSCalendarsUsageDescription: {
    description: 'Calendar access',
    frameworks: ['EventKit'],
  },
  NSRemindersUsageDescription: {
    description: 'Reminders access',
    frameworks: ['EventKit'],
  },
  NSMotionUsageDescription: {
    description: 'Motion data access',
    frameworks: ['CoreMotion'],
  },
  NSHealthShareUsageDescription: {
    description: 'HealthKit read access',
    frameworks: ['HealthKit'],
  },
  NSHealthUpdateUsageDescription: {
    description: 'HealthKit write access',
    frameworks: ['HealthKit'],
  },
  NSAppleMusicUsageDescription: {
    description: 'Apple Music access',
    frameworks: ['MediaPlayer', 'MusicKit'],
  },
  NSSpeechRecognitionUsageDescription: {
    description: 'Speech recognition',
    frameworks: ['Speech'],
  },
  NSFaceIDUsageDescription: {
    description: 'Face ID authentication',
    frameworks: ['LocalAuthentication'],
  },
  NSBluetoothAlwaysUsageDescription: {
    description: 'Bluetooth access',
    frameworks: ['CoreBluetooth'],
  },
  NSBluetoothPeripheralUsageDescription: {
    description: 'Bluetooth peripheral access',
    frameworks: ['CoreBluetooth'],
  },
  NSHomeKitUsageDescription: {
    description: 'HomeKit access',
    frameworks: ['HomeKit'],
  },
  NSSiriUsageDescription: {
    description: 'Siri integration',
    frameworks: ['Intents', 'SiriKit'],
  },
  NSUserTrackingUsageDescription: {
    description: 'App Tracking Transparency',
    frameworks: ['AppTrackingTransparency'],
  },
  NFCReaderUsageDescription: {
    description: 'NFC reader access',
    frameworks: ['CoreNFC'],
  },
};

/**
 * Analyzer for Info.plist files
 */
export class InfoPlistAnalyzer implements Analyzer {
  name = 'Info.plist Analyzer';
  description = 'Validates Info.plist for required keys and privacy descriptions';

  async analyze(project: XcodeProject, options: AnalyzerOptions): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    // Find app targets
    const targets = options.targetName
      ? project.targets.filter((t) => t.name === options.targetName)
      : project.targets.filter((t) => t.type === 'application');

    if (targets.length === 0) {
      issues.push({
        id: 'no-app-target',
        title: 'No app target found',
        description: 'Could not find an application target to analyze.',
        severity: 'error',
        category: 'info-plist',
      });

      return {
        analyzer: this.name,
        passed: false,
        issues,
        duration: Date.now() - startTime,
      };
    }

    // Analyze each target's Info.plist
    for (const target of targets) {
      if (!target.infoPlistPath) {
        issues.push({
          id: 'missing-info-plist-path',
          title: 'Info.plist path not configured',
          description: `Target "${target.name}" does not have an Info.plist path configured.`,
          severity: 'error',
          category: 'info-plist',
          suggestion: 'Configure INFOPLIST_FILE in build settings',
        });
        continue;
      }

      const plistPath = target.infoPlistPath;

      if (!(await fileExists(plistPath))) {
        issues.push({
          id: 'info-plist-not-found',
          title: 'Info.plist file not found',
          description: `Info.plist not found at ${plistPath}`,
          severity: 'error',
          filePath: plistPath,
          category: 'info-plist',
        });
        continue;
      }

      const plistIssues = await this.analyzePlistFile(plistPath);
      issues.push(...plistIssues);
    }

    return {
      analyzer: this.name,
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Analyze a specific Info.plist file
   */
  async analyzePlist(plistPath: string): Promise<AnalysisResult> {
    const startTime = Date.now();

    if (!(await fileExists(plistPath))) {
      return {
        analyzer: this.name,
        passed: false,
        issues: [
          {
            id: 'info-plist-not-found',
            title: 'Info.plist file not found',
            description: `Info.plist not found at ${plistPath}`,
            severity: 'error',
            filePath: plistPath,
            category: 'info-plist',
          },
        ],
        duration: Date.now() - startTime,
      };
    }

    const issues = await this.analyzePlistFile(plistPath);

    return {
      analyzer: this.name,
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Analyze a plist file and return issues
   */
  private async analyzePlistFile(plistPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    let plist: InfoPlist;
    try {
      plist = await parsePlist<InfoPlist>(plistPath);
    } catch (error) {
      issues.push({
        id: 'info-plist-parse-error',
        title: 'Failed to parse Info.plist',
        description: `Could not parse Info.plist: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
        filePath: plistPath,
        category: 'info-plist',
      });
      return issues;
    }

    // Check required keys
    for (const key of REQUIRED_KEYS) {
      if (!plist[key]) {
        issues.push({
          id: `missing-${key.toLowerCase()}`,
          title: `Missing required key: ${key}`,
          description: `The Info.plist is missing the required key "${key}".`,
          severity: 'error',
          filePath: plistPath,
          category: 'info-plist',
          guideline: 'Technical requirement',
          suggestion: `Add the "${key}" key to your Info.plist`,
        });
      }
    }

    // Check bundle identifier format
    if (plist.CFBundleIdentifier) {
      if (plist.CFBundleIdentifier.includes('$(')) {
        // Contains build variable, which is fine
      } else if (!/^[a-zA-Z][a-zA-Z0-9.-]*$/.test(plist.CFBundleIdentifier)) {
        issues.push({
          id: 'invalid-bundle-identifier',
          title: 'Invalid bundle identifier format',
          description: `Bundle identifier "${plist.CFBundleIdentifier}" contains invalid characters.`,
          severity: 'error',
          filePath: plistPath,
          category: 'info-plist',
          suggestion:
            'Use only alphanumeric characters, hyphens, and periods. Must start with a letter.',
        });
      }
    }

    // Check version format
    if (plist.CFBundleShortVersionString) {
      const version = plist.CFBundleShortVersionString;
      if (!/^\d+\.\d+(\.\d+)?$/.test(version) && !version.includes('$(')) {
        issues.push({
          id: 'invalid-version-format',
          title: 'Invalid version format',
          description: `Version "${version}" should follow semantic versioning (e.g., 1.0.0).`,
          severity: 'warning',
          filePath: plistPath,
          category: 'info-plist',
          suggestion: 'Use format: MAJOR.MINOR.PATCH (e.g., 1.2.3)',
        });
      }
    }

    // Check App Transport Security
    const ats = plist.NSAppTransportSecurity;
    if (ats) {
      if (ats.NSAllowsArbitraryLoads === true) {
        issues.push({
          id: 'ats-allows-arbitrary-loads',
          title: 'App Transport Security allows arbitrary loads',
          description:
            'NSAllowsArbitraryLoads is set to true, which disables ATS for all connections. This requires justification during App Store review.',
          severity: 'warning',
          filePath: plistPath,
          category: 'info-plist',
          guideline: 'Guideline 2.5.4 - Security',
          suggestion:
            'Use NSExceptionDomains for specific domains instead of disabling ATS globally.',
        });
      }
    }

    // Check for missing launch storyboard/XIB
    const hasLaunchScreen =
      plist['UILaunchStoryboardName'] ??
      plist['UILaunchScreen'] ??
      plist['UILaunchStoryboardName~ipad'];

    if (!hasLaunchScreen) {
      issues.push({
        id: 'missing-launch-screen',
        title: 'Missing launch screen',
        description: 'No launch storyboard or launch screen configuration found.',
        severity: 'warning',
        filePath: plistPath,
        category: 'info-plist',
        guideline: 'Human Interface Guidelines',
        suggestion: 'Add UILaunchStoryboardName or UILaunchScreen to your Info.plist',
      });
    }

    // Check for placeholder privacy descriptions
    for (const [key, info] of Object.entries(PRIVACY_KEYS)) {
      const value = plist[key as keyof InfoPlist];
      if (typeof value === 'string') {
        // Check for placeholder text
        if (this.isPlaceholderText(value)) {
          issues.push({
            id: `placeholder-${key.toLowerCase()}`,
            title: `Placeholder text in ${key}`,
            description: `The ${info.description} usage description appears to contain placeholder text: "${value}"`,
            severity: 'error',
            filePath: plistPath,
            category: 'info-plist',
            guideline: 'Guideline 5.1.1 - Data Collection and Storage',
            suggestion:
              'Provide a clear, user-facing explanation of why your app needs this permission.',
          });
        }

        // Check for very short descriptions
        if (value.length < 10) {
          issues.push({
            id: `short-${key.toLowerCase()}`,
            title: `Short usage description: ${key}`,
            description: `The ${info.description} usage description is very short (${value.length} characters). Apple may reject apps with vague permission descriptions.`,
            severity: 'warning',
            filePath: plistPath,
            category: 'info-plist',
            suggestion:
              'Provide a detailed explanation of why your app needs this permission and how it will be used.',
          });
        }
      }
    }

    // Check for required device capabilities that might cause issues
    const requiredCapabilities = plist['UIRequiredDeviceCapabilities'];
    if (Array.isArray(requiredCapabilities)) {
      const limitingCapabilities = ['telephony', 'sms', 'still-camera', 'auto-focus-camera'];
      for (const cap of requiredCapabilities) {
        if (limitingCapabilities.includes(cap as string)) {
          issues.push({
            id: `limiting-capability-${cap}`,
            title: `Potentially limiting device capability: ${cap}`,
            description: `UIRequiredDeviceCapabilities includes "${cap}" which limits which devices can run your app.`,
            severity: 'info',
            filePath: plistPath,
            category: 'info-plist',
            suggestion: `Verify that your app truly requires "${cap}" and cannot gracefully degrade on devices without it.`,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check if text appears to be placeholder
   */
  private isPlaceholderText(text: string): boolean {
    const placeholderPatterns = [
      /lorem\s+ipsum/i,
      /^todo/i,
      /^fixme/i,
      /^placeholder/i,
      /^your\s+(usage\s+)?description/i,
      /^add\s+description/i,
      /^enter\s+description/i,
      /^\$\(/,
      /^<.*>$/,
      /^\[.*\]$/,
    ];

    return placeholderPatterns.some((pattern) => pattern.test(text));
  }
}
