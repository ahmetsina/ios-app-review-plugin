# Project Roadmap

This document outlines the development phases, milestones, and detailed tasks for the iOS App Store Review Plugin.

## Phase 1: Foundation & Codebase Analysis (MVP) :white_check_mark:

**Goal**: Create a working MCP server that can analyze iOS project files locally without requiring App Store Connect access.

**Milestone**: `v0.1.0 - MVP Release`

### 1.1 Project Setup
- [x] Initialize TypeScript project with strict configuration
- [x] Set up ESLint and Prettier
- [x] Configure Jest for testing
- [x] Set up build pipeline
- [x] Create MCP server skeleton
- [x] Add GitHub Actions for CI/CD

### 1.2 Xcode Project Parser
- [x] Parse `.xcodeproj` directory structure
- [x] Extract build settings
- [x] Identify targets and schemes
- [x] Parse `Info.plist` files
- [x] Parse entitlements files
- [x] Handle workspace (`.xcworkspace`) files

### 1.3 Info.plist Analyzer
- [x] Check required keys (bundle identifier, version, etc.)
- [x] Validate privacy usage descriptions:
  - NSCameraUsageDescription
  - NSPhotoLibraryUsageDescription
  - NSLocationWhenInUseUsageDescription
  - NSMicrophoneUsageDescription
  - NSContactsUsageDescription
  - (20+ more privacy keys)
- [x] Check App Transport Security configuration
- [x] Validate URL schemes
- [x] Check required device capabilities
- [x] Verify launch storyboard/XIB configuration

### 1.4 Privacy Manifest Analyzer (iOS 17+)
- [x] Check for `PrivacyInfo.xcprivacy` presence
- [x] Validate required reason APIs:
  - File timestamp APIs
  - System boot time APIs
  - Disk space APIs
  - Active keyboard APIs
  - User defaults APIs
- [x] Check tracking domains declaration
- [x] Validate data collection declarations
- [x] Cross-reference with actual API usage in code

### 1.5 Entitlements Analyzer
- [x] Parse entitlements file
- [x] Validate against declared capabilities
- [x] Check for debugging entitlements in release
- [x] Validate App Groups configuration
- [x] Check Push Notification entitlements
- [x] Validate Keychain sharing groups

### 1.6 Basic Code Scanner
- [x] Detect hardcoded IP addresses (IPv6 compliance)
- [x] Find TODO/FIXME comments
- [x] Detect hardcoded API keys/secrets
- [x] Find test/debug code patterns
- [x] Check for `#if DEBUG` usage
- [x] Detect print/NSLog statements in release

---

## Phase 2: App Store Connect Integration :white_check_mark:

**Goal**: Add ability to fetch and validate app metadata from App Store Connect.

**Milestone**: `v0.2.0 - ASC Integration`

### 2.1 API Client Setup
- [x] Implement JWT authentication
- [x] Create API client with rate limiting
- [x] Handle token refresh
- [x] Add error handling and retries
- [x] Create typed API responses

### 2.2 App Metadata Validation
- [x] Fetch app information
- [x] Validate app name length (30 chars)
- [x] Check subtitle (30 chars)
- [x] Validate description length and content
- [x] Check keywords (100 chars total)
- [x] Validate promotional text
- [x] Check support URL validity
- [x] Validate privacy policy URL
- [x] Verify marketing URL

### 2.3 Screenshot & Preview Validation
- [x] Fetch screenshot metadata
- [x] Check required device sizes
- [x] Validate screenshot count (1-10 per size)
- [x] Check app preview videos
- [x] Verify localized screenshots

### 2.4 Version & Build Checks
- [x] Compare local vs. submitted version
- [x] Check build number incrementing
- [x] Validate version string format
- [x] Check for pending submissions

### 2.5 In-App Purchase Validation
- [x] List configured IAPs
- [x] Validate IAP metadata
- [x] Check pricing configuration
- [x] Verify review screenshots for IAPs

---

## Phase 3: Advanced Analysis :white_check_mark:

**Goal**: Add sophisticated analysis capabilities and better integration.

**Milestone**: `v0.3.0 - Advanced Analysis`

