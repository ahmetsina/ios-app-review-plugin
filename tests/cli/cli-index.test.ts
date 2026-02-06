/**
 * Tests for src/cli/index.ts — runCli function
 */

jest.mock('../../src/cli/commands/help.js', () => ({
  printHelp: jest.fn(),
}));
jest.mock('../../src/cli/commands/version.js', () => ({
  printVersion: jest.fn(),
}));
jest.mock('../../src/cli/commands/scan.js', () => ({
  runScan: jest.fn(),
}));

import { runCli } from '../../src/cli/index.js';
import { printHelp } from '../../src/cli/commands/help.js';
import { printVersion } from '../../src/cli/commands/version.js';
import { runScan } from '../../src/cli/commands/scan.js';

const mockPrintHelp = printHelp as jest.MockedFunction<typeof printHelp>;
const mockPrintVersion = printVersion as jest.MockedFunction<typeof printVersion>;
const mockRunScan = runScan as jest.MockedFunction<typeof runScan>;

describe('runCli', () => {
  let mockExit: jest.SpyInstance;
  let mockStderr: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockStderr = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockStderr.mockRestore();
  });

  /**
   * Helper: argv is always ['node', 'script', ...args] to simulate real argv.
   * runCli slices first 2 elements.
   */
  function makeArgv(...args: string[]): string[] {
    return ['node', 'ios-app-review', ...args];
  }

  // =================== HELP COMMAND ===================

  describe('help command', () => {
    it('should show help and exit(0) for "help" command', async () => {
      try {
        await runCli(makeArgv('help'));
      } catch {
        // expected
      }

      expect(mockPrintHelp).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should show help and exit(0) for "--help" flag', async () => {
      try {
        await runCli(makeArgv('--help'));
      } catch {
        // expected
      }

      expect(mockPrintHelp).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should show help and exit(0) for "-h" flag', async () => {
      try {
        await runCli(makeArgv('-h'));
      } catch {
        // expected
      }

      expect(mockPrintHelp).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should show help and exit(0) when no arguments provided', async () => {
      try {
        await runCli(makeArgv());
      } catch {
        // expected
      }

      expect(mockPrintHelp).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should show help when --help appears after a command', async () => {
      try {
        await runCli(makeArgv('scan', '--help'));
      } catch {
        // expected
      }

      expect(mockPrintHelp).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  // =================== VERSION COMMAND ===================

  describe('version command', () => {
    it('should show version and exit(0) for "version" command', async () => {
      try {
        await runCli(makeArgv('version'));
      } catch {
        // expected
      }

      expect(mockPrintVersion).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should show version and exit(0) for "--version" flag', async () => {
      try {
        await runCli(makeArgv('--version'));
      } catch {
        // expected
      }

      expect(mockPrintVersion).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should show version and exit(0) for "-v" flag', async () => {
      try {
        await runCli(makeArgv('-v'));
      } catch {
        // expected
      }

      expect(mockPrintVersion).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  // =================== UNKNOWN COMMAND ===================

  describe('unknown command', () => {
    it('should print error and exit(2) for unknown command', async () => {
      try {
        await runCli(makeArgv('deploy'));
      } catch {
        // expected
      }

      expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('Unknown command: deploy'));
      expect(mockExit).toHaveBeenCalledWith(2);
    });

    it('should print usage help hint for unknown command', async () => {
      try {
        await runCli(makeArgv('build'));
      } catch {
        // expected
      }

      expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('usage'));
    });
  });

  // =================== SCAN COMMAND ===================

  describe('scan command', () => {
    it('should error and exit(2) when no project path is provided', async () => {
      try {
        await runCli(makeArgv('scan'));
      } catch {
        // expected
      }

      expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('project path is required'));
      expect(mockExit).toHaveBeenCalledWith(2);
    });

    it('should error and exit(2) for invalid format', async () => {
      try {
        await runCli(makeArgv('scan', '/path/to/project', '--format', 'xml'));
      } catch {
        // expected
      }

      expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('invalid format'));
      expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('pretty'));
      expect(mockExit).toHaveBeenCalledWith(2);
    });

    it('should call runScan with correct default options (pretty for terminal)', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project'));
      } catch {
        // expected — process.exit is mocked
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        projectPath: '/path/to/project',
        format: 'pretty',
        output: undefined,
        analyzers: undefined,
        includeAsc: false,
        changedSince: undefined,
        config: undefined,
        badge: false,
        saveHistory: false,
      }));
    });

    it('should default to markdown when --output is provided without --format', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project', '--output', 'report.md'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        format: 'markdown',
        output: 'report.md',
      }));
    });

    it('should pass --format pretty correctly', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project', '--format', 'pretty'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        format: 'pretty',
      }));
    });

    it('should exit with code returned by runScan', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project'));
      } catch {
        // expected
      }

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should exit with code 1 when runScan returns 1', async () => {
      mockRunScan.mockResolvedValueOnce(1);

      try {
        await runCli(makeArgv('scan', '/path/to/project'));
      } catch {
        // expected
      }

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should pass --format json correctly', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project', '--format', 'json'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        format: 'json',
      }));
    });

    it('should pass --format html correctly', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project', '--format', 'html'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        format: 'html',
      }));
    });

    it('should pass --output correctly', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project', '--format', 'json', '--output', 'report.json'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        format: 'json',
        output: 'report.json',
      }));
    });

    it('should parse --analyzers into a list', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project', '--analyzers', 'code,security'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        analyzers: ['code', 'security'],
      }));
    });

    it('should trim whitespace in analyzer names', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project', '--analyzers', ' code , security '));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        analyzers: ['code', 'security'],
      }));
    });

    it('should pass --include-asc as boolean', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project', '--include-asc'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        includeAsc: true,
      }));
    });

    it('should pass --badge as boolean', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project', '--badge'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        badge: true,
      }));
    });

    it('should pass --save-history as boolean', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project', '--save-history'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        saveHistory: true,
      }));
    });

    it('should pass --changed-since correctly', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project', '--changed-since', 'main'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        changedSince: 'main',
      }));
    });

    it('should pass --config correctly', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path/to/project', '--config', '.review.yml'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        config: '.review.yml',
      }));
    });

    it('should handle all flags together', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv(
          'scan', '/my/project',
          '--format', 'html',
          '--output', 'out.html',
          '--analyzers', 'info-plist,privacy',
          '--include-asc',
          '--changed-since', 'develop',
          '--config', 'custom.yml',
          '--badge',
          '--save-history',
        ));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith({
        projectPath: '/my/project',
        format: 'html',
        output: 'out.html',
        analyzers: ['info-plist', 'privacy'],
        includeAsc: true,
        changedSince: 'develop',
        config: 'custom.yml',
        badge: true,
        saveHistory: true,
      });
    });

    it('should use short flag -f for format', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path', '-f', 'json'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        format: 'json',
      }));
    });

    it('should use short flag -o for output', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path', '-o', 'report.md'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        output: 'report.md',
      }));
    });

    it('should use short flag -a for analyzers', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path', '-a', 'security'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        analyzers: ['security'],
      }));
    });

    it('should use short flag -c for config', async () => {
      mockRunScan.mockResolvedValueOnce(0);

      try {
        await runCli(makeArgv('scan', '/path', '-c', 'myconfig.yml'));
      } catch {
        // expected
      }

      expect(mockRunScan).toHaveBeenCalledWith(expect.objectContaining({
        config: 'myconfig.yml',
      }));
    });
  });

  // =================== ERROR HANDLING ===================

  describe('error handling', () => {
    it('should catch runScan errors and exit(2)', async () => {
      mockRunScan.mockRejectedValueOnce(new Error('scan failed'));

      try {
        await runCli(makeArgv('scan', '/path/to/project'));
      } catch {
        // expected
      }

      expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('scan failed'));
      expect(mockExit).toHaveBeenCalledWith(2);
    });

    it('should handle non-Error thrown by runScan', async () => {
      mockRunScan.mockRejectedValueOnce('string error');

      try {
        await runCli(makeArgv('scan', '/path/to/project'));
      } catch {
        // expected
      }

      expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('string error'));
      expect(mockExit).toHaveBeenCalledWith(2);
    });

    it('should error on unrecognized flags with strict parsing', async () => {
      try {
        await runCli(makeArgv('scan', '/path', '--unknown-flag'));
      } catch {
        // expected
      }

      expect(mockExit).toHaveBeenCalledWith(2);
    });
  });
});
