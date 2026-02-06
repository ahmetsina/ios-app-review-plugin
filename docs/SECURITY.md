# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x | Yes |
| 0.4.x | Security fixes only |
| < 0.4 | No |

## Reporting a Vulnerability

If you discover a security vulnerability in the iOS App Review Plugin, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, send a private report:

1. Email: Send details to the repository maintainer via the email listed in the npm package or GitHub profile.
2. GitHub Security Advisories: Use the [private vulnerability reporting feature](https://github.com/ahmetsina/ios-app-review-plugin/security/advisories/new) on the repository.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment:** Within 48 hours
- **Assessment:** Within 5 business days
- **Fix timeline:** Depends on severity (critical: 7 days, high: 14 days, medium: 30 days)

## Security Considerations

### App Store Connect Credentials

The plugin uses ASC API credentials (Key ID, Issuer ID, private key) for App Store Connect validation. These credentials:

- Are read from environment variables (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY_PATH`)
- Are never logged, stored, or transmitted outside the ASC API
- Are used only to generate short-lived JWTs for ASC API calls
- Should be stored in your CI platform's secrets management

**Never commit `.p8` private key files to version control.**

### File System Access

The plugin reads files from the specified project path and its subdirectories. It:

- Reads source files (`.swift`, `.m`, `.mm`, `.h`, `.c`, `.cpp`), plists, storyboards, asset catalogs
- Does not modify any project files
- Does not execute any project code
- Does not download or install any dependencies from the project
- Writes only to explicitly specified output paths (report files, badge SVG, history store)

### Scan History Storage

When `--save-history` is used, scan results are stored as JSON files in a `.ios-review-history` directory near the project. These files contain:

- Issue IDs and titles
- File paths and line numbers
- Scores and timestamps
- Git branch and commit info

Review the history directory contents and add it to `.gitignore` if the data is sensitive.

### Network Access

The plugin makes network requests only when ASC validation is enabled (`--include-asc`). All requests go to Apple's App Store Connect API (`api.appstoreconnect.apple.com`) over HTTPS.

No telemetry, analytics, or other network calls are made.

### Dependencies

The plugin uses a minimal dependency set:

- `@modelcontextprotocol/sdk` -- MCP protocol
- `fast-glob` -- File discovery
- `plist` -- Plist parsing
- `zod` -- Input validation

All dependencies should be audited regularly:

```bash
npm audit
```
