# MCP Tools API Reference

iOS App Review Plugin v1.0.0 exposes 18 MCP tools. Each tool returns content as `{ type: "text", text: string }`. On error, the response includes `isError: true`.

---

## analyze_ios_app

Run a full project analysis across all (or selected) analyzers.

**Input Schema:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectPath` | string | yes | Path to `.xcodeproj` or `.xcworkspace` |
| `analyzers` | string[] | no | Subset of analyzers to run (default: all core analyzers) |
| `targetName` | string | no | Specific build target (default: main app target) |
| `includeASC` | boolean | no | Run ASC validators (requires env credentials) |
| `bundleId` | string | no | Override auto-detected bundle ID for ASC calls |

Valid analyzer names: `all`, `info-plist`, `privacy`, `entitlements`, `code`, `deprecated-api`, `private-api`, `security`, `ui-ux`, `asc-metadata`, `asc-screenshots`, `asc-version`, `asc-iap`.

**Example call:**

```json
{
  "name": "analyze_ios_app",
  "arguments": {
    "projectPath": "/Users/dev/MyApp/MyApp.xcodeproj",
    "analyzers": ["info-plist", "privacy", "code"],
    "includeASC": false
  }
}
```

**Output:** Markdown-formatted report with a readiness score, summary table, and issue details grouped by category.

---

## check_info_plist

Validate a single Info.plist file for required keys, privacy descriptions, ATS configuration, and launch screen.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `plistPath` | string | yes | Absolute path to Info.plist |

**Example call:**

```json
{
  "name": "check_info_plist",
  "arguments": {
    "plistPath": "/Users/dev/MyApp/MyApp/Info.plist"
  }
}
```

**Output example (truncated):**

```
# Info.plist Analyzer Analysis

**Status:** ISSUES FOUND
**Duration:** 12ms

## Issues (2)

### [ERROR] Missing required key: CFBundleExecutable
The Info.plist is missing the required key "CFBundleExecutable".

**Location:** `/Users/dev/MyApp/MyApp/Info.plist`
**Suggestion:** Add the "CFBundleExecutable" key to your Info.plist

### [WARN] App Transport Security allows arbitrary loads
NSAllowsArbitraryLoads is set to true...
```

---

## check_privacy_manifest

Validate a PrivacyInfo.xcprivacy file for iOS 17+ compliance. Optionally cross-references API usage in project source files.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `manifestPath` | string | yes | Path to PrivacyInfo.xcprivacy |
| `projectPath` | string | no | Project path for cross-referencing API usage |

---

## scan_code

Scan Swift/Objective-C source code for hardcoded IPs, secrets, debug code, deprecated UIWebView, placeholder text, and more.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File or directory to scan |
| `patterns` | string[] | no | Specific pattern IDs to check (default: all) |

Available pattern IDs: `hardcoded-ipv4`, `hardcoded-api-key`, `aws-key`, `test-server-url`, `print-statement`, `todo-comment`, `force-unwrap`, `hardcoded-password`, `insecure-http`, `placeholder-text`, `debug-ifdef`, `deprecated-uiwebview`, `deprecated-addressbook`.

---

## check_deprecated_apis

Scan code for deprecated iOS API usage relative to a deployment target.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File or directory to scan |
| `deploymentTarget` | string | no | iOS version string, e.g. `"15.0"` (default: `"13.0"`) |

APIs removed at your deployment target surface as errors. Deprecated but still available APIs surface as warnings.

---

## check_private_apis

Detect private/undocumented iOS API usage that causes App Store rejection. Checks underscore selectors, private frameworks, private URL schemes, IOKit, dlopen of PrivateFrameworks, and sandbox escape patterns.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File or directory to scan |

---

## check_security

Scan for security vulnerabilities: weak crypto (MD5, SHA-1, DES, ECB), insecure storage (UserDefaults for secrets), insecure Keychain accessibility, SQL injection, hardcoded encryption keys, and disabled certificate validation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File or directory to scan |

---

## check_ui_ux

Check UI/UX compliance: launch screen, app icons (all sizes), iPad orientation support, placeholder text in storyboards, and accessibility basics (labels, Dynamic Type).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectPath` | string | yes | Path to project directory or .xcodeproj |

---

## validate_asc_metadata

