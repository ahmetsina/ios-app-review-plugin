# Troubleshooting

## Installation Issues

### "Cannot find module" errors after build

```
Error: Cannot find module '/path/to/dist/index.js'
```

Rebuild the project:

```bash
npm run clean && npm run build
```

### Node.js version error

```
SyntaxError: Unexpected token ...
```

The plugin requires Node.js >= 18. Check your version:

```bash
node --version
```

---

## Project Parsing Errors

### "No Xcode project found" or empty results

The plugin looks for `.xcodeproj` or `.xcworkspace` at the specified path. Make sure you point to the right location:

```bash
# Point to the .xcodeproj file, not the directory containing it
ios-app-review scan ./MyApp/MyApp.xcodeproj

# Or the directory containing the .xcodeproj
ios-app-review scan ./MyApp/
```

### "Failed to parse project.pbxproj"

Complex `.pbxproj` files with unusual formatting may cause parse issues. Verify the file is valid:

```bash
plutil -lint ./MyApp.xcodeproj/project.pbxproj
```

If the project uses Xcode build settings variables like `$(SRCROOT)` in paths, the parser resolves these to the project's base directory.

### No source files found

The scanner excludes these directories by default:
- `Pods/`
- `Carthage/`
- `build/`
- `DerivedData/`
- `Tests/`
- `UITests/`
- `*.generated.swift`

If your source files are in an unexpected location, ensure they are referenced in the Xcode project's target or accessible under the base path.

---

## Info.plist Issues

### "Info.plist not found at configured path"

The path in the project's build settings (INFOPLIST_FILE) is relative to the project directory. The plugin resolves it automatically, but if the file was moved:

1. Check the actual path: `find . -name "Info.plist"`
2. Update the build setting in Xcode
3. Or use `check_info_plist` directly with the absolute path

### Plist parse errors

Binary plists are supported. If parsing fails, convert to XML format:

```bash
plutil -convert xml1 ./MyApp/Info.plist
```

---

## App Store Connect (ASC) Issues

### "ASC_KEY_ID environment variable is required"

Set all three required environment variables:

```bash
export ASC_KEY_ID="XXXXXXXXXX"
export ASC_ISSUER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export ASC_PRIVATE_KEY_PATH="/path/to/AuthKey_XXXXXXXXXX.p8"
```

### "Unable to read private key"

1. Verify the file exists and is readable:
   ```bash
   ls -la "$ASC_PRIVATE_KEY_PATH"
   ```
2. Check the file format. It should start with `-----BEGIN PRIVATE KEY-----`.
3. Ensure no extra whitespace or characters were added during transfer.

### "401 Unauthorized" from ASC API

- **Key expired or revoked:** Regenerate the key in App Store Connect > Users and Access > Keys.
- **Wrong Issuer ID:** The Issuer ID is shown at the top of the Keys page, not on individual key rows.
- **Insufficient permissions:** The API key must have at least "App Manager" role.
- **Clock skew:** JWT tokens include timestamps. Ensure your system clock is accurate.

### "404 Not Found" for bundle ID

The bundle ID must match an app that exists in your App Store Connect account. Check:

```bash
# List apps (requires ASC CLI or API)
# The bundleId is case-sensitive
```

### Rate limiting

The ASC API client includes built-in rate limiting. If you see rate limit errors, the client will automatically retry after the specified delay. For parallel CI builds, consider staggering ASC validation steps.

---

## Custom Rules Issues

### "No .ios-review-rules.json found"

The rule loader searches from the project directory upward. Place the file:
- In the project root (next to `.xcodeproj`)
- Or in any parent directory
- Or specify explicitly: `--config ./path/to/rules.json`

### "Custom rules validation FAILED"

Common issues:
- **Invalid JSON:** Run `jq . .ios-review-rules.json` to validate syntax.
- **Missing required fields:** Every rule needs `id`, `title`, `description`, `severity`, and `pattern`.
- **version must be 1:** The schema version must be the literal number `1`.
- **Invalid severity:** Must be `"error"`, `"warning"`, or `"info"`.

### Regex pattern not matching

- Backslashes must be double-escaped in JSON: `\\b` for `\b`, `\\s` for `\s`.
- Test patterns in JavaScript: `new RegExp("your-pattern", "g")`.
- Ensure the `flags` field is set (default: `"g"`). Without `g`, only the first match per file is reported.

---

## Large Project Performance

### Scan takes too long

1. **Use incremental scanning:**
   ```bash
   ios-app-review scan ./MyApp.xcodeproj --changed-since main
   ```

2. **Run specific analyzers:**
   ```bash
   ios-app-review scan ./MyApp.xcodeproj --analyzers code,security
   ```

3. **Exclude unnecessary targets:** The plugin analyzes all application targets by default. If you have multiple targets, use the `targetName` parameter (MCP) to focus on one.

### Memory issues on very large projects

For projects with thousands of source files, Node.js may need more heap space:

```bash
NODE_OPTIONS="--max-old-space-size=4096" ios-app-review scan ./MyApp.xcodeproj
```

---

## History and Comparison Issues

### "No previous scan found"

Run a scan with `--save-history` first to create the baseline:

```bash
ios-app-review scan ./MyApp.xcodeproj --save-history
```

History is stored in `.ios-review-history/` near the project directory.

### History directory location

The history store writes to a `.ios-review-history` directory in the parent directory of the resolved project path. For example, if your project is at `/code/MyApp/MyApp.xcodeproj`, history is stored in `/code/MyApp/.ios-review-history/`.

---

## MCP Server Issues

### Server does not start

When run without arguments, the binary starts as an MCP server on stdio. Ensure your MCP client configuration points to the correct path:

```json
{
  "ios-app-review": {
    "command": "node",
    "args": ["/absolute/path/to/ios-app-review-plugin/dist/index.js"]
  }
}
```

### "Unknown tool" errors

Verify you are calling tools with their exact names. Tool names use underscores, not hyphens: `analyze_ios_app`, not `analyze-ios-app`.

### Server crashes silently

Check stderr output. The server logs startup and fatal errors to stderr:

```bash
node dist/index.js 2>server.log
```
