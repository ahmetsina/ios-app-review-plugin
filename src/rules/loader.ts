import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import type { CustomRuleConfig, CompiledRule } from './types.js';

const CustomRuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['error', 'warning', 'info']),
  pattern: z.string().min(1),
  flags: z.string().optional(),
  fileTypes: z.array(z.string()).optional(),
  guideline: z.string().optional(),
  suggestion: z.string().optional(),
  category: z.string().optional(),
});

const CustomRuleConfigSchema = z.object({
  version: z.literal(1),
  rules: z.array(CustomRuleSchema),
  disabledRules: z.array(z.string()).optional(),
  severityOverrides: z.record(z.enum(['error', 'warning', 'info'])).optional(),
});

const CONFIG_FILENAME = '.ios-review-rules.json';

export class RuleLoader {
  /**
   * Find config file by walking up from the given directory
   */
  async findConfig(startDir: string): Promise<string | null> {
    let dir = path.resolve(startDir);
    const root = path.parse(dir).root;

    while (dir !== root) {
      const configPath = path.join(dir, CONFIG_FILENAME);
      try {
        await fs.access(configPath);
        return configPath;
      } catch {
        dir = path.dirname(dir);
      }
    }
    return null;
  }

  /**
   * Load and validate a config file
   */
  async loadConfig(configPath: string): Promise<CustomRuleConfig> {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return CustomRuleConfigSchema.parse(parsed) as CustomRuleConfig;
  }

  /**
   * Compile regex patterns from rules
   */
  compileRules(config: CustomRuleConfig): CompiledRule[] {
    const compiled: CompiledRule[] = [];

    for (const rule of config.rules) {
      const flags = rule.flags ?? 'g';
      const regex = new RegExp(rule.pattern, flags);
      compiled.push({ ...rule, regex });
    }

    return compiled;
  }

  /**
   * Find, load, validate, and compile rules from project directory
   */
  async loadFromProject(projectDir: string): Promise<{ config: CustomRuleConfig; rules: CompiledRule[] } | null> {
    const configPath = await this.findConfig(projectDir);
    if (!configPath) return null;

    const config = await this.loadConfig(configPath);
    const rules = this.compileRules(config);
    return { config, rules };
  }
}
