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

# Unified Manager - Start Applications as System Services
# Interactive menu for starting applications with systemd service integration

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
REGISTRY_FILE="$SCRIPT_DIR/app_registry.json"
SERVICE_MANAGER="$SCRIPT_DIR/common/debian_service_manager.sh"
UTILS_PATH="$SCRIPT_DIR/common/utils.sh"
SELECTED_INDEX=0
MENU_ITEMS=()
MENU_ACTIONS=()
MENU_DESCRIPTIONS=()
INSTALLED_SERVICES=()

# Source utilities if available
if [ -f "$UTILS_PATH" ]; then
    source "$UTILS_PATH"
else
    # Fallback utility functions
    write_info() { echo "[INFO] $1"; }
    write_success() { echo "[SUCCESS] $1"; }
    write_error() { echo "[ERROR] $1"; }
    write_warning() { echo "[WARNING] $1"; }
fi

# Function to check if jq is available
check_jq() {
    if ! command -v jq >/dev/null 2>&1; then
        write_error "jq is required but not installed. Installing..."
        apt-get update -qq && apt-get install -y jq
        if [ $? -ne 0 ]; then
            write_error "Failed to install jq"
            return 1
        fi
    fi
    return 0
}

# Function to get app registry
get_app_registry() {
    if [ ! -f "$REGISTRY_FILE" ]; then
        write_error "App registry not found: $REGISTRY_FILE"
        return 1
    fi
    
    cat "$REGISTRY_FILE"
}

# Function to get installed ncore services
get_installed_services() {
    INSTALLED_SERVICES=()
    if [ -f "$SERVICE_MANAGER" ]; then
        while IFS= read -r line; do
            if [[ "$line" =~ ^[[:space:]]*ncore- ]]; then
                local service_name=$(echo "$line" | awk '{print $1}')
                INSTALLED_SERVICES+=("$service_name")
            fi
        done < <(bash "$SERVICE_MANAGER" list 2>/dev/null | grep "ncore-")
    fi
}

# Function to check if app is installed as service
is_app_installed() {
    local app_name="$1"
    local service_name="ncore-${app_name,,}"

    # Check if systemd service file exists and is active
    if systemctl is-enabled "$service_name" >/dev/null 2>&1; then
        echo "$service_name"
        return 0
    fi

    return 1
}

# Function to get service status
get_service_status() {
    local service_name="$1"

    if systemctl is-active "$service_name" >/dev/null 2>&1; then
        echo "Running"
    elif systemctl is-enabled "$service_name" >/dev/null 2>&1; then
        echo "Stopped"
    else
        echo "Not Installed"
    fi
}

# Function to build menu items
build_menu_items() {
    MENU_ITEMS=()
    MENU_ACTIONS=()
    MENU_DESCRIPTIONS=()

    # Create tmp directory
    mkdir -p /tmp/.core_node/unified_manager

    local registry
    registry=$(get_app_registry)
    if [ $? -ne 0 ]; then
        return 1
    fi

    get_installed_services
    
    # Add apps to menu
    echo "$registry" | jq -r '.apps | to_entries[] | "\(.value.id)|\(.key)|\(.value.type)|\(.value.description)"' | sort -n | while IFS='|' read -r id name type description; do
        local installed_service=$(is_app_installed "$name")
        local status="Not Installed"

        if [ $? -eq 0 ]; then
            local service_status=$(get_service_status "$installed_service")
            status="$installed_service ($service_status)"
        fi

        local menu_text="$id: $name ($type) [$status]"
        echo "APP|$name|$menu_text|$description"
    done > /tmp/.core_node/unified_manager/start_menu_apps.tmp

    # Read apps from temp file
    while IFS='|' read -r action app_name menu_text description; do
        MENU_ITEMS+=("$menu_text")
        MENU_ACTIONS+=("$action:$app_name")
        MENU_DESCRIPTIONS+=("$description")
    done < /tmp/.core_node/unified_manager/start_menu_apps.tmp
    
    # Add management options
    MENU_ITEMS+=("--- Management Options ---")
    MENU_ACTIONS+=("SEPARATOR")
    MENU_DESCRIPTIONS+=("")
    
    MENU_ITEMS+=("View All Installed Services")
    MENU_ACTIONS+=("VIEW_SERVICES")
    MENU_DESCRIPTIONS+=("Show all currently installed ncore services")
    
    MENU_ITEMS+=("Back to Previous Menu")
    MENU_ACTIONS+=("BACK")
    MENU_DESCRIPTIONS+=("Return to previous menu")
    
    MENU_ITEMS+=("Exit")
    MENU_ACTIONS+=("EXIT")
    MENU_DESCRIPTIONS+=("Exit the start menu")

    rm -f /tmp/.core_node/unified_manager/start_menu_apps.tmp
}

