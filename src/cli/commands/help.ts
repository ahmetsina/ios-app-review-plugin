export function printHelp(): void {
  const help = `
ios-app-review - iOS App Store review compliance checker

USAGE:
  ios-app-review <command> [options]

COMMANDS:
  scan <path>     Analyze an iOS project for App Store compliance
  help            Show this help message
  version         Show version number

SCAN OPTIONS:
  --format <fmt>         Output format: pretty, markdown, html, json
                         (default: pretty for terminal, markdown for file)
  --output <path>        Write report to file instead of stdout
  --analyzers <list>     Comma-separated analyzer names (default: all)
  --include-asc          Include App Store Connect validation
  --changed-since <ref>  Only scan files changed since git ref
  --config <path>        Path to custom rules config file
  --badge                Generate a review status badge SVG
  --save-history         Save scan results for future comparison

AVAILABLE ANALYZERS:
  info-plist, privacy, entitlements, code, deprecated-api,
  private-api, security, ui-ux, asc-metadata, asc-screenshots,
  asc-version, asc-iap

EXAMPLES:
  ios-app-review scan ./MyApp.xcodeproj
  ios-app-review scan ./MyApp.xcodeproj --format json --output report.json
  ios-app-review scan ./MyApp.xcodeproj --analyzers code,security
  ios-app-review scan ./MyApp.xcodeproj --changed-since main --badge

EXIT CODES:
  0  All checks passed (no errors)
  1  One or more errors found
  2  Invalid arguments or runtime error
`.trim();

  console.log(help);
}
