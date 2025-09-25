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

# Unified Manager Helper - Bash
# Provides quick access to common unified manager functions

# Variables declaration
ACTION="${1:-help}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UTILS_PATH="$SCRIPT_DIR/linux/common/utils.sh"
START_SCRIPT="$SCRIPT_DIR/start_apps.sh"

# Source utilities
if [ -f "$UTILS_PATH" ]; then
    source "$UTILS_PATH"
fi

show_help() {
    echo "Unified Manager Helper"
    echo ""
    echo "Quick Commands:"
    echo "  ./helper.sh list          - Show all apps and presets"
    echo "  ./helper.sh check         - Check all app scripts"
    echo "  ./helper.sh start 1,3,5   - Start specific apps by ID"
    echo "  ./helper.sh preset P1     - Start preset by ID"
    echo "  ./helper.sh interactive   - Interactive selection mode"
    echo ""
    echo "Examples:"
    echo "  ./helper.sh start 1-5     - Start apps 1 through 5"
    echo "  ./helper.sh preset dev-suite - Start dev-suite preset"
}

show_quick_list() {
    echo "Quick App Reference:"
    echo ""
    
    local registry
    registry=$(get_app_registry 2>/dev/null)
    if [ $? -ne 0 ]; then
        echo "Failed to load app registry (jq required)"
        return 1
    fi
    
    # Show apps in compact format
    echo "$registry" | jq -r '
        .apps | to_entries[] | 
        "\(.value.id): \(.key) (\(.value.type))"
    ' | sort -n
    
    echo ""
    echo "Quick Preset Reference:"
    echo "$registry" | jq -r '.presets | to_entries[] | "\(.value.id): \(.key)"'
}

start_quick_apps() {
    local app_specs="$1"
    
    if [ ! -f "$START_SCRIPT" ]; then
        echo "Error: Start script not found: $START_SCRIPT"
        return 1
    fi
    
    bash "$START_SCRIPT" --apps "$app_specs" --background
}

start_quick_preset() {
    local preset_spec="$1"
    
    if [ ! -f "$START_SCRIPT" ]; then
        echo "Error: Start script not found: $START_SCRIPT"
        return 1
    fi
    
    bash "$START_SCRIPT" --preset "$preset_spec" --background
}

start_interactive() {
    if [ ! -f "$START_SCRIPT" ]; then
        echo "Error: Start script not found: $START_SCRIPT"
        return 1
    fi
    
    bash "$START_SCRIPT" --interactive
}

check_all_scripts() {
    if command -v test_all_app_scripts >/dev/null 2>&1; then
        test_all_app_scripts
    else
        echo "Error: Script checking function not available"
    fi
}

# Main execution
case "${ACTION,,}" in
    "help")
        show_help
        ;;
    "list")
        if [ -f "$START_SCRIPT" ]; then
            bash "$START_SCRIPT" --list
        else
            show_quick_list
        fi
        ;;
    "quick")
        show_quick_list
        ;;
    "check")
        check_all_scripts
        ;;
    "interactive")
        start_interactive
        ;;
    "start")
        if [ -n "$2" ]; then
            start_quick_apps "$2"
        else
            echo "Error: Please specify apps to start"
            exit 1
        fi
        ;;
    "preset")
        if [ -n "$2" ]; then
            start_quick_preset "$2"
        else
            echo "Error: Please specify preset to start"
            exit 1
        fi
        ;;
    *)
        show_help
        ;;
esac

exit 0
