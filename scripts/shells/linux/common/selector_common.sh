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

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
source "$SCRIPT_DIR/gvar_common.sh"
source "$SCRIPT_DIR/arrow_menu.sh"

# Unified Menu Configuration Table - Avoid Duplicate Definitions

# Menu configuration table: Menu Name|Menu Key|Available Options|Default(base)|Default(server)|Default(full)|Default(desktop)
# Note: Services (MySQL, Redis, PostgreSQL, Docker, Nginx) are always installed
# The menu option controls whether to start them after installation
declare -a MENU_CONFIG=(
    "[*] Switch Installation Mode|INSTALL_MODE|base server full desktop|base|server|full|desktop"
    "[@] Select Region|SELECTED_REGION|China Global|Global|Global|Global|Global"
    "[D] Start MySQL After Installation|START_MYSQL|false true|false|false|false|false"
    "[R] Start Redis After Installation|START_REDIS|false true|false|false|false|false"
    "[Q] Start PostgreSQL After Installation|START_POSTGRESQL|false true|false|false|false|false"
    "[W] Web Server After Installation|START_WEB_SERVER|frankenphp nginx|frankenphp|frankenphp|frankenphp|frankenphp"
    "[^] Start Docker After Installation|START_DOCKER|false true|false|false|false|false"
    "[.] Install .NET SDK|START_DOTNET|false true|false|false|false|false"
    "[G] Install Gitea (Git Service)|INSTALL_GITEA|false true|false|true|true|false"
    "[T] Install Tailscale (Local-Network Mesh VPN)|INSTALL_TAILSCALE|false true|false|true|true|true"
    "[#] Setup Network Router|INSTALL_NETWORK_ROUTER|false true|false|false|false|false"
    "[C] Set Cloud Provider|CLOUD_PROVIDER|null Tencent Alibaba Huawei Other|null|null|null|null"
)

# Parse menu configuration and initialize arrays
declare -a menu_names=()
declare -a menu_keys=()
declare -A menu_options=()
declare -A mode_defaults=()
declare -A current_values=()
declare -A value_indices=()
CANCEL_RETURN_EXIT_CODE=130

# Parse menu configuration table
parse_menu_config() {
    for config in "${MENU_CONFIG[@]}"; do
        IFS='|' read -r name key options base_default server_default full_default desktop_default <<< "$config"

        menu_names+=("$name")
        menu_keys+=("$key")
        menu_options["$key"]="$options"
        mode_defaults["${key}_base"]="$base_default"
        mode_defaults["${key}_server"]="$server_default"
        mode_defaults["${key}_full"]="$full_default"
        mode_defaults["${key}_desktop"]="$desktop_default"
    done
}
# Get preset value based on mode
get_preset_value() {
    local key="$1"
    local mode="$2"
    echo "${mode_defaults["${key}_${mode}"]}"
}

# Initialize menu values
initialize_menu_values() {
    local current_mode
    
    # First get current mode with default value
    current_mode=$(get_var "INSTALL_TYPE" "base")
    current_mode=${current_mode:-"base"}
    
    # Traverse menu table and set values for each menu item
    for key in "${menu_keys[@]}"; do
        # 1. Get mode preset value
        local preset_value=$(get_preset_value "$key" "$current_mode")
        
        # 2. Try to get saved value from get_var with preset as default
        local saved_value=$(get_var "$key" "$preset_value")
        
        # 3. If saved value exists and differs from preset, use saved value (get_var has highest priority)
        if [ -n "$saved_value" ] && [ "$saved_value" != "$preset_value" ]; then
            current_values["$key"]="$saved_value"
        else
            current_values["$key"]="$preset_value"
        fi
        
        # 4. Calculate current value index in available options
        local options=(${menu_options["$key"]})
        for i in "${!options[@]}"; do
            if [ "${options[$i]}" = "${current_values[$key]}" ]; then
                value_indices["$key"]=$i
                break
            fi
        done
    done
}

# Reset all values to mode defaults (used when switching modes)
reset_to_mode_defaults() {
    local new_mode="$1"
    
    # Reset all menu items to new mode defaults
    for key in "${menu_keys[@]}"; do
        if [ "$key" != "INSTALL_MODE" ]; then
            local new_preset=$(get_preset_value "$key" "$new_mode")
            current_values["$key"]="$new_preset"
            
            # Update index
            local options=(${menu_options["$key"]})
            for i in "${!options[@]}"; do
                if [ "${options[$i]}" = "$new_preset" ]; then
                    value_indices["$key"]=$i
                    break
                fi
            done
            
            # Clear saved value to prevent get_var override
            set_var "$key" "$new_preset"
        fi
    done
}

