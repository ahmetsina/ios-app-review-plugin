import { EntitlementsAnalyzer } from '../../src/analyzers/entitlements.js';
import type { XcodeProject, AnalyzerOptions } from '../../src/types/index.js';

jest.mock('../../src/parsers/plist.js', () => ({
  parsePlist: jest.fn(),
  fileExists: jest.fn(),
}));

import { parsePlist, fileExists } from '../../src/parsers/plist.js';

const mockParsePlist = parsePlist as jest.MockedFunction<typeof parsePlist>;
const mockFileExists = fileExists as jest.MockedFunction<typeof fileExists>;

describe('EntitlementsAnalyzer', () => {
  let analyzer: EntitlementsAnalyzer;

  const mockProject: XcodeProject = {
    path: '/test/TestApp.xcodeproj',
    name: 'TestApp',
    targets: [
      {
        name: 'TestApp',
        type: 'application',
        bundleIdentifier: 'com.test.app',
        entitlementsPath: '/test/TestApp.entitlements',
        deploymentTarget: '16.0',
        sourceFiles: [],
      },
    ],
    configurations: ['Debug', 'Release'],
  };

  const defaultOptions: AnalyzerOptions = {
    basePath: '/test',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new EntitlementsAnalyzer();
  });

  describe('no entitlements file configured', () => {
    it('should report info issue "no-entitlements-file" when target has no entitlementsPath', async () => {
      const projectNoEnt: XcodeProject = {
        ...mockProject,
        targets: [
          {
            name: 'TestApp',
            type: 'application',
            bundleIdentifier: 'com.test.app',
            deploymentTarget: '16.0',
            sourceFiles: [],
          },
        ],
      };

      const result = await analyzer.analyze(projectNoEnt, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'no-entitlements-file');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('info');
      expect(issue!.description).toContain('TestApp');
    });
  });

  describe('entitlements file not found', () => {
    it('should report error "entitlements-not-found" when file does not exist', async () => {
      mockFileExists.mockResolvedValue(false);

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'entitlements-not-found');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('error');
      expect(issue!.filePath).toBe('/test/TestApp.entitlements');
      expect(result.passed).toBe(false);
    });
  });

  describe('entitlements parse error', () => {
    it('should report error "entitlements-parse-error" when parsePlist throws', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockRejectedValue(new Error('Invalid XML'));

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'entitlements-parse-error');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('error');
      expect(issue!.description).toContain('Invalid XML');
      expect(result.passed).toBe(false);
    });
  });

  describe('debug entitlement (get-task-allow)', () => {
    it('should report warning when get-task-allow is true', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'get-task-allow': true,
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'debug-entitlement-get-task-allow');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('warning');
      expect(issue!.description).toContain('get-task-allow');
    });
  });

  describe('aps-environment validation', () => {
    it('should report error for invalid aps-environment value', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'aps-environment': 'staging',
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'invalid-aps-environment');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('error');
      expect(issue!.description).toContain('staging');
    });

    it('should not report error for valid aps-environment "development"', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'aps-environment': 'development',
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'invalid-aps-environment');
      expect(issue).toBeUndefined();
    });

    it('should not report error for valid aps-environment "production"', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'aps-environment': 'production',
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'invalid-aps-environment');
      expect(issue).toBeUndefined();
    });
  });

  describe('App Group format validation', () => {
    it('should report error for invalid App Group not starting with "group."', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'com.apple.security.application-groups': ['com.test.shared'],
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'invalid-app-group-format');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('error');
      expect(issue!.description).toContain('com.test.shared');
    });

    it('should not report error for valid App Group starting with "group."', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'com.apple.security.application-groups': ['group.com.test.shared'],
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'invalid-app-group-format');
      expect(issue).toBeUndefined();
    });
  });

  describe('Associated Domains format validation', () => {
    it('should report error for invalid Associated Domain format', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'com.apple.developer.associated-domains': ['example.com'],
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'invalid-associated-domain-format');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('error');
      expect(issue!.description).toContain('example.com');
    });

    it('should not report error for valid Associated Domain with applinks: prefix', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'com.apple.developer.associated-domains': ['applinks:example.com'],
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'invalid-associated-domain-format');
      expect(issue).toBeUndefined();
    });
  });

  describe('Keychain Access Group format validation', () => {
    it('should report warning for invalid Keychain Group missing team ID prefix', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'keychain-access-groups': ['noprefix'],
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'invalid-keychain-group-format');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('warning');
      expect(issue!.description).toContain('noprefix');
    });

    it('should not report warning for Keychain Group with $(AppIdentifierPrefix)', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'keychain-access-groups': ['$(AppIdentifierPrefix)com.test.app'],
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'invalid-keychain-group-format');
      expect(issue).toBeUndefined();
    });
  });

  describe('iCloud container format validation', () => {
    it('should report error for invalid iCloud container not starting with "iCloud."', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'com.apple.developer.icloud-container-identifiers': ['com.test.container'],
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'invalid-icloud-container-format');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('error');
      expect(issue!.description).toContain('com.test.container');
    });

    it('should not report error for valid iCloud container starting with "iCloud."', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'com.apple.developer.icloud-container-identifiers': ['iCloud.com.test.container'],
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'invalid-icloud-container-format');
      expect(issue).toBeUndefined();
    });
  });

  describe('Sign in with Apple validation', () => {
    it('should report warning when Sign in with Apple is missing "Default"', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'com.apple.developer.applesignin': ['Custom'],
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'siwa-missing-default');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('warning');
      expect(issue!.description).toContain('Default');
    });

    it('should not report warning when Sign in with Apple includes "Default"', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'com.apple.developer.applesignin': ['Default'],
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'siwa-missing-default');
      expect(issue).toBeUndefined();
    });
  });

  describe('entitlements summary', () => {
    it('should report info issue listing declared entitlements', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'aps-environment': 'production',
        'com.apple.security.application-groups': ['group.com.test.shared'],
        'com.apple.developer.associated-domains': ['applinks:example.com'],
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'entitlements-summary');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('info');
      expect(issue!.description).toContain('aps-environment');
      expect(issue!.description).toContain('com.apple.security.application-groups');
      expect(issue!.description).toContain('com.apple.developer.associated-domains');
    });

    it('should exclude application-identifier and team-identifier from summary', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'application-identifier': 'TEAMID.com.test.app',
        'com.apple.developer.team-identifier': 'TEAMID',
        'aps-environment': 'production',
      });

      const result = await analyzer.analyze(mockProject, defaultOptions);

      const issue = result.issues.find((i) => i.id === 'entitlements-summary');
      expect(issue).toBeDefined();
      expect(issue!.description).not.toContain('application-identifier');
      expect(issue!.description).not.toContain('com.apple.developer.team-identifier');
      expect(issue!.description).toContain('aps-environment');
    });
  });

  describe('target name filter', () => {
    it('should filter targets by options.targetName', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'aps-environment': 'production',
      });

      const multiTargetProject: XcodeProject = {
        ...mockProject,
        targets: [
          {
            name: 'TestApp',
            type: 'application',
            bundleIdentifier: 'com.test.app',
            entitlementsPath: '/test/TestApp.entitlements',
            deploymentTarget: '16.0',
            sourceFiles: [],
          },
          {
            name: 'TestExtension',
            type: 'appExtension',
            bundleIdentifier: 'com.test.app.extension',
            entitlementsPath: '/test/TestExtension.entitlements',
            deploymentTarget: '16.0',
            sourceFiles: [],
          },
        ],
      };

      const optionsWithTarget: AnalyzerOptions = {
        ...defaultOptions,
        targetName: 'TestExtension',
      };

      const result = await analyzer.analyze(multiTargetProject, optionsWithTarget);

      // Should only process TestExtension target, so parsePlist called once
      expect(mockParsePlist).toHaveBeenCalledTimes(1);
      expect(mockParsePlist).toHaveBeenCalledWith('/test/TestExtension.entitlements');
    });
  });

  describe('multiple targets', () => {
    it('should process multiple application targets', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParsePlist.mockResolvedValue({
        'aps-environment': 'production',
      });

      const multiTargetProject: XcodeProject = {
        ...mockProject,
        targets: [
          {
            name: 'MainApp',
            type: 'application',
            bundleIdentifier: 'com.test.main',
            entitlementsPath: '/test/MainApp.entitlements',
            deploymentTarget: '16.0',
            sourceFiles: [],
          },
          {
            name: 'SecondApp',
            type: 'application',
            bundleIdentifier: 'com.test.second',
            entitlementsPath: '/test/SecondApp.entitlements',
            deploymentTarget: '16.0',
            sourceFiles: [],
          },
        ],
      };

      const result = await analyzer.analyze(multiTargetProject, defaultOptions);

      // Both targets should be processed
      expect(mockParsePlist).toHaveBeenCalledTimes(2);
      expect(mockParsePlist).toHaveBeenCalledWith('/test/MainApp.entitlements');
      expect(mockParsePlist).toHaveBeenCalledWith('/test/SecondApp.entitlements');

      // Each target should produce an entitlements-summary
      const summaries = result.issues.filter((i) => i.id === 'entitlements-summary');
      expect(summaries).toHaveLength(2);
    });
  });
});
