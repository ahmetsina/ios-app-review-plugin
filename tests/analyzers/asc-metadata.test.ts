import { ASCMetadataAnalyzer } from '../../src/analyzers/asc-metadata';
import type { XcodeProject } from '../../src/types/index';

// Mock the ASC module
jest.mock('../../src/asc/index', () => ({
  hasCredentials: jest.fn(),
  getAppWithInfo: jest.fn(),
  isASCError: jest.fn().mockReturnValue(false),
}));

const mockHasCredentials = jest.requireMock('../../src/asc/index').hasCredentials as jest.Mock;
const mockGetAppWithInfo = jest.requireMock('../../src/asc/index').getAppWithInfo as jest.Mock;

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

describe('ASCMetadataAnalyzer', () => {
  let analyzer: ASCMetadataAnalyzer;

  beforeEach(() => {
    analyzer = new ASCMetadataAnalyzer();
    jest.clearAllMocks();
  });

  describe('analyze', () => {
    it('should return info issue when credentials are not configured', async () => {
      mockHasCredentials.mockReturnValue(false);

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.id).toBe('asc-credentials-not-configured');
      expect(result.issues[0]?.severity).toBe('info');
    });

    it('should return warning when no bundle ID found', async () => {
      mockHasCredentials.mockReturnValue(true);

      const projectWithoutBundleId: XcodeProject = {
        ...mockProject,
        targets: [{ name: 'TestApp', type: 'application', sourceFiles: [] }],
      };

      const result = await analyzer.analyze(projectWithoutBundleId, { basePath: '/test' });

      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.id).toBe('asc-no-bundle-id');
      expect(result.issues[0]?.severity).toBe('warning');
    });

    it('should validate metadata when credentials are configured', async () => {
      mockHasCredentials.mockReturnValue(true);
      mockGetAppWithInfo.mockResolvedValue({
        app: {
          id: '123',
          type: 'apps',
          attributes: { name: 'TestApp', bundleId: 'com.test.app', primaryLocale: 'en-US' },
        },
        localizations: [
          {
            id: 'loc-1',
            type: 'appInfoLocalizations',
            attributes: {
              locale: 'en-US',
              name: 'TestApp',
              subtitle: 'A great app',
              privacyPolicyUrl: 'https://example.com/privacy',
            },
          },
        ],
      });

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      expect(result.passed).toBe(true);
    });

    it('should detect app name too long', async () => {
      mockHasCredentials.mockReturnValue(true);
      mockGetAppWithInfo.mockResolvedValue({
        app: {
          id: '123',
          type: 'apps',
          attributes: { name: 'TestApp', bundleId: 'com.test.app', primaryLocale: 'en-US' },
        },
        localizations: [
          {
            id: 'loc-1',
            type: 'appInfoLocalizations',
            attributes: {
              locale: 'en-US',
              name: 'This App Name Is Way Too Long For The App Store Limit',
              subtitle: null,
              privacyPolicyUrl: 'https://example.com/privacy',
            },
          },
        ],
      });

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      expect(result.issues.some((i) => i.id === 'asc-name-too-long')).toBe(true);
    });

    it('should detect missing privacy policy URL', async () => {
      mockHasCredentials.mockReturnValue(true);
      mockGetAppWithInfo.mockResolvedValue({
        app: {
          id: '123',
          type: 'apps',
          attributes: { name: 'TestApp', bundleId: 'com.test.app', primaryLocale: 'en-US' },
        },
        localizations: [
          {
            id: 'loc-1',
            type: 'appInfoLocalizations',
            attributes: {
              locale: 'en-US',
              name: 'TestApp',
              subtitle: null,
              privacyPolicyUrl: null,
            },
          },
        ],
      });

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      expect(result.issues.some((i) => i.id === 'asc-missing-privacy-policy')).toBe(true);
    });

    it('should detect placeholder text', async () => {
      mockHasCredentials.mockReturnValue(true);
      mockGetAppWithInfo.mockResolvedValue({
        app: {
          id: '123',
          type: 'apps',
          attributes: { name: 'TestApp', bundleId: 'com.test.app', primaryLocale: 'en-US' },
        },
        localizations: [
          {
            id: 'loc-1',
            type: 'appInfoLocalizations',
            attributes: {
              locale: 'en-US',
              name: 'Lorem ipsum dolor sit amet',
              subtitle: null,
              privacyPolicyUrl: 'https://example.com/privacy',
            },
          },
        ],
      });

      const result = await analyzer.analyze(mockProject, { basePath: '/test' });

      expect(result.issues.some((i) => i.id === 'asc-name-placeholder')).toBe(true);
    });
  });

  describe('validateByBundleId', () => {
    it('should return error when credentials not configured', async () => {
      mockHasCredentials.mockReturnValue(false);

      const result = await analyzer.validateByBundleId('com.test.app');

      expect(result.passed).toBe(false);
      expect(result.issues[0]?.severity).toBe('error');
    });

    it('should validate metadata for valid bundle ID', async () => {
      mockHasCredentials.mockReturnValue(true);
      mockGetAppWithInfo.mockResolvedValue({
        app: {
          id: '123',
          type: 'apps',
          attributes: { name: 'TestApp', bundleId: 'com.test.app', primaryLocale: 'en-US' },
        },
        localizations: [
          {
            id: 'loc-1',
            type: 'appInfoLocalizations',
            attributes: {
              locale: 'en-US',
              name: 'TestApp',
              subtitle: null,
              privacyPolicyUrl: 'https://example.com/privacy',
            },
          },
        ],
      });

      const result = await analyzer.validateByBundleId('com.test.app');

      expect(result.passed).toBe(true);
    });
  });
});
