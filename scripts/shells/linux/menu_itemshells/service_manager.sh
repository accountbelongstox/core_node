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

# Service Manager
# This script provides a menu interface to manage system services (Redis, PostgreSQL, Docker, MySQL)

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
SERVICE_MANAGER_REGISTRY_SCRIPT="$SCRIPT_CURRENT_DIR/service_manager_registry.sh"
SERVICE_MANAGER_UI_SCRIPT="$SCRIPT_CURRENT_DIR/service_manager_ui.sh"

# Source global variables
source "$PARENT_DIR_LEVEL_1/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_1/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_1/common/arrow_menu.sh"
source "$PARENT_DIR_LEVEL_1/common/runtime_service_policy.sh"
source "$SERVICE_MANAGER_REGISTRY_SCRIPT"
source "$SERVICE_MANAGER_UI_SCRIPT"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if service is installed
is_service_installed() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"

    # Special handling for Unified Apps (manages multiple services)
    if [ "$service" = "unified_apps" ]; then
        local unified_prefixes=("app-" "webapp-" "nuxt-" "laravel-" "flutter-" "react-" "vue-")
        for prefix in "${unified_prefixes[@]}"; do
            if systemctl list-unit-files --type=service 2>/dev/null | grep -q "^${prefix}"; then
                return 0
            fi
        done
        return 1
    fi

    # Special handling for Core Node services (auto-discovered across all prefixes)
    if [ "$service" = "core_services" ]; then
        local prefix match
        for prefix in "${CORE_RUNTIME_SERVICE_PREFIXES[@]}"; do
            # Exclude the internal app-manager-log-trim housekeeping unit.
            match=$(systemctl list-unit-files --type=service 2>/dev/null | awk '{print $1}' \
                | grep -E "$(runtime_service_policy_core_prefix_pattern "$prefix")" | grep -v '^app-manager-log-trim\.service$')
            if [ -n "$match" ]; then
                return 0
            fi
        done
        return 1
    fi

    if [ -z "$systemd_name" ]; then
        return 1
    fi

    # Special handling for SSH (can be ssh or sshd)
    if [ "$service" = "ssh" ]; then
        if systemctl list-unit-files | grep -q "^ssh.service"; then
            SERVICE_SYSTEMD["ssh"]="ssh"
            return 0
        elif systemctl list-unit-files | grep -q "^sshd.service"; then
            SERVICE_SYSTEMD["ssh"]="sshd"
            return 0
        fi
        return 1
    fi

    # Special handling for Laravel Octane (canonical: ncore-laravel-main from start.sh;
    # legacy: app-manager-laravel*, octane-*)
    if [ "$service" = "laravel" ]; then
        if systemctl list-units --type=service --all | grep -qE "(ncore-laravel-main|app-manager-laravel|octane-).*\.service"; then
            return 0
        fi
        return 1
    fi

    # Check if systemd service exists
    if systemctl list-unit-files | grep -q "^$systemd_name.service"; then
        return 0
    fi

    return 1
}

