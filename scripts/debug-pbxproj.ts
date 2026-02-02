#!/usr/bin/env npx tsx

import { readFileSync } from 'fs';
import { parsePbxproj } from '../src/parsers/plist.js';

const projectPath = '/Users/austem/Developer/Detach/screen_time_app/Detach.xcodeproj/project.pbxproj';

const content = readFileSync(projectPath, 'utf-8');
const project = parsePbxproj(content);

console.log('Total objects:', Object.keys(project.objects).length);

const nativeTargets = Object.entries(project.objects)
  .filter(([_, obj]) => obj.isa === 'PBXNativeTarget');

console.log('PBXNativeTarget count:', nativeTargets.length);

for (const [id, obj] of nativeTargets.slice(0, 3)) {
  console.log('\nTarget:', id);
  console.log('  isa:', obj.isa);
  console.log('  name:', obj.name);
  console.log('  productType:', obj.productType);
  console.log('  buildConfigurationList:', obj.buildConfigurationList);
}

// Also show some object types
const isaCounts = new Map<string, number>();
for (const obj of Object.values(project.objects)) {
  const count = isaCounts.get(obj.isa) ?? 0;
  isaCounts.set(obj.isa, count + 1);
}

console.log('\nObject types:');
for (const [isa, count] of Array.from(isaCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${isa}: ${count}`);
}
