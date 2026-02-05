import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { PrivateAPIAnalyzer } from '../../src/analyzers/private-api.js';
import type { XcodeProject } from '../../src/types/index.js';

describe('PrivateAPIAnalyzer', () => {
  let analyzer: PrivateAPIAnalyzer;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'private-api-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    analyzer = new PrivateAPIAnalyzer();
  });

  const mockProject: XcodeProject = {
    path: '/test/TestApp.xcodeproj',
    name: 'TestApp',
    targets: [
      {
        name: 'TestApp',
        type: 'application',
        bundleIdentifier: 'com.test.app',
        sourceFiles: [],
      },
    ],
    configurations: ['Debug', 'Release'],
  };

  describe('scanPath', () => {
    it('should detect NSSelectorFromString with private selectors', async () => {
      const filePath = path.join(tempDir, 'PrivateSelector.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

func hackStatusBar() {
    let sel = NSSelectorFromString("_setStatusBarHidden:")
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'private-underscore-selector')).toBe(true);
      expect(result.issues[0]?.severity).toBe('error');
    });

    it('should detect NSClassFromString with private classes', async () => {
      const filePath = path.join(tempDir, 'PrivateClass.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

func getPrivateClass() {
    let cls = NSClassFromString("_UIStatusBarForegroundView")
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'private-class-from-string')).toBe(true);
    });

    it('should detect private framework imports in Swift', async () => {
      const filePath = path.join(tempDir, 'PrivateFramework.swift');
      await fs.writeFile(
        filePath,
        `import GraphicsServices

func doSomething() {
    // Using private framework
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'private-framework-graphicsservices')).toBe(true);
    });

    it('should detect private framework imports in ObjC', async () => {
      const filePath = path.join(tempDir, 'PrivateObjC.m');
      await fs.writeFile(
        filePath,
        `#import <SpringBoardServices/SpringBoardServices.h>

- (void)doSomething {
    // Using private framework
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'private-framework-springboardservices')).toBe(true);
    });

    it('should detect private URL schemes', async () => {
      const filePath = path.join(tempDir, 'URLScheme.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

func openCydia() {
    let url = URL(string: "cydia://package/com.example")!
    UIApplication.shared.open(url)
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'private-url-scheme')).toBe(true);
    });

    it('should detect prefs:// URL scheme', async () => {
      const filePath = path.join(tempDir, 'PrefsURL.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

func openSettings() {
    let url = URL(string: "prefs://")!
    UIApplication.shared.open(url)
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'private-url-scheme')).toBe(true);
    });

    it('should detect dlopen for private frameworks', async () => {
      const filePath = path.join(tempDir, 'DynamicLoad.m');
      await fs.writeFile(
        filePath,
        `#import <dlfcn.h>

void loadPrivateFramework() {
    void *handle = dlopen("/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit", RTLD_NOW);
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'private-dlopen')).toBe(true);
    });

    it('should detect IOKit private API usage', async () => {
      const filePath = path.join(tempDir, 'IOKitUsage.m');
      await fs.writeFile(
        filePath,
        `#import <IOKit/IOKitLib.h>

void getBatteryInfo() {
    io_service_t service = IOServiceGetMatchingService(kIOMasterPortDefault, matching);
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'private-iokit')).toBe(true);
    });

    it('should detect sandbox escape attempts', async () => {
      const filePath = path.join(tempDir, 'SandboxEscape.swift');
      await fs.writeFile(
        filePath,
        `import Foundation

func checkFiles() {
    let exists = FileManager.default.fileExists(atPath: "/var/mobile/Library/Preferences")
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'private-sandbox-escape')).toBe(true);
    });

    it('should detect valueForKey with private properties', async () => {
      const filePath = path.join(tempDir, 'PrivateKVC.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

func getPrivateProperty() {
    let view = UIView()
    let val = view.value(forKey: "_contentView")
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'private-value-for-key')).toBe(true);
    });

    it('should pass with no private API usage', async () => {
      const filePath = path.join(tempDir, 'CleanCode.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

class ViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
    }
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should skip commented-out code', async () => {
      const filePath = path.join(tempDir, 'Commented.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

// import GraphicsServices
// NSSelectorFromString("_setStatusBarHidden:")
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('analyze', () => {
    it('should work with project interface', async () => {
      const subDir = path.join(tempDir, 'AnalyzeDir');
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(
        path.join(subDir, 'Clean.swift'),
        `import UIKit\nclass VC: UIViewController {}\n`
      );

      const result = await analyzer.analyze(mockProject, {
        basePath: subDir,
      });

      expect(result.analyzer).toBe('Private API Scanner');
      expect(result.passed).toBe(true);
    });
  });
});
