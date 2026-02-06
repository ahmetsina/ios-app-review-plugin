/**
 * Tests for ASC endpoint modules: apps, versions, iap, screenshots
 */

jest.mock('../../src/asc/client.js', () => ({
  get: jest.fn(),
  getAllPages: jest.fn(),
}));

import { get, getAllPages } from '../../src/asc/client.js';
import { ASCAppNotFoundError } from '../../src/asc/errors.js';
import {
  getAppByBundleId,
  getAppById,
  getAppInfos,
  getCurrentAppInfo,
  getAppInfoLocalizations,
  getAppInfoLocalization,
  getAppWithInfo,
} from '../../src/asc/endpoints/apps.js';
import {
  getVersions,
  getLatestVersion,
  getVersionById,
  getEditableVersion,
  getVersionLocalizations,
  getVersionLocalization,
  getBuilds,
  getLatestBuild,
  getVersionBuild,
  getVersionWithLocalizations,
} from '../../src/asc/endpoints/versions.js';
import {
  getInAppPurchases,
  getInAppPurchaseById,
  getIAPLocalizations,
  getIAPReviewScreenshot,
  validateIAP,
  validateAllIAPs,
  getIAPStateDescription,
} from '../../src/asc/endpoints/iap.js';
import {
  getScreenshotSets,
  getScreenshots,
  getScreenshotSetsWithScreenshots,
  validateScreenshotSet,
  getDisplayTypeDescription,
  REQUIRED_IPHONE_DISPLAY_TYPES,
  REQUIRED_IPAD_DISPLAY_TYPES,
  COMMONLY_REQUIRED_DISPLAY_TYPES,
} from '../../src/asc/endpoints/screenshots.js';
import type {
  App,
  AppInfo,
  AppInfoLocalization,
  AppStoreVersion,
  AppStoreVersionLocalization,
  Build,
  InAppPurchase,
  InAppPurchaseLocalization,
  InAppPurchaseAppStoreReviewScreenshot,
  AppScreenshotSet,
  AppScreenshot,
} from '../../src/asc/types.js';

const mockGet = get as jest.MockedFunction<typeof get>;
const mockGetAllPages = getAllPages as jest.MockedFunction<typeof getAllPages>;

// --- Mock Data ---

const mockApp: App = {
  type: 'apps',
  id: 'APP123',
  attributes: {
    name: 'Test App',
    bundleId: 'com.test.app',
    sku: 'testapp',
    primaryLocale: 'en-US',
    isOrEverWasMadeForKids: false,
    availableInNewTerritories: true,
  },
};

const mockAppInfo: AppInfo = {
  type: 'appInfos',
  id: 'INFO123',
  attributes: {
    appStoreState: 'PREPARE_FOR_SUBMISSION',
    appStoreAgeRating: '4+',
  },
};

const mockAppInfoReady: AppInfo = {
  type: 'appInfos',
  id: 'INFO456',
  attributes: {
    appStoreState: 'READY_FOR_SALE',
  },
};

const mockAppInfoLocalization: AppInfoLocalization = {
  type: 'appInfoLocalizations',
  id: 'LOC123',
  attributes: {
    locale: 'en-US',
    name: 'Test App',
    subtitle: 'A test app',
    privacyPolicyUrl: 'https://example.com/privacy',
  },
};

const mockAppInfoLocalizationFR: AppInfoLocalization = {
  type: 'appInfoLocalizations',
  id: 'LOC456',
  attributes: {
    locale: 'fr-FR',
    name: 'App Test',
    subtitle: 'Une app test',
  },
};

const mockVersion: AppStoreVersion = {
  type: 'appStoreVersions',
  id: 'VER123',
  attributes: {
    platform: 'IOS',
    versionString: '1.0.0',
    appStoreState: 'PREPARE_FOR_SUBMISSION',
    downloadable: false,
    createdDate: '2024-01-01T00:00:00Z',
  },
};

const mockVersionReleased: AppStoreVersion = {
  type: 'appStoreVersions',
  id: 'VER456',
  attributes: {
    platform: 'IOS',
    versionString: '0.9.0',
    appStoreState: 'READY_FOR_SALE',
    downloadable: true,
    createdDate: '2023-12-01T00:00:00Z',
  },
};

const mockVersionLocalization: AppStoreVersionLocalization = {
  type: 'appStoreVersionLocalizations',
  id: 'VLOC123',
  attributes: {
    locale: 'en-US',
    description: 'A great app',
    keywords: 'test,app',
    supportUrl: 'https://example.com/support',
  },
};

const mockVersionLocalizationFR: AppStoreVersionLocalization = {
  type: 'appStoreVersionLocalizations',
  id: 'VLOC456',
  attributes: {
    locale: 'fr-FR',
    description: 'Une super app',
  },
};

const mockBuild: Build = {
  type: 'builds',
  id: 'BUILD123',
  attributes: {
    version: '1.0.0',
    uploadedDate: '2024-01-01T00:00:00Z',
    expirationDate: '2024-04-01T00:00:00Z',
    expired: false,
    minOsVersion: '16.0',
    processingState: 'VALID',
  },
};

const mockIAP: InAppPurchase = {
  type: 'inAppPurchases',
  id: 'IAP123',
  attributes: {
    name: 'Premium Upgrade',
    productId: 'com.test.app.premium',
    inAppPurchaseType: 'NON_CONSUMABLE',
    state: 'READY_TO_SUBMIT',
  },
};

