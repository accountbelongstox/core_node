#!/bin/bash
# NAT Gateway Monitor Service
# Monitors interface availability and manages NAT Gateway (IP forwarding + NAT + routing rules)

# Configuration
WAN_KEYWORD=""
LAN_KEYWORD=""
WAN_INTERFACE=""
LAN_INTERFACE=""
SYSTEM_SHARING="no"
CORE_NODE_DATA_DIR="/var/_core_node"
CONFIG_FILE="/var/_core_node/natgateway/interface_cache.conf"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log_service() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')][NATGATEWAY-SERVICE]${NC} $1" | tee -a /var/log/natgateway.log
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')][NATGATEWAY-ERROR]${NC} $1" | tee -a /var/log/natgateway.log
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')][NATGATEWAY-SUCCESS]${NC} $1" | tee -a /var/log/natgateway.log
}

# Load configuration
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
        # Only log when configuration values change (not every loop)
        # Use a file-based approach to track last config hash since variables don't persist in heredoc
        local config_hash="${WAN_KEYWORD}:${LAN_KEYWORD}:${SYSTEM_SHARING}"
        local hash_file="/tmp/.natgateway_last_config_hash"
        local last_hash=""
        
        if [[ -f "$hash_file" ]]; then
            last_hash=$(cat "$hash_file" 2>/dev/null || echo "")
        fi
        
        if [[ "$config_hash" != "$last_hash" ]]; then
            log_service "Configuration loaded: WAN=$WAN_KEYWORD, LAN=$LAN_KEYWORD, Sharing=$SYSTEM_SHARING"
            echo "$config_hash" > "$hash_file" 2>/dev/null || true
        fi
        return 0
    else
        log_error "Configuration file not found: $CONFIG_FILE"
        return 1
    fi
}

# Check if interface exists and is up
check_interface() {
    local interface="$1"
    if [[ -d "/sys/class/net/$interface" ]]; then
        local state=$(cat /sys/class/net/$interface/operstate 2>/dev/null || echo "down")
        local carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")
        
        # Check if interface has IP address
        local has_ip=$(ip addr show "$interface" 2>/dev/null | grep -q "inet " && echo "yes" || echo "no")
        
        # Check ip link show output for UP flag (more reliable than operstate for USB/virtual interfaces)
        local ip_link_output=$(ip link show "$interface" 2>/dev/null | head -1)
        local has_up_flag=false
        if [[ "$ip_link_output" == *"UP"* ]] || [[ "$ip_link_output" == *"state UP"* ]]; then
            has_up_flag=true
        fi
        
        # Consider interface up if:
        # 1. operstate is "up" AND (carrier is "1" OR has IP), OR
        # 2. ip link shows UP flag AND (carrier is "1" OR has IP), OR
        # 3. has IP address AND carrier is "1" (for USB/virtual interfaces with unknown operstate)
        if [[ "$state" == "up" ]]; then
            if [[ "$carrier" == "1" ]] || [[ "$has_ip" == "yes" ]]; then
                return 0
            fi
        elif [[ "$has_up_flag" == true ]]; then
            if [[ "$carrier" == "1" ]] || [[ "$has_ip" == "yes" ]]; then
                return 0
            fi
        elif [[ "$has_ip" == "yes" && "$carrier" == "1" ]]; then
            return 0
        fi
    fi
    return 1
}

