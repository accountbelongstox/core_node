#!/bin/bash
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

# =============================================================================
# Set Special Software Environment Variables (Python Implementation)
# =============================================================================
#
# Synopsis:
#     Launcher for the Python-based Special Software Environment Manager
#
# Description:
#     This replaces the original PowerShell-only implementation with a
#     cross-platform Python implementation that works on both Windows and Linux.
#
# Notes:
#     - Calls: scripts/pytools/special_software_env_manager
#     - Platform: Linux (Bash)
#     - Target: Python implementation
# =============================================================================

set -e

# Variable Declarations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHELLS_DIR="$(dirname "$SCRIPT_DIR")"
SCRIPTS_DIR="$(dirname "$SHELLS_DIR")"
PROJECT_ROOT="$(dirname "$SCRIPTS_DIR")"
PYTOOLS_DIR="$SCRIPTS_DIR/pytools"
MANAGER_DIR="$PYTOOLS_DIR/special_software_env_manager"
MAIN_SCRIPT="$MANAGER_DIR/main.py"
DD_HELPER_DIR="$SCRIPT_DIR/dd_helper"
SECRET_FUNCTIONS="$DD_HELPER_DIR/secret_functions.sh"
COMMON_DIR="$SCRIPT_DIR/common"
GVAR_COMMON="$COMMON_DIR/gvar_common.sh"

# Load gvar_common.sh to get NODE_BIN and other paths (trust-based)
source "$GVAR_COMMON"

# Main Execution
echo ""
echo "Special Software Environment Variables Manager"
echo "============================================="
echo ""

# Check and decrypt secret keys before starting (trust-based)
# Set CORE_NODE_ROOT_DIR for secret_functions.sh
CORE_NODE_ROOT_DIR="$PROJECT_ROOT"

# Source and run secret key check
source "$SECRET_FUNCTIONS"

# Check and handle secrets (decrypt missing files, re-encrypt updated files)
ensure_secret_keys_ready

echo ""

# Pause before showing menu (like Windows version)
echo -e "\033[33mPress Enter to continue, or any other key to pause (auto-continue in 3 seconds)...\033[0m"
echo -ne "\033[36mAuto-continuing in \033[0m"

# Countdown with non-blocking key check
for i in 3 2 1; do
    echo -ne "\033[36m$i \033[0m"

    # Check if key is available (non-blocking)
    if read -t 1 -n 1 key; then
        echo ""
        if [ "$key" = "" ]; then
            # Enter pressed - continue immediately
            break
        else
            # Any other key pauses
            echo -e "\033[36mPaused. Press Enter to continue...\033[0m"
            read -r
            break
        fi
    fi
done

echo ""
echo ""

# Check if Python is available
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "ERROR: Python not found"
    echo "Please install Python 3.6 or higher"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Starting Python implementation..."
echo "Location: $MANAGER_DIR"
echo "Working Directory: $PROJECT_ROOT"
echo "Python Command: $PYTHON_CMD"
echo "Script: $MAIN_SCRIPT"
echo ""
echo -e "\033[36mFull command:\033[0m"
echo -e "\033[32m  cd $PROJECT_ROOT && $PYTHON_CMD $MAIN_SCRIPT\033[0m"
echo ""

# Pause before running Python (5 seconds auto-continue)
echo -e "\033[33mStarting in 3 seconds (Press Enter to start now, or any key to pause)...\033[0m"
for i in 3 2 1; do
    echo -ne "\033[36m$i \033[0m"
    if read -t 1 -n 1 key; then
        echo ""
        if [ "$key" = "" ]; then
            break
        else
            echo -e "\033[36mPaused. Press Enter to continue...\033[0m"
            read -r
            break
        fi
    fi
done

echo ""
echo ""

# Run the Python script (trust-based)
cd "$PROJECT_ROOT"
$PYTHON_CMD "$MAIN_SCRIPT"