# Function to get service status
get_service_status() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"

    # Special handling for Unified Apps (multiple services)
    if [ "$service" = "unified_apps" ]; then
        if ! is_service_installed "$service"; then
            echo "NOT_INSTALLED"
            return
        fi

        local unified_prefixes=("app-" "webapp-" "nuxt-" "laravel-" "flutter-" "react-" "vue-")
        local total_count=0
        local running_count=0

        for prefix in "${unified_prefixes[@]}"; do
            local services=$(systemctl list-unit-files --type=service 2>/dev/null | grep "^${prefix}" | awk '{print $1}' | sed 's/.service$//')
            if [ -n "$services" ]; then
                while IFS= read -r svc; do
                    ((total_count++))
                    if systemctl is-active --quiet "$svc"; then
                        ((running_count++))
                    fi
                done <<< "$services"
            fi
        done

        if [ "$total_count" -eq 0 ]; then
            echo "NOT_INSTALLED"
        elif [ "$running_count" -eq "$total_count" ]; then
            echo "RUNNING:$running_count/$total_count"
        elif [ "$running_count" -gt 0 ]; then
            echo "PARTIAL:$running_count/$total_count"
        else
            echo "STOPPED:0/$total_count"
        fi
        return
    fi

    # Special handling for Core Node services (auto-discovered across all prefixes)
    if [ "$service" = "core_services" ]; then
        if ! is_service_installed "$service"; then
            echo "NOT_INSTALLED"
            return
        fi

        local total_count=0
        local running_count=0
        local seen=" "
        local prefix svc

        for prefix in "${CORE_RUNTIME_SERVICE_PREFIXES[@]}"; do
            local services=$(systemctl list-unit-files --type=service 2>/dev/null | awk '{print $1}' | grep -E "$(runtime_service_policy_core_prefix_pattern "$prefix")" | sed 's/\.service$//')
            if [ -n "$services" ]; then
                while IFS= read -r svc; do
                    [ -z "$svc" ] && continue
                    # Skip the internal app-manager-log-trim housekeeping unit (timer-driven).
                    [ "$svc" = "app-manager-log-trim" ] && continue
                    case "$seen" in *" $svc "*) continue ;; esac
                    seen="$seen$svc "
                    ((total_count++))
                    if systemctl is-active --quiet "$svc"; then
                        ((running_count++))
                    fi
                done <<< "$services"
            fi
        done

        if [ "$total_count" -eq 0 ]; then
            echo "NOT_INSTALLED"
        elif [ "$running_count" -eq "$total_count" ]; then
            echo "RUNNING:$running_count/$total_count"
        elif [ "$running_count" -gt 0 ]; then
            echo "PARTIAL:$running_count/$total_count"
        else
            echo "STOPPED:0/$total_count"
        fi
        return
    fi

    if ! is_service_installed "$service"; then
        echo "NOT_INSTALLED"
        return
    fi

    # Special handling for Laravel Octane (canonical: ncore-laravel-main; legacy: app-manager-laravel*, octane-*)
    if [ "$service" = "laravel" ]; then
        local total_count=$(systemctl list-units --type=service --all 2>/dev/null | grep -cE "(ncore-laravel-main|app-manager-laravel|octane-).*\.service" || echo "0")
        local running_count=$(systemctl list-units --type=service --state=active 2>/dev/null | grep -cE "(ncore-laravel-main|app-manager-laravel|octane-).*\.service" || echo "0")

        # Clean up: ensure single line numeric value
        total_count=$(printf "%s" "$total_count" | tr -cd '0-9' | head -c 10)
        running_count=$(printf "%s" "$running_count" | tr -cd '0-9' | head -c 10)

        # Default to 0 if empty
        total_count=${total_count:-0}
        running_count=${running_count:-0}

        if [ "$total_count" -eq 0 ]; then
            echo "NOT_INSTALLED"
        elif [ "$running_count" -eq "$total_count" ]; then
            echo "RUNNING:$running_count/$total_count"
        elif [ "$running_count" -gt 0 ]; then
            echo "PARTIAL:$running_count/$total_count"
        else
            echo "STOPPED:0/$total_count"
        fi
        return
    fi

    if systemctl is-active --quiet "$systemd_name"; then
        echo "RUNNING"
    else
        if systemctl is-enabled --quiet "$systemd_name" 2>/dev/null; then
            echo "STOPPED_ENABLED"
        else
            echo "STOPPED_DISABLED"
        fi
    fi
}

