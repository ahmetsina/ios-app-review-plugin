import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { parsePlist, fileExists, readFile, parsePbxproj } from '../../src/parsers/plist.js';

describe('plist parser', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plist-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('parsePlist', () => {
    it('should parse a valid XML plist file', async () => {
      const plistPath = path.join(tempDir, 'valid.plist');
      await fs.writeFile(
        plistPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.test.app</string>
  <key>CFBundleName</key>
  <string>TestApp</string>
  <key>CFBundleVersion</key>
  <string>1</string>
</dict>
</plist>`
      );

      const result = await parsePlist<Record<string, unknown>>(plistPath);

      expect(result['CFBundleIdentifier']).toBe('com.test.app');
      expect(result['CFBundleName']).toBe('TestApp');
      expect(result['CFBundleVersion']).toBe('1');
    });

    it('should throw for an invalid plist file', async () => {
      const plistPath = path.join(tempDir, 'invalid.plist');
      await fs.writeFile(plistPath, 'this is not valid plist content at all <><>');

      await expect(parsePlist(plistPath)).rejects.toThrow();
    });
  });

  describe('fileExists', () => {
    it('should return true for an existing file', async () => {
      const filePath = path.join(tempDir, 'exists.txt');
      await fs.writeFile(filePath, 'hello');

      const result = await fileExists(filePath);
      expect(result).toBe(true);
    });

    it('should return false for a non-existing file', async () => {
      const filePath = path.join(tempDir, 'does-not-exist.txt');

      const result = await fileExists(filePath);
      expect(result).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file contents as a string', async () => {
      const filePath = path.join(tempDir, 'readable.txt');
      await fs.writeFile(filePath, 'file content here');

      const result = await readFile(filePath);
      expect(result).toBe('file content here');
    });
  });

  describe('parsePbxproj', () => {
    it('should extract archiveVersion, objectVersion, and rootObject', () => {
      const content = `// !$*UTF8*$!
{
  archiveVersion = 1;
  classes = {};
  objectVersion = 56;
  objects = {
    AAAAAAAAAAAAAAAAAAAAAAAA = { isa = PBXProject; mainGroup = BBBBBBBBBBBBBBBBBBBBBBBB; targets = (); };
    BBBBBBBBBBBBBBBBBBBBBBBB = { isa = PBXGroup; children = (); sourceTree = "<group>"; };
  };
  rootObject = AAAAAAAAAAAAAAAAAAAAAAAA;
}
`;

      const result = parsePbxproj(content);

      expect(result.archiveVersion).toBe('1');
      expect(result.objectVersion).toBe('56');
      expect(result.rootObject).toBe('AAAAAAAAAAAAAAAAAAAAAAAA');
    });

    it('should parse objects with various isa types', () => {
      const content = `// !$*UTF8*$!
{
  archiveVersion = 1;
  objectVersion = 56;
  objects = {
    AAAAAAAAAAAAAAAAAAAAAAAA = { isa = PBXProject; mainGroup = CCCCCCCCCCCCCCCCCCCCCCCC; targets = (BBBBBBBBBBBBBBBBBBBBBBBB); };
    BBBBBBBBBBBBBBBBBBBBBBBB = { isa = PBXNativeTarget; name = MyApp; productType = "com.apple.product-type.application"; buildPhases = (); };
    CCCCCCCCCCCCCCCCCCCCCCCC = { isa = PBXGroup; children = (); sourceTree = "<group>"; };
    DDDDDDDDDDDDDDDDDDDDDDDD = { isa = PBXFileReference; path = "AppDelegate.swift"; sourceTree = "<group>"; };
    EEEEEEEEEEEEEEEEEEEEEEEE = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = "com.test.myapp"; }; };
  };
  rootObject = AAAAAAAAAAAAAAAAAAAAAAAA;
}
`;

      const result = parsePbxproj(content);

      expect(result.objects['AAAAAAAAAAAAAAAAAAAAAAAA']?.isa).toBe('PBXProject');
      expect(result.objects['BBBBBBBBBBBBBBBBBBBBBBBB']?.isa).toBe('PBXNativeTarget');
      expect(result.objects['BBBBBBBBBBBBBBBBBBBBBBBB']?.name).toBe('MyApp');
      expect(result.objects['BBBBBBBBBBBBBBBBBBBBBBBB']?.productType).toBe(
        'com.apple.product-type.application'
      );
      expect(result.objects['CCCCCCCCCCCCCCCCCCCCCCCC']?.isa).toBe('PBXGroup');
      expect(result.objects['DDDDDDDDDDDDDDDDDDDDDDDD']?.isa).toBe('PBXFileReference');
      expect(result.objects['DDDDDDDDDDDDDDDDDDDDDDDD']?.path).toBe('AppDelegate.swift');
      expect(result.objects['EEEEEEEEEEEEEEEEEEEEEEEE']?.isa).toBe('XCBuildConfiguration');
    });

    it('should parse buildSettings correctly', () => {
      const content = `// !$*UTF8*$!
{
  archiveVersion = 1;
  objectVersion = 56;
  objects = {
    AAAAAAAAAAAAAAAAAAAAAAAA = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = "com.test.app"; IPHONEOS_DEPLOYMENT_TARGET = "16.0"; INFOPLIST_FILE = "App/Info.plist"; CODE_SIGN_ENTITLEMENTS = "App/App.entitlements"; SWIFT_VERSION = "5.0"; }; };
    BBBBBBBBBBBBBBBBBBBBBBBB = { isa = PBXProject; mainGroup = CCCCCCCCCCCCCCCCCCCCCCCC; targets = (); };
    CCCCCCCCCCCCCCCCCCCCCCCC = { isa = PBXGroup; children = (); sourceTree = "<group>"; };
  };
  rootObject = BBBBBBBBBBBBBBBBBBBBBBBB;
}
`;

      const result = parsePbxproj(content);
      const config = result.objects['AAAAAAAAAAAAAAAAAAAAAAAA'];

      expect(config?.buildSettings).toBeDefined();
      expect(config!.buildSettings!['PRODUCT_BUNDLE_IDENTIFIER']).toBe('com.test.app');
      expect(config!.buildSettings!['IPHONEOS_DEPLOYMENT_TARGET']).toBe('16.0');
      expect(config!.buildSettings!['INFOPLIST_FILE']).toBe('App/Info.plist');
      expect(config!.buildSettings!['CODE_SIGN_ENTITLEMENTS']).toBe('App/App.entitlements');
      expect(config!.buildSettings!['SWIFT_VERSION']).toBe('5.0');
    });

    it('should parse arrays (files, buildPhases, buildConfigurations)', () => {
      const content = `// !$*UTF8*$!
{
  archiveVersion = 1;
  objectVersion = 56;
  objects = {
    AAAAAAAAAAAAAAAAAAAAAAAA = { isa = PBXNativeTarget; name = TestApp; buildPhases = (BBBBBBBBBBBBBBBBBBBBBBBB, CCCCCCCCCCCCCCCCCCCCCCCC); buildConfigurationList = DDDDDDDDDDDDDDDDDDDDDDDD; };
    BBBBBBBBBBBBBBBBBBBBBBBB = { isa = PBXSourcesBuildPhase; files = (EEEEEEEEEEEEEEEEEEEEEEEE, FFFFFFFFFFFFFFFFFFFFFFFF); };
    CCCCCCCCCCCCCCCCCCCCCCCC = { isa = PBXFrameworksBuildPhase; files = (); };
    DDDDDDDDDDDDDDDDDDDDDDDD = { isa = XCConfigurationList; buildConfigurations = (111111111111111111111111, 222222222222222222222222); };
    EEEEEEEEEEEEEEEEEEEEEEEE = { isa = PBXBuildFile; };
    FFFFFFFFFFFFFFFFFFFFFFFF = { isa = PBXBuildFile; };
    111111111111111111111111 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { }; };
    222222222222222222222222 = { isa = XCBuildConfiguration; name = Release; buildSettings = { }; };
    333333333333333333333333 = { isa = PBXProject; mainGroup = 444444444444444444444444; targets = (AAAAAAAAAAAAAAAAAAAAAAAA); };
    444444444444444444444444 = { isa = PBXGroup; children = (); sourceTree = "<group>"; };
  };
  rootObject = 333333333333333333333333;
}
`;

      const result = parsePbxproj(content);

      // Check buildPhases array
      const target = result.objects['AAAAAAAAAAAAAAAAAAAAAAAA'];
      expect(target?.buildPhases).toEqual([
        'BBBBBBBBBBBBBBBBBBBBBBBB',
        'CCCCCCCCCCCCCCCCCCCCCCCC',
      ]);

      // Check files array
      const sourcesPhase = result.objects['BBBBBBBBBBBBBBBBBBBBBBBB'];
      expect(sourcesPhase?.files).toEqual([
        'EEEEEEEEEEEEEEEEEEEEEEEE',
        'FFFFFFFFFFFFFFFFFFFFFFFF',
      ]);

      // Check buildConfigurations array
      const configList = result.objects['DDDDDDDDDDDDDDDDDDDDDDDD'];
      expect(configList?.['buildConfigurations']).toEqual([
        '111111111111111111111111',
        '222222222222222222222222',
      ]);
    });

    it('should handle content with comments (/* ... */)', () => {
      const content = `// !$*UTF8*$!
{
  archiveVersion = 1;
  objectVersion = 56;
  objects = {
    AAAAAAAAAAAAAAAAAAAAAAAA /* MyApp */ = { isa = PBXNativeTarget; name = MyApp; productType = "com.apple.product-type.application"; buildPhases = (); };
    BBBBBBBBBBBBBBBBBBBBBBBB /* Project object */ = { isa = PBXProject; mainGroup = CCCCCCCCCCCCCCCCCCCCCCCC; targets = (AAAAAAAAAAAAAAAAAAAAAAAA /* MyApp */); };
    CCCCCCCCCCCCCCCCCCCCCCCC = { isa = PBXGroup; children = (); sourceTree = "<group>"; };
  };
  rootObject = BBBBBBBBBBBBBBBBBBBBBBBB /* Project object */;
}
`;

      const result = parsePbxproj(content);

      expect(result.rootObject).toBe('BBBBBBBBBBBBBBBBBBBBBBBB');
      expect(result.objects['AAAAAAAAAAAAAAAAAAAAAAAA']?.isa).toBe('PBXNativeTarget');
      expect(result.objects['AAAAAAAAAAAAAAAAAAAAAAAA']?.name).toBe('MyApp');
    });

    it('should handle empty objects section', () => {
      const content = `// !$*UTF8*$!
{
  archiveVersion = 1;
  objectVersion = 56;
  objects = {
  };
  rootObject = AAAAAAAAAAAAAAAAAAAAAAAA;
}
`;

      const result = parsePbxproj(content);

      expect(result.archiveVersion).toBe('1');
      expect(result.objectVersion).toBe('56');
      expect(result.rootObject).toBe('AAAAAAAAAAAAAAAAAAAAAAAA');
      expect(Object.keys(result.objects)).toHaveLength(0);
    });
  });
});
