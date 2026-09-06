#!/bin/bash

# Scan all network interfaces
scan_interfaces() {
    log_info "Scanning all network interfaces..."

    ALL_INTERFACES=()
    echo -e "${CYAN}Available Network Interfaces:${NC}"
    echo "----------------------------------------"

    interface_count=0

    # Use ip command to get all interfaces (most reliable method)
    while IFS= read -r line; do
        # Extract interface name from lines like "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP>"
        interface=$(echo "$line" | awk -F': ' '{print $2}')

        if [[ -n "$interface" && "$interface" != "lo" ]]; then
            ALL_INTERFACES+=("$interface")
            interface_count=$((interface_count + 1))

            # Get interface information
            ip_addr=$(ip addr show "$interface" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1 || echo "No IP")
            mac_addr=$(echo "$line" | grep -oP 'link/ether \K[a-f0-9:]+' || ip link show "$interface" 2>/dev/null | grep -oP 'link/ether \K[a-f0-9:]+' || echo "No MAC")
            state=$(echo "$line" | grep -oP 'state \K\w+' || echo "UNKNOWN")

            # Get interface status using the same logic as get_interface_status()
            status_result=$(get_interface_status "$interface")
            status_color=$(echo "$status_result" | cut -d'|' -f1)
            status_text=$(echo "$status_result" | cut -d'|' -f2)

            printf "%-15s ${status_color}%-12s${NC} IP:%-15s MAC:%s\n" \
                "$interface" "$status_text" "$ip_addr" "$mac_addr"
        fi
    done < <(ip link show 2>/dev/null)

    echo "----------------------------------------"
    log_success "Found ${#ALL_INTERFACES[@]} network interfaces"

    if [ ${#ALL_INTERFACES[@]} -eq 0 ]; then
        log_error "No network interfaces found!"
        log_warning "This system may not have any network interfaces configured."
        log_warning "NAT Gateway requires at least 2 network interfaces (WAN and LAN)."
        echo ""
        echo "Press Enter to exit..."
        read
        exit 1
    fi
}

# Load cached configuration
load_cache() {
    if [[ -f "$CACHE_FILE" ]]; then
        log_info "Loading cached configuration from: $CACHE_FILE"

        if ! validate_config_file; then
            log_error "Configuration file validation failed"
            return 1
        fi

        if ! source "$CACHE_FILE" 2>/dev/null; then
            log_error "Failed to load configuration file: $CACHE_FILE"
            log_error "File may be corrupted"
            return 1
        fi

        if [[ -n "$WAN_KEYWORD" && -n "$LAN_KEYWORD" ]]; then
            log_success "Found cached keywords:"
            log_info "  WAN Keyword: $WAN_KEYWORD"
            log_info "  LAN Keyword: $LAN_KEYWORD"
            log_info "  System Sharing: $SYSTEM_SHARING"

            echo -e "${CYAN}Current matches for cached keywords:${NC}"

            # Check WAN matches
            local wan_matches=($(find_interface_by_keyword "$WAN_KEYWORD"))
            if [[ ${#wan_matches[@]} -gt 0 ]]; then
                echo -e "${GREEN}WAN keyword '$WAN_KEYWORD' matches:${NC}"
                for interface in "${wan_matches[@]}"; do
                    status_result=$(get_interface_status "$interface")
                    status_color=$(echo "$status_result" | cut -d'|' -f1)
                    status_text=$(echo "$status_result" | cut -d'|' -f2)
                    echo -e "  - $interface (${status_color}${status_text}${NC})"
                done
            else
                echo -e "${RED}WAN keyword '$WAN_KEYWORD' matches: None${NC}"
            fi

            # Check LAN matches
            local lan_matches=($(find_interface_by_keyword "$LAN_KEYWORD"))
            if [[ ${#lan_matches[@]} -gt 0 ]]; then
                echo -e "${GREEN}LAN keyword '$LAN_KEYWORD' matches:${NC}"
                for interface in "${lan_matches[@]}"; do
                    status_result=$(get_interface_status "$interface")
                    status_color=$(echo "$status_result" | cut -d'|' -f1)
                    status_text=$(echo "$status_result" | cut -d'|' -f2)
                    echo -e "  - $interface (${status_color}${status_text}${NC})"
                done
            else
                echo -e "${RED}LAN keyword '$LAN_KEYWORD' matches: None${NC}"
            fi

            return 0
        fi
    fi
    return 1
}

# Save configuration to cache
save_cache() {
    $USE_SUDO tee "$CACHE_FILE" > /dev/null << EOF
# NAT Gateway Configuration Cache
WAN_KEYWORD="$WAN_KEYWORD"
LAN_KEYWORD="$LAN_KEYWORD"
WAN_INTERFACE="$WAN_INTERFACE"
LAN_INTERFACE="$LAN_INTERFACE"
SYSTEM_SHARING="$SYSTEM_SHARING"
EOF
    $USE_SUDO chmod 644 "$CACHE_FILE"
    log_info "Configuration saved to cache: $CACHE_FILE"
}

# Find interface by keyword
find_interface_by_keyword() {
    local keyword="$1"
    local found_interfaces=()

    for interface in "${ALL_INTERFACES[@]}"; do
        if [[ "$interface" == *"$keyword"* ]]; then
            found_interfaces+=("$interface")
        fi
    done

    echo "${found_interfaces[@]}"
}

# Get interface status (returns status_color and status_text)
get_interface_status() {
    local interface="$1"
    local state=""
    local carrier=""
    local ip_link_state=""
    local has_ip="no"
    local status_color="${RED}"
    local status_text="OFFLINE"
    
    if [[ -n "$interface" ]]; then
        state=$(cat /sys/class/net/$interface/operstate 2>/dev/null || echo "unknown")
        carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")
        
        # Check if interface has IP address (more reliable indicator)
        if ip addr show "$interface" 2>/dev/null | grep -q "inet "; then
            has_ip="yes"
        fi
        
        # Check ip link show output for UP flag (more reliable than operstate for USB/virtual interfaces)
        ip_link_state=$(ip link show "$interface" 2>/dev/null | grep -oE "<[^>]*>" | head -1)
        
        # Interface is considered ONLINE if:
        # 1. operstate is "up" AND carrier is "1", OR
        # 2. ip link shows UP flag AND (carrier is "1" OR has IP address), OR
        # 3. has IP address AND carrier is "1" (for USB/virtual interfaces with unknown operstate)
        if [[ "$state" == "up" && "$carrier" == "1" ]]; then
            status_color="${GREEN}"
            status_text="ONLINE"
        elif [[ "$ip_link_state" == *"UP"* ]] && ([[ "$carrier" == "1" ]] || [[ "$has_ip" == "yes" ]]); then
            status_color="${GREEN}"
            status_text="ONLINE"
        elif [[ "$has_ip" == "yes" && "$carrier" == "1" ]]; then
            status_color="${GREEN}"
            status_text="ONLINE"
        elif [[ "$state" == "up" ]] || [[ "$ip_link_state" == *"UP"* ]] || [[ "$has_ip" == "yes" ]]; then
            status_color="${YELLOW}"
            status_text="NO-CARRIER"
        fi
    fi
    
    echo "$status_color|$status_text"
}

# Display interface status with label
display_interface_status() {
    local label="$1"
    local interface="$2"
    
    if [[ -z "$interface" ]]; then
        echo -e "  ${label}: ${RED}No matching interface${NC}"
        return
    fi
    
    local status_result=$(get_interface_status "$interface")
    local status_color=$(echo "$status_result" | cut -d'|' -f1)
    local status_text=$(echo "$status_result" | cut -d'|' -f2)
    
    echo -e "  ${label}: $interface (${status_color}${status_text}${NC})"
}

# Display multiple interface matches
display_interface_matches() {
    local label="$1"
    local keyword="$2"
    local matches=($(find_interface_by_keyword "$keyword"))
    
    if [[ ${#matches[@]} -gt 0 ]]; then
        for interface in "${matches[@]}"; do
            local status_result=$(get_interface_status "$interface")
            local status_color=$(echo "$status_result" | cut -d'|' -f1)
            local status_text=$(echo "$status_result" | cut -d'|' -f2)
            
            # Get IP address if available
            local ip_addr=$(ip addr show "$interface" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1 || echo "")
            if [[ -n "$ip_addr" ]]; then
                echo -e "  ${label}: $interface (${status_color}${status_text}${NC}) IP: $ip_addr"
            else
                echo -e "  ${label}: $interface (${status_color}${status_text}${NC})"
            fi
        done
    else
        echo -e "  ${label}: ${RED}No matching interface${NC}"
    fi
}

# Get routing statistics from iptables or /proc/net/dev
get_routing_statistics() {
    local wan_if="$1"
    local lan_if="$2"
    
    if [[ -z "$wan_if" ]] || [[ -z "$lan_if" ]]; then
        echo "0|0"
        return
    fi
    
    # Try to get from iptables FORWARD chain first (most accurate for forwarded traffic)
    local forward_out_bytes=0
    local forward_in_bytes=0
    
    # Get forwarded bytes from iptables FORWARD chain
    # iptables -L FORWARD -v -n -x output: pkts bytes target prot opt in out
    local forward_rule=$(iptables -L FORWARD -v -n -x 2>/dev/null | grep -E "${lan_if}.*${wan_if}" | head -1)
    if [[ -n "$forward_rule" ]]; then
        forward_out_bytes=$(echo "$forward_rule" | awk '{print $2}')
    fi
    
    local reverse_rule=$(iptables -L FORWARD -v -n -x 2>/dev/null | grep -E "${wan_if}.*${lan_if}" | head -1)
    if [[ -n "$reverse_rule" ]]; then
        forward_in_bytes=$(echo "$reverse_rule" | awk '{print $2}')
    fi
    
    # Fallback to /proc/net/dev if iptables stats are not available
    # /proc/net/dev format: interface rx_bytes rx_packets ... tx_bytes tx_packets
    # Fields: rx_bytes(2), tx_bytes(10)
    if [[ "$forward_out_bytes" == "0" ]] || [[ -z "$forward_out_bytes" ]]; then
        if [[ -f /proc/net/dev ]]; then
            # Get transmitted bytes from LAN (outgoing) and received bytes from WAN (incoming)
            local lan_tx=$(grep "^[[:space:]]*${lan_if}:" /proc/net/dev | awk '{print $10}')
            local wan_rx=$(grep "^[[:space:]]*${wan_if}:" /proc/net/dev | awk '{print $2}')
            
            if [[ -n "$lan_tx" ]] && [[ "$lan_tx" =~ ^[0-9]+$ ]]; then
                forward_out_bytes="$lan_tx"
            fi
            if [[ -n "$wan_rx" ]] && [[ "$wan_rx" =~ ^[0-9]+$ ]]; then
                # For incoming, we estimate forwarded traffic from WAN received bytes
                # This is an approximation since WAN receives both forwarded and system traffic
                forward_in_bytes="$wan_rx"
            fi
        fi
    fi
    
    # Ensure we have numeric values
    forward_out_bytes=${forward_out_bytes:-0}
    forward_in_bytes=${forward_in_bytes:-0}
    
    echo "${forward_out_bytes}|${forward_in_bytes}"
}

# Format bytes to human readable (KB, MB, GB)
format_bytes() {
    local bytes="$1"
    if [[ -z "$bytes" ]] || [[ "$bytes" == "0" ]]; then
        echo "0 B"
        return
    fi
    
    if [[ $bytes -lt 1024 ]]; then
        echo "${bytes} B"
    elif [[ $bytes -lt 1048576 ]]; then
        local kb=$((bytes / 1024))
        echo "${kb} KB"
    elif [[ $bytes -lt 1073741824 ]]; then
        local mb=$((bytes / 1048576))
        echo "${mb} MB"
    else
        local gb=$(awk "BEGIN {printf \"%.2f\", $bytes/1073741824}")
        echo "${gb} GB"
    fi
}

# Input keywords for interface matching
input_keywords() {
    if [[ -z "$WAN_KEYWORD" ]]; then
        while true; do
            echo -e "${CYAN}Enter keyword for WAN interface (external/internet connection):${NC}"
            echo -e "${YELLOW}Examples: usb, wlan, eth0, enp, wlp${NC}"
            read -p "WAN Keyword: " WAN_KEYWORD

            if [[ -z "$WAN_KEYWORD" ]]; then
                log_error "WAN keyword cannot be empty"
                continue
            fi

            # Check if keyword matches any interface
            local matched_interfaces=($(find_interface_by_keyword "$WAN_KEYWORD"))

            if [[ ${#matched_interfaces[@]} -eq 0 ]]; then
                log_error "No interface found matching keyword: $WAN_KEYWORD"
                echo -e "${YELLOW}Available interfaces: ${ALL_INTERFACES[*]}${NC}"
                WAN_KEYWORD=""
                continue
            fi

            echo -e "${GREEN}Found ${#matched_interfaces[@]} interface(s) matching '$WAN_KEYWORD':${NC}"
            for interface in "${matched_interfaces[@]}"; do
                status_result=$(get_interface_status "$interface")
                status_color=$(echo "$status_result" | cut -d'|' -f1)
                status_text=$(echo "$status_result" | cut -d'|' -f2)
                echo -e "  - $interface (${status_color}${status_text}${NC})"
            done

            echo -e "${YELLOW}Use keyword '$WAN_KEYWORD' for WAN interface? (y/n):${NC}"
            read -n 1 -r confirm
            echo

            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                break
            else
                WAN_KEYWORD=""
            fi
        done
    fi

    if [[ -z "$LAN_KEYWORD" ]]; then
        while true; do
            echo -e "${CYAN}Enter keyword for LAN interface (internal network):${NC}"
            echo -e "${YELLOW}Examples: eth, enp, eno, lan${NC}"
            read -p "LAN Keyword: " LAN_KEYWORD

            if [[ -z "$LAN_KEYWORD" ]]; then
                log_error "LAN keyword cannot be empty"
                continue
            fi

            # Check if keyword matches any interface (excluding WAN matches)
            local matched_interfaces=($(find_interface_by_keyword "$LAN_KEYWORD"))
            local filtered_interfaces=()
            local wan_matched_interfaces=($(find_interface_by_keyword "$WAN_KEYWORD"))

            # Filter out interfaces that are already matched by WAN keyword
            for interface in "${matched_interfaces[@]}"; do
                local is_wan_match=false
                for wan_interface in "${wan_matched_interfaces[@]}"; do
                    if [[ "$interface" == "$wan_interface" ]]; then
                        is_wan_match=true
                        break
                    fi
                done

                if [[ "$is_wan_match" == false ]]; then
                    filtered_interfaces+=("$interface")
                fi
            done

            if [[ ${#filtered_interfaces[@]} -eq 0 ]]; then
                log_error "No interface found matching keyword: $LAN_KEYWORD (excluding WAN matches)"
                echo -e "${YELLOW}Available interfaces: ${ALL_INTERFACES[*]}${NC}"
                echo -e "${YELLOW}WAN keyword '$WAN_KEYWORD' will be excluded from LAN matches${NC}"
                LAN_KEYWORD=""
                continue
            fi

            echo -e "${GREEN}Found ${#filtered_interfaces[@]} interface(s) matching '$LAN_KEYWORD':${NC}"
            for interface in "${filtered_interfaces[@]}"; do
                status_result=$(get_interface_status "$interface")
                status_color=$(echo "$status_result" | cut -d'|' -f1)
                status_text=$(echo "$status_result" | cut -d'|' -f2)
                echo -e "  - $interface (${status_color}${status_text}${NC})"
            done

            echo -e "${YELLOW}Use keyword '$LAN_KEYWORD' for LAN interface? (y/n):${NC}"
            read -n 1 -r confirm
            echo

            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                break
            else
                LAN_KEYWORD=""
            fi
        done
    fi

    # Ask about system sharing
    echo -e "${CYAN}Do you want to enable system-level network sharing for matched interfaces?${NC}"
    echo -e "${YELLOW}If 'no', interfaces will only be used for forwarding without system sharing.${NC}"
    read -p "Enable system sharing? (y/n) [no]: " sharing_response
    if [[ "$sharing_response" =~ ^[Yy]([Ee][Ss])?$ ]]; then
        SYSTEM_SHARING="yes"
    else
        SYSTEM_SHARING="no"
    fi

    log_success "Keywords configured:"
    log_info "  WAN: $WAN_KEYWORD"
    log_info "  LAN: $LAN_KEYWORD"
    log_info "  System Sharing: $SYSTEM_SHARING"

    return 0
}

# Match interfaces based on keywords
match_interfaces() {
    log_info "Matching interfaces with keywords..."

    WAN_INTERFACE=""
    LAN_INTERFACE=""

    # Find WAN interface
    for interface in "${ALL_INTERFACES[@]}"; do
        if [[ "$interface" == *"$WAN_KEYWORD"* ]]; then
            WAN_INTERFACE="$interface"
            log_success "WAN interface matched: $interface (keyword: $WAN_KEYWORD)"
            break
        fi
    done

    # Find LAN interface
    for interface in "${ALL_INTERFACES[@]}"; do
        if [[ "$interface" == *"$LAN_KEYWORD"* && "$interface" != "$WAN_INTERFACE" ]]; then
            LAN_INTERFACE="$interface"
            log_success "LAN interface matched: $interface (keyword: $LAN_KEYWORD)"
            break
        fi
    done

    # Validate matches
    if [[ -z "$WAN_INTERFACE" ]]; then
        log_error "No interface found matching WAN keyword: $WAN_KEYWORD"
        log_info "Available interfaces: ${ALL_INTERFACES[*]}"
        return 1
    fi

    if [[ -z "$LAN_INTERFACE" ]]; then
        log_error "No interface found matching LAN keyword: $LAN_KEYWORD"
        log_info "Available interfaces: ${ALL_INTERFACES[*]}"
        return 1
    fi

    log_success "Interface matching completed:"
    log_info "  WAN: $WAN_INTERFACE"
    log_info "  LAN: $LAN_INTERFACE"

    # Save configuration
    save_cache

    return 0
}

# Create /usr/local/bin/natgateway command link
create_natgateway_command() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
        echo -e "${WHITE} Creating natgateway Command${NC}"
    echo -e "${CYAN}========================================${NC}"

    current_script="$REAL_SCRIPT_PATH"

    # Set script to executable with 777 permissions
    $USE_SUDO chmod 777 "$current_script"
    log_success "Script permissions set to 777"
    log_info "  Source: $current_script"

    if [ -L "$NATGATEWAY_LINK" ]; then
        existing_target=$(readlink -f "$NATGATEWAY_LINK")
        if [ "$existing_target" != "$current_script" ]; then
            log_info "Updating existing symlink..."
            $USE_SUDO rm -f "$NATGATEWAY_LINK"
            $USE_SUDO ln -s "$current_script" "$NATGATEWAY_LINK"
            log_success "Command symlink updated: $NATGATEWAY_LINK -> $current_script"
        else
            log_success "Command symlink already exists and is correct"
        fi
    else
        $USE_SUDO ln -s "$current_script" "$NATGATEWAY_LINK"
        log_success "Command symlink created: $NATGATEWAY_LINK -> $current_script"
    fi

    # Verify the symlink
    if [ -L "$NATGATEWAY_LINK" ]; then
        local link_target=$(readlink -f "$NATGATEWAY_LINK")
        log_info "  Symlink verification:"
        log_info "    Link: $NATGATEWAY_LINK"
        log_info "    Target: $link_target"

        if [ "$link_target" = "$current_script" ]; then
            log_success "  Symlink is correctly pointing to the script"
        else
            log_warning "  Symlink target mismatch!"
        fi
    fi

    echo ""
    echo -e "${GREEN}'natgateway' command is now available${NC}"
    echo -e "${YELLOW}  You can run 'natgateway' from anywhere to:${NC}"
    echo -e "    - View router status"
    echo -e "    - Modify configuration"
    echo -e "    - Manage the routing service"
    echo -e "    - View system logs"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    return 0
}

