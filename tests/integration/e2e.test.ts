import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { runAnalysis } from '../../src/analyzer.js';
import { createFormatter } from '../../src/reports/index.js';

let tempDir: string;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e-test-'));

  // Create a mock Xcode project structure
  const xcodeproj = path.join(tempDir, 'TestApp.xcodeproj');
  await fs.mkdir(xcodeproj, { recursive: true });

  // Write a minimal pbxproj
  await fs.writeFile(
    path.join(xcodeproj, 'project.pbxproj'),
    `// !$*UTF8*$!
{
  archiveVersion = 1;
  classes = {};
  objectVersion = 56;
  objects = {
    ROOT = { isa = PBXProject; buildConfigurationList = CONFIGLIST; mainGroup = MAINGROUP; targets = (TARGET1); };
    CONFIGLIST = { isa = XCConfigurationList; buildConfigurations = (CONFIG1); };
    CONFIG1 = { isa = XCBuildConfiguration; name = Release; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = "com.test.app"; IPHONEOS_DEPLOYMENT_TARGET = "15.0"; }; };
    TARGET1 = { isa = PBXNativeTarget; name = TestApp; productType = "com.apple.product-type.application"; buildConfigurationList = CONFIGLIST; buildPhases = (); };
    MAINGROUP = { isa = PBXGroup; children = (); sourceTree = "<group>"; };
  };
  rootObject = ROOT;
}
`
  );

  // Create source files with some detectable issues
  await fs.writeFile(
    path.join(tempDir, 'ViewController.swift'),
    `import UIKit

class ViewController: UIViewController {
    let apiKey = "sk-test1234567890abcdef"

    override func viewDidLoad() {
        super.viewDidLoad()
        print("Debug: loaded")
    }
}
`
  );

  // Create Info.plist
  await fs.writeFile(
    path.join(tempDir, 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.test.app</string>
  <key>CFBundleName</key>
  <string>TestApp</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
</dict>
</plist>
`
  );
});

afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('E2E: Full Analysis Pipeline', () => {
  it('should analyze a mock Xcode project end-to-end', async () => {
    const report = await runAnalysis({
      projectPath: path.join(tempDir, 'TestApp.xcodeproj'),
      analyzers: ['code', 'security'],
    });

    expect(report).toBeDefined();
    expect(report.projectPath).toContain('TestApp.xcodeproj');
    expect(report.results.length).toBeGreaterThan(0);
    expect(report.summary).toBeDefined();
    expect(typeof report.summary.totalIssues).toBe('number');
    expect(typeof report.summary.duration).toBe('number');
  });

  it('should format report as markdown', async () => {
    const report = await runAnalysis({
      projectPath: path.join(tempDir, 'TestApp.xcodeproj'),
      analyzers: ['code'],
    });

    const formatter = createFormatter('markdown');
    const output = formatter.format(report);

    expect(output).toContain('#');
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('should format report as JSON', async () => {
    const report = await runAnalysis({
      projectPath: path.join(tempDir, 'TestApp.xcodeproj'),
      analyzers: ['code'],
    });

    const formatter = createFormatter('json');
    const output = formatter.format(report);

    const parsed = JSON.parse(output);
    expect(parsed).toBeDefined();
  });

  it('should format report as HTML', async () => {
    const report = await runAnalysis({
      projectPath: path.join(tempDir, 'TestApp.xcodeproj'),
      analyzers: ['code'],
    });

    const formatter = createFormatter('html');
    const output = formatter.format(report);

    expect(output).toContain('<');
  });
});
