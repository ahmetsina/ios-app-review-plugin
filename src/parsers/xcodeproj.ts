import * as fs from 'fs/promises';
import * as path from 'path';
import { parsePbxproj, fileExists, type PbxProject, type PbxObject } from './plist.js';
import type { XcodeProject, XcodeTarget, TargetType } from '../types/index.js';

/**
 * Parse an Xcode project or workspace
 */
export async function parseXcodeProject(projectPath: string): Promise<XcodeProject> {
  const stats = await fs.stat(projectPath);

  if (stats.isDirectory()) {
    if (projectPath.endsWith('.xcworkspace')) {
      return parseWorkspace(projectPath);
    } else if (projectPath.endsWith('.xcodeproj')) {
      return parseProject(projectPath);
    }
  }

  throw new Error(
    `Invalid project path: ${projectPath}. Expected .xcodeproj or .xcworkspace directory.`
  );
}

/**
 * Parse an .xcodeproj directory
 */
async function parseProject(projectPath: string): Promise<XcodeProject> {
  const pbxprojPath = path.join(projectPath, 'project.pbxproj');

  if (!(await fileExists(pbxprojPath))) {
    throw new Error(`project.pbxproj not found at ${pbxprojPath}`);
  }

  const content = await fs.readFile(pbxprojPath, 'utf-8');
  const pbxProject = parsePbxproj(content);

  const projectName = path.basename(projectPath, '.xcodeproj');
  const basePath = path.dirname(projectPath);

  // Extract targets
  const targets = extractTargets(pbxProject, basePath);

  // Extract configurations
  const configurations = extractConfigurations(pbxProject);

  return {
    path: projectPath,
    name: projectName,
    targets,
    configurations,
  };
}

/**
 * Parse an .xcworkspace directory
 */
async function parseWorkspace(workspacePath: string): Promise<XcodeProject> {
  const contentsPath = path.join(workspacePath, 'contents.xcworkspacedata');

  if (!(await fileExists(contentsPath))) {
    throw new Error(`contents.xcworkspacedata not found at ${contentsPath}`);
  }

  const content = await fs.readFile(contentsPath, 'utf-8');

  // Extract project references from workspace
  const projectRefs = extractWorkspaceProjects(content);
  const basePath = path.dirname(workspacePath);

  // Find the main project (usually the one with the same name as the workspace)
  const workspaceName = path.basename(workspacePath, '.xcworkspace');
  let mainProjectPath: string | undefined;

  for (const ref of projectRefs) {
    const fullPath = path.resolve(basePath, ref);
    if (ref.includes(workspaceName) && (await fileExists(fullPath))) {
      mainProjectPath = fullPath;
      break;
    }
  }

  // Fallback to first project if no matching name
  if (!mainProjectPath && projectRefs.length > 0 && projectRefs[0]) {
    mainProjectPath = path.resolve(basePath, projectRefs[0]);
  }

  if (!mainProjectPath) {
    throw new Error(`No projects found in workspace ${workspacePath}`);
  }

  // Parse the main project
  const project = await parseProject(mainProjectPath);
  project.path = workspacePath;
  project.name = workspaceName;

  return project;
}

/**
 * Extract project paths from workspace data
 */
function extractWorkspaceProjects(content: string): string[] {
  const projects: string[] = [];
  const locationRegex = /location\s*=\s*"group:([^"]+\.xcodeproj)"/g;
  let match: RegExpExecArray | null;

  while ((match = locationRegex.exec(content)) !== null) {
    if (match[1]) {
      projects.push(match[1]);
    }
  }

  return projects;
}

/**
 * Extract targets from a pbxproj
 */
function extractTargets(pbxProject: PbxProject, basePath: string): XcodeTarget[] {
  const targets: XcodeTarget[] = [];
  const objects = pbxProject.objects;

  // Find native targets
  for (const [_id, obj] of Object.entries(objects)) {
    if (obj.isa === 'PBXNativeTarget') {
      const target = extractTarget(obj, objects, basePath);
      if (target) {
        targets.push(target);
      }
    }
  }

  return targets;
}

