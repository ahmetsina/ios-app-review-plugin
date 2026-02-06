#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------
# iOS App Review - Bitrise Step
# Installs Node.js + ios-app-review-plugin, runs
# the scan, and exports outputs.
# -----------------------------------------------

echo "--- iOS App Review Step ---"

# ---------------------------
# 1. Ensure Node.js is available
# ---------------------------
NODE_REQUIRED_MAJOR="${node_version:-20}"

install_node() {
  echo "Installing Node.js ${NODE_REQUIRED_MAJOR}..."
  if command -v brew &>/dev/null; then
    brew install "node@${NODE_REQUIRED_MAJOR}" || brew upgrade "node@${NODE_REQUIRED_MAJOR}" || true
    brew link --overwrite "node@${NODE_REQUIRED_MAJOR}" 2>/dev/null || true
  elif command -v nvm &>/dev/null; then
    nvm install "${NODE_REQUIRED_MAJOR}"
    nvm use "${NODE_REQUIRED_MAJOR}"
  else
    # Fallback: install via NodeSource setup script
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_REQUIRED_MAJOR}.x" | bash -
    apt-get install -y nodejs
  fi
}

if command -v node &>/dev/null; then
  CURRENT_MAJOR=$(node -p "process.versions.node.split('.')[0]")
  if [ "$CURRENT_MAJOR" -lt "$NODE_REQUIRED_MAJOR" ]; then
    echo "Node.js ${CURRENT_MAJOR} found but ${NODE_REQUIRED_MAJOR}+ required."
    install_node
  else
    echo "Node.js $(node --version) found."
  fi
else
  install_node
fi

echo "Using Node.js $(node --version)"
echo "Using npm $(npm --version)"

# ---------------------------
# 2. Install ios-app-review-plugin
# ---------------------------
PLUGIN_VERSION="${plugin_version:-latest}"
echo "Installing ios-app-review-plugin@${PLUGIN_VERSION}..."
npm install -g "ios-app-review-plugin@${PLUGIN_VERSION}"

# ---------------------------
# 3. Configure scan parameters
# ---------------------------
PROJECT_PATH="${project_path:-$BITRISE_SOURCE_DIR}"
FORMAT="${format:-json}"
ANALYZERS="${analyzers:-all}"
CONFIG_PATH="${config_path:-}"

# Determine file extension
case "$FORMAT" in
  json)     EXT="json" ;;
  html)     EXT="html" ;;
  markdown) EXT="md" ;;
  *)        EXT="json" ;;
esac

REPORT_DIR="${BITRISE_DEPLOY_DIR:-/tmp}/ios-review"
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

set +e
eval "$CMD"
EXIT_CODE=$?
set -e

# ---------------------------
# 5. Export outputs
# ---------------------------
envman add --key IOS_REVIEW_EXIT_CODE --value "${EXIT_CODE}"
envman add --key IOS_REVIEW_REPORT_PATH --value "${REPORT_PATH}"

# ---------------------------
# 6. Print summary
# ---------------------------
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "iOS App Review scan PASSED. No blocking issues found."
elif [ "$EXIT_CODE" -eq 1 ]; then
  echo "iOS App Review scan found issues. See report: ${REPORT_PATH}"
else
  echo "iOS App Review scan encountered an error (exit code: ${EXIT_CODE})."
fi

# Print report contents for build log
if [ -f "$REPORT_PATH" ]; then
  echo ""
  echo "--- Report Summary ---"
  if [ "$FORMAT" = "json" ]; then
    # Pretty-print JSON summary if jq is available
    if command -v jq &>/dev/null; then
      jq '.summary' "$REPORT_PATH" 2>/dev/null || cat "$REPORT_PATH"
    else
      cat "$REPORT_PATH"
    fi
  else
    cat "$REPORT_PATH"
  fi
  echo "--- End Report ---"
fi

exit "$EXIT_CODE"
