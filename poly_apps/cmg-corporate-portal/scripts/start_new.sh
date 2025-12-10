#!/bin/bash
# ============================================
# Entry Point Script (Linux)
# Minimal entry script that delegates to Python controller
# and Linux command executor
# ============================================

set -e

# ============================================
# VARIABLE DECLARATIONS
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_SCRIPTS_PATH="${SCRIPT_DIR}/build_scripts"
MAIN_CONTROLLER="${BUILD_SCRIPTS_PATH}/main_controller.py"
LINUX_EXECUTOR="${BUILD_SCRIPTS_PATH}/execute_commands_linux_new.sh"

ACTION="$1"

# Colors
COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[0;33m'
COLOR_CYAN='\033[0;36m'
COLOR_RESET='\033[0m'

# ============================================
# UTILITY FUNCTIONS
# ============================================

print_color() {
    local color=$1
    shift
    echo -e "${color}$@${COLOR_RESET}"
}

print_header() {
    echo ""
    print_color "$COLOR_CYAN" "============================================"
    print_color "$COLOR_CYAN" "$1"
    print_color "$COLOR_CYAN" "============================================"
    echo ""
}

# ============================================
# MAIN EXECUTION
# ============================================

print_header "Build System Entry Point (Linux)"

# Verify Python controller exists
if [ ! -f "$MAIN_CONTROLLER" ]; then
    print_color "$COLOR_RED" "[ERROR] Python controller not found: $MAIN_CONTROLLER"
    exit 1
fi

# Verify Linux executor exists
if [ ! -f "$LINUX_EXECUTOR" ]; then
    print_color "$COLOR_RED" "[ERROR] Linux executor not found: $LINUX_EXECUTOR"
    exit 1
fi

# Make executor executable
chmod +x "$LINUX_EXECUTOR"

print_color "$COLOR_CYAN" "[Entry] Project Root: $PROJECT_ROOT"
print_color "$COLOR_CYAN" "[Entry] Scripts Path: $BUILD_SCRIPTS_PATH"
echo ""

# Step 1: Run Python controller
print_color "$COLOR_YELLOW" "[Step 1/2] Running Python controller..."
echo ""

if [ -n "$ACTION" ]; then
    python3 "$MAIN_CONTROLLER" "$PROJECT_ROOT" "$ACTION"
else
    python3 "$MAIN_CONTROLLER" "$PROJECT_ROOT"
fi

python_exit_code=$?

if [ $python_exit_code -ne 0 ]; then
    echo ""
    print_color "$COLOR_RED" "[ERROR] Python controller failed with exit code: $python_exit_code"
    exit $python_exit_code
fi

echo ""
print_color "$COLOR_GREEN" "[Entry] Python controller completed successfully"
echo ""

# Step 2: Run Linux command executor
print_color "$COLOR_YELLOW" "[Step 2/2] Running Linux command executor..."
echo ""

bash "$LINUX_EXECUTOR" "$PROJECT_ROOT"

shell_exit_code=$?

if [ $shell_exit_code -ne 0 ]; then
    echo ""
    print_color "$COLOR_RED" "[ERROR] Command executor failed with exit code: $shell_exit_code"
    exit $shell_exit_code
fi

echo ""
print_header "Build System Complete"
print_color "$COLOR_GREEN" "[Success] All operations completed successfully"
