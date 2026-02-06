# Custom Rules

Create a `.ios-review-rules.json` file in your project root (or any parent directory) to define team-specific or project-specific rules.

## Config Format

```json
{
  "version": 1,
  "rules": [
    {
      "id": "my-rule-id",
      "title": "Short title",
      "description": "Longer description shown in reports",
      "severity": "error",
      "pattern": "regex-pattern-string",
      "flags": "gi",
      "fileTypes": [".swift"],
      "guideline": "Guideline 2.5.4",
      "suggestion": "How to fix this",
      "category": "custom"
    }
  ],
  "disabledRules": ["built-in-rule-id"],
  "severityOverrides": {
    "hardcoded-ipv4": "error"
  }
}
```

### Top-level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `1` (literal) | yes | Schema version. Must be `1`. |
| `rules` | array | yes | Custom rule definitions. |
| `disabledRules` | string[] | no | IDs of rules to skip (built-in or custom). |
| `severityOverrides` | object | no | Override severity for any rule by ID. Keys are rule IDs, values are `"error"`, `"warning"`, or `"info"`. |

### Rule Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier (e.g., `team-no-force-cast`). |
| `title` | string | yes | Short title for reports. |
| `description` | string | yes | Detailed description shown in issue output. |
| `severity` | string | yes | One of `error`, `warning`, `info`. |
| `pattern` | string | yes | JavaScript regex pattern (without delimiters). |
| `flags` | string | no | Regex flags. Default: `"g"`. Use `"gi"` for case-insensitive. |
| `fileTypes` | string[] | no | File extensions to scan (e.g., `[".swift", ".m"]`). Default: all source files. |
| `guideline` | string | no | Related App Store guideline reference. |
| `suggestion` | string | no | Remediation guidance. |
| `category` | string | no | Issue category. Default: `"custom"`. |

## Pattern Syntax

Patterns use JavaScript `RegExp` syntax. Common examples:

| Pattern | Matches |
|---------|---------|
| `\\bUIWebView\\b` | Word-boundary match for `UIWebView` |
| `print\\s*\\(` | `print(` calls |
| `["'\`]http://[^"'\`]+["'\`]` | HTTP URLs in string literals |
| `\\bTODO\\b` | TODO markers |
| `force_cast` | Literal string `force_cast` |

Backslashes must be double-escaped in JSON (`\\b` for `\b`).

When the `g` flag is present, the engine finds all matches in each file. Without `g`, it reports only the first match per file.

## Inline Suppression

Suppress a specific rule on the next line with a comment:

```swift
// ios-review-disable-next-line my-rule-id
let x = unsafeOperation() // this line won't trigger my-rule-id
```

Multiple rule IDs can be comma-separated:

```swift
// ios-review-disable-next-line my-rule-id, another-rule
```

## Disabling Built-in Rules

Use `disabledRules` to turn off any built-in rule by its ID:

```json
{
  "version": 1,
  "rules": [],
  "disabledRules": [
    "print-statement",
    "todo-comment",
    "force-unwrap"
  ]
}
```

## Severity Overrides

Promote or demote any rule (built-in or custom):

```json
{
  "version": 1,
  "rules": [],
  "severityOverrides": {
    "hardcoded-ipv4": "error",
    "placeholder-text": "info"
  }
}
```

## Complete Example

```json
{
  "version": 1,
  "rules": [
    {
      "id": "team-no-swiftui-preview",
      "title": "SwiftUI preview in production code",
      "description": "SwiftUI #Preview macros should only appear in dedicated preview files.",
      "severity": "warning",
      "pattern": "#Preview\\s*\\{",
      "flags": "g",
      "fileTypes": [".swift"],
      "suggestion": "Move #Preview blocks to separate preview files or wrap in #if DEBUG."
    },
    {
      "id": "team-no-print-release",
      "title": "Print statement in non-debug code",
      "description": "Use os_log or Logger instead of print() for production logging.",
      "severity": "error",
      "pattern": "\\bprint\\s*\\(",
      "flags": "g",
      "fileTypes": [".swift"],
      "suggestion": "Replace print() with Logger from the os module."
    },
    {
      "id": "team-copyright-header",
      "title": "Missing copyright header",
      "description": "All source files must include the team copyright header.",
      "severity": "info",
      "pattern": "^(?!.*Copyright.*ACME Corp)",
      "flags": "",
      "fileTypes": [".swift"],
      "suggestion": "Add '// Copyright ACME Corp' to the top of the file."
    }
  ],
  "disabledRules": ["force-unwrap"],
  "severityOverrides": {
    "insecure-http": "error"
  }
}
```

## Validating Rules

Use the `validate_custom_rules` MCP tool or verify manually:

```bash
# The tool will parse, compile, and report any errors
# in the rules file without running a full scan.
```

From Claude Code, ask:

```
Validate my custom rules at ./MyApp.xcodeproj
```

The tool will report the config path, version, rule count, compiled regex patterns, and whether validation passed.

## Scanned File Types

The custom rules engine scans files with these extensions by default: `.swift`, `.m`, `.mm`, `.h`, `.c`, `.cpp`. Narrow this per-rule with the `fileTypes` field.

Directories excluded: `node_modules`, `Pods`, `build`, `.build`.
