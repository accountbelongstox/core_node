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
# Menu Functions
# =============================================================================

# Source constants (backup copy)
source "$DD_HELPER_DIR/constants.sh"

# Source linux management functions
source "$DD_HELPER_DIR/linux_management.sh"

# Build full paths from constants
SPECIAL_SOFTWARE_ENV_MANAGER_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$SPECIAL_SOFTWARE_ENV_MANAGER_SCRIPT_RELATIVE"
SERVICE_MANAGER_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$SERVICE_MANAGER_SCRIPT_RELATIVE"
INSTALL_TEST_MENU_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$INSTALL_TEST_MENU_SCRIPT_RELATIVE"
SYSTEM_INFO_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$SYSTEM_INFO_SCRIPT_RELATIVE"
UNIFIED_MANAGER_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$UNIFIED_MANAGER_SCRIPT_RELATIVE"
GITPUT_UNIFIED_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$GITPUT_UNIFIED_SCRIPT_RELATIVE"
ROUTER_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$ROUTER_SCRIPT_RELATIVE"

show_special_software_env_menu() {
    export USE_SUDO
    bash "$SPECIAL_SOFTWARE_ENV_MANAGER_SCRIPT_PATH"
}

show_service_manager() {
    export USE_SUDO
    bash "$SERVICE_MANAGER_SCRIPT_PATH"
    echo "Press Enter to continue..."
    read
}

handle_menu_action() {
    local action="$1"
    local value="$2"
    local key="$3"

    set_global_var "$key" "$value"

    case "$action" in
        "enable_router_forwarding")
            echo "Enabling router forwarding mode..."
            bash "$ROUTER_SCRIPT_PATH"
            ;;
        "show_install_test_menu")
            echo "Opening Install and Test Environment menu..."
            bash "$INSTALL_TEST_MENU_SCRIPT_PATH"
            ;;
        "get_git")
            get_git
            ;;
        "show_system_info_menu")
            echo "Opening System Information & Variables menu..."
            bash "$SYSTEM_INFO_SCRIPT_PATH"
            ;;
        "show_special_software_env_menu")
            show_special_software_env_menu
            ;;
        "show_service_manager")
            show_service_manager
            ;;
        "unified_manager")
            bash "$UNIFIED_MANAGER_SCRIPT_PATH"
            echo ""
            echo "Press Enter to continue..."
            read
            ;;
                "push_git")
                    echo "Starting Git Push Operations..."
                    echo "Target: $value"
                    echo "Using unified git push script: $GITPUT_UNIFIED_SCRIPT_PATH"
                    cd "$CORE_NODE_ROOT_DIR"
                    if [ "$value" = "all" ]; then
                        bash "$GITPUT_UNIFIED_SCRIPT_PATH"
                    else
                        bash "$GITPUT_UNIFIED_SCRIPT_PATH" "$value"
                    fi
                    if [ $? -eq 0 ]; then
                        echo "Git push operations completed successfully"
                    else
                        echo "Git push operations failed"
                    fi
                    echo ""
                    echo "Press Enter to continue..."
                    read
                    ;;
                "show_linux_management_submenu")
                    show_linux_management_submenu
                    ;;
                "exit_script")
                    echo "Exiting the script."
                    exit 0
                    ;;
            esac
        }

load_saved_values() {
    for key in "${menu_order[@]}"; do
        local item="${menu_items[$key]}"
        local var_key=$(echo "$item" | grep -o 'key=[^;]*' | cut -d= -f2)
        local saved_value=$(get_global_var "$var_key")
        if [ -n "$saved_value" ]; then
            local values=($(echo "$item" | grep -o 'values=[^;]*' | cut -d= -f2 | tr ',' ' '))
            for i in "${!values[@]}"; do
                if [ "${values[$i]}" = "$saved_value" ]; then
                    menu_items[$key]=$(echo "$item" | sed "s/current=[0-9]*/current=$i/")
                    break
                fi
            done
        fi
    done
}
