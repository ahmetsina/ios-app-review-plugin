import { execSync } from 'child_process';
import { getChangedFiles } from '../../src/git/diff.js';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('getChangedFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return changed files from git diff', () => {
    mockExecSync.mockReturnValue('src/foo.ts\nsrc/bar.ts\n');

    const files = getChangedFiles('/project', 'main');

    expect(mockExecSync).toHaveBeenCalledWith('git diff --name-only main', {
      cwd: '/project',
      encoding: 'utf-8',
      timeout: 10000,
    });
    expect(files).toHaveLength(2);
    expect(files[0]).toMatch(/src\/foo\.ts$/);
    expect(files[1]).toMatch(/src\/bar\.ts$/);
  });

  it('should resolve paths relative to basePath', () => {
    mockExecSync.mockReturnValue('src/file.swift\n');

    const files = getChangedFiles('/my/project', 'HEAD~1');

    expect(files[0]).toContain('/my/project/');
  });

  it('should filter empty lines', () => {
    mockExecSync.mockReturnValue('file.ts\n\n\n');

    const files = getChangedFiles('/project', 'main');
    expect(files).toHaveLength(1);
  });

  it('should return empty array on git error', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not a git repository');
    });

    const files = getChangedFiles('/not-a-repo', 'main');
    expect(files).toEqual([]);
  });

  it('should return empty array on invalid ref', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('unknown revision');
    });

    const files = getChangedFiles('/project', 'nonexistent-branch');
    expect(files).toEqual([]);
  });

  it('should handle empty diff output', () => {
    mockExecSync.mockReturnValue('');

    const files = getChangedFiles('/project', 'main');
    expect(files).toEqual([]);
  });
});
