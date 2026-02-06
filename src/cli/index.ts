import { parseArgs } from 'node:util';
import { printHelp } from './commands/help.js';
import { printVersion } from './commands/version.js';
import { runScan } from './commands/scan.js';
import type { ScanOptions } from './types.js';

export async function runCli(argv: string[]): Promise<void> {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args[0] === 'version' || args.includes('--version') || args.includes('-v')) {
    printVersion();
    process.exit(0);
  }

  if (args[0] !== 'scan') {
    console.error(`Unknown command: ${args[0]}`);
    console.error('Run "ios-app-review help" for usage information.');
    process.exit(2);
  }

  // Parse scan command args
  const scanArgs = args.slice(1);

  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: scanArgs,
      options: {
        format: { type: 'string', short: 'f', default: 'markdown' },
        output: { type: 'string', short: 'o' },
        analyzers: { type: 'string', short: 'a' },
        'include-asc': { type: 'boolean', default: false },
        'changed-since': { type: 'string' },
        config: { type: 'string', short: 'c' },
        badge: { type: 'boolean', default: false },
        'save-history': { type: 'boolean', default: false },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    console.error('Run "ios-app-review help" for usage information.');
    process.exit(2);
    return; // unreachable, satisfies TS
  }

  const { values, positionals } = parsed;

  if (positionals.length === 0) {
    console.error('Error: project path is required');
    console.error('Usage: ios-app-review scan <path> [options]');
    process.exit(2);
  }

  const format = values['format'] as string;
  if (format !== 'markdown' && format !== 'html' && format !== 'json') {
    console.error(`Error: invalid format "${format}". Must be markdown, html, or json.`);
    process.exit(2);
  }

  const analyzersList = values['analyzers']
    ? (values['analyzers'] as string).split(',').map((s) => s.trim())
    : undefined;

  const scanOptions: ScanOptions = {
    projectPath: positionals[0]!,
    format,
    output: values['output'] as string | undefined,
    analyzers: analyzersList,
    includeAsc: values['include-asc'] as boolean,
    changedSince: values['changed-since'] as string | undefined,
    config: values['config'] as string | undefined,
    badge: values['badge'] as boolean,
    saveHistory: values['save-history'] as boolean,
  };

  try {
    const exitCode = await runScan(scanOptions);
    process.exit(exitCode);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(2);
  }
}
