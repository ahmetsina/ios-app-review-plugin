# Custom Rules Tutorial

This tutorial walks through creating, testing, and sharing custom rules for your team.

## Why Custom Rules?

Built-in analyzers catch universal App Store issues. Custom rules let you enforce:

- Team coding conventions (no force casts, required copyright headers)
- Project-specific patterns (no direct Core Data access outside the data layer)
- Compliance requirements (no logging PII, required audit comments)
- Migration tracking (flag old API wrappers that should be replaced)

## Step 1: Create the Config File

Create `.ios-review-rules.json` in your project root (the directory containing your `.xcodeproj`):

```json
{
  "version": 1,
  "rules": [],
  "disabledRules": [],
  "severityOverrides": {}
}
```

## Step 2: Write Your First Rule

Add a rule that flags `as!` force casts:

```json
{
  "version": 1,
  "rules": [
    {
      "id": "team-no-force-cast",
      "title": "Force cast detected",
      "description": "Force casts (as!) can cause crashes. Use conditional casting (as?) instead.",
      "severity": "warning",
      "pattern": "\\bas!\\s",
      "flags": "g",
      "fileTypes": [".swift"],
      "suggestion": "Replace 'as!' with 'as?' and handle the optional."
    }
  ]
}
```

## Step 3: Test the Rule

Run a scan to see it in action:

```bash
ios-app-review scan ./MyApp.xcodeproj --config .ios-review-rules.json
```

Or validate the config without running a full scan (via MCP):

```
Validate my custom rules at ./MyApp.xcodeproj
```

## Step 4: Add More Rules

Here are practical rules you can adapt:

### Require Logger Instead of print

```json
{
  "id": "team-use-logger",
  "title": "Use Logger instead of print",
  "description": "Use os.Logger for structured logging instead of print().",
  "severity": "warning",
  "pattern": "\\bprint\\s*\\(",
  "flags": "g",
  "fileTypes": [".swift"],
  "suggestion": "Import os and use Logger.log() for production-appropriate logging."
}
```

### Flag Direct UserDefaults Access

```json
{
  "id": "team-no-direct-userdefaults",
  "title": "Direct UserDefaults access",
  "description": "Use AppSettings wrapper instead of accessing UserDefaults directly.",
  "severity": "warning",
  "pattern": "UserDefaults\\.standard",
  "flags": "g",
  "fileTypes": [".swift"],
  "suggestion": "Use the AppSettings singleton for consistent defaults access."
}
```

### Require Accessibility Labels on Buttons

```json
{
  "id": "team-button-accessibility",
  "title": "Button without accessibility setup",
  "description": "UIButton created without accessibility label in the same scope.",
  "severity": "info",
  "pattern": "UIButton\\(",
  "flags": "g",
  "fileTypes": [".swift"],
  "suggestion": "Set accessibilityLabel on all interactive UI elements."
}
```

### Flag Hardcoded Colors

```json
{
  "id": "team-no-hardcoded-colors",
  "title": "Hardcoded UIColor",
  "description": "Use named colors from the asset catalog for consistent theming and dark mode support.",
  "severity": "info",
  "pattern": "UIColor\\(red:|UIColor\\(white:|#colorLiteral",
  "flags": "g",
  "fileTypes": [".swift"],
  "suggestion": "Use UIColor(named:) with colors defined in Assets.xcassets."
}
```

### Detect Missing Error Handling

```json
{
  "id": "team-no-try-bang",
  "title": "try! without error handling",
  "description": "try! will crash if the operation throws. Use do/catch instead.",
  "severity": "warning",
  "pattern": "\\btry!\\s",
  "flags": "g",
  "fileTypes": [".swift"],
  "suggestion": "Wrap in do/catch block or use try? if the error can be safely ignored."
}
```

## Step 5: Override Built-in Severities

Promote built-in warnings to errors or demote info items:

