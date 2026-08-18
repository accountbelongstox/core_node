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

# Zhipu publishes a Python SDK but no first-party CLI binary. This step installs
# the SDK only when pip metadata is absent and otherwise preserves it.

SCRIPT_INDEX="138"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
ZHIPU_PACKAGE="zhipuai"
PYTHON_BIN_RESOLVED=""
ZHIPU_METADATA=""

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

resolve_python_bin() {
    local resolved=""
    if [ -n "$PYTHON_BIN" ] && [ -x "$PYTHON_BIN" ]; then
        resolved="$PYTHON_BIN"
    elif command -v python3 >/dev/null 2>&1; then
        resolved="$(command -v python3)"
    elif command -v python >/dev/null 2>&1; then
        resolved="$(command -v python)"
    fi
    printf '%s' "$resolved"
}

echo "[$SCRIPT_INDEX] ============================================================"
echo "[$SCRIPT_INDEX] Install Zhipu AI official Python SDK"
echo "[$SCRIPT_INDEX] ============================================================"


PYTHON_BIN_RESOLVED="$(resolve_python_bin)"
if [ -z "$PYTHON_BIN_RESOLVED" ]; then
    echo "[$SCRIPT_INDEX] [!] Python is unavailable; retrying after Python setup."
else
    echo "[$SCRIPT_INDEX] Using python: $PYTHON_BIN_RESOLVED"
    ZHIPU_METADATA="$("$PYTHON_BIN_RESOLVED" -m pip show "$ZHIPU_PACKAGE" 2>/dev/null || true)"
    if [[ "$ZHIPU_METADATA" == *"Name:"* ]]; then
        echo "[$SCRIPT_INDEX] [SKIP] $ZHIPU_PACKAGE metadata is present; preserving the installed package."
    else
        echo "[$SCRIPT_INDEX] Installing missing $ZHIPU_PACKAGE SDK via pip..."
        "$PYTHON_BIN_RESOLVED" -m pip install "$ZHIPU_PACKAGE" || true
        ZHIPU_METADATA="$("$PYTHON_BIN_RESOLVED" -m pip show "$ZHIPU_PACKAGE" 2>/dev/null || true)"
        if [[ "$ZHIPU_METADATA" == *"Name:"* ]]; then
            echo "[$SCRIPT_INDEX] [OK] $ZHIPU_PACKAGE metadata is ready."
        else
            echo "[$SCRIPT_INDEX] [!] $ZHIPU_PACKAGE metadata is still missing; retrying next run."
        fi
    fi
fi
