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

# Unified App Manager - Linux Shell Layer (Simplified)
# Execution layer that calls Python for menu and executes final commands

# Variable declarations - all at top
SCRIPT_PATH="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_PATH/../.." && pwd)"
PYTHON_CORE="$SCRIPT_PATH/core/unified_core.py"
UNIFIED_PROVISION_ACTIONS="$SCRIPT_PATH/unified_manager_provision_actions.sh"
UNIFIED_RUNTIME_ACTIONS="$SCRIPT_PATH/unified_manager_runtime_actions.sh"

# Source global variable management library
source "$SCRIPT_PATH/utils/global_variables.sh"
source "$UNIFIED_PROVISION_ACTIONS"
source "$UNIFIED_RUNTIME_ACTIONS"

# Path constants
UNIFIED_SERVICE_MANAGER="$ROOT_DIR/scripts/unified_manager/modules/service_manager.sh"
LARAVEL_MAIN_PATH="$ROOT_DIR/poly_apps/laravel_main"

# Detect sudo command
USE_SUDO=""
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
fi

# Service name patterns (for mutual exclusion checks)
declare -a NORMAL_SERVICE_PATTERNS=("webapp" "nuxt" "laravel" "flutter" "app")
declare -a BUILD_SERVICE_PATTERNS=("webapp" "nuxt" "laravel" "flutter" "app")
BUILD_SERVICE_SUFFIX="-build"

# Colors
COLOR_HEADER="\033[36m"
COLOR_SUCCESS="\033[32m"
COLOR_WARNING="\033[33m"
COLOR_ERROR="\033[31m"
COLOR_INFO="\033[90m"
COLOR_RESET="\033[0m"

# Handler variables (declared here, assigned in handlers)
app_index=""
app_name=""
app_path=""
app_type=""
framework_type=""
port=""
debug_mode=""
domains_string=""
domain_count=""
build_output_path=""
execute_command=""
service_created=0
proxy_configured=0
nginx_reloaded=0
service_removed=0
build_service_removed=0

# Logging functions
log_header() {
    echo -e "${COLOR_HEADER}=== $1 ===${COLOR_RESET}"
}

log_success() {
    echo -e "${COLOR_SUCCESS}$1${COLOR_RESET}"
}

log_warning() {
    echo -e "${COLOR_WARNING}$1${COLOR_RESET}"
}

log_error() {
    echo -e "${COLOR_ERROR}$1${COLOR_RESET}"
}

log_info() {
    echo -e "${COLOR_INFO}$1${COLOR_RESET}"
}

# Print complete service information (unified for B, C, BP)
print_service_info() {
    local service_name="$1"
    local app_name="$2"
    local port="$3"
    local domain_list="$4"  # Optional: space-separated domains for proxy

    echo ""
    log_header "Service Registration Complete"
    echo ""

    # Service file path
    local service_file="/etc/systemd/system/${service_name}.service"

    # Check if service is running
    if systemctl is-active --quiet "$service_name"; then
        log_success "[OK] Service is running: $service_name"
    else
        log_error "[ERROR] Service failed to start: $service_name"
        log_info "Check logs: journalctl -u $service_name -f"
        return
    fi

    echo ""
    log_header "Service Management Commands"
    echo ""
    echo "  Start:    sudo systemctl start $service_name"
    echo "  Stop:     sudo systemctl stop $service_name"
    echo "  Restart:  sudo systemctl restart $service_name"
    echo "  Status:   sudo systemctl status $service_name"
    echo "  Logs:     sudo journalctl -u $service_name -f"
    echo "  Disable:  sudo systemctl disable $service_name"

    echo ""
    log_header "Network Access URLs"
    echo ""

    # Source network utils if available
    local network_utils="$ROOT_DIR/scripts/unified_manager/utils/network_utils.sh"
    if [[ -f "$network_utils" ]]; then
        source "$network_utils"

        # Get all IP addresses
        echo "   Localhost:  http://localhost:$port"
        echo "   Loopback:   http://127.0.0.1:$port"

        # Get all network interfaces
        local all_ips=$(hostname -I 2>/dev/null)
        if [[ -n "$all_ips" ]]; then
            for ip in $all_ips; do
                if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                    echo "   Network:    http://$ip:$port"
                fi
            done
        fi
    else
        echo "   Local: http://localhost:$port"
        echo "   Local: http://127.0.0.1:$port"
    fi

    # If domains provided (for proxy services)
    if [[ -n "$domain_list" ]]; then
        echo ""
        log_header "Domain Access (via Nginx Proxy)"
        echo ""
        for domain in $domain_list; do
            echo "   https://$domain (if SSL available)"
            echo "   http://$domain"
        done
    fi

    echo ""
    log_header "Service File Content"
    echo ""
    if [[ -f "$service_file" ]]; then
        log_info "File: $service_file"
        echo ""
        cat "$service_file" | while IFS= read -r line; do
            echo "  $line"
        done
    else
        log_warning "Service file not found: $service_file"
    fi

    echo ""
    log_header "Service Details"
    echo ""
    log_info "App Name: $app_name"
    log_info "Service Name: $service_name"
    log_info "Port: $port"
    log_info "Status: $(systemctl is-active $service_name)"

    echo ""
}

