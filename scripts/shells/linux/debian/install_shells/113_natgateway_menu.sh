#!/bin/bash

# Show interactive status
show_status() {
        log_header "NAT Gateway Status"

    # Load configuration
    if [ -f "$CACHE_FILE" ]; then
        source "$CACHE_FILE"

        echo -e "${CYAN}Configuration:${NC}"
        echo "  WAN Keyword: $WAN_KEYWORD"
        echo "  LAN Keyword: $LAN_KEYWORD"

        # Display system sharing with detailed explanation
        if [ "$SYSTEM_SHARING" = "yes" ]; then
            echo -e "  System Sharing: ${GREEN}$SYSTEM_SHARING${NC} ${GREEN}{NC}"
            echo -e "    ${WHITE}System CAN use WAN for internet access${NC}"
        else
            echo -e "  System Sharing: ${YELLOW}$SYSTEM_SHARING${NC} ${RED}{NC}"
            echo -e "    ${WHITE}System CANNOT use WAN (only LAN forwarding)${NC}"
        fi
        echo ""

        # Scan interfaces
        scan_interfaces

        # Check current matches
        echo -e "${CYAN}Current Interface Matches:${NC}"
        display_interface_matches "WAN" "$WAN_KEYWORD"
        display_interface_matches "LAN" "$LAN_KEYWORD"
        
        # Show NAT Gateway status and statistics
        echo ""
        echo -e "${CYAN}NAT Gateway Status:${NC}"
        local ip_forward=$(cat /proc/sys/net/ipv4/ip_forward 2>/dev/null || echo "0")
        if [[ "$ip_forward" == "1" ]]; then
            echo -e "  IP Forwarding: ${GREEN}Enabled${NC} (packets can be forwarded between interfaces)"
            
            # Get current matched interfaces for statistics
            local wan_matches=($(find_interface_by_keyword "$WAN_KEYWORD"))
            local lan_matches=($(find_interface_by_keyword "$LAN_KEYWORD"))
            
            if [[ ${#wan_matches[@]} -gt 0 ]] && [[ ${#lan_matches[@]} -gt 0 ]]; then
                local current_wan="${wan_matches[0]}"
                local current_lan="${lan_matches[0]}"
                
                # Check if routing is actually active (iptables rules exist)
                # Use iptables -C for reliable checking (same method as service script)
                # Need to find iptables command and use sudo if needed
                local iptables_cmd=""
                if command_exists iptables; then
                    iptables_cmd="iptables"
                elif [ -x /usr/sbin/iptables ]; then
                    iptables_cmd="/usr/sbin/iptables"
                elif [ -x /sbin/iptables ]; then
                    iptables_cmd="/sbin/iptables"
                fi
                
                local nat_rule_exists=false
                local fwd_rule_exists=false
                
                # Check NAT rule using iptables -C (most reliable)
                # Use sudo if available and not running as root
                if [[ -n "$iptables_cmd" ]]; then
                    if [[ $EUID -eq 0 ]]; then
                        # Running as root, no sudo needed
                        if $iptables_cmd -t nat -C POSTROUTING -o "$current_wan" -j MASQUERADE 2>/dev/null; then
                            nat_rule_exists=true
                        fi
                        
                        # Check FORWARD rules (both directions)
                        if $iptables_cmd -C FORWARD -i "$current_lan" -o "$current_wan" -j ACCEPT 2>/dev/null && \
                           $iptables_cmd -C FORWARD -i "$current_wan" -o "$current_lan" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null; then
                            fwd_rule_exists=true
                        fi
                    elif [[ -n "$USE_SUDO" ]]; then
                        # Use sudo for iptables check
                        if $USE_SUDO $iptables_cmd -t nat -C POSTROUTING -o "$current_wan" -j MASQUERADE 2>/dev/null; then
                            nat_rule_exists=true
                        fi
                        
                        # Check FORWARD rules (both directions)
                        if $USE_SUDO $iptables_cmd -C FORWARD -i "$current_lan" -o "$current_wan" -j ACCEPT 2>/dev/null && \
                           $USE_SUDO $iptables_cmd -C FORWARD -i "$current_wan" -o "$current_lan" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null; then
                            fwd_rule_exists=true
                        fi
                    else
                        # Try without sudo (may work if user has CAP_NET_ADMIN capability)
                        if $iptables_cmd -t nat -C POSTROUTING -o "$current_wan" -j MASQUERADE 2>/dev/null; then
                            nat_rule_exists=true
                        fi
                        
                        # Check FORWARD rules (both directions)
                        if $iptables_cmd -C FORWARD -i "$current_lan" -o "$current_wan" -j ACCEPT 2>/dev/null && \
                           $iptables_cmd -C FORWARD -i "$current_wan" -o "$current_lan" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null; then
                            fwd_rule_exists=true
                        fi
                    fi
                fi
                
                if [[ "$nat_rule_exists" == true ]] && [[ "$fwd_rule_exists" == true ]]; then
                    echo -e "  NAT Gateway: ${GREEN}Active${NC}"
                    echo -e "    WAN Interface: $current_wan"
                    echo -e "    LAN Interface: $current_lan"
                    
                    # Get LAN gateway IP for display
                    local lan_ip=$(ip addr show "$current_lan" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1)
                    if [[ -n "$lan_ip" ]]; then
                        echo -e "    LAN Gateway IP: ${GREEN}$lan_ip${NC}"
                    fi
                    
                    # Get traffic statistics
                    local stats=$(get_routing_statistics "$current_wan" "$current_lan")
                    local tx_bytes=$(echo "$stats" | cut -d'|' -f1)
                    local rx_bytes=$(echo "$stats" | cut -d'|' -f2)
                    
                    local tx_formatted=$(format_bytes "$tx_bytes")
                    local rx_formatted=$(format_bytes "$rx_bytes")
                    
                    echo -e "  NAT Forwarded Traffic:"
                    echo -e "    ${CYAN}Outbound (LAN->WAN):${NC} $tx_formatted"
                    echo -e "    ${CYAN}Inbound (WAN->LAN):${NC} $rx_formatted"
                    
                    # Display router configuration instructions
                    if [[ -n "$lan_ip" ]]; then
                        local lan_cidr=$(ip addr show "$current_lan" 2>/dev/null | grep -oP 'inet \K[\d.]+/\d+' | head -1 | cut -d'/' -f2)
                        local lan_subnet=$(echo "$lan_ip" | cut -d. -f1-3)
                        echo ""
                        echo -e "  ${CYAN}Connected Router Configuration:${NC}"
                        echo -e "    Gateway: ${GREEN}$lan_ip${NC}"
                        echo -e "    Subnet: ${GREEN}${lan_subnet}.0/$lan_cidr${NC}"
                        echo -e "    DNS: ${GREEN}8.8.8.8${NC} or ${GREEN}1.1.1.1${NC}"
                    fi
                else
                    echo -e "  NAT Gateway: ${YELLOW}Not Active${NC} (waiting for interfaces to be ready)"
                    echo -e "    ${YELLOW}Service will automatically configure when both interfaces are available${NC}"
                fi
            else
                echo -e "  NAT Gateway: ${YELLOW}Not Active${NC} (interfaces not matched)"
            fi
        else
            echo -e "  IP Forwarding: ${RED}Disabled${NC}"
            echo -e "  ${YELLOW}NAT Gateway requires IP forwarding to be enabled${NC}"
        fi

        # Check service status with detailed information
        echo ""
        echo -e "${CYAN}Service Status:${NC}"
        local full_service_name="ncore-$SERVICE_NAME"
        
        # Check if service unit exists
        if ! service_exists "$full_service_name"; then
            echo -e "  ${YELLOW}Service unit file does not exist${NC}"
            echo -e "  ${YELLOW}(Use Start/Restart Service to create and start the service)${NC}"
        else
            # Get detailed service status
            local service_status=""
            if $USE_SUDO systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
                echo -e "  ${GREEN}Service is running${NC}"
                # Get PID to verify it's actually running
                local service_pid=$($USE_SUDO systemctl show -p MainPID --value "$full_service_name" 2>/dev/null)
                if [ -n "$service_pid" ] && [ "$service_pid" != "0" ]; then
                    if ps -p "$service_pid" > /dev/null 2>&1; then
                        echo -e "  ${GREEN}Process ID: $service_pid${NC}"
                    else
                        echo -e "  ${YELLOW}Warning: Process $service_pid not found (service may be restarting)${NC}"
                    fi
                fi
            elif $USE_SUDO systemctl is-failed --quiet "$full_service_name" 2>/dev/null; then
                echo -e "  ${RED}Service has failed${NC}"
                echo -e "  ${YELLOW}Check logs: journalctl -u $full_service_name -n 50${NC}"
            else
                echo -e "  ${RED}Service is not running${NC}"
                # Check if it's enabled but not started
                if $USE_SUDO systemctl is-enabled --quiet "$full_service_name" 2>/dev/null; then
                    echo -e "  ${YELLOW}(Service is enabled but not active - use Start/Restart Service)${NC}"
                fi
            fi
        fi
        
        # Show service logs
        echo ""
        echo -e "${CYAN}Service Logs (Last 20 entries):${NC}"
        echo -e "${YELLOW}----------------------------------------${NC}"
        if service_exists "$full_service_name"; then
            # Show recent logs, but only if service exists
            if $USE_SUDO journalctl -u "$full_service_name" -n 20 --no-pager 2>/dev/null | head -30; then
                echo ""
            else
                echo -e "  ${YELLOW}No logs available yet${NC}"
            fi
        else
            echo -e "  ${YELLOW}Service not created yet - no logs available${NC}"
        fi
        echo -e "${YELLOW}----------------------------------------${NC}"
    else
        log_warning "No configuration found. Please run setup first."
    fi
}

# Helper function to wait for user input
wait_for_continue() {
    echo ""
    read -p "Press Enter to continue..."
}

# Interactive menu when command is run
show_interactive_menu() {
    local option=0
    local selected_index=0
    local -a menu_items=(
        "Show Status"
        "Modify WAN Keyword"
        "Modify LAN Keyword"
        "Toggle System Sharing"
        "Start/Restart Service"
        "Stop Service"
        "View Logs"
        "Exit NAT Gateway"
    )

    while true; do
        arrow_menu_select "NAT Gateway" menu_items "$selected_index" 7
        selected_index=$ARROW_MENU_SELECTED_INDEX
        if [ "$selected_index" -eq 7 ]; then
            option=0
        else
            option=$((selected_index + 1))
        fi

        case "$option" in
            1)
                show_status
                wait_for_continue
                ;;
            2)
                scan_interfaces
                WAN_KEYWORD=""
                input_keywords
                save_cache
                log_success "Configuration updated. Please restart the service for changes to take effect."
                wait_for_continue
                ;;
            3)
                scan_interfaces
                LAN_KEYWORD=""
                input_keywords
                save_cache
                log_success "Configuration updated. Please restart the service for changes to take effect."
                wait_for_continue
                ;;
            4)
                if [ -f "$CACHE_FILE" ]; then
                    source "$CACHE_FILE"

                    echo ""
                    echo -e "${CYAN}System Sharing Configuration${NC}"
                    echo -e "${YELLOW}----------------------------------------${NC}"
                    echo -e "Current status: ${GREEN}$SYSTEM_SHARING${NC}"
                    echo ""
                    echo -e "${WHITE}What is System Sharing?${NC}"
                    if [ "$SYSTEM_SHARING" = "yes" ]; then
                        echo -e "  ${GREEN}ENABLED${NC} - The system (this machine) CAN use WAN for internet"
                        echo -e "    - System traffic goes through WAN interface"
                        echo -e "    - Default route set via WAN gateway"
                        echo -e "    - Both system and LAN clients share WAN internet"
                        echo ""
                        echo -e "${YELLOW}Do you want to DISABLE system sharing?${NC}"
                        echo -e "  If disabled, only LAN clients can use WAN (not this system)"
                    else
                        echo -e "  ${RED}DISABLED${NC} - The system (this machine) CANNOT use WAN for internet"
                        echo -e "    - System traffic does NOT go through WAN"
                        echo -e "    - Only LAN -> WAN forwarding works"
                        echo -e "    - Only LAN clients can access internet via WAN"
                        echo ""
                        echo -e "${YELLOW}Do you want to ENABLE system sharing?${NC}"
                        echo -e "  If enabled, this system can also use WAN for internet"
                    fi
                    echo ""
                    read -p "Toggle system sharing? (y/n): " -n 1 -r toggle_response
                    echo ""

                    if [[ "$toggle_response" =~ ^[Yy]$ ]]; then
                        local old_sharing="$SYSTEM_SHARING"
                        if [ "$SYSTEM_SHARING" = "yes" ]; then
                            SYSTEM_SHARING="no"
                            log_info "System sharing disabled"
                            echo -e "${YELLOW}System will NOT use WAN for internet (only forwarding LAN -> WAN)${NC}"
                        else
                            SYSTEM_SHARING="yes"
                            log_info "System sharing enabled"
                            echo -e "${GREEN}System will use WAN for internet access${NC}"
                        fi
                        save_cache
                        log_success "Configuration updated."
                        
                        # Check if service exists and is running
                        local full_service_name="ncore-$SERVICE_NAME"
                        if service_exists "$full_service_name" && $USE_SUDO systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
                            echo ""
                            echo -e "${CYAN}Restarting service to apply changes immediately...${NC}"
                            if $USE_SUDO systemctl restart "$full_service_name" 2>/dev/null; then
                                # Wait a moment for service to restart
                                sleep 2
                                
                                # Verify service is running
                                if $USE_SUDO systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
                                    log_success "Service restarted successfully. Changes are now active."
                                    
                                    # If enabling sharing (no -> yes), verify default route exists
                                    if [[ "$old_sharing" == "no" ]] && [[ "$SYSTEM_SHARING" == "yes" ]]; then
                                        echo ""
                                        echo -e "${CYAN}Verifying system sharing is active...${NC}"
                                        local wan_matches=($(find_interface_by_keyword "$WAN_KEYWORD"))
                                        if [[ ${#wan_matches[@]} -gt 0 ]]; then
                                            local current_wan="${wan_matches[0]}"
                                            local default_route=$(ip route | grep "default.*$current_wan" | head -1)
                                            if [[ -n "$default_route" ]]; then
                                                echo -e "  ${GREEN}Default route via $current_wan: OK${NC}"
                                                echo -e "  ${GREEN}System can now access internet via WAN${NC}"
                                            else
                                                echo -e "  ${YELLOW}Default route not found yet, checking service logs...${NC}"
                                                echo -e "  ${YELLOW}  Service may need a few seconds to detect WAN gateway${NC}"
                                            fi
                                        fi
                                    fi
                                else
                                    log_warning "Service restarted but may not be running. Check status manually."
                                fi
                            else
                                log_error "Failed to restart service. Use Start/Restart Service."
                            fi
                        else
                            log_warning "Service is not running. Use Start/Restart Service for changes to take effect."
                        fi
                    else
                        log_info "System sharing unchanged: $SYSTEM_SHARING"
                    fi
                fi
                wait_for_continue
                ;;
            5)
                local full_service_name="ncore-$SERVICE_NAME"
                # Ensure service exists before trying to start/restart
                if ! ensure_service_exists; then
                    log_error "Cannot start/restart service - service creation failed"
                    echo ""
                    read -p "Press Enter to continue..."
                else
                    # Check if service is running
                    if $USE_SUDO systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
                        log_info "Service is running, restarting..."
                        if $USE_SUDO systemctl restart "$full_service_name"; then
                            log_success "Service restarted successfully"
                        else
                            log_error "Failed to restart service"
                        fi
                    else
                        log_info "Service is not running, starting..."
                        if $USE_SUDO systemctl start "$full_service_name"; then
                            log_success "Service started successfully"
                        else
                            log_error "Failed to start service"
                        fi
                    fi
                    wait_for_continue
                fi
                ;;
            6)
                local full_service_name="ncore-$SERVICE_NAME"
                # Check if service exists before trying to stop
                if ! service_exists "$full_service_name"; then
                    log_warning "Service does not exist, nothing to stop"
                    wait_for_continue
                else
                    log_info "Stopping service..."
                    if $USE_SUDO systemctl stop "$full_service_name"; then
                        log_success "Service stopped"
                        log_info "Disabling service from auto-start..."
                        if $USE_SUDO systemctl disable "$full_service_name"; then
                            log_success "Service disabled from auto-start"
                        else
                            log_error "Failed to disable service"
                        fi
                    else
                        log_error "Failed to stop service"
                    fi
                    wait_for_continue
                fi
                ;;
            7)
                local full_service_name="ncore-$SERVICE_NAME"
                if ! service_exists "$full_service_name"; then
                    log_warning "Service does not exist, no logs to view"
                    wait_for_continue
                else
                    echo -e "${CYAN}Recent logs (Ctrl+C to exit):${NC}"
                    $USE_SUDO journalctl -u "$full_service_name" -n 50 --no-pager
                    wait_for_continue
                fi
                ;;
            0)
                log_info "Exiting..."
                exit 0
                ;;
            *)
                log_error "Invalid option"
                wait_for_continue
                ;;
        esac
    done
}