# Function to print colored status
print_status() {
    local service="$1"
    local status=$(get_service_status "$service")

    # Check for Octane-specific status formats (RUNNING:x/y, PARTIAL:x/y, STOPPED:x/y)
    if [[ "$status" =~ ^RUNNING:([0-9]+)/([0-9]+)$ ]]; then
        echo -e "${GREEN}[RUNNING: ${BASH_REMATCH[1]}/${BASH_REMATCH[2]} services]${NC}"
    elif [[ "$status" =~ ^PARTIAL:([0-9]+)/([0-9]+)$ ]]; then
        echo -e "${YELLOW}[PARTIAL: ${BASH_REMATCH[1]}/${BASH_REMATCH[2]} running]${NC}"
    elif [[ "$status" =~ ^STOPPED:([0-9]+)/([0-9]+)$ ]]; then
        echo -e "${YELLOW}[STOPPED: ${BASH_REMATCH[2]} services]${NC}"
    else
        case "$status" in
            "RUNNING")
                echo -e "${GREEN}[RUNNING]${NC}"
                ;;
            "STOPPED_ENABLED")
                echo -e "${YELLOW}[STOPPED - Auto-start ENABLED]${NC}"
                ;;
            "STOPPED_DISABLED")
                echo -e "${YELLOW}[STOPPED - Auto-start DISABLED]${NC}"
                ;;
            "NOT_INSTALLED")
                echo -e "${RED}[NOT INSTALLED]${NC}"
                ;;
            *)
                echo -e "${RED}[UNKNOWN]${NC}"
                ;;
        esac
    fi
}

# Function to start service
start_service() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "Starting $service_name..."
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}Error: $service_name is not installed${NC}"
        return 1
    fi

    # Special handling for Laravel Octane (multiple services)
    if [ "$service" = "laravel" ]; then
        local octane_services=$(systemctl list-units --type=service --all | grep -E "(ncore-laravel-main|app-manager-laravel|octane-).*.service" | awk '{print $1}' | sed 's/.service$//')
        local success_count=0
        local fail_count=0

        for octane_service in $octane_services; do
            if systemctl is-active --quiet "$octane_service"; then
                echo -e "${YELLOW}$octane_service is already running${NC}"
                ((success_count++))
            else
                if $USE_SUDO systemctl start "$octane_service"; then
                    echo -e "${GREEN}Started $octane_service${NC}"
                    $USE_SUDO systemctl enable "$octane_service" 2>/dev/null
                    ((success_count++))
                else
                    echo -e "${RED}Failed to start $octane_service${NC}"
                    ((fail_count++))
                fi
            fi
        done

        echo ""
        echo "Summary: $success_count started, $fail_count failed"
        [ $fail_count -eq 0 ] && return 0 || return 1
    fi

    if systemctl is-active --quiet "$systemd_name"; then
        echo -e "${YELLOW}$service_name is already running${NC}"
        return 0
    fi

    if $USE_SUDO systemctl start "$systemd_name"; then
        echo -e "${GREEN}$service_name started successfully${NC}"

        # Enable auto-start
        if ! systemctl is-enabled --quiet "$systemd_name" 2>/dev/null; then
            echo "Enabling auto-start for $service_name..."
            $USE_SUDO systemctl enable "$systemd_name"
        fi

        # Show status
        echo ""
        echo "Service status:"
        systemctl status "$systemd_name" --no-pager --lines=10
        return 0
    else
        echo -e "${RED}Failed to start $service_name${NC}"
        systemctl status "$systemd_name" --no-pager
        return 1
    fi
}

# Function to stop service
stop_service() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "Stopping $service_name..."
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}Error: $service_name is not installed${NC}"
        return 1
    fi

    # Special handling for Laravel Octane (multiple services)
    if [ "$service" = "laravel" ]; then
        local octane_services=$(systemctl list-units --type=service --all | grep -E "(ncore-laravel-main|app-manager-laravel|octane-).*.service" | awk '{print $1}' | sed 's/.service$//')
        local success_count=0
        local fail_count=0

        for octane_service in $octane_services; do
            if ! systemctl is-active --quiet "$octane_service"; then
                echo -e "${YELLOW}$octane_service is not running${NC}"
                ((success_count++))
            else
                if $USE_SUDO systemctl stop "$octane_service"; then
                    echo -e "${GREEN}Stopped $octane_service${NC}"
                    ((success_count++))
                else
                    echo -e "${RED}Failed to stop $octane_service${NC}"
                    ((fail_count++))
                fi
            fi
        done

        echo ""
        echo "Summary: $success_count stopped, $fail_count failed"
        [ $fail_count -eq 0 ] && return 0 || return 1
    fi

    if ! systemctl is-active --quiet "$systemd_name"; then
        echo -e "${YELLOW}$service_name is not running${NC}"
        return 0
    fi

    if $USE_SUDO systemctl stop "$systemd_name"; then
        echo -e "${GREEN}$service_name stopped successfully${NC}"
        return 0
    else
        echo -e "${RED}Failed to stop $service_name${NC}"
        return 1
    fi
}

