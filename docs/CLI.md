# CLI Reference

The iOS App Review Plugin ships as a dual-mode binary. When invoked with arguments it runs as a CLI tool; without arguments it starts the MCP server.

## Installation

```bash
# Global install
npm install -g ios-app-review-plugin

# Or run directly after building
npm run build
node dist/index.js scan ./MyApp.xcodeproj
```

The CLI binary is named `ios-app-review`.

## Commands

### scan

Analyze an iOS project for App Store review compliance.

```
ios-app-review scan <path> [options]
```

**Positional argument:**

- `<path>` -- Path to the `.xcodeproj`, `.xcworkspace`, or project directory. Required.

**Options:**

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--format <fmt>` | `-f` | `markdown` | Output format: `markdown`, `html`, or `json` |
| `--output <path>` | `-o` | stdout | Write report to a file |
| `--analyzers <list>` | `-a` | all | Comma-separated analyzer names |
| `--include-asc` | | false | Run App Store Connect validators |
| `--changed-since <ref>` | | | Git ref for incremental scanning |
| `--config <path>` | `-c` | auto | Path to `.ios-review-rules.json` |
| `--badge` | | false | Generate `badge.svg` alongside the report |
| `--save-history` | | false | Persist results for `compare_scans` |

**Analyzer names:** `info-plist`, `privacy`, `entitlements`, `code`, `deprecated-api`, `private-api`, `security`, `ui-ux`, `asc-metadata`, `asc-screenshots`, `asc-version`, `asc-iap`.

### help

```
ios-app-review help
ios-app-review --help
ios-app-review -h
```

Print usage information and exit.

### version

```
ios-app-review version
ios-app-review --version
ios-app-review -v
```

Print the version number and exit.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All checks passed -- no errors found |
| `1` | One or more error-severity issues detected |
| `2` | Invalid arguments or a runtime error |

## Examples

**Basic scan with default settings (markdown to stdout):**

```bash
ios-app-review scan ./MyApp.xcodeproj
```

**Generate an HTML report file:**

```bash
ios-app-review scan ./MyApp.xcodeproj --format html --output reports/review.html
```

**JSON report for CI pipeline parsing:**

```bash
ios-app-review scan ./MyApp.xcodeproj --format json --output report.json
```

**Run only code and security analyzers:**

```bash
ios-app-review scan ./MyApp.xcodeproj --analyzers code,security
```

**Incremental scan (only changed files since main branch):**

```bash
ios-app-review scan ./MyApp.xcodeproj --changed-since main
```

**Full scan with ASC validation, badge, and history:**

```bash
export ASC_KEY_ID="XXXXXXXXXX"
export ASC_ISSUER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export ASC_PRIVATE_KEY_PATH="$HOME/.appstoreconnect/AuthKey_XXXXXXXXXX.p8"

ios-app-review scan ./MyApp.xcodeproj \
  --include-asc \
  --badge \
  --save-history \
  --format json \
  --output report.json
```

**Scan with custom rules:**

```bash
ios-app-review scan ./MyApp.xcodeproj --config ./team-rules.json
```

**Use in a CI gate (rely on exit code):**

```bash
ios-app-review scan ./MyApp.xcodeproj --format json --output report.json
# exit code 0 = pass, 1 = fail, 2 = error
```

## Output Behavior

- When `--output` is specified, the formatted report is written to that file and a confirmation message is printed to stderr.
- When `--output` is omitted, the report is printed to stdout.
- When `--badge` is specified, `badge.svg` is written next to the output file (or in the current directory if no `--output`).
- Diagnostic/progress messages are always written to stderr so they do not interfere with piped stdout.
