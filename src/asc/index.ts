/**
 * App Store Connect API Module
 *
 * Exports authentication, client, and endpoint functions for interacting
 * with the App Store Connect API.
 */

// Auth
export { getToken, clearTokenCache, hasCredentials } from './auth.js';

// Client
export { request, get, getAllPages, resetRateLimiter } from './client.js';

// Errors
export {
  ASCBaseError,
  ASCAuthError,
  ASCCredentialsNotConfiguredError,
  ASCAppNotFoundError,
  ASCRateLimitError,
  ASCAPIError,
  isASCError,
  areCredentialsConfigured,
} from './errors.js';

// Types
export type {
  AppStoreState,
  ScreenshotDisplayType,
  IAPType,
  IAPState,
  ScreenshotState,
  Platform,
  ASCResponse,
  ASCListResponse,
  ASCLinks,
  ASCPaginationLinks,
  ASCMeta,
  ASCResource,
  ASCRelationship,
  ASCResourceIdentifier,
  App,
  AppInfo,
  AppInfoLocalization,
  AppStoreVersion,
  AppStoreVersionLocalization,
  Build,
  AppScreenshotSet,
  AppScreenshot,
  InAppPurchase,
  InAppPurchaseLocalization,
  InAppPurchaseAppStoreReview,
  InAppPurchaseAppStoreReviewScreenshot,
  ASCErrorResponse,
  ASCError,
} from './types.js';

// App endpoints
export {
  getAppByBundleId,
  getAppById,
  getAppInfos,
  getCurrentAppInfo,
  getAppInfoLocalizations,
  getAppInfoLocalization,
  getAppWithInfo,
} from './endpoints/apps.js';
export type { AppWithInfo } from './endpoints/apps.js';

// Version endpoints
export {
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
} from './endpoints/versions.js';
export type { VersionWithLocalizations } from './endpoints/versions.js';

// Screenshot endpoints
export {
  getScreenshotSets,
  getScreenshots,
  getScreenshotSetsWithScreenshots,
  REQUIRED_IPHONE_DISPLAY_TYPES,
  REQUIRED_IPAD_DISPLAY_TYPES,
  COMMONLY_REQUIRED_DISPLAY_TYPES,
  getDisplayTypeDescription,
  validateScreenshotSet,
} from './endpoints/screenshots.js';
export type { ScreenshotSetWithScreenshots, ScreenshotValidation } from './endpoints/screenshots.js';

// IAP endpoints
export {
  getInAppPurchases,
  getInAppPurchaseById,
  getIAPLocalizations,
  getIAPReviewScreenshot,
  validateIAP,
  validateAllIAPs,
  getIAPStateDescription,
} from './endpoints/iap.js';
export type { IAPValidation } from './endpoints/iap.js';
