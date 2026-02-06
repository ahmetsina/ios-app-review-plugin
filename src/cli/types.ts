export interface CliOptions {
  command: string;
  help: boolean;
  version: boolean;
}

export interface ScanOptions {
  projectPath: string;
  format: 'markdown' | 'html' | 'json';
  output?: string | undefined;
  analyzers?: string[] | undefined;
  includeAsc: boolean;
  changedSince?: string | undefined;
  config?: string | undefined;
  badge: boolean;
  saveHistory: boolean;
}
