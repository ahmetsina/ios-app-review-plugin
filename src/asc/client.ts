/**
 * App Store Connect API Client
 *
 * Handles HTTP requests with rate limiting, retries, and pagination.
 */

import { getToken } from './auth.js';
import {
  ASCAPIError,
  ASCAuthError,
  ASCRateLimitError,
} from './errors.js';
import type {
  ASCListResponse,
  ASCErrorResponse,
  ASCResource,
} from './types.js';

const BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

/**
 * Rate limiter state
 */
interface RateLimiterState {
  tokens: number;
  lastRefill: number;
  retryAfter?: number;
}

const RATE_LIMIT_TOKENS = 500; // 500 requests per hour
const RATE_LIMIT_REFILL_INTERVAL = 60 * 60 * 1000; // 1 hour in ms

let rateLimiter: RateLimiterState = {
  tokens: RATE_LIMIT_TOKENS,
  lastRefill: Date.now(),
};

/**
 * Retry configuration
 */
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Check and consume a rate limit token
 */
function consumeRateLimitToken(): boolean {
  const now = Date.now();
  const timeSinceRefill = now - rateLimiter.lastRefill;

  // Refill tokens if an hour has passed
  if (timeSinceRefill >= RATE_LIMIT_REFILL_INTERVAL) {
    rateLimiter.tokens = RATE_LIMIT_TOKENS;
    rateLimiter.lastRefill = now;
  }

  // Check if we need to wait for retry-after
  if (rateLimiter.retryAfter && now < rateLimiter.retryAfter) {
    return false;
  }

  if (rateLimiter.tokens > 0) {
    rateLimiter.tokens--;
    return true;
  }

  return false;
}

/**
 * Set retry-after from response header
 */
function setRetryAfter(seconds: number): void {
  rateLimiter.retryAfter = Date.now() + seconds * 1000;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse error response
 */
async function parseErrorResponse(response: Response): Promise<ASCErrorResponse | null> {
  try {
    const text = await response.text();
    if (text) {
      return JSON.parse(text) as ASCErrorResponse;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Make an authenticated request to the ASC API
 */
export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check rate limit
    if (!consumeRateLimitToken()) {
      const waitTime = rateLimiter.retryAfter
        ? rateLimiter.retryAfter - Date.now()
        : RATE_LIMIT_REFILL_INTERVAL - (Date.now() - rateLimiter.lastRefill);

      throw new ASCRateLimitError(Math.ceil(waitTime / 1000));
    }

    try {
      const token = await getToken();

      const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
        setRetryAfter(seconds);

        if (attempt < MAX_RETRIES) {
          await sleep(seconds * 1000);
          continue;
        }

        throw new ASCRateLimitError(seconds);
      }

      // Handle auth errors
      if (response.status === 401 || response.status === 403) {
        const errorResponse = await parseErrorResponse(response);
        throw new ASCAuthError(
          errorResponse?.errors?.[0]?.detail ?? 'Authentication failed'
        );
      }

      // Handle server errors with retry
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        lastError = new ASCAPIError(`Server error: ${response.status}`, response.status);
        await sleep(INITIAL_RETRY_DELAY * Math.pow(2, attempt));
        continue;
      }

      // Handle other errors
      if (!response.ok) {
        const errorResponse = await parseErrorResponse(response);
        throw ASCAPIError.fromResponse(response.status, errorResponse?.errors);
      }

      // Parse successful response
      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof ASCAPIError || error instanceof ASCAuthError || error instanceof ASCRateLimitError) {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      // Retry on network errors
      if (attempt < MAX_RETRIES) {
        await sleep(INITIAL_RETRY_DELAY * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError ?? new ASCAPIError('Request failed after retries', 0);
}

/**
 * Make a GET request
 */
export async function get<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  let url = path;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  return request<T>(url, { method: 'GET' });
}

/**
 * Fetch all pages of a paginated endpoint
 */
export async function getAllPages<T extends ASCResource>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  maxPages = 10
): Promise<T[]> {
  const allData: T[] = [];
  let nextUrl: string | undefined = path;
  let pageCount = 0;

  // Build initial URL with params
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      nextUrl += (nextUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  while (nextUrl && pageCount < maxPages) {
    const pageResponse: ASCListResponse<T> = await get<ASCListResponse<T>>(nextUrl);
    allData.push(...pageResponse.data);

    nextUrl = pageResponse.links?.next;
    pageCount++;
  }

  return allData;
}

/**
 * Reset rate limiter (useful for testing)
 */
export function resetRateLimiter(): void {
  rateLimiter = {
    tokens: RATE_LIMIT_TOKENS,
    lastRefill: Date.now(),
  };
}
