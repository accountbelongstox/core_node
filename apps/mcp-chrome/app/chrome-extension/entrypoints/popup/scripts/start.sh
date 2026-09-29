#!/usr/bin/env bash

# Popup dev helper: bun install + wxt dev, open browser debug pages, restore cwd.

set +e
set -u

INITIAL_DIR=""
SCRIPT_DIR=""
EXTENSION_ROOT=""

INITIAL_DIR="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
EXTENSION_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd -P)"

cleanup_restore_cwd() {
  cd "${INITIAL_DIR}" 2>/dev/null || true
  echo "[*] Restored directory: ${INITIAL_DIR}"
}

trap cleanup_restore_cwd EXIT

echo ""
echo "========================================"
echo "  chrome-mcp-server popup dev (Unix)"
echo "========================================"
echo ""
echo "[*] Initial directory: ${INITIAL_DIR}"
echo "[*] Extension root:    ${EXTENSION_ROOT}"
echo ""

cd "${EXTENSION_ROOT}" || {
  echo "[!] Failed to change directory to extension root."
}

echo "[*] bun install (live output)"
echo "----------------------------------------"
bun install
echo "----------------------------------------"
echo ""

echo "[*] Opening Chrome extension debug pages (non-blocking)"
if command -v google-chrome-stable >/dev/null 2>&1; then
  google-chrome-stable "chrome://extensions/" >/dev/null 2>&1 &
  google-chrome-stable "chrome://inspect/#extensions" >/dev/null 2>&1 &
elif command -v google-chrome >/dev/null 2>&1; then
  google-chrome "chrome://extensions/" >/dev/null 2>&1 &
  google-chrome "chrome://inspect/#extensions" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  chromium "chrome://extensions/" >/dev/null 2>&1 &
  chromium "chrome://inspect/#extensions" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open -a "Google Chrome" "chrome://extensions/" >/dev/null 2>&1 &
elif [ -n "${WINDIR:-}" ] && command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -Command "Start-Process chrome 'chrome://extensions/'" >/dev/null 2>&1
  powershell.exe -NoProfile -Command "Start-Process chrome 'chrome://inspect/#extensions'" >/dev/null 2>&1
else
  echo "[!] Could not detect Chrome. Open chrome://extensions/ manually."
fi

echo ""
echo "[*] bun run dev (wxt) - press Ctrl+C to stop"
echo "----------------------------------------"
bun run dev
echo "----------------------------------------"
echo ""
