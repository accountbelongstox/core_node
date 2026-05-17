#!/usr/bin/env bash
# wordflow-ai (qy_capacitor): idempotent pnpm install, verify toolchain, then dev server.
# Usage: ./scripts/start.sh [--force|-f]
#        FORCE_INSTALL=1 ./scripts/start.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(dirname "$SCRIPT_DIR")"
ORIGINAL_DIR="$PWD"
PACKAGE_JSON="$APP_ROOT/package.json"
ENV_FILE="$APP_ROOT/.env"
NODE_MODULES="$APP_ROOT/node_modules"

log() { printf '%s\n' "[wordflow-ai] $*"; }
log_err() { printf '%s\n' "[wordflow-ai] $*" >&2; }

INSTALL_FORCE=0
if [[ "${FORCE_INSTALL:-}" == "1" ]]; then
  INSTALL_FORCE=1
fi
for arg in "$@"; do
  case "$arg" in
    --force|-f) INSTALL_FORCE=1 ;;
  esac
done

cd "$APP_ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  log_err "pnpm not found on PATH. Install: npm i -g pnpm  or  corepack enable && corepack prepare pnpm@latest --activate"
  exit 1
fi

if [[ ! -f "$PACKAGE_JSON" ]]; then
  log_err "package.json not found at: $PACKAGE_JSON"
  exit 1
fi

vite_ready() {
  [[ -f "$NODE_MODULES/vite/bin/vite.js" ]]
}

NEED_INSTALL=0
if [[ "$INSTALL_FORCE" -eq 1 ]]; then
  NEED_INSTALL=1
elif [[ ! -d "$NODE_MODULES" ]]; then
  NEED_INSTALL=1
elif [[ -z "$(ls -A "$NODE_MODULES" 2>/dev/null)" ]]; then
  NEED_INSTALL=1
elif ! vite_ready; then
  log "node_modules present but dev toolchain incomplete (e.g. vite missing); running pnpm install."
  NEED_INSTALL=1
fi

if [[ "$NEED_INSTALL" -eq 1 ]]; then
  log "Installing pnpm dependencies (idempotent)..."
  pnpm install
  if ! vite_ready; then
    log_err "pnpm install finished but vite is still missing. Try removing node_modules, then re-run with --force."
    exit 1
  fi
  log "Dependencies ready."
else
  log "Dependencies look complete; skipping install. Use --force to reinstall."
fi

DEV_PORT=3000
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*PORT[[:space:]]*=[[:space:]]*([0-9]+) ]]; then
      DEV_PORT="${BASH_REMATCH[1]}"
      break
    fi
  done <"$ENV_FILE"
fi
DEV_URL="http://localhost:${DEV_PORT}"

(
  sleep 4
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$DEV_URL" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$DEV_URL" >/dev/null 2>&1 || true
  fi
) &

log "Starting dev server (pnpm run dev). Browser may open: $DEV_URL"
EXIT_CODE=0
pnpm run dev || EXIT_CODE=$?
cd "$ORIGINAL_DIR"
log "Restored to original directory: $ORIGINAL_DIR"
exit "$EXIT_CODE"
