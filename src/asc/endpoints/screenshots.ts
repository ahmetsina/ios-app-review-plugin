/**
 * App Store Connect Screenshot Endpoints
 */

import { getAllPages } from '../client.js';
import type {
  AppScreenshotSet,
  AppScreenshot,
  ScreenshotDisplayType,
} from '../types.js';

/**
 * Get all screenshot sets for a version localization
 */
export async function getScreenshotSets(
  versionLocalizationId: string
): Promise<AppScreenshotSet[]> {
  return getAllPages<AppScreenshotSet>(
    `/appStoreVersionLocalizations/${versionLocalizationId}/appScreenshotSets`,
    {
      'fields[appScreenshotSets]': 'screenshotDisplayType',
    }
  );
}

/**
 * Get screenshots in a screenshot set
 */
export async function getScreenshots(screenshotSetId: string): Promise<AppScreenshot[]> {
  return getAllPages<AppScreenshot>(
    `/appScreenshotSets/${screenshotSetId}/appScreenshots`,
    {
      'fields[appScreenshots]': 'fileSize,fileName,sourceFileChecksum,imageAsset,assetToken,assetType,assetDeliveryState',
    }
  );
}

/**
 * Get screenshot sets with their screenshots
 */
export interface ScreenshotSetWithScreenshots {
  set: AppScreenshotSet;
  screenshots: AppScreenshot[];
}

export async function getScreenshotSetsWithScreenshots(
  versionLocalizationId: string
): Promise<ScreenshotSetWithScreenshots[]> {
  const sets = await getScreenshotSets(versionLocalizationId);

  const results: ScreenshotSetWithScreenshots[] = [];

  for (const set of sets) {
    const screenshots = await getScreenshots(set.id);
    results.push({ set, screenshots });
  }

  return results;
}

/**
 * Required screenshot display types for iOS submission
 */
export const REQUIRED_IPHONE_DISPLAY_TYPES: ScreenshotDisplayType[] = [
  'APP_IPHONE_67', // iPhone 14 Pro Max (6.7")
  'APP_IPHONE_65', // iPhone 11 Pro Max (6.5")
  'APP_IPHONE_55', // iPhone 8 Plus (5.5")
];

export const REQUIRED_IPAD_DISPLAY_TYPES: ScreenshotDisplayType[] = [
  'APP_IPAD_PRO_3GEN_129', // iPad Pro 12.9" (3rd gen)
  'APP_IPAD_PRO_129', // iPad Pro 12.9" (2nd gen)
];

/**
 * All commonly required display types
 */
export const COMMONLY_REQUIRED_DISPLAY_TYPES: ScreenshotDisplayType[] = [
  ...REQUIRED_IPHONE_DISPLAY_TYPES,
  ...REQUIRED_IPAD_DISPLAY_TYPES,
];

/**
 * Get display type description for human-readable output
 */
export function getDisplayTypeDescription(displayType: ScreenshotDisplayType): string {
  const descriptions: Record<ScreenshotDisplayType, string> = {
    APP_IPHONE_67: 'iPhone 6.7" (14 Pro Max, 15 Pro Max)',
    APP_IPHONE_65: 'iPhone 6.5" (11 Pro Max, XS Max)',
    APP_IPHONE_61: 'iPhone 6.1" (14/15, 14/15 Pro)',
    APP_IPHONE_58: 'iPhone 5.8" (X, XS, 11 Pro)',
    APP_IPHONE_55: 'iPhone 5.5" (6 Plus, 7 Plus, 8 Plus)',
    APP_IPHONE_47: 'iPhone 4.7" (6, 7, 8, SE)',
    APP_IPHONE_40: 'iPhone 4" (5, 5s, SE 1st gen)',
    APP_IPHONE_35: 'iPhone 3.5" (4s and earlier)',
    APP_IPAD_PRO_3GEN_129: 'iPad Pro 12.9" (3rd gen+)',
    APP_IPAD_PRO_3GEN_11: 'iPad Pro 11"',
    APP_IPAD_PRO_129: 'iPad Pro 12.9" (2nd gen)',
    APP_IPAD_105: 'iPad 10.5"',
    APP_IPAD_97: 'iPad 9.7"',
    APP_WATCH_ULTRA: 'Apple Watch Ultra',
    APP_WATCH_SERIES_7: 'Apple Watch Series 7+',
    APP_WATCH_SERIES_4: 'Apple Watch Series 4-6',
    APP_WATCH_SERIES_3: 'Apple Watch Series 3',
    APP_DESKTOP: 'Mac Desktop',
    APP_APPLE_TV: 'Apple TV',
  };

  return descriptions[displayType] ?? displayType;
}

/**
 * Check screenshot validity
 */
export interface ScreenshotValidation {
  displayType: ScreenshotDisplayType;
  count: number;
  isValid: boolean;
  hasProcessingErrors: boolean;
  processingState: string[];
  issues: string[];
}

export function validateScreenshotSet(
  set: AppScreenshotSet,
  screenshots: AppScreenshot[]
): ScreenshotValidation {
  const issues: string[] = [];
  const processingState: string[] = [];
  let hasProcessingErrors = false;

  // Check count (1-10 required)
  if (screenshots.length === 0) {
    issues.push('No screenshots uploaded');
  } else if (screenshots.length > 10) {
    issues.push(`Too many screenshots (${screenshots.length}/10 max)`);
  }

  // Check processing state
  for (const screenshot of screenshots) {
    const state = screenshot.attributes.assetDeliveryState?.state;
    if (state) {
      processingState.push(state);
      if (state === 'FAILED') {
        hasProcessingErrors = true;
        const errors = screenshot.attributes.assetDeliveryState?.errors;
        if (errors && errors.length > 0) {
          issues.push(`Screenshot "${screenshot.attributes.fileName}" failed: ${errors[0]!.description}`);
        } else {
          issues.push(`Screenshot "${screenshot.attributes.fileName}" failed to process`);
        }
      }
    }
  }

  return {
    displayType: set.attributes.screenshotDisplayType,
    count: screenshots.length,
    isValid: issues.length === 0,
    hasProcessingErrors,
    processingState,
    issues,
  };
}