const mockIAPLocalization: InAppPurchaseLocalization = {
  type: 'inAppPurchaseLocalizations',
  id: 'IAPLOC123',
  attributes: {
    locale: 'en-US',
    name: 'Premium Upgrade',
    description: 'Unlock all features',
  },
};

const mockIAPScreenshot: InAppPurchaseAppStoreReviewScreenshot = {
  type: 'inAppPurchaseAppStoreReviewScreenshots',
  id: 'IAPSS123',
  attributes: {
    fileSize: 50000,
    fileName: 'screenshot.png',
    assetDeliveryState: {
      state: 'COMPLETE',
    },
  },
};

const mockScreenshotSet: AppScreenshotSet = {
  type: 'appScreenshotSets',
  id: 'SSSET123',
  attributes: {
    screenshotDisplayType: 'APP_IPHONE_67',
  },
};

const mockScreenshot: AppScreenshot = {
  type: 'appScreenshots',
  id: 'SS123',
  attributes: {
    fileSize: 100000,
    fileName: 'iphone67_01.png',
    assetDeliveryState: {
      state: 'COMPLETE',
    },
  },
};

// --- Tests ---

describe('ASC Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =================== APPS ===================

  describe('apps', () => {
    describe('getAppByBundleId', () => {
      it('should return the app when found', async () => {
        mockGet.mockResolvedValueOnce({ data: [mockApp] });

        const result = await getAppByBundleId('com.test.app');

        expect(mockGet).toHaveBeenCalledWith('/apps', expect.objectContaining({
          'filter[bundleId]': 'com.test.app',
          limit: 1,
        }));
        expect(result).toEqual(mockApp);
      });

      it('should throw ASCAppNotFoundError when no app found', async () => {
        mockGet.mockResolvedValueOnce({ data: [] });

        await expect(getAppByBundleId('com.nonexistent.app'))
          .rejects.toThrow(ASCAppNotFoundError);
      });

      it('should throw ASCAppNotFoundError with correct bundleId', async () => {
        mockGet.mockResolvedValueOnce({ data: [] });

        try {
          await getAppByBundleId('com.nonexistent.app');
          fail('Expected error');
        } catch (err) {
          expect(err).toBeInstanceOf(ASCAppNotFoundError);
          expect((err as ASCAppNotFoundError).bundleId).toBe('com.nonexistent.app');
        }
      });
    });

    describe('getAppById', () => {
      it('should return app data by ID', async () => {
        mockGet.mockResolvedValueOnce({ data: mockApp });

        const result = await getAppById('APP123');

        expect(mockGet).toHaveBeenCalledWith('/apps/APP123', expect.objectContaining({
          'fields[apps]': expect.any(String),
        }));
        expect(result).toEqual(mockApp);
      });
    });

    describe('getAppInfos', () => {
      it('should return all app infos', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockAppInfo, mockAppInfoReady]);

        const result = await getAppInfos('APP123');

        expect(mockGetAllPages).toHaveBeenCalledWith(
          '/apps/APP123/appInfos',
          expect.any(Object),
        );
        expect(result).toHaveLength(2);
      });
    });

    describe('getCurrentAppInfo', () => {
      it('should return the editable app info', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockAppInfoReady, mockAppInfo]);

        const result = await getCurrentAppInfo('APP123');

        expect(result).toEqual(mockAppInfo);
      });

      it('should fallback to first info when no editable state found', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockAppInfoReady]);

        const result = await getCurrentAppInfo('APP123');

        expect(result).toEqual(mockAppInfoReady);
      });

      it('should return undefined when no app infos exist', async () => {
        mockGetAllPages.mockResolvedValueOnce([]);

        const result = await getCurrentAppInfo('APP123');

        expect(result).toBeUndefined();
      });

      it('should recognize READY_FOR_REVIEW as editable', async () => {
        const readyForReview: AppInfo = {
          type: 'appInfos',
          id: 'INFO789',
          attributes: { appStoreState: 'READY_FOR_REVIEW' },
        };
        mockGetAllPages.mockResolvedValueOnce([mockAppInfoReady, readyForReview]);

        const result = await getCurrentAppInfo('APP123');

        expect(result).toEqual(readyForReview);
      });

      it('should recognize WAITING_FOR_REVIEW as editable', async () => {
        const waiting: AppInfo = {
          type: 'appInfos',
          id: 'INFO_WAIT',
          attributes: { appStoreState: 'WAITING_FOR_REVIEW' },
        };
        mockGetAllPages.mockResolvedValueOnce([waiting]);

        const result = await getCurrentAppInfo('APP123');

        expect(result).toEqual(waiting);
      });

      it('should recognize IN_REVIEW as editable', async () => {
        const inReview: AppInfo = {
          type: 'appInfos',
          id: 'INFO_IR',
          attributes: { appStoreState: 'IN_REVIEW' },
        };
        mockGetAllPages.mockResolvedValueOnce([inReview]);

        const result = await getCurrentAppInfo('APP123');

        expect(result).toEqual(inReview);
      });

      it('should recognize PENDING_DEVELOPER_RELEASE as editable', async () => {
        const pending: AppInfo = {
          type: 'appInfos',
          id: 'INFO_PDR',
          attributes: { appStoreState: 'PENDING_DEVELOPER_RELEASE' },
        };
        mockGetAllPages.mockResolvedValueOnce([pending]);

        const result = await getCurrentAppInfo('APP123');

        expect(result).toEqual(pending);
      });
    });

    describe('getAppInfoLocalizations', () => {
      it('should return all localizations for an app info', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockAppInfoLocalization, mockAppInfoLocalizationFR]);

        const result = await getAppInfoLocalizations('INFO123');

        expect(mockGetAllPages).toHaveBeenCalledWith(
          '/appInfos/INFO123/appInfoLocalizations',
          expect.any(Object),
        );
        expect(result).toHaveLength(2);
      });

      it('should return empty array when no localizations exist', async () => {
        mockGetAllPages.mockResolvedValueOnce([]);

        const result = await getAppInfoLocalizations('INFO123');

        expect(result).toHaveLength(0);
      });
    });

    describe('getAppInfoLocalization', () => {
      it('should find localization by locale', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockAppInfoLocalization, mockAppInfoLocalizationFR]);

        const result = await getAppInfoLocalization('INFO123', 'fr-FR');

        expect(result).toEqual(mockAppInfoLocalizationFR);
      });

      it('should return undefined when locale not found', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockAppInfoLocalization]);

        const result = await getAppInfoLocalization('INFO123', 'de-DE');

        expect(result).toBeUndefined();
      });
    });

    describe('getAppWithInfo', () => {
      it('should return combined app, info, and localizations', async () => {
        // getAppByBundleId -> get
        mockGet.mockResolvedValueOnce({ data: [mockApp] });
        // getCurrentAppInfo -> getAppInfos -> getAllPages
        mockGetAllPages
          .mockResolvedValueOnce([mockAppInfo])
          // getAppInfoLocalizations -> getAllPages
          .mockResolvedValueOnce([mockAppInfoLocalization]);

        const result = await getAppWithInfo('com.test.app');

        expect(result.app).toEqual(mockApp);
        expect(result.appInfo).toEqual(mockAppInfo);
        expect(result.localizations).toEqual([mockAppInfoLocalization]);
      });

      it('should return empty localizations when no app info exists', async () => {
        mockGet.mockResolvedValueOnce({ data: [mockApp] });
        mockGetAllPages.mockResolvedValueOnce([]); // no app infos

        const result = await getAppWithInfo('com.test.app');

        expect(result.app).toEqual(mockApp);
        expect(result.appInfo).toBeUndefined();
        expect(result.localizations).toEqual([]);
      });

      it('should propagate ASCAppNotFoundError', async () => {
        mockGet.mockResolvedValueOnce({ data: [] });

        await expect(getAppWithInfo('com.nonexistent.app'))
          .rejects.toThrow(ASCAppNotFoundError);
      });
    });
  });

  // =================== VERSIONS ===================

  describe('versions', () => {
    describe('getVersions', () => {
      it('should return all versions for an app', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockVersion, mockVersionReleased]);

        const result = await getVersions('APP123');

        expect(mockGetAllPages).toHaveBeenCalledWith(
          '/apps/APP123/appStoreVersions',
          expect.any(Object),
        );
        expect(result).toHaveLength(2);
      });

      it('should filter by platform when provided', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockVersion]);

        await getVersions('APP123', 'IOS');

        expect(mockGetAllPages).toHaveBeenCalledWith(
          '/apps/APP123/appStoreVersions',
          expect.objectContaining({
            'filter[platform]': 'IOS',
          }),
        );
      });

      it('should not include platform filter when not provided', async () => {
        mockGetAllPages.mockResolvedValueOnce([]);

        await getVersions('APP123');

        const callArgs = mockGetAllPages.mock.calls[0]![1] as Record<string, unknown>;
        expect(callArgs['filter[platform]']).toBeUndefined();
      });
    });

    describe('getLatestVersion', () => {
      it('should return the latest version', async () => {
        mockGet.mockResolvedValueOnce({ data: [mockVersion] });

        const result = await getLatestVersion('APP123');

        expect(mockGet).toHaveBeenCalledWith(
          '/apps/APP123/appStoreVersions',
          expect.objectContaining({
            sort: '-createdDate',
            limit: 1,
          }),
        );
        expect(result).toEqual(mockVersion);
      });

      it('should return undefined when no versions exist', async () => {
        mockGet.mockResolvedValueOnce({ data: [] });

        const result = await getLatestVersion('APP123');

        expect(result).toBeUndefined();
      });

      it('should default to IOS platform', async () => {
        mockGet.mockResolvedValueOnce({ data: [] });

        await getLatestVersion('APP123');

        expect(mockGet).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            'filter[platform]': 'IOS',
          }),
        );
      });

      it('should use specified platform', async () => {
        mockGet.mockResolvedValueOnce({ data: [] });

        await getLatestVersion('APP123', 'MAC_OS');

        expect(mockGet).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            'filter[platform]': 'MAC_OS',
          }),
        );
      });
    });

    describe('getVersionById', () => {
      it('should return version by ID', async () => {
        mockGet.mockResolvedValueOnce({ data: mockVersion });

        const result = await getVersionById('VER123');

        expect(mockGet).toHaveBeenCalledWith(
          '/appStoreVersions/VER123',
          expect.any(Object),
        );
        expect(result).toEqual(mockVersion);
      });
    });

    describe('getEditableVersion', () => {
      it('should return version in editable state', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockVersionReleased, mockVersion]);

        const result = await getEditableVersion('APP123');

        expect(result).toEqual(mockVersion);
      });

      it('should return undefined when no editable version exists', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockVersionReleased]);

        const result = await getEditableVersion('APP123');

        expect(result).toBeUndefined();
      });

      it('should recognize REJECTED as editable', async () => {
        const rejected: AppStoreVersion = {
          type: 'appStoreVersions',
          id: 'VER_REJ',
          attributes: {
            platform: 'IOS',
            versionString: '2.0.0',
            appStoreState: 'REJECTED',
            downloadable: false,
            createdDate: '2024-02-01T00:00:00Z',
          },
        };
        mockGetAllPages.mockResolvedValueOnce([rejected]);

        const result = await getEditableVersion('APP123');

        expect(result).toEqual(rejected);
      });

      it('should recognize METADATA_REJECTED as editable', async () => {
        const metaRejected: AppStoreVersion = {
          type: 'appStoreVersions',
          id: 'VER_MR',
          attributes: {
            platform: 'IOS',
            versionString: '2.0.0',
            appStoreState: 'METADATA_REJECTED',
            downloadable: false,
            createdDate: '2024-02-01T00:00:00Z',
          },
        };
        mockGetAllPages.mockResolvedValueOnce([metaRejected]);

        const result = await getEditableVersion('APP123');

        expect(result).toEqual(metaRejected);
      });

      it('should default to IOS platform', async () => {
        mockGetAllPages.mockResolvedValueOnce([]);

        await getEditableVersion('APP123');

        expect(mockGetAllPages).toHaveBeenCalledWith(
          '/apps/APP123/appStoreVersions',
          expect.objectContaining({
            'filter[platform]': 'IOS',
          }),
        );
      });
    });

    describe('getVersionLocalizations', () => {
      it('should return all localizations', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockVersionLocalization, mockVersionLocalizationFR]);

        const result = await getVersionLocalizations('VER123');

        expect(mockGetAllPages).toHaveBeenCalledWith(
          '/appStoreVersions/VER123/appStoreVersionLocalizations',
          expect.any(Object),
        );
        expect(result).toHaveLength(2);
      });
    });

    describe('getVersionLocalization', () => {
      it('should find localization by locale', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockVersionLocalization, mockVersionLocalizationFR]);

        const result = await getVersionLocalization('VER123', 'fr-FR');

        expect(result).toEqual(mockVersionLocalizationFR);
      });

      it('should return undefined when locale not found', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockVersionLocalization]);

        const result = await getVersionLocalization('VER123', 'ja-JP');

        expect(result).toBeUndefined();
      });
    });

    describe('getBuilds', () => {
      it('should return all builds for an app', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockBuild]);

        const result = await getBuilds('APP123');

        expect(mockGetAllPages).toHaveBeenCalledWith(
          '/apps/APP123/builds',
          expect.objectContaining({
            sort: '-uploadedDate',
          }),
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockBuild);
      });
    });

    describe('getLatestBuild', () => {
      it('should return the latest valid build', async () => {
        mockGet.mockResolvedValueOnce({ data: [mockBuild] });

        const result = await getLatestBuild('APP123');

        expect(mockGet).toHaveBeenCalledWith(
          '/apps/APP123/builds',
          expect.objectContaining({
            'filter[processingState]': 'VALID',
            'filter[expired]': 'false',
            sort: '-uploadedDate',
            limit: 1,
          }),
        );
        expect(result).toEqual(mockBuild);
      });

      it('should return undefined when no valid build exists', async () => {
        mockGet.mockResolvedValueOnce({ data: [] });

        const result = await getLatestBuild('APP123');

        expect(result).toBeUndefined();
      });
    });

    describe('getVersionBuild', () => {
      it('should return the build for a version', async () => {
        mockGet.mockResolvedValueOnce({ data: mockBuild });

        const result = await getVersionBuild('VER123');

        expect(mockGet).toHaveBeenCalledWith(
          '/appStoreVersions/VER123/build',
          expect.any(Object),
        );
        expect(result).toEqual(mockBuild);
      });

      it('should return undefined when no build is attached', async () => {
        mockGet.mockRejectedValueOnce(new Error('Not found'));

        const result = await getVersionBuild('VER123');

        expect(result).toBeUndefined();
      });
    });

    describe('getVersionWithLocalizations', () => {
      it('should return version with localizations and build', async () => {
        mockGet
          .mockResolvedValueOnce({ data: mockVersion })   // getVersionById
          .mockResolvedValueOnce({ data: mockBuild });     // getVersionBuild
        mockGetAllPages
          .mockResolvedValueOnce([mockVersionLocalization]); // getVersionLocalizations

        const result = await getVersionWithLocalizations('VER123');

        expect(result.version).toEqual(mockVersion);
        expect(result.localizations).toEqual([mockVersionLocalization]);
        expect(result.build).toEqual(mockBuild);
      });

      it('should handle no build attached', async () => {
        mockGet
          .mockResolvedValueOnce({ data: mockVersion })       // getVersionById
          .mockRejectedValueOnce(new Error('No build'));       // getVersionBuild
        mockGetAllPages
          .mockResolvedValueOnce([mockVersionLocalization]);   // getVersionLocalizations

        const result = await getVersionWithLocalizations('VER123');

        expect(result.version).toEqual(mockVersion);
        expect(result.localizations).toEqual([mockVersionLocalization]);
        expect(result.build).toBeUndefined();
      });
    });
  });

  // =================== IAP ===================

  describe('iap', () => {
    describe('getInAppPurchases', () => {
      it('should return all IAPs for an app', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockIAP]);

        const result = await getInAppPurchases('APP123');

        expect(mockGetAllPages).toHaveBeenCalledWith(
          '/apps/APP123/inAppPurchasesV2',
          expect.any(Object),
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockIAP);
      });

      it('should return empty array when no IAPs exist', async () => {
        mockGetAllPages.mockResolvedValueOnce([]);

        const result = await getInAppPurchases('APP123');

        expect(result).toHaveLength(0);
      });
    });

    describe('getInAppPurchaseById', () => {
      it('should return IAP by ID', async () => {
        mockGet.mockResolvedValueOnce({ data: mockIAP });

        const result = await getInAppPurchaseById('IAP123');

        expect(mockGet).toHaveBeenCalledWith(
          '/inAppPurchasesV2/IAP123',
          expect.any(Object),
        );
        expect(result).toEqual(mockIAP);
      });
    });

    describe('getIAPLocalizations', () => {
      it('should return all localizations for an IAP', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockIAPLocalization]);

        const result = await getIAPLocalizations('IAP123');

        expect(mockGetAllPages).toHaveBeenCalledWith(
          '/inAppPurchasesV2/IAP123/inAppPurchaseLocalizations',
          expect.any(Object),
        );
        expect(result).toHaveLength(1);
      });
    });

    describe('getIAPReviewScreenshot', () => {
      it('should return the review screenshot', async () => {
        mockGet.mockResolvedValueOnce({ data: mockIAPScreenshot });

        const result = await getIAPReviewScreenshot('IAP123');

        expect(mockGet).toHaveBeenCalledWith(
          '/inAppPurchasesV2/IAP123/appStoreReviewScreenshot',
          expect.any(Object),
        );
        expect(result).toEqual(mockIAPScreenshot);
      });

      it('should return undefined when no screenshot exists', async () => {
        mockGet.mockRejectedValueOnce(new Error('Not found'));

        const result = await getIAPReviewScreenshot('IAP123');

        expect(result).toBeUndefined();
      });
    });

    describe('validateIAP', () => {
      it('should validate a ready IAP with no issues', async () => {
        mockGet
          .mockResolvedValueOnce({ data: mockIAP })           // getInAppPurchaseById
          .mockResolvedValueOnce({ data: mockIAPScreenshot }); // getIAPReviewScreenshot
        mockGetAllPages
          .mockResolvedValueOnce([mockIAPLocalization]);       // getIAPLocalizations

        const result = await validateIAP('IAP123');

        expect(result.iap).toEqual(mockIAP);
        expect(result.localizations).toEqual([mockIAPLocalization]);
        expect(result.reviewScreenshot).toEqual(mockIAPScreenshot);
        expect(result.issues).toHaveLength(0);
        expect(result.isReadyForSubmission).toBe(true);
      });

      it('should report issues when IAP state requires action', async () => {
        const rejectedIAP: InAppPurchase = {
          ...mockIAP,
          id: 'IAP_REJ',
          attributes: { ...mockIAP.attributes, state: 'REJECTED' },
        };
        mockGet
          .mockResolvedValueOnce({ data: rejectedIAP })
          .mockResolvedValueOnce({ data: mockIAPScreenshot });
        mockGetAllPages.mockResolvedValueOnce([mockIAPLocalization]);

        const result = await validateIAP('IAP_REJ');

        expect(result.issues).toContain('IAP state requires action: REJECTED');
        expect(result.isReadyForSubmission).toBe(false);
      });

      it('should report missing localizations', async () => {
        mockGet
          .mockResolvedValueOnce({ data: mockIAP })
          .mockResolvedValueOnce({ data: mockIAPScreenshot });
        mockGetAllPages.mockResolvedValueOnce([]);

        const result = await validateIAP('IAP123');

        expect(result.issues).toContain('No localizations configured');
      });

      it('should report missing localization name', async () => {
        const noNameLoc: InAppPurchaseLocalization = {
          type: 'inAppPurchaseLocalizations',
          id: 'IAPLOC_NONAME',
          attributes: {
            locale: 'en-US',
            description: 'A description',
          },
        };
        mockGet
          .mockResolvedValueOnce({ data: mockIAP })
          .mockResolvedValueOnce({ data: mockIAPScreenshot });
        mockGetAllPages.mockResolvedValueOnce([noNameLoc]);

        const result = await validateIAP('IAP123');

        expect(result.issues).toContain('Missing name for locale: en-US');
      });

      it('should report missing localization description', async () => {
        const noDescLoc: InAppPurchaseLocalization = {
          type: 'inAppPurchaseLocalizations',
          id: 'IAPLOC_NODESC',
          attributes: {
            locale: 'en-US',
            name: 'Premium',
          },
        };
        mockGet
          .mockResolvedValueOnce({ data: mockIAP })
          .mockResolvedValueOnce({ data: mockIAPScreenshot });
        mockGetAllPages.mockResolvedValueOnce([noDescLoc]);

        const result = await validateIAP('IAP123');

        expect(result.issues).toContain('Missing description for locale: en-US');
      });

      it('should report missing review screenshot for consumable', async () => {
        const consumable: InAppPurchase = {
          ...mockIAP,
          attributes: { ...mockIAP.attributes, inAppPurchaseType: 'CONSUMABLE' },
        };
        mockGet
          .mockResolvedValueOnce({ data: consumable })
          .mockRejectedValueOnce(new Error('No screenshot')); // getIAPReviewScreenshot fails
        mockGetAllPages.mockResolvedValueOnce([mockIAPLocalization]);

        const result = await validateIAP('IAP123');

        expect(result.issues).toContain('Review screenshot required but not uploaded');
      });

      it('should report missing review screenshot for non-consumable', async () => {
        mockGet
          .mockResolvedValueOnce({ data: mockIAP }) // NON_CONSUMABLE
          .mockRejectedValueOnce(new Error('No screenshot'));
        mockGetAllPages.mockResolvedValueOnce([mockIAPLocalization]);

        const result = await validateIAP('IAP123');

        expect(result.issues).toContain('Review screenshot required but not uploaded');
      });

      it('should not require screenshot for subscriptions', async () => {
        const subscription: InAppPurchase = {
          ...mockIAP,
          attributes: { ...mockIAP.attributes, inAppPurchaseType: 'AUTO_RENEWABLE_SUBSCRIPTION' },
        };
        mockGet
          .mockResolvedValueOnce({ data: subscription })
          .mockRejectedValueOnce(new Error('No screenshot'));
        mockGetAllPages.mockResolvedValueOnce([mockIAPLocalization]);

        const result = await validateIAP('IAP123');

        expect(result.issues).not.toContain('Review screenshot required but not uploaded');
      });

      it('should report failed screenshot processing', async () => {
        const failedScreenshot: InAppPurchaseAppStoreReviewScreenshot = {
          ...mockIAPScreenshot,
          attributes: {
            ...mockIAPScreenshot.attributes,
            assetDeliveryState: { state: 'FAILED' },
          },
        };
        mockGet
          .mockResolvedValueOnce({ data: mockIAP })
          .mockResolvedValueOnce({ data: failedScreenshot });
        mockGetAllPages.mockResolvedValueOnce([mockIAPLocalization]);

        const result = await validateIAP('IAP123');

        expect(result.issues).toContain('Review screenshot failed to process');
      });

      it('should report MISSING_METADATA state', async () => {
        const missingMeta: InAppPurchase = {
          ...mockIAP,
          attributes: { ...mockIAP.attributes, state: 'MISSING_METADATA' },
        };
        mockGet
          .mockResolvedValueOnce({ data: missingMeta })
          .mockResolvedValueOnce({ data: mockIAPScreenshot });
        mockGetAllPages.mockResolvedValueOnce([mockIAPLocalization]);

        const result = await validateIAP('IAP123');

        expect(result.issues).toContain('IAP state requires action: MISSING_METADATA');
      });

      it('should report DEVELOPER_ACTION_NEEDED state', async () => {
        const actionNeeded: InAppPurchase = {
          ...mockIAP,
          attributes: { ...mockIAP.attributes, state: 'DEVELOPER_ACTION_NEEDED' },
        };
        mockGet
          .mockResolvedValueOnce({ data: actionNeeded })
          .mockResolvedValueOnce({ data: mockIAPScreenshot });
        mockGetAllPages.mockResolvedValueOnce([mockIAPLocalization]);

        const result = await validateIAP('IAP123');

        expect(result.issues).toContain('IAP state requires action: DEVELOPER_ACTION_NEEDED');
      });
    });

    describe('validateAllIAPs', () => {
      it('should validate all IAPs for an app', async () => {
        const iap2: InAppPurchase = {
          ...mockIAP,
          id: 'IAP456',
          attributes: { ...mockIAP.attributes, name: 'Coins Pack', productId: 'com.test.coins', inAppPurchaseType: 'CONSUMABLE' },
        };
        // getInAppPurchases
        mockGetAllPages.mockResolvedValueOnce([mockIAP, iap2]);

        // validateIAP for mockIAP
        mockGet
          .mockResolvedValueOnce({ data: mockIAP })
          .mockResolvedValueOnce({ data: mockIAPScreenshot });
        mockGetAllPages.mockResolvedValueOnce([mockIAPLocalization]);

        // validateIAP for iap2
        mockGet
          .mockResolvedValueOnce({ data: iap2 })
          .mockResolvedValueOnce({ data: mockIAPScreenshot });
        mockGetAllPages.mockResolvedValueOnce([mockIAPLocalization]);

        const results = await validateAllIAPs('APP123');

        expect(results).toHaveLength(2);
      });

      it('should return empty array when no IAPs', async () => {
        mockGetAllPages.mockResolvedValueOnce([]);

        const results = await validateAllIAPs('APP123');

        expect(results).toHaveLength(0);
      });
    });

    describe('getIAPStateDescription', () => {
      it('should return description for MISSING_METADATA', () => {
        expect(getIAPStateDescription('MISSING_METADATA')).toBe('Missing required metadata');
      });

      it('should return description for READY_TO_SUBMIT', () => {
        expect(getIAPStateDescription('READY_TO_SUBMIT')).toBe('Ready to submit with next app version');
      });

      it('should return description for APPROVED', () => {
        expect(getIAPStateDescription('APPROVED')).toBe('Approved and active');
      });

      it('should return description for REJECTED', () => {
        expect(getIAPStateDescription('REJECTED')).toBe('Rejected by App Store review');
      });

      it('should return description for WAITING_FOR_REVIEW', () => {
        expect(getIAPStateDescription('WAITING_FOR_REVIEW')).toBe('Waiting for App Store review');
      });

      it('should return description for IN_REVIEW', () => {
        expect(getIAPStateDescription('IN_REVIEW')).toBe('Currently in review');
      });

      it('should return description for DEVELOPER_ACTION_NEEDED', () => {
        expect(getIAPStateDescription('DEVELOPER_ACTION_NEEDED')).toBe('Requires developer action');
      });

      it('should return description for PENDING_BINARY_APPROVAL', () => {
        expect(getIAPStateDescription('PENDING_BINARY_APPROVAL')).toBe('Pending binary approval');
      });

      it('should return description for DEVELOPER_REMOVED_FROM_SALE', () => {
        expect(getIAPStateDescription('DEVELOPER_REMOVED_FROM_SALE')).toBe('Removed from sale by developer');
      });

      it('should return description for REMOVED_FROM_SALE', () => {
        expect(getIAPStateDescription('REMOVED_FROM_SALE')).toBe('Removed from sale');
      });
    });
  });

  // =================== SCREENSHOTS ===================

  describe('screenshots', () => {
    describe('getScreenshotSets', () => {
      it('should return all screenshot sets for a localization', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockScreenshotSet]);

        const result = await getScreenshotSets('VLOC123');

        expect(mockGetAllPages).toHaveBeenCalledWith(
          '/appStoreVersionLocalizations/VLOC123/appScreenshotSets',
          expect.any(Object),
        );
        expect(result).toHaveLength(1);
      });

      it('should return empty array when no screenshot sets exist', async () => {
        mockGetAllPages.mockResolvedValueOnce([]);

        const result = await getScreenshotSets('VLOC123');

        expect(result).toHaveLength(0);
      });
    });

    describe('getScreenshots', () => {
      it('should return all screenshots in a set', async () => {
        mockGetAllPages.mockResolvedValueOnce([mockScreenshot]);

        const result = await getScreenshots('SSSET123');

        expect(mockGetAllPages).toHaveBeenCalledWith(
          '/appScreenshotSets/SSSET123/appScreenshots',
          expect.any(Object),
        );
        expect(result).toHaveLength(1);
      });
    });

    describe('getScreenshotSetsWithScreenshots', () => {
      it('should return sets with their screenshots', async () => {
        const set2: AppScreenshotSet = {
          type: 'appScreenshotSets',
          id: 'SSSET456',
          attributes: { screenshotDisplayType: 'APP_IPHONE_65' },
        };
        // getScreenshotSets
        mockGetAllPages.mockResolvedValueOnce([mockScreenshotSet, set2]);
        // getScreenshots for set 1
        mockGetAllPages.mockResolvedValueOnce([mockScreenshot]);
        // getScreenshots for set 2
        mockGetAllPages.mockResolvedValueOnce([]);

        const result = await getScreenshotSetsWithScreenshots('VLOC123');

        expect(result).toHaveLength(2);
        expect(result[0]!.set).toEqual(mockScreenshotSet);
        expect(result[0]!.screenshots).toEqual([mockScreenshot]);
        expect(result[1]!.set).toEqual(set2);
        expect(result[1]!.screenshots).toEqual([]);
      });

      it('should return empty array when no sets', async () => {
        mockGetAllPages.mockResolvedValueOnce([]);

        const result = await getScreenshotSetsWithScreenshots('VLOC123');

        expect(result).toHaveLength(0);
      });
    });

    describe('validateScreenshotSet', () => {
      it('should validate a valid screenshot set', () => {
        const result = validateScreenshotSet(mockScreenshotSet, [mockScreenshot]);

        expect(result.displayType).toBe('APP_IPHONE_67');
        expect(result.count).toBe(1);
        expect(result.isValid).toBe(true);
        expect(result.hasProcessingErrors).toBe(false);
        expect(result.issues).toHaveLength(0);
      });

      it('should report no screenshots uploaded', () => {
        const result = validateScreenshotSet(mockScreenshotSet, []);

        expect(result.isValid).toBe(false);
        expect(result.issues).toContain('No screenshots uploaded');
      });

      it('should report too many screenshots', () => {
        const manyScreenshots: AppScreenshot[] = Array.from({ length: 11 }, (_, i) => ({
          type: 'appScreenshots' as const,
          id: `SS_${i}`,
          attributes: {
            fileSize: 100000,
            fileName: `screenshot_${i}.png`,
            assetDeliveryState: { state: 'COMPLETE' as const },
          },
        }));

        const result = validateScreenshotSet(mockScreenshotSet, manyScreenshots);

        expect(result.isValid).toBe(false);
        expect(result.issues[0]).toContain('Too many screenshots');
        expect(result.issues[0]).toContain('11/10 max');
      });

      it('should report failed screenshot processing', () => {
        const failedScreenshot: AppScreenshot = {
          type: 'appScreenshots',
          id: 'SS_FAIL',
          attributes: {
            fileSize: 100000,
            fileName: 'bad.png',
            assetDeliveryState: {
              state: 'FAILED',
              errors: [{ code: 'INVALID', description: 'Invalid image dimensions' }],
            },
          },
        };

        const result = validateScreenshotSet(mockScreenshotSet, [failedScreenshot]);

        expect(result.hasProcessingErrors).toBe(true);
        expect(result.issues[0]).toContain('bad.png');
        expect(result.issues[0]).toContain('Invalid image dimensions');
      });

      it('should report failed screenshot without error details', () => {
        const failedScreenshot: AppScreenshot = {
          type: 'appScreenshots',
          id: 'SS_FAIL2',
          attributes: {
            fileSize: 100000,
            fileName: 'bad2.png',
            assetDeliveryState: {
              state: 'FAILED',
            },
          },
        };

        const result = validateScreenshotSet(mockScreenshotSet, [failedScreenshot]);

        expect(result.hasProcessingErrors).toBe(true);
        expect(result.issues[0]).toContain('bad2.png');
        expect(result.issues[0]).toContain('failed to process');
      });

      it('should track processing states', () => {
        const screenshots: AppScreenshot[] = [
          {
            type: 'appScreenshots',
            id: 'SS_A',
            attributes: {
              fileSize: 100000,
              fileName: 'a.png',
              assetDeliveryState: { state: 'COMPLETE' },
            },
          },
          {
            type: 'appScreenshots',
            id: 'SS_B',
            attributes: {
              fileSize: 100000,
              fileName: 'b.png',
              assetDeliveryState: { state: 'UPLOAD_COMPLETE' },
            },
          },
        ];

        const result = validateScreenshotSet(mockScreenshotSet, screenshots);

        expect(result.processingState).toEqual(['COMPLETE', 'UPLOAD_COMPLETE']);
      });

      it('should handle screenshots without assetDeliveryState', () => {
        const noState: AppScreenshot = {
          type: 'appScreenshots',
          id: 'SS_NS',
          attributes: {
            fileSize: 100000,
            fileName: 'nostate.png',
          },
        };

        const result = validateScreenshotSet(mockScreenshotSet, [noState]);

        expect(result.isValid).toBe(true);
        expect(result.processingState).toHaveLength(0);
      });

      it('should handle exactly 10 screenshots', () => {
        const screenshots: AppScreenshot[] = Array.from({ length: 10 }, (_, i) => ({
          type: 'appScreenshots' as const,
          id: `SS_${i}`,
          attributes: {
            fileSize: 100000,
            fileName: `screenshot_${i}.png`,
            assetDeliveryState: { state: 'COMPLETE' as const },
          },
        }));

        const result = validateScreenshotSet(mockScreenshotSet, screenshots);

        expect(result.isValid).toBe(true);
        expect(result.count).toBe(10);
      });

      it('should report failed screenshot with empty errors array', () => {
        const failedScreenshot: AppScreenshot = {
          type: 'appScreenshots',
          id: 'SS_FAIL3',
          attributes: {
            fileSize: 100000,
            fileName: 'empty_errors.png',
            assetDeliveryState: {
              state: 'FAILED',
              errors: [],
            },
          },
        };

        const result = validateScreenshotSet(mockScreenshotSet, [failedScreenshot]);

        expect(result.hasProcessingErrors).toBe(true);
        expect(result.issues[0]).toContain('empty_errors.png');
        expect(result.issues[0]).toContain('failed to process');
      });
    });

    describe('getDisplayTypeDescription', () => {
      it('should return description for iPhone 6.7"', () => {
        expect(getDisplayTypeDescription('APP_IPHONE_67')).toContain('6.7');
      });

      it('should return description for iPad Pro 12.9" 3rd gen', () => {
        expect(getDisplayTypeDescription('APP_IPAD_PRO_3GEN_129')).toContain('12.9');
      });

      it('should return description for Apple Watch Ultra', () => {
        expect(getDisplayTypeDescription('APP_WATCH_ULTRA')).toContain('Watch Ultra');
      });

      it('should return description for Mac Desktop', () => {
        expect(getDisplayTypeDescription('APP_DESKTOP')).toContain('Mac');
      });

      it('should return description for Apple TV', () => {
        expect(getDisplayTypeDescription('APP_APPLE_TV')).toContain('Apple TV');
      });
    });

    describe('constants', () => {
      it('should have required iPhone display types', () => {
        expect(REQUIRED_IPHONE_DISPLAY_TYPES).toContain('APP_IPHONE_67');
        expect(REQUIRED_IPHONE_DISPLAY_TYPES).toContain('APP_IPHONE_65');
        expect(REQUIRED_IPHONE_DISPLAY_TYPES).toContain('APP_IPHONE_55');
      });

      it('should have required iPad display types', () => {
        expect(REQUIRED_IPAD_DISPLAY_TYPES).toContain('APP_IPAD_PRO_3GEN_129');
        expect(REQUIRED_IPAD_DISPLAY_TYPES).toContain('APP_IPAD_PRO_129');
      });

      it('should combine iPhone and iPad types in commonly required', () => {
        expect(COMMONLY_REQUIRED_DISPLAY_TYPES).toEqual([
          ...REQUIRED_IPHONE_DISPLAY_TYPES,
          ...REQUIRED_IPAD_DISPLAY_TYPES,
        ]);
      });
    });
  });
});
