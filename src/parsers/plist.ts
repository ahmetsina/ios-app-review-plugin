import * as fs from 'fs/promises';
import * as plist from 'plist';

/**
 * Parse a plist file (XML or binary format)
 */
export async function parsePlist<T = Record<string, unknown>>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Try XML plist first
  try {
    return plist.parse(content) as T;
  } catch {
    // If XML parsing fails, it might be binary plist
    // The plist library handles both, but let's try with buffer
    const buffer = await fs.readFile(filePath);
    return plist.parse(buffer.toString('utf-8')) as T;
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read file contents as string
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

/**
 * Parse a pbxproj file (OpenStep plist format)
 * This is a simplified parser for the Xcode project format
 */
export function parsePbxproj(content: string): PbxProject {
  const result: PbxProject = {
    archiveVersion: '',
    objectVersion: '',
    rootObject: '',
    objects: {},
  };

  // Extract archive version
  const archiveMatch = content.match(/archiveVersion\s*=\s*(\d+)/);
  if (archiveMatch?.[1]) {
    result.archiveVersion = archiveMatch[1];
  }

  // Extract object version
  const objectMatch = content.match(/objectVersion\s*=\s*(\d+)/);
  if (objectMatch?.[1]) {
    result.objectVersion = objectMatch[1];
  }

  // Extract root object
  const rootMatch = content.match(/rootObject\s*=\s*([A-F0-9]+)/);
  if (rootMatch?.[1]) {
    result.rootObject = rootMatch[1];
  }

  // Parse objects section
  const objectsMatch = content.match(/objects\s*=\s*\{([\s\S]*)\};\s*rootObject/);
  if (objectsMatch?.[1]) {
    result.objects = parseObjects(objectsMatch[1]);
  }

  return result;
}

/**
 * Parse the objects section of a pbxproj file
 */
function parseObjects(content: string): Record<string, PbxObject> {
  const objects: Record<string, PbxObject> = {};

  // Match object entries: ID = { ... };
  const objectRegex = /([A-F0-9]{24})\s*(?:\/\*[^*]*\*\/)?\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = objectRegex.exec(content)) !== null) {
    const id = match[1];
    const objectContent = match[2];

    if (id && objectContent) {
      objects[id] = parseObjectContent(objectContent);
    }
  }

  return objects;
}

/**
 * Parse individual object content
 */
function parseObjectContent(content: string): PbxObject {
  const obj: PbxObject = { isa: '' };

  // Extract isa (object type)
  const isaMatch = content.match(/isa\s*=\s*(\w+)/);
  if (isaMatch?.[1]) {
    obj.isa = isaMatch[1];
  }

  // Extract name
  const nameMatch = content.match(/name\s*=\s*"?([^";]+)"?/);
  if (nameMatch?.[1]) {
    obj.name = nameMatch[1].trim();
  }

  // Extract path
  const pathMatch = content.match(/path\s*=\s*"?([^";]+)"?/);
  if (pathMatch?.[1]) {
    obj.path = pathMatch[1].trim();
  }

  // Extract productType
  const productTypeMatch = content.match(/productType\s*=\s*"([^"]+)"/);
  if (productTypeMatch?.[1]) {
    obj.productType = productTypeMatch[1];
  }

  // Extract buildConfigurationList
  const buildConfigMatch = content.match(/buildConfigurationList\s*=\s*([A-F0-9]{24})/);
  if (buildConfigMatch?.[1]) {
    obj.buildConfigurationList = buildConfigMatch[1];
  }

  // Extract buildSettings (simplified)
  const buildSettingsMatch = content.match(/buildSettings\s*=\s*\{([^}]+)\}/);
  if (buildSettingsMatch?.[1]) {
    obj.buildSettings = parseBuildSettings(buildSettingsMatch[1]);
  }

  // Extract files array
  const filesMatch = content.match(/files\s*=\s*\(([^)]*)\)/);
  if (filesMatch?.[1]) {
    obj.files = parseArray(filesMatch[1]);
  }

  // Extract dependencies array
  const depsMatch = content.match(/dependencies\s*=\s*\(([^)]*)\)/);
  if (depsMatch?.[1]) {
    obj.dependencies = parseArray(depsMatch[1]);
  }

  // Extract buildPhases array
  const phasesMatch = content.match(/buildPhases\s*=\s*\(([^)]*)\)/);
  if (phasesMatch?.[1]) {
    obj.buildPhases = parseArray(phasesMatch[1]);
  }

  return obj;
}

/**
 * Parse build settings
 */
function parseBuildSettings(content: string): Record<string, string> {
  const settings: Record<string, string> = {};
  const settingRegex = /(\w+)\s*=\s*"?([^";]+)"?/g;
  let match: RegExpExecArray | null;

  while ((match = settingRegex.exec(content)) !== null) {
    const key = match[1];
    const value = match[2];
    if (key && value) {
      settings[key] = value.trim();
    }
  }

  return settings;
}

/**
 * Parse an array from pbxproj format
 */
function parseArray(content: string): string[] {
  const items: string[] = [];
  const itemRegex = /([A-F0-9]{24})/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(content)) !== null) {
    if (match[1]) {
      items.push(match[1]);
    }
  }

  return items;
}

/**
 * PBX project structure
 */
export interface PbxProject {
  archiveVersion: string;
  objectVersion: string;
  rootObject: string;
  objects: Record<string, PbxObject>;
}

/**
 * PBX object (generic)
 */
export interface PbxObject {
  isa: string;
  name?: string;
  path?: string;
  productType?: string;
  buildConfigurationList?: string;
  buildSettings?: Record<string, string>;
  files?: string[];
  dependencies?: string[];
  buildPhases?: string[];
  [key: string]: unknown;
}
