/**
 * App Store Connect JWT Authentication
 *
 * Generates and manages JWT tokens for ASC API authentication.
 * Uses Node.js built-in crypto module with ES256 algorithm.
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { ASCAuthError, ASCCredentialsNotConfiguredError } from './errors.js';

interface TokenCache {
  token: string;
  expiresAt: number;
}

interface ASCCredentials {
  keyId: string;
  issuerId: string;
  privateKey: string;
}

/**
 * Token validity duration in seconds (15 minutes, ASC max is 20)
 */
const TOKEN_VALIDITY_SECONDS = 15 * 60;

/**
 * Refresh threshold in seconds (refresh when < 2 minutes remaining)
 */
const REFRESH_THRESHOLD_SECONDS = 2 * 60;

let tokenCache: TokenCache | null = null;
let cachedCredentials: ASCCredentials | null = null;

/**
 * Base64url encode (RFC 4648)
 */
function base64urlEncode(data: Buffer | string): string {
  const buffer = typeof data === 'string' ? Buffer.from(data) : data;
  return buffer.toString('base64url');
}

/**
 * Create JWT header
 */
function createHeader(keyId: string): string {
  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT',
  };
  return base64urlEncode(JSON.stringify(header));
}

/**
 * Create JWT payload
 */
function createPayload(issuerId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + TOKEN_VALIDITY_SECONDS,
    aud: 'appstoreconnect-v1',
  };
  return base64urlEncode(JSON.stringify(payload));
}

/**
 * Sign the JWT using ES256
 */
function signJWT(header: string, payload: string, privateKey: string): string {
  const signingInput = `${header}.${payload}`;

  try {
    const sign = crypto.createSign('SHA256');
    sign.update(signingInput);
    sign.end();

    // Sign and get DER-encoded signature
    const derSignature = sign.sign({
      key: privateKey,
      dsaEncoding: 'ieee-p1363', // Get raw r||s format instead of DER
    });

    return base64urlEncode(derSignature);
  } catch (error) {
    throw new ASCAuthError(
      `Failed to sign JWT: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Load credentials from environment variables
 */
async function loadCredentials(): Promise<ASCCredentials> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const keyId = process.env['ASC_KEY_ID'];
  const issuerId = process.env['ASC_ISSUER_ID'];
  const privateKeyPath = process.env['ASC_PRIVATE_KEY_PATH'];
  const privateKeyEnv = process.env['ASC_PRIVATE_KEY'];

  if (!keyId || !issuerId) {
    throw new ASCCredentialsNotConfiguredError();
  }

  let privateKey: string;

  if (privateKeyEnv) {
    // Use inline private key from environment
    privateKey = privateKeyEnv;
    // Handle escaped newlines
    if (!privateKey.includes('\n') && privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
  } else if (privateKeyPath) {
    // Load from file
    try {
      privateKey = await fs.readFile(privateKeyPath, 'utf-8');
    } catch (error) {
      throw new ASCAuthError(
        `Failed to read private key from ${privateKeyPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  } else {
    throw new ASCCredentialsNotConfiguredError();
  }

  // Validate the private key format
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new ASCAuthError(
      'Invalid private key format. Expected PEM format starting with "-----BEGIN PRIVATE KEY-----"'
    );
  }

  cachedCredentials = { keyId, issuerId, privateKey };
  return cachedCredentials;
}

/**
 * Generate a new JWT token
 */
async function generateToken(): Promise<string> {
  const credentials = await loadCredentials();

  const header = createHeader(credentials.keyId);
  const payload = createPayload(credentials.issuerId);
  const signature = signJWT(header, payload, credentials.privateKey);

  return `${header}.${payload}.${signature}`;
}

/**
 * Check if the cached token needs refresh
 */
function needsRefresh(): boolean {
  if (!tokenCache) {
    return true;
  }

  const now = Date.now();
  const timeRemaining = tokenCache.expiresAt - now;
  return timeRemaining < REFRESH_THRESHOLD_SECONDS * 1000;
}

/**
 * Get a valid JWT token, generating or refreshing if needed
 */
export async function getToken(): Promise<string> {
  if (needsRefresh()) {
    const token = await generateToken();
    tokenCache = {
      token,
      expiresAt: Date.now() + TOKEN_VALIDITY_SECONDS * 1000,
    };
  }

  return tokenCache!.token;
}

/**
 * Clear the token cache (useful for testing or credential changes)
 */
export function clearTokenCache(): void {
  tokenCache = null;
  cachedCredentials = null;
}

/**
 * Check if credentials are currently configured
 */
export function hasCredentials(): boolean {
  const keyId = process.env['ASC_KEY_ID'];
  const issuerId = process.env['ASC_ISSUER_ID'];
  const privateKeyPath = process.env['ASC_PRIVATE_KEY_PATH'];
  const privateKey = process.env['ASC_PRIVATE_KEY'];

  return !!(keyId && issuerId && (privateKeyPath ?? privateKey));
}
