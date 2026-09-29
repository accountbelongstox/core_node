#!/bin/bash
# Caddy scanner launcher: checks Node.js, then starts caddy_scanner.js on a port.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCANNER_SCRIPT="$SCRIPT_DIR/caddy_scanner.js"
PORT="${1:-8080}"

echo "Starting the Caddy scanner..."

if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed; install Node.js first"
    exit 1
fi

if [ ! -f "$SCANNER_SCRIPT" ]; then
    echo "Error: scanner script not found: $SCANNER_SCRIPT"
    exit 1
fi

echo "Configuration:"
echo "   - Scanner script: $SCANNER_SCRIPT"
echo "   - Port: $PORT"
echo "   - Started at: $(date)"
echo ""
echo "Starting the Caddy scanner web service..."
echo "   URL: http://localhost:$PORT"
echo "   Press Ctrl+C to stop"
echo ""

node "$SCANNER_SCRIPT" "$PORT"
