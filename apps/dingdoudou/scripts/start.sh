#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd -- "$(dirname -- "$SCRIPT_PATH")" && pwd -P)"
APP_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
PACKAGE_JSON_PATH="$APP_DIR/package.json"
LOCK_FILE_PATH="$APP_DIR/pnpm-lock.yaml"
OUTPUT_DIR="$APP_DIR/.output"
BUILT_DIR="$OUTPUT_DIR/chrome-mv3"
MANIFEST_PATH="$BUILT_DIR/manifest.json"
PNPM_VERSION="10.32.0"
PNPM_CMD=""
NPM_CMD=""
COREPACK_CMD=""
CURRENT_DIR="$(pwd -P)"

restore_directory() {
  cd -- "$CURRENT_DIR"
}

fail() {
  local message="$1"
  printf '[ERROR] %s\n' "$message" >&2
  exit 1
}

resolve_tool() {
  local name="$1"
  command -v -- "$name" 2>/dev/null || true
}

trap restore_directory EXIT

printf '\n'
printf '%s\n' '========================================'
printf '%s\n' '  DingDuoDuo - Compile and Build'
printf '%s\n' '========================================'
printf '[INFO] App directory: %s\n' "$APP_DIR"

[[ -f "$PACKAGE_JSON_PATH" ]] || fail "package.json not found at $PACKAGE_JSON_PATH"

cd -- "$APP_DIR"

PNPM_CMD="$(resolve_tool pnpm)"
if [[ -z "$PNPM_CMD" ]]; then
  COREPACK_CMD="$(resolve_tool corepack)"
  if [[ -n "$COREPACK_CMD" ]]; then
    printf '[INFO] Activating pnpm %s through Corepack.\n' "$PNPM_VERSION"
    "$COREPACK_CMD" enable pnpm || true
    "$COREPACK_CMD" prepare "pnpm@$PNPM_VERSION" --activate || true
    PNPM_CMD="$(resolve_tool pnpm)"
  fi
fi

if [[ -z "$PNPM_CMD" ]]; then
  NPM_CMD="$(resolve_tool npm)"
  [[ -n "$NPM_CMD" ]] || fail 'Node.js and npm are required.'
  printf '[INFO] Installing pnpm %s through npm.\n' "$PNPM_VERSION"
  "$NPM_CMD" install --global "pnpm@$PNPM_VERSION" || fail 'Unable to install pnpm.'
  PNPM_CMD="$(resolve_tool pnpm)"
fi

[[ -n "$PNPM_CMD" ]] || fail 'pnpm is unavailable.'
printf '[INFO] Using pnpm: %s\n' "$PNPM_CMD"

if [[ -f "$LOCK_FILE_PATH" ]]; then
  printf '%s\n' '[INFO] Installing dependencies from the lock file.'
  "$PNPM_CMD" install --frozen-lockfile || fail 'Dependency installation failed.'
else
  printf '%s\n' '[INFO] No lock file found; installing dependencies and creating one.'
  "$PNPM_CMD" install || fail 'Dependency installation failed.'
fi

printf '%s\n' '[INFO] Checking TypeScript types.'
"$PNPM_CMD" run compile || fail 'TypeScript compilation failed.'

printf '[INFO] Building extension into: %s\n' "$OUTPUT_DIR"
"$PNPM_CMD" run build || fail 'Extension build failed.'

[[ -f "$MANIFEST_PATH" ]] || fail "Build completed without producing $MANIFEST_PATH"

printf '[SUCCESS] Build complete: %s\n' "$BUILT_DIR"
