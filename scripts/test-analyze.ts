#!/usr/bin/env npx tsx

import { runAnalysis } from '../src/analyzer.js';

const projectPath = process.argv[2];

if (!projectPath) {
  console.error('Usage: npx tsx scripts/test-analyze.ts <path-to-xcodeproj>');
  process.exit(1);
}

async function main() {
  console.log(`\n🔍 Analyzing: ${projectPath}\n`);
  console.log('='.repeat(60));

  try {
    const report = await runAnalysis({ projectPath });

    // Print summary
    console.log('\n📊 ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Project: ${report.projectPath}`);
    console.log(`Date: ${report.timestamp}`);
    console.log(`Status: ${report.summary.passed ? '✅ PASSED' : '❌ ISSUES FOUND'}`);
    console.log(`\nTotal Issues: ${report.summary.totalIssues}`);
    console.log(`  Errors:   ${report.summary.errors}`);
    console.log(`  Warnings: ${report.summary.warnings}`);
    console.log(`  Info:     ${report.summary.info}`);
    console.log(`\nDuration: ${report.summary.duration}ms`);

    // Print issues by analyzer
    for (const result of report.results) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📋 ${result.analyzer}`);
      console.log(`${'─'.repeat(60)}`);

      if (result.issues.length === 0) {
        console.log('✅ No issues found');
      } else {
        for (const issue of result.issues) {
          const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`\n${icon} [${issue.severity.toUpperCase()}] ${issue.title}`);
          console.log(`   ${issue.description.split('\n')[0]}`);
          if (issue.filePath) {
            const location = issue.lineNumber ? `${issue.filePath}:${issue.lineNumber}` : issue.filePath;
            console.log(`   📁 ${location}`);
          }
          if (issue.guideline) {
            console.log(`   📖 ${issue.guideline}`);
          }
          if (issue.suggestion) {
            console.log(`   💡 ${issue.suggestion}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Analysis complete!\n');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

main();
