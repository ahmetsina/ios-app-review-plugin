/**
 * App Store Connect API Types
 */

// Enums

export type AppStoreState =
  | 'ACCEPTED'
  | 'DEVELOPER_REMOVED_FROM_SALE'
  | 'DEVELOPER_REJECTED'
  | 'IN_REVIEW'
  | 'INVALID_BINARY'
  | 'METADATA_REJECTED'
  | 'PENDING_APPLE_RELEASE'
  | 'PENDING_CONTRACT'
  | 'PENDING_DEVELOPER_RELEASE'
  | 'PREPARE_FOR_SUBMISSION'
  | 'PREORDER_READY_FOR_SALE'
  | 'PROCESSING_FOR_APP_STORE'
  | 'READY_FOR_REVIEW'
  | 'READY_FOR_SALE'
  | 'REJECTED'
  | 'REMOVED_FROM_SALE'
  | 'WAITING_FOR_EXPORT_COMPLIANCE'
  | 'WAITING_FOR_REVIEW';

export type ScreenshotDisplayType =
  | 'APP_IPHONE_67'
  | 'APP_IPHONE_65'
  | 'APP_IPHONE_61'
  | 'APP_IPHONE_58'
  | 'APP_IPHONE_55'
  | 'APP_IPHONE_47'
  | 'APP_IPHONE_40'
  | 'APP_IPHONE_35'
  | 'APP_IPAD_PRO_3GEN_129'
  | 'APP_IPAD_PRO_3GEN_11'
  | 'APP_IPAD_PRO_129'
  | 'APP_IPAD_105'
  | 'APP_IPAD_97'
  | 'APP_WATCH_ULTRA'
  | 'APP_WATCH_SERIES_7'
  | 'APP_WATCH_SERIES_4'
  | 'APP_WATCH_SERIES_3'
  | 'APP_DESKTOP'
  | 'APP_APPLE_TV';

export type IAPType =
  | 'CONSUMABLE'
  | 'NON_CONSUMABLE'
  | 'NON_RENEWING_SUBSCRIPTION'
  | 'AUTO_RENEWABLE_SUBSCRIPTION';

export type IAPState =
  | 'MISSING_METADATA'
  | 'READY_TO_SUBMIT'
  | 'WAITING_FOR_REVIEW'
  | 'IN_REVIEW'
  | 'DEVELOPER_ACTION_NEEDED'
  | 'PENDING_BINARY_APPROVAL'
  | 'APPROVED'
  | 'DEVELOPER_REMOVED_FROM_SALE'
  | 'REMOVED_FROM_SALE'
  | 'REJECTED';

export type ScreenshotState =
  | 'AWAITING_UPLOAD'
  | 'UPLOAD_COMPLETE'
  | 'COMPLETE'
  | 'FAILED';

export type Platform = 'IOS' | 'MAC_OS' | 'TV_OS' | 'VISION_OS';

// JSON:API Response wrapper types

export interface ASCResponse<T> {
  data: T;
  included?: ASCResource[];
  links?: ASCLinks;
  meta?: ASCMeta;
}

export interface ASCListResponse<T> {
  data: T[];
  included?: ASCResource[];
  links?: ASCPaginationLinks;
  meta?: ASCMeta;
}

export interface ASCLinks {
  self: string;
}

export interface ASCPaginationLinks extends ASCLinks {
  next?: string;
  first?: string;
}

export interface ASCMeta {
  paging?: {
    total: number;
    limit: number;
  };
}

export interface ASCResource {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, ASCRelationship>;
  links?: ASCLinks;
}

export interface ASCRelationship {
  data?: ASCResourceIdentifier | ASCResourceIdentifier[] | null;
  links?: {
    self?: string;
    related?: string;
  };
}

export interface ASCResourceIdentifier {
  type: string;
  id: string;
}

// App types

export interface App {
  type: 'apps';
  id: string;
  attributes: {
    name: string;
    bundleId: string;
    sku: string;
    primaryLocale: string;
    contentRightsDeclaration?: 'DOES_NOT_USE_THIRD_PARTY_CONTENT' | 'USES_THIRD_PARTY_CONTENT';
    isOrEverWasMadeForKids: boolean;
    availableInNewTerritories: boolean;
  };
  relationships?: {
    appInfos?: ASCRelationship;
    appStoreVersions?: ASCRelationship;
    inAppPurchases?: ASCRelationship;
  };
}

export interface AppInfo {
  type: 'appInfos';
  id: string;
  attributes: {
    appStoreState: AppStoreState;
    appStoreAgeRating?: string;
    brazilAgeRating?: string;
    kidsAgeBand?: string;
  };
  relationships?: {
    app?: ASCRelationship;
    appInfoLocalizations?: ASCRelationship;
    primaryCategory?: ASCRelationship;
    secondaryCategory?: ASCRelationship;
  };
}

