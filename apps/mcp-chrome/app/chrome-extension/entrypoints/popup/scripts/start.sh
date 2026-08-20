#!/usr/bin/env bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Popup dev helper: pnpm install + wxt dev, open browser debug pages, restore cwd.

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

echo "[*] pnpm install (live output)"
echo "----------------------------------------"
pnpm install
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
echo "[*] pnpm run dev (wxt) - press Ctrl+C to stop"
echo "----------------------------------------"
pnpm run dev
echo "----------------------------------------"
echo ""
