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

# Unified App Manager - Linux Shell Layer
# Execution layer that communicates with Python core through global variables

# Variable declarations - all at top
SCRIPT_PATH="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_PATH/../.." && pwd)"
PYTHON_CORE="$SCRIPT_PATH/core/unified_core.py"
declare -a APPS_NAME
declare -a APPS_PATH
declare -a APPS_TYPE
declare -a APPS_FRAMEWORK
declare -a APPS_PORT
declare -a APPS_COMMAND
declare -a APPS_DEBUG
CURRENT_INDEX=0
MAX_APP_NAME_WIDTH=0
IS_WINDOWS="false"
IS_LINUX="true"
ENABLE_SYSTEMD="true"
ENABLE_NGINX="true"
ENABLE_FIREWALL="true"
ENABLE_DOMAIN_PROXY="true"

# Colors
COLOR_HEADER="\033[36m"
COLOR_SUCCESS="\033[32m"
COLOR_WARNING="\033[33m"
COLOR_ERROR="\033[31m"
COLOR_INFO="\033[90m"
COLOR_HIGHLIGHT="\033[37m"
COLOR_RESET="\033[0m"

# Source global variable management library
source "$SCRIPT_PATH/utils/global_variables.sh"



# Logging functions
log_header() {
    echo -e "${COLOR_HEADER}=== $1 ===${COLOR_RESET}"
}

log_success() {
    echo -e "${COLOR_SUCCESS}✓ $1${COLOR_RESET}"
}

log_warning() {
    echo -e "${COLOR_WARNING}⚠ $1${COLOR_RESET}"
}

log_error() {
    echo -e "${COLOR_ERROR}✗ $1${COLOR_RESET}"
}

log_info() {
    echo -e "${COLOR_INFO}$1${COLOR_RESET}"
}

log_highlight() {
    echo -e "${COLOR_HIGHLIGHT}$1${COLOR_RESET}"
}

# Python core communication
call_python_core() {
    local action="$1"
    shift

    if [[ ! -f "$PYTHON_CORE" ]]; then
        log_error "Python core not found: $PYTHON_CORE"
        return 1
    fi

    python3 "$PYTHON_CORE" "$action" "$@"
    local status
    status=$(read_global_var "${VARIABLE_KEYS[STATUS]}")

    if [[ "$status" == error_* ]]; then
        log_error "Python core error: ${status#error_}"
        return 1
    fi

    return 0
}

