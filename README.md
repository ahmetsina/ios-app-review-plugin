# iOS App Store Review Plugin for Claude Code

A Claude Code MCP server plugin that helps developers review their iOS apps before submitting to the App Store. It analyzes both the codebase and App Store Connect metadata to catch common rejection reasons early.

## Overview

App Store rejections waste valuable time and delay releases. This plugin performs automated pre-submission checks by:

- **Analyzing your Xcode project** for common rejection patterns
- **Validating App Store Connect metadata** for completeness
- **Cross-referencing** declared capabilities with actual code usage
- **Checking compliance** with Apple's App Store Review Guidelines

## Features

### Codebase Analysis
- `Info.plist` validation (required keys, privacy descriptions)
- Privacy Manifest (`PrivacyInfo.xcprivacy`) requirements (iOS 17+)
- Deprecated API detection
- Private API usage detection
- Hardcoded credentials/debug flags detection
- App Transport Security configuration review
- Entitlements validation

### App Store Connect Integration
- App metadata completeness check
- Screenshot and preview validation
- Privacy policy URL verification
- Age rating consistency
- In-app purchase configuration review
- Localization completeness

## Installation

```bash
# Clone the repository
git clone https://github.com/ahmetsina/ios-app-review-plugin.git

# Install dependencies
cd ios-app-review-plugin
npm install

# Build the MCP server
npm run build
```

### Configure Claude Code

Add to your `~/.claude/mcp_servers.json`:

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

## Usage

Once installed, you can use the plugin in Claude Code:

```
Review my iOS app at /path/to/MyApp.xcodeproj before App Store submission
```

The plugin will:
1. Scan the Xcode project structure
2. Analyze Info.plist and entitlements
3. Check for common rejection patterns
4. Connect to App Store Connect (if configured)
5. Generate a comprehensive review report

## App Store Connect API Setup

1. Go to [App Store Connect](https://appstoreconnect.apple.com/) → Users and Access → Keys
2. Generate an API Key with "App Manager" role
3. Download the `.p8` file
4. Note your Key ID and Issuer ID
5. Configure the environment variables as shown above

## Common Rejection Reasons Checked

| Category | Check |
|----------|-------|
| **Guideline 2.1** | App Completeness - crash detection, placeholder content |
| **Guideline 2.3** | Accurate Metadata - description vs. functionality |
| **Guideline 2.5.1** | IPv6 Compatibility - hardcoded IPv4 addresses |
| **Guideline 4.2** | Minimum Functionality - app complexity |
| **Guideline 5.1.1** | Data Collection - privacy manifest requirements |
| **Guideline 5.1.2** | Data Use and Sharing - purpose strings |

## Project Structure

```
ios-app-review-plugin/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── analyzers/
│   │   ├── info-plist.ts     # Info.plist validation
│   │   ├── privacy.ts        # Privacy manifest checks
│   │   ├── entitlements.ts   # Entitlements validation
│   │   ├── deprecated-api.ts # Deprecated API detection
│   │   └── security.ts       # Security checks
│   ├── asc/
│   │   ├── client.ts         # App Store Connect API client
│   │   ├── metadata.ts       # Metadata validation
│   │   └── screenshots.ts    # Screenshot validation
│   ├── parsers/
│   │   ├── xcodeproj.ts      # Xcode project parser
│   │   └── plist.ts          # Property list parser
│   └── rules/
│       └── guidelines.ts     # App Store Guidelines rules
├── tests/
├── docs/
│   ├── GUIDELINES.md         # Supported guidelines
│   └── API.md                # API documentation
└── package.json
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## Roadmap

See the [GitHub Project](https://github.com/ahmetsina/ios-app-review-plugin/projects) for planned features and progress.

### Phase 1: Codebase Analysis (MVP)
- Info.plist validation
- Privacy manifest requirements
- Basic code scanning

### Phase 2: App Store Connect Integration
- API authentication
- Metadata validation
- Screenshot checks

### Phase 3: Advanced Analysis
- Binary analysis integration
- Custom rule definitions
- CI/CD integration

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Apple's [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi) documentation
- Claude Code and MCP specification
