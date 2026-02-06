# CI Integration Tutorial

This tutorial walks through setting up automated App Store review checks in your CI pipeline, step by step.

## Overview

The goal: every pull request runs the review checker automatically, blocks merges when errors are found, and tracks your score over time.

**Time to set up:** 10-15 minutes per platform.

---

## GitHub Actions (Recommended)

### Step 1: Create the Workflow File

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/app-review.yml`:

```yaml
name: App Store Review Check

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  review-check:
    runs-on: macos-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # needed for --changed-since

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install ios-app-review
        run: npm install -g ios-app-review-plugin

      - name: Run review check
        run: |
          ios-app-review scan ./MyApp.xcodeproj \
            --format json \
            --output report.json \
            --badge \
            --save-history

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: review-report
          path: |
            report.json
            badge.svg
```

### Step 2: Test It

Push the workflow file and open a pull request. The check appears under the PR's "Checks" tab.

### Step 3: Make It a Required Check

1. Go to Settings > Branches > Branch protection rules.
2. Edit the rule for `main`.
3. Enable "Require status checks to pass before merging".
4. Search for "App Store Review Check" and add it.

### Step 4: Add Incremental Scanning for PRs

For faster PR checks, scan only changed files:

```yaml
      - name: Run incremental review
        if: github.event_name == 'pull_request'
        run: |
          ios-app-review scan ./MyApp.xcodeproj \
            --changed-since origin/${{ github.base_ref }} \
            --format json \
            --output report.json

      - name: Run full review
        if: github.event_name == 'push'
        run: |
          ios-app-review scan ./MyApp.xcodeproj \
            --format json \
            --output report.json \
            --save-history
```

### Step 5: Add ASC Validation (Optional)

1. In your repo, go to Settings > Secrets and variables > Actions.
2. Add secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` (paste the `.p8` file contents).
3. Update the workflow:

```yaml
      - name: Run full review with ASC
        env:
          ASC_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          ASC_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          ASC_PRIVATE_KEY_PATH: ${{ runner.temp }}/AuthKey.p8
        run: |
          echo "${{ secrets.ASC_PRIVATE_KEY }}" > "$ASC_PRIVATE_KEY_PATH"
          ios-app-review scan ./MyApp.xcodeproj \
            --include-asc \
            --format json \
            --output report.json
          rm "$ASC_PRIVATE_KEY_PATH"
```

---

## Fastlane

### Step 1: Add a Review Lane

Edit `fastlane/Fastfile`:

```ruby
desc "Check App Store review compliance"
lane :review_check do |options|
  format = options[:format] || "json"
  output = options[:output] || "../review-report.json"

  sh("ios-app-review scan ../MyApp.xcodeproj --format #{format} --output #{output}")

  if format == "json"
    report = JSON.parse(File.read(output))
    score = report["score"]
    errors = report["summary"]["errors"]

    UI.header("App Store Review Results")
    UI.message("Score: #{score}/100")
    UI.message("Errors: #{errors}")

    if errors > 0
      UI.user_error!("Review check failed with #{errors} error(s)")
    else
      UI.success("Review check passed!")
    end
  end
end
```

### Step 2: Wire It Into Your Build Lane

```ruby
lane :beta do
  review_check
  build_app(scheme: "MyApp")
  upload_to_testflight
end

lane :release do
  review_check(format: "html", output: "../review-report.html")
  build_app(scheme: "MyApp")
  upload_to_app_store
end
```

### Step 3: Run It

```bash
bundle exec fastlane review_check
```

---

## Bitrise

### Step 1: Add Steps to bitrise.yml

```yaml
workflows:
  primary:
    steps:
      - git-clone@8: {}

      - nvm@1:
          inputs:
            - node_version: "20"

      - script@1:
          title: Install and run ios-app-review
          inputs:
            - content: |
                npm install -g ios-app-review-plugin
                ios-app-review scan ./MyApp.xcodeproj \
                  --format json \
                  --output "$BITRISE_DEPLOY_DIR/review-report.json" \
                  --badge
                cp badge.svg "$BITRISE_DEPLOY_DIR/" 2>/dev/null || true

      - deploy-to-bitrise-io@2: {}
```

### Step 2: Add Secrets

In Bitrise workflow editor, go to Secrets and add `ASC_KEY_ID`, `ASC_ISSUER_ID`, and the base64-encoded private key as `ASC_PRIVATE_KEY_B64`.

```yaml
      - script@1:
          title: Setup ASC credentials
          inputs:
            - content: |
                echo "$ASC_PRIVATE_KEY_B64" | base64 -d > /tmp/AuthKey.p8
                export ASC_PRIVATE_KEY_PATH=/tmp/AuthKey.p8
```

---

## Xcode Cloud

### Step 1: Create the Script

```bash
mkdir -p ci_scripts
```

Create `ci_scripts/ci_post_clone.sh`:

```bash
#!/bin/bash
set -e

# Install Node.js
brew install node 2>/dev/null || true

# Install the tool
npm install -g ios-app-review-plugin

# Run scan
ios-app-review scan "$CI_PRIMARY_REPOSITORY_PATH/MyApp.xcodeproj" \
  --format json \
  --output "$CI_PRIMARY_REPOSITORY_PATH/review-report.json"

# Read results
ERRORS=$(python3 -c "import json; print(json.load(open('$CI_PRIMARY_REPOSITORY_PATH/review-report.json'))['summary']['errors'])")

if [ "$ERRORS" -gt 0 ]; then
  echo "error: App Store review check failed with $ERRORS error(s)"
  exit 1
fi

echo "App Store review check passed"
```

### Step 2: Make It Executable

```bash
chmod +x ci_scripts/ci_post_clone.sh
git add ci_scripts/
git commit -m "Add App Store review CI check"
```

### Step 3: Configure in Xcode Cloud

The script runs automatically during the post-clone phase. No additional Xcode Cloud configuration is needed beyond ensuring the script is in the `ci_scripts/` directory.

---

## Verifying Your Setup

After setting up on any platform:

1. **Introduce a deliberate error** -- add `UIWebView()` somewhere in your code.
2. **Push and trigger the CI.**
3. **Verify the check fails** with exit code 1.
4. **Remove the error and push again.**
5. **Verify the check passes** with exit code 0.

## Best Practices

1. **Start with warnings as non-blocking.** Only fail the build on errors. The exit code already does this.
2. **Use incremental scanning** on PRs to keep checks fast (< 10 seconds for typical diffs).
3. **Run full scans on main** with `--save-history` to track trends.
4. **Generate HTML reports** for release branches -- they are easier for non-developers to read.
5. **Cache the npm install** to avoid re-downloading on every build.
6. **Keep ASC credentials in secrets**, never in the repo.
