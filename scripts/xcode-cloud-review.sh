#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------------
# Xcode Cloud Post-Clone Script: iOS App Review
# -------------------------------------------------------
#
# This script runs ios-app-review-plugin as a post-clone
# step in Xcode Cloud to catch App Store rejection issues
# early in the CI pipeline.
#
# Setup:
#   1. Place this script at: ci_scripts/post_clone.sh
#      (Xcode Cloud automatically runs ci_scripts/post_clone.sh)
#   2. Make it executable: chmod +x ci_scripts/post_clone.sh
#   3. Commit and push.
#
# Environment variables (set in Xcode Cloud workflow):
#   IOS_REVIEW_FORMAT    - Report format: json, markdown, html (default: json)
#   IOS_REVIEW_ANALYZERS - Comma-separated analyzers (default: all)
#   IOS_REVIEW_CONFIG    - Path to custom rules config (optional)
#   IOS_REVIEW_STRICT    - Set to "true" to fail the build on issues (default: false)
#
# Xcode Cloud provides:
#   CI_PRIMARY_REPOSITORY_PATH - Path to the cloned repository
#   CI_DERIVED_DATA_PATH       - Path for derived data
#   CI_RESULT_BUNDLE_PATH      - Path for result bundles
#
# -------------------------------------------------------

echo "========================================="
echo "  iOS App Review - Xcode Cloud"
echo "========================================="

# ---------------------------
# 1. Install Node.js via Homebrew
# ---------------------------
if ! command -v node &>/dev/null; then
  echo "Installing Node.js via Homebrew..."
  if ! command -v brew &>/dev/null; then
    echo "Error: Homebrew is not available. Cannot install Node.js."
    echo "Xcode Cloud macOS environments should have Homebrew pre-installed."
    exit 2
  fi
  brew install node@20
  brew link --overwrite node@20 2>/dev/null || true
fi

NODE_VERSION=$(node --version)
echo "Node.js version: ${NODE_VERSION}"
echo "npm version: $(npm --version)"

# Verify minimum Node.js version
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node.js 18+ is required, found ${NODE_VERSION}."
  exit 2
fi

# ---------------------------
# 2. Install ios-app-review-plugin
# ---------------------------
echo "Installing ios-app-review-plugin..."
npm install -g ios-app-review-plugin

echo "ios-app-review installed at: $(which ios-app-review)"

# ---------------------------
# 3. Configure scan
# ---------------------------
PROJECT_PATH="${CI_PRIMARY_REPOSITORY_PATH:-.}"
FORMAT="${IOS_REVIEW_FORMAT:-json}"
ANALYZERS="${IOS_REVIEW_ANALYZERS:-all}"
CONFIG_PATH="${IOS_REVIEW_CONFIG:-}"
STRICT="${IOS_REVIEW_STRICT:-false}"

# Determine file extension
case "$FORMAT" in
  json)     EXT="json" ;;
  html)     EXT="html" ;;
  markdown) EXT="md" ;;
  *)        EXT="json" ;;
esac

# Create output directory inside the derived data path (persists as artifact)
REPORT_DIR="${CI_DERIVED_DATA_PATH:-/tmp}/ios-review"
mkdir -p "$REPORT_DIR"
REPORT_PATH="${REPORT_DIR}/report.${EXT}"

# ---------------------------
# 4. Run the scan
# ---------------------------
CMD="ios-app-review scan ${PROJECT_PATH} --format ${FORMAT} --output ${REPORT_PATH}"

if [ "$ANALYZERS" != "all" ]; then
  CMD="${CMD} --analyzers ${ANALYZERS}"
fi

if [ -n "$CONFIG_PATH" ]; then
  CMD="${CMD} --config ${CONFIG_PATH}"
fi

echo "Running: ${CMD}"
echo "-----------------------------------------"

set +e
eval "$CMD"
EXIT_CODE=$?
set -e

echo "-----------------------------------------"

# ---------------------------
# 5. Copy report to result bundle for artifact access
# ---------------------------
if [ -n "${CI_RESULT_BUNDLE_PATH:-}" ] && [ -f "$REPORT_PATH" ]; then
  ARTIFACT_DIR="${CI_RESULT_BUNDLE_PATH}/ios-review"
  mkdir -p "$ARTIFACT_DIR"
  cp "$REPORT_PATH" "$ARTIFACT_DIR/"
  echo "Report copied to result bundle: ${ARTIFACT_DIR}/report.${EXT}"
fi

# ---------------------------
# 6. Print summary
# ---------------------------
if [ -f "$REPORT_PATH" ]; then
  echo ""
  echo "--- iOS App Review Report ---"
  if [ "$FORMAT" = "json" ] && command -v python3 &>/dev/null; then
    python3 -c "
import json, sys
with open('${REPORT_PATH}') as f:
    report = json.load(f)
summary = report.get('summary', {})
print(f\"  Total Issues: {summary.get('totalIssues', 'N/A')}\")
print(f\"  Errors:       {summary.get('errors', 'N/A')}\")
print(f\"  Warnings:     {summary.get('warnings', 'N/A')}\")
print(f\"  Info:         {summary.get('info', 'N/A')}\")
print(f\"  Status:       {'PASSED' if summary.get('passed') else 'FAILED'}\")
" 2>/dev/null || cat "$REPORT_PATH"
  else
    cat "$REPORT_PATH"
  fi
  echo "--- End Report ---"
  echo ""
  echo "Full report: ${REPORT_PATH}"
fi

# ---------------------------
# 7. Handle exit code
# ---------------------------
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "iOS App Review: PASSED"
elif [ "$EXIT_CODE" -eq 1 ]; then
  echo "iOS App Review: Issues found"
  if [ "$STRICT" = "true" ]; then
    echo "Strict mode enabled - failing the build."
    exit 1
  else
    echo "Strict mode disabled - continuing despite issues."
    echo "Set IOS_REVIEW_STRICT=true to fail on issues."
    exit 0
  fi
else
  echo "iOS App Review: Error (exit code ${EXIT_CODE})"
  exit "$EXIT_CODE"
fi