# Current selected menu item index
current_selection=0

# Display menu
show_menu() {
    clear
    echo "  Install the Server Configuration"
    echo "GLOBAL_VAR_DIR: ${GLOBAL_VAR_DIR}"
    echo "Current Mode: ${current_values["INSTALL_MODE"]}"

    echo "--------------------------------------"
    echo "Controls: Arrow Keys=Navigate, Enter=Confirm, B=Back, Q=Quit, M=Linux Management"
    echo "--------------------------------------"
    
    # Ensure arrays are in sync
    local menu_count=${#menu_names[@]}
    local keys_count=${#menu_keys[@]}
    
    if [ $menu_count -ne $keys_count ]; then
        echo "Error: Menu arrays out of sync (names: $menu_count, keys: $keys_count)"
        return 1
    fi
    
    for i in "${!menu_names[@]}"; do
        # Safety check for array bounds
        if [ $i -ge $menu_count ]; then
            echo "Warning: Skipping invalid index $i"
            continue
        fi
        
        local key="${menu_keys[$i]}"
        local value="${current_values[$key]}"
        local options=(${menu_options[$key]})
        
        # Display value (if multiple options available)
        local value_display=""
        if [ ${#options[@]} -gt 1 ]; then
            value_display=" [$value]"
        fi
        
        # Highlight currently selected menu item
        if [ $i -eq $current_selection ]; then
            printf "\033[34m> ${menu_names[$i]}${value_display}\033[0m\n"
        else
            echo "  ${menu_names[$i]}${value_display}"
        fi
    done
    
    echo ""
    echo "Navigation: Up/Down arrows to move, Left/Right arrows to change values, Enter to confirm"
    echo "Press B to return to previous menu, Q to quit without saving"
}

# Toggle menu item value (left/right arrows)
cycle_value() {
    local direction=$1
    
    # Boundary check
    if [ $current_selection -ge ${#menu_keys[@]} ] || [ $current_selection -lt 0 ]; then
        echo "Error: Invalid selection index $current_selection"
        return 1
    fi
    
    local key="${menu_keys[$current_selection]}"
    local options=(${menu_options[$key]})
    local current_idx=${value_indices[$key]}
    local max_idx=$((${#options[@]} - 1))
    
    # Calculate new index
    if [ "$direction" == "right" ]; then
        current_idx=$(( (current_idx + 1) % (max_idx + 1) ))
    else
        current_idx=$(( (current_idx - 1 + max_idx + 1) % (max_idx + 1) ))
    fi
    
    # Update value and index
    value_indices[$key]=$current_idx
    current_values[$key]="${options[$current_idx]}"
    
    # Immediately save value to global variable
    set_var "$key" "${options[$current_idx]}"
    
    # Special handling: when mode changes, reset all values to new mode defaults
    if [ "$key" == "INSTALL_MODE" ]; then
        local new_mode="${current_values[$key]}"
        
        # Reset all values to prevent get_var priority override
        reset_to_mode_defaults "$new_mode"
        
        # Sync INSTALL_MODE with INSTALL_TYPE
        set_var "INSTALL_TYPE" "$new_mode"
    fi
}

# Save configuration
save_configuration() {
    # Save all menu item current values
    for key in "${menu_keys[@]}"; do
        case "$key" in
            "INSTALL_MODE")
                set_global_var "$key" "${current_values[$key]}"
                set_var "INSTALL_TYPE" "${current_values[$key]}"  # Sync INSTALL_TYPE
                ;;
            "SELECTED_REGION"|"CLOUD_PROVIDER")
                set_env_and_var "$key" "${current_values[$key]}"
                ;;
            *)
                set_global_var "$key" "${current_values[$key]}"
                ;;
        esac
    done
    
    echo "Configuration saved to $GLOBAL_VAR_DIR"
    echo "Starting installation..."
    exit 0
}

# Show final confirmation
confirm_configuration() {
    clear
    echo "  Confirm Configuration"
    echo ""
    
    for i in "${!menu_names[@]}"; do
        local key="${menu_keys[$i]}"
        echo "${menu_names[$i]}: ${current_values[$key]}"
    done
    
    echo ""
    echo "Installation will start in 1 seconds..."
    sleep 1
    save_configuration
}

# Main Program Entry Point

# Initialize menu configuration
parse_menu_config
initialize_menu_values

# Ensure current_selection is within bounds
if [ $current_selection -ge ${#menu_names[@]} ]; then
    current_selection=0
fi


# Main loop
while true; do
    show_menu
    
    # Read keyboard input
    read -rsn1 key
    case "$key" in
        $'\x1b')  # ESC sequence (arrow keys)
            read -rsn2 -t 0.1 key2
            case "$key2" in
                '[A')  # Up arrow
                    if [ $current_selection -gt 0 ]; then
                        ((current_selection--))
                    fi
                    ;;
                '[B')  # Down arrow
                    if [ $current_selection -lt $((${#menu_names[@]} - 1)) ]; then
                        ((current_selection++))
                    fi
                    ;;
                '[C')  # Right arrow
                    cycle_value "right"
                    ;;
                '[D')  # Left arrow
                    cycle_value "left"
                    ;;
            esac
            ;;
        "")  # Enter key
            confirm_configuration
            ;;
        [mM])  # M key for Linux management
            show_linux_management_menu
            ;;
        [qQ])  # Q key to quit
            echo ""
            echo "Exiting without saving."
            exit "$CANCEL_RETURN_EXIT_CODE"
            ;;
        [bB])  # B key for return
            echo ""
            echo "Returning to previous menu."
            exit "$CANCEL_RETURN_EXIT_CODE"
            ;;
    esac
done

# Function to show Linux management menu
show_linux_management_menu() {
    local menu_items=(
        "Manage Services (Nginx, MySQL, Redis, etc.)"
        "NAT Gateway Configuration"
        "Return to Installation Menu"
    )

    arrow_menu_select "Linux Management" menu_items 0 2
    case "$ARROW_MENU_SELECTED_INDEX" in
        0) show_service_management_menu ;;
        1) manage_natgateway ;;
        2) return ;;
    esac
}

