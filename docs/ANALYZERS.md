# Analyzers Reference

The plugin ships with 8 core analyzers and 4 App Store Connect (ASC) analyzers. All run in parallel via `Promise.allSettled` so a failure in one does not block the rest.

---

## Core Analyzers

### info-plist

**Name:** Info.plist Analyzer
**Category:** `info-plist`

Validates Info.plist files for the main app target.

**Checks performed:**

| Issue ID | Severity | What it checks |
|----------|----------|----------------|
| `no-app-target` | error | No application target found in project |
| `missing-info-plist-path` | error | Target has no INFOPLIST_FILE build setting |
| `info-plist-not-found` | error | Info.plist file does not exist at configured path |
| `info-plist-parse-error` | error | Plist is malformed or unreadable |
| `missing-cfbundleidentifier` | error | Missing CFBundleIdentifier |
| `missing-cfbundlename` | error | Missing CFBundleName |
| `missing-cfbundleversion` | error | Missing CFBundleVersion |
| `missing-cfbundleshortversionstring` | error | Missing CFBundleShortVersionString |
| `missing-cfbundleexecutable` | error | Missing CFBundleExecutable |
| `missing-cfbundlepackagetype` | error | Missing CFBundlePackageType |
| `invalid-bundle-identifier` | error | Bundle ID contains invalid characters |
| `invalid-version-format` | warning | Version does not follow MAJOR.MINOR.PATCH |
| `ats-allows-arbitrary-loads` | warning | ATS disabled globally |
| `missing-launch-screen` | warning | No UILaunchStoryboardName or UILaunchScreen |
| `placeholder-*` | error | Privacy description contains placeholder text |
| `short-*` | warning | Privacy description under 10 characters |
| `limiting-capability-*` | info | UIRequiredDeviceCapabilities restricts devices |

**Common findings:** Missing privacy usage descriptions, ATS disabled, placeholder strings in permission prompts.

---

### privacy

**Name:** Privacy Manifest Analyzer
**Category:** `privacy`

Validates PrivacyInfo.xcprivacy for iOS 17+ Required Reason API declarations.

**Required Reason API categories tracked:**

- `NSPrivacyAccessedAPICategoryFileTimestamp` -- File timestamp APIs
- `NSPrivacyAccessedAPICategorySystemBootTime` -- System boot time APIs
- `NSPrivacyAccessedAPICategoryDiskSpace` -- Disk space APIs
- `NSPrivacyAccessedAPICategoryActiveKeyboards` -- Active keyboards APIs
- `NSPrivacyAccessedAPICategoryUserDefaults` -- UserDefaults with suite name

| Issue ID | Severity | What it checks |
|----------|----------|----------------|
| `missing-privacy-manifest` | error | Code uses Required Reason APIs but no manifest exists |
| `privacy-manifest-not-found` | error | Manifest path does not exist |
| `privacy-manifest-parse-error` | error | Manifest is malformed |
| `tracking-no-domains` | warning | NSPrivacyTracking=true but no domains listed |
| `undeclared-api-*` | error | API usage detected in code but not declared in manifest |
| `no-reasons-*` | error | API category declared with no reasons |
| `invalid-reason-*` | error | Reason code not in Apple's valid list |
| `no-purpose-*` | warning | Collected data type has no purposes declared |

---

### entitlements

**Name:** Entitlements Analyzer
**Category:** `entitlements`

Validates `.entitlements` plist files against capabilities.

| Issue ID | Severity | What it checks |
|----------|----------|----------------|
| `no-entitlements-file` | info | Target has no entitlements (may be fine) |
| `entitlements-not-found` | error | Referenced entitlements file does not exist |
| `entitlements-parse-error` | error | Cannot parse entitlements plist |
| `debug-entitlement-get-task-allow` | warning | get-task-allow=true in release config |
| `invalid-aps-environment` | error | Push environment not "development" or "production" |
| `invalid-app-group-format` | error | App Group ID missing "group." prefix |
| `invalid-associated-domain-format` | error | Domain missing applinks:/webcredentials: prefix |
| `invalid-keychain-group-format` | warning | Keychain group missing team ID prefix |
| `invalid-icloud-container-format` | error | iCloud container missing "iCloud." prefix |
| `siwa-missing-default` | warning | Sign in with Apple missing "Default" value |
| `entitlements-summary` | info | Lists all declared entitlements |

---

### code

**Name:** Code Scanner
**Category:** `code`

Regex-based scan of Swift and Objective-C source files.

| Issue ID | Severity | What it checks |
|----------|----------|----------------|
| `hardcoded-ipv4` | warning | IPv4 address strings (IPv6 compliance) |
| `hardcoded-api-key` | error | API key or secret in source |
| `aws-key` | error | AWS AKIA access key |
| `test-server-url` | warning | localhost/staging/test URLs |
| `print-statement` | info | print/NSLog/debugPrint calls |
| `todo-comment` | info | TODO/FIXME/HACK/XXX comments |
| `force-unwrap` | info | Force unwrap operator (!) |
| `hardcoded-password` | error | Password strings in source |
| `insecure-http` | warning | HTTP URLs (non-HTTPS) |
| `placeholder-text` | warning | Lorem ipsum / placeholder strings |
| `debug-ifdef` | info | #if DEBUG blocks |
| `deprecated-uiwebview` | error | UIWebView usage (ITMS-90809) |
| `deprecated-addressbook` | warning | ABAddressBook framework usage |

