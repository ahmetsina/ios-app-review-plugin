# Fastlane Integration

Integrate `ios-app-review-plugin` into your Fastlane workflow to automatically check for App Store rejection issues before submission.

## Prerequisites

- Node.js >= 18 installed on the build machine
- `ios-app-review-plugin` installed globally:

```bash
npm install -g ios-app-review-plugin
```

## Setup

1. Copy `Fastfile.example` into your project's `fastlane/` directory (or merge the lane into your existing `Fastfile`).

2. Rename it or copy the relevant lane:

```bash
cp Fastfile.example /path/to/your/project/fastlane/Fastfile
```

## Usage

### Basic scan

```bash
fastlane ios_review
```

### Specify project path

```bash
fastlane ios_review project_path:./MyApp.xcodeproj
```

### Run specific analyzers

```bash
fastlane ios_review analyzers:info-plist,privacy,security
```

### Use a custom rules config

```bash
fastlane ios_review config:.ios-review-rules.json
```

### Change output format

```bash
fastlane ios_review format:markdown output:review-report.md
```

### Pre-submission review (tests + review scan)

```bash
fastlane pre_submit_review scheme:MyApp
```

## How It Works

1. The `ios_review` lane installs `ios-app-review-plugin` if it is not already available.
2. It runs `ios-app-review scan` with the specified options.
3. If the output format is JSON, the lane parses the report and prints a summary.
4. If any errors are found, the lane fails with `UI.user_error!`, preventing further execution (e.g., upload to App Store Connect).

## Exit Codes

| Code | Meaning |
|------|---------|
| 0    | Scan passed, no blocking issues |
| 1    | Scan completed but found issues |
| 2    | Scan failed due to an error |

## Options

| Option         | Default                      | Description |
|----------------|------------------------------|-------------|
| `project_path` | `.`                          | Path to the iOS project |
| `format`       | `json`                       | Output format: `json`, `markdown`, or `html` |
| `output`       | `fastlane/review-report.json`| Path to write the report |
| `analyzers`    | all                          | Comma-separated list of analyzers |
| `config`       | none                         | Path to `.ios-review-rules.json` |

## CI Integration

In your CI pipeline, add the lane to your build process:

```yaml
# GitHub Actions example
- name: Run Fastlane iOS Review
  run: bundle exec fastlane ios_review

# Or as part of a release lane
- name: Pre-submit checks
  run: bundle exec fastlane pre_submit_review scheme:MyApp
```