# Function to display menu
display_menu() {
    clear
    echo "==============================================="
    echo "        NCore Application Start"
    echo "==============================================="
    echo ""
    echo "Use UP/DOWN arrows to navigate, ENTER to select"
    echo ""
    
    for i in "${!MENU_ITEMS[@]}"; do
        local item="${MENU_ITEMS[$i]}"
        local action="${MENU_ACTIONS[$i]}"
        
        if [ "$action" = "SEPARATOR" ]; then
            echo "$item"
            continue
        fi
        
        if [ "$i" -eq "$SELECTED_INDEX" ]; then
            echo "> $item"
        else
            echo "  $item"
        fi
    done
    
    echo ""
    if [ "$SELECTED_INDEX" -lt "${#MENU_DESCRIPTIONS[@]}" ]; then
        local desc="${MENU_DESCRIPTIONS[$SELECTED_INDEX]}"
        if [ -n "$desc" ]; then
            echo "Description: $desc"
        fi
    fi
}

# Function to handle menu navigation
handle_input() {
    local key="$1"
    
    case "$key" in
        'A') # Up arrow
            ((SELECTED_INDEX--))
            if [ "$SELECTED_INDEX" -lt 0 ]; then
                SELECTED_INDEX=$((${#MENU_ITEMS[@]} - 1))
            fi
            # Skip separators
            while [ "${MENU_ACTIONS[$SELECTED_INDEX]}" = "SEPARATOR" ]; do
                ((SELECTED_INDEX--))
                if [ "$SELECTED_INDEX" -lt 0 ]; then
                    SELECTED_INDEX=$((${#MENU_ITEMS[@]} - 1))
                fi
            done
            ;;
        'B') # Down arrow
            ((SELECTED_INDEX++))
            if [ "$SELECTED_INDEX" -ge "${#MENU_ITEMS[@]}" ]; then
                SELECTED_INDEX=0
            fi
            # Skip separators
            while [ "${MENU_ACTIONS[$SELECTED_INDEX]}" = "SEPARATOR" ]; do
                ((SELECTED_INDEX++))
                if [ "$SELECTED_INDEX" -ge "${#MENU_ITEMS[@]}" ]; then
                    SELECTED_INDEX=0
                fi
            done
            ;;
        '') # Enter key
            execute_action "${MENU_ACTIONS[$SELECTED_INDEX]}"
            ;;
    esac
}

# Function to execute selected action
execute_action() {
    local action="$1"
    
    case "$action" in
        APP:*)
            local app_name="${action#APP:}"
            show_app_management "$app_name"
            ;;
        VIEW_SERVICES)
            view_installed_services
            ;;
        BACK)
            return 1
            ;;
        EXIT)
            exit 0
            ;;
    esac
}

