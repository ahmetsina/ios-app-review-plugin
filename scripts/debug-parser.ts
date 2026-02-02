#!/usr/bin/env npx tsx

import { parseXcodeProject } from '../src/parsers/xcodeproj.js';

const projectPath = process.argv[2];

if (!projectPath) {
  console.error('Usage: npx tsx scripts/debug-parser.ts <path-to-xcodeproj>');
  process.exit(1);
}

async function main() {
  console.log(`\n🔍 Parsing: ${projectPath}\n`);

  try {
    const project = await parseXcodeProject(projectPath);

    console.log('Project Name:', project.name);
    console.log('Configurations:', project.configurations);
    console.log('\nTargets:');

    for (const target of project.targets) {
      console.log(`\n  📦 ${target.name}`);
      console.log(`     Type: ${target.type}`);
      console.log(`     Bundle ID: ${target.bundleIdentifier ?? 'N/A'}`);
      console.log(`     Info.plist: ${target.infoPlistPath ?? 'N/A'}`);
      console.log(`     Entitlements: ${target.entitlementsPath ?? 'N/A'}`);
      console.log(`     Source files: ${target.sourceFiles.length}`);
    }

  } catch (error) {
    console.error('❌ Parse failed:', error);
    process.exit(1);
  }
}

main();
