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

# Special Software Environment Variables Management Menu
# Provides a menu interface for setting environment variables for special software like AI tools

# Variable Declarations
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WIN_COMMON_DIR="$(dirname "$SCRIPT_CURRENT_DIR")/common"
SECRET_MANAGER_DIR="$(dirname "$(dirname "$SCRIPT_CURRENT_DIR")")/secret_manager"

MENU_FUNC_DIR="$SCRIPT_CURRENT_DIR/menu_func"
COMMON_MENU_PATH="$MENU_FUNC_DIR/spacial_common_menu.sh"
CLAUDE_MENU_PATH="$MENU_FUNC_DIR/ai_claude_menu.sh"
OPENAI_MENU_PATH="$MENU_FUNC_DIR/ai_openai_menu.sh"
DROID_MENU_PATH="$MENU_FUNC_DIR/ai_droid_menu.sh"

# Global variables for file management
SELECTED_FILE_ACTION=""
SELECTED_FILE_TEXT=""
SELECTED_FILE_INDEX=-1
IS_REPLACING_FILE="false"
TARGET_FILE_PATH=""

# Global variables for current operation
CURRENT_CONFIG_NAME=""
CURRENT_COMMAND_PREFIX=""
CURRENT_FILE_NUMBER=1
CURRENT_WINENVS_DIR=""
CURRENT_FILE_NAME=""
CURRENT_BATCH_CONTENT=""
CURRENT_PS_COMMAND=""

# Environment configurations - will be populated by modules
declare -a ENVIRONMENT_CONFIGS_KEYS=()

# Inherit USE_SUDO from parent shell if available
if [ -z "$USE_SUDO" ]; then
    if [ "$EUID" -ne 0 ]; then
        USE_SUDO="sudo"
    else
        USE_SUDO=""
    fi
fi

# Load common functions (must load before setting GLOBAL_SCRIPTS_DIR to get COMPILE_DIR)
if [ -f "$WIN_COMMON_DIR/gvar_common.sh" ]; then
    source "$WIN_COMMON_DIR/gvar_common.sh"
fi

# Initialize GLOBAL_SCRIPTS_DIR after gvar_common.sh is loaded
# Default to /var/_core_node/gloe/ai_tools, fallback to COMPILE_DIR-based path
if [ -z "$GLOBAL_SCRIPTS_DIR" ]; then
    GLOBAL_SCRIPTS_DIR="/var/_core_node/gloe/ai_tools"
fi

if [ -f "$SECRET_MANAGER_DIR/secret_manager.sh" ]; then
    source "$SECRET_MANAGER_DIR/secret_manager.sh"
fi

# Load common menu module
if [ -f "$COMMON_MENU_PATH" ]; then
    source "$COMMON_MENU_PATH"
else
    echo "Error: Common menu module not found at: $COMMON_MENU_PATH"
    exit 1
fi

# Load AI tool menu modules
if [ -f "$CLAUDE_MENU_PATH" ]; then
    source "$CLAUDE_MENU_PATH"
else
    echo "Error: Claude menu module not found at: $CLAUDE_MENU_PATH"
    exit 1
fi

if [ -f "$OPENAI_MENU_PATH" ]; then
    source "$OPENAI_MENU_PATH"
else
    echo "Error: OpenAI menu module not found at: $OPENAI_MENU_PATH"
    exit 1
fi

if [ -f "$DROID_MENU_PATH" ]; then
    source "$DROID_MENU_PATH"
else
    echo "Error: Droid menu module not found at: $DROID_MENU_PATH"
    exit 1
fi

# Initialize configurations from modules
get_claude_config
ENVIRONMENT_CONFIGS_KEYS+=("Claude_AI")

get_openai_config
ENVIRONMENT_CONFIGS_KEYS+=("OpenAI")

get_droid_config
ENVIRONMENT_CONFIGS_KEYS+=("Factory_AI_Droid")

# Configuration Mapping
declare -A ACTION_TO_CONFIG_MAPPING=(
    ["claude"]="Claude_AI"
    ["droid"]="Factory_AI_Droid"
    ["openai"]="OpenAI"
)

get_full_config_name() {
    local action="$1"

    if [ -n "${ACTION_TO_CONFIG_MAPPING[$action]:-}" ]; then
        echo "${ACTION_TO_CONFIG_MAPPING[$action]}"
    else
        echo "$action"
    fi
}

# Main Menu Functions

show_special_software_env_menu() {
    local -a menu_items=()

    for config_name in "${ENVIRONMENT_CONFIGS_KEYS[@]}"; do
        local display_name=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_DisplayName:-}")
        local common=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Common:-}")

        menu_items+=("$common:$display_name >")
    done

    menu_items+=("viewall:View All Environment Variables")
    menu_items+=("refresh:Refresh Current Terminal Environment")
    menu_items+=("back:Back to Main Menu")
    menu_items+=("exit:Exit")

    local selected_index=0

    while true; do
        clear
        print_color "Special Software Environment Variables Manager" "Info"
        print_color "Use Up/Down arrows to navigate, Enter to select" "Info"
        print_color "=" "Info"

        for i in "${!menu_items[@]}"; do
            IFS=':' read -r action text <<< "${menu_items[$i]}"
            if [ $i -eq $selected_index ]; then
                echo -e "\033[33m> $text\033[0m"
            else
                echo "  $text"
            fi
        done

        read -rsn1 key
        case "$key" in
            $'\x1b')
                read -rsn2 key
                case "$key" in
                    '[A') ((selected_index--)); [ $selected_index -lt 0 ] && selected_index=$((${#menu_items[@]} - 1)) ;;
                    '[B') ((selected_index++)); [ $selected_index -ge ${#menu_items[@]} ] && selected_index=0 ;;
                esac
                ;;
            '')
                IFS=':' read -r action text <<< "${menu_items[$selected_index]}"

                if [[ "$text" == *" >"* ]]; then
                    case "$action" in
                        'claude') show_claude_submenu ;;
                        'openai') show_openai_submenu ;;
                        'droid') show_droid_submenu ;;
                        *)
                            print_color "Unknown menu action: $action" "Error"
                            print_color "Press any key to continue..." "Info"
                            read -n 1 -s
                            ;;
                    esac
                else
                    case "$action" in
                        'viewall') show_all_environment_variables ;;
                        'refresh') refresh_current_terminal_environment ;;
                        'back') return 0 ;;
                        'exit') exit 0 ;;
                    esac
                fi
                ;;
        esac
    done
}

# Main Execution
if ! test_admin_privileges; then
    print_color "This script requires administrator privileges." "Error"
    print_color "Please run as administrator to manage system environment variables." "Warning"
    print_color "Press any key to continue..." "Info"
    read -n 1 -s
fi

show_special_software_env_menu
