# Getting Started

This tutorial walks through installing the plugin, running your first scan, understanding the results, and fixing common issues.

## Prerequisites

- Node.js >= 18
- An iOS project (`.xcodeproj` or `.xcworkspace`)
- (Optional) App Store Connect API key for ASC validation

## Step 1: Install

```bash
git clone https://github.com/ahmetsina/ios-app-review-plugin.git
cd ios-app-review-plugin
npm install
npm run build
```

To use the CLI globally:

```bash
npm link
# or
npm install -g .
```

Verify:

```bash
ios-app-review version
```

## Step 2: Run Your First Scan

Point the tool at your Xcode project:

```bash
ios-app-review scan /path/to/MyApp.xcodeproj
```

This runs all 8 core analyzers and prints a Markdown report to stdout. A typical first run takes 1-5 seconds depending on project size.

### What Happens During a Scan

1. The Xcode project file (`.pbxproj`) is parsed to discover targets, source files, Info.plist paths, and entitlements paths.
2. Each analyzer runs in parallel against the relevant files.
3. Issues are collected and enriched with guideline cross-references.
4. A readiness score (0-100) is calculated.
5. The formatted report is printed.

## Step 3: Understand the Results

The report has these sections:

### Review Readiness Score

A number from 0 to 100. Higher is better. The score is calculated based on the number and severity of issues found, weighted by the corresponding App Store Review Guideline importance.

- **80-100:** Ready for submission. Minor tweaks may help.
- **50-79:** Several issues to address. Likely rejection if errors remain.
- **0-49:** Significant problems. Address all errors before submitting.

### Summary Table

Quick counts of errors, warnings, and info items plus total scan duration.

### Priority Remediation

Error-severity issues sorted by guideline severity weight. Fix these first -- they are the most likely rejection causes.

### Issues by Category

All issues grouped by category (Info.plist, Privacy, Code Quality, Security, etc.). Each issue includes:

- **Severity badge** -- `[ERROR]` must be fixed, `[WARN]` should be fixed, `[INFO]` is advisory
- **Title** -- Brief description
- **Description** -- Details and the code/pattern that triggered it
- **Location** -- File path and line number
- **Guideline** -- Link to the relevant Apple guideline
- **Suggestion** -- How to fix it

## Step 4: Fix Common Issues

### Errors (Must Fix)

**Missing required Info.plist keys:**

```xml
<!-- Add to Info.plist -->
<key>CFBundleExecutable</key>
<string>$(EXECUTABLE_NAME)</string>
```

**Hardcoded API keys:**

```swift
// BAD
let apiKey = "sk-1234567890abcdef"

// GOOD
let apiKey = ProcessInfo.processInfo.environment["API_KEY"] ?? ""
```

**UIWebView usage:**

Replace all `UIWebView` instances with `WKWebView`:

```swift
// BAD
let webView = UIWebView()

// GOOD
import WebKit
let webView = WKWebView()
```

**Missing privacy manifest:**

Create `PrivacyInfo.xcprivacy` in your project and declare Required Reason APIs:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
```

### Warnings (Should Fix)

**ATS allows arbitrary loads:**

Remove the global bypass and use exception domains for specific servers:

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSExceptionDomains</key>
  <dict>
    <key>legacy-api.example.com</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
    </dict>
  </dict>
</dict>
```

**Hardcoded IPv4 addresses:**

```swift
// BAD
let server = "192.168.1.100"

// GOOD
let server = "api.myapp.com"
```

**Short permission descriptions:**

```xml
<!-- BAD -->
<key>NSCameraUsageDescription</key>
<string>Camera</string>

<!-- GOOD -->
<key>NSCameraUsageDescription</key>
<string>MyApp uses the camera to scan QR codes for quick login.</string>
```

## Step 5: Re-scan and Track Progress

After fixing issues, run the scan again:

```bash
ios-app-review scan /path/to/MyApp.xcodeproj --save-history
```

On subsequent scans with `--save-history`, you can compare progress:

```bash
ios-app-review scan /path/to/MyApp.xcodeproj --save-history
```

Use the `view_scan_history` MCP tool or compare scans to see your score trend over time.

## Step 6: Set Up as MCP Server (Optional)

To use the plugin from Claude Code as an MCP server, add to `~/.claude/mcp_servers.json`:

```json
{
  "ios-app-review": {
    "command": "node",
    "args": ["/path/to/ios-app-review-plugin/dist/index.js"]
  }
}
```

Then in Claude Code, simply ask:

```
Analyze my iOS app at /path/to/MyApp.xcodeproj for App Store compliance
```

Claude will call the `analyze_ios_app` tool and present the results conversationally.

## Next Steps

- [CI Integration Tutorial](./CI_INTEGRATION.md) -- Automate scans in your build pipeline
- [Custom Rules Tutorial](./CUSTOM_RULES.md) -- Add team-specific checks
- [ASC Setup Tutorial](./ASC_SETUP.md) -- Validate App Store Connect metadata
- [Analyzers Reference](../ANALYZERS.md) -- Full list of checks performed
