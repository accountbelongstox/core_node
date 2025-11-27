#!/bin/bash

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Flutter Bloom Start Script - Linux Entry Point
# Unified launcher that matches Windows start.ps1 functionality
# Uses Python bridge for cross-platform logic

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLUTTER_BLOOM_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_SCRIPTS_DIR="$SCRIPT_DIR/build_scripts"
MAIN_PY="$BUILD_SCRIPTS_DIR/main.py"
START_LAUNCHER_PY="$BUILD_SCRIPTS_DIR/shared/start_launcher.py"
GVAR_EXCHANGE_DIR="$HOME/.core_node/.flutter_build/global_vars"
ORIGINAL_DIR="$(pwd)"

# Save current directory and switch to Flutter Bloom root
cd "$FLUTTER_BLOOM_ROOT" || {
    echo "[ERROR] Failed to change to Flutter Bloom root: $FLUTTER_BLOOM_ROOT"
    exit 1
}

echo "[DEBUG] Script directory: $SCRIPT_DIR"
echo "[DEBUG] Flutter Bloom root: $FLUTTER_BLOOM_ROOT"
echo "[DEBUG] Current working directory: $(pwd)"

# Function to read file variable (matches PowerShell Get-FileVariable)
get_file_variable() {
    local var_name="$1"
    local default_value="${2:-}"
    local var_file="$GVAR_EXCHANGE_DIR/$var_name"

    if [ -f "$var_file" ]; then
        cat "$var_file" | tr -d '\r\n' | xargs
    else
        echo "$default_value"
    fi
}

# Validate Python script exists
if [ ! -f "$MAIN_PY" ]; then
    echo "[ERROR] Python main script not found: $MAIN_PY"
    exit 1
fi

# Execute Python app selection (matches start.ps1 logic)
echo "Flutter Bloom Launcher"
echo "====================="
echo "[INFO] Starting app selection..."
echo "[DEBUG] Python script path: $MAIN_PY"
echo "[DEBUG] Current working directory: $(pwd)"

python3 "$MAIN_PY"
MAIN_EXIT_CODE=$?

echo "[DEBUG] Python script exit code: $MAIN_EXIT_CODE"

if [ $MAIN_EXIT_CODE -ne 0 ]; then
    echo "[ERROR] App selection failed"
    cd "$ORIGINAL_DIR"
    exit 1
fi

echo "[DEBUG] Python script completed successfully, continuing to execution..."

# Read action to determine mode (matches start.ps1 logic)
SELECTED_ACTION=$(get_file_variable "KEY_SELECTED_ACTION" "")

echo "[DEBUG] Selected action from Python: '$SELECTED_ACTION'"

if [ -z "$SELECTED_ACTION" ]; then
    echo "[ERROR] No action selected from Python"
    cd "$ORIGINAL_DIR"
    exit 1
fi

# Route based on action (matches start.ps1 routing logic)
echo "[DEBUG] Routing to appropriate mode..."

if [ "${SELECTED_ACTION,,}" = "debug" ]; then
    echo "[DEBUG] Debug mode detected"

    # Get debug script path from variables
    SCRIPT_PATH=$(get_file_variable "KEY_SCRIPT_PATH" "")

    echo "[DEBUG] Script path from variables: '$SCRIPT_PATH'"

    if [ -n "$SCRIPT_PATH" ] && [ -f "$SCRIPT_PATH" ]; then
        echo "[INFO] Starting debug mode..."
        echo "[DEBUG] Executing debug script: $SCRIPT_PATH"

        # Execute debug script
        bash "$SCRIPT_PATH"

        echo "[SUCCESS] Debug script execution completed"
    else
        echo "[ERROR] Debug script not found: $SCRIPT_PATH"
        cd "$ORIGINAL_DIR"
        exit 1
    fi

elif [ "${SELECTED_ACTION,,}" = "build" ] || [ "${SELECTED_ACTION,,}" = "release" ]; then
    echo "[DEBUG] Build mode detected"
    echo "[INFO] Build mode completed by main.py"

elif [ "${SELECTED_ACTION,,}" = "design_tool" ]; then
    echo "[DEBUG] Design tool mode detected"

    # Execute Python start launcher to prepare design tool
    if [ -f "$START_LAUNCHER_PY" ]; then
        echo "[INFO] Launching design tool via Python bridge..."
        python3 "$START_LAUNCHER_PY"

        # Get execution script path
        EXEC_SCRIPT=$(get_file_variable "EXECUTION_SCRIPT_PATH" "")

        if [ -n "$EXEC_SCRIPT" ] && [ -f "$EXEC_SCRIPT" ]; then
            echo "[INFO] Executing design tool launcher..."
            bash "$EXEC_SCRIPT"
        else
            echo "[WARNING] No execution script generated, launching directly..."

            # Fallback: direct launch using Python
            DESIGN_TOOL_DIR="$SCRIPT_DIR/flutter_dev_tools"
            DESIGN_TOOL_PY="$DESIGN_TOOL_DIR/design_doc_tool.py"

            if [ -f "$DESIGN_TOOL_PY" ]; then
                echo "[INFO] Starting design tool server..."
                cd "$DESIGN_TOOL_DIR" || exit 1

                # Launch in background
                python3 "$DESIGN_TOOL_PY" &
                DESIGN_TOOL_PID=$!

                # Wait for server to start
                sleep 2

                # Open browser
                DESIGN_TOOL_URL="http://127.0.0.1:5757"
                xdg-open "$DESIGN_TOOL_URL" 2>/dev/null || sensible-browser "$DESIGN_TOOL_URL" 2>/dev/null || true

                echo "[SUCCESS] Design tool launched (PID: $DESIGN_TOOL_PID)"
                echo "[INFO] Server URL: $DESIGN_TOOL_URL"
                echo "[INFO] Press Ctrl+C to stop"

                # Wait for process
                wait $DESIGN_TOOL_PID
            else
                echo "[ERROR] Design tool not found: $DESIGN_TOOL_PY"
                cd "$ORIGINAL_DIR"
                exit 1
            fi
        fi
    else
        echo "[ERROR] Start launcher not found: $START_LAUNCHER_PY"
        cd "$ORIGINAL_DIR"
        exit 1
    fi

else
    echo "[ERROR] Unknown action: $SELECTED_ACTION"
    cd "$ORIGINAL_DIR"
    exit 1
fi

# Restore original directory
cd "$ORIGINAL_DIR"
echo "[DEBUG] Restored to original directory: $(pwd)"

echo "[SUCCESS] Flutter Bloom completed"
