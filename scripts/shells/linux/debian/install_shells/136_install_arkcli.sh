#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using Split-Path, Join-Path, or Resolve-Path.
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Volcano Engine Ark CLI (arkcli) installation. Official Volcano Ark MaaS toolbox CLI
# (model chat, image/video gen, OCR, fine-tune, deploy, billing, agent skill injection).
# npm is the sole official channel. Installed via the shared npm global (same pattern as
# pnpm/yarn in 15_install_node_24.sh) so it lands in NODE_BIN_DIR for ALL users.
# Official sources:
#   https://github.com/volcengine/ark-cli   (npm: @volcengine/ark-cli)
# After install: `arkcli auth login volc-sso` then `arkcli +connect` to sync Ark Skills.
# Idempotent: skipped when `arkcli --version` already works.

SCRIPT_INDEX="136"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Declare all variables at the beginning
ARK_EXEC="arkcli"
ARK_NPM_PACKAGE="@volcengine/ark-cli"
NPM_BIN_RESOLVED=""

# Resolve npm: prefer the shared Node npm (lands in shared NODE_BIN_DIR for all users),
# fall back to PATH. Returns the npm binary path or empty.
resolve_npm_bin() {
    if [ -n "$NPM_BIN" ] && [ -x "$NPM_BIN" ]; then
        echo "$NPM_BIN"
    elif command -v npm >/dev/null 2>&1; then
        command -v npm
    else
        echo ""
    fi
}

echo "[$SCRIPT_INDEX] ============================================================"
echo "[$SCRIPT_INDEX] Install Volcano Engine Ark CLI ($ARK_EXEC) via npm"
echo "[$SCRIPT_INDEX] ============================================================"

# Idempotent: skip if arkcli already works (anywhere on PATH).
if command -v "$ARK_EXEC" >/dev/null 2>&1 && timeout 20 "$ARK_EXEC" --version >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] [SKIP] $ARK_EXEC already installed: $(command -v "$ARK_EXEC") ($("$ARK_EXEC" --version 2>/dev/null | head -1))"
    exit 0
fi

NPM_BIN_RESOLVED="$(resolve_npm_bin)"
if [ -z "$NPM_BIN_RESOLVED" ]; then
    echo "[$SCRIPT_INDEX] [ERROR] npm not found. Run 15_install_node_24.sh first."
    exit 1
fi
echo "[$SCRIPT_INDEX] Using npm: $NPM_BIN_RESOLVED"

echo "[$SCRIPT_INDEX] Installing $ARK_NPM_PACKAGE (global)..."
if ! "$NPM_BIN_RESOLVED" install -g "$ARK_NPM_PACKAGE"; then
    echo "[$SCRIPT_INDEX] [ERROR] npm install failed for $ARK_NPM_PACKAGE."
    exit 1
fi

# Verify: arkcli lands in the shared NODE_BIN_DIR (on PATH via /etc/environment) or PATH.
if command -v "$ARK_EXEC" >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] [OK] $ARK_EXEC ready: $(command -v "$ARK_EXEC") ($("$ARK_EXEC" --version 2>/dev/null | head -1))"
elif [ -n "$NODE_BIN_DIR" ] && [ -x "$NODE_BIN_DIR/$ARK_EXEC" ]; then
    echo "[$SCRIPT_INDEX] [OK] $ARK_EXEC installed at $NODE_BIN_DIR/$ARK_EXEC (re-login to pick up PATH)."
else
    echo "[$SCRIPT_INDEX] [WARN] $ARK_EXEC not on PATH yet; restart your shell or source /etc/environment."
fi

echo "[$SCRIPT_INDEX] Volcano Ark CLI installation step completed."
