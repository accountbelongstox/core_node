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

# Source global variable management library
source "$SCRIPT_PATH/utils/global_variables.sh"

# Colors
COLOR_HEADER="\033[36m"
COLOR_SUCCESS="\033[32m"
COLOR_WARNING="\033[33m"
COLOR_ERROR="\033[31m"
COLOR_INFO="\033[90m"
COLOR_RESET="\033[0m"

# Logging functions
log_header() {
    echo -e "${COLOR_HEADER}=== $1 ===${COLOR_RESET}"
}

log_success() {
    echo -e "${COLOR_SUCCESS}âœ?$1${COLOR_RESET}"
}

log_warning() {
    echo -e "${COLOR_WARNING}âš?$1${COLOR_RESET}"
}

log_error() {
    echo -e "${COLOR_ERROR}âœ?$1${COLOR_RESET}"
}

log_info() {
    echo -e "${COLOR_INFO}$1${COLOR_RESET}"
}

# Execute command with proper error handling
execute_command() {
    local command="$1"
    local working_dir="$2"

    if [[ -n "$working_dir" && -d "$working_dir" ]]; then
        log_info "Working directory: $working_dir"
        cd "$working_dir" || {
            log_error "Failed to change to directory: $working_dir"
            return 1
        }
    fi

    log_info "Executing: $command"
    echo ""

    # Execute the command
    eval "$command"
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        echo ""
        log_error "Command failed with exit code: $exit_code"
        return $exit_code
    fi

    return 0
}

