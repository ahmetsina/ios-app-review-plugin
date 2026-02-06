# Video Script: CLI Usage

**Duration:** 2 minutes
**Audience:** Developers who have installed the plugin and want to learn the CLI
**Goal:** Cover the main CLI options through practical examples

---

## Opening (0:00 - 0:15)

"Let me walk through the CLI options you will use most often. The tool has one main command: scan."

---

## Basic Scan (0:15 - 0:35)

**Terminal:**

```bash
ios-app-review scan ./MyApp.xcodeproj
```

"By default, this runs all 8 core analyzers and prints a Markdown report to the terminal."

"The exit code is 0 for pass, 1 for errors found."

---

## Output Formats (0:35 - 0:55)

**Terminal:**

```bash
# JSON for CI parsing
ios-app-review scan ./MyApp.xcodeproj --format json --output report.json

# HTML for sharing with the team
ios-app-review scan ./MyApp.xcodeproj --format html --output report.html
```

"JSON is best for CI pipelines. HTML gives you a styled report with dark mode support and collapsible sections."

**Quick flash of the HTML report in a browser.**

---

## Selective Analyzers (0:55 - 1:10)

**Terminal:**

```bash
# Only run code and security checks
ios-app-review scan ./MyApp.xcodeproj --analyzers code,security

# Only check privacy manifest
ios-app-review scan ./MyApp.xcodeproj --analyzers privacy
```

"Use --analyzers with a comma-separated list to focus on specific areas. Useful when you are working on a targeted fix."

---

## Incremental Scanning (1:10 - 1:25)

**Terminal:**

```bash
# Only scan files changed since main branch
ios-app-review scan ./MyApp.xcodeproj --changed-since main
```

"This is the key option for CI. It scans only the files you changed, so PR checks run in seconds instead of minutes on large projects."

---

## Badge and History (1:25 - 1:40)

**Terminal:**

```bash
ios-app-review scan ./MyApp.xcodeproj --badge --save-history

# badge.svg is created
# Scan is saved for future comparison
```

"The --badge flag generates an SVG badge you can embed in your README. The --save-history flag persists the scan so you can track your score over time."

**Show the badge image.**

---

## ASC Validation (1:40 - 1:55)

**Terminal:**

```bash
export ASC_KEY_ID="..."
export ASC_ISSUER_ID="..."
export ASC_PRIVATE_KEY_PATH="..."

ios-app-review scan ./MyApp.xcodeproj --include-asc
```

"Add --include-asc to also validate your App Store Connect metadata, screenshots, and in-app purchases. You need an API key from App Store Connect."

---

## Closing (1:55 - 2:00)

"That covers the main CLI options. For the full reference, check docs/CLI.md in the repository."

---

## Production Notes

- All commands should be executed live (not simulated).
- Use a sample project that produces diverse output.
- Split-screen: terminal on left, brief explanation text on right.
- Keep each section snappy -- under 20 seconds per option.
