import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { CodeScanner } from '../../src/analyzers/code-scanner.js';
import type { XcodeProject, AnalyzerOptions } from '../../src/types/index.js';

describe('CodeScanner', () => {
  let scanner: CodeScanner;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-scanner-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    scanner = new CodeScanner();
  });

  function makeMockProject(overrides?: {
    sourceFiles?: string[];
    targets?: Array<{
      name: string;
      type: 'application' | 'framework';
      sourceFiles: string[];
    }>;
  }): XcodeProject {
    const targets = overrides?.targets ?? [
      {
        name: 'TestApp',
        type: 'application' as const,
        bundleIdentifier: 'com.test.app',
        deploymentTarget: '16.0',
        sourceFiles: overrides?.sourceFiles ?? [],
      },
    ];
    return {
      path: '/test/TestApp.xcodeproj',
      name: 'TestApp',
      targets: targets.map((t) => ({
        bundleIdentifier: 'com.test.app',
        deploymentTarget: '16.0',
        ...t,
      })),
      configurations: ['Debug', 'Release'],
    };
  }

  function makeOptions(overrides?: Partial<AnalyzerOptions>): AnalyzerOptions {
    return {
      basePath: tempDir,
      ...overrides,
    };
  }

  describe('analyze - pattern detection', () => {
    let sourceDir: string;
    let swiftFile: string;

    beforeAll(async () => {
      sourceDir = path.join(tempDir, 'patterns');
      await fs.mkdir(sourceDir, { recursive: true });

      swiftFile = path.join(sourceDir, 'ViewController.swift');
      await fs.writeFile(
        swiftFile,
        `import UIKit
import WebKit

class ViewController: UIViewController {
    let apiKey = "sk-test1234567890abcdef"
    let awsKey = "AKIAIOSFODNN7EXAMPLE"
    let url = "http://api.example.com/data"
    let password = "mysecretpassword"

    override func viewDidLoad() {
        super.viewDidLoad()
        print("Debug: loaded")
        NSLog("Debug log")
        debugPrint("verbose")

        let value = someOptional!.property
        let result = try! someThrowingFunc()

        // TODO: fix this before release
        // FIXME: hack that needs cleanup

        let webView = UIWebView()
        let ipsum = "lorem ipsum dolor sit amet"
    }
}
`,
        'utf-8'
      );
    });

    it('should detect hardcoded AWS keys', async () => {
      const project = makeMockProject({ sourceFiles: [swiftFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: sourceDir }));

      const awsIssue = result.issues.find((i) => i.id === 'aws-key');
      expect(awsIssue).toBeDefined();
      expect(awsIssue?.severity).toBe('error');
      expect(awsIssue?.filePath).toBe(swiftFile);
    });

    it('should detect print/NSLog/debugPrint statements', async () => {
      const project = makeMockProject({ sourceFiles: [swiftFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: sourceDir }));

      const printIssues = result.issues.filter((i) => i.id === 'print-statement');
      expect(printIssues.length).toBeGreaterThanOrEqual(1);
      expect(printIssues[0]?.severity).toBe('info');
    });

    it('should detect force unwrap usage', async () => {
      const project = makeMockProject({ sourceFiles: [swiftFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: sourceDir }));

      const forceUnwrap = result.issues.find((i) => i.id === 'force-unwrap');
      expect(forceUnwrap).toBeDefined();
      expect(forceUnwrap?.severity).toBe('info');
    });

    it('should detect deprecated UIWebView usage', async () => {
      const project = makeMockProject({ sourceFiles: [swiftFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: sourceDir }));

      const webViewIssue = result.issues.find((i) => i.id === 'deprecated-uiwebview');
      expect(webViewIssue).toBeDefined();
      expect(webViewIssue?.severity).toBe('error');
      expect(webViewIssue?.guideline).toBe('ITMS-90809');
    });

    it('should detect insecure HTTP URLs', async () => {
      const project = makeMockProject({ sourceFiles: [swiftFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: sourceDir }));

      const httpIssue = result.issues.find((i) => i.id === 'insecure-http');
      expect(httpIssue).toBeDefined();
      expect(httpIssue?.severity).toBe('warning');
    });

    it('should detect TODO/FIXME comments', async () => {
      const project = makeMockProject({ sourceFiles: [swiftFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: sourceDir }));

      const todoIssues = result.issues.filter((i) => i.id === 'todo-comment');
      expect(todoIssues.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect placeholder text', async () => {
      const project = makeMockProject({ sourceFiles: [swiftFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: sourceDir }));

      const placeholderIssue = result.issues.find((i) => i.id === 'placeholder-text');
      expect(placeholderIssue).toBeDefined();
      expect(placeholderIssue?.severity).toBe('warning');
    });

    it('should detect hardcoded passwords', async () => {
      const project = makeMockProject({ sourceFiles: [swiftFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: sourceDir }));

      const pwIssue = result.issues.find((i) => i.id === 'hardcoded-password');
      expect(pwIssue).toBeDefined();
      expect(pwIssue?.severity).toBe('error');
    });

    it('should mark result as not passed when errors exist', async () => {
      const project = makeMockProject({ sourceFiles: [swiftFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: sourceDir }));

      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.severity === 'error')).toBe(true);
    });
  });

  describe('analyze - ObjC patterns', () => {
    let objcDir: string;
    let objcFile: string;

    beforeAll(async () => {
      objcDir = path.join(tempDir, 'objc-patterns');
      await fs.mkdir(objcDir, { recursive: true });

      objcFile = path.join(objcDir, 'LegacyController.m');
      await fs.writeFile(
        objcFile,
        `#import <UIKit/UIKit.h>
#import <AddressBook/AddressBook.h>

@implementation LegacyController

- (void)viewDidLoad {
    [super viewDidLoad];
    NSLog(@"View loaded");
    UIWebView *webView = [[UIWebView alloc] init];
    ABAddressBookRef addressBook = ABAddressBookCreate();
}

@end
`,
        'utf-8'
      );
    });

    it('should detect UIWebView in ObjC files', async () => {
      const project = makeMockProject({ sourceFiles: [objcFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: objcDir }));

      const webViewIssue = result.issues.find((i) => i.id === 'deprecated-uiwebview');
      expect(webViewIssue).toBeDefined();
    });

    it('should detect deprecated AddressBook framework', async () => {
      const project = makeMockProject({ sourceFiles: [objcFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: objcDir }));

      const abIssue = result.issues.find((i) => i.id === 'deprecated-addressbook');
      expect(abIssue).toBeDefined();
      expect(abIssue?.severity).toBe('warning');
    });
  });

  describe('analyze - hardcoded IPv4 and test server URLs', () => {
    let ipDir: string;
    let ipFile: string;

    beforeAll(async () => {
      ipDir = path.join(tempDir, 'ip-patterns');
      await fs.mkdir(ipDir, { recursive: true });

      ipFile = path.join(ipDir, 'Network.swift');
      await fs.writeFile(
        ipFile,
        `import Foundation

let serverIP = "192.168.1.100"
let testURL = "http://staging.example.com/api"
let debugURL = "http://localhost:8080/test"
let devServer = "http://dev.myapp.com/endpoint"
`,
        'utf-8'
      );
    });

    it('should detect hardcoded IPv4 addresses', async () => {
      const project = makeMockProject({ sourceFiles: [ipFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: ipDir }));

      const ipIssue = result.issues.find((i) => i.id === 'hardcoded-ipv4');
      expect(ipIssue).toBeDefined();
      expect(ipIssue?.severity).toBe('warning');
    });

    it('should detect test/staging server URLs', async () => {
      const project = makeMockProject({ sourceFiles: [ipFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: ipDir }));

      const testUrlIssues = result.issues.filter((i) => i.id === 'test-server-url');
      expect(testUrlIssues.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('analyze - debug ifdef', () => {
    it('should detect #if DEBUG blocks in Swift files', async () => {
      const subDir = path.join(tempDir, 'debug-ifdef');
      await fs.mkdir(subDir, { recursive: true });

      const filePath = path.join(subDir, 'Config.swift');
      await fs.writeFile(
        filePath,
        `import Foundation

#if DEBUG
let baseURL = "http://localhost:3000"
#else
let baseURL = "https://api.production.com"
#endif
`,
        'utf-8'
      );

      const project = makeMockProject({ sourceFiles: [filePath] });
      const result = await scanner.analyze(project, makeOptions({ basePath: subDir }));

      const debugIssue = result.issues.find((i) => i.id === 'debug-ifdef');
      expect(debugIssue).toBeDefined();
      expect(debugIssue?.severity).toBe('info');
    });
  });

  describe('analyze - hardcoded API key pattern', () => {
    it('should detect api_key = "..." pattern', async () => {
      const subDir = path.join(tempDir, 'apikey-pattern');
      await fs.mkdir(subDir, { recursive: true });

      const filePath = path.join(subDir, 'Keys.swift');
      await fs.writeFile(
        filePath,
        `import Foundation

let api_key = "abcdef1234567890abcdef"
let secret_key = "secretvalue12345678901234"
`,
        'utf-8'
      );

      const project = makeMockProject({ sourceFiles: [filePath] });
      const result = await scanner.analyze(project, makeOptions({ basePath: subDir }));

      const apiKeyIssue = result.issues.find((i) => i.id === 'hardcoded-api-key');
      expect(apiKeyIssue).toBeDefined();
      expect(apiKeyIssue?.severity).toBe('error');
    });
  });

  describe('analyze - false positive handling', () => {
    it('should skip patterns in commented-out lines', async () => {
      const subDir = path.join(tempDir, 'false-positive-comments');
      await fs.mkdir(subDir, { recursive: true });

      const filePath = path.join(subDir, 'Commented.swift');
      await fs.writeFile(
        filePath,
        `import Foundation

// let awsKey = "AKIAIOSFODNN7EXAMPLE"
/* password = "mysecret1234" */
* let webView = UIWebView()
`,
        'utf-8'
      );

      const project = makeMockProject({ sourceFiles: [filePath] });
      const result = await scanner.analyze(project, makeOptions({ basePath: subDir }));

      // Commented-out patterns should be filtered as false positives
      // (except TODO/FIXME which are expected in comments)
      const awsIssue = result.issues.find((i) => i.id === 'aws-key');
      expect(awsIssue).toBeUndefined();
    });

    it('should not flag @IBOutlet force unwraps as issues', async () => {
      const subDir = path.join(tempDir, 'false-positive-iboutlet');
      await fs.mkdir(subDir, { recursive: true });

      const filePath = path.join(subDir, 'Outlet.swift');
      await fs.writeFile(
        filePath,
        `import UIKit

class MyVC: UIViewController {
    @IBOutlet weak var label: UILabel!
    @IBAction func tapped(_ sender: UIButton!) {
    }
}
`,
        'utf-8'
      );

      const project = makeMockProject({ sourceFiles: [filePath] });
      const result = await scanner.analyze(project, makeOptions({ basePath: subDir }));

      // IBOutlet/IBAction force unwraps should be treated as false positives
      const forceUnwrapIssues = result.issues.filter(
        (i) => i.id === 'force-unwrap' && i.filePath === filePath
      );
      expect(forceUnwrapIssues).toHaveLength(0);
    });

    it('should skip lines containing XCTest as false positives', async () => {
      const subDir = path.join(tempDir, 'false-positive-xctest');
      await fs.mkdir(subDir, { recursive: true });

      const filePath = path.join(subDir, 'HelperForTest.swift');
      await fs.writeFile(
        filePath,
        `import Foundation
import XCTest let password = "testpassword1234"
`,
        'utf-8'
      );

      const project = makeMockProject({ sourceFiles: [filePath] });
      const result = await scanner.analyze(project, makeOptions({ basePath: subDir }));

      // The XCTest line should be filtered out
      const pwIssue = result.issues.find(
        (i) => i.id === 'hardcoded-password' && i.filePath === filePath
      );
      expect(pwIssue).toBeUndefined();
    });

    it('should not flag insecure HTTP URLs next to NSExceptionDomains', async () => {
      const subDir = path.join(tempDir, 'false-positive-ats');
      await fs.mkdir(subDir, { recursive: true });

      const filePath = path.join(subDir, 'ATS.swift');
      await fs.writeFile(
        filePath,
        `import Foundation
let domain = "http://example.com" // NSExceptionDomains
`,
        'utf-8'
      );

      const project = makeMockProject({ sourceFiles: [filePath] });
      const result = await scanner.analyze(project, makeOptions({ basePath: subDir }));

      const httpIssue = result.issues.find(
        (i) => i.id === 'insecure-http' && i.filePath === filePath
      );
      expect(httpIssue).toBeUndefined();
    });
  });

  describe('analyze - file type filtering', () => {
    it('should not flag print statements in .h header files', async () => {
      const subDir = path.join(tempDir, 'filetype-filter');
      await fs.mkdir(subDir, { recursive: true });

      const headerFile = path.join(subDir, 'Header.h');
      await fs.writeFile(
        headerFile,
        `// Header file
void print(const char *msg);
`,
        'utf-8'
      );

      const project = makeMockProject({ sourceFiles: [headerFile] });
      const result = await scanner.analyze(project, makeOptions({ basePath: subDir }));

      // print-statement pattern has fileTypes: ['.swift', '.m', '.mm']
      // .h files should not match
      const printIssues = result.issues.filter(
        (i) => i.id === 'print-statement' && i.filePath === headerFile
      );
      expect(printIssues).toHaveLength(0);
    });
  });

  describe('analyze - glob fallback and target filtering', () => {
    it('should find source files via glob when no source files in target', async () => {
      const subDir = path.join(tempDir, 'glob-fallback');
      await fs.mkdir(subDir, { recursive: true });

      await fs.writeFile(
        path.join(subDir, 'Found.swift'),
        `import UIKit
let webView = UIWebView()
`,
        'utf-8'
      );

      const project = makeMockProject({ sourceFiles: [] });
      const result = await scanner.analyze(project, makeOptions({ basePath: subDir }));

      const webViewIssue = result.issues.find((i) => i.id === 'deprecated-uiwebview');
      expect(webViewIssue).toBeDefined();
    });

    it('should filter targets by options.targetName', async () => {
      const subDir = path.join(tempDir, 'target-name-filter');
      await fs.mkdir(subDir, { recursive: true });

      const mainFile = path.join(subDir, 'Main.swift');
      await fs.writeFile(mainFile, 'let webView = UIWebView()\n', 'utf-8');

      const extensionFile = path.join(subDir, 'Extension.swift');
      await fs.writeFile(extensionFile, 'import Foundation\n', 'utf-8');

      const project: XcodeProject = {
        path: '/test/TestApp.xcodeproj',
        name: 'TestApp',
        targets: [
          {
            name: 'MainApp',
            type: 'application',
            bundleIdentifier: 'com.test.main',
            deploymentTarget: '16.0',
            sourceFiles: [mainFile],
          },
          {
            name: 'CleanExtension',
            type: 'appExtension',
            bundleIdentifier: 'com.test.ext',
            deploymentTarget: '16.0',
            sourceFiles: [extensionFile],
          },
        ],
        configurations: ['Debug', 'Release'],
      };

      // Only scan CleanExtension
      const result = await scanner.analyze(project, makeOptions({
        basePath: subDir,
        targetName: 'CleanExtension',
      }));

      // CleanExtension has a clean file, MainApp's UIWebView should not appear
      const webViewIssue = result.issues.find((i) => i.id === 'deprecated-uiwebview');
      expect(webViewIssue).toBeUndefined();
      expect(result.passed).toBe(true);
    });

    it('should process multiple targets when no targetName specified', async () => {
      const subDir = path.join(tempDir, 'multi-target');
      await fs.mkdir(subDir, { recursive: true });

      const file1 = path.join(subDir, 'App1.swift');
      await fs.writeFile(file1, 'let webView = UIWebView()\n', 'utf-8');

      const file2 = path.join(subDir, 'App2.swift');
      await fs.writeFile(file2, 'let key = "AKIAIOSFODNN7EXAMPLE"\n', 'utf-8');

      const project: XcodeProject = {
        path: '/test/TestApp.xcodeproj',
        name: 'TestApp',
        targets: [
          {
            name: 'App1',
            type: 'application',
            bundleIdentifier: 'com.test.app1',
            deploymentTarget: '16.0',
            sourceFiles: [file1],
          },
          {
            name: 'App2',
            type: 'application',
            bundleIdentifier: 'com.test.app2',
            deploymentTarget: '16.0',
            sourceFiles: [file2],
          },
        ],
        configurations: ['Debug', 'Release'],
      };

      const result = await scanner.analyze(project, makeOptions({ basePath: subDir }));

      // Both targets' files should be scanned
      const webViewIssue = result.issues.find((i) => i.id === 'deprecated-uiwebview');
      const awsIssue = result.issues.find((i) => i.id === 'aws-key');
      expect(webViewIssue).toBeDefined();
      expect(awsIssue).toBeDefined();
    });
  });

  describe('analyze - changedFiles filtering', () => {
    it('should only scan files that are in the changedFiles set', async () => {
      const subDir = path.join(tempDir, 'changed-files');
      await fs.mkdir(subDir, { recursive: true });

      const changedFile = path.join(subDir, 'Changed.swift');
      await fs.writeFile(changedFile, 'let webView = UIWebView()\n', 'utf-8');

      const unchangedFile = path.join(subDir, 'Unchanged.swift');
      await fs.writeFile(unchangedFile, 'let key = "AKIAIOSFODNN7EXAMPLE"\n', 'utf-8');

      const project = makeMockProject({
        sourceFiles: [changedFile, unchangedFile],
      });

      const result = await scanner.analyze(project, makeOptions({
        basePath: subDir,
        changedFiles: [changedFile],
      }));

      // Only changedFile should be scanned
      const webViewIssue = result.issues.find((i) => i.id === 'deprecated-uiwebview');
      expect(webViewIssue).toBeDefined();

      // unchangedFile has AWS key but should not be scanned
      const awsIssue = result.issues.find((i) => i.id === 'aws-key');
      expect(awsIssue).toBeUndefined();
    });

    it('should return no issues when changedFiles is empty', async () => {
      const subDir = path.join(tempDir, 'changed-empty');
      await fs.mkdir(subDir, { recursive: true });

      const file = path.join(subDir, 'HasIssues.swift');
      await fs.writeFile(file, 'let webView = UIWebView()\n', 'utf-8');

      const project = makeMockProject({ sourceFiles: [file] });

      const result = await scanner.analyze(project, makeOptions({
        basePath: subDir,
        changedFiles: [],
      }));

      expect(result.issues).toHaveLength(0);
      expect(result.passed).toBe(true);
    });
  });

  describe('scanPath', () => {
    it('should scan a single file directly', async () => {
      const subDir = path.join(tempDir, 'scanpath-file');
      await fs.mkdir(subDir, { recursive: true });

      const filePath = path.join(subDir, 'Single.swift');
      await fs.writeFile(
        filePath,
        `import UIKit
let webView = UIWebView()
let key = "AKIAIOSFODNN7EXAMPLE"
print("debug info")
`,
        'utf-8'
      );

      const result = await scanner.scanPath(filePath);

      expect(result.analyzer).toBe('Code Scanner');
      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.id === 'deprecated-uiwebview')).toBe(true);
      expect(result.issues.some((i) => i.id === 'aws-key')).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should scan a directory for all source files', async () => {
      const subDir = path.join(tempDir, 'scanpath-dir');
      await fs.mkdir(subDir, { recursive: true });

      await fs.writeFile(
        path.join(subDir, 'FileA.swift'),
        'let webView = UIWebView()\n',
        'utf-8'
      );
      await fs.writeFile(
        path.join(subDir, 'FileB.swift'),
        'let key = "AKIAIOSFODNN7EXAMPLE"\n',
        'utf-8'
      );

      const result = await scanner.scanPath(subDir);

      expect(result.issues.some((i) => i.id === 'deprecated-uiwebview')).toBe(true);
      expect(result.issues.some((i) => i.id === 'aws-key')).toBe(true);
    });

    it('should filter patterns when pattern IDs are provided', async () => {
      const subDir = path.join(tempDir, 'scanpath-patterns');
      await fs.mkdir(subDir, { recursive: true });

      const filePath = path.join(subDir, 'Mixed.swift');
      await fs.writeFile(
        filePath,
        `import UIKit
let webView = UIWebView()
let key = "AKIAIOSFODNN7EXAMPLE"
print("debug info")
// TODO: fix this
`,
        'utf-8'
      );

      // Only scan for deprecated-uiwebview
      const result = await scanner.scanPath(filePath, ['deprecated-uiwebview']);

      const webViewIssues = result.issues.filter((i) => i.id === 'deprecated-uiwebview');
      expect(webViewIssues.length).toBeGreaterThanOrEqual(1);

      // Other patterns should NOT be detected
      const awsIssue = result.issues.find((i) => i.id === 'aws-key');
      expect(awsIssue).toBeUndefined();

      const printIssue = result.issues.find((i) => i.id === 'print-statement');
      expect(printIssue).toBeUndefined();
    });
  });

  describe('result metadata', () => {
    it('should include analyzer name and duration', async () => {
      const subDir = path.join(tempDir, 'metadata');
      await fs.mkdir(subDir, { recursive: true });

      const filePath = path.join(subDir, 'Clean.swift');
      await fs.writeFile(filePath, 'import Foundation\n', 'utf-8');

      const project = makeMockProject({ sourceFiles: [filePath] });
      const result = await scanner.analyze(project, makeOptions({ basePath: subDir }));

      expect(result.analyzer).toBe('Code Scanner');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should truncate long match strings in issue descriptions', async () => {
      const subDir = path.join(tempDir, 'truncate');
      await fs.mkdir(subDir, { recursive: true });

      const filePath = path.join(subDir, 'LongMatch.swift');
      // Create a very long insecure URL that will exceed truncation limit
      const longUrl = `"http://very-long-domain-name-that-goes-on-and-on-and-on-for-testing-purposes.example.com/some/really/long/path/that/keeps/going"`;
      await fs.writeFile(
        filePath,
        `import Foundation
let url = ${longUrl}
`,
        'utf-8'
      );

      const project = makeMockProject({ sourceFiles: [filePath] });
      const result = await scanner.analyze(project, makeOptions({ basePath: subDir }));

      const httpIssue = result.issues.find((i) => i.id === 'insecure-http');
      expect(httpIssue).toBeDefined();
      // Long matches get truncated with "..."
      if (httpIssue && httpIssue.description.includes('...')) {
        expect(httpIssue.description).toContain('...');
      }
    });
  });

  describe('issue limit per pattern per file', () => {
    it('should limit issues per pattern to 5 per file', async () => {
      const subDir = path.join(tempDir, 'issue-limit');
      await fs.mkdir(subDir, { recursive: true });

      const filePath = path.join(subDir, 'ManyTodos.swift');
      const lines = ['import Foundation'];
      for (let i = 0; i < 10; i++) {
        lines.push(`// TODO: task ${i}`);
      }
      await fs.writeFile(filePath, lines.join('\n') + '\n', 'utf-8');

      const project = makeMockProject({ sourceFiles: [filePath] });
      const result = await scanner.analyze(project, makeOptions({ basePath: subDir }));

      const todoIssues = result.issues.filter(
        (i) => i.id === 'todo-comment' && i.filePath === filePath
      );
      expect(todoIssues.length).toBeLessThanOrEqual(5);
    });
  });
});
