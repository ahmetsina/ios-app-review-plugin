/**
 * App Store Connect In-App Purchase Endpoints
 */

import { get, getAllPages } from '../client.js';
import type {
  ASCResponse,
  InAppPurchase,
  InAppPurchaseLocalization,
  InAppPurchaseAppStoreReviewScreenshot,
  IAPState,
} from '../types.js';

/**
 * Get all in-app purchases for an app
 */
export async function getInAppPurchases(appId: string): Promise<InAppPurchase[]> {
  return getAllPages<InAppPurchase>(`/apps/${appId}/inAppPurchasesV2`, {
    'fields[inAppPurchases]': 'name,productId,inAppPurchaseType,state,reviewNote,familySharable,contentHosting',
  });
}

/**
 * Get a specific in-app purchase by ID
 */
export async function getInAppPurchaseById(iapId: string): Promise<InAppPurchase> {
  const response = await get<ASCResponse<InAppPurchase>>(`/inAppPurchasesV2/${iapId}`, {
    'fields[inAppPurchases]': 'name,productId,inAppPurchaseType,state,reviewNote,familySharable,contentHosting',
  });

  return response.data;
}

/**
 * Get localizations for an in-app purchase
 */
export async function getIAPLocalizations(iapId: string): Promise<InAppPurchaseLocalization[]> {
  return getAllPages<InAppPurchaseLocalization>(
    `/inAppPurchasesV2/${iapId}/inAppPurchaseLocalizations`,
    {
      'fields[inAppPurchaseLocalizations]': 'locale,name,description',
    }
  );
}

/**
 * Get review screenshot for an IAP
 */
export async function getIAPReviewScreenshot(
  iapId: string
): Promise<InAppPurchaseAppStoreReviewScreenshot | undefined> {
  try {
    const response = await get<ASCResponse<InAppPurchaseAppStoreReviewScreenshot>>(
      `/inAppPurchasesV2/${iapId}/appStoreReviewScreenshot`,
      {
        'fields[inAppPurchaseAppStoreReviewScreenshots]': 'fileSize,fileName,assetDeliveryState,imageAsset',
      }
    );
    return response.data;
  } catch {
    return undefined;
  }
}

/**
 * IAP validation result
 */
export interface IAPValidation {
  iap: InAppPurchase;
  localizations: InAppPurchaseLocalization[];
  reviewScreenshot?: InAppPurchaseAppStoreReviewScreenshot | undefined;
  issues: string[];
  isReadyForSubmission: boolean;
}

/**
 * States that indicate IAP is ready or nearly ready for submission
 */
const READY_STATES: IAPState[] = ['READY_TO_SUBMIT', 'WAITING_FOR_REVIEW', 'IN_REVIEW', 'APPROVED'];

/**
 * States that require action
 */
const ACTION_REQUIRED_STATES: IAPState[] = ['MISSING_METADATA', 'DEVELOPER_ACTION_NEEDED', 'REJECTED'];

/**
 * Validate an in-app purchase
 */
export async function validateIAP(iapId: string): Promise<IAPValidation> {
  const [iap, localizations, reviewScreenshot] = await Promise.all([
    getInAppPurchaseById(iapId),
    getIAPLocalizations(iapId),
    getIAPReviewScreenshot(iapId),
  ]);

  const issues: string[] = [];

  // Check state
  if (ACTION_REQUIRED_STATES.includes(iap.attributes.state)) {
    issues.push(`IAP state requires action: ${iap.attributes.state}`);
  }

  // Check localizations
  if (localizations.length === 0) {
    issues.push('No localizations configured');
  } else {
    // Check for missing names/descriptions
    for (const loc of localizations) {
      if (!loc.attributes.name) {
        issues.push(`Missing name for locale: ${loc.attributes.locale}`);
      }
      if (!loc.attributes.description) {
        issues.push(`Missing description for locale: ${loc.attributes.locale}`);
      }
    }
  }

  // Check review screenshot (required for consumable/non-consumable)
  const requiresScreenshot = ['CONSUMABLE', 'NON_CONSUMABLE'].includes(iap.attributes.inAppPurchaseType);
  if (requiresScreenshot && !reviewScreenshot) {
    issues.push('Review screenshot required but not uploaded');
  }

  // Check screenshot processing state
  if (reviewScreenshot?.attributes.assetDeliveryState?.state === 'FAILED') {
    issues.push('Review screenshot failed to process');
  }

  return {
    iap,
    localizations,
    reviewScreenshot,
    issues,
    isReadyForSubmission: issues.length === 0 && READY_STATES.includes(iap.attributes.state),
  };
}

/**
 * Validate all IAPs for an app
 */
export async function validateAllIAPs(appId: string): Promise<IAPValidation[]> {
  const iaps = await getInAppPurchases(appId);
  const validations: IAPValidation[] = [];

  for (const iap of iaps) {
    const validation = await validateIAP(iap.id);
    validations.push(validation);
  }

  return validations;
}

/**
 * Get IAP state description
 */
export function getIAPStateDescription(state: IAPState): string {
  const descriptions: Record<IAPState, string> = {
    MISSING_METADATA: 'Missing required metadata',
    READY_TO_SUBMIT: 'Ready to submit with next app version',
    WAITING_FOR_REVIEW: 'Waiting for App Store review',
    IN_REVIEW: 'Currently in review',
    DEVELOPER_ACTION_NEEDED: 'Requires developer action',
    PENDING_BINARY_APPROVAL: 'Pending binary approval',
    APPROVED: 'Approved and active',
    DEVELOPER_REMOVED_FROM_SALE: 'Removed from sale by developer',
    REMOVED_FROM_SALE: 'Removed from sale',
    REJECTED: 'Rejected by App Store review',
  };

  return descriptions[state] ?? state;
}