Limits: max 5 issues per pattern per file. Skips commented lines and test imports. Ignores Pods, Carthage, build, and DerivedData directories.

---

### deprecated-api

**Name:** Deprecated API Scanner
**Category:** `deprecated-api`

Detects 20+ deprecated iOS APIs. Severity is `error` when the API is removed at your deployment target and `warning` when merely deprecated.

**Key APIs tracked:** UIWebView, UIAlertView, UIActionSheet, UIPopoverController, UISearchDisplayController, UITableViewRowAction, NSURLConnection, ABAddressBook, MPMoviePlayerController, ALAssetsLibrary, UILocalNotification, UIAccelerometer, openURL (sync), statusBarStyle, statusBarOrientation, sizeWithFont.

---

### private-api

**Name:** Private API Scanner
**Category:** `private-api`

Detects private API usage that causes immediate App Store rejection.

**Checks:**

- Underscore-prefixed selectors via NSSelectorFromString
- Private class access via NSClassFromString (`_UI*`, `_NS*`, etc.)
- performSelector with private selectors
- valueForKey with underscore-prefixed keys
- dlopen of PrivateFrameworks
- dlsym usage
- Direct objc_msgSend calls
- IOKit private APIs
- Private status bar APIs
- Sandbox escape file paths
- Import of private frameworks (GraphicsServices, BackBoardServices, SpringBoardServices, etc.)
- Private URL schemes (cydia://, prefs://, app-prefs://, etc.)

---

### security

**Name:** Security Analyzer
**Category:** `security`

Detects security vulnerabilities in source code.

| Issue ID | Severity | What it checks |
|----------|----------|----------------|
| `security-md5` | warning | MD5 hash usage |
| `security-sha1` | warning | SHA-1 hash usage |
| `security-des` | error | DES/3DES encryption |
| `security-ecb-mode` | error | ECB encryption mode |
| `security-userdefaults-sensitive` | error | Sensitive data in UserDefaults |
| `security-userdefaults-sensitive-set` | error | .set() with sensitive key names |
| `security-insecure-random` | warning | rand()/srand() usage |
| `security-keychain-accessible-always` | error | kSecAttrAccessibleAlways |
| `security-keychain-accessible-always-this-device` | error | kSecAttrAccessibleAlwaysThisDeviceOnly |
| `security-clipboard-sensitive` | warning | Sensitive data on UIPasteboard |
| `security-sql-injection` | error | String interpolation in SQL |
| `security-logging-sensitive` | warning | Logging passwords/tokens |
| `security-hardcoded-encryption-key` | error | Encryption key in source |
| `security-webview-js-injection` | warning | evaluateJavaScript with interpolation |
| `security-disabled-ssl` | warning | Disabled certificate validation |

---

### ui-ux

**Name:** UI/UX Compliance
**Category:** `ui-ux`

Checks user interface requirements for App Store compliance.

| Issue ID | Severity | What it checks |
|----------|----------|----------------|
| `uiux-no-target` | info | No application target found |
| `uiux-no-launch-screen` | error | No LaunchScreen.storyboard or plist entry |
| `uiux-no-app-icon` | error | No AppIcon.appiconset |
| `uiux-missing-appstore-icon` | error | Missing 1024x1024 App Store icon |
| `uiux-missing-iphone-icon` | warning | Missing iPhone icon size/scale |
| `uiux-missing-ipad-icon` | warning | Missing iPad icon size/scale |
| `uiux-invalid-icon-contents` | warning | Cannot parse Contents.json |
| `uiux-ipad-missing-orientations` | error | iPad app missing required orientations |
| `uiux-placeholder-text` | warning | Placeholder/default text in storyboards |
| `uiux-no-accessibility-labels` | warning | Images present but no accessibility labels |
| `uiux-no-dynamic-type` | info | Hardcoded fonts without Dynamic Type |

---

## ASC Analyzers

All ASC analyzers require these environment variables:

```
ASC_KEY_ID=<your-key-id>
ASC_ISSUER_ID=<your-issuer-id>
ASC_PRIVATE_KEY_PATH=<path-to-AuthKey.p8>
```

### asc-metadata

Validates App Store Connect metadata: app name length, subtitle, description, keywords, privacy policy URL, support URL, marketing URL.

### asc-screenshots

Validates screenshots: required device sizes present, minimum/maximum counts per locale, processing status (no failed uploads).

### asc-version

Compares local version/build with App Store Connect: checks version bumps, build number increments, submission state, and release notes presence.

### asc-iap

Validates in-app purchases: localized name and description present, review screenshot uploaded and not failed, IAP status ready for submission.

---

## Custom Rules Engine

In addition to the built-in analyzers, the custom rules engine runs rules defined in `.ios-review-rules.json`. See [RULES.md](./RULES.md) for the configuration format.

Custom rule issues use category `custom` by default. Rules support `// ios-review-disable-next-line <rule-id>` inline suppression comments.
