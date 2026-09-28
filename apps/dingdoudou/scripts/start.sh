#!/usr/bin/env bash

set -Euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd -- "$(dirname -- "$SCRIPT_PATH")" && pwd -P)"
APP_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
PNPM_VERSION="10.32.0"
PNPM_SPEC="pnpm@$PNPM_VERSION"
PNPM_CMD=""
NPM_CMD=""
COREPACK_CMD=""
CURRENT_DIR="$(pwd -P)"

restore_directory() {
  cd -- "$CURRENT_DIR"
}

resolve_tool() {
  command -v -- "$1" 2>/dev/null
}

trap restore_directory EXIT

printf '\n'
printf '%s\n' '========================================'
printf '%s\n' '  DingDuoDuo - Build'
printf '%s\n' '========================================'
printf '[INFO] App directory: %s\n' "$APP_DIR"

cd -- "$APP_DIR"

PNPM_CMD="$(resolve_tool pnpm)"
NPM_CMD="$(resolve_tool npm)"
COREPACK_CMD="$(resolve_tool corepack)"
set -e
if [[ -z "$PNPM_CMD" ]]; then
  if [[ -n "$COREPACK_CMD" ]]; then
    printf '[INFO] Installing pnpm %s through Corepack.\n' "$PNPM_VERSION"
    "$COREPACK_CMD" enable pnpm
    "$COREPACK_CMD" install --global "$PNPM_SPEC"
    PNPM_CMD="pnpm"
  fi
fi

if [[ -z "$PNPM_CMD" ]]; then
  : "${NPM_CMD:?Node.js and npm are required.}"
  printf '[INFO] Installing pnpm %s through npm.\n' "$PNPM_VERSION"
  "$NPM_CMD" install --global "$PNPM_SPEC"
  PNPM_CMD="pnpm"
fi

: "${PNPM_CMD:?pnpm is unavailable.}"
printf '[INFO] Using pnpm: %s\n' "$PNPM_CMD"

printf '%s\n' '[INFO] Repairing dependency links from the lock file.'
"$PNPM_CMD" install --frozen-lockfile

printf '%s\n' '[INFO] Building the extension.'
"$PNPM_CMD" run build
printf '%s\n' '[SUCCESS] Build command completed.'
