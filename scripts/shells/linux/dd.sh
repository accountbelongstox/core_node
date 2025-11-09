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

# Main Execution
echo ""
echo "Special Software Environment Variables Manager"
echo "============================================="
echo ""
echo "Starting Python implementation..."
echo "Location: $MANAGER_DIR"
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

# Check if the script exists
if [ ! -f "$MAIN_SCRIPT" ]; then
    echo "ERROR: Python script not found"
    echo "Expected location: $MAIN_SCRIPT"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Run the Python script
cd "$PROJECT_ROOT"
$PYTHON_CMD "$MAIN_SCRIPT"
