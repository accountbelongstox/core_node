#!/bin/bash

PYTHON_COMMAND=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LINUX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SHELLS_DIR="$(cd "$LINUX_DIR/.." && pwd)"
SCRIPTS_DIR="$(cd "$SHELLS_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
PYTOOLS_DIR="$SCRIPTS_DIR/pytools"
MANAGER_DIR="$PYTOOLS_DIR/special_software_env_manager"
MAIN_SCRIPT="$MANAGER_DIR/special_software_env_manager.py"

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
