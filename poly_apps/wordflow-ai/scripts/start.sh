#!/usr/bin/env bash
# wordflow-ai start script (Linux). Optional first argument: Port.
# Usage: ./start.sh [Port]

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

PORT="${1:-3000}"
if [[ -n "$1" ]] && [[ "$1" =~ ^[0-9]+$ ]]; then
PORT="$1"
fi

if [[ ! -f "package.json" ]]; then
    echo "[wordflow-ai] package.json not found in $APP_DIR" >&2
    exit 1
fi

if [[ ! -d "node_modules" ]]; then
    echo "[wordflow-ai] Installing pnpm dependencies..."
    pnpm install
fi

echo "[wordflow-ai] Starting dev server (Port: $PORT)"
exec pnpm run dev -- --port "$PORT"
