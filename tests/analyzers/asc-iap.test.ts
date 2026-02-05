import { ASCIAPAnalyzer } from '../../src/analyzers/asc-iap';
import type { XcodeProject } from '../../src/types/index';

// Mock the ASC module
jest.mock('../../src/asc/index', () => ({
  hasCredentials: jest.fn(),
  getAppByBundleId: jest.fn(),
  validateAllIAPs: jest.fn(),
  getIAPStateDescription: jest.fn().mockReturnValue('Missing Metadata'),
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

describe('ASCIAPAnalyzer', () => {
  let analyzer: ASCIAPAnalyzer;

  beforeEach(() => {
    analyzer = new ASCIAPAnalyzer();
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

    it('should return info when no IAPs configured', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.validateAllIAPs.mockResolvedValue([]);

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      expect(result.issues.some((i) => i.id === 'asc-no-iaps')).toBe(true);
    });

    it('should detect IAP with missing metadata', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.validateAllIAPs.mockResolvedValue([
        {
          iap: {
            id: 'iap-1',
            type: 'inAppPurchases',
            attributes: {
              name: 'Premium Feature',
              productId: 'com.test.premium',
              inAppPurchaseType: 'NON_CONSUMABLE',
              state: 'MISSING_METADATA',
            },
          },
          localizations: [],
          reviewScreenshot: undefined,
          isReadyForSubmission: false,
        },
      ]);

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.id === 'asc-iap-missing-metadata')).toBe(true);
      expect(result.issues.some((i) => i.id === 'asc-iap-no-localizations')).toBe(true);
      expect(result.issues.some((i) => i.id === 'asc-iap-missing-screenshot')).toBe(true);
    });

    it('should detect IAP with missing review screenshot', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.validateAllIAPs.mockResolvedValue([
        {
          iap: {
            id: 'iap-1',
            type: 'inAppPurchases',
            attributes: {
              name: 'Premium Feature',
              productId: 'com.test.premium',
              inAppPurchaseType: 'CONSUMABLE',
              state: 'READY_TO_SUBMIT',
            },
          },
          localizations: [
            {
              id: 'loc-1',
              type: 'inAppPurchaseLocalizations',
              attributes: { locale: 'en-US', name: 'Premium', description: 'Unlock premium' },
            },
          ],
          reviewScreenshot: undefined,
          isReadyForSubmission: false,
        },
      ]);

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      expect(result.issues.some((i) => i.id === 'asc-iap-missing-screenshot')).toBe(true);
    });

    it('should pass with fully configured IAP', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.validateAllIAPs.mockResolvedValue([
        {
          iap: {
            id: 'iap-1',
            type: 'inAppPurchases',
            attributes: {
              name: 'Premium Feature',
              productId: 'com.test.premium',
              inAppPurchaseType: 'NON_CONSUMABLE',
              state: 'READY_TO_SUBMIT',
            },
          },
          localizations: [
            {
              id: 'loc-1',
              type: 'inAppPurchaseLocalizations',
              attributes: { locale: 'en-US', name: 'Premium', description: 'Unlock premium features' },
            },
          ],
          reviewScreenshot: {
            id: 'ss-1',
            type: 'inAppPurchaseAppStoreReviewScreenshots',
            attributes: { fileName: 'screenshot.png', assetDeliveryState: { state: 'COMPLETE' } },
          },
          isReadyForSubmission: true,
        },
      ]);

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      expect(result.passed).toBe(true);
    });
  });

  describe('validateByBundleId', () => {
    it('should return error when credentials not configured', async () => {
      mocks.hasCredentials.mockReturnValue(false);

      const result = await analyzer.validateByBundleId('com.test.app');

      expect(result.passed).toBe(false);
      expect(result.issues[0]?.severity).toBe('error');
    });

    it('should validate IAPs for given bundle ID', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.validateAllIAPs.mockResolvedValue([]);

      const result = await analyzer.validateByBundleId('com.test.app');

      expect(result.analyzer).toBe('ASC IAP Analyzer');
      expect(result.issues.some((i) => i.id === 'asc-no-iaps')).toBe(true);
    });

    it('should detect rejected IAP', async () => {
      mocks.hasCredentials.mockReturnValue(true);
      mocks.getAppByBundleId.mockResolvedValue({ id: 'app-1', type: 'apps' });
      mocks.validateAllIAPs.mockResolvedValue([
        {
          iap: {
            id: 'iap-1',
            type: 'inAppPurchases',
            attributes: {
              name: 'Premium',
              productId: 'com.test.premium',
              inAppPurchaseType: 'NON_CONSUMABLE',
              state: 'REJECTED',
            },
          },
          localizations: [
            {
              id: 'loc-1',
              type: 'inAppPurchaseLocalizations',
              attributes: { locale: 'en-US', name: 'Premium', description: 'Desc' },
            },
          ],
          reviewScreenshot: {
            id: 'ss-1',
            type: 'inAppPurchaseAppStoreReviewScreenshots',
            attributes: { fileName: 'screenshot.png', assetDeliveryState: { state: 'COMPLETE' } },
          },
          isReadyForSubmission: false,
        },
      ]);

      const result = await analyzer.validateByBundleId('com.test.app');

      expect(result.issues.some((i) => i.id === 'asc-iap-rejected')).toBe(true);
    });
  });
});
