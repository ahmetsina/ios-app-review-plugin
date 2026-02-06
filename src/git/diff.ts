import { execSync } from 'child_process';
import * as path from 'path';

export function getChangedFiles(basePath: string, since: string): string[] {
  try {
    const output = execSync(`git diff --name-only ${since}`, {
      cwd: basePath,
      encoding: 'utf-8',
      timeout: 10000,
    });

    return output
      .trim()
      .split('\n')
      .filter((f) => f.length > 0)
      .map((f) => path.resolve(basePath, f));
  } catch {
    // If git diff fails (not a git repo, invalid ref, etc.), return empty
    return [];
  }
}
