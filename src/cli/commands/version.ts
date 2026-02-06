import * as fs from 'fs';
import * as path from 'path';

export function printVersion(): void {
  try {
    const pkgPath = path.resolve(__dirname, '../../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version: string };
    console.log(pkg.version);
  } catch {
    console.log('1.0.0');
  }
}
