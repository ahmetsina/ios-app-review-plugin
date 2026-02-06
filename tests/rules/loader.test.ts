import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { RuleLoader } from '../../src/rules/loader.js';
import type { CustomRuleConfig } from '../../src/rules/types.js';

describe('RuleLoader', () => {
  let tempDir: string;
  let loader: RuleLoader;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rule-loader-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    loader = new RuleLoader();
  });

  const validConfig: CustomRuleConfig = {
    version: 1,
    rules: [
      {
        id: 'test-force-cast',
        title: 'Force cast detected',
        description: 'Force casts can cause runtime crashes',
        severity: 'warning',
        pattern: 'as!\\s+\\w+',
        fileTypes: ['.swift'],
      },
      {
        id: 'test-force-unwrap',
        title: 'Force unwrap detected',
        description: 'Force unwraps can cause runtime crashes',
        severity: 'warning',
        pattern: '\\w+!\\.',
      },
    ],
    disabledRules: ['test-force-unwrap'],
    severityOverrides: {
      'test-force-cast': 'error',
    },
  };

  describe('findConfig()', () => {
    it('should find config in the current directory', async () => {
      const dir = path.join(tempDir, 'find-current');
      await fs.mkdir(dir, { recursive: true });
      const configPath = path.join(dir, '.ios-review-rules.json');
      await fs.writeFile(configPath, JSON.stringify(validConfig));

      const result = await loader.findConfig(dir);
      expect(result).toBe(configPath);
    });

    it('should find config in a parent directory', async () => {
      const parentDir = path.join(tempDir, 'find-parent');
      const childDir = path.join(parentDir, 'sub', 'deep');
      await fs.mkdir(childDir, { recursive: true });
      const configPath = path.join(parentDir, '.ios-review-rules.json');
      await fs.writeFile(configPath, JSON.stringify(validConfig));

      const result = await loader.findConfig(childDir);
      expect(result).toBe(configPath);
    });

    it('should return null when no config exists', async () => {
      const dir = path.join(tempDir, 'find-none');
      await fs.mkdir(dir, { recursive: true });

      const result = await loader.findConfig(dir);
      expect(result).toBeNull();
    });
  });

  describe('loadConfig()', () => {
    it('should parse a valid config file', async () => {
      const configPath = path.join(tempDir, 'valid-config.json');
      await fs.writeFile(configPath, JSON.stringify(validConfig));

      const config = await loader.loadConfig(configPath);
      expect(config.version).toBe(1);
      expect(config.rules).toHaveLength(2);
      expect(config.rules[0]!.id).toBe('test-force-cast');
      expect(config.rules[1]!.id).toBe('test-force-unwrap');
      expect(config.disabledRules).toEqual(['test-force-unwrap']);
      expect(config.severityOverrides).toEqual({ 'test-force-cast': 'error' });
    });

    it('should throw on invalid JSON', async () => {
      const configPath = path.join(tempDir, 'invalid-json.json');
      await fs.writeFile(configPath, '{ this is not valid json }');

      await expect(loader.loadConfig(configPath)).rejects.toThrow();
    });

    it('should throw on invalid schema (missing required fields)', async () => {
      const configPath = path.join(tempDir, 'invalid-schema.json');
      const invalidConfig = {
        version: 1,
        rules: [
          {
            // Missing required fields: id, title, description, severity, pattern
            id: 'incomplete',
          },
        ],
      };
      await fs.writeFile(configPath, JSON.stringify(invalidConfig));

      await expect(loader.loadConfig(configPath)).rejects.toThrow();
    });
  });

  describe('compileRules()', () => {
    it('should compile regex patterns with default g flag', () => {
      const config: CustomRuleConfig = {
        version: 1,
        rules: [
          {
            id: 'test-rule',
            title: 'Test Rule',
            description: 'A test rule',
            severity: 'warning',
            pattern: 'as!\\s+\\w+',
          },
        ],
      };

      const compiled = loader.compileRules(config);
      expect(compiled).toHaveLength(1);
      expect(compiled[0]!.regex).toBeInstanceOf(RegExp);
      expect(compiled[0]!.regex.flags).toBe('g');
      expect(compiled[0]!.regex.source).toBe('as!\\s+\\w+');
    });

    it('should respect custom flags', () => {
      const config: CustomRuleConfig = {
        version: 1,
        rules: [
          {
            id: 'test-case-insensitive',
            title: 'Case Insensitive Test',
            description: 'A case insensitive test',
            severity: 'info',
            pattern: 'todo',
            flags: 'gi',
          },
        ],
      };

      const compiled = loader.compileRules(config);
      expect(compiled).toHaveLength(1);
      expect(compiled[0]!.regex.flags).toContain('g');
      expect(compiled[0]!.regex.flags).toContain('i');
    });
  });

  describe('loadFromProject()', () => {
    it('should return null when no config found', async () => {
      const dir = path.join(tempDir, 'no-project-config');
      await fs.mkdir(dir, { recursive: true });

      const result = await loader.loadFromProject(dir);
      expect(result).toBeNull();
    });

    it('should find, load, and compile rules from project directory', async () => {
      const dir = path.join(tempDir, 'full-load-project');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, '.ios-review-rules.json'),
        JSON.stringify(validConfig)
      );

      const result = await loader.loadFromProject(dir);
      expect(result).not.toBeNull();
      expect(result!.config.version).toBe(1);
      expect(result!.config.rules).toHaveLength(2);
      expect(result!.rules).toHaveLength(2);
      expect(result!.rules[0]!.regex).toBeInstanceOf(RegExp);
    });
  });
});
