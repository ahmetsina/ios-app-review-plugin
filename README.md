# iOS App Store Review Plugin

[![CI](https://github.com/ahmetsina/ios-app-review-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/ahmetsina/ios-app-review-plugin/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ios-app-review-plugin)](https://www.npmjs.com/package/ios-app-review-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Catch App Store rejection issues before you submit. Works as a **CLI tool** and a **Claude Code MCP server**.

## What It Does

Analyzes your Xcode project and App Store Connect metadata to flag issues that cause App Store rejections:

- **Info.plist** — missing keys, invalid privacy descriptions, deployment target issues
- **Privacy Manifest** — iOS 17+ Required Reason API declarations
- **Entitlements** — misconfigured capabilities, debug-only entitlements in release
- **Code Scanner** — hardcoded secrets, debug statements, force unwraps, deprecated APIs
- **Deprecated APIs** — UIWebView, AddressBook, and 50+ other deprecated symbols
- **Private APIs** — detection of undocumented Apple APIs that cause rejection
- **Security** — ATS exceptions, insecure storage, weak crypto, jailbreak detection
- **UI/UX Compliance** — launch storyboard, orientation, accessibility, dark mode
- **App Store Connect** — metadata completeness, screenshots, version state, IAP config
- **Custom Rules** — define project-specific checks with regex patterns

## Quick Start

### CLI

```bash
npm install -g ios-app-review-plugin

# Scan a project
ios-app-review scan ./MyApp.xcodeproj

# JSON output to file
ios-app-review scan ./MyApp.xcodeproj --format json --output report.json

# Specific analyzers only
ios-app-review scan ./MyApp.xcodeproj --analyzers code,security,privacy

# Incremental scan (only changed files)
ios-app-review scan ./MyApp.xcodeproj --changed-since main

# With badge generation
ios-app-review scan ./MyApp.xcodeproj --badge --output report.md
```

### MCP Server (Claude Code)

Add to `~/.claude/mcp_servers.json`:

```json
{
  "ios-app-review": {
    "command": "node",
    "args": ["/path/to/ios-app-review-plugin/dist/index.js"],
    "env": {
      "ASC_KEY_ID": "your-key-id",
      "ASC_ISSUER_ID": "your-issuer-id",
      "ASC_PRIVATE_KEY_PATH": "/path/to/AuthKey.p8"
    }
  }
}
```

Then in Claude Code:
```
Review my iOS app at ./MyApp.xcodeproj before submission
```

## CLI Reference

```
USAGE
  ios-app-review <command> [options]

COMMANDS
  scan <path>    Analyze an Xcode project
  help           Show usage information
  version        Print version

SCAN OPTIONS
  -f, --format <type>      Output format: markdown, html, json (default: markdown)
  -o, --output <path>      Write report to file (default: stdout)
  -a, --analyzers <list>   Comma-separated analyzer names
      --include-asc        Include App Store Connect validation
      --changed-since <ref> Only scan files changed since git ref
  -c, --config <path>      Path to custom rules file
      --badge              Generate SVG badge alongside report
      --save-history       Save results for historical comparison

EXIT CODES
  0  All checks passed
  1  Issues with errors found
  2  Invalid arguments or runtime error
```

## Analyzers

| Name | Key | Description |
|------|-----|-------------|
| Info.plist | `info-plist` | Required keys, privacy descriptions, bundle config |
| Privacy Manifest | `privacy` | iOS 17+ Required Reason API declarations |
| Entitlements | `entitlements` | Capability configuration, debug entitlements |
| Code Scanner | `code` | Secrets, debug code, force unwraps, TODOs |
| Deprecated API | `deprecated-api` | UIWebView, AddressBook, and 50+ deprecated symbols |
| Private API | `private-api` | Undocumented Apple API usage |
| Security | `security` | ATS, crypto, storage, jailbreak detection |
| UI/UX | `ui-ux` | Launch screen, orientation, accessibility |
| ASC Metadata | `asc-metadata` | App name, description, screenshots, privacy policy |
| ASC Screenshots | `asc-screenshots` | Screenshot counts, dimensions per device |
| ASC Version | `asc-version` | Version state, build attachment, copyright |
| ASC IAP | `asc-iap` | In-app purchase localization, pricing |

## Custom Rules

Create `.ios-review-rules.json` in your project root:

```json
{
  "version": 1,
  "rules": [
    {
      "id": "no-force-unwrap",
      "title": "Avoid force unwrapping",
      "description": "Force unwrapping can cause crashes",
      "severity": "warning",
      "pattern": "\\w+!\\.",
      "fileTypes": [".swift"],
      "category": "code"
    }
  ]
}
```

See [Custom Rules Guide](docs/RULES.md) for full documentation.

## CI/CD Integration

### GitHub Actions

```yaml
- uses: ./.github/actions/ios-review
  with:
    project-path: ./MyApp.xcodeproj
    format: json
```

Also available: [Fastlane](fastlane/README.md), [Bitrise](bitrise/step.yml), [Xcode Cloud](scripts/xcode-cloud-review.sh).

See [CI/CD Guide](docs/CI_CD.md) for detailed setup instructions.

## App Store Connect Setup

1. Go to [App Store Connect](https://appstoreconnect.apple.com/) > Users and Access > Integrations > Keys
2. Generate an API Key with "App Manager" role
3. Download the `.p8` file
4. Set environment variables: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY_PATH`

See [ASC Setup Tutorial](docs/tutorials/ASC_SETUP.md).

## Project Structure

```
src/
  index.ts              Dual-mode entry point (CLI + MCP server)
  analyzer.ts           Parallel analysis orchestrator
  cli/                  CLI commands (scan, help, version)
  analyzers/            12 analyzer implementations
  asc/                  App Store Connect API client
  parsers/              Xcode project + plist parsers
  reports/              Markdown, HTML, JSON formatters
  guidelines/           App Store Guidelines cross-reference
  rules/                Custom rule engine
  history/              Scan history + comparison
  cache/                File-level caching
  git/                  Git diff for incremental scanning
  progress/             Progress reporting
  badge/                SVG badge generation
```

## Documentation

- [CLI Reference](docs/CLI.md)
- [MCP API Reference](docs/API.md)
- [Analyzers Guide](docs/ANALYZERS.md)
- [Custom Rules](docs/RULES.md)
- [Report Formats](docs/REPORTS.md)
- [CI/CD Integration](docs/CI_CD.md)
- [Badge Generation](docs/BADGES.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Getting Started Tutorial](docs/tutorials/GETTING_STARTED.md)
- [Security Policy](docs/SECURITY.md)

## Development

```bash
npm install
npm run build
npm test
npm run benchmark
```

## License

MIT License - see [LICENSE](LICENSE) for details.
