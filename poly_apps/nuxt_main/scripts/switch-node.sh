#!/bin/bash

set -e

# List of versions to choose from
NODE_VERSIONS=("16" "17" "18" "19" "20" "21" "22")

# Check if npx is available
if ! command -v npx >/dev/null 2>&1; then
  echo "???'npx' is not installed or not found in PATH."
  exit 1
fi

# Display selection menu
echo "???? Select Node.js version to switch to:"
select VERSION in "${NODE_VERSIONS[@]}"; do
  if [[ -n "$VERSION" ]]; then
    echo "???Switching to Node.js v$VERSION using npx..."
    sudo npx n "$VERSION"
    echo "???Node.js switched to version:"
    node -v
    break
  else
    echo "???Invalid selection. Try again."
  fi
done
