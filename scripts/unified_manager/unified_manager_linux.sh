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

# DEPRECATED: This Linux shell layer (Python core) is deprecated.
# New implementation (no Python): scripts/app_manager/linux_sh/app_manager.sh
# dd.sh already launches the new script; this file is kept for backward compatibility.
#
# Unified App Manager - Linux Shell Layer (Simplified)
# Execution layer that calls Python for menu and executes final commands

# Variable declarations - all at top
SCRIPT_PATH="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_PATH/../.." && pwd)"
PYTHON_CORE="$SCRIPT_PATH/core/unified_core.py"

# Source global variable management library
source "$SCRIPT_PATH/utils/global_variables.sh"

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
    echo -e "${COLOR_SUCCESS}�?$1${COLOR_RESET}"
}

log_warning() {
    echo -e "${COLOR_WARNING}�?$1${COLOR_RESET}"
}

log_error() {
    echo -e "${COLOR_ERROR}�?$1${COLOR_RESET}"
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
        log_success "✓ Service is running: $service_name"
    else
        log_error "✗ Service failed to start: $service_name"
        log_info "Check logs: journalctl -u $service_name -f"
        return 1
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
        echo "  📍 Localhost:  http://localhost:$port"
        echo "  📍 Loopback:   http://127.0.0.1:$port"

        # Get all network interfaces
        local all_ips=$(hostname -I 2>/dev/null)
        if [[ -n "$all_ips" ]]; then
            for ip in $all_ips; do
                if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                    echo "  📍 Network:    http://$ip:$port"
                fi
            done
        fi
    else
        echo "  📍 Local: http://localhost:$port"
        echo "  📍 Local: http://127.0.0.1:$port"
    fi

    # If domains provided (for proxy services)
    if [[ -n "$domain_list" ]]; then
        echo ""
        log_header "Domain Access (via Nginx Proxy)"
        echo ""
        for domain in $domain_list; do
            echo "  🌐 https://$domain (if SSL available)"
            echo "  🌐 http://$domain"
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
                log_info "Looking for: $UNIFIED_SERVICE_MANAGER"

                if [[ -f "$UNIFIED_SERVICE_MANAGER" ]]; then
                    log_info "Found unified service manager, sourcing..."
                    source "$UNIFIED_SERVICE_MANAGER"

                    # Get app information from global variables
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

                    # Remove existing build service (mutual exclusion)
                    build_service_removed=0
                    for pattern in "${BUILD_SERVICE_PATTERNS[@]}"; do
                        local build_service="$pattern-$app_name$BUILD_SERVICE_SUFFIX"
                        if systemctl list-unit-files "$build_service.service" >/dev/null 2>&1; then
                            log_warning "Found existing build service: $build_service"
                            log_info "Removing build service (normal service replaces build service)..."

                            systemctl stop "$build_service" 2>/dev/null || true
                            systemctl disable "$build_service" 2>/dev/null || true
                            rm -f "/etc/systemd/system/$build_service.service"
                            systemctl daemon-reload

                            log_success "Build service removed: $build_service"
                            build_service_removed=1
                            echo ""
                        fi
                    done

                    if [[ $build_service_removed -eq 0 ]]; then
                        log_info "No existing build service found"
                        echo ""
                    fi

                    # Call unified service creation function
                    if create_unified_service "$app_name" "$app_path" "$app_type" "$framework_type" "$port" "" "$debug_mode"; then
                        log_success "Service created successfully"

                        # Determine service name based on framework
                        local service_name=""
                        case "$framework_type" in
                            "reactStart"|"vueStart")
                                service_name="webapp-$app_name"
                                ;;
                            "nuxtStart")
                                service_name="nuxt-$app_name"
                                ;;
                            "laravelStart")
                                service_name="laravel-$app_name"
                                ;;
                            "flutterStart")
                                service_name="flutter-$app_name"
                                ;;
                            *)
                                service_name="app-$app_name"
                                ;;
                        esac

                        # Use unified print function
                        print_service_info "$service_name" "$app_name" "$port" ""
                    else
                        log_error "Failed to create service"
                    fi
                else
                    log_error "Unified service manager not found: $UNIFIED_SERVICE_MANAGER"
                fi

                echo ""
                log_warning "Press any key to continue..."
                read -n 1

            elif [[ "$action" == "${ACTION_VALUES[BUILD_SERVICE_CREATE]}" ]]; then
                # Build & Create systemd service - Python generated files, Shell writes to system
                echo ""
                log_header "Registering Build Service with SystemD"
                echo ""

                # Get service information from global variables
                app_index=$(read_global_var "${VARIABLE_KEYS[SELECTED_APP_INDEX]}")
                app_name=$(read_global_var "APP_${app_index}_NAME")
                port=$(read_global_var "APP_${app_index}_PORT")
                build_service_name=$(read_global_var "BUILD_SERVICE_NAME")
                services_to_remove=$(read_global_var "SERVICES_TO_REMOVE")
                service_content=$(read_global_var "BUILD_SERVICE_CONTENT")

                log_info "App: $app_name"
                log_info "Port: $port"
                log_info "Build Service: $build_service_name"
                echo ""

                # Remove existing normal services (mutual exclusion)
                if [[ -n "$services_to_remove" ]]; then
                    log_info "Removing conflicting normal services..."
                    for service_to_remove in $services_to_remove; do
                        if systemctl list-unit-files "$service_to_remove.service" >/dev/null 2>&1; then
                            log_warning "Found existing service: $service_to_remove"
                            systemctl stop "$service_to_remove" 2>/dev/null || true
                            systemctl disable "$service_to_remove" 2>/dev/null || true
                            rm -f "/etc/systemd/system/$service_to_remove.service"
                            log_success "Removed: $service_to_remove"
                        fi
                    done
                    systemctl daemon-reload
                    echo ""
                fi

                # Write service file (Python generated the content)
                log_info "Writing service file to /etc/systemd/system/..."
                local service_file="/etc/systemd/system/${build_service_name}.service"
                echo "$service_content" > "$service_file"
                log_success "Service file written: $service_file"
                echo ""

                # Register and start service
                log_info "Registering service with SystemD..."
                systemctl daemon-reload
                systemctl enable "$build_service_name"
                systemctl start "$build_service_name"

                sleep 2

                # Use unified print function
                print_service_info "$build_service_name" "$app_name" "$port" ""

                echo ""
                log_warning "Press any key to continue..."
                read -n 1

            elif [[ "$action" == "${ACTION_VALUES[BUILD_PROXY_CREATE]}" ]]; then
                # Build & Create service with proxy
                echo ""
                log_header "Creating Service with Proxy from Build"
                echo ""

                # Get application and domain information from global variables
                app_index=$(read_global_var "${VARIABLE_KEYS[SELECTED_APP_INDEX]}")
                app_name=$(read_global_var "APP_${app_index}_NAME")
                app_path=$(read_global_var "APP_${app_index}_PATH")
                app_type=$(read_global_var "APP_${app_index}_TYPE")
                framework_type=$(read_global_var "APP_${app_index}_FRAMEWORK")
                port=$(read_global_var "APP_${app_index}_PORT")
                debug_mode=$(read_global_var "APP_${app_index}_DEBUG")
                domains_string=$(read_global_var "DOMAINS")
                domain_count=$(read_global_var "DOMAIN_COUNT")
                build_output_path=$(read_global_var "BUILD_OUTPUT_PATH")
                execute_command=$(read_global_var "${VARIABLE_KEYS[EXECUTE_COMMAND]}")

                # Convert space-separated domains to array
                IFS=' ' read -ra domains_array <<< "$domains_string"

                log_info "App: $app_name"
                log_info "Domains: $domains_string ($domain_count total)"
                log_info "Port: $port"
                log_info "Build Output: $build_output_path"
                log_info "Build Command: $execute_command"
                echo ""

                # Track success status
                service_created=0
                proxy_configured=0
                nginx_reloaded=0

                # Step 1: Daemon reload
                log_header "Step 1/4: Refreshing SystemD"
                echo ""
                log_info "Running daemon-reload..."
                if systemctl daemon-reload; then
                    log_success "SystemD daemon reloaded"
                else
                    log_warning "Failed to reload systemd daemon (continuing anyway)"
                fi
                echo ""

                # Step 2: Create systemd service using Python-generated files
                log_header "Step 2/4: Creating SystemD Build Service"
                echo ""

                # Get service information from Python
                build_service_name=$(read_global_var "BUILD_SERVICE_NAME")
                wrapper_script=$(read_global_var "BUILD_WRAPPER_PATH")
                service_content=$(read_global_var "BUILD_SERVICE_CONTENT")
                services_to_remove=$(read_global_var "SERVICES_TO_REMOVE")

                log_info "Service: $build_service_name"
                log_info "Wrapper: $wrapper_script"
                echo ""

                # Remove existing normal services (mutual exclusion)
                if [[ -n "$services_to_remove" ]]; then
                    log_info "Removing conflicting normal services..."
                    for service_to_remove in $services_to_remove; do
                        if systemctl list-unit-files "$service_to_remove.service" >/dev/null 2>&1; then
                            log_warning "Found existing service: $service_to_remove"
                            systemctl stop "$service_to_remove" 2>/dev/null || true
                            systemctl disable "$service_to_remove" 2>/dev/null || true
                            rm -f "/etc/systemd/system/$service_to_remove.service"
                            log_success "Removed: $service_to_remove"
                        fi
                    done
                    systemctl daemon-reload
                    echo ""
                fi

                # Write service file (Python generated the content)
                log_info "Writing service file to /etc/systemd/system/..."
                local service_file="/etc/systemd/system/${build_service_name}.service"
                echo "$service_content" > "$service_file"
                log_success "Service file written: $service_file"
                echo ""

                # Register and start service
                log_info "Registering service with SystemD..."
                systemctl daemon-reload
                systemctl enable "$build_service_name"
                systemctl start "$build_service_name"

                sleep 2

                if systemctl is-active --quiet "$build_service_name"; then
                    log_success "Build service created and started"
                    service_created=1
                else
                    log_error "Build service failed to start"
                    log_info "Check logs: journalctl -u $build_service_name -f"
                fi
                echo ""

                # Step 3: Configure nginx reverse proxy
                log_header "Step 3/4: Configuring Nginx Reverse Proxy"
                echo ""

                if [[ ! -d "$LARAVEL_MAIN_PATH" ]]; then
                    log_error "laravel_main not found at: $LARAVEL_MAIN_PATH"
                    log_warning "Skipping proxy configuration"
                else
                    cd "$LARAVEL_MAIN_PATH"
                    if [[ ! -f "artisan" ]]; then
                        log_error "Laravel artisan not found"
                        cd "$ROOT_DIR"
                    else
                        local success_count=0
                        local total_domains=${#domains_array[@]}

                        log_info "Adding nginx proxy configurations for $total_domains domain(s)..."
                        echo ""

                        for domain in "${domains_array[@]}"; do
                            log_info "Processing domain: $domain"
                            log_info "Command: $USE_SUDO php artisan servermanager:website add \"$domain\" --type=proxy --port=\"$port\" --ssl=auto"
                            
                            if $USE_SUDO php artisan servermanager:website add "$domain" --type=proxy --port="$port" --ssl=auto 2>&1; then
                                log_success "✓ Nginx proxy configured for: $domain"
                                ((success_count++))
                            else
                                log_error "✗ Failed to configure proxy for: $domain"
                                log_info "Manual configuration command:"
                                log_info "  cd $LARAVEL_MAIN_PATH"
                                log_info "  $USE_SUDO php artisan servermanager:website add \"$domain\" --type=proxy --port=$port --ssl=auto"
                            fi
                            echo ""
                        done

                        if [[ $success_count -eq $total_domains ]]; then
                            log_success "All proxy configurations created ($success_count/$total_domains)"
                            proxy_configured=1
                        elif [[ $success_count -gt 0 ]]; then
                            log_warning "Partial success: $success_count/$total_domains"
                            proxy_configured=1
                        else
                            log_error "All proxy configurations failed"
                        fi
                        cd "$ROOT_DIR"
                    fi
                fi
                echo ""

                # Step 4: Reload nginx
                log_header "Step 4/4: Reloading Nginx"
                echo ""

                if ! command -v nginx >/dev/null 2>&1; then
                    log_error "Nginx not found"
                else
                    log_info "Testing nginx configuration..."
                    if nginx -t 2>&1 | grep -q "successful"; then
                        log_success "Nginx configuration is valid"

                        if systemctl is-active --quiet nginx; then
                            log_info "Reloading nginx..."
                            if systemctl reload nginx; then
                                log_success "Nginx reloaded successfully"
                                nginx_reloaded=1
                            else
                                log_error "Failed to reload nginx"
                            fi
                        else
                            log_warning "Nginx not running, starting..."
                            if systemctl start nginx; then
                                log_success "Nginx started successfully"
                                nginx_reloaded=1
                            else
                                log_error "Failed to start nginx"
                            fi
                        fi
                    else
                        log_error "Nginx configuration test failed"
                    fi
                fi

                echo ""
                log_header "=== Build Service with Proxy Summary ==="
                echo ""

                if [[ $service_created -eq 1 ]]; then
                    log_success "[1/3] SystemD build service created"
                else
                    log_error "[1/3] Build service creation failed"
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
                    log_success "✓ All steps completed successfully"

                    # Use unified print function
                    local build_service_name="webapp-$app_name$BUILD_SERVICE_SUFFIX"
                    print_service_info "$build_service_name" "$app_name" "$port" "$domains_string"
                else
                    log_warning "⚠ Some steps failed - check above for details"
                fi

                echo ""
                log_warning "Press any key to continue..."
                read -n 1

            elif [[ "$action" == "${ACTION_VALUES[PROXY_CREATE]}" ]]; then
                # Create service with proxy - Multi-step self-repair process
                echo ""
                log_header "Creating Service with Domain Proxy"
                echo ""

                # Get application and domain information from global variables
                app_index=$(read_global_var "${VARIABLE_KEYS[SELECTED_APP_INDEX]}")
                app_name=$(read_global_var "APP_${app_index}_NAME")
                app_path=$(read_global_var "APP_${app_index}_PATH")
                app_type=$(read_global_var "APP_${app_index}_TYPE")
                framework_type=$(read_global_var "APP_${app_index}_FRAMEWORK")
                port=$(read_global_var "APP_${app_index}_PORT")
                debug_mode=$(read_global_var "APP_${app_index}_DEBUG")
                domains_string=$(read_global_var "DOMAINS")
                domain_count=$(read_global_var "DOMAIN_COUNT")

                # Convert space-separated domains to array
                IFS=' ' read -ra domains_array <<< "$domains_string"

                log_info "App: $app_name"
                log_info "Domains: $domains_string ($domain_count total)"
                log_info "Port: $port"
                echo ""

                # Track success status for each step
                service_created=0
                proxy_configured=0
                nginx_reloaded=0

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

                if [[ ! -f "$UNIFIED_SERVICE_MANAGER" ]]; then
                    log_error "Unified service manager not found: $UNIFIED_SERVICE_MANAGER"
                else
                    source "$UNIFIED_SERVICE_MANAGER"

                    # Remove existing build service (mutual exclusion)
                    build_service_removed=0
                    for pattern in "${BUILD_SERVICE_PATTERNS[@]}"; do
                        local build_service="$pattern-$app_name$BUILD_SERVICE_SUFFIX"
                        if systemctl list-unit-files "$build_service.service" >/dev/null 2>&1; then
                            log_warning "Found existing build service: $build_service"
                            log_info "Removing build service (normal service replaces build service)..."

                            systemctl stop "$build_service" 2>/dev/null || true
                            systemctl disable "$build_service" 2>/dev/null || true
                            rm -f "/etc/systemd/system/$build_service.service"
                            systemctl daemon-reload

                            log_success "Build service removed: $build_service"
                            build_service_removed=1
                            echo ""
                        fi
                    done

                    if [[ $build_service_removed -eq 0 ]]; then
                        log_info "No existing build service found"
                        echo ""
                    fi

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

                if [[ ! -d "$LARAVEL_MAIN_PATH" ]]; then
                    log_error "laravel_main not found at: $LARAVEL_MAIN_PATH"
                    log_warning "Skipping proxy configuration (directory not found)"
                else
                    # Check if php artisan is available
                    cd "$LARAVEL_MAIN_PATH"
                    if [[ ! -f "artisan" ]]; then
                        log_error "Laravel artisan not found in $LARAVEL_MAIN_PATH"
                        cd "$ROOT_DIR"
                    else
                        # Call ServerManager website add command for each domain
                        local success_count=0
                        local total_domains=${#domains_array[@]}

                        log_info "Adding nginx proxy configurations for $total_domains domain(s)..."
                        echo ""

                        for domain in "${domains_array[@]}"; do
                            log_info "Processing domain: $domain"
                            log_info "Command: $USE_SUDO php artisan servermanager:website add \"$domain\" --type=proxy --port=\"$port\" --ssl=auto"

                            if $USE_SUDO php artisan servermanager:website add "$domain" --type=proxy --port="$port" --ssl=auto 2>&1; then
                                log_success "✓ Nginx proxy configured for: $domain"
                                ((success_count++))
                            else
                                log_error "✗ Failed to configure proxy for: $domain"
                                log_info "Manual configuration command:"
                                log_info "  cd $LARAVEL_MAIN_PATH"
                                log_info "  $USE_SUDO php artisan servermanager:website add \"$domain\" --type=proxy --port=$port --ssl=auto"
                            fi
                            echo ""
                        done

                        if [[ $success_count -eq $total_domains ]]; then
                            log_success "All proxy configurations created successfully ($success_count/$total_domains)"
                            proxy_configured=1
                        elif [[ $success_count -gt 0 ]]; then
                            log_warning "Partial success: $success_count/$total_domains proxy configurations created"
                            proxy_configured=1
                        else
                            log_error "All proxy configurations failed (0/$total_domains)"
                            proxy_configured=0
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
                    log_success "✓ All steps completed successfully"

                    # Determine service name based on framework
                    local service_name=""
                    case "$framework_type" in
                        "reactStart"|"vueStart")
                            service_name="webapp-$app_name"
                            ;;
                        "nuxtStart")
                            service_name="nuxt-$app_name"
                            ;;
                        "laravelStart")
                            service_name="laravel-$app_name"
                            ;;
                        "flutterStart")
                            service_name="flutter-$app_name"
                            ;;
                        *)
                            service_name="app-$app_name"
                            ;;
                    esac

                    # Use unified print function
                    print_service_info "$service_name" "$app_name" "$port" "$domains_string"
                else
                    log_warning "⚠ Some steps failed - please check above for details"
                    log_info "You can retry failed steps manually"
                fi

                echo ""
                log_warning "Press any key to continue..."
                read -n 1

            elif [[ "$action" == "${ACTION_VALUES[RESTART]}" ]]; then
                # Restart application
                echo ""
                log_header "Restarting Application"
                echo ""

                local app_index
                local app_name
                local port

                app_index=$(read_global_var "${VARIABLE_KEYS[SELECTED_APP_INDEX]}")
                app_name=$(read_global_var "APP_${app_index}_NAME")
                port=$(read_global_var "APP_${app_index}_PORT")

                log_info "App: $app_name"
                log_info "Port: $port"
                echo ""

                # Try to restart systemd service first
                local service_name="${app_name}.service"
                if systemctl list-units --full --all | grep -q "$service_name"; then
                    log_info "Restarting systemd service: $service_name"
                    if systemctl restart "$service_name"; then
                        log_success "Service restarted successfully"
                    else
                        log_error "Failed to restart service"
                    fi
                else
                    log_warning "No systemd service found for $app_name"
                    log_info "Use K (Kill) to stop the process, then L (Launch) to start again"
                fi

                echo ""
                log_warning "Press any key to continue..."
                read -n 1

            elif [[ "$action" == "${ACTION_VALUES[STOP]}" ]]; then
                # Stop application
                echo ""
                log_header "Stopping Application"
                echo ""

                local app_index
                local app_name
                local port

                app_index=$(read_global_var "${VARIABLE_KEYS[SELECTED_APP_INDEX]}")
                app_name=$(read_global_var "APP_${app_index}_NAME")
                port=$(read_global_var "APP_${app_index}_PORT")

                log_info "App: $app_name"
                log_info "Port: $port"
                echo ""

                # Try to stop systemd service first
                local service_name="${app_name}.service"
                if systemctl list-units --full --all | grep -q "$service_name"; then
                    log_info "Stopping systemd service: $service_name"
                    if systemctl stop "$service_name"; then
                        log_success "Service stopped successfully"
                    else
                        log_error "Failed to stop service"
                    fi
                else
                    log_warning "No systemd service found for $app_name"
                    log_info "Use K (Kill) to forcefully terminate the process"
                fi

                echo ""
                log_warning "Press any key to continue..."
                read -n 1

            elif [[ "$action" == "${ACTION_VALUES[KILL]}" ]]; then
                # Kill process on port
                echo ""
                log_header "Killing Process on Port"
                echo ""

                local app_index
                local app_name
                local port

                app_index=$(read_global_var "${VARIABLE_KEYS[SELECTED_APP_INDEX]}")
                app_name=$(read_global_var "APP_${app_index}_NAME")
                port=$(read_global_var "APP_${app_index}_PORT")

                log_info "App: $app_name"
                log_info "Port: $port"
                echo ""

                # Find and kill process on the port
                log_info "Searching for process on port $port..."
                local pid=$(lsof -ti:$port 2>/dev/null)

                if [[ -z "$pid" ]]; then
                    log_warning "No process found on port $port"
                else
                    log_info "Found process PID: $pid"
                    log_warning "Killing process..."
                    if kill -9 $pid 2>/dev/null; then
                        log_success "Process killed successfully"
                    else
                        log_error "Failed to kill process (may require sudo)"
                        log_info "Try: sudo kill -9 $pid"
                    fi
                fi

                echo ""
                log_warning "Press any key to continue..."
                read -n 1

            elif [[ "$action" == "${ACTION_VALUES[VIEW_LOGS]}" ]]; then
                # View application logs
                echo ""
                log_header "Viewing Application Logs"
                echo ""

                local app_index
                local app_name

                app_index=$(read_global_var "${VARIABLE_KEYS[SELECTED_APP_INDEX]}")
                app_name=$(read_global_var "APP_${app_index}_NAME")

                log_info "App: $app_name"
                echo ""

                # Try to view systemd service logs
                local service_name="${app_name}.service"
                if systemctl list-units --full --all | grep -q "$service_name"; then
                    log_info "Showing logs for systemd service: $service_name"
                    echo ""
                    journalctl -u "$service_name" -n 50 --no-pager
                else
                    log_warning "No systemd service found for $app_name"
                    log_info "Service logs are only available for systemd services"
                fi

                echo ""
                log_warning "Press any key to continue..."
                read -n 1

            elif [[ "$action" == "${ACTION_VALUES[SERVICE_DELETE]}" ]]; then
                # Delete systemd service
                echo ""
                log_header "Deleting SystemD Service"
                echo ""

                local app_index
                local app_name

                app_index=$(read_global_var "${VARIABLE_KEYS[SELECTED_APP_INDEX]}")
                app_name=$(read_global_var "APP_${app_index}_NAME")

                log_info "App: $app_name"
                echo ""

                local service_name="${app_name}.service"
                local service_file="/etc/systemd/system/$service_name"

                # Check if service exists
                if [[ ! -f "$service_file" ]]; then
                    log_error "Service file not found: $service_file"
                else
                    # Stop the service first
                    log_info "Stopping service: $service_name"
                    if systemctl stop "$service_name" 2>/dev/null; then
                        log_success "Service stopped"
                    else
                        log_warning "Service may not be running"
                    fi

                    # Disable the service
                    log_info "Disabling service: $service_name"
                    if systemctl disable "$service_name" 2>/dev/null; then
                        log_success "Service disabled"
                    else
                        log_warning "Service may not be enabled"
                    fi

                    # Remove the service file
                    log_info "Removing service file: $service_file"
                    if rm "$service_file" 2>/dev/null; then
                        log_success "Service file removed"
                    else
                        log_error "Failed to remove service file (may require sudo)"
                        log_info "Try: sudo rm $service_file"
                    fi

                    # Reload systemd
                    log_info "Reloading systemd daemon..."
                    if systemctl daemon-reload; then
                        log_success "Systemd daemon reloaded"
                    else
                        log_error "Failed to reload systemd daemon"
                    fi
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
