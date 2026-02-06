# Video Script: Introduction to iOS App Review Plugin

**Duration:** 3 minutes
**Audience:** iOS developers who submit apps to the App Store
**Goal:** Explain the problem, show the tool, and demonstrate a first scan

---

## Opening (0:00 - 0:30)

**Hook:** "If you have ever had an app rejected by Apple, you know the frustration. A single missing privacy description or a leftover debug URL can cost you days."

**Problem statement:**
- App Store rejections are time-consuming.
- Apple checks dozens of criteria: privacy manifests, deprecated APIs, metadata completeness, icon sizes, security patterns.
- Manual checks are error-prone and tedious.

**Transition:** "The iOS App Review Plugin automates these checks before you submit."

---

## What It Does (0:30 - 1:15)

**Overview narration with on-screen text/graphics:**

The plugin is two things:
1. A CLI tool you run locally or in CI.
2. An MCP server that integrates with Claude Code.

**On screen: Show the architecture diagram.**

It runs 12 analyzers across two domains:

**Codebase (8 analyzers):**
- Info.plist validation
- Privacy manifest (iOS 17+)
- Entitlements
- Code scanning (secrets, debug code, IPv6)
- Deprecated APIs
- Private APIs
- Security vulnerabilities
- UI/UX compliance (icons, launch screen, accessibility)

**App Store Connect (4 analyzers):**
- Metadata completeness
- Screenshot validation
- Version comparison
- In-app purchase readiness

**Transition:** "Let me show you what it looks like in practice."

---

## Demo: First Scan (1:15 - 2:30)

**Terminal recording:**

```bash
# Install
npm install -g ios-app-review-plugin

# Run a scan
ios-app-review scan ./SampleApp.xcodeproj
```

**Narrate the output as it appears:**

1. "The report starts with a readiness score -- 68 out of 100."
2. "The summary shows 2 errors, 5 warnings, and 3 info items."
3. "Priority Remediation lists the errors that will most likely cause rejection."
4. "Scrolling down, issues are grouped by category."
5. "Each issue includes the file, line number, Apple guideline reference, and a fix suggestion."

**Show fixing one issue:**

```bash
# The scan found a hardcoded API key
# Fix it, then re-scan
ios-app-review scan ./SampleApp.xcodeproj
# Score improved to 78/100
```

---

## What's Next (2:30 - 3:00)

**Closing narration:**

- "You can run this in CI to block PRs with errors."
- "Add --include-asc to validate your App Store Connect metadata too."
- "Custom rules let you enforce your team's own conventions."
- "Check the docs for setup guides on GitHub Actions, Fastlane, Bitrise, and Xcode Cloud."

**Call to action:**
- Link to GitHub repository
- Link to Getting Started tutorial
- "Star the repo if you find it useful."

---

## Production Notes

- Use a real sample project with deliberate issues for the demo.
- Terminal should use a large font (24pt+) with dark background.
- Highlight key parts of the output with colored overlays.
- Keep the pace brisk -- this is a 3-minute overview, not a deep dive.