# Function to restart service
restart_service() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "Restarting $service_name..."
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}Error: $service_name is not installed${NC}"
        return 1
    fi

    # Special handling for Laravel Octane (multiple services)
    if [ "$service" = "laravel" ]; then
        local octane_services=$(systemctl list-units --type=service --all | grep -E "(ncore-laravel-main|app-manager-laravel|octane-).*.service" | awk '{print $1}' | sed 's/.service$//')
        local success_count=0
        local fail_count=0

        for octane_service in $octane_services; do
            if $USE_SUDO systemctl restart "$octane_service"; then
                echo -e "${GREEN}Restarted $octane_service${NC}"
                ((success_count++))
            else
                echo -e "${RED}Failed to restart $octane_service${NC}"
                ((fail_count++))
            fi
        done

        echo ""
        echo "Summary: $success_count restarted, $fail_count failed"
        [ $fail_count -eq 0 ] && return 0 || return 1
    fi

    if $USE_SUDO systemctl restart "$systemd_name"; then
        echo -e "${GREEN}$service_name restarted successfully${NC}"

        # Show status
        echo ""
        echo "Service status:"
        systemctl status "$systemd_name" --no-pager --lines=10
        return 0
    else
        echo -e "${RED}Failed to restart $service_name${NC}"
        systemctl status "$systemd_name" --no-pager
        return 1
    fi
}

# Function to show service status
show_service_status() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "$service_name Status"
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}$service_name is not installed${NC}"
        return 1
    fi

    systemctl status "$systemd_name" --no-pager
}

# Function to show service logs
show_service_logs() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"
    local service_name="${SERVICE_NAME[$service]}"
    local selected_index=0
    local log_choice=0
    local swoole_log="$SERVICE_MANAGER_LARAVEL_DIR/storage/logs/swoole_http.log"
    local state_file="$SERVICE_MANAGER_LARAVEL_DIR/storage/logs/octane-server-state.json"
    local menu_items=(
        "Systemd Journal (All Laravel services)"
        "Laravel Log File (storage/logs/swoole_http.log)"
        "Octane State File (storage/logs/octane-server-state.json)"
        "Back to Service Manager"
    )

    echo ""
    echo "================================================"
    echo "$service_name Logs"
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}$service_name is not installed${NC}"
        return 1
    fi

    # Special handling for Laravel Octane (multiple services)
    if [ "$service" = "laravel" ]; then
        arrow_menu_select "Laravel Log Source" menu_items 0 3
        selected_index="$ARROW_MENU_SELECTED_INDEX"
        if [ "$selected_index" -eq 3 ]; then
            log_choice=0
        else
            log_choice=$((selected_index + 1))
        fi

        case "$log_choice" in
            1)
                echo ""
                echo -e "${CYAN}Recent logs from Laravel services (last 100 lines):${NC}"
                echo "================================================"
                journalctl -u 'ncore-laravel-main' -u 'app-manager-laravel*' -u 'octane-*' -n 100 --no-pager | tail -50
                echo ""
                echo -e "${YELLOW}Tip: Use 'journalctl -u ncore-laravel-main -f' to follow logs in real-time${NC}"
                ;;
            2)
                if [ -f "$swoole_log" ]; then
                    echo ""
                    echo -e "${CYAN}Swoole HTTP Log (last 50 lines):${NC}"
                    echo "================================================"
                    tail -50 "$swoole_log"
                    echo ""
                    echo -e "${YELLOW}Full log: $swoole_log${NC}"
                else
                    echo -e "${RED}Swoole log file not found: $swoole_log${NC}"
                fi
                ;;
            3)
                if [ -f "$state_file" ]; then
                    echo ""
                    echo -e "${CYAN}Octane Server State:${NC}"
                    echo "================================================"
                    cat "$state_file" | python3 -m json.tool 2>/dev/null || cat "$state_file"
                    echo ""
                else
                    echo -e "${RED}State file not found: $state_file${NC}"
                fi
                ;;
            0)
                return 0
                ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                ;;
        esac
        return 0
    fi

    # For other services, show systemd journal
    echo ""
    echo -e "${CYAN}Recent logs (last 50 lines):${NC}"
    echo "================================================"
    journalctl -u "$systemd_name" -n 50 --no-pager
    echo ""
    echo -e "${YELLOW}Tip: Use 'journalctl -u $systemd_name -f' to follow logs in real-time${NC}"
}