# Function to start application
start_application() {
    local app_name="$1"

    clear
    echo "==============================================="
    echo "        Starting Application: $app_name"
    echo "==============================================="
    echo ""
    
    local registry
    registry=$(get_app_registry)
    if [ $? -ne 0 ]; then
        write_error "Failed to load app registry"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    # Get app configuration
    local app_config
    app_config=$(echo "$registry" | jq -r ".apps.\"$app_name\"")
    if [ "$app_config" = "null" ]; then
        write_error "Application not found in registry: $app_name"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    local app_type=$(echo "$app_config" | jq -r '.type')
    local app_path=$(echo "$app_config" | jq -r '.path')
    local deploy_cmd=$(echo "$app_config" | jq -r '.deploy_cmd_linux // empty')
    local start_cmd=$(echo "$app_config" | jq -r '.start_cmd_linux // empty')
    local description=$(echo "$app_config" | jq -r '.description')
    
    write_info "Application: $app_name"
    write_info "Type: $app_type"
    write_info "Path: $app_path"
    write_info "Description: $description"
    echo ""
    
    # Determine script to use (prioritize start.sh for start functionality)
    local script_to_deploy=""
    local start_script="$PROJECT_ROOT/$app_path/scripts/start.sh"
    local deploy_script="$PROJECT_ROOT/$app_path/scripts/deploy.sh"

    if [ -f "$start_script" ]; then
        script_to_deploy="$start_script"
        write_info "Using start script: $start_script"
    elif [ -f "$deploy_script" ]; then
        script_to_deploy="$deploy_script"
        write_info "Using deploy script: $deploy_script"
    else
        write_error "Neither start.sh nor deploy.sh found for $app_name"
        
        # Create embedded script for ncore apps
        if [ "$app_type" = "ncore-app" ]; then
            write_info "Creating embedded start script for ncore app"
            script_to_deploy=$(create_embedded_ncore_script "$app_name" "$app_path")
        else
            write_error "Cannot create embedded script for non-ncore app"
            read -p "Press Enter to continue..."
            return 1
        fi
    fi
    
    if [ -z "$script_to_deploy" ] || [ ! -f "$script_to_deploy" ]; then
        write_error "No valid script found for starting"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    # Start as service
    write_info "Starting as system service..."
    if [ -f "$SERVICE_MANAGER" ]; then
        bash "$SERVICE_MANAGER" create "$script_to_deploy" "$app_name" "$description"
        if [ $? -eq 0 ]; then
            write_success "Application $app_name started successfully as ncore-$app_name service"
        else
            write_error "Failed to start $app_name as service"
        fi
    else
        write_error "Service manager not found: $SERVICE_MANAGER"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

# Function to create embedded ncore script
create_embedded_ncore_script() {
    local app_name="$1"
    local app_path="$2"
    local script_dir="$PROJECT_ROOT/$app_path/scripts"
    local embedded_script="$script_dir/start.sh"
    
    mkdir -p "$script_dir"
    
    cat > "$embedded_script" << EOF
#!/bin/bash

# Auto-generated start script for NCore app: $app_name

# Variables declaration
SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="\$(dirname "\$SCRIPT_DIR")"
PROJECT_ROOT="\$(dirname "\$(dirname "\$APP_DIR")")"

echo "[INFO] Starting NCore application: $app_name"

# Change to project root directory
cd "\$PROJECT_ROOT" || {
    echo "[ERROR] Failed to change to project root: \$PROJECT_ROOT"
    exit 1
}

# Check if main.js exists
if [ ! -f "main.js" ]; then
    echo "[ERROR] main.js not found in project root"
    exit 1
fi

# Start $app_name in production mode
echo "[INFO] Starting $app_name in production mode..."
export NODE_ENV=production
node ./main.js app=$app_name

exit 0
EOF
    
    chmod +x "$embedded_script"
    echo "$embedded_script"
}

# Function to view installed services
view_installed_services() {
    clear
    echo "==============================================="
    echo "        Installed NCore Services"
    echo "==============================================="
    echo ""
    
    if [ -f "$SERVICE_MANAGER" ]; then
        bash "$SERVICE_MANAGER" list
    else
        write_error "Service manager not found: $SERVICE_MANAGER"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

# Function to run interactive menu
run_interactive_menu() {
    # Check dependencies
    if ! check_jq; then
        return 1
    fi
    
    # Build menu items
    if ! build_menu_items; then
        write_error "Failed to build menu items"
        return 1
    fi
    
    # Main menu loop
    while true; do
        display_menu
        
        # Read single character
        read -rsn1 key
        if [[ $key == $'\x1b' ]]; then
            read -rsn2 key
            key=${key:1:1}
        fi
        
        handle_input "$key"
        if [ $? -eq 1 ]; then
            break
        fi
    done
}

# Main execution
main() {
    if [ "$1" = "--list" ]; then
        # List mode for dd.sh integration
        get_app_registry | jq -r '.apps | to_entries[] | "\(.value.id): \(.key) (\(.value.type))"' | sort -n
        return 0
    fi
    
    if [ "$1" = "--apps" ] && [ -n "$2" ]; then
        # Direct start mode
        local apps="$2"
        IFS=',' read -ra APP_LIST <<< "$apps"
        for app in "${APP_LIST[@]}"; do
            start_application "$app"
        done
        return 0
    fi
    
    # Interactive mode
    run_interactive_menu
}

# Function to show application management interface
show_app_management() {
    local app_name="$1"
    local service_name="ncore-${app_name,,}"

    while true; do
        clear
        echo "==============================================="
        echo "        Application Management: $app_name"
        echo "==============================================="
        echo ""

        # Show service status
        local service_status=$(get_service_status "$service_name")
        echo "Service: $service_name"
        echo "Status: $service_status"
        echo ""

        # Show menu options
        echo "Available Actions:"
        echo "  1) Start/Update Service"
        echo "  2) View Service Logs (Live)"
        echo "  3) View Service Status"
        echo "  4) Start Service"
        echo "  5) Stop Service"
        echo "  6) Restart Service"
        echo "  7) Remove Service"
        echo "  8) Back to Main Menu"
        echo ""

        read -p "Select action (1-8): " choice

        case "$choice" in
            1) start_application_service "$app_name" ;;
            2) view_service_logs "$service_name" ;;
            3) show_service_status "$service_name" ;;
            4) start_service "$service_name" ;;
            5) stop_service "$service_name" ;;
            6) restart_service "$service_name" ;;
            7) remove_service "$service_name" ;;
            8) return 0 ;;
            *)
                echo "Invalid choice. Please select 1-8."
                sleep 2
                ;;
        esac
    done
}

