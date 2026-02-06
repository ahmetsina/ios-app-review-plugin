import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

async function createMockProject(fileCount: number): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bench-'));

  // Create Xcode project
  const xcodeproj = path.join(tempDir, 'BenchApp.xcodeproj');
  await fs.mkdir(xcodeproj, { recursive: true });

  await fs.writeFile(
    path.join(xcodeproj, 'project.pbxproj'),
    `// !$*UTF8*$!
{
  archiveVersion = 1;
  classes = {};
  objectVersion = 56;
  objects = {
    ROOT = { isa = PBXProject; buildConfigurationList = CONFIGLIST; mainGroup = MAINGROUP; targets = (TARGET1); };
    CONFIGLIST = { isa = XCConfigurationList; buildConfigurations = (CONFIG1); };
    CONFIG1 = { isa = XCBuildConfiguration; name = Release; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = "com.bench.app"; IPHONEOS_DEPLOYMENT_TARGET = "15.0"; }; };
    TARGET1 = { isa = PBXNativeTarget; name = BenchApp; productType = "com.apple.product-type.application"; buildConfigurationList = CONFIGLIST; buildPhases = (); };
    MAINGROUP = { isa = PBXGroup; children = (); sourceTree = "<group>"; };
  };
  rootObject = ROOT;
}
`
  );

  // Create source files
  for (let i = 0; i < fileCount; i++) {
    const code = `import UIKit\n\nclass ViewController${i}: UIViewController {\n    override func viewDidLoad() {\n        super.viewDidLoad()\n        print("Loaded \\(${i})")\n    }\n}\n`;
    await fs.writeFile(path.join(tempDir, `ViewController${i}.swift`), code);
  }

  // Create Info.plist
  await fs.writeFile(
    path.join(tempDir, 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.bench.app</string>
  <key>CFBundleName</key>
  <string>BenchApp</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
</dict>
</plist>
`
  );

  return tempDir;
}

async function benchmark(name: string, fn: () => Promise<void>, iterations = 3): Promise<void> {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`${name}:`);
  console.log(`  avg: ${avg.toFixed(1)}ms  min: ${min.toFixed(1)}ms  max: ${max.toFixed(1)}ms`);
}

async function main(): Promise<void> {
  const { runAnalysis } = await import('../src/analyzer.js');

  console.log('=== iOS App Review Plugin Benchmarks ===\n');

  // Small project (10 files)
  const small = await createMockProject(10);
  await benchmark('Small project (10 files) - all analyzers', async () => {
    await runAnalysis({ projectPath: path.join(small, 'BenchApp.xcodeproj') });
  });

  await benchmark('Small project (10 files) - code only', async () => {
    await runAnalysis({ projectPath: path.join(small, 'BenchApp.xcodeproj'), analyzers: ['code'] });
  });

  // Medium project (50 files)
  const medium = await createMockProject(50);
  await benchmark('Medium project (50 files) - all analyzers', async () => {
    await runAnalysis({ projectPath: path.join(medium, 'BenchApp.xcodeproj') });
  });

  // Large project (200 files)
  const large = await createMockProject(200);
  await benchmark('Large project (200 files) - all analyzers', async () => {
    await runAnalysis({ projectPath: path.join(large, 'BenchApp.xcodeproj') });
  });

  console.log('\n=== Benchmark Complete ===');

  // Cleanup
  await fs.rm(small, { recursive: true, force: true });
  await fs.rm(medium, { recursive: true, force: true });
  await fs.rm(large, { recursive: true, force: true });
}

main().catch(console.error);
