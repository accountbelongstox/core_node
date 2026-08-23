#!/bin/bash

unified_action_service_create() {
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
}

unified_action_build_service_create() {
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
}

unified_action_build_proxy_create() {
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
                    log_success "[OK] Nginx proxy configured for: $domain"
                    ((success_count++))
                else
                    log_error "[ERROR] Failed to configure proxy for: $domain"
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
        log_success "[OK] All steps completed successfully"
    
        # Use unified print function
        local build_service_name="webapp-$app_name$BUILD_SERVICE_SUFFIX"
        print_service_info "$build_service_name" "$app_name" "$port" "$domains_string"
    else
        log_warning "[WARN] Some steps failed - check above for details"
    fi
    
    echo ""
    log_warning "Press any key to continue..."
    read -n 1
}

unified_action_proxy_create() {
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
                    log_success "[OK] Nginx proxy configured for: $domain"
                    ((success_count++))
                else
                    log_error "[ERROR] Failed to configure proxy for: $domain"
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
        log_success "[OK] All steps completed successfully"
    
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
        log_warning "[WARN] Some steps failed - please check above for details"
        log_info "You can retry failed steps manually"
    fi
    
    echo ""
    log_warning "Press any key to continue..."
    read -n 1
}

