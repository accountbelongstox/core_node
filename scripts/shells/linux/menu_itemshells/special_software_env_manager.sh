#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

PYTHON_COMMAND=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LINUX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SHELLS_DIR="$(cd "$LINUX_DIR/.." && pwd)"
SCRIPTS_DIR="$(cd "$SHELLS_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
PYTOOLS_DIR="$SCRIPTS_DIR/pytools"
MANAGER_DIR="$PYTOOLS_DIR/special_software_env_manager"
MAIN_SCRIPT="$MANAGER_DIR/main.py"

find_python_command() {
    if command -v python3 >/dev/null 2>&1; then
        PYTHON_COMMAND="python3"
        return 0
    fi

    if command -v python >/dev/null 2>&1; then
        PYTHON_COMMAND="python"
        return 0
    fi

    return 1
}

launch_special_env_manager() {
    echo "Special Software Environment Variables Manager"
    echo "================================================"

    if ! find_python_command; then
        echo "Error: Python not found in PATH."
        echo "Please install Python 3.6 or newer to continue."
        return 1
    fi

    if [ ! -f "$MAIN_SCRIPT" ]; then
        echo "Error: Python manager not found."
        echo "Expected at: $MAIN_SCRIPT"
        return 1
    fi

    echo "Using Python command: $PYTHON_COMMAND"
    echo "Launching manager from: $MAIN_SCRIPT"
    echo ""

    (cd "$PROJECT_ROOT" && "$PYTHON_COMMAND" "$MAIN_SCRIPT")
}

launch_special_env_manager
