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

# Qwen Code (qwen CLI) installation. Official Alibaba/QwenLM coding agent CLI.
# Installed via the shared npm global (the same pattern used for pnpm/yarn in
# 16_install_node_24.sh), so it lands in the shared NODE_BIN_DIR and is available to
# ALL users. 16_install_node_24.sh chmod-777s the node dir so non-root users can run
# `npm install -g` too. Official sources:
#   https://github.com/QwenLM/qwen-code   (npm: @qwen-code/qwen-code)
# Alternative official installer (per-user, ~/.local/bin):
#   curl -fsSL https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen-standalone.sh | bash
# Idempotent: skipped when `qwen --version` already works.

SCRIPT_INDEX="136"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Declare all variables at the beginning
QWEN_EXEC="qwen"
QWEN_NPM_PACKAGE="@qwen-code/qwen-code"
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
echo "[$SCRIPT_INDEX] Install Qwen Code ($QWEN_EXEC CLI) via npm"
echo "[$SCRIPT_INDEX] ============================================================"

if [ "$(get_global_var "SKIP_LARGE_MODELS" "false")" = "true" ]; then
    echo "[$SCRIPT_INDEX] [SKIP] Server environment without desktop and GPU detected. Skipping Qwen Code installation."
    return 0
fi

# Idempotent: skip if qwen already works (anywhere on PATH).
if command -v "$QWEN_EXEC" >/dev/null 2>&1 && timeout 20 "$QWEN_EXEC" --version >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] [SKIP] $QWEN_EXEC already installed: $(command -v "$QWEN_EXEC") ($("$QWEN_EXEC" --version 2>/dev/null | head -1))"
    return 0
fi

NPM_BIN_RESOLVED="$(resolve_npm_bin)"
if [ -z "$NPM_BIN_RESOLVED" ]; then
    echo "[$SCRIPT_INDEX] [ERROR] npm not found. Run 16_install_node_24.sh first."
    return
fi
echo "[$SCRIPT_INDEX] Using npm: $NPM_BIN_RESOLVED"

echo "[$SCRIPT_INDEX] Installing $QWEN_NPM_PACKAGE (global)..."
if ! "$NPM_BIN_RESOLVED" install -g "$QWEN_NPM_PACKAGE"; then
    echo "[$SCRIPT_INDEX] [ERROR] npm install failed for $QWEN_NPM_PACKAGE."
    return
fi

# Verify: qwen lands in the shared NODE_BIN_DIR (on PATH via /etc/environment) or PATH.
if command -v "$QWEN_EXEC" >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] [OK] $QWEN_EXEC ready: $(command -v "$QWEN_EXEC") ($("$QWEN_EXEC" --version 2>/dev/null | head -1))"
elif [ -n "$NODE_BIN_DIR" ] && [ -x "$NODE_BIN_DIR/$QWEN_EXEC" ]; then
    echo "[$SCRIPT_INDEX] [OK] $QWEN_EXEC installed at $NODE_BIN_DIR/$QWEN_EXEC (re-login to pick up PATH)."
else
    echo "[$SCRIPT_INDEX] [WARN] $QWEN_EXEC not on PATH yet; restart your shell or source /etc/environment."
fi

echo "[$SCRIPT_INDEX] Qwen Code installation step completed."
