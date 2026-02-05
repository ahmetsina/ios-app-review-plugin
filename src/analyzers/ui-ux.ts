import * as fs from 'fs/promises';
import * as path from 'path';
import fg from 'fast-glob';
import { parsePlist } from '../parsers/plist.js';
import type {
  Analyzer,
  AnalysisResult,
  AnalyzerOptions,
  Issue,
  XcodeProject,
} from '../types/index.js';

/**
 * Required App Store icon size (1024x1024)
 */
const APP_STORE_ICON_SIZE = '1024x1024';

/**
 * Required iPhone icon sizes (points, with scales)
 */
const REQUIRED_IPHONE_ICONS = [
  { size: '20x20', scales: ['2x', '3x'] },
  { size: '29x29', scales: ['2x', '3x'] },
  { size: '38x38', scales: ['2x', '3x'] },
  { size: '40x40', scales: ['2x', '3x'] },
  { size: '60x60', scales: ['2x', '3x'] },
];

/**
 * Required iPad icon sizes
 */
const REQUIRED_IPAD_ICONS = [
  { size: '20x20', scales: ['1x', '2x'] },
  { size: '29x29', scales: ['1x', '2x'] },
  { size: '40x40', scales: ['1x', '2x'] },
  { size: '76x76', scales: ['1x', '2x'] },
  { size: '83.5x83.5', scales: ['2x'] },
];

/**
 * All four iPad orientations required
 */
const IPAD_ORIENTATIONS = [
  'UIInterfaceOrientationPortrait',
  'UIInterfaceOrientationPortraitUpsideDown',
  'UIInterfaceOrientationLandscapeLeft',
  'UIInterfaceOrientationLandscapeRight',
];

/**
 * Placeholder text patterns to detect in storyboard/xib files
 */
const PLACEHOLDER_PATTERNS = [
  /\blorem\s+ipsum\b/gi,
  /\bplaceholder\b/gi,
  /\bsample\s+text\b/gi,
  /\bdummy\s+text\b/gi,
  /text="Label"\s/g,
  /title="Button"\s/g,
  /text="Title"\s/g,
  /text="Subtitle"\s/g,
  /text="Description"\s/g,
];

interface AppIconContentsImage {
  size?: string;
  scale?: string;
  filename?: string;
  idiom?: string;
  platform?: string;
}

/**
 * UI/UX Compliance analyzer
 */
export class UIUXAnalyzer implements Analyzer {
  name = 'UI/UX Compliance';
  description = 'Checks UI/UX requirements for App Store compliance';

  async analyze(project: XcodeProject, options: AnalyzerOptions): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    const targets = options.targetName
      ? project.targets.filter((t) => t.name === options.targetName)
      : project.targets.filter((t) => t.type === 'application');

    const target = targets[0];
    if (!target) {
      return {
        analyzer: this.name,
        passed: true,
        issues: [{
          id: 'uiux-no-target',
          title: 'No app target found',
          description: 'Could not find an application target to analyze.',
          severity: 'info',
          category: 'ui-ux',
        }],
        duration: Date.now() - startTime,
      };
    }

    const basePath = options.basePath;

    // Check launch screen
    await this.checkLaunchScreen(basePath, target.infoPlistPath, issues);

    // Check app icons
    await this.checkAppIcons(basePath, issues);

    // Check iPad support
    await this.checkIPadSupport(basePath, target.infoPlistPath, issues);

    // Check for placeholder text in storyboards/xibs
    await this.checkPlaceholderText(basePath, issues);

    // Check accessibility basics
    await this.checkAccessibility(basePath, issues);

