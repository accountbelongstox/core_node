#!/usr/bin/env sh
# md_preview launcher: save cwd, install deps if needed, start preview, then restore cwd
INITIAL_DIR="$(pwd)"
cd "$(dirname "$0")" || exit 1
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install --no-fund --no-audit
  [ $? -ne 0 ] && exit 1
fi
trap 'cd "$INITIAL_DIR"' EXIT
node index.js "$@"