```json
{
  "version": 1,
  "rules": [],
  "severityOverrides": {
    "hardcoded-ipv4": "error",
    "insecure-http": "error",
    "print-statement": "warning",
    "todo-comment": "warning"
  }
}
```

This makes hardcoded IPs and HTTP URLs fail the build (error), and promotes print statements and TODOs to warnings.

## Step 6: Disable Noisy Rules

If certain built-in rules generate too much noise for your project:

```json
{
  "version": 1,
  "rules": [],
  "disabledRules": [
    "force-unwrap",
    "debug-ifdef",
    "print-statement"
  ]
}
```

## Step 7: Use Inline Suppression

When a rule fires on a legitimate use:

```swift
// ios-review-disable-next-line team-no-force-cast
let vc = storyboard.instantiateViewController(withIdentifier: "Main") as! MainViewController
```

Suppress multiple rules on one line:

```swift
// ios-review-disable-next-line team-no-force-cast, team-no-try-bang
let data = try! JSONEncoder().encode(model as! Encodable)
```

## Step 8: Share Rules Across Projects

### Monorepo Approach

Place `.ios-review-rules.json` in the repository root. The rule loader walks up from the project directory, so all projects in the repo share the same rules.

```
monorepo/
  .ios-review-rules.json    <-- shared rules
  AppA/
    AppA.xcodeproj
  AppB/
    AppB.xcodeproj
```

### Per-project Overrides

Place a project-specific config that takes precedence:

```
monorepo/
  .ios-review-rules.json        <-- base rules
  AppA/
    .ios-review-rules.json      <-- AppA overrides (found first)
    AppA.xcodeproj
```

### External Config

Point to any file path:

```bash
ios-app-review scan ./MyApp.xcodeproj --config ~/team-configs/strict-rules.json
```

## Complete Example Config

```json
{
  "version": 1,
  "rules": [
    {
      "id": "team-no-force-cast",
      "title": "Force cast detected",
      "description": "Force casts (as!) can cause crashes at runtime.",
      "severity": "warning",
      "pattern": "\\bas!\\s",
      "flags": "g",
      "fileTypes": [".swift"],
      "suggestion": "Use 'as?' with optional binding instead."
    },
    {
      "id": "team-no-try-bang",
      "title": "try! without error handling",
      "description": "try! crashes on throw. Use do/catch.",
      "severity": "warning",
      "pattern": "\\btry!\\s",
      "flags": "g",
      "fileTypes": [".swift"],
      "suggestion": "Wrap in do/catch or use try?."
    },
    {
      "id": "team-use-logger",
      "title": "Use Logger instead of print",
      "description": "print() output is not structured and cannot be filtered.",
      "severity": "warning",
      "pattern": "\\bprint\\s*\\(",
      "flags": "g",
      "fileTypes": [".swift"],
      "suggestion": "Use os.Logger for production logging."
    },
    {
      "id": "team-copyright",
      "title": "Missing copyright header",
      "description": "All Swift files must include the team copyright header.",
      "severity": "info",
      "pattern": "^(?!.*Copyright.*ACME)",
      "flags": "",
      "fileTypes": [".swift"],
      "suggestion": "Add '// Copyright ACME Corp' to the file header."
    }
  ],
  "disabledRules": [
    "force-unwrap"
  ],
  "severityOverrides": {
    "insecure-http": "error",
    "hardcoded-ipv4": "error"
  }
}
```

## Debugging Tips

1. **Validate first:** Use `validate_custom_rules` before running full scans.
2. **Test regex in JS:** Open a browser console and test `new RegExp("your-pattern", "g").test("sample code")`.
3. **Start with `info` severity** while tuning patterns, then promote to `warning` or `error`.
4. **Check escaping:** JSON requires `\\` for regex backslashes. `\b` in regex becomes `"\\b"` in JSON.
5. **Limit scope with fileTypes:** Avoid false positives in headers or Objective-C by restricting to `.swift`.