# Function to show service management menu
show_service_management_menu() {
    local menu_items=(
        "Nginx"
        "MySQL/MariaDB"
        "Redis"
        "Gitea"
        "XRDP (Remote Desktop)"
        "Return to Linux Management"
    )

    arrow_menu_select "Service Management" menu_items 0 5
    case "$ARROW_MENU_SELECTED_INDEX" in
        0) manage_nginx_service ;;
        1) manage_mysql_service ;;
        2) manage_redis_service ;;
        3) manage_gitea_service ;;
        4) manage_xrdp_service ;;
        5) show_linux_management_menu ;;
    esac
}

# Function to manage NAT gateway
manage_natgateway() {
    clear
    echo "  NAT Gateway Configuration"
    echo ""
    
    local natgateway_script="$SCRIPT_DIR/../debian/install_shells/113_natgateway.sh"
    
    if [ ! -f "$natgateway_script" ]; then
        echo "Error: NAT gateway script not found at: $natgateway_script"
        echo ""
        echo "Press any key to return to Linux Management..."
        read -n 1
        show_linux_management_menu
        return
    fi
    
    echo "Launching NAT Gateway configuration..."
    echo ""
    
    if [ ! -x "$natgateway_script" ]; then
        chmod +x "$natgateway_script"
    fi
    
    "$natgateway_script"
    
    local exit_code=$?
    echo ""
    
    if [ $exit_code -eq 0 ]; then
        echo "NAT Gateway configuration completed successfully."
    else
        echo "NAT Gateway configuration exited with code: $exit_code"
    fi
    
    echo ""
    echo "Press any key to return to Linux Management..."
    read -n 1
    show_linux_management_menu
}

# Legacy service management functions
manage_old_service() {
    local service_name="$1"
    local menu_items=(
        "Start service"
        "Stop service"
        "Restart service"
        "Check service status"
        "Return"
    )

    arrow_menu_select "Managing $service_name" menu_items 0 4
    case "$ARROW_MENU_SELECTED_INDEX" in
        0) $USE_SUDO systemctl start "$service_name" && echo "$service_name started" ;;
        1) $USE_SUDO systemctl stop "$service_name" && echo "$service_name stopped" ;;
        2) $USE_SUDO systemctl restart "$service_name" && echo "$service_name restarted" ;;
        3) $USE_SUDO systemctl status "$service_name" ;;
        4) return ;;
    esac
}

