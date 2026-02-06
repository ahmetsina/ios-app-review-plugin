import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { CustomRuleEngine } from '../../src/rules/engine.js';
import type { CompiledRule, CustomRuleConfig } from '../../src/rules/types.js';

describe('CustomRuleEngine', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rule-engine-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const testForceCastRule: CompiledRule = {
    id: 'test-force-cast',
    title: 'Force cast detected',
    description: 'Force casts can cause crashes',
    severity: 'warning',
    pattern: 'as!\\s+\\w+',
    regex: /as!\s+\w+/g,
  };

  const testForceUnwrapRule: CompiledRule = {
    id: 'test-force-unwrap',
    title: 'Force unwrap detected',
    description: 'Force unwraps can cause crashes',
    severity: 'warning',
    pattern: '\\w+!\\.',
    regex: /\w+!\./g,
  };

  const testPrintRule: CompiledRule = {
    id: 'test-no-print',
    title: 'Print statement detected',
    description: 'Remove print statements before release',
    severity: 'info',
    pattern: '\\bprint\\(',
    regex: /\bprint\(/g,
    fileTypes: ['.swift'],
  };

  it('should find matches for custom regex patterns', async () => {
    const filePath = path.join(tempDir, 'ForceCast.swift');
    await fs.writeFile(
      filePath,
      `import UIKit

class ViewController: UIViewController {
    func setup() {
        let view = self.view as! UITableView
        let label = someView as! UILabel
    }
}
`
    );

    const engine = new CustomRuleEngine();
    const result = await engine.scan(filePath, [testForceCastRule]);

    expect(result.issues.length).toBeGreaterThanOrEqual(2);
    expect(result.issues.every((i) => i.id === 'test-force-cast')).toBe(true);
    expect(result.issues[0]!.filePath).toBe(filePath);
    expect(result.issues[0]!.lineNumber).toBeDefined();
  });

  it('should respect fileTypes filter', async () => {
    const swiftFile = path.join(tempDir, 'PrintSwift.swift');
    await fs.writeFile(swiftFile, 'print("hello from swift")\n');

    const objcFile = path.join(tempDir, 'PrintObjC.m');
    await fs.writeFile(objcFile, 'print("hello from objc")\n');

    const dir = path.join(tempDir, 'filetype-test');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'App.swift'), 'print("swift print")\n');
    await fs.writeFile(path.join(dir, 'Helper.m'), 'print("objc print")\n');

    const engine = new CustomRuleEngine();

    // When scanning the directory, the print rule (fileTypes: ['.swift']) should only match .swift files
    const result = await engine.scan(dir, [testPrintRule]);
    const matchedFiles = result.issues.map((i) => i.filePath);
    const hasObjcFile = matchedFiles.some((f) => f?.endsWith('.m'));
    expect(hasObjcFile).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    expect(result.issues.every((i) => i.filePath?.endsWith('.swift'))).toBe(true);
  });

  it('should ignore disabled rules from config', async () => {
    const filePath = path.join(tempDir, 'DisabledRule.swift');
    await fs.writeFile(
      filePath,
      `let view = self.view as! UITableView
let x = optional!.value
`
    );

    const config: CustomRuleConfig = {
      version: 1,
      rules: [],
      disabledRules: ['test-force-cast'],
    };
    const engine = new CustomRuleEngine(config);
    const result = await engine.scan(filePath, [testForceCastRule, testForceUnwrapRule]);

    // test-force-cast should be disabled, only test-force-unwrap should match
    const forceCastIssues = result.issues.filter((i) => i.id === 'test-force-cast');
    const forceUnwrapIssues = result.issues.filter((i) => i.id === 'test-force-unwrap');
    expect(forceCastIssues).toHaveLength(0);
    expect(forceUnwrapIssues.length).toBeGreaterThanOrEqual(1);
  });

  it('should apply severity overrides', async () => {
    const filePath = path.join(tempDir, 'SeverityOverride.swift');
    await fs.writeFile(filePath, 'let view = self.view as! UITableView\n');

    const config: CustomRuleConfig = {
      version: 1,
      rules: [],
      severityOverrides: {
        'test-force-cast': 'error',
      },
    };
    const engine = new CustomRuleEngine(config);
    const result = await engine.scan(filePath, [testForceCastRule]);

    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    // The rule has severity 'warning' but the override should make it 'error'
    expect(result.issues[0]!.severity).toBe('error');
  });

  it('should honor // ios-review-disable-next-line rule-id comments', async () => {
    const filePath = path.join(tempDir, 'DisableLine.swift');
    await fs.writeFile(
      filePath,
      `import UIKit

class VC: UIViewController {
    func setup() {
        // ios-review-disable-next-line test-force-cast
        let view = self.view as! UITableView
        let label = someView as! UILabel
    }
}
`
    );

    const engine = new CustomRuleEngine();
    const result = await engine.scan(filePath, [testForceCastRule]);

    // The first force cast (line 6) should be suppressed by the disable comment on line 5
    // The second force cast (line 7) should still be reported
    const issues = result.issues.filter((i) => i.id === 'test-force-cast');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.lineNumber).toBe(7);
  });

  it('should handle scanning a single file', async () => {
    const filePath = path.join(tempDir, 'SingleFile.swift');
    await fs.writeFile(filePath, 'let x = obj as! String\n');

    const engine = new CustomRuleEngine();
    const result = await engine.scan(filePath, [testForceCastRule]);

    expect(result.analyzer).toBe('Custom Rules');
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    expect(result.issues[0]!.filePath).toBe(filePath);
  });

  it('should handle scanning a directory', async () => {
    const dir = path.join(tempDir, 'scan-dir');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'A.swift'), 'let a = x as! Int\n');
    await fs.writeFile(path.join(dir, 'B.swift'), 'let b = y as! String\n');

    const engine = new CustomRuleEngine();
    const result = await engine.scan(dir, [testForceCastRule]);

    expect(result.issues.length).toBeGreaterThanOrEqual(2);
    const filePaths = result.issues.map((i) => i.filePath);
    expect(filePaths.some((f) => f?.endsWith('A.swift'))).toBe(true);
    expect(filePaths.some((f) => f?.endsWith('B.swift'))).toBe(true);
  });

  it('should return empty issues when no rules match', async () => {
    const filePath = path.join(tempDir, 'CleanCode.swift');
    await fs.writeFile(
      filePath,
      `import UIKit

class ViewController: UIViewController {
    func setup() {
        let view: UITableView? = self.view as? UITableView
    }
}
`
    );

    const engine = new CustomRuleEngine();
    const result = await engine.scan(filePath, [testForceCastRule]);

    expect(result.issues).toHaveLength(0);
    expect(result.passed).toBe(true);
  });

  it('should set passed to false when an error-severity issue is found', async () => {
    const filePath = path.join(tempDir, 'ErrorSeverity.swift');
    await fs.writeFile(filePath, 'let view = self.view as! UITableView\n');

    const errorRule: CompiledRule = {
      ...testForceCastRule,
      severity: 'error',
    };

    const engine = new CustomRuleEngine();
    const result = await engine.scan(filePath, [errorRule]);

    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    expect(result.passed).toBe(false);
  });
});
