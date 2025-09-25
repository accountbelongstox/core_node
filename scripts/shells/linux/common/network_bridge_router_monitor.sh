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

# Network Bridge Router Monitor and Diagnostic Tool
# Monitors the health and performance of the Network Bridge Router

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NBR_SCRIPT="$SCRIPT_DIR/network_bridge_router.sh"
CONFIG_FILE="/etc/network_bridge_router.conf"
STATUS_FILE="/var/run/network_bridge_router.status"
LOG_FILE="/var/log/network_bridge_router.log"
MONITOR_LOG="/var/log/network_bridge_router_monitor.log"

# Monitoring configuration
CHECK_INTERVAL=30
MAX_LOG_SIZE=10485760  # 10MB
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=80
PING_TIMEOUT=5
PING_COUNT=3

# Function to log messages
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$MONITOR_LOG"
}

# Function to load configuration
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
        return 0
    else
        log_message "ERROR" "Configuration file not found: $CONFIG_FILE"
        return 1
    fi
}

# Function to check if service is running
check_service_status() {
    if [[ -f "$STATUS_FILE" ]]; then
        source "$STATUS_FILE"
        if [[ "$RUNNING" == "1" ]] && kill -0 "$PID" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Function to check bridge status
check_bridge_status() {
    local bridge_name="$1"
    
    if ! ip link show "$bridge_name" >/dev/null 2>&1; then
        log_message "ERROR" "Bridge $bridge_name does not exist"
        return 1
    fi
    
    local bridge_state=$(ip link show "$bridge_name" | grep -o "state [A-Z]*" | awk '{print $2}')
    if [[ "$bridge_state" != "UP" ]]; then
        log_message "ERROR" "Bridge $bridge_name is not UP (state: $bridge_state)"
        return 1
    fi
    
    return 0
}

# Function to check interface status
check_interface_status() {
    local interface="$1"
    local name="$2"
    
    if ! ip link show "$interface" >/dev/null 2>&1; then
        log_message "ERROR" "$name interface $interface does not exist"
        return 1
    fi
    
    local iface_state=$(ip link show "$interface" | grep -o "state [A-Z]*" | awk '{print $2}')
    if [[ "$iface_state" != "UP" ]]; then
        log_message "WARN" "$name interface $interface is not UP (state: $iface_state)"
        return 1
    fi
    
    return 0
}

# Function to check connectivity
check_connectivity() {
    local target_ip="$1"
    local name="$2"
    
    if ping -c "$PING_COUNT" -W "$PING_TIMEOUT" "$target_ip" >/dev/null 2>&1; then
        return 0
    else
        log_message "ERROR" "Cannot ping $name ($target_ip)"
        return 1
    fi
}

# Function to check iptables rules
check_iptables_rules() {
    local rules_ok=0
    
    # Check if our custom chains exist
    if iptables -t nat -L "NBR-POSTROUTING" >/dev/null 2>&1; then
        ((rules_ok++))
    else
        log_message "ERROR" "NAT chain NBR-POSTROUTING not found"
    fi
    
    if iptables -t filter -L "NBR-FORWARD" >/dev/null 2>&1; then
        ((rules_ok++))
    else
        log_message "ERROR" "Filter chain NBR-FORWARD not found"
    fi
    
    # Check IP forwarding
    local ip_forward=$(cat /proc/sys/net/ipv4/ip_forward 2>/dev/null)
    if [[ "$ip_forward" == "1" ]]; then
        ((rules_ok++))
    else
        log_message "ERROR" "IP forwarding is disabled"
    fi
    
    return $((3 - rules_ok))
}

# Function to check process resources
check_process_resources() {
    if ! check_service_status; then
        return 1
    fi
    
    local pid="$PID"
    local cpu_usage=$(ps -p "$pid" -o %cpu --no-headers 2>/dev/null | tr -d ' ')
    local memory_usage=$(ps -p "$pid" -o %mem --no-headers 2>/dev/null | tr -d ' ')
    
    if [[ -n "$cpu_usage" ]] && (( $(echo "$cpu_usage > $ALERT_THRESHOLD_CPU" | bc -l) )); then
        log_message "WARN" "High CPU usage: ${cpu_usage}%"
    fi
    
    if [[ -n "$memory_usage" ]] && (( $(echo "$memory_usage > $ALERT_THRESHOLD_MEMORY" | bc -l) )); then
        log_message "WARN" "High memory usage: ${memory_usage}%"
    fi
    
    return 0
}

# Function to check log file size
check_log_size() {
    if [[ -f "$LOG_FILE" ]]; then
        local log_size=$(stat -c%s "$LOG_FILE" 2>/dev/null)
        if [[ "$log_size" -gt "$MAX_LOG_SIZE" ]]; then
            log_message "WARN" "Log file is large (${log_size} bytes), consider rotation"
            
            # Rotate log file
            mv "$LOG_FILE" "${LOG_FILE}.old"
            touch "$LOG_FILE"
            log_message "INFO" "Log file rotated"
        fi
    fi
}

# Function to perform comprehensive health check
health_check() {
    local errors=0
    local warnings=0
    
    log_message "INFO" "Starting health check"
    
    # Load configuration
    if ! load_config; then
        ((errors++))
        return $errors
    fi
    
    # Check service status
    if ! check_service_status; then
        log_message "ERROR" "Network Bridge Router service is not running"
        ((errors++))
        return $errors
    fi
    
    # Check bridge status
    if ! check_bridge_status "nbr-bridge"; then
        ((errors++))
    fi
    
    # Check interface status
    if ! check_interface_status "$INPUT_INTERFACE" "Input"; then
        ((warnings++))
    fi
    
    if ! check_interface_status "$OUTPUT_INTERFACE" "Output"; then
        ((warnings++))
    fi
    
    # Check iptables rules
    if ! check_iptables_rules; then
        ((errors++))
    fi
    
    # Check connectivity to router
    if ! check_connectivity "$ROUTER_IP" "Router C"; then
        ((warnings++))
    fi
    
    # Check process resources
    check_process_resources
    
    # Check log file size
    check_log_size
    
    if [[ $errors -eq 0 && $warnings -eq 0 ]]; then
        log_message "INFO" "Health check passed - all systems operational"
    elif [[ $errors -eq 0 ]]; then
        log_message "WARN" "Health check completed with $warnings warnings"
    else
        log_message "ERROR" "Health check failed with $errors errors and $warnings warnings"
    fi
    
    return $errors
}

# Function to show detailed status
show_detailed_status() {
    echo "Network Bridge Router - Detailed Status"
    echo "======================================="
    echo
    
    # Service status
    if check_service_status; then
        echo "Service Status: RUNNING (PID: $PID)"
        echo "Started: $STARTED"
    else
        echo "Service Status: STOPPED"
        return 1
    fi
    
    # Load configuration
    if load_config; then
        echo "Configuration: LOADED"
        echo "  Input Interface: $INPUT_INTERFACE"
        echo "  Output Interface: $OUTPUT_INTERFACE"
        echo "  Router IP: $ROUTER_IP"
        echo "  Bridge IP: $BRIDGE_IP"
    else
        echo "Configuration: ERROR"
        return 1
    fi
    
    echo
    echo "Network Status:"
    echo "==============="
    
    # Bridge status
    if check_bridge_status "nbr-bridge"; then
        echo "Bridge: UP"
        brctl show nbr-bridge 2>/dev/null | tail -n +2
    else
        echo "Bridge: DOWN"
    fi
    
    echo
    
    # Interface status
    echo "Interfaces:"
    check_interface_status "$INPUT_INTERFACE" "Input" && echo "  $INPUT_INTERFACE: UP" || echo "  $INPUT_INTERFACE: DOWN"
    check_interface_status "$OUTPUT_INTERFACE" "Output" && echo "  $OUTPUT_INTERFACE: UP" || echo "  $OUTPUT_INTERFACE: DOWN"
    
    echo
    
    # Connectivity
    echo "Connectivity:"
    check_connectivity "$ROUTER_IP" "Router C" && echo "  Router C ($ROUTER_IP): REACHABLE" || echo "  Router C ($ROUTER_IP): UNREACHABLE"
    
    echo
    
    # Traffic statistics
    echo "Traffic Statistics:"
    echo "==================="
    if [[ -f "/proc/net/dev" ]]; then
        echo "Interface statistics:"
        awk -v input="$INPUT_INTERFACE" -v output="$OUTPUT_INTERFACE" '
        NR>2 {
            gsub(/:/, "", $1)
            if ($1 == input || $1 == output) {
                printf "  %-12s RX: %10s bytes %8s packets  TX: %10s bytes %8s packets\n", 
                       $1, $2, $3, $10, $11
            }
        }' /proc/net/dev
    fi
    
    return 0
}

# Function to monitor continuously
monitor_continuous() {
    log_message "INFO" "Starting continuous monitoring (interval: ${CHECK_INTERVAL}s)"
    
    while true; do
        health_check
        sleep "$CHECK_INTERVAL"
    done
}

# Function to show usage
usage() {
    echo "Network Bridge Router Monitor"
    echo "Usage: $0 [check|status|monitor|help]"
    echo
    echo "Commands:"
    echo "  check    - Perform one-time health check"
    echo "  status   - Show detailed status"
    echo "  monitor  - Start continuous monitoring"
    echo "  help     - Show this help"
    echo
}

# Main function
main() {
    case "${1:-check}" in
        check)
            health_check
            exit $?
            ;;
        status)
            show_detailed_status
            exit $?
            ;;
        monitor)
            monitor_continuous
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
