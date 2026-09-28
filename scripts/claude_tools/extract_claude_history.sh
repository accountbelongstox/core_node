#!/usr/bin/env bash
# Extract Claude Code chat history (prompts + full chat record) into text files
# under the Claude user data directory.
#
# Thin wrapper around extract_claude_history.py. All extra args are forwarded:
#   ./extract_claude_history.sh                 # current project (cwd)
#   ./extract_claude_history.sh --all-projects  # every project
#   ./extract_claude_history.sh --thinking --full-tools
#
# Output (default): ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/history-export/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="$(command -v python3 || command -v python)"

if [ -z "${PY:-}" ]; then
    echo "error: python3 not found on PATH" >&2
    exit 1
fi

exec "$PY" "$SCRIPT_DIR/extract_claude_history.py" "$@"
