import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { DeprecatedAPIAnalyzer } from '../../src/analyzers/deprecated-api.js';
import type { XcodeProject } from '../../src/types/index.js';

describe('DeprecatedAPIAnalyzer', () => {
  let analyzer: DeprecatedAPIAnalyzer;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deprecated-api-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    analyzer = new DeprecatedAPIAnalyzer();
  });

  const mockProject: XcodeProject = {
    path: '/test/TestApp.xcodeproj',
    name: 'TestApp',
    targets: [
      {
        name: 'TestApp',
        type: 'application',
        bundleIdentifier: 'com.test.app',
        deploymentTarget: '15.0',
        sourceFiles: [],
      },
    ],
    configurations: ['Debug', 'Release'],
  };

  describe('scanPath', () => {
    it('should detect UIWebView usage', async () => {
      const filePath = path.join(tempDir, 'WebController.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

class WebController: UIViewController {
    var webView: UIWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        webView = UIWebView(frame: view.bounds)
    }
}
`
      );

      const result = await analyzer.scanPath(filePath, '15.0');
      expect(result.issues.some((i) => i.id === 'deprecated-uiwebview')).toBe(true);
    });

    it('should detect UIAlertView usage', async () => {
      const filePath = path.join(tempDir, 'AlertHelper.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

func showAlert() {
    let alert = UIAlertView(title: "Hello", message: "World", delegate: nil, cancelButtonTitle: "OK")
    alert.show()
}
`
      );

      const result = await analyzer.scanPath(filePath, '13.0');
      expect(result.issues.some((i) => i.id === 'deprecated-uialertview')).toBe(true);
      expect(result.issues[0]?.severity).toBe('warning');
    });

    it('should detect NSURLConnection usage', async () => {
      const filePath = path.join(tempDir, 'NetworkManager.swift');
      await fs.writeFile(
        filePath,
        `import Foundation

class NetworkManager {
    func fetch() {
        let connection = NSURLConnection(request: request, delegate: self)
        connection?.start()
    }
}
`
      );

      const result = await analyzer.scanPath(filePath, '13.0');
      expect(result.issues.some((i) => i.id === 'deprecated-nsurlconnection')).toBe(true);
    });

    it('should detect ABAddressBook usage in ObjC files', async () => {
      const filePath = path.join(tempDir, 'ContactsHelper.m');
      await fs.writeFile(
        filePath,
        `#import <AddressBook/AddressBook.h>

- (void)loadContacts {
    ABAddressBookRef addressBook = ABAddressBookCreate();
    CFArrayRef people = ABAddressBookCopyArrayOfAllPeople(addressBook);
}
`
      );

      const result = await analyzer.scanPath(filePath, '13.0');
      expect(result.issues.some((i) => i.id === 'deprecated-abaddressbook')).toBe(true);
    });

    it('should detect MPMoviePlayerController usage', async () => {
      const filePath = path.join(tempDir, 'VideoPlayer.swift');
      await fs.writeFile(
        filePath,
        `import MediaPlayer

class VideoPlayer {
    var player: MPMoviePlayerController?

    func play(url: URL) {
        player = MPMoviePlayerController(contentURL: url)
        player?.play()
    }
}
`
      );

      const result = await analyzer.scanPath(filePath, '13.0');
      expect(result.issues.some((i) => i.id === 'deprecated-mpmovieplayercontroller')).toBe(true);
    });

    it('should detect UILocalNotification usage', async () => {
      const filePath = path.join(tempDir, 'NotificationHelper.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

func scheduleNotification() {
    let notification = UILocalNotification()
    notification.alertBody = "Hello"
    UIApplication.shared.scheduleLocalNotification(notification)
}
`
      );

      const result = await analyzer.scanPath(filePath, '13.0');
      expect(result.issues.some((i) => i.id === 'deprecated-uilocalnotification')).toBe(true);
    });

    it('should detect deprecated openURL usage', async () => {
      const filePath = path.join(tempDir, 'URLHandler.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

func openSafari(url: URL) {
    UIApplication.shared.openURL(url)
}
`
      );

      const result = await analyzer.scanPath(filePath, '13.0');
      expect(result.issues.some((i) => i.id === 'deprecated-openurl-sync')).toBe(true);
    });

    it('should mark removed APIs as errors', async () => {
      const filePath = path.join(tempDir, 'RemovedAPI.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

class OldWebVC: UIViewController {
    var webView: UIWebView!
}
`
      );

      // UIWebView was removed in iOS 16.0, deployment target 16.0+
      const result = await analyzer.scanPath(filePath, '16.0');
      const issue = result.issues.find((i) => i.id === 'deprecated-uiwebview');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
    });

    it('should pass with no deprecated APIs', async () => {
      const filePath = path.join(tempDir, 'CleanFile.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

class ViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let alert = UIAlertController(title: "Hello", message: "World", preferredStyle: .alert)
        present(alert, animated: true)
    }
}
`
      );

      const result = await analyzer.scanPath(filePath, '15.0');
      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should skip commented-out code', async () => {
      const filePath = path.join(tempDir, 'Commented.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

// var webView: UIWebView!
/* UIAlertView is deprecated */
// NSURLConnection was replaced
`
      );

      const result = await analyzer.scanPath(filePath, '15.0');
      expect(result.issues).toHaveLength(0);
    });

    it('should scan directories for all source files', async () => {
      const subDir = path.join(tempDir, 'ScanDir');
      await fs.mkdir(subDir, { recursive: true });

      await fs.writeFile(
        path.join(subDir, 'File1.swift'),
        `let alert = UIAlertView()\n`
      );
      await fs.writeFile(
        path.join(subDir, 'File2.swift'),
        `let player = MPMoviePlayerController()\n`
      );

      const result = await analyzer.scanPath(subDir, '13.0');
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });

    it('should include migration suggestions', async () => {
      const filePath = path.join(tempDir, 'Migration.swift');
      await fs.writeFile(
        filePath,
        `import UIKit\nlet alert = UIAlertView()\n`
      );

      const result = await analyzer.scanPath(filePath, '13.0');
      const issue = result.issues.find((i) => i.id === 'deprecated-uialertview');
      expect(issue?.suggestion).toContain('UIAlertController');
    });
  });

  describe('analyze', () => {
    it('should use deployment target from project', async () => {
      const subDir = path.join(tempDir, 'ProjectDir');
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(
        path.join(subDir, 'VC.swift'),
        `import UIKit\nvar webView: UIWebView!\n`
      );

      const project: XcodeProject = {
        ...mockProject,
        targets: [
          {
            name: 'TestApp',
            type: 'application',
            bundleIdentifier: 'com.test.app',
            deploymentTarget: '16.0',
            sourceFiles: [path.join(subDir, 'VC.swift')],
          },
        ],
      };

      const result = await analyzer.analyze(project, {
        basePath: subDir,
      });

      // UIWebView removed in 16.0, should be error
      const issue = result.issues.find((i) => i.id === 'deprecated-uiwebview');
      expect(issue?.severity).toBe('error');
    });
  });
});
