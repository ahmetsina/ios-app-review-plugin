import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SecurityAnalyzer } from '../../src/analyzers/security.js';
import type { XcodeProject } from '../../src/types/index.js';

describe('SecurityAnalyzer', () => {
  let analyzer: SecurityAnalyzer;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'security-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    analyzer = new SecurityAnalyzer();
  });

  const mockProject: XcodeProject = {
    path: '/test/TestApp.xcodeproj',
    name: 'TestApp',
    targets: [
      {
        name: 'TestApp',
        type: 'application',
        bundleIdentifier: 'com.test.app',
        sourceFiles: [],
      },
    ],
    configurations: ['Debug', 'Release'],
  };

  describe('scanPath', () => {
    it('should detect MD5 usage', async () => {
      const filePath = path.join(tempDir, 'Crypto.swift');
      await fs.writeFile(
        filePath,
        `import CommonCrypto

func hashPassword(_ password: String) -> String {
    var digest = [UInt8](repeating: 0, count: Int(CC_MD5_DIGEST_LENGTH))
    CC_MD5(password, CC_LONG(password.count), &digest)
    return digest.map { String(format: "%02x", $0) }.joined()
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'security-md5')).toBe(true);
    });

    it('should detect SHA-1 usage', async () => {
      const filePath = path.join(tempDir, 'Hash.swift');
      await fs.writeFile(
        filePath,
        `import CommonCrypto

func hash(_ data: Data) {
    var digest = [UInt8](repeating: 0, count: Int(CC_SHA1_DIGEST_LENGTH))
    CC_SHA1(data.bytes, CC_LONG(data.count), &digest)
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'security-sha1')).toBe(true);
    });

    it('should detect DES encryption', async () => {
      const filePath = path.join(tempDir, 'WeakCrypto.swift');
      await fs.writeFile(
        filePath,
        `import CommonCrypto

func encrypt(_ data: Data) {
    let algorithm = kCCAlgorithmDES
    CCCrypt(kCCEncrypt, algorithm, 0, key, kCCKeySizeDES, iv, data, dataLength, buffer, bufferSize, &numBytesEncrypted)
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'security-des')).toBe(true);
      expect(result.issues.find((i) => i.id === 'security-des')?.severity).toBe('error');
    });

    it('should detect ECB mode', async () => {
      const filePath = path.join(tempDir, 'ECBMode.swift');
      await fs.writeFile(
        filePath,
        `import CommonCrypto

func encrypt(_ data: Data) {
    CCCrypt(kCCEncrypt, kCCAlgorithmAES, kCCOptionECBMode, key, kCCKeySizeAES256, nil, data, dataLength, buffer, bufferSize, &numBytesEncrypted)
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'security-ecb-mode')).toBe(true);
    });

    it('should detect sensitive data in UserDefaults', async () => {
      const filePath = path.join(tempDir, 'UserDefaultsSensitive.swift');
      await fs.writeFile(
        filePath,
        `import Foundation

func saveCredentials() {
    UserDefaults.standard.set(password, forKey: "password")
}
`
      );

      const result = await analyzer.scanPath(filePath);
      const sensitiveIssues = result.issues.filter((i) => i.id.startsWith('security-userdefaults'));
      expect(sensitiveIssues.length).toBeGreaterThan(0);
    });

    it('should detect sensitive token storage in UserDefaults', async () => {
      const filePath = path.join(tempDir, 'TokenStore.swift');
      await fs.writeFile(
        filePath,
        `import Foundation

func saveToken(_ token: String) {
    UserDefaults.standard.set(token, forKey: "authToken")
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'security-userdefaults-sensitive-set')).toBe(true);
    });

    it('should detect insecure random number generation', async () => {
      const filePath = path.join(tempDir, 'InsecureRandom.m');
      await fs.writeFile(
        filePath,
        `#import <stdlib.h>

- (NSString *)generateToken {
    srand(time(NULL));
    int token = rand();
    return [NSString stringWithFormat:@"%d", token];
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'security-insecure-random')).toBe(true);
    });

    it('should detect insecure keychain accessibility', async () => {
      const filePath = path.join(tempDir, 'KeychainInsecure.swift');
      await fs.writeFile(
        filePath,
        `import Security

func saveToKeychain(data: Data) {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccessible as String: kSecAttrAccessibleAlways,
        kSecValueData as String: data,
    ]
    SecItemAdd(query as CFDictionary, nil)
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'security-keychain-accessible-always')).toBe(true);
    });

    it('should detect hardcoded encryption keys', async () => {
      const filePath = path.join(tempDir, 'HardcodedKey.swift');
      await fs.writeFile(
        filePath,
        `import Foundation

class Encryptor {
    let encryptionKey = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef"

    func encrypt(_ data: Data) -> Data {
        // encrypt with key
        return data
    }
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'security-hardcoded-encryption-key')).toBe(true);
    });

    it('should detect logging of sensitive data', async () => {
      const filePath = path.join(tempDir, 'SensitiveLog.swift');
      await fs.writeFile(
        filePath,
        `import Foundation

func login(username: String, password: String) {
    print("Login attempt with password: \\(password)")
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues.some((i) => i.id === 'security-logging-sensitive')).toBe(true);
    });

    it('should pass with secure code', async () => {
      const filePath = path.join(tempDir, 'SecureCode.swift');
      await fs.writeFile(
        filePath,
        `import CryptoKit
import Security

class SecureManager {
    func hash(_ data: Data) -> SHA256Digest {
        return SHA256.hash(data: data)
    }

    func encrypt(_ data: Data, using key: SymmetricKey) throws -> AES.GCM.SealedBox {
        return try AES.GCM.seal(data, using: key)
    }

    func saveToKeychain(data: Data) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked,
            kSecValueData as String: data,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }
}
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should skip commented-out code', async () => {
      const filePath = path.join(tempDir, 'CommentedSecurity.swift');
      await fs.writeFile(
        filePath,
        `import Foundation

// CC_MD5 is deprecated
// kCCAlgorithmDES should not be used
/* kSecAttrAccessibleAlways is insecure */
`
      );

      const result = await analyzer.scanPath(filePath);
      expect(result.issues).toHaveLength(0);
    });

    it('should scan directories', async () => {
      const subDir = path.join(tempDir, 'SecurityScanDir');
      await fs.mkdir(subDir, { recursive: true });

      await fs.writeFile(
        path.join(subDir, 'Weak1.swift'),
        `import CommonCrypto\nCC_MD5(data, len, digest)\n`
      );
      await fs.writeFile(
        path.join(subDir, 'Weak2.swift'),
        `let algorithm = kCCAlgorithmDES\n`
      );

      const result = await analyzer.scanPath(subDir);
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('analyze', () => {
    it('should work with project interface', async () => {
      const subDir = path.join(tempDir, 'AnalyzeSecDir');
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(
        path.join(subDir, 'Clean.swift'),
        `import UIKit\nclass VC: UIViewController {}\n`
      );

      const result = await analyzer.analyze(mockProject, {
        basePath: subDir,
      });

      expect(result.analyzer).toBe('Security Analyzer');
      expect(result.passed).toBe(true);
    });
  });
});
