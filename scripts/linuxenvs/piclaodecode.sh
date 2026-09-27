#!/bin/bash

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_CURRENT_DIR=""
PI_YOLO_PATH=""
MODE="claude"

if [ -L "$SCRIPT_SOURCE" ]; then
    SCRIPT_SOURCE="$(readlink -f "$SCRIPT_SOURCE" 2>/dev/null || echo "$SCRIPT_SOURCE")"
fi
SCRIPT_CURRENT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
PI_YOLO_PATH="$SCRIPT_CURRENT_DIR/piyolo.sh"

"$PI_YOLO_PATH" "$MODE" "$@"
