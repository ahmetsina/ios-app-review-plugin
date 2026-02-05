import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { UIUXAnalyzer } from '../../src/analyzers/ui-ux.js';
import type { XcodeProject, XcodeTarget } from '../../src/types/index.js';

jest.mock('../../src/parsers/plist', () => ({
  parsePlist: jest.fn(),
}));

const mockParsePlist = jest.requireMock('../../src/parsers/plist').parsePlist as jest.Mock;

describe('UIUXAnalyzer', () => {
  let analyzer: UIUXAnalyzer;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uiux-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    analyzer = new UIUXAnalyzer();
    jest.clearAllMocks();
  });

  function makeProject(overrides?: Partial<XcodeTarget>): XcodeProject {
    return {
      path: '/test/TestApp.xcodeproj',
      name: 'TestApp',
      targets: [
        {
          name: 'TestApp',
          type: 'application',
          bundleIdentifier: 'com.test.app',
          infoPlistPath: path.join(tempDir, 'Info.plist'),
          sourceFiles: [],
          ...overrides,
        },
      ],
      configurations: ['Debug', 'Release'],
    };
  }

  describe('launch screen checks', () => {
    it('should pass when UILaunchStoryboardName is set', async () => {
      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
      });

      const result = await analyzer.analyze(makeProject(), {
        basePath: tempDir,
      });

      expect(result.issues.some((i) => i.id === 'uiux-no-launch-screen')).toBe(false);
    });

    it('should detect missing launch screen', async () => {
      mockParsePlist.mockResolvedValue({});

      const result = await analyzer.analyze(makeProject(), {
        basePath: tempDir,
      });

      expect(result.issues.some((i) => i.id === 'uiux-no-launch-screen')).toBe(true);
      expect(result.issues.find((i) => i.id === 'uiux-no-launch-screen')?.severity).toBe('error');
    });

    it('should pass when LaunchScreen.storyboard file exists', async () => {
      mockParsePlist.mockResolvedValue({});

      const launchDir = path.join(tempDir, 'LaunchScreenDir');
      await fs.mkdir(launchDir, { recursive: true });
      await fs.writeFile(path.join(launchDir, 'LaunchScreen.storyboard'), '<xml></xml>');

      const result = await analyzer.analyze(makeProject(), {
        basePath: launchDir,
      });

      expect(result.issues.some((i) => i.id === 'uiux-no-launch-screen')).toBe(false);

      await fs.rm(launchDir, { recursive: true, force: true });
    });
  });

  describe('app icon checks', () => {
    it('should detect missing app icon asset catalog', async () => {
      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
      });

      const result = await analyzer.analyze(makeProject(), {
        basePath: tempDir,
      });

      expect(result.issues.some((i) => i.id === 'uiux-no-app-icon')).toBe(true);
    });

    it('should detect missing 1024x1024 App Store icon', async () => {
      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
      });

      const iconDir = path.join(tempDir, 'IconCheck', 'Assets.xcassets', 'AppIcon.appiconset');
      await fs.mkdir(iconDir, { recursive: true });
      await fs.writeFile(
        path.join(iconDir, 'Contents.json'),
        JSON.stringify({
          images: [
            { size: '60x60', scale: '2x', filename: 'icon-120.png', idiom: 'iphone' },
          ],
        })
      );

      const result = await analyzer.analyze(makeProject(), {
        basePath: path.join(tempDir, 'IconCheck'),
      });

      expect(result.issues.some((i) => i.id === 'uiux-missing-appstore-icon')).toBe(true);

      await fs.rm(path.join(tempDir, 'IconCheck'), { recursive: true, force: true });
    });

    it('should pass when 1024x1024 icon exists', async () => {
      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
      });

      const iconDir = path.join(tempDir, 'IconPass', 'Assets.xcassets', 'AppIcon.appiconset');
      await fs.mkdir(iconDir, { recursive: true });
      await fs.writeFile(
        path.join(iconDir, 'Contents.json'),
        JSON.stringify({
          images: [
            { size: '1024x1024', scale: '1x', filename: 'appstore-icon.png', idiom: 'ios-marketing' },
            { size: '60x60', scale: '2x', filename: 'icon-120.png', idiom: 'iphone' },
            { size: '60x60', scale: '3x', filename: 'icon-180.png', idiom: 'iphone' },
          ],
        })
      );

      const result = await analyzer.analyze(makeProject(), {
        basePath: path.join(tempDir, 'IconPass'),
      });

      expect(result.issues.some((i) => i.id === 'uiux-missing-appstore-icon')).toBe(false);

      await fs.rm(path.join(tempDir, 'IconPass'), { recursive: true, force: true });
    });
  });

  describe('iPad support checks', () => {
    it('should detect missing iPad orientations', async () => {
      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
        UIDeviceFamily: [1, 2],
        'UISupportedInterfaceOrientations~ipad': [
          'UIInterfaceOrientationPortrait',
          'UIInterfaceOrientationLandscapeLeft',
        ],
      });

      const result = await analyzer.analyze(makeProject(), {
        basePath: tempDir,
      });

      expect(result.issues.some((i) => i.id === 'uiux-ipad-missing-orientations')).toBe(true);
    });

    it('should pass when all iPad orientations are present', async () => {
      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
        UIDeviceFamily: [1, 2],
        'UISupportedInterfaceOrientations~ipad': [
          'UIInterfaceOrientationPortrait',
          'UIInterfaceOrientationPortraitUpsideDown',
          'UIInterfaceOrientationLandscapeLeft',
          'UIInterfaceOrientationLandscapeRight',
        ],
      });

      const result = await analyzer.analyze(makeProject(), {
        basePath: tempDir,
      });

      expect(result.issues.some((i) => i.id === 'uiux-ipad-missing-orientations')).toBe(false);
    });

    it('should not check iPad orientations for iPhone-only apps', async () => {
      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
        UIDeviceFamily: [1],
      });

      const result = await analyzer.analyze(makeProject(), {
        basePath: tempDir,
      });

      expect(result.issues.some((i) => i.id === 'uiux-ipad-missing-orientations')).toBe(false);
    });
  });

  describe('placeholder text checks', () => {
    it('should detect placeholder text in storyboards', async () => {
      const storyDir = path.join(tempDir, 'PlaceholderDir');
      await fs.mkdir(storyDir, { recursive: true });
      await fs.writeFile(
        path.join(storyDir, 'Main.storyboard'),
        `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB">
    <label text="Lorem ipsum dolor sit amet" id="abc-123"/>
    <label text="Label" id="def-456"/>
</document>`
      );

      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
      });

      const result = await analyzer.analyze(makeProject(), {
        basePath: storyDir,
      });

      expect(result.issues.some((i) => i.id === 'uiux-placeholder-text')).toBe(true);

      await fs.rm(storyDir, { recursive: true, force: true });
    });

    it('should not flag storyboards with real content', async () => {
      const storyDir = path.join(tempDir, 'RealContentDir');
      await fs.mkdir(storyDir, { recursive: true });
      await fs.writeFile(
        path.join(storyDir, 'Main.storyboard'),
        `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB">
    <label text="Welcome to My App" id="abc-123"/>
    <button title="Get Started" id="def-456"/>
</document>`
      );

      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
      });

      const result = await analyzer.analyze(makeProject(), {
        basePath: storyDir,
      });

      expect(result.issues.some((i) => i.id === 'uiux-placeholder-text')).toBe(false);

      await fs.rm(storyDir, { recursive: true, force: true });
    });
  });

  describe('accessibility checks', () => {
    it('should warn when images are used without accessibility labels', async () => {
      const srcDir = path.join(tempDir, 'AccessibilityDir');
      await fs.mkdir(srcDir, { recursive: true });
      await fs.writeFile(
        path.join(srcDir, 'ViewController.swift'),
        `import UIKit

class ViewController: UIViewController {
    let imageView = UIImageView(image: UIImage(named: "photo"))
    let icon = UIImage(named: "icon")
}
`
      );

      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
      });

      const result = await analyzer.analyze(makeProject(), {
        basePath: srcDir,
      });

      expect(result.issues.some((i) => i.id === 'uiux-no-accessibility-labels')).toBe(true);

      await fs.rm(srcDir, { recursive: true, force: true });
    });

    it('should not warn when accessibility labels are present', async () => {
      const srcDir = path.join(tempDir, 'AccessibleDir');
      await fs.mkdir(srcDir, { recursive: true });
      await fs.writeFile(
        path.join(srcDir, 'ViewController.swift'),
        `import UIKit

class ViewController: UIViewController {
    let imageView = UIImageView(image: UIImage(named: "photo"))

    func setup() {
        imageView.accessibilityLabel = "User photo"
    }
}
`
      );

      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
      });

      const result = await analyzer.analyze(makeProject(), {
        basePath: srcDir,
      });

      expect(result.issues.some((i) => i.id === 'uiux-no-accessibility-labels')).toBe(false);

      await fs.rm(srcDir, { recursive: true, force: true });
    });

    it('should note when hardcoded fonts are used without Dynamic Type', async () => {
      const srcDir = path.join(tempDir, 'FontDir');
      await fs.mkdir(srcDir, { recursive: true });
      await fs.writeFile(
        path.join(srcDir, 'ViewController.swift'),
        `import UIKit

class ViewController: UIViewController {
    let label = UILabel()

    func setup() {
        label.font = UIFont.systemFont(ofSize: 16)
    }
}
`
      );

      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
      });

      const result = await analyzer.analyze(makeProject(), {
        basePath: srcDir,
      });

      expect(result.issues.some((i) => i.id === 'uiux-no-dynamic-type')).toBe(true);

      await fs.rm(srcDir, { recursive: true, force: true });
    });
  });

  describe('validateProject', () => {
    it('should work with direct project path', async () => {
      mockParsePlist.mockResolvedValue({
        UILaunchStoryboardName: 'LaunchScreen',
      });

      const result = await analyzer.validateProject(tempDir);
      expect(result.analyzer).toBe('UI/UX Compliance');
    });
  });
});
