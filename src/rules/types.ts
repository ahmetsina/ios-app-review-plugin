import type { Severity, IssueCategory } from '../types/index.js';

export interface CustomRule {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  pattern: string;
  flags?: string | undefined;
  fileTypes?: string[] | undefined;
  guideline?: string | undefined;
  suggestion?: string | undefined;
  category?: IssueCategory | 'custom' | undefined;
}

export interface CustomRuleConfig {
  version: 1;
  rules: CustomRule[];
  disabledRules?: string[] | undefined;
  severityOverrides?: Record<string, Severity> | undefined;
}

export interface CompiledRule extends CustomRule {
  regex: RegExp;
}
