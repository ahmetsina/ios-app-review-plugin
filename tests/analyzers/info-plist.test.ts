import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { InfoPlistAnalyzer } from '../../src/analyzers/info-plist';

describe('InfoPlistAnalyzer', () => {
  let analyzer: InfoPlistAnalyzer;
  let tempDir: string;

  beforeAll(async () => {
    analyzer = new InfoPlistAnalyzer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ios-review-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('analyzePlist', () => {
    it('should detect missing required keys', async () => {
      const plistPath = path.join(tempDir, 'MissingKeys.plist');
      await fs.writeFile(
        plistPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>TestApp</string>
</dict>
</plist>`
      );

      const result = await analyzer.analyzePlist(plistPath);

      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.id === 'missing-cfbundleidentifier')).toBe(true);
      expect(result.issues.some((i) => i.id === 'missing-cfbundleversion')).toBe(true);
    });

    it('should pass for valid Info.plist', async () => {
      const plistPath = path.join(tempDir, 'Valid.plist');
      await fs.writeFile(
        plistPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.example.testapp</string>
  <key>CFBundleName</key>
  <string>TestApp</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleExecutable</key>
  <string>TestApp</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>UILaunchStoryboardName</key>
  <string>LaunchScreen</string>
</dict>
</plist>`
      );

      const result = await analyzer.analyzePlist(plistPath);

      expect(result.passed).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('should detect placeholder privacy descriptions', async () => {
      const plistPath = path.join(tempDir, 'Placeholder.plist');
      await fs.writeFile(
        plistPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.example.testapp</string>
  <key>CFBundleName</key>
  <string>TestApp</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleExecutable</key>
  <string>TestApp</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>NSCameraUsageDescription</key>
  <string>TODO: Add description</string>
</dict>
</plist>`
      );

      const result = await analyzer.analyzePlist(plistPath);

      expect(result.passed).toBe(false);
      expect(
        result.issues.some((i) => i.id === 'placeholder-nscamerausagedescription')
      ).toBe(true);
    });

    it('should detect ATS allows arbitrary loads', async () => {
      const plistPath = path.join(tempDir, 'InsecureATS.plist');
      await fs.writeFile(
        plistPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.example.testapp</string>
  <key>CFBundleName</key>
  <string>TestApp</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleExecutable</key>
  <string>TestApp</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
  </dict>
</dict>
</plist>`
      );

      const result = await analyzer.analyzePlist(plistPath);

      expect(result.issues.some((i) => i.id === 'ats-allows-arbitrary-loads')).toBe(true);
    });

    it('should report error for non-existent file', async () => {
      const result = await analyzer.analyzePlist('/nonexistent/path.plist');

      expect(result.passed).toBe(false);
      expect(result.issues[0]?.id).toBe('info-plist-not-found');
    });
  });
});
