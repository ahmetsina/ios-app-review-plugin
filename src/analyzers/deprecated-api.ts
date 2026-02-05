import * as fs from 'fs/promises';
import * as path from 'path';
import fg from 'fast-glob';
import type {
  Analyzer,
  AnalysisResult,
  AnalyzerOptions,
  Issue,
  XcodeProject,
} from '../types/index.js';

/**
 * A deprecated iOS API entry
 */
interface DeprecatedAPI {
  id: string;
  name: string;
  pattern: RegExp;
  deprecatedIn: string;
  removedIn?: string;
  replacement: string;
  framework: string;
  fileTypes: string[];
}

/**
 * Compare two iOS version strings (e.g. "15.0" vs "13.0")
 * Returns positive if a > b, negative if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const va = partsA[i] ?? 0;
    const vb = partsB[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

/**
 * Database of deprecated iOS APIs
 */
const DEPRECATED_APIS: DeprecatedAPI[] = [
  // UIKit - Critical (causes rejection)
  {
    id: 'deprecated-uiwebview',
    name: 'UIWebView',
    pattern: /\bUIWebView\b/g,
    deprecatedIn: '12.0',
    removedIn: '16.0',
    replacement: 'WKWebView',
    framework: 'UIKit',
    fileTypes: ['.swift', '.m', '.mm', '.h', '.storyboard', '.xib'],
  },
  // UIKit - Presentation
  {
    id: 'deprecated-uialertview',
    name: 'UIAlertView',
    pattern: /\bUIAlertView\b/g,
    deprecatedIn: '9.0',
    replacement: 'UIAlertController with .alert style',
    framework: 'UIKit',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  {
    id: 'deprecated-uiactionsheet',
    name: 'UIActionSheet',
    pattern: /\bUIActionSheet\b/g,
    deprecatedIn: '8.3',
    replacement: 'UIAlertController with .actionSheet style',
    framework: 'UIKit',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  {
    id: 'deprecated-uipopovercontroller',
    name: 'UIPopoverController',
    pattern: /\bUIPopoverController\b/g,
    deprecatedIn: '9.0',
    replacement: 'UIPopoverPresentationController',
    framework: 'UIKit',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  // UIKit - Search
  {
    id: 'deprecated-uisearchdisplaycontroller',
    name: 'UISearchDisplayController',
    pattern: /\bUISearchDisplayController\b/g,
    deprecatedIn: '8.0',
    replacement: 'UISearchController',
    framework: 'UIKit',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  // UIKit - Table View
  {
    id: 'deprecated-uitableviewrowaction',
    name: 'UITableViewRowAction',
    pattern: /\bUITableViewRowAction\b/g,
    deprecatedIn: '13.0',
    replacement: 'UIContextualAction',
    framework: 'UIKit',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  // Networking
  {
    id: 'deprecated-nsurlconnection',
    name: 'NSURLConnection',
    pattern: /\bNSURLConnection\b/g,
    deprecatedIn: '9.0',
    replacement: 'URLSession (NSURLSession)',
    framework: 'Foundation',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  // Contacts
  {
    id: 'deprecated-abaddressbook',
    name: 'ABAddressBook',
    pattern: /\bABAddressBook\w*\b/g,
    deprecatedIn: '9.0',
    replacement: 'Contacts framework (CNContactStore)',
    framework: 'AddressBook',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  {
    id: 'deprecated-addressbookui',
    name: 'ABPeoplePickerNavigationController',
    pattern: /\bAB(?:PeoplePicker|PersonViewController|NewPersonViewController|UnknownPersonViewController)\w*\b/g,
    deprecatedIn: '9.0',
    replacement: 'ContactsUI framework (CNContactPickerViewController)',
    framework: 'AddressBookUI',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  // Media
  {
    id: 'deprecated-mpmovieplayercontroller',
    name: 'MPMoviePlayerController',
    pattern: /\bMPMoviePlayerController\b/g,
    deprecatedIn: '9.0',
    replacement: 'AVPlayerViewController',
    framework: 'MediaPlayer',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  {
    id: 'deprecated-mpmovieplayerviewcontroller',
    name: 'MPMoviePlayerViewController',
    pattern: /\bMPMoviePlayerViewController\b/g,
    deprecatedIn: '9.0',
    replacement: 'AVPlayerViewController',
    framework: 'MediaPlayer',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  // Photos
  {
    id: 'deprecated-alassetslibrary',
    name: 'ALAssetsLibrary',
    pattern: /\bALAssetsLibrary\b/g,
    deprecatedIn: '9.0',
    replacement: 'Photos framework (PHPhotoLibrary)',
    framework: 'AssetsLibrary',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  // Notifications
  {
    id: 'deprecated-uilocalnotification',
    name: 'UILocalNotification',
    pattern: /\bUILocalNotification\b/g,
    deprecatedIn: '10.0',
    replacement: 'UNUserNotificationCenter (UserNotifications framework)',
    framework: 'UIKit',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  {
    id: 'deprecated-uiusernotificationsettings',
    name: 'UIUserNotificationSettings',
    pattern: /\bUIUserNotificationSettings\b/g,
    deprecatedIn: '10.0',
    replacement: 'UNUserNotificationCenter (UserNotifications framework)',
    framework: 'UIKit',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  // Motion
  {
    id: 'deprecated-uiaccelerometer',
    name: 'UIAccelerometer',
    pattern: /\bUIAccelerometer\b/g,
    deprecatedIn: '5.0',
    replacement: 'CMMotionManager (CoreMotion framework)',
    framework: 'UIKit',
    fileTypes: ['.swift', '.m', '.mm', '.h'],
  },
  // URL handling
  {
    id: 'deprecated-openurl-sync',
    name: 'UIApplication.openURL(_:)',
    pattern: /\.openURL\s*\(/g,
    deprecatedIn: '10.0',
    replacement: 'UIApplication.open(_:options:completionHandler:)',
    framework: 'UIKit',
    fileTypes: ['.swift'],
  },
  // Status bar
  {
    id: 'deprecated-statusbar-style',
    name: 'UIApplication.statusBarStyle',
    pattern: /\.statusBarStyle\b/g,
    deprecatedIn: '9.0',
    replacement: 'preferredStatusBarStyle in UIViewController',
    framework: 'UIKit',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  {
    id: 'deprecated-statusbar-hidden',
    name: 'UIApplication.statusBarHidden',
    pattern: /\.(?:isStatusBarHidden|setStatusBarHidden)\b/g,
    deprecatedIn: '9.0',
    replacement: 'prefersStatusBarHidden in UIViewController',
    framework: 'UIKit',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // Interface orientation
  {
    id: 'deprecated-statusbar-orientation',
    name: 'UIApplication.statusBarOrientation',
    pattern: /\.statusBarOrientation\b/g,
    deprecatedIn: '13.0',
    replacement: 'UIWindowScene.interfaceOrientation',
    framework: 'UIKit',
    fileTypes: ['.swift', '.m', '.mm'],
  },
  // Deprecated string drawing
  {
    id: 'deprecated-nsstring-drawing',
    name: 'NSString sizeWithFont:',
    pattern: /\bsizeWithFont\s*:/g,
    deprecatedIn: '7.0',
    replacement: 'boundingRect(with:options:attributes:context:) or NSAttributedString',
    framework: 'UIKit',
    fileTypes: ['.m', '.mm'],
  },
];

/**
 * Analyzer that detects usage of deprecated iOS APIs
 */
export class DeprecatedAPIAnalyzer implements Analyzer {
  name = 'Deprecated API Scanner';
  description = 'Detects usage of deprecated iOS APIs that may cause App Store rejection';

  async analyze(project: XcodeProject, options: AnalyzerOptions): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Get deployment target from project
    const targets = options.targetName
      ? project.targets.filter((t) => t.name === options.targetName)
      : project.targets.filter((t) => t.type === 'application');

    const deploymentTarget = targets[0]?.deploymentTarget ?? '13.0';

    // Get source files
    let sourceFiles: string[] = [];
    for (const target of targets) {
      sourceFiles.push(...target.sourceFiles);
    }

    if (sourceFiles.length === 0) {
      sourceFiles = await this.findSourceFiles(options.basePath);
    }

    const issues = await this.scanFiles(sourceFiles, deploymentTarget);

    return {
      analyzer: this.name,
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Scan a specific path for deprecated APIs
   */
  async scanPath(scanPath: string, deploymentTarget?: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    const target = deploymentTarget ?? '13.0';

    const stats = await fs.stat(scanPath);
    const files = stats.isDirectory()
      ? await this.findSourceFiles(scanPath)
      : [scanPath];

    const issues = await this.scanFiles(files, target);

    return {
      analyzer: this.name,
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      duration: Date.now() - startTime,
    };
  }

  private async findSourceFiles(basePath: string): Promise<string[]> {
    return fg(['**/*.swift', '**/*.m', '**/*.mm', '**/*.h', '**/*.storyboard', '**/*.xib'], {
      cwd: basePath,
      absolute: true,
      ignore: [
        '**/Pods/**',
        '**/Carthage/**',
        '**/build/**',
        '**/DerivedData/**',
        '**/*.generated.swift',
        '**/Tests/**',
        '**/UITests/**',
      ],
    });
  }

  private async scanFiles(files: string[], deploymentTarget: string): Promise<Issue[]> {
    const issues: Issue[] = [];
    const seenIssues = new Set<string>();

    for (const file of files) {
      const ext = path.extname(file);

      try {
        const content = await fs.readFile(file, 'utf-8');

        for (const api of DEPRECATED_APIS) {
          if (!api.fileTypes.includes(ext)) {
            continue;
          }

          api.pattern.lastIndex = 0;

          let match: RegExpExecArray | null;
          while ((match = api.pattern.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;
            const issueKey = `${api.id}:${file}:${lineNumber}`;

            if (seenIssues.has(issueKey)) continue;
            seenIssues.add(issueKey);

            // Skip commented lines
            const line = content.split('\n')[lineNumber - 1] ?? '';
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
              continue;
            }

            // Determine severity based on removal status
            const isRemoved = api.removedIn && compareVersions(deploymentTarget, api.removedIn) >= 0;
            const severity = isRemoved ? 'error' : 'warning';

            const deprecatedMsg = `Deprecated in iOS ${api.deprecatedIn}`;
            const removedMsg = api.removedIn ? `, removed in iOS ${api.removedIn}` : '';

            issues.push({
              id: api.id,
              title: `Deprecated API: ${api.name}`,
              description: `\`${api.name}\` (${api.framework}) is deprecated. ${deprecatedMsg}${removedMsg}.\n\nFound: \`${match[0].substring(0, 50)}\``,
              severity,
              filePath: file,
              lineNumber,
              category: 'deprecated-api',
              guideline: isRemoved
                ? `ITMS-90809 - Deprecated API Usage`
                : `Guideline 2.5.1 - Software Requirements`,
              suggestion: `Replace with ${api.replacement}.`,
            });

            // Limit per pattern per file
            const count = issues.filter((i) => i.id === api.id && i.filePath === file).length;
            if (count >= 5) break;
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return issues;
  }
}
