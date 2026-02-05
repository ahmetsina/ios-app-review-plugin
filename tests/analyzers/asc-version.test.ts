import { ASCVersionAnalyzer } from '../../src/analyzers/asc-version';
import type { XcodeProject } from '../../src/types/index';

// Mock the ASC module
jest.mock('../../src/asc/index', () => ({
  hasCredentials: jest.fn(),
  getAppByBundleId: jest.fn(),
  getLatestVersion: jest.fn(),
  getLatestBuild: jest.fn(),
  getEditableVersion: jest.fn(),
  getVersionWithLocalizations: jest.fn(),
  isASCError: jest.fn().mockReturnValue(false),
}));

// Mock the plist parser
jest.mock('../../src/parsers/plist', () => ({
  parsePlist: jest.fn(),
}));

const mocks = jest.requireMock('../../src/asc/index');
const mockParsePlist = jest.requireMock('../../src/parsers/plist').parsePlist as jest.Mock;

const mockProject: XcodeProject = {
  path: '/test/TestApp.xcodeproj',
  name: 'TestApp',
  targets: [
    {
      name: 'TestApp',
      type: 'application',
      bundleIdentifier: 'com.test.app',
      infoPlistPath: '/test/TestApp/Info.plist',
      sourceFiles: [],
    },
  ],
  configurations: ['Debug', 'Release'],
};

