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

# Zhipu AI (智谱AI / bigmodel.cn) official package installation.
# NOTE: Zhipu ships NO first-party CLI binary (verified via official sources: the
# github.com/zhipuai org has only a Java SDK and a Python SDK; the PyPI `zhipuai`
# package is a Python SDK with no console entry point -- there is no `zhipu`/`glm`
# command). This step therefore installs the official `zhipuai` Python SDK (idempotent)
# so `from zhipuai import ZhipuAI` works. For a coding-agent experience on Zhipu, use
# the existing claudezhipu launcher (Claude Code pointed at Zhipu's Anthropic-compatible
# /api/anthropic endpoint) -- that is the official integration surface.
# Official sources:
#   https://github.com/zhipuai   https://open.bigmodel.cn   (PyPI: zhipuai)

SCRIPT_INDEX="137"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Declare all variables at the beginning
ZHIPU_PACKAGE="zhipuai"
PYTHON_BIN_RESOLVED=""

# Resolve python: prefer the project python, then python3, then python.
# Returns the python binary path or empty.
resolve_python_bin() {
    if [ -n "$PYTHON_BIN" ] && [ -x "$PYTHON_BIN" ]; then
        echo "$PYTHON_BIN"
    elif command -v python3 >/dev/null 2>&1; then
        echo "$(command -v python3)"
    elif command -v python >/dev/null 2>&1; then
        echo "$(command -v python)"
    else
        echo ""
    fi
}

echo "[$SCRIPT_INDEX] ============================================================"
echo "[$SCRIPT_INDEX] Install Zhipu AI official package ($ZHIPU_PACKAGE SDK) via pip"
echo "[$SCRIPT_INDEX] ============================================================"
echo "[$SCRIPT_INDEX] NOTE: Zhipu has no first-party CLI; installing the official Python SDK."
echo "[$SCRIPT_INDEX]       For a Zhipu coding agent, use the claudezhipu launcher."

# Idempotent: skip if the zhipuai SDK is already importable.
PYTHON_BIN_RESOLVED="$(resolve_python_bin)"
if [ -z "$PYTHON_BIN_RESOLVED" ]; then
    echo "[$SCRIPT_INDEX] [ERROR] python not found. Run 13_ensure_python.sh first."
    exit 1
fi
echo "[$SCRIPT_INDEX] Using python: $PYTHON_BIN_RESOLVED"

if "$PYTHON_BIN_RESOLVED" -c "import zhipuai" >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] [SKIP] $ZHIPU_PACKAGE SDK already installed ($("$PYTHON_BIN_RESOLVED" -c 'import zhipuai; print(getattr(zhipuai,"__version__","unknown"))' 2>/dev/null))."
    exit 0
fi

echo "[$SCRIPT_INDEX] Installing $ZHIPU_PACKAGE (pip, --upgrade)..."
if ! "$PYTHON_BIN_RESOLVED" -m pip install --upgrade "$ZHIPU_PACKAGE"; then
    echo "[$SCRIPT_INDEX] [ERROR] pip install failed for $ZHIPU_PACKAGE."
    exit 1
fi

# Verify: the SDK must now import.
if "$PYTHON_BIN_RESOLVED" -c "import zhipuai" >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] [OK] $ZHIPU_PACKAGE SDK ready: $("$PYTHON_BIN_RESOLVED" -c 'import zhipuai; print(getattr(zhipuai,"__version__","unknown"))' 2>/dev/null)"
else
    echo "[$SCRIPT_INDEX] [ERROR] $ZHIPU_PACKAGE import failed after install."
    exit 1
fi

echo "[$SCRIPT_INDEX] Zhipu AI package installation step completed."
