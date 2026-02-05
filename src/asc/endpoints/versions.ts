/**
 * App Store Connect Version Endpoints
 */

import { get, getAllPages } from '../client.js';
import type {
  ASCResponse,
  ASCListResponse,
  AppStoreVersion,
  AppStoreVersionLocalization,
  Build,
  Platform,
} from '../types.js';

/**
 * Get all versions for an app
 */
export async function getVersions(
  appId: string,
  platform?: Platform
): Promise<AppStoreVersion[]> {
  const params: Record<string, string | undefined> = {
    'fields[appStoreVersions]': 'platform,versionString,appStoreState,copyright,releaseType,earliestReleaseDate,downloadable,createdDate',
  };

  if (platform) {
    params['filter[platform]'] = platform;
  }

  return getAllPages<AppStoreVersion>(`/apps/${appId}/appStoreVersions`, params);
}

/**
 * Get the latest version for an app (optionally filtered by platform)
 */
export async function getLatestVersion(
  appId: string,
  platform: Platform = 'IOS'
): Promise<AppStoreVersion | undefined> {
  const response = await get<ASCListResponse<AppStoreVersion>>(`/apps/${appId}/appStoreVersions`, {
    'filter[platform]': platform,
    'fields[appStoreVersions]': 'platform,versionString,appStoreState,copyright,releaseType,earliestReleaseDate,downloadable,createdDate',
    sort: '-createdDate',
    limit: 1,
  });

  return response.data[0];
}

/**
 * Get version by ID
 */
export async function getVersionById(versionId: string): Promise<AppStoreVersion> {
  const response = await get<ASCResponse<AppStoreVersion>>(`/appStoreVersions/${versionId}`, {
    'fields[appStoreVersions]': 'platform,versionString,appStoreState,copyright,releaseType,earliestReleaseDate,downloadable,createdDate',
  });

  return response.data;
}

/**
 * Get version that's currently being prepared or in review
 */
export async function getEditableVersion(
  appId: string,
  platform: Platform = 'IOS'
): Promise<AppStoreVersion | undefined> {
  const versions = await getVersions(appId, platform);

  // Editable states
  const editableStates = [
    'PREPARE_FOR_SUBMISSION',
    'READY_FOR_REVIEW',
    'WAITING_FOR_REVIEW',
    'IN_REVIEW',
    'DEVELOPER_REJECTED',
    'REJECTED',
    'METADATA_REJECTED',
    'INVALID_BINARY',
    'PENDING_DEVELOPER_RELEASE',
    'PENDING_APPLE_RELEASE',
  ];

  return versions.find((v) => editableStates.includes(v.attributes.appStoreState));
}

/**
 * Get all localizations for a version
 */
export async function getVersionLocalizations(
  versionId: string
): Promise<AppStoreVersionLocalization[]> {
  return getAllPages<AppStoreVersionLocalization>(
    `/appStoreVersions/${versionId}/appStoreVersionLocalizations`,
    {
      'fields[appStoreVersionLocalizations]': 'locale,description,keywords,marketingUrl,promotionalText,supportUrl,whatsNew',
    }
  );
}

/**
 * Get a specific localization for a version
 */
export async function getVersionLocalization(
  versionId: string,
  locale: string
): Promise<AppStoreVersionLocalization | undefined> {
  const localizations = await getVersionLocalizations(versionId);
  return localizations.find((loc) => loc.attributes.locale === locale);
}

/**
 * Get builds for an app
 */
export async function getBuilds(appId: string): Promise<Build[]> {
  return getAllPages<Build>(`/apps/${appId}/builds`, {
    'fields[builds]': 'version,uploadedDate,expirationDate,expired,minOsVersion,processingState,buildAudienceType,usesNonExemptEncryption',
    sort: '-uploadedDate',
  });
}

/**
 * Get the latest valid build for an app
 */
export async function getLatestBuild(appId: string): Promise<Build | undefined> {
  const response = await get<ASCListResponse<Build>>(`/apps/${appId}/builds`, {
    'fields[builds]': 'version,uploadedDate,expirationDate,expired,minOsVersion,processingState,buildAudienceType,usesNonExemptEncryption',
    'filter[processingState]': 'VALID',
    'filter[expired]': 'false',
    sort: '-uploadedDate',
    limit: 1,
  });

  return response.data[0];
}

/**
 * Get the build attached to a specific version
 */
export async function getVersionBuild(versionId: string): Promise<Build | undefined> {
  try {
    const response = await get<ASCResponse<Build>>(`/appStoreVersions/${versionId}/build`, {
      'fields[builds]': 'version,uploadedDate,expirationDate,expired,minOsVersion,processingState,buildAudienceType,usesNonExemptEncryption',
    });
    return response.data;
  } catch {
    // No build attached to this version
    return undefined;
  }
}

/**
 * Version with localizations
 */
export interface VersionWithLocalizations {
  version: AppStoreVersion;
  localizations: AppStoreVersionLocalization[];
  build?: Build | undefined;
}

/**
 * Get version with all localizations
 */
export async function getVersionWithLocalizations(
  versionId: string
): Promise<VersionWithLocalizations> {
  const [version, localizations, build] = await Promise.all([
    getVersionById(versionId),
    getVersionLocalizations(versionId),
    getVersionBuild(versionId),
  ]);

  return { version, localizations, build };
}