# Main program loop
main() {
    # Check Python availability
    if ! command -v python3 >/dev/null 2>&1; then
        log_error "Python 3 is required but not installed"
        exit 1
    fi

    # Check Python core exists
    if [[ ! -f "$PYTHON_CORE" ]]; then
        log_error "Python core not found: $PYTHON_CORE"
        exit 1
    fi

    # Change to root directory
    cd "$ROOT_DIR" || {
        log_error "Failed to change to root directory: $ROOT_DIR"
        exit 1
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
            exit 0

        elif [[ "$status" == "${STATUS_VALUES[EXECUTE_READY]}" ]]; then
            # Python prepared a command to execute
            local action
            local command
            local working_dir

            action=$(read_global_var "${VARIABLE_KEYS[ACTION]}")
            command=$(read_global_var "${VARIABLE_KEYS[EXECUTE_COMMAND]}")
            working_dir=$(read_global_var "${VARIABLE_KEYS[WORKING_DIRECTORY]}")

            if [[ "$action" == "${ACTION_VALUES[LAUNCH]}" ]]; then
                # Launch application
                echo ""
                log_header "Launching Application"
                echo ""

                execute_command "$command" "$working_dir"

                echo ""
                log_warning "Press any key to return to menu..."
                read -n 1

            elif [[ "$action" == "${ACTION_VALUES[SERVICE_CREATE]}" ]]; then
                # Create service using unified service manager
                echo ""
                log_header "Creating SystemD Service"
                echo ""

                # Debug: Show ROOT_DIR
                log_info "ROOT_DIR: $ROOT_DIR"

                # Load unified service manager
                local unified_service_manager="$ROOT_DIR/scripts/unified_manager/modules/service_manager.sh"
                log_info "Looking for: $unified_service_manager"

                if [[ -f "$unified_service_manager" ]]; then
                    log_info "Found unified service manager, sourcing..."
                    source "$unified_service_manager"

                    local app_index
                    local app_name
                    local app_path
                    local app_type
                    local framework_type
                    local port
                    local debug_mode

                    app_index=$(read_global_var "${VARIABLE_KEYS[SELECTED_APP_INDEX]}")
                    app_name=$(read_global_var "APP_${app_index}_NAME")
                    app_path=$(read_global_var "APP_${app_index}_PATH")
                    app_type=$(read_global_var "APP_${app_index}_TYPE")
                    framework_type=$(read_global_var "APP_${app_index}_FRAMEWORK")
                    port=$(read_global_var "APP_${app_index}_PORT")
                    debug_mode=$(read_global_var "APP_${app_index}_DEBUG")

                    log_info "App: $app_name"
                    log_info "Type: $app_type"
                    log_info "Framework: $framework_type"
                    log_info "Port: $port"
                    log_info "Debug Mode: $debug_mode"
                    echo ""

                    # Call unified service creation function
                    if create_unified_service "$app_name" "$app_path" "$app_type" "$framework_type" "$port" "" "$debug_mode"; then
                        log_success "Service created successfully"
                    else
                        log_error "Failed to create service"
                    fi
                else
                    log_error "Unified service manager not found: $unified_service_manager"
                fi

                echo ""
                log_warning "Press any key to continue..."
                read -n 1

            elif [[ "$action" == "${ACTION_VALUES[PROXY_CREATE]}" ]]; then
                # Create service with proxy - Multi-step self-repair process
                echo ""
                log_header "Creating Service with Domain Proxy"
                echo ""

                # Step 0: Get application and domain information
                local app_index
                local app_name
                local app_path
                local app_type
                local framework_type
                local port
                local debug_mode
                local domain

                app_index=$(read_global_var "${VARIABLE_KEYS[SELECTED_APP_INDEX]}")
                app_name=$(read_global_var "APP_${app_index}_NAME")
                app_path=$(read_global_var "APP_${app_index}_PATH")
                app_type=$(read_global_var "APP_${app_index}_TYPE")
                framework_type=$(read_global_var "APP_${app_index}_FRAMEWORK")
                port=$(read_global_var "APP_${app_index}_PORT")
                debug_mode=$(read_global_var "APP_${app_index}_DEBUG")
                domain=$(read_global_var "DOMAIN")

                log_info "App: $app_name"
                log_info "Domain: $domain"
                log_info "Port: $port"
                echo ""

                # Track success status for each step (for final report)
                local service_created=0
                local proxy_configured=0
                local nginx_reloaded=0

                # Step 1: Daemon reload (prepare systemd)
                log_header "Step 1/4: Refreshing SystemD"
                echo ""
                log_info "Running daemon-reload to ensure systemd is up-to-date..."
                if systemctl daemon-reload; then
                    log_success "SystemD daemon reloaded"
                else
                    log_warning "Failed to reload systemd daemon (continuing anyway)"
                fi
                echo ""

                # Step 2: Create systemd service
                log_header "Step 2/4: Creating SystemD Service"
                echo ""

                # Load unified service manager
                local unified_service_manager="$ROOT_DIR/scripts/unified_manager/modules/service_manager.sh"
                if [[ ! -f "$unified_service_manager" ]]; then
                    log_error "Unified service manager not found: $unified_service_manager"
                else
                    source "$unified_service_manager"

                    # Create service
                    log_info "Creating service: $app_name..."
                    if create_unified_service "$app_name" "$app_path" "$app_type" "$framework_type" "$port" "" "$debug_mode"; then
                        log_success "Service created successfully"
                        service_created=1
                    else
                        log_error "Failed to create service (continuing to next step)"
                    fi
                fi
                echo ""

                # Step 3: Configure nginx reverse proxy
                log_header "Step 3/4: Configuring Nginx Reverse Proxy"
                echo ""

                # Check if laravel_main exists
                local laravel_main_path="$ROOT_DIR/poly_apps/laravel_main"
                if [[ ! -d "$laravel_main_path" ]]; then
                    log_error "laravel_main not found at: $laravel_main_path"
                    log_warning "Skipping proxy configuration (directory not found)"
                else
                    # Check if php artisan is available
                    cd "$laravel_main_path"
                    if [[ ! -f "artisan" ]]; then
                        log_error "Laravel artisan not found in $laravel_main_path"
                        cd "$ROOT_DIR"
                    else
                        # Call ServerManager website add command
                        log_info "Adding nginx proxy configuration for $domain..."
                        log_info "Command: php artisan servermanager:website add \"$domain\" --type=proxy --port=\"$port\" --ssl=auto"

                        if php artisan servermanager:website add "$domain" --type=proxy --port="$port" --ssl=auto; then
                            log_success "Nginx proxy configured successfully"
                            proxy_configured=1
                        else
                            log_error "Failed to configure nginx proxy"
                            log_info "Manual configuration command:"
                            log_info "  cd $laravel_main_path"
                            log_info "  php artisan servermanager:website add \"$domain\" --type=proxy --port=$port --ssl=auto"
                        fi
                        cd "$ROOT_DIR"
                    fi
                fi
                echo ""

                # Step 4: Refresh nginx configuration
                log_header "Step 4/4: Reloading Nginx"
                echo ""

                # Check if nginx is installed
                if ! command -v nginx >/dev/null 2>&1; then
                    log_error "Nginx not found in PATH"
                    log_info "Install nginx: sudo apt install nginx"
                else
                    # Test nginx configuration first
                    log_info "Testing nginx configuration..."
                    if nginx -t 2>&1 | grep -q "successful"; then
                        log_success "Nginx configuration is valid"

                        # Check if nginx is running
                        if systemctl is-active --quiet nginx; then
                            log_info "Reloading nginx..."
                            if systemctl reload nginx; then
                                log_success "Nginx reloaded successfully"
                                nginx_reloaded=1
                            else
                                log_error "Failed to reload nginx"
                                log_info "Try: sudo systemctl restart nginx"
                            fi
                        else
                            log_warning "Nginx is not running, attempting to start..."
                            if systemctl start nginx; then
                                log_success "Nginx started successfully"
                                nginx_reloaded=1
                            else
                                log_error "Failed to start nginx"
                                log_info "Check status: sudo systemctl status nginx"
                            fi
                        fi
                    else
                        log_error "Nginx configuration test failed"
                        log_info "Check configuration: sudo nginx -t"
                        log_info "View error log: sudo tail -20 /var/log/nginx/error.log"
                    fi
                fi

                echo ""
                log_header "=== Service with Proxy Creation Summary ==="
                echo ""

                # Summary report
                if [[ $service_created -eq 1 ]]; then
                    log_success "[1/3] SystemD service created"
                else
                    log_error "[1/3] SystemD service creation failed"
                fi

                if [[ $proxy_configured -eq 1 ]]; then
                    log_success "[2/3] Nginx proxy configured"
                else
                    log_error "[2/3] Nginx proxy configuration failed"
                fi

                if [[ $nginx_reloaded -eq 1 ]]; then
                    log_success "[3/3] Nginx reloaded"
                else
                    log_error "[3/3] Nginx reload failed"
                fi

                echo ""
                if [[ $service_created -eq 1 ]] && [[ $proxy_configured -eq 1 ]] && [[ $nginx_reloaded -eq 1 ]]; then
                    log_success "âœ?All steps completed successfully"
                    log_info "Service: $app_name"
                    log_info "Domain: https://$domain (if SSL available)"
                    log_info "Domain: http://$domain"
                    log_info "Local: http://localhost:$port"
                else
                    log_warning "âš?Some steps failed - please check above for details"
                    log_info "You can retry failed steps manually"
                fi

                echo ""
                log_warning "Press any key to continue..."
                read -n 1
            fi

        else
            # Unknown status
            log_error "Unknown status from Python: $status"
            exit 1
        fi
    done
}

# Define action values (matching Python)
declare -A ACTION_VALUES
ACTION_VALUES[LAUNCH]="launch"
ACTION_VALUES[SERVICE_CREATE]="service_create"
ACTION_VALUES[PROXY_CREATE]="proxy_create"

# Define status values (matching Python)
declare -A STATUS_VALUES
STATUS_VALUES[MENU_EXIT]="menu_exit"
STATUS_VALUES[EXECUTE_READY]="execute_ready"

# Start program
main "$@"
