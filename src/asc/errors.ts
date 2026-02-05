/**
 * App Store Connect API Error Classes
 */

import type { ASCError } from './types.js';

/**
 * Base error class for ASC errors
 */
export class ASCBaseError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ASCBaseError';
  }
}

/**
 * Authentication error - credentials invalid or missing
 */
export class ASCAuthError extends ASCBaseError {
  constructor(message: string) {
    super(message, 'asc-auth-error');
    this.name = 'ASCAuthError';
  }
}

/**
 * Credentials not configured
 */
export class ASCCredentialsNotConfiguredError extends ASCBaseError {
  constructor() {
    super(
      'App Store Connect credentials not configured. Set ASC_KEY_ID, ASC_ISSUER_ID, and ASC_PRIVATE_KEY_PATH (or ASC_PRIVATE_KEY) environment variables.',
      'asc-credentials-not-configured'
    );
    this.name = 'ASCCredentialsNotConfiguredError';
  }
}

/**
 * App not found in ASC account
 */
export class ASCAppNotFoundError extends ASCBaseError {
  constructor(public readonly bundleId: string) {
    super(`App with bundle ID "${bundleId}" not found in your App Store Connect account.`, 'asc-app-not-found');
    this.name = 'ASCAppNotFoundError';
  }
}

/**
 * Rate limit exceeded
 */
export class ASCRateLimitError extends ASCBaseError {
  constructor(public readonly retryAfter?: number) {
    super(
      `App Store Connect API rate limit exceeded.${retryAfter ? ` Retry after ${retryAfter} seconds.` : ''}`,
      'asc-rate-limited'
    );
    this.name = 'ASCRateLimitError';
  }
}

/**
 * Generic API error
 */
export class ASCAPIError extends ASCBaseError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors?: ASCError[]
  ) {
    super(message, 'asc-api-error');
    this.name = 'ASCAPIError';
  }

  static fromResponse(status: number, errors?: ASCError[]): ASCAPIError {
    if (errors && errors.length > 0) {
      const firstError = errors[0]!;
      return new ASCAPIError(
        `${firstError.title}: ${firstError.detail}`,
        status,
        errors
      );
    }
    return new ASCAPIError(`API request failed with status ${status}`, status, errors);
  }
}

/**
 * Check if an error is an ASC error
 */
export function isASCError(error: unknown): error is ASCBaseError {
  return error instanceof ASCBaseError;
}

/**
 * Check if credentials are configured
 */
export function areCredentialsConfigured(): boolean {
  const keyId = process.env['ASC_KEY_ID'];
  const issuerId = process.env['ASC_ISSUER_ID'];
  const privateKeyPath = process.env['ASC_PRIVATE_KEY_PATH'];
  const privateKey = process.env['ASC_PRIVATE_KEY'];

  return !!(keyId && issuerId && (privateKeyPath ?? privateKey));
}