# Find interface by keyword
find_interface() {
    local keyword="$1"
    for interface in /sys/class/net/*; do
        interface=$(basename "$interface")
        if [[ "$interface" != "lo" && "$interface" == *"$keyword"* ]]; then
            echo "$interface"
            return 0
        fi
    done
    return 1
}

# Configure LAN interface IP address (required for NAT gateway)
configure_lan_interface() {
    local lan_if="$1"
    
    # Check if interface has an IP address
    local lan_ip=$(ip addr show "$lan_if" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1)
    
    if [[ -z "$lan_ip" ]]; then
        # No IP configured, need to set one for gateway functionality
        # Default to 192.168.2.1/24 (can be customized later)
        local gateway_ip="192.168.2.1"
        local gateway_cidr="24"
        
        log_service "LAN interface $lan_if has no IP address"
        log_service "Configuring gateway IP: $gateway_ip/$gateway_cidr on $lan_if"
        
        # Check if NetworkManager is managing this interface
        local nm_managed=false
        if command -v nmcli >/dev/null 2>&1; then
            if nmcli device status 2>/dev/null | grep -q "$lan_if.*connected"; then
                nm_managed=true
                log_service "NetworkManager is managing $lan_if, configuring via nmcli..."
                # Try to configure via NetworkManager
                local conn_name=$(nmcli -t -f NAME,DEVICE connection show 2>/dev/null | grep ":$lan_if$" | cut -d: -f1 | head -1)
                if [[ -n "$conn_name" ]]; then
                    # Update existing connection
                    nmcli connection modify "$conn_name" ipv4.method manual ipv4.addresses "$gateway_ip/$gateway_cidr" ipv4.gateway "" 2>/dev/null || true
                    nmcli device reapply "$lan_if" 2>/dev/null || true
                    log_service "Configured $lan_if via NetworkManager connection: $conn_name"
                else
                    # Create new connection
                    nmcli connection add type ethernet ifname "$lan_if" ipv4.method manual ipv4.addresses "$gateway_ip/$gateway_cidr" ipv4.gateway "" connection.autoconnect yes 2>/dev/null || true
                    log_service "Created new NetworkManager connection for $lan_if"
                fi
                sleep 1
                # Verify
                lan_ip=$(ip addr show "$lan_if" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1)
                if [[ -n "$lan_ip" ]]; then
                    log_success "LAN interface IP configured via NetworkManager: $lan_ip"
                    return 0
                fi
            fi
        fi
        
        # If NetworkManager didn't work or isn't available, configure directly
        if [[ -z "$lan_ip" ]]; then
            log_service "Configuring $lan_if IP address directly..."
            if ip addr add "$gateway_ip/$gateway_cidr" dev "$lan_if" 2>/dev/null; then
                # Bring interface up if not already
                ip link set "$lan_if" up 2>/dev/null || true
                log_success "LAN interface IP configured: $gateway_ip/$gateway_cidr"
                
                # Verify
                lan_ip=$(ip addr show "$lan_if" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1)
                if [[ "$lan_ip" == "$gateway_ip" ]]; then
                    log_service "LAN gateway IP verified: $lan_ip"
                    return 0
                else
                    log_error "LAN IP configuration failed - got $lan_ip instead of $gateway_ip"
                    return 1
                fi
            else
                log_error "Failed to configure LAN interface IP address"
                return 1
            fi
        fi
    else
        log_service "LAN interface already has IP: $lan_ip"
        # Verify interface is up
        ip link set "$lan_if" up 2>/dev/null || true
        return 0
    fi
}

# Setup NAT Gateway (IP Forwarding + NAT + Routing Rules)
setup_routing() {
    local wan_if="$1"
    local lan_if="$2"

    log_service "Setting up NAT Gateway: LAN ($lan_if) -> WAN ($wan_if), System Sharing: $SYSTEM_SHARING"
    
    # Configure LAN interface IP address (required for NAT gateway)
    if ! configure_lan_interface "$lan_if"; then
        log_error "Failed to configure LAN interface IP address"
        log_error "LAN interface must have an IP address to function as a gateway"
        log_error "Routers connecting to $lan_if need a gateway IP to route traffic"
        return 1
    fi

    # Enable IP forwarding
    echo 1 > /proc/sys/net/ipv4/ip_forward

    # Clear existing rules (but be careful not to clear all rules on Ubuntu 24)
    # Only clear rules that match our interfaces to avoid conflicts with other services
    iptables -D FORWARD -i "$lan_if" -o "$wan_if" -j ACCEPT 2>/dev/null || true
    iptables -D FORWARD -i "$wan_if" -o "$lan_if" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
    iptables -t nat -D POSTROUTING -o "$wan_if" -j MASQUERADE 2>/dev/null || true

    # Setup NAT (Network Address Translation) - Masquerade LAN traffic through WAN IP
    log_service "Configuring NAT: Masquerade LAN ($lan_if) traffic through WAN ($wan_if)"
    if iptables -t nat -A POSTROUTING -o "$wan_if" -j MASQUERADE 2>&1; then
        log_service "NAT Masquerade rule configured successfully"
    else
        log_error "Failed to configure NAT rule (exit code: $?)"
    fi

    # Setup IP Forwarding Rules - Allow traffic flow between interfaces
    log_service "Configuring IP Forwarding: LAN ($lan_if) -> WAN ($wan_if)"
    local fwd1_output=$(iptables -A FORWARD -i "$lan_if" -o "$wan_if" -j ACCEPT 2>&1)
    local fwd1_exit=$?
    if [[ $fwd1_exit -eq 0 ]]; then
        log_service "FORWARD rule (LAN->WAN) command executed (exit: $fwd1_exit)"
        sleep 0.1
        if iptables -C FORWARD -i "$lan_if" -o "$wan_if" -j ACCEPT 2>/dev/null; then
            log_service "FORWARD rule (LAN->WAN) verified successfully"
        else
            log_error "FORWARD rule command succeeded but rule not found!"
        fi
    else
        log_error "Failed to add FORWARD rule (exit code: $fwd1_exit)"
        log_error "Error output: $fwd1_output"
    fi
    
    log_service "Configuring IP Forwarding: WAN ($wan_if) -> LAN ($lan_if) (return traffic)"
    local fwd2_output=$(iptables -A FORWARD -i "$wan_if" -o "$lan_if" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>&1)
    local fwd2_exit=$?
    if [[ $fwd2_exit -eq 0 ]]; then
        log_service "FORWARD rule (WAN->LAN) command executed (exit: $fwd2_exit)"
        sleep 0.1
        if iptables -C FORWARD -i "$wan_if" -o "$lan_if" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null; then
            log_service "FORWARD rule (WAN->LAN) verified successfully"
        else
            log_error "FORWARD rule (WAN->LAN) command succeeded but rule not found!"
        fi
    else
        log_error "Failed to add FORWARD return rule (exit code: $fwd2_exit)"
        log_error "Error output: $fwd2_output"
    fi
    
    # Verify rules were added (important for debugging)
    # Since iptables -C already verified rules exist, use that result instead of grep
    # The grep might fail due to output format differences, but -C is more reliable
    local nat_exists=false
    local fwd1_exists=false
    local fwd2_exists=false
    
    # Use iptables -C to check (most reliable method)
    if iptables -t nat -C POSTROUTING -o "$wan_if" -j MASQUERADE 2>/dev/null; then
        nat_exists=true
        log_service "NAT rule confirmed via iptables -C check"
    fi
    
    if iptables -C FORWARD -i "$lan_if" -o "$wan_if" -j ACCEPT 2>/dev/null; then
        fwd1_exists=true
        log_service "FORWARD rule (LAN->WAN) confirmed via iptables -C check"
    fi
    
    if iptables -C FORWARD -i "$wan_if" -o "$lan_if" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null; then
        fwd2_exists=true
        log_service "FORWARD rule (WAN->LAN) confirmed via iptables -C check"
    fi
    
    # Check if all rules are present
    if [[ "$nat_exists" == true ]] && [[ "$fwd1_exists" == true ]] && [[ "$fwd2_exists" == true ]]; then
        log_service "NAT Gateway rules verified successfully"
        log_service "Configuration Status: NAT Masquerade=OK, Forwarding(LAN->WAN)=OK, Forwarding(WAN->LAN)=OK"
    else
        log_error "Some NAT Gateway rules are missing:"
        log_error "  NAT Masquerade: $([[ "$nat_exists" == true ]] && echo "OK" || echo "MISSING")"
        log_error "  Forwarding (LAN->WAN): $([[ "$fwd1_exists" == true ]] && echo "OK" || echo "MISSING")"
        log_error "  Forwarding (WAN->LAN): $([[ "$fwd2_exists" == true ]] && echo "OK" || echo "MISSING")"
        log_error "Attempting alternative approach with -I (insert) instead of -A (append)..."
        
        # Try inserting rules at the beginning if they don't exist
        if [[ "$nat_exists" != true ]]; then
            log_service "Re-adding NAT rule using -I..."
            iptables -t nat -I POSTROUTING -o "$wan_if" -j MASQUERADE 2>/dev/null || {
                log_error "Cannot add NAT rule - permission denied or iptables error"
            }
        fi
        
        if [[ "$fwd1_exists" != true ]]; then
            log_service "Re-adding FORWARD rule (LAN->WAN) using -I..."
            iptables -I FORWARD -i "$lan_if" -o "$wan_if" -j ACCEPT 2>/dev/null || {
                log_error "Cannot add FORWARD rule - permission denied or iptables error"
            }
        fi
        
        if [[ "$fwd2_exists" != true ]]; then
            log_service "Re-adding FORWARD rule (WAN->LAN) using -I..."
            iptables -I FORWARD -i "$wan_if" -o "$lan_if" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || {
                log_error "Cannot add FORWARD return rule - permission denied or iptables error"
            }
        fi
    fi

    # Handle system sharing configuration
    if [[ "$SYSTEM_SHARING" == "yes" ]]; then
        log_service "Enabling system sharing - system will use WAN for internet access"

        # Get WAN interface IP and gateway
        local wan_ip=$(ip addr show "$wan_if" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1)
        local wan_gateway=$(ip route show dev "$wan_if" 2>/dev/null | grep -oP 'via \K[\d.]+' | head -1)

        # If no gateway found via ip route, try to detect from DHCP or default route
        if [[ -z "$wan_gateway" ]]; then
            wan_gateway=$(ip route | grep "default.*$wan_if" | grep -oP 'via \K[\d.]+' | head -1)
        fi

        # If still no gateway, try to guess from IP (typically .1 or .254)
        if [[ -z "$wan_gateway" ]] && [[ -n "$wan_ip" ]]; then
            local subnet=$(echo "$wan_ip" | cut -d. -f1-3)
            # Try common gateway IPs
            for gw in "${subnet}.1" "${subnet}.254"; do
                if ping -c 1 -W 1 "$gw" >/dev/null 2>&1; then
                    wan_gateway="$gw"
                    log_service "Detected gateway: $wan_gateway"
                    break
                fi
            done
        fi

        if [[ -n "$wan_gateway" ]]; then
            # Check if default route already exists for WAN
            local existing_route=$(ip route | grep "default.*$wan_if" | head -1)
            
            # Check if NetworkManager is managing this interface
            local nm_managed=false
            if command -v nmcli >/dev/null 2>&1; then
                if nmcli device status 2>/dev/null | grep -q "$wan_if.*connected"; then
                    nm_managed=true
                    log_service "NetworkManager is managing $wan_if interface"
                fi
            fi
            
            if [[ -z "$existing_route" ]]; then
                log_service "Setting default route via $wan_gateway on $wan_if"
                # Check if there are other default routes that might conflict
                local other_default_routes=$(ip route | grep "^default" | grep -v "$wan_if" || true)
                if [[ -n "$other_default_routes" ]]; then
                    log_service "Found other default routes, will prioritize WAN route..."
                    # Only remove non-NetworkManager managed routes to avoid conflicts
                    # NetworkManager routes typically have "proto dhcp" - we'll use lower metric instead
                fi
                
                # Add route with low metric (50) to ensure priority over other routes
                # If NetworkManager manages it, our route will just be a backup/higher priority
                if ip route add default via "$wan_gateway" dev "$wan_if" metric 50 2>/dev/null; then
                    log_success "Default route set successfully via $wan_gateway on $wan_if (metric 50)"
                    # Verify it's working
                    sleep 0.3
                    local verify_route=$(ip route | grep "default.*$wan_if" | head -1)
                    if [[ -n "$verify_route" ]]; then
                        log_service "Default route verified: $verify_route"
                        # Test connectivity
                        if ping -c 1 -W 2 "$wan_gateway" >/dev/null 2>&1; then
                            log_success "Gateway $wan_gateway is reachable"
                        fi
                    fi
                    
                    # If NetworkManager is managing, trigger it to re-check connectivity
                    if [[ "$nm_managed" == true ]]; then
                        log_service "Notifying NetworkManager to re-check connectivity..."
                        nmcli device reapply "$wan_if" 2>/dev/null || true
                    fi
                else
                    log_error "Failed to add default route (route may already exist via NetworkManager)"
                    # Check if route exists with different metric
                    if ip route | grep -q "default.*$wan_if"; then
                        log_service "Default route already exists via $wan_if (may be managed by NetworkManager)"
                    fi
                fi
            else
                # Route exists, verify it's correct
                if echo "$existing_route" | grep -q "$wan_gateway"; then
                    log_service "Default route via $wan_if already exists and is correct"
                else
                    # Route exists but gateway may be different
                    local current_gateway=$(echo "$existing_route" | grep -oP 'via \K[\d.]+' || echo "")
                    if [[ "$current_gateway" != "$wan_gateway" ]]; then
                        log_service "Default route gateway mismatch (current: ${current_gateway:-none}, expected: $wan_gateway)"
                        # If NetworkManager is managing, try to update via nmcli instead
                        if [[ "$nm_managed" == true ]]; then
                            log_service "NetworkManager is managing route, triggering reapply..."
                            nmcli device reapply "$wan_if" 2>/dev/null || true
                        else
                            # Update route manually
                            log_service "Updating default route..."
                            ip route del default dev "$wan_if" 2>/dev/null || true
                            sleep 0.2
                            if ip route add default via "$wan_gateway" dev "$wan_if" metric 50 2>/dev/null; then
                                log_success "Default route updated successfully"
                            fi
                        fi
                    else
                        log_service "Default route via $wan_if is correct"
                    fi
                fi
            fi

            # Set DNS if available (try to use WAN's DNS)
            local wan_dns=$(resolvectl status "$wan_if" 2>/dev/null | grep -oP 'DNS Servers: \K[\d.]+' | head -1)
            if [[ -n "$wan_dns" ]]; then
                log_service "Using DNS from WAN interface: $wan_dns"
            fi

            log_success "System sharing enabled - system can now use WAN ($wan_if) for internet"
        else
            log_error "Cannot enable system sharing - no gateway found for $wan_if"
            log_service "WAN IP: ${wan_ip:-NOT FOUND}"
            log_service "Only forwarding will work (LAN -> WAN)"
        fi
    else
        log_service "System sharing disabled - only forwarding traffic (LAN -> WAN)"
        log_service "System will NOT use WAN for its own internet access"

        # Ensure no default route is set via WAN (remove if exists)
        if ip route | grep -q "default.*$wan_if"; then
            log_service "Removing default route via $wan_if (system sharing disabled)"
            ip route del default dev "$wan_if" 2>/dev/null || true
        fi
    fi
    
    # Display comprehensive LAN gateway and NAT configuration for connected routers/devices
    local lan_ip=$(ip addr show "$lan_if" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1)
    local wan_ip=$(ip addr show "$wan_if" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1)
    
    if [[ -n "$lan_ip" ]]; then
        local lan_cidr=$(ip addr show "$lan_if" 2>/dev/null | grep -oP 'inet \K[\d.]+/\d+' | head -1 | cut -d'/' -f2)
        local lan_subnet=$(echo "$lan_ip" | cut -d. -f1-3)
        
        log_service "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log_service "NAT Gateway Configuration Summary:"
        log_service "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log_service "WAN Interface (Internet):"
        log_service "  Interface: $wan_if"
        log_service "  IP Address: ${wan_ip:-NOT CONFIGURED}"
        log_service "  Function: Internet connection (outbound)"
        log_service ""
        log_service "LAN Interface (Gateway):"
        log_service "  Interface: $lan_if"
        log_service "  Gateway IP: $lan_ip"
        log_service "  Subnet: ${lan_subnet}.0/$lan_cidr (192.168.2.0/24)"
        log_service "  Function: Gateway for connected routers/devices"
        log_service ""
        log_service "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log_service "How to Configure Connected Routers/Devices:"
        log_service "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log_service "1. Connect router/device to: $lan_if"
        log_service ""
        log_service "2. Configure router WAN settings:"
        log_service "   → WAN Gateway: $lan_ip"
        log_service "   → WAN IP: Use DHCP or set manually in ${lan_subnet}.0/$lan_cidr range"
        log_service "   → Subnet Mask: 255.255.255.0 (for /24)"
        log_service "   → DNS: Use your preferred DNS (e.g., 8.8.8.8, 1.1.1.1)"
        log_service ""
        log_service "3. For devices (non-router):"
        log_service "   → Default Gateway: $lan_ip"
        log_service "   → IP Address: ${lan_subnet}.X/24 (X = 2-254)"
        log_service "   → DNS: Same as router"
        log_service ""
        log_service "4. Traffic Flow:"
        log_service "   → LAN devices -> $lan_if ($lan_ip) -> NAT -> $wan_if (${wan_ip:-WAN}) -> Internet"
        log_service ""
        log_service "Note: All LAN traffic will be NAT'd through WAN IP: ${wan_ip:-N/A}"
        log_service "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    else
        log_error "LAN interface $lan_if has no IP address configured"
        log_error "Cannot function as NAT gateway without LAN gateway IP"
    fi

    log_success "NAT Gateway configuration completed successfully"
}

# Remove routing rules
remove_routing() {
    local wan_if="$1"

    log_service "Removing routing rules..."

    # If system sharing was enabled, remove default route via WAN
    if [[ -n "$wan_if" ]] && [[ "$SYSTEM_SHARING" == "yes" ]]; then
        log_service "Removing system sharing route via $wan_if"
        ip route del default dev "$wan_if" 2>/dev/null || true
    fi

    # Clear NAT and Forwarding rules
    iptables -t nat -F POSTROUTING 2>/dev/null || true
    iptables -F FORWARD 2>/dev/null || true

    log_service "NAT Gateway rules removed"
}

# Main monitoring loop
monitor_interfaces() {
    local routing_active=false
    local current_wan=""
    local current_lan=""
    local last_status_log_time=$(date +%s)  # Initialize to current time to avoid immediate log on startup
    local status_log_interval=60  # Log status every 60 seconds when interfaces are down
    local first_check=true  # Track if this is the first check after startup

    while true; do
        # Reload config every iteration to catch changes
        load_config

        # Find current interfaces
        local wan_if=$(find_interface "$WAN_KEYWORD")
        local lan_if=$(find_interface "$LAN_KEYWORD")

        # Check if both interfaces are available and up
        if [[ -n "$wan_if" ]] && [[ -n "$lan_if" ]] && check_interface "$wan_if" && check_interface "$lan_if"; then
            if [[ "$routing_active" == false ]] || [[ "$wan_if" != "$current_wan" ]] || [[ "$lan_if" != "$current_lan" ]]; then
                log_success "Both interfaces available - Enabling NAT Gateway"
                log_service "  WAN: $wan_if (Internet connection)"
                log_service "  LAN: $lan_if (Gateway for connected devices)"
                setup_routing "$wan_if" "$lan_if"
                routing_active=true
                current_wan="$wan_if"
                current_lan="$lan_if"
                first_check=false
            fi
        else
            if [[ "$routing_active" == true ]]; then
                log_error "Interface unavailable - disabling NAT Gateway"
                log_error "  WAN: ${wan_if:-NOT FOUND}, LAN: ${lan_if:-NOT FOUND}"
                remove_routing "$current_wan"
                routing_active=false
                current_wan=""
                current_lan=""
                # Reset log timer when routing becomes inactive
                last_status_log_time=$(date +%s)
            else
                # Log status periodically when interfaces are not available (to show service is working)
                # Skip logging on first check to avoid immediate log after startup
                if [[ "$first_check" == false ]]; then
                    local current_time=$(date +%s)
                    if [[ $((current_time - last_status_log_time)) -ge $status_log_interval ]]; then
                        local wan_status="not found"
                        local lan_status="not found"
                        local wan_state=""
                        local lan_state=""
                        
                        if [[ -n "$wan_if" ]]; then
                            wan_state=$(cat /sys/class/net/$wan_if/operstate 2>/dev/null || echo "unknown")
                            wan_status="found ($wan_state)"
                        fi
                        if [[ -n "$lan_if" ]]; then
                            lan_state=$(cat /sys/class/net/$lan_if/operstate 2>/dev/null || echo "unknown")
                            lan_status="found ($lan_state)"
                        fi
                        
                        log_service "Waiting for interfaces - WAN ($WAN_KEYWORD): $wan_status, LAN ($LAN_KEYWORD): $lan_status"
                        last_status_log_time=$current_time
                    fi
                else
                    # Mark first check as completed
                    first_check=false
                fi
            fi
        fi

        sleep 5
    done
}

# Main execution
log_service "Starting NAT Gateway monitor..."

# Try to load configuration with retries
config_loaded=false
retry_count=0
max_retries=10

while [ $retry_count -lt $max_retries ]; do
    if load_config; then
        config_loaded=true
        break
    fi
    retry_count=$((retry_count + 1))
    log_service "Configuration file not available yet, retrying ($retry_count/$max_retries)..."
    sleep 2
done

if [ "$config_loaded" = false ]; then
    log_error "Failed to load configuration after $max_retries attempts"
    log_error "Configuration file: $CONFIG_FILE"
    log_error "Please ensure configuration exists before starting the service"
    exit 1
fi

# Start monitoring
log_service "Starting interface monitoring..."
monitor_interfaces

