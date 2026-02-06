import * as fs from 'fs/promises';
import * as path from 'path';
import fg from 'fast-glob';
import type { AnalysisResult, Issue, Severity } from '../types/index.js';
import type { CompiledRule, CustomRuleConfig } from './types.js';

const SOURCE_EXTENSIONS = ['.swift', '.m', '.mm', '.h', '.c', '.cpp'];
const DISABLE_COMMENT_PATTERN = /\/\/\s*ios-review-disable-next-line\s+([\w-]+(?:\s*,\s*[\w-]+)*)/;

export class CustomRuleEngine {
  private disabledRules: Set<string>;
  private severityOverrides: Record<string, Severity>;

  constructor(config?: CustomRuleConfig) {
    this.disabledRules = new Set(config?.disabledRules ?? []);
    this.severityOverrides = config?.severityOverrides ?? {};
  }

  isRuleDisabled(ruleId: string): boolean {
    return this.disabledRules.has(ruleId);
  }

  getSeverityOverride(ruleId: string): Severity | undefined {
    return this.severityOverrides[ruleId];
  }

  async scan(scanPath: string, compiledRules: CompiledRule[]): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    // Filter out disabled rules
    const activeRules = compiledRules.filter((r) => !this.isRuleDisabled(r.id));

    if (activeRules.length === 0) {
      return {
        analyzer: 'Custom Rules',
        passed: true,
        issues: [],
        duration: Date.now() - startTime,
      };
    }

    // Determine files to scan
    const stat = await fs.stat(scanPath);
    let files: string[];

    if (stat.isFile()) {
      files = [scanPath];
    } else {
      const patterns = SOURCE_EXTENSIONS.map((ext) => `**/*${ext}`);
      files = await fg(patterns, {
        cwd: scanPath,
        absolute: true,
        ignore: ['**/node_modules/**', '**/Pods/**', '**/build/**', '**/.build/**'],
      });
    }

    for (const filePath of files) {
      const ext = path.extname(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const rule of activeRules) {
        // Check fileTypes filter
        if (rule.fileTypes && rule.fileTypes.length > 0 && !rule.fileTypes.includes(ext)) {
          continue;
        }

        // Reset regex lastIndex for global patterns
        rule.regex.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = rule.regex.exec(content)) !== null) {
          // Find line number
          const upToMatch = content.substring(0, match.index);
          const lineNumber = upToMatch.split('\n').length;

          // Check for disable comment on previous line
          if (lineNumber >= 2) {
            const prevLine = lines[lineNumber - 2]; // -2 because lineNumber is 1-based and we want prev line
            if (prevLine) {
              const disableMatch = DISABLE_COMMENT_PATTERN.exec(prevLine);
              if (disableMatch?.[1]) {
                const disabledIds = disableMatch[1].split(',').map((s) => s.trim());
                if (disabledIds.includes(rule.id)) {
                  continue;
                }
              }
            }
          }

          const severity = this.getSeverityOverride(rule.id) ?? rule.severity;

          issues.push({
            id: rule.id,
            title: rule.title,
            description: rule.description,
            severity,
            filePath,
            lineNumber,
            guideline: rule.guideline,
            suggestion: rule.suggestion,
            category: rule.category ?? 'custom',
          });

          // For non-global regex, break after first match
          if (!rule.regex.global) {
            break;
          }
        }
      }
    }

    return {
      analyzer: 'Custom Rules',
      passed: issues.every((i) => i.severity !== 'error'),
      issues,
      duration: Date.now() - startTime,
    };
  }
}