# Function to enable/disable auto-start
toggle_autostart() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "Toggle Auto-start for $service_name"
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}Error: $service_name is not installed${NC}"
        return 1
    fi

    if systemctl is-enabled --quiet "$systemd_name" 2>/dev/null; then
        echo "Auto-start is currently: ENABLED"
        echo ""
        read -p "Do you want to DISABLE auto-start? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            $USE_SUDO systemctl disable "$systemd_name"
            echo -e "${GREEN}Auto-start disabled${NC}"
        fi
    else
        echo "Auto-start is currently: DISABLED"
        echo ""
        read -p "Do you want to ENABLE auto-start? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            $USE_SUDO systemctl enable "$systemd_name"
            echo -e "${GREEN}Auto-start enabled${NC}"
        fi
    fi
}

# Function to reinstall service
reinstall_service() {
    local service="$1"
    local install_script="${SERVICE_INSTALL_SCRIPT[$service]}"
    local service_name="${SERVICE_NAME[$service]}"
    local confirm=""
    local script_path="$SERVICE_MANAGER_INSTALL_SHELLS_DIR/$install_script"

    # Special handling for Laravel Octane: the canonical installer is the app's own
    # start.sh, which runs the full prerequisite setup and registers the
    # ncore-laravel-main systemd unit (--service). This keeps the menu aligned with
    # poly_apps/laravel_main/scripts/start.sh instead of a separate install path.
    if [ "$service" = "laravel" ]; then
        echo ""
        echo "================================================"
        echo "Install / Reinstall Laravel Octane (ncore-laravel-main)"
        echo "================================================"
        echo ""
        echo "Canonical installer:"
        echo "  $SERVICE_MANAGER_LARAVEL_START_SCRIPT --service"
        echo ""
        echo "This runs the full prerequisite setup (php/composer/pg/swoole/migrate/"
        echo "sys:init) and registers/restarts the ncore-laravel-main systemd service."
        echo ""
        if [ ! -f "$SERVICE_MANAGER_LARAVEL_START_SCRIPT" ]; then
            echo -e "${RED}Error: start.sh not found: $SERVICE_MANAGER_LARAVEL_START_SCRIPT${NC}"
            return 1
        fi
        read -p "Run it now? (Y/n): " confirm
        if [[ "$confirm" =~ ^[Nn]$ ]]; then
            echo "Cancelled"
            return 0
        fi
        echo ""
        echo "Executing: bash $SERVICE_MANAGER_LARAVEL_START_SCRIPT --service"
        echo ""
        bash "$SERVICE_MANAGER_LARAVEL_START_SCRIPT" --service
        return 0
    fi

    # Special handling for Core Node services: no single install target; open the
    # auto-discovery manager (it lists every ncore-*/pycore*/codesync/octane-*/
    # app-manager-* unit and how to install the ones that are missing).
    if [ "$service" = "core_services" ]; then
        launch_advanced_manager "core_services"
        return 0
    fi

    # Special handling for Unified Apps (launches unified manager)
    if [ "$service" = "unified_apps" ]; then
        echo ""
        echo "================================================"
        echo "Launching Unified App Manager"
        echo "================================================"
        echo ""
        echo -e "${GREEN}Opening Unified App Manager to create/reinstall services${NC}"
        echo ""
        read -p "Press Enter to continue..."

        bash "$SERVICE_MANAGER_UNIFIED_MANAGER_SCRIPT"
        return 0
    fi

    echo ""
    echo "================================================"

    # Check if service is already installed
    if is_service_installed "$service"; then
        echo "Reinstalling $service_name"
        echo "================================================"
        echo ""
        echo -e "${YELLOW}$service_name is already installed${NC}"
        echo "This will:"
        echo "  1. Run the installation script: $install_script"
        echo "  2. Reconfigure the service"
        echo "  3. Update to latest version if available"
        echo ""
        echo "Note: Installation script will handle reinstall confirmation"
        echo ""
        read -p "Do you want to reinstall? (Y/n): " confirm

        # Default to Yes (empty input or Y/y)
        if [[ "$confirm" =~ ^[Nn]$ ]]; then
            echo "Reinstallation cancelled"
            return 0
        fi
    else
        echo "Installing $service_name"
        echo "================================================"
        echo ""
        echo -e "${GREEN}Installing $service_name for the first time${NC}"
        echo "This will:"
        echo "  1. Run the installation script: $install_script"
        echo "  2. Configure the service"
        echo "  3. Set up required dependencies"
        echo ""
        read -p "Do you want to install? (Y/n): " confirm

        # Default to Yes (empty input or Y/y)
        if [[ "$confirm" =~ ^[Nn]$ ]]; then
            echo "Installation cancelled"
            return 0
        fi
    fi

    if [ ! -f "$script_path" ]; then
        echo -e "${RED}Error: Installation script not found: $script_path${NC}"
        return 1
    fi

    echo ""
    echo "Executing: bash $script_path"
    echo ""

    if bash "$script_path"; then
        echo ""
        if is_service_installed "$service"; then
            echo -e "${GREEN}$service_name installation/reinstallation completed successfully${NC}"
        else
            echo -e "${YELLOW}$service_name script execution completed${NC}"
            echo -e "${YELLOW}Service may need manual configuration${NC}"
        fi
        return 0
    else
        echo ""
        echo -e "${RED}$service_name installation/reinstallation failed${NC}"
        return 1
    fi
}

