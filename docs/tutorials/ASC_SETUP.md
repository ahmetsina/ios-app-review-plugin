# App Store Connect Setup Tutorial

This tutorial walks through generating an API key, configuring environment variables, and using the ASC validation tools.

## Overview

The ASC validators check your app's metadata, screenshots, version info, and in-app purchases directly against the App Store Connect API. This catches issues that are only visible in ASC, like missing screenshot sizes, incomplete localizations, or version conflicts.

**Requirements:**
- An Apple Developer Program membership
- Admin or App Manager access to App Store Connect
- An app already created in App Store Connect

## Step 1: Generate an API Key

1. Open [App Store Connect](https://appstoreconnect.apple.com/).
2. Navigate to **Users and Access** > **Integrations** > **App Store Connect API**.
3. Click **Generate API Key** (or the "+" button).
4. Name it something descriptive: `ios-app-review-ci`.
5. Select the **App Manager** role (minimum required).
6. Click **Generate**.

You will see:
- **Key ID**: A 10-character alphanumeric string (e.g., `ABC1234DEF`)
- **Issuer ID**: A UUID shown at the top of the page (e.g., `12345678-abcd-efgh-ijkl-123456789012`)

7. Click **Download API Key** to get the `.p8` file. You can only download this once.

Save the `.p8` file securely. A typical location:

```
~/.appstoreconnect/AuthKey_ABC1234DEF.p8
```

## Step 2: Configure Environment Variables

Set three environment variables:

```bash
export ASC_KEY_ID="ABC1234DEF"
export ASC_ISSUER_ID="12345678-abcd-efgh-ijkl-123456789012"
export ASC_PRIVATE_KEY_PATH="$HOME/.appstoreconnect/AuthKey_ABC1234DEF.p8"
```

For persistent configuration, add these to your shell profile (`~/.zshrc` or `~/.bashrc`).

### For CI Systems

| Platform | How to store |
|----------|-------------|
| GitHub Actions | Settings > Secrets > Add `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` (file contents) |
| Fastlane | `.env` file or Fastlane Match |
| Bitrise | Secrets tab in workflow editor |
| Xcode Cloud | Workflow > Environment Variables |

In CI, you typically store the `.p8` file contents as a secret and write it to a temp file:

```bash
echo "$ASC_PRIVATE_KEY" > /tmp/AuthKey.p8
export ASC_PRIVATE_KEY_PATH=/tmp/AuthKey.p8
```

## Step 3: Verify the Connection

### Using the CLI

```bash
ios-app-review scan ./MyApp.xcodeproj --include-asc --analyzers asc-metadata
```

If credentials are correct, you will see metadata validation results. If not, you will get an authentication error.

### Using the MCP Tool

In Claude Code:

```
Validate the App Store Connect metadata for bundle ID com.mycompany.myapp
```

This calls the `validate_asc_metadata` tool.

## Step 4: Run ASC Validators

### Individual Validators

**Metadata check:**

```bash
# Via MCP
validate_asc_metadata with bundleId "com.mycompany.myapp"
```

Checks: app name length, subtitle, description, keywords, privacy policy URL, support URL, marketing URL.

**Screenshots check:**

```bash
# Via MCP
validate_asc_screenshots with bundleId "com.mycompany.myapp"
```

Checks: required device sizes present, screenshot counts per locale, no failed uploads.

**Version comparison:**

```bash
# Via MCP
compare_versions with bundleId "com.mycompany.myapp", localVersion "2.1.0", localBuild "45"
```

Checks: version/build number increments, submission status, release notes presence.

**IAP validation:**

```bash
# Via MCP
validate_iap with bundleId "com.mycompany.myapp"
```

Checks: localized names/descriptions, review screenshots, submission readiness.

### Full ASC Validation

Run all four validators at once:

```bash
# Via MCP
full_asc_validation with bundleId "com.mycompany.myapp"
```

Or via CLI:

```bash
ios-app-review scan ./MyApp.xcodeproj --include-asc
```

## Step 5: Understand ASC Results

ASC issues use these categories:

| Category | Validator |
|----------|-----------|
| `metadata` | asc-metadata |
| `screenshots` | asc-screenshots |
| `version` | asc-version |
| `iap` | asc-iap |

Common findings:

- **Missing privacy policy URL** -- Required for all apps. Add in App Store Connect > App Information.
- **App name too long** -- Must be 30 characters or fewer.
- **Missing screenshots for device** -- iPhone 6.7" and 6.5" are required. iPad 12.9" if supporting iPad.
- **Failed screenshot uploads** -- Re-upload screenshots that show "processing failed" status.
- **Version not incremented** -- The new version must be higher than the current App Store version.
- **IAP missing review screenshot** -- Each IAP needs a screenshot for Apple's review team.
- **IAP missing localization** -- Name and description must be provided in at least one language.

## Troubleshooting

### "401 Unauthorized"

- Verify the Key ID matches the downloaded key.
- Verify the Issuer ID (shown at the top of the Keys page, not per-key).
- Regenerate the key if it was revoked.
- Check system clock accuracy (JWT tokens are time-sensitive).

### "404 Not Found" for bundle ID

- The bundle ID is case-sensitive.
- The app must exist in your ASC account.
- The API key must have access to the app (check team membership).

### Rate Limiting

The ASC API has rate limits. The client handles retries automatically. If running in parallel CI jobs, stagger ASC checks or use a shared rate limiter.

### Permission Errors

The API key needs at least **App Manager** role. **Developer** role is insufficient for reading all metadata.

## Security Notes

- Never commit `.p8` files to version control.
- Add to `.gitignore`: `*.p8`, `AuthKey_*.p8`.
- Use CI secrets for all three credential values.
- The plugin generates short-lived JWT tokens (20-minute expiry) and does not persist credentials.
- Delete temp key files after CI runs: `rm /tmp/AuthKey.p8`.
