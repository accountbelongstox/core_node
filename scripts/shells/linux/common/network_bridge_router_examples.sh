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

# Network Bridge Router Examples and Quick Start
# Provides example configurations and quick setup for common scenarios

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NBR_SCRIPT="$SCRIPT_DIR/network_bridge_router.sh"
INSTALLER_SCRIPT="$SCRIPT_DIR/network_bridge_router_installer.sh"
MONITOR_SCRIPT="$SCRIPT_DIR/network_bridge_router_monitor.sh"

# Function to show examples
show_examples() {
    cat << 'EOF'
Network Bridge Router - Usage Examples
=====================================

The Network Bridge Router creates a bridge between two network interfaces,
allowing traffic to flow bidirectionally: Internet -> Interface A -> Interface B -> Router C

Basic Usage Examples:
--------------------

1. Basic Ethernet Bridge:
   sudo ./network_bridge_router.sh -i eth0 -o eth1 -r 192.168.1.1

2. WiFi to Ethernet Bridge:
   sudo ./network_bridge_router.sh -i wlan0 -o eth0 -r 10.0.0.1

3. Custom Bridge Configuration:
   sudo ./network_bridge_router.sh -i eth0 -o eth1 -r 192.168.1.1 \
     --bridge-ip 10.1.1.1 --bridge-subnet 10.1.1.0/24

4. IPv6 Support:
   sudo ./network_bridge_router.sh -i eth0 -o eth1 -r 192.168.1.1 --ipv6

5. Disable DHCP (use external DHCP server):
   sudo ./network_bridge_router.sh -i eth0 -o eth1 -r 192.168.1.1 --no-dhcp

6. Custom DNS Servers:
   sudo ./network_bridge_router.sh -i eth0 -o eth1 -r 192.168.1.1 \
     --dns "1.1.1.1,1.0.0.1"

Service Management Examples:
---------------------------

1. Install as System Service:
   sudo ./network_bridge_router.sh -i eth0 -o eth1 -r 192.168.1.1 --service

2. Check Service Status:
   ./network_bridge_router.sh --status
   systemctl status network-bridge-router

3. Start/Stop Service:
   sudo systemctl start network-bridge-router
   sudo systemctl stop network-bridge-router

4. View Service Logs:
   journalctl -u network-bridge-router -f

Monitoring Examples:
-------------------

1. One-time Health Check:
   ./network_bridge_router_monitor.sh check

2. Detailed Status:
   ./network_bridge_router_monitor.sh status

3. Continuous Monitoring:
   ./network_bridge_router_monitor.sh monitor

Common Scenarios:
----------------

Scenario 1: Home Lab Setup
- Internet connection via WiFi (wlan0)
- Lab network via Ethernet (eth0)
- Router at 192.168.1.1

Command:
sudo ./network_bridge_router.sh -i wlan0 -o eth0 -r 192.168.1.1

Scenario 2: Office Network Extension
- Main network via eth0
- Extended network via eth1
- Gateway router at 10.0.0.1

Command:
sudo ./network_bridge_router.sh -i eth0 -o eth1 -r 10.0.0.1 \
  --bridge-ip 10.1.0.1 --bridge-subnet 10.1.0.0/24

Scenario 3: VM/Container Networking
- Host network via eth0
- VM bridge via eth1
- Router at 172.16.0.1

Command:
sudo ./network_bridge_router.sh -i eth0 -o eth1 -r 172.16.0.1 \
  --bridge-ip 172.17.0.1 --bridge-subnet 172.17.0.0/24

Troubleshooting:
---------------

1. Check Interface Status:
   ip link show
   ip addr show

2. Check Bridge Status:
   brctl show
   ip link show nbr-bridge

3. Check Routing:
   ip route show
   iptables -t nat -L
   iptables -t filter -L

4. Check Connectivity:
   ping <router_ip>
   traceroute <router_ip>

5. Check Logs:
   tail -f /var/log/network_bridge_router.log
   journalctl -u network-bridge-router -f

Configuration Files:
-------------------

Main Configuration: /etc/network_bridge_router.conf
Service File: /etc/systemd/system/network-bridge-router.service
Log File: /var/log/network_bridge_router.log
Status File: /var/run/network_bridge_router.status

Network Flow:
------------

Internet <-> [Interface A] <-> [Bridge] <-> [Interface B] <-> Router C

The bridge router performs the following functions:
1. Creates a bridge interface connecting Interface A and Interface B
2. Sets up NAT rules for traffic forwarding
3. Provides DHCP services (optional)
4. Provides DNS services (optional)
5. Enables bidirectional traffic flow
6. Maintains routing tables for proper packet forwarding

Security Considerations:
-----------------------

1. The bridge router runs with root privileges
2. Firewall rules are modified during operation
3. IP forwarding is enabled system-wide
4. Consider using specific firewall rules for production environments
5. Monitor traffic and resource usage regularly

Performance Tips:
----------------

1. Use dedicated network interfaces for better performance
2. Consider interface speeds and capabilities
3. Monitor CPU and memory usage
4. Use appropriate bridge and subnet configurations
5. Optimize iptables rules for your specific use case

EOF
}