export interface AppInfoLocalization {
  type: 'appInfoLocalizations';
  id: string;
  attributes: {
    locale: string;
    name?: string;
    subtitle?: string;
    privacyPolicyUrl?: string;
    privacyChoicesUrl?: string;
    privacyPolicyText?: string;
  };
  relationships?: {
    appInfo?: ASCRelationship;
  };
}

// Version types

export interface AppStoreVersion {
  type: 'appStoreVersions';
  id: string;
  attributes: {
    platform: Platform;
    versionString: string;
    appStoreState: AppStoreState;
    copyright?: string;
    releaseType?: 'MANUAL' | 'AFTER_APPROVAL' | 'SCHEDULED';
    earliestReleaseDate?: string;
    downloadable: boolean;
    createdDate: string;
  };
  relationships?: {
    app?: ASCRelationship;
    appStoreVersionLocalizations?: ASCRelationship;
    build?: ASCRelationship;
    appStoreVersionSubmission?: ASCRelationship;
  };
}

export interface AppStoreVersionLocalization {
  type: 'appStoreVersionLocalizations';
  id: string;
  attributes: {
    locale: string;
    description?: string;
    keywords?: string;
    marketingUrl?: string;
    promotionalText?: string;
    supportUrl?: string;
    whatsNew?: string;
  };
  relationships?: {
    appStoreVersion?: ASCRelationship;
    appScreenshotSets?: ASCRelationship;
    appPreviewSets?: ASCRelationship;
  };
}

export interface Build {
  type: 'builds';
  id: string;
  attributes: {
    version: string;
    uploadedDate: string;
    expirationDate: string;
    expired: boolean;
    minOsVersion: string;
    processingState: 'PROCESSING' | 'FAILED' | 'INVALID' | 'VALID';
    buildAudienceType?: 'INTERNAL_ONLY' | 'APP_STORE_ELIGIBLE';
    usesNonExemptEncryption?: boolean;
  };
  relationships?: {
    app?: ASCRelationship;
    appStoreVersion?: ASCRelationship;
  };
}

// Screenshot types

export interface AppScreenshotSet {
  type: 'appScreenshotSets';
  id: string;
  attributes: {
    screenshotDisplayType: ScreenshotDisplayType;
  };
  relationships?: {
    appStoreVersionLocalization?: ASCRelationship;
    appScreenshots?: ASCRelationship;
  };
}

export interface AppScreenshot {
  type: 'appScreenshots';
  id: string;
  attributes: {
    fileSize: number;
    fileName: string;
    sourceFileChecksum?: string;
    imageAsset?: {
      templateUrl: string;
      width: number;
      height: number;
    };
    assetToken?: string;
    assetType?: string;
    uploadOperations?: Array<{
      method: string;
      url: string;
      length: number;
      offset: number;
      requestHeaders: Array<{ name: string; value: string }>;
    }>;
    assetDeliveryState?: {
      state: ScreenshotState;
      errors?: Array<{ code: string; description: string }>;
    };
  };
  relationships?: {
    appScreenshotSet?: ASCRelationship;
  };
}

// In-App Purchase types

export interface InAppPurchase {
  type: 'inAppPurchases';
  id: string;
  attributes: {
    name: string;
    productId: string;
    inAppPurchaseType: IAPType;
    state: IAPState;
    reviewNote?: string;
    familySharable?: boolean;
    contentHosting?: boolean;
  };
  relationships?: {
    app?: ASCRelationship;
    inAppPurchaseLocalizations?: ASCRelationship;
    pricePoints?: ASCRelationship;
    iapPriceSchedule?: ASCRelationship;
    inAppPurchaseAppStoreReview?: ASCRelationship;
  };
}

export interface InAppPurchaseLocalization {
  type: 'inAppPurchaseLocalizations';
  id: string;
  attributes: {
    locale: string;
    name?: string;
    description?: string;
  };
  relationships?: {
    inAppPurchase?: ASCRelationship;
  };
}

export interface InAppPurchaseAppStoreReview {
  type: 'inAppPurchaseAppStoreReviews';
  id: string;
  attributes: {
    state?: string;
  };
  relationships?: {
    inAppPurchaseV2?: ASCRelationship;
    inAppPurchaseAppStoreReviewScreenshot?: ASCRelationship;
  };
}

export interface InAppPurchaseAppStoreReviewScreenshot {
  type: 'inAppPurchaseAppStoreReviewScreenshots';
  id: string;
  attributes: {
    fileSize?: number;
    fileName?: string;
    assetDeliveryState?: {
      state: ScreenshotState;
      errors?: Array<{ code: string; description: string }>;
    };
    imageAsset?: {
      templateUrl: string;
      width: number;
      height: number;
    };
  };
}

// Error response types

export interface ASCErrorResponse {
  errors: ASCError[];
}

export interface ASCError {
  id?: string;
  status: string;
  code: string;
  title: string;
  detail: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
}
