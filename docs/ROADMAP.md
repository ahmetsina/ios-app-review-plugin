# Project Roadmap

This document outlines the development phases, milestones, and detailed tasks for the iOS App Store Review Plugin.

## Phase 1: Foundation & Codebase Analysis (MVP)

**Goal**: Create a working MCP server that can analyze iOS project files locally without requiring App Store Connect access.

**Milestone**: `v0.1.0 - MVP Release`

### 1.1 Project Setup
- [ ] Initialize TypeScript project with strict configuration
- [ ] Set up ESLint and Prettier
- [ ] Configure Jest for testing
- [ ] Set up build pipeline
- [ ] Create MCP server skeleton
- [ ] Add GitHub Actions for CI/CD

### 1.2 Xcode Project Parser
- [ ] Parse `.xcodeproj` directory structure
- [ ] Extract build settings
- [ ] Identify targets and schemes
- [ ] Parse `Info.plist` files
- [ ] Parse entitlements files
- [ ] Handle workspace (`.xcworkspace`) files

### 1.3 Info.plist Analyzer
- [ ] Check required keys (bundle identifier, version, etc.)
- [ ] Validate privacy usage descriptions:
  - NSCameraUsageDescription
  - NSPhotoLibraryUsageDescription
  - NSLocationWhenInUseUsageDescription
  - NSMicrophoneUsageDescription
  - NSContactsUsageDescription
  - (20+ more privacy keys)
- [ ] Check App Transport Security configuration
- [ ] Validate URL schemes
- [ ] Check required device capabilities
- [ ] Verify launch storyboard/XIB configuration

### 1.4 Privacy Manifest Analyzer (iOS 17+)
- [ ] Check for `PrivacyInfo.xcprivacy` presence
- [ ] Validate required reason APIs:
  - File timestamp APIs
  - System boot time APIs
  - Disk space APIs
  - Active keyboard APIs
  - User defaults APIs
- [ ] Check tracking domains declaration
- [ ] Validate data collection declarations
- [ ] Cross-reference with actual API usage in code

### 1.5 Entitlements Analyzer
- [ ] Parse entitlements file
- [ ] Validate against declared capabilities
- [ ] Check for debugging entitlements in release
- [ ] Validate App Groups configuration
- [ ] Check Push Notification entitlements
- [ ] Validate Keychain sharing groups

### 1.6 Basic Code Scanner
- [ ] Detect hardcoded IP addresses (IPv6 compliance)
- [ ] Find TODO/FIXME comments
- [ ] Detect hardcoded API keys/secrets
- [ ] Find test/debug code patterns
- [ ] Check for `#if DEBUG` usage
- [ ] Detect print/NSLog statements in release

---

## Phase 2: App Store Connect Integration

**Goal**: Add ability to fetch and validate app metadata from App Store Connect.

**Milestone**: `v0.2.0 - ASC Integration`

### 2.1 API Client Setup
- [ ] Implement JWT authentication
- [ ] Create API client with rate limiting
- [ ] Handle token refresh
- [ ] Add error handling and retries
- [ ] Create typed API responses

### 2.2 App Metadata Validation
- [ ] Fetch app information
- [ ] Validate app name length (30 chars)
- [ ] Check subtitle (30 chars)
- [ ] Validate description length and content
- [ ] Check keywords (100 chars total)
- [ ] Validate promotional text
- [ ] Check support URL validity
- [ ] Validate privacy policy URL
- [ ] Verify marketing URL

### 2.3 Screenshot & Preview Validation
- [ ] Fetch screenshot metadata
- [ ] Check required device sizes
- [ ] Validate screenshot count (1-10 per size)
- [ ] Check app preview videos
- [ ] Verify localized screenshots

### 2.4 Version & Build Checks
- [ ] Compare local vs. submitted version
- [ ] Check build number incrementing
- [ ] Validate version string format
- [ ] Check for pending submissions

### 2.5 In-App Purchase Validation
- [ ] List configured IAPs
- [ ] Validate IAP metadata
- [ ] Check pricing configuration
- [ ] Verify review screenshots for IAPs

---

## Phase 3: Advanced Analysis

**Goal**: Add sophisticated analysis capabilities and better integration.

**Milestone**: `v0.3.0 - Advanced Analysis`

### 3.1 Deprecated API Detection
- [ ] Build deprecated API database
- [ ] Scan Swift files for deprecated calls
- [ ] Scan Objective-C files
- [ ] Check minimum deployment target compatibility
- [ ] Identify APIs removed in target iOS version
- [ ] Generate migration suggestions

### 3.2 Private API Detection
- [ ] Create private API signature database
- [ ] Scan for known private selectors
- [ ] Check for undocumented frameworks
- [ ] Detect runtime API usage
- [ ] Scan for private URL schemes

### 3.3 Security Analysis
- [ ] Check for insecure HTTP connections
- [ ] Detect weak cryptography usage
- [ ] Find insecure data storage patterns
- [ ] Check for jailbreak detection bypasses
- [ ] Validate SSL pinning implementation
- [ ] Check keychain access configuration

### 3.4 UI/UX Compliance
- [ ] Check for required launch screen
- [ ] Validate icon sizes and presence
- [ ] Check accessibility support
- [ ] Detect placeholder/lorem ipsum text
- [ ] Verify iPad support if universal

---

## Phase 4: Intelligence & Reporting

**Goal**: Add smart analysis and comprehensive reporting.

**Milestone**: `v0.4.0 - Smart Analysis`

### 4.1 Guidelines Cross-Reference
- [ ] Map issues to specific guidelines
- [ ] Provide guideline excerpts
- [ ] Link to Apple documentation
- [ ] Track guideline version changes
- [ ] Add severity scoring

### 4.2 Report Generation
- [ ] Generate markdown reports
- [ ] Create HTML reports
- [ ] Add JSON export for CI/CD
- [ ] Include remediation suggestions
- [ ] Add code location references
- [ ] Generate summary statistics

### 4.3 Historical Comparison
- [ ] Store previous scan results
- [ ] Compare between scans
- [ ] Track issue resolution
- [ ] Generate trend reports

### 4.4 Custom Rules
- [ ] Allow user-defined rules
- [ ] Support regex-based rules
- [ ] Add rule severity configuration
- [ ] Create rule disable comments
- [ ] Support per-project configuration

---

## Phase 5: CI/CD & Polish

**Goal**: Production-ready release with CI/CD integration.

**Milestone**: `v1.0.0 - Production Release`

### 5.1 CI/CD Integration
- [ ] Create GitHub Action
- [ ] Add Fastlane plugin
- [ ] Create Xcode Cloud integration guide
- [ ] Add Bitrise step
- [ ] Support exit codes for CI
- [ ] Create badge generation

### 5.2 Performance Optimization
- [ ] Add caching layer
- [ ] Implement incremental scanning
- [ ] Optimize large project handling
- [ ] Add progress reporting
- [ ] Implement parallel analysis

### 5.3 Documentation
- [ ] Complete API documentation
- [ ] Add video tutorials
- [ ] Create troubleshooting guide
- [ ] Document all rules
- [ ] Add example configurations

### 5.4 Testing & Quality
- [ ] Achieve 80%+ code coverage
- [ ] Add integration tests
- [ ] Test with real-world projects
- [ ] Security audit
- [ ] Performance benchmarks

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
