import type { ProgressEvent } from '../src/progress/types.js';

// Mock the Xcode project parser
jest.mock('../src/parsers/xcodeproj.js', () => ({
  parseXcodeProject: jest.fn().mockResolvedValue({
    path: '/test/TestApp.xcodeproj',
    name: 'TestApp',
    targets: [
      {
        name: 'TestApp',
        type: 'application',
        bundleIdentifier: 'com.test.app',
        deploymentTarget: '15.0',
        sourceFiles: [],
      },
    ],
    configurations: ['Debug', 'Release'],
  }),
}));

// Mock the git module
jest.mock('../src/git/diff.js', () => ({
  getChangedFiles: jest.fn().mockReturnValue([]),
}));

// Mock the rules module
jest.mock('../src/rules/index.js', () => ({
  RuleLoader: jest.fn().mockImplementation(() => ({
    loadFromProject: jest.fn().mockResolvedValue(null),
  })),
  CustomRuleEngine: jest.fn(),
}));

// Mock the guidelines module
jest.mock('../src/guidelines/index.js', () => ({
  GuidelineMatcher: jest.fn().mockImplementation(() => ({
    enrichReport: jest.fn().mockImplementation((report) => ({
      ...report,
      score: 85,
      enrichedIssues: [],
      guidelinesCited: [],
    })),
  })),
}));

// Use require to avoid dynamic import issues with jest
const { runAnalysis } = require('../src/analyzer.js') as typeof import('../src/analyzer.js');

describe('runAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should run all core analyzers by default', async () => {
    const report = await runAnalysis({
      projectPath: '/test/TestApp.xcodeproj',
    });

    // Should have results from all 8 core analyzers
    expect(report.results.length).toBe(8);
  });

  it('should run specific analyzers when specified', async () => {
    const report = await runAnalysis({
      projectPath: '/test/TestApp.xcodeproj',
      analyzers: ['code', 'security'],
    });

    expect(report.results.length).toBe(2);
    const analyzerNames = report.results.map((r) => r.analyzer);
    expect(analyzerNames).toContain('Code Scanner');
    expect(analyzerNames).toContain('Security Analyzer');
  });

  it('should calculate summary correctly', async () => {
    const report = await runAnalysis({
      projectPath: '/test/TestApp.xcodeproj',
      analyzers: ['code'],
    });

    expect(report.summary).toBeDefined();
    expect(typeof report.summary.totalIssues).toBe('number');
    expect(typeof report.summary.errors).toBe('number');
    expect(typeof report.summary.warnings).toBe('number');
    expect(typeof report.summary.info).toBe('number');
    expect(typeof report.summary.passed).toBe('boolean');
    expect(typeof report.summary.duration).toBe('number');
  });

  it('should report progress when callback provided', async () => {
    const events: ProgressEvent[] = [];
    await runAnalysis(
      { projectPath: '/test/TestApp.xcodeproj', analyzers: ['code'] },
      { onProgress: (e: ProgressEvent) => events.push(e) }
    );

    const types = events.map((e) => e.type);
    expect(types).toContain('scan:start');
    expect(types).toContain('analyzer:start');
    expect(types).toContain('analyzer:complete');
    expect(types).toContain('scan:complete');
  });

  it('should handle analyzer failures gracefully', async () => {
    const report = await runAnalysis({
      projectPath: '/test/TestApp.xcodeproj',
    });

    expect(report).toBeDefined();
    expect(report.summary).toBeDefined();
  });

  it('should enrich report with score', async () => {
    const report = await runAnalysis({
      projectPath: '/test/TestApp.xcodeproj',
      analyzers: ['code'],
    });

    expect(report.score).toBeDefined();
    expect(typeof report.score).toBe('number');
  });

  it('should set passed to true when no errors', async () => {
    const report = await runAnalysis({
      projectPath: '/test/TestApp.xcodeproj',
      analyzers: ['code'],
    });

    // With mocked empty project, code scanner should find no issues
    expect(report.summary.passed).toBe(true);
  });

  it('should include timestamp', async () => {
    const report = await runAnalysis({
      projectPath: '/test/TestApp.xcodeproj',
      analyzers: ['code'],
    });

    expect(report.timestamp).toBeDefined();
    expect(typeof report.timestamp).toBe('string');
  });
});