# Function to manage nginx service
manage_nginx_service() {
    echo ""
    echo "Managing Nginx service..."

    if command -v nginx >/dev/null 2>&1; then
        echo "Nginx is installed."

        if systemctl is-active --quiet nginx; then
            echo "Nginx is currently running."
            echo "Stopping Nginx service..."
            sudo systemctl stop nginx
        fi

        if systemctl is-enabled --quiet nginx; then
            echo "Disabling Nginx service from auto-start..."
            sudo systemctl disable nginx
        fi

        echo "Nginx service has been stopped and disabled."
        echo "To re-enable, set START_WEB_SERVER=nginx and run the installation script."
    else
        echo "Nginx is not installed."
    fi

    echo ""
    echo "Press any key to continue..."
    read -n 1
}

# Function to manage MySQL service
manage_mysql_service() {
    echo ""
    echo "Managing MySQL/MariaDB service..."

    local mysql_services=("mysql" "mariadb" "mysqld")
    local found_service=""

    # Find installed MySQL/MariaDB service
    for service in "${mysql_services[@]}"; do
        if systemctl list-units --full -all | grep -Fq "$service.service"; then
            found_service="$service"
            break
        fi
    done

    if [ -n "$found_service" ]; then
        echo "$found_service is installed."

        if systemctl is-active --quiet "$found_service"; then
            echo "$found_service is currently running."
            echo "Stopping $found_service service..."
            sudo systemctl stop "$found_service"
        fi

        if systemctl is-enabled --quiet "$found_service"; then
            echo "Disabling $found_service service from auto-start..."
            sudo systemctl disable "$found_service"
        fi

        echo "$found_service service has been stopped and disabled."
        echo "To re-enable, set START_MYSQL=true and run the installation script."
    else
        echo "MySQL/MariaDB is not installed."
    fi

    echo ""
    echo "Press any key to continue..."
    read -n 1
}

# Function to manage Redis service
manage_redis_service() {
    echo ""
    echo "Managing Redis service..."

    local redis_services=("redis-server" "redis")
    local found_service=""

    # Find installed Redis service
    for service in "${redis_services[@]}"; do
        if systemctl list-units --full -all | grep -Fq "$service.service"; then
            found_service="$service"
            break
        fi
    done

    if [ -n "$found_service" ]; then
        echo "$found_service is installed."

        if systemctl is-active --quiet "$found_service"; then
            echo "$found_service is currently running."
            echo "Stopping $found_service service..."
            sudo systemctl stop "$found_service"
        fi

        if systemctl is-enabled --quiet "$found_service"; then
            echo "Disabling $found_service service from auto-start..."
            sudo systemctl disable "$found_service"
        fi

        echo "$found_service service has been stopped and disabled."
        echo "To re-enable, set START_REDIS=true and run the installation script."
    else
        echo "Redis is not installed."
    fi

    echo ""
    echo "Press any key to continue..."
    read -n 1
}

# Function to manage Gitea service
manage_gitea_service() {
    echo ""
    echo "Managing Gitea service..."

    if systemctl list-units --full -all | grep -Fq "gitea.service"; then
        echo "Gitea is installed."

        if systemctl is-active --quiet gitea; then
            echo "Gitea is currently running."
            echo "Stopping Gitea service..."
            sudo systemctl stop gitea
        fi

        if systemctl is-enabled --quiet gitea; then
            echo "Disabling Gitea service from auto-start..."
            sudo systemctl disable gitea
        fi

        echo "Gitea service has been stopped and disabled."
        echo "To re-enable, set INSTALL_GITEA=true and run the installation script."
    else
        echo "Gitea is not installed."
    fi

    echo ""
    echo "Press any key to continue..."
    read -n 1
}

# Function to manage XRDP service
manage_xrdp_service() {
    echo ""
    echo "Managing XRDP service..."

    if systemctl list-units --full -all | grep -Fq "xrdp.service"; then
        echo "XRDP is installed."

        if systemctl is-active --quiet xrdp; then
            echo "XRDP is currently running."
            echo "Stopping XRDP service..."
            sudo systemctl stop xrdp
        fi

        if systemctl is-enabled --quiet xrdp; then
            echo "Disabling XRDP service from auto-start..."
            sudo systemctl disable xrdp
        fi

        echo "XRDP service has been stopped and disabled."
        echo "To re-enable, set INSTALL_XRDP=true and run the installation script."
    else
        echo "XRDP is not installed."
    fi

    echo ""
    echo "Press any key to continue..."
    read -n 1
}
