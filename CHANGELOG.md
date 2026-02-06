# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-06

### Added
- **CLI mode**: Dual-mode entry point — run as CLI tool (`ios-app-review scan`) or MCP server
  - `scan` command with `--format`, `--output`, `--analyzers`, `--badge`, `--save-history` options
  - `help` and `version` commands
  - Exit codes: 0 (pass), 1 (issues found), 2 (error)
- **Parallel analysis**: Analyzers run concurrently via `Promise.allSettled`
- **Incremental scanning**: `--changed-since` flag scans only git-changed files
- **Progress reporting**: EventEmitter-based progress events per analyzer
- **File caching**: In-memory cache keyed by path + mtime for MCP server mode
- **Badge generation**: shields.io-style SVG badges with score and pass/fail status
- **GitHub Actions**: CI workflow (lint, typecheck, test matrix), publish workflow, reusable composite action
- **CI/CD integrations**: Fastlane lane, Bitrise step, Xcode Cloud post-clone script
- **Comprehensive documentation**: API reference, CLI guide, analyzer docs, custom rules guide, CI/CD tutorials, troubleshooting, security policy, video script outlines
- **Examples**: GitHub Action workflow, Fastlane lane, Bitrise workflow, custom rules config
- **Benchmarks**: Performance benchmark script for small/medium/large projects

### Changed
- README rewritten with full v1.0 feature documentation
- Jest coverage thresholds raised to 80%
- Version bumped to 1.0.0

## [0.4.0] - 2026-02-06

### Added
- **Guidelines cross-reference**: `GuidelineMatcher` maps issues to specific App Store Review Guidelines with citations and links
- **Report generation**: Markdown, HTML, and JSON formatters with score display, severity breakdown, and guideline references
- **Historical comparison**: `HistoryStore` saves scan results as JSON; `HistoryComparator` diffs between scans showing new/resolved/recurring issues
- **Custom rule engine**: `RuleLoader` reads `.ios-review-rules.json`; `CustomRuleEngine` evaluates regex-based rules with severity overrides and disable support
- **Score calculation**: Weighted scoring (error: -10, warning: -3, info: -1) with enriched report output

## [0.3.0] - 2026-02-05

### Added
- **Deprecated API analyzer**: Detects 50+ deprecated iOS APIs including UIWebView, AddressBook, UIAlertView, UIActionSheet, and deprecated UIKit/Foundation methods
- **Private API analyzer**: Flags undocumented Apple API usage (_UIView, _NS prefixed, dlopen/dlsym, IOKit calls, and known private selectors)
- **Security analyzer**: ATS exception auditing, weak crypto detection (MD5, SHA1, DES), insecure storage patterns, jailbreak detection code
- **UI/UX compliance analyzer**: Launch storyboard presence, orientation support, accessibility labels, dynamic type, dark mode assets, minimum touch target hints

## [0.2.0] - 2026-02-05

### Added
- **App Store Connect API client**: JWT authentication with auto-refresh, rate limiting with retry, paginated response handling
- **ASC metadata validator**: App name length, description quality, privacy policy URL, age rating, content rights declaration
- **ASC screenshots validator**: Screenshot count per device class, dimension validation, missing device coverage
- **ASC version validator**: Version state checks, build attachment, copyright format, release type
- **ASC IAP validator**: In-app purchase localization completeness, pricing configuration, review screenshot presence

## [0.1.0] - 2026-02-04

### Added
- Initial release as MCP server with 17 tools
- **Info.plist analyzer**: Required keys (CFBundleIdentifier, CFBundleVersion), privacy usage descriptions, minimum deployment target
- **Privacy manifest analyzer**: iOS 17+ Required Reason API detection and PrivacyInfo.xcprivacy validation
- **Entitlements analyzer**: Capability configuration, debug-only entitlements, App Groups/Associated Domains/iCloud format validation
- **Code scanner**: Hardcoded API keys, debug print statements, force unwraps, TODO/FIXME markers, HTTP URLs
- **Xcode project parser**: `.xcodeproj` and `.xcworkspace` support, target extraction, build settings, source file discovery
- **Property list parser**: XML plist and OpenStep (pbxproj) format parsing