# Function to start application service (renamed from deploy_application)
start_application_service() {
    local app_name="$1"

    clear
    echo "==============================================="
    echo "        Starting Application: $app_name"
    echo "==============================================="
    echo ""

    local registry
    registry=$(get_app_registry)
    if [ $? -ne 0 ]; then
        write_error "Failed to load app registry"
        read -p "Press Enter to continue..."
        return 1
    fi

    # Get app configuration
    local app_config
    app_config=$(echo "$registry" | jq -r ".apps.\"$app_name\"")
    if [ "$app_config" = "null" ]; then
        write_error "Application not found in registry: $app_name"
        read -p "Press Enter to continue..."
        return 1
    fi

    local app_type=$(echo "$app_config" | jq -r '.type')
    local app_path=$(echo "$app_config" | jq -r '.path')
    local app_description=$(echo "$app_config" | jq -r '.description')
    local deploy_cmd=$(echo "$app_config" | jq -r '.deploy_cmd_linux // empty')

    write_info "Application: $app_name"
    write_info "Type: $app_type"
    write_info "Path: $app_path"
    write_info "Description: $app_description"
    echo ""

    # Determine script to start (prioritize start.sh)
    local script_to_deploy=""
    local start_script="$PROJECT_ROOT/$app_path/scripts/start.sh"
    local deploy_script="$PROJECT_ROOT/$app_path/scripts/deploy.sh"

    if [ -f "$start_script" ]; then
        script_to_deploy="$start_script"
        write_info "Using start script: $start_script"
    elif [ -f "$deploy_script" ]; then
        script_to_deploy="$deploy_script"
        write_info "Using deploy script: $deploy_script"
    else
        write_info "No start/deploy script found, creating embedded script"
        if [ "$app_type" = "ncore-app" ]; then
            write_info "Creating embedded start script for ncore app"
            script_to_deploy=$(create_embedded_ncore_script "$app_name" "$app_path")
        else
            write_error "Cannot create embedded script for non-ncore app"
            read -p "Press Enter to continue..."
            return 1
        fi
    fi

    if [ -z "$script_to_deploy" ] || [ ! -f "$script_to_deploy" ]; then
        write_error "No valid script found for starting"
        read -p "Press Enter to continue..."
        return 1
    fi

    # Start as service
    write_info "Starting as system service..."
    if [ -f "$SERVICE_MANAGER" ]; then
        bash "$SERVICE_MANAGER" create "$script_to_deploy" "" "$app_description"

        # After starting, show logs
        local service_name="ncore-${app_name,,}"
        echo ""
        echo "==============================================="
        echo "        Start Complete"
        echo "==============================================="
        echo ""
        echo "Service started successfully. Starting live log view..."
        echo "Press Ctrl+C to stop viewing logs and return to menu."
        echo ""
        sleep 3

        # Show live logs
        view_service_logs "$service_name"
    else
        write_error "Service manager not found: $SERVICE_MANAGER"
        read -p "Press Enter to continue..."
    fi
}