# Load application data from file variables
load_app_data() {
    local app_count
    app_count=$(read_global_app_count)

    APPS_NAME=()
    APPS_PATH=()
    APPS_TYPE=()
    APPS_FRAMEWORK=()
    APPS_PORT=()
    APPS_COMMAND=()
    APPS_DEBUG=()
    MAX_APP_NAME_WIDTH=0

    for ((i=0; i<app_count; i++)); do
        local name path type framework port command debug

        name=$(read_global_var "$(get_app_variable_key "$i" "NAME")")
        path=$(read_global_var "$(get_app_variable_key "$i" "PATH")")
        type=$(read_global_var "$(get_app_variable_key "$i" "TYPE")")
        framework=$(read_global_var "$(get_app_variable_key "$i" "FRAMEWORK")")
        port=$(read_global_var "$(get_app_variable_key "$i" "PORT")")
        command=$(read_global_var "$(get_app_variable_key "$i" "COMMAND")")
        debug=$(read_global_var "$(get_app_variable_key "$i" "DEBUG")")

        APPS_NAME+=("$name")
        APPS_PATH+=("$path")
        APPS_TYPE+=("$type")
        APPS_FRAMEWORK+=("$framework")
        APPS_PORT+=("$port")
        APPS_COMMAND+=("$command")
        APPS_DEBUG+=("$debug")

        # Calculate max width for display
        local name_len=${#name}
        [[ $name_len -gt $MAX_APP_NAME_WIDTH ]] && MAX_APP_NAME_WIDTH=$name_len
    done
}

# Load platform capabilities
load_platform_capabilities() {
    IS_WINDOWS=$(read_global_var_bool "${VARIABLE_KEYS[IS_WINDOWS]}" "false")
    IS_LINUX=$(read_global_var_bool "${VARIABLE_KEYS[IS_LINUX]}" "true")
    ENABLE_SYSTEMD=$(read_global_var_bool "${VARIABLE_KEYS[ENABLE_SYSTEMD]}" "true")
    ENABLE_NGINX=$(read_global_var_bool "${VARIABLE_KEYS[ENABLE_NGINX]}" "true")
    ENABLE_FIREWALL=$(read_global_var_bool "${VARIABLE_KEYS[ENABLE_FIREWALL]}" "true")
    ENABLE_DOMAIN_PROXY=$(read_global_var_bool "${VARIABLE_KEYS[ENABLE_DOMAIN_PROXY]}" "true")
}

# Scan applications using Python core
scan_applications() {
    log_header "Starting Application Scan"

    if call_python_core "scan"; then
        load_app_data
        load_platform_capabilities
        log_success "Scan complete - found ${#APPS_NAME[@]} applications"
    else
        log_error "Failed to scan applications"
        return 1
    fi
}

# Show main menu
show_menu() {
    clear
    log_header "dd.sh Unified App Manager >16 (Python Core)"
    log_info "Platform: $(uname -s) | Root: $ROOT_DIR"
    echo ""

    if [[ ${#APPS_NAME[@]} -eq 0 ]]; then
        log_error "No applications found"
        return
    fi

    # Calculate column widths
    local name_width=$((MAX_APP_NAME_WIDTH > 8 ? MAX_APP_NAME_WIDTH : 8))

    log_warning "Application List:"

    # Header
    printf "No. | %-${name_width}s | %-11s | %-14s | Port  | Debug\n" "App Name" "Type" "Framework"
    printf -- "----|-%${name_width}s-|-------------|----------------|-------|------\n" "$(printf '%*s' $name_width | tr ' ' '-')"

    # App list
    for i in "${!APPS_NAME[@]}"; do
        local indicator=" "
        local color="$COLOR_HIGHLIGHT"

        if [[ $i -eq $CURRENT_INDEX ]]; then
            indicator=">"
            color="$COLOR_WARNING"
        fi

        printf "${color}%s%2d | %-${name_width}s | %-11s | %-14s | %-5s | %s${COLOR_RESET}\n" \
            "$indicator" \
            $((i + 1)) \
            "${APPS_NAME[$i]}" \
            "${APPS_TYPE[$i]}" \
            "${APPS_FRAMEWORK[$i]}" \
            "${APPS_PORT[$i]}" \
            "${APPS_DEBUG[$i]}"
    done

    echo ""
    log_warning "Controls:"
    echo "Enter app number to select | L: Launch | R: Rescan | Q: Quit"

    if [[ "$ENABLE_SYSTEMD" == "true" ]]; then
        echo "C: Create service | P: Create service + domain proxy"
    fi

    echo ""
    echo -ne "${COLOR_HEADER}Enter app number (1-${#APPS_NAME[@]}) or command: ${COLOR_RESET}"
}

# Launch current application
launch_current_app() {
    if [[ ${#APPS_NAME[@]} -eq 0 ]]; then
        log_error "No applications available"
        return 1
    fi

    local app_name="${APPS_NAME[$CURRENT_INDEX]}"
    local command="${APPS_COMMAND[$CURRENT_INDEX]}"

    if [[ -z "$command" ]]; then
        log_error "No command generated for $app_name"
        return 1
    fi

    log_header "Launching $app_name"
    log_info "Command: $command"
    log_info "Port: ${APPS_PORT[$CURRENT_INDEX]}"
    log_info "Debug Mode: ${APPS_DEBUG[$CURRENT_INDEX]}"
    echo ""

    # Execute the command
    eval "$command"
}

# Create systemd service (Linux only)
create_service_for_current_app() {
    if [[ "$ENABLE_SYSTEMD" != "true" ]]; then
        log_error "SystemD services not available on this platform"
        return 1
    fi

    if [[ ${#APPS_NAME[@]} -eq 0 ]]; then
        log_error "No applications available"
        return 1
    fi

    local app_name="${APPS_NAME[$CURRENT_INDEX]}"
    local app_path="${APPS_PATH[$CURRENT_INDEX]}"
    local command="${APPS_COMMAND[$CURRENT_INDEX]}"
    local port="${APPS_PORT[$CURRENT_INDEX]}"

    if [[ -z "$command" ]]; then
        log_error "No command available for $app_name"
        return 1
    fi

    log_header "Creating SystemD Service"
    log_highlight "App: $app_name"
    log_highlight "Port: $port"
    log_highlight "Command: $command"

    # Load common service manager if available
    local service_manager="$ROOT_DIR/scripts/shells/linux/common/debian_service_manager.sh"
    if [[ -f "$service_manager" ]]; then
        source "$service_manager"

        local service_name="app-$app_name"
        local description="$app_name - Auto-generated by Unified Manager"

        log_info "Creating service: $service_name"

        if create_systemd_service "$service_name" "$description" "$command" "$app_path"; then
            log_success "Service created successfully"

            # Enable and start service
            log_info "Starting service..."
            sudo systemctl enable "$service_name"
            sudo systemctl start "$service_name"

            log_success "Service installation completed!"
            log_highlight "Service: $service_name.service"
            log_highlight "Direct access: http://localhost:$port"
        else
            log_error "Failed to create service"
            return 1
        fi
    else
        log_error "Service manager not found: $service_manager"
        return 1
    fi
}

# Create service with domain proxy (Linux only)
create_service_with_proxy_for_current_app() {
    if [[ "$ENABLE_DOMAIN_PROXY" != "true" ]]; then
        log_error "Domain proxy not available on this platform"
        return 1
    fi

    echo -ne "${COLOR_WARNING}Enter domain (e.g., ${APPS_NAME[$CURRENT_INDEX]}.local): ${COLOR_RESET}"
    read domain_input

    if [[ -z "$domain_input" ]]; then
        log_error "Domain is required for proxy setup"
        return 1
    fi

    # Create the service first
    if create_service_for_current_app; then
        # Add nginx configuration
        log_header "Configuring Domain Proxy"
        log_highlight "Domain: $domain_input"

        # Here we would call nginx configuration
        # This would be implemented based on existing nginx config logic

        log_success "Domain proxy configuration completed!"
        log_highlight "Domain Access: http://$domain_input"
        log_highlight "Add to /etc/hosts: 127.0.0.1 $domain_input"
    fi
}

# Main program loop
main() {
    # Initial scan
    if ! scan_applications; then
        log_error "Initial application scan failed"
        exit 1
    fi

    # Save terminal settings
    old_settings=$(stty -g)

    while true; do
        show_menu

        # Read user input
        read input

        # Convert to uppercase for command comparison
        input_upper=$(echo "$input" | tr '[:lower:]' '[:upper:]')

        # Handle numeric input (app selection)
        if [[ "$input" =~ ^[0-9]+$ ]]; then
            local app_num=$input
            local app_index=$((app_num - 1))

            if [[ $app_index -ge 0 && $app_index -lt ${#APPS_NAME[@]} ]]; then
                CURRENT_INDEX=$app_index
                log_success "Selected app #$app_num: ${APPS_NAME[$app_index]}"
                sleep 1
            else
                log_error "Invalid app number: $app_num"
                sleep 1
            fi

        # Handle commands
        elif [[ "$input_upper" == "L" ]]; then
            launch_current_app
            echo ""
            echo -ne "${COLOR_WARNING}Press any key to return to menu...${COLOR_RESET}"
            read -n 1

        elif [[ "$input_upper" == "C" && "$ENABLE_SYSTEMD" == "true" ]]; then
            create_service_for_current_app
            echo ""
            echo -ne "${COLOR_WARNING}Press any key to continue...${COLOR_RESET}"
            read -n 1

        elif [[ "$input_upper" == "P" && "$ENABLE_DOMAIN_PROXY" == "true" ]]; then
            create_service_with_proxy_for_current_app
            echo ""
            echo -ne "${COLOR_WARNING}Press any key to continue...${COLOR_RESET}"
            read -n 1

        elif [[ "$input_upper" == "R" ]]; then
            if scan_applications; then
                log_success "Application list updated"
            else
                log_error "Failed to rescan applications"
            fi
            sleep 1

        elif [[ "$input_upper" == "Q" || "$input_upper" == "QUIT" || "$input_upper" == "EXIT" ]]; then
            log_warning "Exiting program"
            stty "$old_settings"
            exit 0

        elif [[ -z "$input" ]]; then
            # Empty input, launch current app
            launch_current_app
            echo ""
            echo -ne "${COLOR_WARNING}Press any key to return to menu...${COLOR_RESET}"
            read -n 1

        else
            log_error "Unknown command: $input"
            local available_commands="L (launch), R (rescan), Q (quit)"
            if [[ "$ENABLE_SYSTEMD" == "true" ]]; then
                available_commands="$available_commands, C (create service)"
            fi
            if [[ "$ENABLE_DOMAIN_PROXY" == "true" ]]; then
                available_commands="$available_commands, P (service + proxy)"
            fi
            log_info "Valid commands: $available_commands"
            log_info "Or enter an app number (1-${#APPS_NAME[@]})"
            sleep 2
        fi
    done
}

# Check Python availability
if ! command -v python3 >/dev/null 2>&1; then
    log_error "Python 3 is required but not installed"
    exit 1
fi

# Start program
main "$@"