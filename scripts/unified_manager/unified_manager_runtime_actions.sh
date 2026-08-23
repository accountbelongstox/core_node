#!/bin/bash

unified_action_launch() {
    local command="$1"
    local working_dir="$2"

    # Launch application
    echo ""
    log_header "Launching Application"
    echo ""
    
    execute_command "$command" "$working_dir"
    
    echo ""
    log_warning "Press any key to return to menu..."
    read -n 1
}

unified_action_restart() {
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
}

unified_action_stop() {
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
}

unified_action_kill() {
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
}

unified_action_view_logs() {
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
}

unified_action_service_delete() {
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
}

