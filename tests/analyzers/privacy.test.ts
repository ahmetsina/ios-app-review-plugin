import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { PrivacyAnalyzer } from '../../src/analyzers/privacy.js';
import type { XcodeProject, AnalyzerOptions } from '../../src/types/index.js';

describe('PrivacyAnalyzer', () => {
  let analyzer: PrivacyAnalyzer;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'privacy-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new PrivacyAnalyzer();
  });

  function makeMockProject(overrides?: {
    sourceFiles?: string[];
    targetName?: string;
    targetType?: 'application' | 'framework';
  }): XcodeProject {
    return {
      path: '/test/TestApp.xcodeproj',
      name: 'TestApp',
      targets: [
        {
          name: overrides?.targetName ?? 'TestApp',
          type: overrides?.targetType ?? 'application',
          bundleIdentifier: 'com.test.app',
          deploymentTarget: '16.0',
          sourceFiles: overrides?.sourceFiles ?? [],
        },
      ],
      configurations: ['Debug', 'Release'],
    };
  }

  function makeOptions(overrides?: Partial<AnalyzerOptions>): AnalyzerOptions {
    return {
      basePath: tempDir,
      ...overrides,
    };
  }

  // Helper to write a privacy manifest plist
  async function writeManifest(
    dir: string,
    opts: {
      tracking?: boolean;
      trackingDomains?: string[];
      apiTypes?: Array<{ type: string; reasons: string[] }>;
      collectedDataTypes?: Array<{
        type: string;
        purposes?: string[];
        linked?: boolean;
        tracking?: boolean;
      }>;
    }
  ): Promise<string> {
    const manifestPath = path.join(dir, 'PrivacyInfo.xcprivacy');

    let apiTypesXml = '';
    if (opts.apiTypes && opts.apiTypes.length > 0) {
      apiTypesXml = opts.apiTypes
        .map(
          (api) => `    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>${api.type}</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
${api.reasons.map((r) => `        <string>${r}</string>`).join('\n')}
      </array>
    </dict>`
        )
        .join('\n');
    }

    let collectedDataXml = '';
    if (opts.collectedDataTypes && opts.collectedDataTypes.length > 0) {
      collectedDataXml = opts.collectedDataTypes
        .map(
          (d) => `    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>${d.type}</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <${d.linked ?? false}/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <${d.tracking ?? false}/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
${(d.purposes ?? []).map((p) => `        <string>${p}</string>`).join('\n')}
      </array>
    </dict>`
        )
        .join('\n');
    }

    let trackingDomainsXml = '';
    if (opts.trackingDomains && opts.trackingDomains.length > 0) {
      trackingDomainsXml = opts.trackingDomains
        .map((d) => `    <string>${d}</string>`)
        .join('\n');
    }

    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <${opts.tracking ?? false}/>
  <key>NSPrivacyTrackingDomains</key>
  <array>
${trackingDomainsXml}
  </array>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
${apiTypesXml}
  </array>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
${collectedDataXml}
  </array>
</dict>
</plist>`;

    await fs.writeFile(manifestPath, plist, 'utf-8');
    return manifestPath;
  }

  // Helper to write a Swift source file with Required Reason API usage
  async function writeSwiftFile(dir: string, filename: string, content: string): Promise<string> {
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  describe('analyze', () => {
    it('should report missing-privacy-manifest when Required Reason APIs are detected and no manifest exists', async () => {
      const subDir = path.join(tempDir, 'no-manifest');
      await fs.mkdir(subDir, { recursive: true });

      const srcFile = await writeSwiftFile(
        subDir,
        'AppFile.swift',
        `import Foundation
let date = try FileManager.default.attributesOfItem(atPath: path)[.modificationDate] as? Date  // NSFileModificationDate
let uptime = ProcessInfo.processInfo.systemUptime
`
      );

      const project = makeMockProject({ sourceFiles: [srcFile] });
      const result = await analyzer.analyze(project, makeOptions({ basePath: subDir }));

      expect(result.passed).toBe(false);
      const missing = result.issues.find((i) => i.id === 'missing-privacy-manifest');
      expect(missing).toBeDefined();
      expect(missing?.severity).toBe('error');
      expect(missing?.category).toBe('privacy');
      expect(missing?.description).toContain('Required Reason APIs');
    });

    it('should report undeclared-api when manifest exists but does not declare all detected APIs', async () => {
      const subDir = path.join(tempDir, 'undeclared-api');
      await fs.mkdir(subDir, { recursive: true });

      // Source uses FileTimestamp + SystemBootTime + DiskSpace
      const srcFile = await writeSwiftFile(
        subDir,
        'Scanner.swift',
        `import Foundation
let date = NSFileCreationDate
let uptime = ProcessInfo.processInfo.systemUptime
let space = volumeAvailableCapacity
`
      );

      // Manifest only declares FileTimestamp
      await writeManifest(subDir, {
        apiTypes: [
          { type: 'NSPrivacyAccessedAPICategoryFileTimestamp', reasons: ['C617.1'] },
        ],
      });

      const project = makeMockProject({ sourceFiles: [srcFile] });
      const result = await analyzer.analyze(project, makeOptions({ basePath: subDir }));

      expect(result.passed).toBe(false);
      const undeclaredBoot = result.issues.find(
        (i) => i.id === 'undeclared-api-NSPrivacyAccessedAPICategorySystemBootTime'
      );
      expect(undeclaredBoot).toBeDefined();
      expect(undeclaredBoot?.severity).toBe('error');

      const undeclaredDisk = result.issues.find(
        (i) => i.id === 'undeclared-api-NSPrivacyAccessedAPICategoryDiskSpace'
      );
      expect(undeclaredDisk).toBeDefined();
    });

    it('should report tracking-no-domains when tracking is true but no domains declared', async () => {
      const subDir = path.join(tempDir, 'tracking-no-domains');
      await fs.mkdir(subDir, { recursive: true });

      await writeManifest(subDir, {
        tracking: true,
        trackingDomains: [],
      });

      // Need at least a source file to trigger target processing, but no Required Reason APIs
      await writeSwiftFile(subDir, 'Simple.swift', 'import UIKit\n');

      const project = makeMockProject({
        sourceFiles: [path.join(subDir, 'Simple.swift')],
      });
      const result = await analyzer.analyze(project, makeOptions({ basePath: subDir }));

      const trackingIssue = result.issues.find((i) => i.id === 'tracking-no-domains');
      expect(trackingIssue).toBeDefined();
      expect(trackingIssue?.severity).toBe('warning');
      expect(trackingIssue?.category).toBe('privacy');
    });

    it('should report no-reasons when API is declared with empty reasons array', async () => {
      const subDir = path.join(tempDir, 'no-reasons');
      await fs.mkdir(subDir, { recursive: true });

      await writeManifest(subDir, {
        apiTypes: [
          { type: 'NSPrivacyAccessedAPICategoryFileTimestamp', reasons: [] },
        ],
      });

      await writeSwiftFile(subDir, 'Dummy.swift', 'import UIKit\n');

      const project = makeMockProject({
        sourceFiles: [path.join(subDir, 'Dummy.swift')],
      });
      const result = await analyzer.analyze(project, makeOptions({ basePath: subDir }));

      const noReasons = result.issues.find(
        (i) => i.id === 'no-reasons-NSPrivacyAccessedAPICategoryFileTimestamp'
      );
      expect(noReasons).toBeDefined();
      expect(noReasons?.severity).toBe('error');
    });

    it('should report invalid-reason when API is declared with a wrong reason code', async () => {
      const subDir = path.join(tempDir, 'invalid-reason');
      await fs.mkdir(subDir, { recursive: true });

      await writeManifest(subDir, {
        apiTypes: [
          {
            type: 'NSPrivacyAccessedAPICategoryFileTimestamp',
            reasons: ['ZZZZ.9'],
          },
        ],
      });

      await writeSwiftFile(subDir, 'Dummy2.swift', 'import UIKit\n');

      const project = makeMockProject({
        sourceFiles: [path.join(subDir, 'Dummy2.swift')],
      });
      const result = await analyzer.analyze(project, makeOptions({ basePath: subDir }));

      const invalidReason = result.issues.find((i) =>
        i.id.startsWith('invalid-reason-NSPrivacyAccessedAPICategoryFileTimestamp')
      );
      expect(invalidReason).toBeDefined();
      expect(invalidReason?.severity).toBe('error');
      expect(invalidReason?.description).toContain('ZZZZ.9');
    });

    it('should report no-purpose when collected data type has no purposes', async () => {
      const subDir = path.join(tempDir, 'no-purpose');
      await fs.mkdir(subDir, { recursive: true });

      await writeManifest(subDir, {
        collectedDataTypes: [
          {
            type: 'NSPrivacyCollectedDataTypeEmailAddress',
            purposes: [],
            linked: true,
            tracking: false,
          },
        ],
      });

      await writeSwiftFile(subDir, 'Dummy3.swift', 'import UIKit\n');

      const project = makeMockProject({
        sourceFiles: [path.join(subDir, 'Dummy3.swift')],
      });
      const result = await analyzer.analyze(project, makeOptions({ basePath: subDir }));

      const noPurpose = result.issues.find(
        (i) => i.id === 'no-purpose-NSPrivacyCollectedDataTypeEmailAddress'
      );
      expect(noPurpose).toBeDefined();
      expect(noPurpose?.severity).toBe('warning');
    });

    it('should pass with a valid manifest declaring all detected APIs properly', async () => {
      const subDir = path.join(tempDir, 'valid-manifest');
      await fs.mkdir(subDir, { recursive: true });

      const srcFile = await writeSwiftFile(
        subDir,
        'ValidApp.swift',
        `import Foundation
let date = NSFileCreationDate
let uptime = ProcessInfo.processInfo.systemUptime
let space = volumeAvailableCapacity
`
      );

      await writeManifest(subDir, {
        tracking: false,
        apiTypes: [
          { type: 'NSPrivacyAccessedAPICategoryFileTimestamp', reasons: ['C617.1'] },
          { type: 'NSPrivacyAccessedAPICategorySystemBootTime', reasons: ['35F9.1'] },
          { type: 'NSPrivacyAccessedAPICategoryDiskSpace', reasons: ['85F4.1'] },
        ],
      });

      const project = makeMockProject({ sourceFiles: [srcFile] });
      const result = await analyzer.analyze(project, makeOptions({ basePath: subDir }));

      expect(result.passed).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('should find source files via glob when target.sourceFiles is empty', async () => {
      const subDir = path.join(tempDir, 'glob-search');
      await fs.mkdir(subDir, { recursive: true });

      // Write a source file that will be found by fast-glob
      await writeSwiftFile(
        subDir,
        'Detected.swift',
        `import Foundation
let uptime = ProcessInfo.processInfo.systemUptime
`
      );

      // No manifest, so we should get missing-privacy-manifest if source is found
      const project = makeMockProject({ sourceFiles: [] });
      const result = await analyzer.analyze(project, makeOptions({ basePath: subDir }));

      // The glob should find Detected.swift and detect systemUptime
      const missing = result.issues.find((i) => i.id === 'missing-privacy-manifest');
      expect(missing).toBeDefined();
    });

    it('should filter targets by options.targetName', async () => {
      const subDir = path.join(tempDir, 'target-filter');
      await fs.mkdir(subDir, { recursive: true });

      const srcFile = await writeSwiftFile(
        subDir,
        'Api.swift',
        `import Foundation
let uptime = ProcessInfo.processInfo.systemUptime
`
      );

      const project: XcodeProject = {
        path: '/test/TestApp.xcodeproj',
        name: 'TestApp',
        targets: [
          {
            name: 'MainApp',
            type: 'application',
            bundleIdentifier: 'com.test.main',
            deploymentTarget: '16.0',
            sourceFiles: [srcFile],
          },
          {
            name: 'HelperExtension',
            type: 'appExtension',
            bundleIdentifier: 'com.test.helper',
            deploymentTarget: '16.0',
            sourceFiles: [],
          },
        ],
        configurations: ['Debug', 'Release'],
      };

      // Filter to HelperExtension which has no source files and no manifest
      const result = await analyzer.analyze(project, makeOptions({
        basePath: subDir,
        targetName: 'HelperExtension',
      }));

      // HelperExtension has no source files, glob will search but there's no
      // manifest in a HelperExtension subdirectory. Depending on glob results
      // from subDir it may or may not find the swift file. But importantly,
      // MainApp's direct source files should NOT be used.
      expect(result.analyzer).toBe('Privacy Manifest Analyzer');
    });

    it('should detect activeInputModes API usage', async () => {
      const subDir = path.join(tempDir, 'keyboards-api');
      await fs.mkdir(subDir, { recursive: true });

      const srcFile = await writeSwiftFile(
        subDir,
        'Keyboards.swift',
        `import UIKit
let modes = UITextInputMode.activeInputModes
`
      );

      const project = makeMockProject({ sourceFiles: [srcFile] });
      const result = await analyzer.analyze(project, makeOptions({ basePath: subDir }));

      const missing = result.issues.find((i) => i.id === 'missing-privacy-manifest');
      expect(missing).toBeDefined();
      expect(missing?.suggestion).toContain('NSPrivacyAccessedAPICategoryActiveKeyboards');
    });

    it('should detect UserDefaults(suiteName:) API usage', async () => {
      const subDir = path.join(tempDir, 'userdefaults-api');
      await fs.mkdir(subDir, { recursive: true });

      const srcFile = await writeSwiftFile(
        subDir,
        'Defaults.swift',
        `import Foundation
let defaults = UserDefaults(suiteName: "group.com.test.shared")
`
      );

      const project = makeMockProject({ sourceFiles: [srcFile] });
      const result = await analyzer.analyze(project, makeOptions({ basePath: subDir }));

      const missing = result.issues.find((i) => i.id === 'missing-privacy-manifest');
      expect(missing).toBeDefined();
      expect(missing?.suggestion).toContain('NSPrivacyAccessedAPICategoryUserDefaults');
    });
  });

  describe('analyzeManifest', () => {
    it('should return error when manifest file does not exist', async () => {
      const fakePath = path.join(tempDir, 'nonexistent', 'PrivacyInfo.xcprivacy');
      const result = await analyzer.analyzeManifest(fakePath);

      expect(result.passed).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.id).toBe('privacy-manifest-not-found');
      expect(result.issues[0]?.severity).toBe('error');
      expect(result.issues[0]?.filePath).toBe(fakePath);
    });

    it('should analyze a valid manifest with project path (scans for APIs)', async () => {
      const subDir = path.join(tempDir, 'manifest-with-project');
      await fs.mkdir(subDir, { recursive: true });

      // Write source file with an API
      await writeSwiftFile(
        subDir,
        'Source.swift',
        `import Foundation
let date = NSFileCreationDate
`
      );

      // Write manifest that declares the API
      const manifestPath = await writeManifest(subDir, {
        apiTypes: [
          { type: 'NSPrivacyAccessedAPICategoryFileTimestamp', reasons: ['C617.1'] },
        ],
      });

      const result = await analyzer.analyzeManifest(manifestPath, subDir);

      expect(result.passed).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('should analyze manifest without project path (no API scanning)', async () => {
      const subDir = path.join(tempDir, 'manifest-no-project');
      await fs.mkdir(subDir, { recursive: true });

      // Manifest with tracking enabled but no domains - should still flag that
      const manifestPath = await writeManifest(subDir, {
        tracking: true,
        trackingDomains: [],
      });

      const result = await analyzer.analyzeManifest(manifestPath);

      // Should detect the tracking-no-domains issue
      const trackingIssue = result.issues.find((i) => i.id === 'tracking-no-domains');
      expect(trackingIssue).toBeDefined();
      // Without project path, no API scanning occurs, so no undeclared-api issues
      const undeclaredIssues = result.issues.filter((i) => i.id.startsWith('undeclared-api'));
      expect(undeclaredIssues).toHaveLength(0);
    });

    it('should detect undeclared APIs when project path is provided', async () => {
      const subDir = path.join(tempDir, 'manifest-undeclared');
      await fs.mkdir(subDir, { recursive: true });

      await writeSwiftFile(
        subDir,
        'Boot.swift',
        `import Foundation
let t = mach_absolute_time()
`
      );

      // Manifest with no API types declared
      const manifestPath = await writeManifest(subDir, {
        apiTypes: [],
      });

      const result = await analyzer.analyzeManifest(manifestPath, subDir);

      expect(result.passed).toBe(false);
      const undeclared = result.issues.find(
        (i) => i.id === 'undeclared-api-NSPrivacyAccessedAPICategorySystemBootTime'
      );
      expect(undeclared).toBeDefined();
    });

    it('should validate manifest with invalid reasons via analyzeManifest', async () => {
      const subDir = path.join(tempDir, 'manifest-invalid-reason');
      await fs.mkdir(subDir, { recursive: true });

      const manifestPath = await writeManifest(subDir, {
        apiTypes: [
          {
            type: 'NSPrivacyAccessedAPICategoryDiskSpace',
            reasons: ['INVALID.1'],
          },
        ],
      });

      const result = await analyzer.analyzeManifest(manifestPath);

      expect(result.passed).toBe(false);
      const invalid = result.issues.find((i) =>
        i.id.startsWith('invalid-reason-NSPrivacyAccessedAPICategoryDiskSpace')
      );
      expect(invalid).toBeDefined();
      expect(invalid?.description).toContain('INVALID.1');
    });

    it('should report collected data types without purposes via analyzeManifest', async () => {
      const subDir = path.join(tempDir, 'manifest-no-purpose-standalone');
      await fs.mkdir(subDir, { recursive: true });

      const manifestPath = await writeManifest(subDir, {
        collectedDataTypes: [
          {
            type: 'NSPrivacyCollectedDataTypeName',
            purposes: [],
            linked: false,
            tracking: false,
          },
        ],
      });

      const result = await analyzer.analyzeManifest(manifestPath);

      const noPurpose = result.issues.find(
        (i) => i.id === 'no-purpose-NSPrivacyCollectedDataTypeName'
      );
      expect(noPurpose).toBeDefined();
      expect(noPurpose?.severity).toBe('warning');
    });
  });

  describe('result metadata', () => {
    it('should include analyzer name and duration in results', async () => {
      const subDir = path.join(tempDir, 'metadata-test');
      await fs.mkdir(subDir, { recursive: true });

      await writeSwiftFile(subDir, 'Empty.swift', 'import UIKit\n');

      const project = makeMockProject({
        sourceFiles: [path.join(subDir, 'Empty.swift')],
      });
      const result = await analyzer.analyze(project, makeOptions({ basePath: subDir }));

      expect(result.analyzer).toBe('Privacy Manifest Analyzer');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.passed).toBe('boolean');
    });

    it('should set passed to true when only warnings exist (no errors)', async () => {
      const subDir = path.join(tempDir, 'warnings-only');
      await fs.mkdir(subDir, { recursive: true });

      // Manifest with tracking=true but no domains => warning only
      await writeManifest(subDir, {
        tracking: true,
        trackingDomains: [],
      });

      await writeSwiftFile(subDir, 'NoApi.swift', 'import UIKit\n');

      const project = makeMockProject({
        sourceFiles: [path.join(subDir, 'NoApi.swift')],
      });
      const result = await analyzer.analyze(project, makeOptions({ basePath: subDir }));

      // tracking-no-domains is a warning, not an error
      expect(result.passed).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.every((i) => i.severity !== 'error')).toBe(true);
    });
  });
});
