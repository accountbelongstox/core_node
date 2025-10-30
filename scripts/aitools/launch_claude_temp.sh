#!/bin/bash

# Source global variables
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
echo "Claude Launcher (Temporary Script)"
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

API_KEY_PART1="cr_74f1"
API_KEY_PART2="93cc3125"
API_KEY_PART3="e1d31ccd"
API_KEY_PART4="d059dc88"
API_KEY_PART5="6105d595"
API_KEY_PART6="3eb6d3f5"
API_KEY_PART7="555505de"
API_KEY_PART8="e94794633527"
COMBINED_API_KEY="${API_KEY_PART1}${API_KEY_PART2}${API_KEY_PART3}${API_KEY_PART4}${API_KEY_PART5}${API_KEY_PART6}${API_KEY_PART7}${API_KEY_PART8}"

export ANTHROPIC_API_KEY="$COMBINED_API_KEY"
export ANTHROPIC_AUTH_TOKEN="$COMBINED_API_KEY"
export ANTHROPIC_BASE_URL="http://claudeaicode.xyz/api"

echo ""
echo "Configuration:"
echo "  Node Binary: $NODE_BIN"
echo "  Claude Path: $CLAUDE_PATH"
echo "  API Key: ${ANTHROPIC_API_KEY:0:20}..."
echo "  Auth Token: ${ANTHROPIC_AUTH_TOKEN:0:20}..."
echo "  Base URL: $ANTHROPIC_BASE_URL"
echo "========================================"
echo ""

$USE_SUDO ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" ANTHROPIC_AUTH_TOKEN="$ANTHROPIC_AUTH_TOKEN" ANTHROPIC_BASE_URL="$ANTHROPIC_BASE_URL" "$NODE_BIN" "$CLAUDE_PATH" "$@"
