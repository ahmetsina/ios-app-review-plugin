# CI/CD Integration

The CLI exits with code 0 (pass) or 1 (errors found), making it a natural CI gate. This guide covers GitHub Actions, Fastlane, Bitrise, and Xcode Cloud.

---

## GitHub Actions

### Basic Gate

```yaml
# .github/workflows/app-review.yml
name: App Store Review Check

on:
  pull_request:
    paths:
      - '**/*.swift'
      - '**/*.m'
      - '**/*.mm'
      - '**/Info.plist'
      - '**/PrivacyInfo.xcprivacy'
      - '**/*.entitlements'

jobs:
  review-check:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install ios-app-review
        run: npm install -g ios-app-review-plugin

      - name: Run review check
        run: ios-app-review scan ./MyApp.xcodeproj --format json --output report.json

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: review-report
          path: report.json
```

### With ASC Validation and Badge

```yaml
jobs:
  review-check:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install ios-app-review
        run: npm install -g ios-app-review-plugin

      - name: Run full review
        env:
          ASC_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          ASC_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          ASC_PRIVATE_KEY_PATH: ${{ runner.temp }}/AuthKey.p8
        run: |
          echo "${{ secrets.ASC_PRIVATE_KEY }}" > "$ASC_PRIVATE_KEY_PATH"
          ios-app-review scan ./MyApp.xcodeproj \
            --include-asc \
            --badge \
            --save-history \
            --format json \
            --output report.json

      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: review-report
          path: |
            report.json
            badge.svg
```

### Incremental Scanning on PRs

```yaml
      - name: Incremental scan
        run: |
          ios-app-review scan ./MyApp.xcodeproj \
            --changed-since origin/main \
            --format json \
            --output report.json
```

### PR Comment with Results

```yaml
      - name: Post results to PR
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('report.json', 'utf8'));
            const status = report.summary.passed ? 'PASSED' : 'FAILED';
            const body = `## App Review Check: ${status}

            **Score:** ${report.score}/100
            **Errors:** ${report.summary.errors} | **Warnings:** ${report.summary.warnings} | **Info:** ${report.summary.info}

            ${report.issues.filter(i => i.severity === 'error').map(i => `- ${i.title}: ${i.filePath || ''}:${i.lineNumber || ''}`).join('\n')}`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```

---

## Fastlane

### Fastfile Lane

```ruby
# fastlane/Fastfile
desc "Run App Store review compliance check"
lane :review_check do
  sh("ios-app-review scan ../MyApp.xcodeproj --format json --output ../review-report.json")

  report = JSON.parse(File.read("../review-report.json"))

  if report["summary"]["errors"] > 0
    UI.user_error!("App Store review check failed with #{report['summary']['errors']} error(s). Score: #{report['score']}/100")
  else
    UI.success("App Store review check passed! Score: #{report['score']}/100")
  end
end

desc "Full review with ASC validation"
lane :full_review do
  review_check

  sh(
    "ios-app-review scan ../MyApp.xcodeproj " \
    "--include-asc --format html --output ../review-report.html --badge"
  )
end
```

### Run Before Submit

```ruby
lane :submit do
  review_check
  build_app(scheme: "MyApp")
  upload_to_app_store
end
```

---

## Bitrise

### bitrise.yml Step

```yaml
workflows:
  review-check:
    steps:
      - git-clone@8: {}

      - nvm@1:
          inputs:
            - node_version: "20"

      - script@1:
          title: Install ios-app-review
          inputs:
            - content: npm install -g ios-app-review-plugin

      - script@1:
          title: Run review check
          inputs:
            - content: |
                ios-app-review scan ./MyApp.xcodeproj \
                  --format json \
                  --output "$BITRISE_DEPLOY_DIR/review-report.json" \
                  --badge

                # Copy badge to deploy dir
                cp badge.svg "$BITRISE_DEPLOY_DIR/" 2>/dev/null || true

      - deploy-to-bitrise-io@2:
          inputs:
            - deploy_path: "$BITRISE_DEPLOY_DIR/review-report.json"
```

### With ASC Secrets

Add `ASC_KEY_ID`, `ASC_ISSUER_ID`, and `ASC_PRIVATE_KEY` (base64-encoded) as Bitrise secrets, then:

```yaml
      - script@1:
          title: Run full review
          inputs:
            - content: |
                echo "$ASC_PRIVATE_KEY" | base64 -d > /tmp/AuthKey.p8
                export ASC_PRIVATE_KEY_PATH=/tmp/AuthKey.p8

                ios-app-review scan ./MyApp.xcodeproj \
                  --include-asc \
                  --format json \
                  --output "$BITRISE_DEPLOY_DIR/review-report.json"
```

---

## Xcode Cloud

Xcode Cloud runs custom scripts at specific phases. Add a post-clone or post-build script.

### ci_scripts/ci_post_clone.sh

```bash
#!/bin/bash
set -e

# Install Node.js if not available
if ! command -v node &> /dev/null; then
  brew install node
fi

# Install the tool
npm install -g ios-app-review-plugin

# Run the scan
ios-app-review scan "$CI_PRIMARY_REPOSITORY_PATH/MyApp.xcodeproj" \
  --format json \
  --output "$CI_PRIMARY_REPOSITORY_PATH/review-report.json"

# Print summary to build log
SCORE=$(cat "$CI_PRIMARY_REPOSITORY_PATH/review-report.json" | python3 -c "import sys,json; print(json.load(sys.stdin)['score'])")
ERRORS=$(cat "$CI_PRIMARY_REPOSITORY_PATH/review-report.json" | python3 -c "import sys,json; print(json.load(sys.stdin)['summary']['errors'])")

echo "App Review Score: $SCORE/100"
echo "Errors: $ERRORS"

if [ "$ERRORS" -gt 0 ]; then
  echo "::error::App Store review check failed with $ERRORS error(s)"
  exit 1
fi
```

Make the script executable:

```bash
chmod +x ci_scripts/ci_post_clone.sh
```

### ASC Credentials in Xcode Cloud

Xcode Cloud provides App Store Connect credentials automatically for certain operations. For the plugin's ASC validation, store the API key as a custom environment variable:

1. In Xcode Cloud workflow settings, add environment variables for `ASC_KEY_ID` and `ASC_ISSUER_ID`.
2. Store the private key content as a secret and write it to a temp file in the script.

---

## Tips for All Platforms

1. **Use JSON output** for machine parsing. Markdown and HTML are better for human-readable artifacts.
2. **Cache node_modules** to speed up repeated installs.
3. **Incremental scanning** (`--changed-since`) significantly reduces scan time on PRs.
4. **Save history** (`--save-history`) to track score trends across builds.
5. **Exit code 2** indicates invalid arguments or crashes -- handle this separately from exit code 1 (issues found).