# Function to check if service has advanced manager
has_advanced_manager() {
    local service="$1"
    local manager_script="${SERVICE_MANAGER_SCRIPT[$service]}"
    
    if [ -n "$manager_script" ] && [ -x "$manager_script" ]; then
        return 0
    fi
    return 1
}

# Function to launch advanced manager
launch_advanced_manager() {
    local service="$1"
    local manager_script="${SERVICE_MANAGER_SCRIPT[$service]}"
    local service_name="${SERVICE_NAME[$service]}"
    
    if [ ! -x "$manager_script" ]; then
        echo -e "${RED}Error: Manager script not found or not executable: $manager_script${NC}"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    echo ""
    echo "Launching advanced manager for $service_name..."
    bash "$manager_script"
}

# Function to manage specific service
manage_service() {
    local service="$1"
    local service_name="${SERVICE_NAME[$service]}"
    local selected_index=0
    local choice=0
    local menu_items=(
        "Start Service"
        "Stop Service"
        "Restart Service"
        "Show Status"
        "Toggle Auto-start"
        "Reinstall Service"
        "Back to Service Manager"
    )
    
    # Check if service has advanced manager script
    if has_advanced_manager "$service"; then
        launch_advanced_manager "$service"
        return
    fi

    # Standard management menu for services without advanced manager
    while true; do
        arrow_menu_select "$service_name Service Management" menu_items "$selected_index" 6
        selected_index="$ARROW_MENU_SELECTED_INDEX"
        if [ "$selected_index" -eq 6 ]; then
            choice=0
        else
            choice=$((selected_index + 1))
        fi

        case "$choice" in
            1)
                start_service "$service"
                ;;
            2)
                stop_service "$service"
                ;;
            3)
                restart_service "$service"
                ;;
            4)
                show_service_status "$service"
                ;;
            5)
                toggle_autostart "$service"
                ;;
            6)
                reinstall_service "$service"
                ;;
            0)
                return 0
                ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                ;;
        esac

        echo ""
        read -p "Press Enter to continue..."
    done
}

# Main execution
show_main_menu
