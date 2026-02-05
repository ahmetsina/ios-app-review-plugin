/**
 * App Store Connect App Endpoints
 */

import { get, getAllPages } from '../client.js';
import { ASCAppNotFoundError } from '../errors.js';
import type {
  ASCResponse,
  ASCListResponse,
  App,
  AppInfo,
  AppInfoLocalization,
} from '../types.js';

/**
 * Get an app by its bundle ID
 */
export async function getAppByBundleId(bundleId: string): Promise<App> {
  const response = await get<ASCListResponse<App>>('/apps', {
    'filter[bundleId]': bundleId,
    'fields[apps]': 'name,bundleId,sku,primaryLocale,contentRightsDeclaration,isOrEverWasMadeForKids,availableInNewTerritories',
    limit: 1,
  });

  const app = response.data[0];
  if (!app) {
    throw new ASCAppNotFoundError(bundleId);
  }

  return app;
}

/**
 * Get an app by its ASC ID
 */
export async function getAppById(appId: string): Promise<App> {
  const response = await get<ASCResponse<App>>(`/apps/${appId}`, {
    'fields[apps]': 'name,bundleId,sku,primaryLocale,contentRightsDeclaration,isOrEverWasMadeForKids,availableInNewTerritories',
  });

  return response.data;
}

/**
 * Get app info records for an app
 */
export async function getAppInfos(appId: string): Promise<AppInfo[]> {
  return getAllPages<AppInfo>(`/apps/${appId}/appInfos`, {
    'fields[appInfos]': 'appStoreState,appStoreAgeRating,brazilAgeRating,kidsAgeBand',
  });
}

/**
 * Get the current app info (non-released/editable version)
 */
export async function getCurrentAppInfo(appId: string): Promise<AppInfo | undefined> {
  const appInfos = await getAppInfos(appId);

  // Find the app info that is not yet released (editable)
  // States that indicate editable: PREPARE_FOR_SUBMISSION, READY_FOR_REVIEW, WAITING_FOR_REVIEW, IN_REVIEW
  const editableStates = [
    'PREPARE_FOR_SUBMISSION',
    'READY_FOR_REVIEW',
    'WAITING_FOR_REVIEW',
    'IN_REVIEW',
    'PENDING_DEVELOPER_RELEASE',
  ];

  const currentInfo = appInfos.find((info) =>
    editableStates.includes(info.attributes.appStoreState)
  );

  return currentInfo ?? appInfos[0];
}

/**
 * Get app info localizations for an app info record
 */
export async function getAppInfoLocalizations(appInfoId: string): Promise<AppInfoLocalization[]> {
  return getAllPages<AppInfoLocalization>(`/appInfos/${appInfoId}/appInfoLocalizations`, {
    'fields[appInfoLocalizations]': 'locale,name,subtitle,privacyPolicyUrl,privacyChoicesUrl,privacyPolicyText',
  });
}

/**
 * Get a specific app info localization by locale
 */
export async function getAppInfoLocalization(
  appInfoId: string,
  locale: string
): Promise<AppInfoLocalization | undefined> {
  const localizations = await getAppInfoLocalizations(appInfoId);
  return localizations.find((loc) => loc.attributes.locale === locale);
}

/**
 * Get app with all related info in a single structure
 */
export interface AppWithInfo {
  app: App;
  appInfo: AppInfo | undefined;
  localizations: AppInfoLocalization[];
}

export async function getAppWithInfo(bundleId: string): Promise<AppWithInfo> {
  const app = await getAppByBundleId(bundleId);
  const appInfo = await getCurrentAppInfo(app.id);

  let localizations: AppInfoLocalization[] = [];
  if (appInfo) {
    localizations = await getAppInfoLocalizations(appInfo.id);
  }

  return { app, appInfo, localizations };
}
