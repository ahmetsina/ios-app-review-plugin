import { execSync } from 'child_process';
import * as path from 'path';

const CLI_PATH = path.resolve(__dirname, '../../src/index.ts');
const TSX = 'npx tsx';

describe('CLI Integration', () => {
  it('should print help with help command', () => {
    const output = execSync(`${TSX} ${CLI_PATH} help`, {
      encoding: 'utf-8',
      timeout: 15000,
    });
    expect(output).toContain('ios-app-review');
    expect(output).toContain('USAGE');
    expect(output).toContain('scan');
  });

  it('should print help with --help flag', () => {
    const output = execSync(`${TSX} ${CLI_PATH} --help`, {
      encoding: 'utf-8',
      timeout: 15000,
    });
    expect(output).toContain('USAGE');
  });

  it('should print version with version command', () => {
    const output = execSync(`${TSX} ${CLI_PATH} version`, {
      encoding: 'utf-8',
      timeout: 15000,
    });
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should print version with --version flag', () => {
    const output = execSync(`${TSX} ${CLI_PATH} --version`, {
      encoding: 'utf-8',
      timeout: 15000,
    });
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should exit with code 2 for unknown command', () => {
    try {
      execSync(`${TSX} ${CLI_PATH} unknown-command`, {
        encoding: 'utf-8',
        timeout: 15000,
      });
      fail('Should have thrown');
    } catch (err) {
      const error = err as { status: number; stderr: string };
      expect(error.status).toBe(2);
      expect(error.stderr).toContain('Unknown command');
    }
  });

  it('should exit with code 2 when scan has no project path', () => {
    try {
      execSync(`${TSX} ${CLI_PATH} scan`, {
        encoding: 'utf-8',
        timeout: 15000,
      });
      fail('Should have thrown');
    } catch (err) {
      const error = err as { status: number; stderr: string };
      expect(error.status).toBe(2);
      expect(error.stderr).toContain('project path is required');
    }
  });

  it('should exit with code 2 for invalid format', () => {
    try {
      execSync(`${TSX} ${CLI_PATH} scan /fake/path --format xml`, {
        encoding: 'utf-8',
        timeout: 15000,
      });
      fail('Should have thrown');
    } catch (err) {
      const error = err as { status: number; stderr: string };
      expect(error.status).toBe(2);
    }
  });

  it('should exit with code 2 for invalid project path', () => {
    try {
      execSync(`${TSX} ${CLI_PATH} scan /nonexistent/path.xcodeproj`, {
        encoding: 'utf-8',
        timeout: 15000,
      });
      fail('Should have thrown');
    } catch (err) {
      const error = err as { status: number };
      expect(error.status).toBe(2);
    }
  });
});
