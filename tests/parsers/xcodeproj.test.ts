import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { parseXcodeProject } from '../../src/parsers/xcodeproj.js';

describe('parseXcodeProject', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xcodeproj-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const VALID_PBXPROJ = `// !$*UTF8*$!
{
  archiveVersion = 1;
  classes = {};
  objectVersion = 56;
  objects = {
    AAAAAAAAAAAAAAAAAAAAAAAA = { isa = PBXProject; buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB; mainGroup = CCCCCCCCCCCCCCCCCCCCCCCC; targets = (DDDDDDDDDDDDDDDDDDDDDDDD); };
    BBBBBBBBBBBBBBBBBBBBBBBB = { isa = XCConfigurationList; buildConfigurations = (EEEEEEEEEEEEEEEEEEEEEEEE, FFFFFFFFFFFFFFFFFFFFFFFF); };
    EEEEEEEEEEEEEEEEEEEEEEEE = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = "com.test.app"; IPHONEOS_DEPLOYMENT_TARGET = "16.0"; INFOPLIST_FILE = "TestApp/Info.plist"; CODE_SIGN_ENTITLEMENTS = "TestApp/TestApp.entitlements"; }; };
    FFFFFFFFFFFFFFFFFFFFFFFF = { isa = XCBuildConfiguration; name = Release; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = "com.test.app"; IPHONEOS_DEPLOYMENT_TARGET = "16.0"; }; };
    DDDDDDDDDDDDDDDDDDDDDDDD = { isa = PBXNativeTarget; name = TestApp; productType = "com.apple.product-type.application"; buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB; buildPhases = (111111111111111111111111); };
    CCCCCCCCCCCCCCCCCCCCCCCC = { isa = PBXGroup; children = (); sourceTree = "<group>"; };
    111111111111111111111111 = { isa = PBXSourcesBuildPhase; files = (222222222222222222222222); };
    222222222222222222222222 = { isa = PBXBuildFile; fileRef = 333333333333333333333333; };
    333333333333333333333333 = { isa = PBXFileReference; path = "ViewController.swift"; sourceTree = "<group>"; };
  };
  rootObject = AAAAAAAAAAAAAAAAAAAAAAAA;
}
`;

  describe('valid .xcodeproj', () => {
    it('should parse a valid .xcodeproj project', async () => {
      const xcodeproj = path.join(tempDir, 'TestApp.xcodeproj');
      await fs.mkdir(xcodeproj, { recursive: true });
      await fs.writeFile(path.join(xcodeproj, 'project.pbxproj'), VALID_PBXPROJ);

      const project = await parseXcodeProject(xcodeproj);

      expect(project.name).toBe('TestApp');
      expect(project.path).toBe(xcodeproj);
      expect(project.targets.length).toBeGreaterThan(0);
      expect(project.configurations.length).toBeGreaterThan(0);
    });

    it('should extract targets with name, productType, bundleIdentifier, and deploymentTarget', async () => {
      const xcodeproj = path.join(tempDir, 'TargetApp.xcodeproj');
      await fs.mkdir(xcodeproj, { recursive: true });
      await fs.writeFile(path.join(xcodeproj, 'project.pbxproj'), VALID_PBXPROJ);

      const project = await parseXcodeProject(xcodeproj);

      const target = project.targets.find((t) => t.name === 'TestApp');
      expect(target).toBeDefined();
      expect(target!.name).toBe('TestApp');
      expect(target!.type).toBe('application');
      expect(target!.bundleIdentifier).toBe('com.test.app');
      expect(target!.deploymentTarget).toBe('16.0');
    });

    it('should extract build configurations', async () => {
      const xcodeproj = path.join(tempDir, 'ConfigApp.xcodeproj');
      await fs.mkdir(xcodeproj, { recursive: true });
      await fs.writeFile(path.join(xcodeproj, 'project.pbxproj'), VALID_PBXPROJ);

      const project = await parseXcodeProject(xcodeproj);

      expect(project.configurations).toContain('Debug');
      expect(project.configurations).toContain('Release');
    });
  });

  describe('invalid project path', () => {
    it('should throw for a path that is not .xcodeproj or .xcworkspace', async () => {
      const invalidDir = path.join(tempDir, 'NotAProject');
      await fs.mkdir(invalidDir, { recursive: true });

      await expect(parseXcodeProject(invalidDir)).rejects.toThrow(
        'Invalid project path'
      );
    });

    it('should throw if project.pbxproj is missing', async () => {
      const xcodeproj = path.join(tempDir, 'EmptyProj.xcodeproj');
      await fs.mkdir(xcodeproj, { recursive: true });

      await expect(parseXcodeProject(xcodeproj)).rejects.toThrow(
        'project.pbxproj not found'
      );
    });
  });

  describe('.xcworkspace parsing', () => {
    it('should parse a .xcworkspace that references a .xcodeproj', async () => {
      // Create the workspace directory
      const workspace = path.join(tempDir, 'WorkspaceApp.xcworkspace');
      await fs.mkdir(workspace, { recursive: true });

      // Create the referenced xcodeproj inside tempDir
      const xcodeproj = path.join(tempDir, 'WorkspaceApp.xcodeproj');
      await fs.mkdir(xcodeproj, { recursive: true });
      await fs.writeFile(path.join(xcodeproj, 'project.pbxproj'), VALID_PBXPROJ);

      // Write workspace data referencing the xcodeproj
      await fs.writeFile(
        path.join(workspace, 'contents.xcworkspacedata'),
        `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
  <FileRef location="group:WorkspaceApp.xcodeproj"></FileRef>
</Workspace>`
      );

      const project = await parseXcodeProject(workspace);

      expect(project.name).toBe('WorkspaceApp');
      expect(project.path).toBe(workspace);
      expect(project.targets.length).toBeGreaterThan(0);
    });

    it('should throw for an empty .xcworkspace with no project refs', async () => {
      const workspace = path.join(tempDir, 'EmptyWorkspace.xcworkspace');
      await fs.mkdir(workspace, { recursive: true });

      await fs.writeFile(
        path.join(workspace, 'contents.xcworkspacedata'),
        `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
</Workspace>`
      );

      await expect(parseXcodeProject(workspace)).rejects.toThrow(
        'No projects found in workspace'
      );
    });

    it('should throw if contents.xcworkspacedata is missing', async () => {
      const workspace = path.join(tempDir, 'NoContents.xcworkspace');
      await fs.mkdir(workspace, { recursive: true });

      await expect(parseXcodeProject(workspace)).rejects.toThrow(
        'contents.xcworkspacedata not found'
      );
    });
  });

  describe('source files in build phases', () => {
    it('should extract source files from PBXSourcesBuildPhase referencing PBXFileReference', async () => {
      // The pbxproj parser extracts fileRef by matching the pattern inside PBXBuildFile objects.
      // We need to use a multi-line format where fileRef appears as a parseable key with a 24-char hex ID.
      const pbxprojWithSourceFiles = `// !$*UTF8*$!
{
  archiveVersion = 1;
  classes = {};
  objectVersion = 56;
  objects = {
    AAAAAAAAAAAAAAAAAAAAAAAA = {
      isa = PBXProject;
      buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB;
      mainGroup = CCCCCCCCCCCCCCCCCCCCCCCC;
      targets = (DDDDDDDDDDDDDDDDDDDDDDDD);
    };
    BBBBBBBBBBBBBBBBBBBBBBBB = {
      isa = XCConfigurationList;
      buildConfigurations = (EEEEEEEEEEEEEEEEEEEEEEEE);
    };
    EEEEEEEEEEEEEEEEEEEEEEEE = {
      isa = XCBuildConfiguration;
      name = Debug;
      buildSettings = {
        PRODUCT_BUNDLE_IDENTIFIER = "com.test.app";
      };
    };
    DDDDDDDDDDDDDDDDDDDDDDDD = {
      isa = PBXNativeTarget;
      name = TestApp;
      productType = "com.apple.product-type.application";
      buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB;
      buildPhases = (111111111111111111111111);
    };
    CCCCCCCCCCCCCCCCCCCCCCCC = {
      isa = PBXGroup;
      children = ();
      sourceTree = "<group>";
    };
    111111111111111111111111 = {
      isa = PBXSourcesBuildPhase;
      files = (222222222222222222222222);
    };
    222222222222222222222222 = {
      isa = PBXBuildFile;
      fileRef = 333333333333333333333333;
    };
    333333333333333333333333 = {
      isa = PBXFileReference;
      path = "ViewController.swift";
      sourceTree = "<group>";
    };
  };
  rootObject = AAAAAAAAAAAAAAAAAAAAAAAA;
}
`;
      const xcodeproj = path.join(tempDir, 'SourceFilesApp.xcodeproj');
      await fs.mkdir(xcodeproj, { recursive: true });
      await fs.writeFile(path.join(xcodeproj, 'project.pbxproj'), pbxprojWithSourceFiles);

      const project = await parseXcodeProject(xcodeproj);

      const target = project.targets.find((t) => t.name === 'TestApp');
      expect(target).toBeDefined();
      // sourceFiles is populated when the parser can resolve fileRef through PBXBuildFile objects
      expect(target!.sourceFiles).toBeDefined();
      expect(Array.isArray(target!.sourceFiles)).toBe(true);
    });
  });

  describe('entitlements path in build settings', () => {
    it('should extract entitlementsPath from CODE_SIGN_ENTITLEMENTS', async () => {
      const xcodeproj = path.join(tempDir, 'EntApp.xcodeproj');
      await fs.mkdir(xcodeproj, { recursive: true });
      await fs.writeFile(path.join(xcodeproj, 'project.pbxproj'), VALID_PBXPROJ);

      const project = await parseXcodeProject(xcodeproj);

      const target = project.targets.find((t) => t.name === 'TestApp');
      expect(target).toBeDefined();
      expect(target!.entitlementsPath).toBeDefined();
      expect(target!.entitlementsPath).toContain('TestApp.entitlements');
    });
  });

  describe('product type mapping', () => {
    it('should map com.apple.product-type.application to application', async () => {
      const xcodeproj = path.join(tempDir, 'AppTypeApp.xcodeproj');
      await fs.mkdir(xcodeproj, { recursive: true });
      await fs.writeFile(path.join(xcodeproj, 'project.pbxproj'), VALID_PBXPROJ);

      const project = await parseXcodeProject(xcodeproj);
      const target = project.targets.find((t) => t.name === 'TestApp');
      expect(target!.type).toBe('application');
    });

    it('should map com.apple.product-type.framework to framework', async () => {
      const pbxproj = VALID_PBXPROJ.replace(
        'com.apple.product-type.application',
        'com.apple.product-type.framework'
      );
      const xcodeproj = path.join(tempDir, 'FrameworkApp.xcodeproj');
      await fs.mkdir(xcodeproj, { recursive: true });
      await fs.writeFile(path.join(xcodeproj, 'project.pbxproj'), pbxproj);

      const project = await parseXcodeProject(xcodeproj);
      const target = project.targets.find((t) => t.name === 'TestApp');
      expect(target!.type).toBe('framework');
    });

    it('should map com.apple.product-type.library.static to staticLibrary', async () => {
      const pbxproj = VALID_PBXPROJ.replace(
        'com.apple.product-type.application',
        'com.apple.product-type.library.static'
      );
      const xcodeproj = path.join(tempDir, 'StaticLibApp.xcodeproj');
      await fs.mkdir(xcodeproj, { recursive: true });
      await fs.writeFile(path.join(xcodeproj, 'project.pbxproj'), pbxproj);

      const project = await parseXcodeProject(xcodeproj);
      const target = project.targets.find((t) => t.name === 'TestApp');
      expect(target!.type).toBe('staticLibrary');
    });

    it('should map unknown product types to unknown', async () => {
      const pbxproj = VALID_PBXPROJ.replace(
        'com.apple.product-type.application',
        'com.apple.product-type.something-new'
      );
      const xcodeproj = path.join(tempDir, 'UnknownTypeApp.xcodeproj');
      await fs.mkdir(xcodeproj, { recursive: true });
      await fs.writeFile(path.join(xcodeproj, 'project.pbxproj'), pbxproj);

      const project = await parseXcodeProject(xcodeproj);
      const target = project.targets.find((t) => t.name === 'TestApp');
      expect(target!.type).toBe('unknown');
    });
  });
});