# Function to detect network configuration
detect_network_config() {
    echo "Network Configuration Detection"
    echo "==============================="
    echo
    
    echo "Available Network Interfaces:"
    ip link show | grep -E '^[0-9]+:' | while read line; do
        iface=$(echo "$line" | awk -F': ' '{print $2}' | sed 's/@.*//')
        state=$(echo "$line" | grep -o "state [A-Z]*" | awk '{print $2}')
        echo "  $iface ($state)"
        
        # Show IP addresses if any
        ip addr show "$iface" 2>/dev/null | grep "inet " | while read addr_line; do
            ip_addr=$(echo "$addr_line" | awk '{print $2}')
            echo "    IP: $ip_addr"
        done
    done
    
    echo
    echo "Current Routing Table:"
    ip route show | head -10
    
    echo
    echo "Default Gateway:"
    ip route show default | awk '{print $3}' | head -1
    
    echo
}

# Function to suggest configuration
suggest_configuration() {
    echo "Configuration Suggestions"
    echo "========================"
    echo
    
    # Find interfaces with IP addresses (potential input interfaces)
    echo "Potential Input Interfaces (with IP addresses):"
    ip addr show | grep -E "^[0-9]+:" | while read line; do
        iface=$(echo "$line" | awk -F': ' '{print $2}' | sed 's/@.*//')
        if [[ "$iface" != "lo" ]]; then
            has_ip=$(ip addr show "$iface" | grep "inet " | wc -l)
            if [[ $has_ip -gt 0 ]]; then
                echo "  $iface"
            fi
        fi
    done
    
    echo
    
    # Find interfaces without IP addresses (potential output interfaces)
    echo "Potential Output Interfaces (without IP addresses):"
    ip addr show | grep -E "^[0-9]+:" | while read line; do
        iface=$(echo "$line" | awk -F': ' '{print $2}' | sed 's/@.*//')
        if [[ "$iface" != "lo" ]]; then
            has_ip=$(ip addr show "$iface" | grep "inet " | wc -l)
            if [[ $has_ip -eq 0 ]]; then
                state=$(ip link show "$iface" | grep -o "state [A-Z]*" | awk '{print $2}')
                echo "  $iface ($state)"
            fi
        fi
    done
    
    echo
    
    # Suggest default gateway as router IP
    default_gw=$(ip route show default | awk '{print $3}' | head -1)
    if [[ -n "$default_gw" ]]; then
        echo "Suggested Router IP: $default_gw (current default gateway)"
    fi
    
    echo
}

# Function to run quick setup wizard
quick_setup() {
    echo "Network Bridge Router - Quick Setup Wizard"
    echo "==========================================="
    echo
    
    # Detect network configuration
    detect_network_config
    
    # Suggest configuration
    suggest_configuration
    
    echo "Quick Setup Options:"
    echo "1. Run interactive installer"
    echo "2. Show configuration examples"
    echo "3. Detect and suggest configuration only"
    echo "4. Exit"
    echo
    
    read -p "Select option [1-4]: " choice
    
    case "$choice" in
        1)
            if [[ -f "$INSTALLER_SCRIPT" ]]; then
                exec "$INSTALLER_SCRIPT"
            else
                echo "Error: Installer script not found: $INSTALLER_SCRIPT"
                exit 1
            fi
            ;;
        2)
            show_examples
            ;;
        3)
            echo "Configuration detection completed."
            ;;
        4)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo "Invalid option: $choice"
            exit 1
            ;;
    esac
}

# Function to show usage
usage() {
    echo "Network Bridge Router Examples and Quick Start"
    echo "Usage: $0 [examples|detect|suggest|wizard|help]"
    echo
    echo "Commands:"
    echo "  examples  - Show usage examples"
    echo "  detect    - Detect network configuration"
    echo "  suggest   - Suggest configuration based on current setup"
    echo "  wizard    - Run quick setup wizard"
    echo "  help      - Show this help"
    echo
}

# Main function
main() {
    case "${1:-wizard}" in
        examples)
            show_examples
            ;;
        detect)
            detect_network_config
            ;;
        suggest)
            suggest_configuration
            ;;
        wizard)
            quick_setup
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            echo "Unknown command: $1" >&2
            usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