Validate app metadata in App Store Connect (name, subtitle, description, keywords, privacy policy URL, support URL). Requires ASC credentials via environment variables.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bundleId` | string | yes | Bundle identifier of the app |

**Required environment variables:** `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY_PATH`.

---

## validate_asc_screenshots

Validate screenshots in App Store Connect: required device sizes, counts, and processing status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bundleId` | string | yes | Bundle identifier |

---

## compare_versions

Compare local version/build numbers with the App Store Connect version. Checks submission status and release notes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bundleId` | string | yes | Bundle identifier |
| `localVersion` | string | no | Local version string, e.g. `"1.2.0"` |
| `localBuild` | string | no | Local build number, e.g. `"42"` |

---

## validate_iap

Validate in-app purchases: localizations, review screenshots, and submission readiness.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bundleId` | string | yes | Bundle identifier |

---

## full_asc_validation

Run all four ASC validators in parallel (metadata, screenshots, versions, IAP). Returns a combined report with summary.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bundleId` | string | yes | Bundle identifier |

---

## generate_report

Run full analysis and produce a formatted report with readiness score, guideline cross-references, and optional historical comparison.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectPath` | string | yes | Path to .xcodeproj or .xcworkspace |
| `format` | string | no | `markdown`, `html`, or `json` (default: `markdown`) |
| `includeHistory` | boolean | no | Compare against the most recent saved scan |
| `saveToHistory` | boolean | no | Persist this scan for future comparisons |

---

## compare_scans

Compare the current scan with a previous scan to identify new, resolved, and ongoing issues.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectPath` | string | yes | Path to .xcodeproj or .xcworkspace |
| `previousScanId` | string | no | Specific previous scan ID (default: latest) |

---

## view_scan_history

List past scan records with scores and trend analysis.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectPath` | string | yes | Path to project directory |
| `limit` | number | no | Max scans to return (default: 10) |

**Output example:**

```
# Scan History

| # | Date | Score | Git Branch | Git Commit |
|---|------|-------|------------|------------|
| 1 | 1/15/2025, 3:42 PM | 85/100 | main | a1b2c3d |
| 2 | 1/10/2025, 11:20 AM | 72/100 | feature/x | e4f5g6h |

**Trend:** Improving (+13 over 2 scans)
```

---

## lookup_guideline

Look up an Apple App Store Review Guideline by section number.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `section` | string | yes | Section number, e.g. `"2.5.1"`, `"5.1.1"` |

Available sections: `1.2`, `1.4.1`, `2.1`, `2.3`, `2.3.1`, `2.3.7`, `2.4.1`, `2.5.1`, `2.5.4`, `2.5.6`, `3.1.1`, `3.1.2`, `3.1.3`, `3.2.2`, `4.0`, `4.1`, `4.2`, `4.6`, `5.1.1`, `5.1.2`, `5.1.4`, `5.2.1`, `hig-accessibility`, `hig-app-icons`, `hig-launch-screens`.

**Output example:**

```
# Guideline 2.5.1: Software Requirements

**Category:** performance
**Severity Weight:** 9/10

Apps must use public APIs and run on the currently shipping OS. Apps that use
non-public APIs, private frameworks, or deprecated technologies will be rejected.
Apps must support IPv6 networking.

**Reference:** https://developer.apple.com/app-store/review/guidelines/#software-requirements
```

---

## validate_custom_rules

Validate and preview a `.ios-review-rules.json` custom rules configuration.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectPath` | string | yes | Project directory path |
| `configPath` | string | no | Explicit path to rules file (default: auto-discover by walking up directories) |

---

## Error Handling

All tools share a common error wrapper. When an exception occurs, the response looks like:

```json
{
  "content": [{ "type": "text", "text": "Error: <message>" }],
  "isError": true
}
```

Common error scenarios:

| Condition | Message pattern |
|-----------|----------------|
| Unknown tool name | `Unknown tool: <name>` |
| Missing required parameter | Zod validation error message |
| File not found | `ENOENT: no such file or directory` |
| Invalid plist format | `Could not parse Info.plist: ...` |
| ASC credentials missing | `ASC_KEY_ID environment variable is required` |
| Invalid custom rules | `Custom rules validation FAILED: ...` |