### 3.1 Deprecated API Detection
- [x] Build deprecated API database
- [x] Scan Swift files for deprecated calls
- [x] Scan Objective-C files
- [x] Check minimum deployment target compatibility
- [x] Identify APIs removed in target iOS version
- [x] Generate migration suggestions

### 3.2 Private API Detection
- [x] Create private API signature database
- [x] Scan for known private selectors
- [x] Check for undocumented frameworks
- [x] Detect runtime API usage
- [x] Scan for private URL schemes

### 3.3 Security Analysis
- [x] Check for insecure HTTP connections
- [x] Detect weak cryptography usage
- [x] Find insecure data storage patterns
- [x] Check for jailbreak detection bypasses
- [x] Validate SSL pinning implementation
- [x] Check keychain access configuration

### 3.4 UI/UX Compliance
- [x] Check for required launch screen
- [x] Validate icon sizes and presence
- [x] Check accessibility support
- [x] Detect placeholder/lorem ipsum text
- [x] Verify iPad support if universal

---

## Phase 4: Intelligence & Reporting :white_check_mark:

**Goal**: Add smart analysis and comprehensive reporting.

**Milestone**: `v0.4.0 - Smart Analysis`

### 4.1 Guidelines Cross-Reference
- [x] Map issues to specific guidelines
- [x] Provide guideline excerpts
- [x] Link to Apple documentation
- [x] Track guideline version changes
- [x] Add severity scoring

### 4.2 Report Generation
- [x] Generate markdown reports
- [x] Create HTML reports
- [x] Add JSON export for CI/CD
- [x] Include remediation suggestions
- [x] Add code location references
- [x] Generate summary statistics

### 4.3 Historical Comparison
- [x] Store previous scan results
- [x] Compare between scans
- [x] Track issue resolution
- [x] Generate trend reports

### 4.4 Custom Rules
- [x] Allow user-defined rules
- [x] Support regex-based rules
- [x] Add rule severity configuration
- [x] Create rule disable comments
- [x] Support per-project configuration

---

## Phase 5: CI/CD & Polish :white_check_mark:

**Goal**: Production-ready release with CI/CD integration.

**Milestone**: `v1.0.0 - Production Release`

### 5.1 CI/CD Integration
- [x] Create GitHub Action
- [x] Add Fastlane plugin
- [x] Create Xcode Cloud integration guide
- [x] Add Bitrise step
- [x] Support exit codes for CI
- [x] Create badge generation

### 5.2 Performance Optimization
- [x] Add caching layer
- [x] Implement incremental scanning
- [x] Optimize large project handling
- [x] Add progress reporting
- [x] Implement parallel analysis

### 5.3 Documentation
- [x] Complete API documentation
- [x] Add video tutorials
- [x] Create troubleshooting guide
- [x] Document all rules
- [x] Add example configurations

### 5.4 Testing & Quality
- [x] Achieve 80%+ code coverage
- [x] Add integration tests
- [x] Test with real-world projects
- [x] Security audit
- [x] Performance benchmarks

---

## Future Considerations

### Potential Phase 6+ Features
- [ ] Watch app analysis
- [ ] tvOS app support
- [ ] macOS (Catalyst) support
- [ ] App Clips validation
- [ ] SwiftUI-specific checks
- [ ] Storyboard/XIB analysis
- [ ] Localization validation
- [ ] Accessibility audit
- [ ] Memory/performance predictions
- [ ] AI-powered rejection prediction

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Detection accuracy | >95% for common issues |
| False positive rate | <5% |
| Scan time (avg project) | <30 seconds |
| Guideline coverage | 80% of rejection reasons |
| User satisfaction | 4.5+ rating |

## Timeline Estimates

| Phase | Duration |
|-------|----------|
| Phase 1 | 4-6 weeks |
| Phase 2 | 3-4 weeks |
| Phase 3 | 4-5 weeks |
| Phase 4 | 3-4 weeks |
| Phase 5 | 2-3 weeks |

**Total estimated development time**: 16-22 weeks

---

*This roadmap is subject to change based on community feedback and Apple's guideline updates.*