describe('ASCVersionAnalyzer', () => {
  let analyzer: ASCVersionAnalyzer;

  beforeEach(() => {
    analyzer = new ASCVersionAnalyzer();
    jest.clearAllMocks();
  });

  describe('analyze', () => {
    it('should return info issue when credentials are not configured', async () => {
      mocks.hasCredentials.mockReturnValue(false);

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.id).toBe('asc-credentials-not-configured');
      expect(result.issues[0]?.severity).toBe('info');
    });

    it('should return warning when no bundle ID found', async () => {
      mocks.hasCredentials.mockReturnValue(true);

      const projectWithoutBundleId: XcodeProject = {
        ...mockProject,
        targets: [{ name: 'TestApp', type: 'application', sourceFiles: [] }],
      };

      const result = await analyzer.analyze(projectWithoutBundleId, { basePath: '/test' });

      expect(result.passed).toBe(true);
      expect(result.issues[0]?.id).toBe('asc-no-bundle-id');
    });

    it('should detect rejected version', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mockParsePlist.mockResolvedValue({
        CFBundleShortVersionString: '1.0.0',
        CFBundleVersion: '1',
      });
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.getLatestVersion.mockResolvedValue({
        id: 'ver-1',
        type: 'appStoreVersions',
        attributes: { versionString: '1.0.0', appStoreState: 'READY_FOR_SALE' },
      });
      mocks.getLatestBuild.mockResolvedValue(null);
      mocks.getEditableVersion.mockResolvedValue({
        id: 'ver-2',
        type: 'appStoreVersions',
        attributes: { versionString: '1.1.0', appStoreState: 'REJECTED' },
      });
      mocks.getVersionWithLocalizations.mockResolvedValue({
        version: {
          id: 'ver-2',
          attributes: { versionString: '1.1.0', appStoreState: 'REJECTED' },
        },
        localizations: [
          {
            id: 'loc-1',
            attributes: {
              locale: 'en-US',
              whatsNew: 'Bug fixes',
              description: 'An app',
              supportUrl: 'https://example.com',
            },
          },
        ],
        build: null,
      });

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      expect(result.issues.some((i) => i.id === 'asc-version-rejected')).toBe(true);
    });
  });

  describe('compareVersions', () => {
    it('should return error when credentials not configured', async () => {
      mocks.hasCredentials.mockReturnValue(false);

      const result = await analyzer.compareVersions('com.test.app');

      expect(result.passed).toBe(false);
      expect(result.issues[0]?.severity).toBe('error');
    });

    it('should detect lower local version', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.getLatestVersion.mockResolvedValue({
        id: 'ver-1',
        type: 'appStoreVersions',
        attributes: { versionString: '2.0.0', appStoreState: 'READY_FOR_SALE' },
      });
      mocks.getLatestBuild.mockResolvedValue(null);
      mocks.getEditableVersion.mockResolvedValue(null);

      const result = await analyzer.compareVersions('com.test.app', '1.0.0');

      expect(result.issues.some((i) => i.id === 'asc-local-version-lower')).toBe(true);
    });

    it('should detect build number not incremented', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.getLatestVersion.mockResolvedValue(null);
      mocks.getLatestBuild.mockResolvedValue({
        id: 'build-1',
        type: 'builds',
        attributes: { version: '42' },
      });
      mocks.getEditableVersion.mockResolvedValue(null);

      const result = await analyzer.compareVersions('com.test.app', undefined, '42');

      expect(result.issues.some((i) => i.id === 'asc-build-number-not-incremented')).toBe(true);
    });

    it('should detect missing whats new text', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.getLatestVersion.mockResolvedValue(null);
      mocks.getLatestBuild.mockResolvedValue(null);
      mocks.getEditableVersion.mockResolvedValue({
        id: 'ver-1',
        type: 'appStoreVersions',
        attributes: { versionString: '1.0.0', appStoreState: 'PREPARE_FOR_SUBMISSION' },
      });
      mocks.getVersionWithLocalizations.mockResolvedValue({
        version: {
          id: 'ver-1',
          attributes: { versionString: '1.0.0', appStoreState: 'PREPARE_FOR_SUBMISSION' },
        },
        localizations: [
          {
            id: 'loc-1',
            attributes: {
              locale: 'en-US',
              whatsNew: null,
              description: 'An app',
              supportUrl: 'https://example.com',
            },
          },
        ],
        build: { id: 'build-1', type: 'builds', attributes: { version: '1' } },
      });

      const result = await analyzer.compareVersions('com.test.app');

      expect(result.issues.some((i) => i.id === 'asc-missing-whats-new')).toBe(true);
    });

    it('should detect missing description', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.getLatestVersion.mockResolvedValue(null);
      mocks.getLatestBuild.mockResolvedValue(null);
      mocks.getEditableVersion.mockResolvedValue({
        id: 'ver-1',
        type: 'appStoreVersions',
        attributes: { versionString: '1.0.0', appStoreState: 'PREPARE_FOR_SUBMISSION' },
      });
      mocks.getVersionWithLocalizations.mockResolvedValue({
        version: {
          id: 'ver-1',
          attributes: { versionString: '1.0.0', appStoreState: 'PREPARE_FOR_SUBMISSION' },
        },
        localizations: [
          {
            id: 'loc-1',
            attributes: {
              locale: 'en-US',
              whatsNew: 'Bug fixes',
              description: null,
              supportUrl: 'https://example.com',
            },
          },
        ],
        build: { id: 'build-1', type: 'builds', attributes: { version: '1' } },
      });

      const result = await analyzer.compareVersions('com.test.app');

      expect(result.issues.some((i) => i.id === 'asc-missing-description')).toBe(true);
    });

    it('should detect no build attached', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.getLatestVersion.mockResolvedValue(null);
      mocks.getLatestBuild.mockResolvedValue(null);
      mocks.getEditableVersion.mockResolvedValue({
        id: 'ver-1',
        type: 'appStoreVersions',
        attributes: { versionString: '1.0.0', appStoreState: 'PREPARE_FOR_SUBMISSION' },
      });
      mocks.getVersionWithLocalizations.mockResolvedValue({
        version: {
          id: 'ver-1',
          attributes: { versionString: '1.0.0', appStoreState: 'PREPARE_FOR_SUBMISSION' },
        },
        localizations: [
          {
            id: 'loc-1',
            attributes: {
              locale: 'en-US',
              whatsNew: 'Bug fixes',
              description: 'An app',
              supportUrl: 'https://example.com',
            },
          },
        ],
        build: null,
      });

      const result = await analyzer.compareVersions('com.test.app');

      expect(result.issues.some((i) => i.id === 'asc-no-build-attached')).toBe(true);
    });
  });
});
