# Report Formats

The plugin generates reports in three formats: Markdown, HTML, and JSON. All share the same underlying data -- an `EnrichedAnalysisReport` that includes a readiness score, enriched issues with guideline cross-references, and optional historical comparison.

## Markdown Format

Selected with `--format markdown` (the default).

### Structure

```
# App Store Review Readiness Report

**Project:** `/path/to/MyApp.xcodeproj`
**Date:** 1/15/2025, 3:42:00 PM
**Status:** ISSUES FOUND

## Review Readiness Score

**Score: 72/100** [=======---]

## Summary

| Metric | Count |
| ------ | ----- |
| Total Issues | 8 |
| Errors | 2 |
| Warnings | 4 |
| Info | 2 |
| Duration | 342ms |

## Historical Comparison          <-- only if includeHistory=true

| Metric | Value |
| ------ | ----- |
| Previous Score | 65/100 |
| Current Score | 72/100 |
| Delta | +7 |
| Trend | Improving |
| New Issues | 1 |
| Resolved Issues | 3 |
| Ongoing Issues | 5 |

## Priority Remediation            <-- only if errors exist

1. **Hardcoded API key** -- This appears to be a hardcoded API key or secret.
   - Guideline: [Security Best Practice](https://...)

## Issues by Category

### Info.plist

#### [ERROR] Missing required key: CFBundleExecutable
...

### Code Quality

#### [WARN] Hardcoded IPv4 address
...
```

### Score Bar

The score bar is a 10-character ASCII gauge:

- Score 85 -> `[=========- ]`
- Score 50 -> `[=====-----]`
- Score 10 -> `[=---------]`

### Issue Rendering

Each issue includes:
- Severity badge: `[ERROR]`, `[WARN]`, or `[INFO]`
- Title and description
- File location (path:line) when available
- Guideline link when matched
- Suggestion when available

---

## HTML Format

Selected with `--format html`.

### Features

- Self-contained single HTML file (no external CSS/JS)
- Dark mode support via `prefers-color-scheme` media query
- Circular score gauge with color coding (green >= 80, orange >= 50, red < 50)
- Collapsible issue categories using `<details>` elements
- Severity badges with color-coded pill labels
- Monospace font for file locations
- Trend arrows (SVG) for historical comparison
- Mobile responsive via viewport meta tag

### Color Scheme

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background | `#ffffff` | `#1a1a2e` |
| Text | `#1a1a1a` | `#e0e0e0` |
| Card background | `#f8f9fa` | `#16213e` |
| Border | `#dee2e6` | `#2a2a4a` |

### Severity Badge Colors

| Severity | Color |
|----------|-------|
| error | `#dc3545` (red) |
| warning | `#fd7e14` (orange) |
| info | `#0d6efd` (blue) |

---

## JSON Format

Selected with `--format json`.

### Schema

```json
{
  "schemaVersion": "1.0",
  "exitCode": 0,
  "score": 85,
  "timestamp": "2025-01-15T15:42:00.000Z",
  "projectPath": "/path/to/MyApp.xcodeproj",
  "summary": {
    "totalIssues": 3,
    "errors": 0,
    "warnings": 2,
    "info": 1,
    "passed": true,
    "duration": 342
  },
  "issues": [
    {
      "id": "hardcoded-ipv4",
      "title": "Hardcoded IPv4 address",
      "description": "Hardcoded IPv4 addresses may cause issues on IPv6-only networks.\n\nFound: `\"192.168.1.1\"`",
      "severity": "warning",
      "category": "code",
      "filePath": "/path/to/NetworkManager.swift",
      "lineNumber": 42,
      "guideline": "Guideline 2.5.1 - IPv6 Compatibility",
      "suggestion": "Use hostnames instead of hardcoded IP addresses for IPv6 compatibility.",
      "guidelineUrl": "https://developer.apple.com/app-store/review/guidelines/#software-requirements",
      "guidelineExcerpt": "Apps must use public APIs and run on the currently shipping OS...",
      "severityScore": 9
    }
  ],
  "comparison": {
    "previousScanId": "abc123",
    "previousTimestamp": "2025-01-10T11:20:00.000Z",
    "previousScore": 72,
    "currentScore": 85,
    "scoreDelta": 13,
    "trend": "improving",
    "newIssuesCount": 0,
    "resolvedIssuesCount": 3,
    "ongoingIssuesCount": 2
  }
}
```

### Field Reference

**Top level:**

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | string | Always `"1.0"` |
| `exitCode` | 0 or 1 | 0 if passed, 1 if errors exist |
| `score` | number | 0-100 review readiness score |
| `timestamp` | string | ISO 8601 timestamp |
| `projectPath` | string | Analyzed project path |
| `summary` | object | Aggregate counts |
| `issues` | array | All enriched issues |
| `comparison` | object or undefined | Present only when history is included |

**Issue object:**

| Field | Type | Present |
|-------|------|---------|
| `id` | string | always |
| `title` | string | always |
| `description` | string | always |
| `severity` | `"error"` / `"warning"` / `"info"` | always |
| `category` | string | always |
| `filePath` | string | when applicable |
| `lineNumber` | number | when applicable |
| `guideline` | string | when matched |
| `suggestion` | string | when available |
| `guidelineUrl` | string | when matched by GuidelineMatcher |
| `guidelineExcerpt` | string | when matched |
| `severityScore` | number | when matched (0-10) |

### Parsing in CI

```bash
# Check pass/fail
PASSED=$(cat report.json | jq '.summary.passed')

# Count errors
ERRORS=$(cat report.json | jq '.summary.errors')

# Get score
SCORE=$(cat report.json | jq '.score')

# List error-severity issue titles
cat report.json | jq -r '.issues[] | select(.severity == "error") | .title'
```
