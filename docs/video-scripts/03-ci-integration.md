# Video Script: CI Integration

**Duration:** 5 minutes
**Audience:** iOS developers setting up automated review checks in CI
**Goal:** Walk through GitHub Actions setup end-to-end, then briefly cover other platforms

---

## Opening (0:00 - 0:20)

"Catching App Store issues before they reach code review saves everyone time. In this video, I will set up automated review checks in GitHub Actions from scratch, then show how to adapt this for Fastlane, Bitrise, and Xcode Cloud."

---

## Part 1: GitHub Actions (0:20 - 3:00)

### Create the Workflow (0:20 - 0:50)

**Editor (VS Code or similar):**

"Create a new file at .github/workflows/app-review.yml."

```yaml
name: App Store Review Check
on:
  pull_request:
    branches: [main]
```

"This triggers on pull requests to main."

### Add the Job (0:50 - 1:30)

```yaml
jobs:
  review-check:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install ios-app-review
        run: npm install -g ios-app-review-plugin

      - name: Run review check
        run: |
          ios-app-review scan ./MyApp.xcodeproj \
            --format json \
            --output report.json
```

"fetch-depth 0 gives us full git history, which we need for incremental scanning."

### Add Artifact Upload (1:30 - 1:50)

```yaml
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: review-report
          path: report.json
```

"'if: always()' ensures the report is uploaded even when the check fails."

### Push and Test (1:50 - 2:15)

**Terminal:**

```bash
git add .github/workflows/app-review.yml
git commit -m "Add App Store review CI check"
git push
```

"Now I will open a PR to trigger it."

**Show GitHub PR checks tab with the workflow running. Show it completing with pass or fail.**

### Add Incremental Scanning (2:15 - 2:35)

"For faster PR checks, scan only changed files:"

```yaml
      - name: Incremental scan
        run: |
          ios-app-review scan ./MyApp.xcodeproj \
            --changed-since origin/main \
            --format json \
            --output report.json
```

"This typically finishes in under 5 seconds."

### Make It a Required Check (2:35 - 3:00)

**Browser -- GitHub Settings:**

1. Settings > Branches > Branch protection rules
2. Edit rule for `main`
3. Enable "Require status checks"
4. Select "App Store Review Check"

"Now PRs cannot merge until the review check passes."

---

## Part 2: Other Platforms (3:00 - 4:30)

### Fastlane (3:00 - 3:30)

**Editor:**

```ruby
# fastlane/Fastfile
lane :review_check do
  sh("ios-app-review scan ../MyApp.xcodeproj --format json --output ../report.json")

  report = JSON.parse(File.read("../report.json"))
  if report["summary"]["errors"] > 0
    UI.user_error!("Review check failed")
  end
end

lane :release do
  review_check   # gate before submit
  build_app
  upload_to_app_store
end
```

"Put it before upload_to_app_store so it gates your release lane."

### Bitrise (3:30 - 3:55)

**Editor:**

```yaml
- script@1:
    title: Run ios-app-review
    inputs:
      - content: |
          npm install -g ios-app-review-plugin
          ios-app-review scan ./MyApp.xcodeproj \
            --format json \
            --output "$BITRISE_DEPLOY_DIR/report.json"
```

"Bitrise deploys the report artifact automatically with the deploy-to-bitrise-io step."

### Xcode Cloud (3:55 - 4:20)

**Editor:**

```bash
# ci_scripts/ci_post_clone.sh
#!/bin/bash
set -e
brew install node 2>/dev/null || true
npm install -g ios-app-review-plugin
ios-app-review scan "$CI_PRIMARY_REPOSITORY_PATH/MyApp.xcodeproj" \
  --format json --output "$CI_PRIMARY_REPOSITORY_PATH/report.json"
```

"Xcode Cloud runs scripts in the ci_scripts directory automatically. Just make it executable and commit it."

---

## Part 3: Best Practices (4:20 - 4:50)

"Quick tips from running this in production:"

1. "Use incremental scanning on PRs, full scans on main."
2. "Save history on main branch pushes to track your score over time."
3. "Start with errors-only blocking. The tool already only returns exit code 1 for errors, not warnings."
4. "Cache node_modules to speed up installs."
5. "Keep ASC credentials in your CI platform's secrets manager."

---

## Closing (4:50 - 5:00)

"That is CI integration in 5 minutes. All of these configurations are in the docs/CI_CD.md file in the repository. Check the links in the description."

---

## Production Notes

- Pre-record the GitHub Actions run to avoid waiting on CI during the video.
- Show the actual PR checks UI -- green check or red X.
- For the Fastlane/Bitrise/Xcode Cloud sections, show the config file briefly (10-15 seconds each).
- End card: link to repo, docs, and the Getting Started tutorial.
