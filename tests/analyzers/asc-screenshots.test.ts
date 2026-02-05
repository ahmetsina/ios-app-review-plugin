import { ASCScreenshotAnalyzer } from '../../src/analyzers/asc-screenshots';
import type { XcodeProject } from '../../src/types/index';

// Mock the ASC module
jest.mock('../../src/asc/index', () => ({
  hasCredentials: jest.fn(),
  getAppByBundleId: jest.fn(),
  getEditableVersion: jest.fn(),
  getVersionLocalizations: jest.fn(),
  getScreenshotSetsWithScreenshots: jest.fn(),
  REQUIRED_IPHONE_DISPLAY_TYPES: ['APP_IPHONE_65', 'APP_IPHONE_55'],
  REQUIRED_IPAD_DISPLAY_TYPES: ['APP_IPAD_PRO_129'],
  getDisplayTypeDescription: jest.fn((type: string) => type),
  validateScreenshotSet: jest.fn().mockReturnValue({ hasProcessingErrors: false, issues: [] }),
  isASCError: jest.fn().mockReturnValue(false),
}));

const mocks = jest.requireMock('../../src/asc/index');

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

describe('ASCScreenshotAnalyzer', () => {
  let analyzer: ASCScreenshotAnalyzer;

  beforeEach(() => {
    analyzer = new ASCScreenshotAnalyzer();
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
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.id).toBe('asc-no-bundle-id');
    });

    it('should return info when no editable version found', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.getEditableVersion.mockResolvedValue(null);

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      expect(result.issues.some((i: { id: string }) => i.id === 'asc-no-editable-version')).toBe(true);
    });

    it('should validate screenshots when version exists', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.getEditableVersion.mockResolvedValue({
        id: 'ver-1',
        type: 'appStoreVersions',
        attributes: { versionString: '1.0.0', appStoreState: 'PREPARE_FOR_SUBMISSION' },
      });
      mocks.getVersionLocalizations.mockResolvedValue([
        {
          id: 'loc-1',
          type: 'appStoreVersionLocalizations',
          attributes: { locale: 'en-US' },
        },
      ]);
      mocks.getScreenshotSetsWithScreenshots.mockResolvedValue([
        {
          set: {
            id: 'set-1',
            type: 'appScreenshotSets',
            attributes: { screenshotDisplayType: 'APP_IPHONE_65' },
          },
          screenshots: [
            { id: 'ss-1', type: 'appScreenshots', attributes: { fileName: 'test.png', assetDeliveryState: { state: 'COMPLETE' } } },
          ],
        },
      ]);

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      // Should have some issues (missing some device sizes) but not error
      expect(result.analyzer).toBe('ASC Screenshot Analyzer');
    });
  });

  describe('validateByBundleId', () => {
    it('should return error when credentials not configured', async () => {
      mocks.hasCredentials.mockReturnValue(false);

      const result = await analyzer.validateByBundleId('com.test.app');

      expect(result.passed).toBe(false);
      expect(result.issues[0]?.severity).toBe('error');
    });

    it('should validate screenshots for given bundle ID', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.getEditableVersion.mockResolvedValue(null);

      const result = await analyzer.validateByBundleId('com.test.app');

      expect(result.analyzer).toBe('ASC Screenshot Analyzer');
      expect(result.issues.some((i: { id: string }) => i.id === 'asc-no-editable-version')).toBe(true);
    });
  });
});
