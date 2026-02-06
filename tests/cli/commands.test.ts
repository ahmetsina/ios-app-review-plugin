import { printHelp } from '../../src/cli/commands/help.js';
import { printVersion } from '../../src/cli/commands/version.js';

describe('CLI Commands', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('help', () => {
    it('should print help text', () => {
      printHelp();
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0]![0] as string;
      expect(output).toContain('ios-app-review');
      expect(output).toContain('USAGE');
      expect(output).toContain('COMMANDS');
      expect(output).toContain('scan');
      expect(output).toContain('help');
      expect(output).toContain('version');
    });

    it('should list scan options', () => {
      printHelp();
      const output = consoleLogSpy.mock.calls[0]![0] as string;
      expect(output).toContain('--format');
      expect(output).toContain('--output');
      expect(output).toContain('--analyzers');
      expect(output).toContain('--include-asc');
      expect(output).toContain('--changed-since');
      expect(output).toContain('--badge');
      expect(output).toContain('--save-history');
    });

    it('should list available analyzers', () => {
      printHelp();
      const output = consoleLogSpy.mock.calls[0]![0] as string;
      expect(output).toContain('info-plist');
      expect(output).toContain('privacy');
      expect(output).toContain('security');
    });

    it('should list exit codes', () => {
      printHelp();
      const output = consoleLogSpy.mock.calls[0]![0] as string;
      expect(output).toContain('EXIT CODES');
      expect(output).toContain('0');
      expect(output).toContain('1');
      expect(output).toContain('2');
    });
  });

  describe('version', () => {
    it('should print a version string', () => {
      printVersion();
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0]![0] as string;
      // Should be semver-like
      expect(output).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
