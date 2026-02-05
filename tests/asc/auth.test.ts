import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { getToken, clearTokenCache, hasCredentials } from '../../src/asc/auth';

// Store original env vars
const originalEnv = { ...process.env };

// Generate a test EC P-256 key pair
function generateTestKeyPair(): { privateKey: string; publicKey: string } {
  const keyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return keyPair;
}

describe('ASC Auth', () => {
  let tempDir: string;
  let testKeyPair: { privateKey: string; publicKey: string };

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asc-auth-test-'));
    testKeyPair = generateTestKeyPair();
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clear cached credentials/token between tests
    clearTokenCache();
  });

  afterEach(() => {
    // Restore env vars
    process.env = { ...originalEnv };
    clearTokenCache();
  });

  describe('hasCredentials', () => {
    it('should return false when no env vars are set', () => {
      delete process.env['ASC_KEY_ID'];
      delete process.env['ASC_ISSUER_ID'];
      delete process.env['ASC_PRIVATE_KEY_PATH'];
      delete process.env['ASC_PRIVATE_KEY'];

      expect(hasCredentials()).toBe(false);
    });

    it('should return false when only some env vars are set', () => {
      process.env['ASC_KEY_ID'] = 'test-key-id';
      delete process.env['ASC_ISSUER_ID'];
      delete process.env['ASC_PRIVATE_KEY_PATH'];
      delete process.env['ASC_PRIVATE_KEY'];

      expect(hasCredentials()).toBe(false);
    });

    it('should return true when all env vars are set with key path', () => {
      process.env['ASC_KEY_ID'] = 'test-key-id';
      process.env['ASC_ISSUER_ID'] = 'test-issuer-id';
      process.env['ASC_PRIVATE_KEY_PATH'] = '/path/to/key.p8';

      expect(hasCredentials()).toBe(true);
    });

    it('should return true when using inline private key', () => {
      process.env['ASC_KEY_ID'] = 'test-key-id';
      process.env['ASC_ISSUER_ID'] = 'test-issuer-id';
      process.env['ASC_PRIVATE_KEY'] = testKeyPair.privateKey;

      expect(hasCredentials()).toBe(true);
    });
  });

  describe('getToken', () => {
    it('should generate a valid JWT token', async () => {
      const keyPath = path.join(tempDir, 'test.p8');
      await fs.writeFile(keyPath, testKeyPair.privateKey);

      process.env['ASC_KEY_ID'] = 'test-key-id';
      process.env['ASC_ISSUER_ID'] = 'test-issuer-id';
      process.env['ASC_PRIVATE_KEY_PATH'] = keyPath;

      const token = await getToken();

      // JWT should have 3 parts
      const parts = token.split('.');
      expect(parts).toHaveLength(3);

      // Decode header
      const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString());
      expect(header.alg).toBe('ES256');
      expect(header.kid).toBe('test-key-id');
      expect(header.typ).toBe('JWT');

      // Decode payload
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
      expect(payload.iss).toBe('test-issuer-id');
      expect(payload.aud).toBe('appstoreconnect-v1');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('should cache tokens', async () => {
      const keyPath = path.join(tempDir, 'test-cache.p8');
      await fs.writeFile(keyPath, testKeyPair.privateKey);

      process.env['ASC_KEY_ID'] = 'test-key-id';
      process.env['ASC_ISSUER_ID'] = 'test-issuer-id';
      process.env['ASC_PRIVATE_KEY_PATH'] = keyPath;

      const token1 = await getToken();
      const token2 = await getToken();

      // Same token should be returned (cached)
      expect(token1).toBe(token2);
    });

    it('should throw when credentials are not configured', async () => {
      delete process.env['ASC_KEY_ID'];
      delete process.env['ASC_ISSUER_ID'];
      delete process.env['ASC_PRIVATE_KEY_PATH'];
      delete process.env['ASC_PRIVATE_KEY'];

      await expect(getToken()).rejects.toThrow('credentials not configured');
    });

    it('should work with inline private key', async () => {
      process.env['ASC_KEY_ID'] = 'test-key-id';
      process.env['ASC_ISSUER_ID'] = 'test-issuer-id';
      process.env['ASC_PRIVATE_KEY'] = testKeyPair.privateKey;

      const token = await getToken();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should handle escaped newlines in inline key', async () => {
      const escapedKey = testKeyPair.privateKey.replace(/\n/g, '\\n');
      process.env['ASC_KEY_ID'] = 'test-key-id';
      process.env['ASC_ISSUER_ID'] = 'test-issuer-id';
      process.env['ASC_PRIVATE_KEY'] = escapedKey;

      const token = await getToken();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should throw for invalid key file path', async () => {
      process.env['ASC_KEY_ID'] = 'test-key-id';
      process.env['ASC_ISSUER_ID'] = 'test-issuer-id';
      process.env['ASC_PRIVATE_KEY_PATH'] = '/nonexistent/key.p8';

      await expect(getToken()).rejects.toThrow('Failed to read private key');
    });

    it('should throw for invalid key format', async () => {
      const keyPath = path.join(tempDir, 'bad.p8');
      await fs.writeFile(keyPath, 'not-a-valid-key');

      process.env['ASC_KEY_ID'] = 'test-key-id';
      process.env['ASC_ISSUER_ID'] = 'test-issuer-id';
      process.env['ASC_PRIVATE_KEY_PATH'] = keyPath;

      await expect(getToken()).rejects.toThrow('Invalid private key format');
    });
  });

  describe('clearTokenCache', () => {
    it('should clear cached credentials and token', async () => {
      const keyPath = path.join(tempDir, 'test-clear.p8');
      await fs.writeFile(keyPath, testKeyPair.privateKey);

      process.env['ASC_KEY_ID'] = 'test-key-id';
      process.env['ASC_ISSUER_ID'] = 'test-issuer-id';
      process.env['ASC_PRIVATE_KEY_PATH'] = keyPath;

      const token1 = await getToken();
      clearTokenCache();
      const token2 = await getToken();

      // Both tokens should be valid
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
    });
  });
});