# Function to view service logs
view_service_logs() {
    local service_name="$1"

    clear
    echo "==============================================="
    echo "        Live Logs: $service_name"
    echo "==============================================="
    echo ""
    echo "Press Ctrl+C to stop viewing logs and return to menu."
    echo ""

    # Check if service exists
    if ! systemctl list-units --full -all | grep -Fq "$service_name.service"; then
        echo "Service $service_name not found."
        read -p "Press Enter to continue..."
        return 1
    fi

    # Follow logs with journalctl
    journalctl -u "$service_name" -f --no-pager

    echo ""
    read -p "Press Enter to continue..."
}

# Function to show service status
show_service_status() {
    local service_name="$1"

    clear
    echo "==============================================="
    echo "        Service Status: $service_name"
    echo "==============================================="
    echo ""

    systemctl status "$service_name" --no-pager -l

    echo ""
    read -p "Press Enter to continue..."
}

# Function to start service
start_service() {
    local service_name="$1"

    echo "Starting service: $service_name"
    if systemctl start "$service_name"; then
        echo "Service started successfully."
    else
        echo "Failed to start service."
    fi

    sleep 2
}

# Function to stop service
stop_service() {
    local service_name="$1"

    echo "Stopping service: $service_name"
    if systemctl stop "$service_name"; then
        echo "Service stopped successfully."
    else
        echo "Failed to stop service."
    fi

    sleep 2
}

# Function to restart service
restart_service() {
    local service_name="$1"

    echo "Restarting service: $service_name"
    if systemctl restart "$service_name"; then
        echo "Service restarted successfully."
    else
        echo "Failed to restart service."
    fi

    sleep 2
}

# Function to remove service
remove_service() {
    local service_name="$1"

    echo "Removing service: $service_name"
    echo "This will permanently delete the service. Are you sure? (y/N)"
    read -p "Confirm: " confirm

    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        if [ -f "$SERVICE_MANAGER" ]; then
            bash "$SERVICE_MANAGER" remove "$service_name"
            echo "Service removed successfully."
        else
            echo "Service manager not found."
        fi
    else
        echo "Operation cancelled."
    fi

    sleep 2
}

# Execute main function
main "$@"
