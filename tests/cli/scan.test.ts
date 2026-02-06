import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { runScan } from '../../src/cli/commands/scan.js';
import type { ScanOptions } from '../../src/cli/types.js';

// Mock the analyzer to avoid needing a real Xcode project
jest.mock('../../src/analyzer.js', () => ({
  runAnalysis: jest.fn().mockResolvedValue({
    projectPath: '/mock/project.xcodeproj',
    timestamp: '2024-01-01T00:00:00Z',
    results: [
      {
        analyzer: 'Code Scanner',
        passed: true,
        issues: [],
        duration: 100,
      },
    ],
    summary: {
      totalIssues: 0,
      errors: 0,
      warnings: 0,
      info: 0,
      passed: true,
      duration: 100,
    },
    score: 95,
    enrichedIssues: [],
    guidelinesCited: [],
  }),
}));

describe('runScan', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scan-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const baseOptions: ScanOptions = {
    projectPath: '/mock/project.xcodeproj',
    format: 'markdown',
    output: undefined,
    analyzers: undefined,
    includeAsc: false,
    changedSince: undefined,
    config: undefined,
    badge: false,
    saveHistory: false,
  };

  it('should return 0 when no errors found', async () => {
    const exitCode = await runScan(baseOptions);
    expect(exitCode).toBe(0);
  });

  it('should output to stdout by default', async () => {
    await runScan(baseOptions);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should write to file when output is specified', async () => {
    const outputPath = path.join(tempDir, 'report.md');
    await runScan({ ...baseOptions, output: outputPath });

    const content = await fs.readFile(outputPath, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Report written to'));
  });

  it('should generate badge when badge option is true', async () => {
    const outputPath = path.join(tempDir, 'report2.md');
    await runScan({ ...baseOptions, output: outputPath, badge: true });

    const badgePath = path.join(tempDir, 'badge.svg');
    const svg = await fs.readFile(badgePath, 'utf-8');
    expect(svg).toContain('<svg');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Badge written to'));
  });

  it('should return 1 when errors found', async () => {
    const { runAnalysis } = require('../../src/analyzer.js');
    (runAnalysis as jest.Mock).mockResolvedValueOnce({
      projectPath: '/mock/project.xcodeproj',
      timestamp: '2024-01-01T00:00:00Z',
      results: [
        {
          analyzer: 'Code Scanner',
          passed: false,
          issues: [
            {
              id: 'test-error',
              title: 'Test Error',
              description: 'Test error',
              severity: 'error',
              category: 'code',
            },
          ],
          duration: 100,
        },
      ],
      summary: {
        totalIssues: 1,
        errors: 1,
        warnings: 0,
        info: 0,
        passed: false,
        duration: 100,
      },
      score: 50,
      enrichedIssues: [],
      guidelinesCited: [],
    });

    const exitCode = await runScan(baseOptions);
    expect(exitCode).toBe(1);
  });

  it('should support json format', async () => {
    const outputPath = path.join(tempDir, 'report.json');
    await runScan({ ...baseOptions, format: 'json', output: outputPath });

    const content = await fs.readFile(outputPath, 'utf-8');
    // JSON format should be parseable
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('should support html format', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    await runScan({ ...baseOptions, format: 'html', output: outputPath });

    const content = await fs.readFile(outputPath, 'utf-8');
    expect(content).toContain('<');
  });
});