    return {
      analyzer: this.name,
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Validate project from a direct path
   */
  async validateProject(projectPath: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    const basePath = projectPath.endsWith('.xcodeproj') || projectPath.endsWith('.xcworkspace')
      ? path.dirname(projectPath)
      : projectPath;

    // Find Info.plist
    const plistFiles = await fg(['**/Info.plist'], {
      cwd: basePath,
      absolute: true,
      ignore: ['**/Pods/**', '**/build/**', '**/DerivedData/**', '**/Tests/**'],
    });
    const infoPlistPath = plistFiles[0];

    await this.checkLaunchScreen(basePath, infoPlistPath, issues);
    await this.checkAppIcons(basePath, issues);
    await this.checkIPadSupport(basePath, infoPlistPath, issues);
    await this.checkPlaceholderText(basePath, issues);
    await this.checkAccessibility(basePath, issues);

    return {
      analyzer: this.name,
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check for launch screen configuration
   */
  private async checkLaunchScreen(
    basePath: string,
    infoPlistPath: string | undefined,
    issues: Issue[]
  ): Promise<void> {
    let hasLaunchScreen = false;

    // Check Info.plist for UILaunchStoryboardName
    if (infoPlistPath) {
      try {
        const plistPath = path.isAbsolute(infoPlistPath)
          ? infoPlistPath
          : path.join(basePath, infoPlistPath);
        const plist = await parsePlist(plistPath);
        if (plist['UILaunchStoryboardName']) {
          hasLaunchScreen = true;
        }
      } catch {
        // Plist read failed, check for files instead
      }
    }

    // Check for LaunchScreen storyboard file
    if (!hasLaunchScreen) {
      const launchScreenFiles = await fg(
        ['**/LaunchScreen.storyboard', '**/Launch Screen.storyboard', '**/LaunchScreen.xib'],
        { cwd: basePath, absolute: true }
      );
      if (launchScreenFiles.length > 0) {
        hasLaunchScreen = true;
      }
    }

    if (!hasLaunchScreen) {
      issues.push({
        id: 'uiux-no-launch-screen',
        title: 'Missing launch screen',
        description:
          'No launch screen storyboard found. Apps must include a launch screen storyboard.',
        severity: 'error',
        category: 'ui-ux',
        guideline: 'Guideline 4.6 - Launch Screen',
        suggestion:
          'Add a LaunchScreen.storyboard and set UILaunchStoryboardName in Info.plist.',
      });
    }
  }

  /**
   * Check app icon configuration
   */
  private async checkAppIcons(basePath: string, issues: Issue[]): Promise<void> {
    // Find AppIcon asset catalog
    const iconSets = await fg(['**/AppIcon.appiconset/Contents.json'], {
      cwd: basePath,
      absolute: true,
      ignore: ['**/Pods/**', '**/build/**', '**/DerivedData/**'],
    });

    if (iconSets.length === 0) {
      issues.push({
        id: 'uiux-no-app-icon',
        title: 'Missing app icon asset catalog',
        description:
          'No AppIcon.appiconset found. Apps must include an app icon in an asset catalog.',
        severity: 'error',
        category: 'ui-ux',
        guideline: 'Guideline 4.0 - App Icons',
        suggestion:
          'Add AppIcon.appiconset to your Assets.xcassets with all required icon sizes.',
      });
      return;
    }

    try {
      const contentsJson = await fs.readFile(iconSets[0]!, 'utf-8');
      const contents = JSON.parse(contentsJson) as { images?: AppIconContentsImage[] };
      const images = contents.images ?? [];

      // Check for 1024x1024 App Store icon
      const hasAppStoreIcon = images.some(
        (img) =>
          img.size === APP_STORE_ICON_SIZE &&
          img.filename
      );

      if (!hasAppStoreIcon) {
        issues.push({
          id: 'uiux-missing-appstore-icon',
          title: 'Missing App Store icon (1024x1024)',
          description:
            'The 1024x1024 App Store icon is required for submission.',
          severity: 'error',
          filePath: iconSets[0],
          category: 'ui-ux',
          guideline: 'Guideline 4.0 - App Icons',
          suggestion:
            'Add a 1024x1024 PNG icon to your AppIcon asset catalog.',
        });
      }

      // Check for missing iPhone icons
      for (const required of REQUIRED_IPHONE_ICONS) {
        for (const scale of required.scales) {
          const hasIcon = images.some(
            (img) =>
              img.size === required.size &&
              img.scale === scale &&
              img.filename &&
              (img.idiom === 'iphone' || img.idiom === 'universal')
          );
          if (!hasIcon) {
            issues.push({
              id: 'uiux-missing-iphone-icon',
              title: `Missing iPhone icon: ${required.size}@${scale}`,
              description: `iPhone icon size ${required.size} at ${scale} is not configured.`,
              severity: 'warning',
              filePath: iconSets[0],
              category: 'ui-ux',
              suggestion: `Add ${required.size}@${scale} icon to your AppIcon asset catalog.`,
            });
          }
        }
      }
    } catch {
      issues.push({
        id: 'uiux-invalid-icon-contents',
        title: 'Invalid AppIcon Contents.json',
        description: 'Could not parse the AppIcon.appiconset/Contents.json file.',
        severity: 'warning',
        filePath: iconSets[0],
        category: 'ui-ux',
        suggestion: 'Regenerate the asset catalog through Xcode.',
      });
    }
  }

  /**
   * Check iPad support requirements
   */
  private async checkIPadSupport(
    basePath: string,
    infoPlistPath: string | undefined,
    issues: Issue[]
  ): Promise<void> {
    if (!infoPlistPath) return;

    try {
      const plistPath = path.isAbsolute(infoPlistPath)
        ? infoPlistPath
        : path.join(basePath, infoPlistPath);
      const plist = await parsePlist(plistPath);

      // Check if app supports iPad
      const deviceFamily = plist['UIDeviceFamily'] as number[] | undefined;
      const supportsIPad = deviceFamily?.includes(2);

      if (!supportsIPad) return;

      // iPad apps must support all 4 orientations
      const ipadOrientations =
        (plist['UISupportedInterfaceOrientations~ipad'] as string[]) ??
        (plist['UISupportedInterfaceOrientations'] as string[]) ??
        [];

      const missingOrientations = IPAD_ORIENTATIONS.filter(
        (o) => !ipadOrientations.includes(o)
      );

      if (missingOrientations.length > 0) {
        issues.push({
          id: 'uiux-ipad-missing-orientations',
          title: 'iPad missing required orientations',
          description: `iPad apps must support all 4 interface orientations. Missing: ${missingOrientations.join(', ')}`,
          severity: 'error',
          filePath: plistPath,
          category: 'ui-ux',
          guideline: 'Guideline 2.4.1 - Hardware Compatibility',
          suggestion:
            'Add all 4 UISupportedInterfaceOrientations for iPad in Info.plist.',
        });
      }

      // Check for iPad icon sizes
      const iconSets = await fg(['**/AppIcon.appiconset/Contents.json'], {
        cwd: basePath,
        absolute: true,
        ignore: ['**/Pods/**', '**/build/**', '**/DerivedData/**'],
      });

      if (iconSets.length > 0) {
        try {
          const contentsJson = await fs.readFile(iconSets[0]!, 'utf-8');
          const contents = JSON.parse(contentsJson) as { images?: AppIconContentsImage[] };
          const images = contents.images ?? [];

          for (const required of REQUIRED_IPAD_ICONS) {
            for (const scale of required.scales) {
              const hasIcon = images.some(
                (img) =>
                  img.size === required.size &&
                  img.scale === scale &&
                  img.filename &&
                  (img.idiom === 'ipad' || img.idiom === 'universal')
              );
              if (!hasIcon) {
                issues.push({
                  id: 'uiux-missing-ipad-icon',
                  title: `Missing iPad icon: ${required.size}@${scale}`,
                  description: `iPad icon size ${required.size} at ${scale} is not configured.`,
                  severity: 'warning',
                  filePath: iconSets[0],
                  category: 'ui-ux',
                  suggestion: `Add ${required.size}@${scale} iPad icon to your AppIcon asset catalog.`,
                });
              }
            }
          }
        } catch {
          // Already handled above
        }
      }
    } catch {
      // Plist read failed
    }
  }

  /**
   * Check for placeholder text in storyboard/xib files
   */
  private async checkPlaceholderText(basePath: string, issues: Issue[]): Promise<void> {
    const storyboardFiles = await fg(['**/*.storyboard', '**/*.xib'], {
      cwd: basePath,
      absolute: true,
      ignore: ['**/Pods/**', '**/build/**', '**/DerivedData/**', '**/LaunchScreen.storyboard'],
    });

    for (const file of storyboardFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        for (const pattern of PLACEHOLDER_PATTERNS) {
          pattern.lastIndex = 0;

          let match: RegExpExecArray | null;
          while ((match = pattern.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;

            issues.push({
              id: 'uiux-placeholder-text',
              title: 'Placeholder text in UI',
              description: `Placeholder or default text detected in storyboard/xib.\n\nFound: \`${match[0].trim()}\``,
              severity: 'warning',
              filePath: file,
              lineNumber,
              category: 'ui-ux',
              guideline: 'Guideline 2.3 - Accurate Metadata',
              suggestion: 'Replace placeholder text with actual content before submission.',
            });

            // Limit per pattern per file
            const count = issues.filter(
              (i) => i.id === 'uiux-placeholder-text' && i.filePath === file
            ).length;
            if (count >= 5) break;
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }
  }

  /**
   * Check basic accessibility support
   */
  private async checkAccessibility(basePath: string, issues: Issue[]): Promise<void> {
    const sourceFiles = await fg(['**/*.swift'], {
      cwd: basePath,
      absolute: true,
      ignore: [
        '**/Pods/**',
        '**/Carthage/**',
        '**/build/**',
        '**/DerivedData/**',
        '**/Tests/**',
        '**/UITests/**',
      ],
    });

    let hasImages = false;
    let hasAccessibilityLabels = false;
    let hasDynamicType = false;
    let hasHardcodedFontSizes = false;

    for (const file of sourceFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        if (/UIImage\(|UIImageView\(|Image\(/.test(content)) {
          hasImages = true;
        }
        if (/accessibilityLabel|\.accessibility\(label:|isAccessibilityElement/.test(content)) {
          hasAccessibilityLabels = true;
        }
        if (/UIFont\.TextStyle|\.preferredFont|UIFontMetrics|\.dynamicTypeSize/.test(content)) {
          hasDynamicType = true;
        }
        if (/UIFont\.systemFont\(ofSize:\s*\d|UIFont\(name:.+size:\s*\d/.test(content)) {
          hasHardcodedFontSizes = true;
        }
      } catch {
        // Skip
      }
    }

    if (hasImages && !hasAccessibilityLabels) {
      issues.push({
        id: 'uiux-no-accessibility-labels',
        title: 'No accessibility labels found',
        description:
          'The app uses images but no accessibility labels were detected. Screen readers need labels to describe UI elements.',
        severity: 'warning',
        category: 'ui-ux',
        guideline: 'Guideline 2.5.1 - Accessibility',
        suggestion:
          'Add accessibilityLabel to images and interactive elements for VoiceOver support.',
      });
    }

    if (hasHardcodedFontSizes && !hasDynamicType) {
      issues.push({
        id: 'uiux-no-dynamic-type',
        title: 'No Dynamic Type support detected',
        description:
          'The app uses hardcoded font sizes but no Dynamic Type support was found. Users with accessibility needs rely on Dynamic Type.',
        severity: 'info',
        category: 'ui-ux',
        guideline: 'Guideline 2.5.1 - Accessibility',
        suggestion:
          'Use UIFont.preferredFont(forTextStyle:) or UIFontMetrics to support Dynamic Type.',
      });
    }
  }
}
