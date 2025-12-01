#!/bin/bash

# Source global variables (relative to repo layout)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
GVAR_COMMON_PATH="$CORE_NODE_ROOT/scripts/shells/linux/common/gvar_common.sh"

if [ -f "$GVAR_COMMON_PATH" ]; then
    source "$GVAR_COMMON_PATH"
else
    echo "Error: gvar_common.sh not found at $GVAR_COMMON_PATH"
    exit 1
fi

echo "========================================"
echo "Claude Launcher (Temporary Script 2)"
echo "========================================"

COMPILE_DIR=$(map_web_path "compile_dir")
echo "COMPILE_DIR: $COMPILE_DIR"

NODE_INSTALL_DIR="$COMPILE_DIR/node"
NODE_VERSION="v22.21.0"
NODE_BIN_DIR="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin"

echo "NODE_INSTALL_DIR: $NODE_INSTALL_DIR"
echo "NODE_BIN_DIR: $NODE_BIN_DIR"

CLAUDE_PATH=""
NODE_BIN=""

if [ -f "$NODE_BIN_DIR/claude" ]; then
    CLAUDE_PATH="$NODE_BIN_DIR/claude"
else
    echo "Searching for claude in node installation..."
    POSSIBLE_PATHS=(
        "$NODE_BIN_DIR/lib/node_modules/@anthropics/claude-cli/bin/claude"
        "$NODE_BIN_DIR/lib/node_modules/claude/bin/claude"
        "$NODE_INSTALL_DIR/node-$NODE_VERSION/lib/node_modules/@anthropics/claude-cli/bin/claude"
        "$NODE_INSTALL_DIR/node-$NODE_VERSION/lib/node_modules/claude/bin/claude"
        "$COMPILE_DIR/lib/node_modules/@anthropics/claude-cli/bin/claude"
        "$COMPILE_DIR/lib/node_modules/claude/bin/claude"
    )

    for path in "${POSSIBLE_PATHS[@]}"; do
        if [ -f "$path" ]; then
            CLAUDE_PATH="$path"
            echo "Found claude at: $CLAUDE_PATH"
            break
        fi
    done
fi

if [ -z "$CLAUDE_PATH" ] || [ ! -f "$CLAUDE_PATH" ]; then
    echo "Error: claude not found in expected locations"
    echo "Attempted paths:"
    echo "  - $NODE_BIN_DIR/claude"
    for path in "${POSSIBLE_PATHS[@]}"; do
        echo "  - $path"
    done
    echo ""
    echo "Please install claude first with: npm install -g @anthropics/claude-cli"
    exit 1
fi

if [ -f "$NODE_BIN_DIR/node" ]; then
    NODE_BIN="$NODE_BIN_DIR/node"
elif [ -f "$NODE_INSTALL_DIR/node-$NODE_VERSION/bin/node" ]; then
    NODE_BIN="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin/node"
else
    NODE_BIN=$(which node 2>/dev/null)
    if [ -z "$NODE_BIN" ]; then
        echo "Error: node not found"
        exit 1
    fi
    echo "Using system node: $NODE_BIN"
fi

# API configuration for 88code
export ANTHROPIC_API_KEY="88_3788a12e1e455efc96b09d29fb7b4281d0524a4dcc5cd95046ee2d0ffc402352"
export ANTHROPIC_AUTH_TOKEN="$ANTHROPIC_API_KEY"
export ANTHROPIC_BASE_URL="https://www.88code.org/api"

echo ""
echo "Configuration:"
echo "  Node Binary: $NODE_BIN"
echo "  Claude Path: $CLAUDE_PATH"
echo "  API Key: $ANTHROPIC_API_KEY"
echo "  Auth Token: $ANTHROPIC_AUTH_TOKEN"
echo "  Base URL: $ANTHROPIC_BASE_URL"
echo "========================================"
echo ""

$USE_SUDO ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" ANTHROPIC_AUTH_TOKEN="$ANTHROPIC_AUTH_TOKEN" ANTHROPIC_BASE_URL="$ANTHROPIC_BASE_URL" "$NODE_BIN" "$CLAUDE_PATH" "$@"