/**
 * Extract a single target's information
 */
function extractTarget(
  targetObj: PbxObject,
  objects: Record<string, PbxObject>,
  basePath: string
): XcodeTarget | null {
  const name = targetObj.name ?? 'Unknown';
  const type = mapProductType(targetObj.productType);

  // Get build settings from build configuration list
  let bundleIdentifier: string | undefined;
  let infoPlistPath: string | undefined;
  let entitlementsPath: string | undefined;
  let deploymentTarget: string | undefined;

  if (targetObj.buildConfigurationList) {
    const configList = objects[targetObj.buildConfigurationList];
    if (configList && configList.isa === 'XCConfigurationList') {
      // Get build configurations
      const buildConfigs = (configList['buildConfigurations'] as string[] | undefined) ?? [];
      for (const configId of buildConfigs) {
        const config = objects[configId];
        if (config?.buildSettings) {
          const settings = config.buildSettings;
          bundleIdentifier = bundleIdentifier ?? settings['PRODUCT_BUNDLE_IDENTIFIER'];
          infoPlistPath = infoPlistPath ?? settings['INFOPLIST_FILE'];
          entitlementsPath = entitlementsPath ?? settings['CODE_SIGN_ENTITLEMENTS'];
          deploymentTarget = deploymentTarget ?? settings['IPHONEOS_DEPLOYMENT_TARGET'];
        }
      }
    }
  }

  // Resolve paths relative to project
  if (infoPlistPath) {
    infoPlistPath = path.resolve(basePath, infoPlistPath);
  }
  if (entitlementsPath) {
    entitlementsPath = path.resolve(basePath, entitlementsPath);
  }

  // Extract source files
  const sourceFiles = extractSourceFiles(targetObj, objects, basePath);

  return {
    name,
    type,
    bundleIdentifier,
    infoPlistPath,
    entitlementsPath,
    deploymentTarget,
    sourceFiles,
  };
}

/**
 * Map Xcode product type to our TargetType
 */
function mapProductType(productType: string | undefined): TargetType {
  if (!productType) {
    return 'unknown';
  }

  const typeMap: Record<string, TargetType> = {
    'com.apple.product-type.application': 'application',
    'com.apple.product-type.framework': 'framework',
    'com.apple.product-type.library.static': 'staticLibrary',
    'com.apple.product-type.library.dynamic': 'dynamicLibrary',
    'com.apple.product-type.app-extension': 'appExtension',
    'com.apple.product-type.application.watchapp2': 'watchApp',
    'com.apple.product-type.watchkit2-extension': 'watchExtension',
    'com.apple.product-type.tv-app-extension': 'tvExtension',
    'com.apple.product-type.bundle.unit-test': 'unitTest',
    'com.apple.product-type.bundle.ui-testing': 'uiTest',
  };

  return typeMap[productType] ?? 'unknown';
}

/**
 * Extract source files from a target
 */
function extractSourceFiles(
  targetObj: PbxObject,
  objects: Record<string, PbxObject>,
  basePath: string
): string[] {
  const sourceFiles: string[] = [];

  // Find Sources build phase
  const buildPhases = targetObj.buildPhases ?? [];
  for (const phaseId of buildPhases) {
    const phase = objects[phaseId];
    if (phase?.isa === 'PBXSourcesBuildPhase') {
      const files = phase.files ?? [];
      for (const fileId of files) {
        const buildFile = objects[fileId];
        if (buildFile) {
          const fileRef = buildFile['fileRef'] as string | undefined;
          if (fileRef) {
            const fileRefObj = objects[fileRef];
            if (fileRefObj?.path) {
              sourceFiles.push(path.resolve(basePath, fileRefObj.path));
            }
          }
        }
      }
    }
  }

  return sourceFiles;
}

/**
 * Extract build configurations
 */
function extractConfigurations(pbxProject: PbxProject): string[] {
  const configs = new Set<string>();

  for (const obj of Object.values(pbxProject.objects)) {
    if (obj.isa === 'XCBuildConfiguration' && obj.name) {
      configs.add(obj.name);
    }
  }

  return Array.from(configs);
}