# Execute command with proper error handling
execute_command() {
    local command="$1"
    local working_dir="$2"

    if [[ -n "$working_dir" && -d "$working_dir" ]]; then
        log_info "Working directory: $working_dir"
        cd "$working_dir" || {
            log_error "Failed to change to directory: $working_dir"
            return
        }
    fi

    log_info "Executing: $command"
    echo ""

    eval "$command"
}

# Main program loop
main() {
    # Check Python availability
    if ! command -v python3 >/dev/null 2>&1; then
        log_error "Python 3 is required but not installed"
        return
    fi

    # Check Python core exists
    if [[ ! -f "$PYTHON_CORE" ]]; then
        log_error "Python core not found: $PYTHON_CORE"
        return
    fi

    # Change to root directory
    cd "$ROOT_DIR" || {
        log_error "Failed to change to root directory: $ROOT_DIR"
        return
    }

    while true; do
        # Call Python core in interactive mode
        # Python handles all menu display and user interaction
        python3 "$PYTHON_CORE" interactive

        # Check status from Python
        local status
        status=$(read_global_var "${VARIABLE_KEYS[STATUS]}")

        if [[ "$status" == "${STATUS_VALUES[MENU_EXIT]}" ]]; then
            # User chose to quit
            break

        elif [[ "$status" == "${STATUS_VALUES[EXECUTE_READY]}" ]]; then
            # Python prepared a command to execute
            local action
            local command
            local working_dir

            action=$(read_global_var "${VARIABLE_KEYS[ACTION]}")
            command=$(read_global_var "${VARIABLE_KEYS[EXECUTE_COMMAND]}")
            working_dir=$(read_global_var "${VARIABLE_KEYS[WORKING_DIRECTORY]}")

            case "$action" in
                "${ACTION_VALUES[LAUNCH]}") unified_action_launch "$command" "$working_dir" ;;
                "${ACTION_VALUES[SERVICE_CREATE]}") unified_action_service_create ;;
                "${ACTION_VALUES[BUILD_SERVICE_CREATE]}") unified_action_build_service_create ;;
                "${ACTION_VALUES[BUILD_PROXY_CREATE]}") unified_action_build_proxy_create ;;
                "${ACTION_VALUES[PROXY_CREATE]}") unified_action_proxy_create ;;
                "${ACTION_VALUES[RESTART]}") unified_action_restart ;;
                "${ACTION_VALUES[STOP]}") unified_action_stop ;;
                "${ACTION_VALUES[KILL]}") unified_action_kill ;;
                "${ACTION_VALUES[VIEW_LOGS]}") unified_action_view_logs ;;
                "${ACTION_VALUES[SERVICE_DELETE]}") unified_action_service_delete ;;
                *) log_error "Unknown action from Python: $action" ;;
            esac

        else
            # Unknown status
            log_error "Unknown status from Python: $status"
            break
        fi
    done
}

# Define action values (matching Python)
declare -A ACTION_VALUES
ACTION_VALUES[LAUNCH]="launch"
ACTION_VALUES[SERVICE_CREATE]="service_create"
ACTION_VALUES[PROXY_CREATE]="proxy_create"
ACTION_VALUES[BUILD_SERVICE_CREATE]="build_service_create"
ACTION_VALUES[BUILD_PROXY_CREATE]="build_proxy_create"
ACTION_VALUES[RESTART]="restart"
ACTION_VALUES[STOP]="stop"
ACTION_VALUES[KILL]="kill"
ACTION_VALUES[VIEW_LOGS]="view_logs"
ACTION_VALUES[SERVICE_DELETE]="service_delete"

# Define status values (matching Python)
declare -A STATUS_VALUES
STATUS_VALUES[MENU_EXIT]="menu_exit"
STATUS_VALUES[EXECUTE_READY]="execute_ready"

# Start program
main "$@"
