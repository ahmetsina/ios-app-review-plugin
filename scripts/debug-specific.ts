#!/usr/bin/env npx tsx

import { readFileSync } from 'fs';
import { parsePbxproj } from '../src/parsers/plist.js';

const projectPath = '/Users/austem/Developer/Detach/screen_time_app/Detach.xcodeproj/project.pbxproj';
const content = readFileSync(projectPath, 'utf-8');

// Check if the target ID exists in content
const targetId = '2F1C23F02C664CA100138EF9';
console.log('Looking for target ID:', targetId);
console.log('Found in content:', content.includes(targetId));

// Find the pattern manually
const idPattern = /([A-F0-9]{24})\s*(?:\/\*[^*]*\*\/)?\s*=\s*\{/g;
let count = 0;
let match;
while ((match = idPattern.exec(content)) !== null) {
  count++;
  if (match[1] === targetId) {
    console.log('\nFound target at index:', match.index);
    console.log('Match:', match[0].substring(0, 50));

    // Extract content manually
    const startBrace = match.index + match[0].length - 1;
    let depth = 1;
    let pos = startBrace + 1;
    while (pos < content.length && depth > 0) {
      const char = content[pos];
      if (char === '{') depth++;
      else if (char === '}') depth--;
      pos++;
    }
    const objectContent = content.substring(startBrace + 1, pos - 1);
    console.log('\nExtracted content length:', objectContent.length);
    console.log('First 200 chars:\n', objectContent.substring(0, 200));

    // Check for isa
    const isaMatch = objectContent.match(/isa\s*=\s*(\w+)/);
    console.log('\nisa match:', isaMatch);
  }
}
console.log('\nTotal IDs found:', count);

// Now parse with our function
const project = parsePbxproj(content);
console.log('\nParsed object for target ID:', project.objects[targetId]);
