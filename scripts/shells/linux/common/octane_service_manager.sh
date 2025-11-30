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

# Laravel Octane Service Manager
# Wrapper around debian_service_manager.sh for Octane/Swoole services
# Service naming: octane-<domain>-<port>
# Auto-restart: Every 48 hours via systemd timer
#
# IMPORTANT: This script must be run as ROOT user
# Usage context:
# - Shell scripts (install_shells/*): Run as ROOT (default)
# - ServerManagerV1 CLI commands: Run as ROOT via sudo
# - ServerManagerV1 Web API: Run as www-data, needs sudo permissions for systemd
#
# IMPORTANT SYNCHRONIZATION NOTE:
# This script must maintain consistency with:
# /www/programing/core_node/poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1OctaneServiceManager.php
#
# When modifying this script, ensure corresponding changes are made to the PHP class.
# When modifying the PHP class, ensure corresponding changes are made to this script.

SCRIPT_INDEX="[OCTANE_SERVICE]"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PARENT_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
CORE_NODE_ROOT="$(dirname "$SCRIPT_PARENT_DIR")"

# Source app paths constants first
source "$SCRIPT_CURRENT_DIR/app_paths.sh"
source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
source "$SCRIPT_CURRENT_DIR/debian_service_manager.sh"

OCTANE_SERVICE_PREFIX="octane-"
SYSTEMD_DIR="/etc/systemd/system"
RESTART_INTERVAL="48h"
# SYNC: ServerManagerV1OctaneServiceManager - Port range 9000-9999 (less commonly used)
SWOOLE_PORT_START=9000
SWOOLE_PORT_END=9999
# Default service user (can be overridden)
DEFAULT_SERVICE_USER="www-data"
DEFAULT_SERVICE_GROUP="www-data"

# Check if running as root (required for systemd operations)
check_root_permissions() {
    if [ "$EUID" -ne 0 ] && [ -z "$SUDO_USER" ]; then
        echo -e "${RED}$SCRIPT_INDEX Error: This script must be run as root or with sudo${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX Usage: sudo $0 $*${NC}"
        return 1
    fi
    return 0
}

# SYNC: ServerManagerV1OctaneServiceManager::getOctaneServiceName()
get_octane_service_name() {
    local domain="$1"
    local port="$2"
    echo "${OCTANE_SERVICE_PREFIX}${domain//\./-}-${port}"
}

# SYNC: ServerManagerV1OctaneServiceManager::listOctaneServices()
list_octane_services() {
    # Output message to stderr to avoid polluting the service list when used in command substitution
    echo -e "${CYAN}$SCRIPT_INDEX Listing all Octane services...${NC}" >&2
    systemctl list-units --type=service --all | grep "^  ${OCTANE_SERVICE_PREFIX}" | awk '{print $1}' | sed 's/.service$//'
}

# SYNC: ServerManagerV1OctaneServiceManager::getNextAvailablePort()
get_next_available_port() {
    local used_ports=()

    # Get all existing Octane services and extract their ports
    local services=$(systemctl list-units --type=service --all | grep "^  ${OCTANE_SERVICE_PREFIX}" | awk '{print $1}' | sed 's/.service$//')

    for service in $services; do
        # Extract port from service name: octane-domain-com-9000 -> 9000
        local port=$(echo "$service" | grep -oE '[0-9]+$')
        if [ -n "$port" ]; then
            used_ports+=("$port")
        fi
    done

    # Find first available port in range
    for ((port=$SWOOLE_PORT_START; port<=$SWOOLE_PORT_END; port++)); do
        local is_used=0
        for used_port in "${used_ports[@]}"; do
            if [ "$port" = "$used_port" ]; then
                is_used=1
                break
            fi
        done

        if [ $is_used -eq 0 ]; then
            # Double-check port is not in use by other services
            if ! ss -tuln | grep -q ":$port "; then
                echo "$port"
                return 0
            fi
        fi
    done

    # Fallback to start port if all are used
    echo "$SWOOLE_PORT_START"
    return 0
}

# SYNC: ServerManagerV1OctaneServiceManager::createOctaneService()
create_octane_service() {
    local domain="$1"
    local port="${2:-}"
    local workers="${3:-4}"
    local laravel_path="${4:-}"
    local service_user="${5:-root}"
    local service_group="${6:-root}"

    # Auto-assign port if not provided
    if [ -z "$port" ]; then
        port=$(get_next_available_port)
        echo -e "${CYAN}$SCRIPT_INDEX Auto-assigned port: $port${NC}"
    fi

    # Use default Laravel path from app_paths.sh if not provided
    if [ -z "$laravel_path" ]; then
        laravel_path="${LARAVEL_MAIN_PATH:-$CORE_NODE_ROOT/poly_apps/laravel_main}"
    fi

    if [ ! -d "$laravel_path" ]; then
        echo -e "${RED}$SCRIPT_INDEX Laravel path not found: $laravel_path${NC}"
        return 1
    fi

    local service_name=$(get_octane_service_name "$domain" "$port")
    local service_file="${SYSTEMD_DIR}/${service_name}.service"
    local timer_file="${SYSTEMD_DIR}/${service_name}.timer"

    echo -e "${BLUE}$SCRIPT_INDEX Creating Octane service: $service_name${NC}"
    echo -e "${CYAN}  Domain: $domain${NC}"
    echo -e "${CYAN}  Port: $port${NC}"
    echo -e "${CYAN}  Workers: $workers${NC}"
    echo -e "${CYAN}  User: $service_user:$service_group${NC}"
    echo -e "${CYAN}  Laravel Path: $laravel_path${NC}"

    # Calculate 20% of system memory for memory limit
    local total_memory_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local memory_limit_kb=$((total_memory_kb * 20 / 100))
    local memory_limit_mb=$((memory_limit_kb / 1024))

    cat > "$service_file" << EOF
[Unit]
Description=Laravel Octane Server for ${domain} on port ${port}
After=network.target mysql.service redis.service
Wants=network-online.target

[Service]
Type=simple
User=${service_user}
Group=${service_group}
WorkingDirectory=${laravel_path}
ExecStart=/usr/bin/php ${laravel_path}/artisan octane:start --host=127.0.0.1 --port=${port} --workers=${workers}
ExecReload=/bin/kill -USR1 \$MAINPID

# Auto-restart configuration
Restart=always
RestartSec=10

# Memory limit: 20% of system memory (~${memory_limit_mb}MB)
MemoryMax=${memory_limit_kb}K
MemoryHigh=${memory_limit_kb}K

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${service_name}

# Environment
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Security
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${laravel_path}/storage ${laravel_path}/bootstrap/cache

[Install]
WantedBy=multi-user.target
EOF

    cat > "$timer_file" << EOF
[Unit]
Description=Auto-restart ${service_name} every 48 hours
Requires=${service_name}.service

[Timer]
OnBootSec=${RESTART_INTERVAL}
OnUnitActiveSec=${RESTART_INTERVAL}
Persistent=true

[Install]
WantedBy=timers.target
EOF

    chmod 644 "$service_file"
    chmod 644 "$timer_file"

    systemctl daemon-reload

    echo -e "${GREEN}$SCRIPT_INDEX Service files created:${NC}"
    echo -e "  Service: $service_file"
    echo -e "  Timer:   $timer_file"

    return 0
}

# SYNC: ServerManagerV1OctaneServiceManager::startOctaneService()
start_octane_service() {
    local service_name="$1"

    echo -e "${BLUE}$SCRIPT_INDEX Starting Octane service: $service_name${NC}"

    if systemctl start "$service_name"; then
        systemctl enable "$service_name"

        if systemctl start "${service_name}.timer" 2>/dev/null; then
            systemctl enable "${service_name}.timer"
            echo -e "${GREEN}$SCRIPT_INDEX Service started with 48h auto-restart${NC}"
        else
            echo -e "${GREEN}$SCRIPT_INDEX Service started (no timer)${NC}"
        fi

        sleep 2
        systemctl status "$service_name" --no-pager -l | head -15

        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to start service${NC}"
        systemctl status "$service_name" --no-pager -l
        return 1
    fi
}

# SYNC: ServerManagerV1OctaneServiceManager::stopOctaneService()
stop_octane_service() {
    local service_name="$1"

    echo -e "${BLUE}$SCRIPT_INDEX Stopping Octane service: $service_name${NC}"

    systemctl stop "${service_name}.timer" 2>/dev/null
    systemctl disable "${service_name}.timer" 2>/dev/null

    if systemctl stop "$service_name"; then
        systemctl disable "$service_name"
        echo -e "${GREEN}$SCRIPT_INDEX Service stopped${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to stop service${NC}"
        return 1
    fi
}

# SYNC: ServerManagerV1OctaneServiceManager::restartOctaneService()
restart_octane_service() {
    local service_name="$1"

    echo -e "${BLUE}$SCRIPT_INDEX Restarting Octane service: $service_name${NC}"

    if systemctl restart "$service_name"; then
        echo -e "${GREEN}$SCRIPT_INDEX Service restarted${NC}"
        sleep 2
        systemctl status "$service_name" --no-pager -l | head -15
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to restart service${NC}"
        systemctl status "$service_name" --no-pager -l
        return 1
    fi
}

# SYNC: ServerManagerV1OctaneServiceManager::removeOctaneService()
remove_octane_service() {
    local service_name="$1"

    echo -e "${BLUE}$SCRIPT_INDEX Removing Octane service: $service_name${NC}"

    stop_octane_service "$service_name"

    rm -f "${SYSTEMD_DIR}/${service_name}.service"
    rm -f "${SYSTEMD_DIR}/${service_name}.timer"

    systemctl daemon-reload
    systemctl reset-failed 2>/dev/null

    echo -e "${GREEN}$SCRIPT_INDEX Service removed${NC}"
    return 0
}

# SYNC: ServerManagerV1OctaneServiceManager::getServiceStatus()
status_octane_service() {
    local service_name="$1"

    echo -e "${CYAN}$SCRIPT_INDEX Service Status: $service_name${NC}"
    echo ""
    systemctl status "$service_name" --no-pager -l

    echo ""
    echo -e "${CYAN}$SCRIPT_INDEX Auto-restart Timer:${NC}"
    systemctl status "${service_name}.timer" --no-pager -l 2>/dev/null || echo "  Timer not configured"

    echo ""
    echo -e "${CYAN}$SCRIPT_INDEX Recent Logs:${NC}"
    journalctl -u "$service_name" -n 20 --no-pager
}

# SYNC: ServerManagerV1OctaneServiceManager::getAllServicesStatus()
status_all_octane() {
    echo -e "${CYAN}$SCRIPT_INDEX All Octane Services Status:${NC}"
    echo ""

    local services=$(list_octane_services)

    if [ -z "$services" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX No Octane services found${NC}"
        return 0
    fi

    printf "%-40s %-10s %-10s %-15s\n" "SERVICE" "STATUS" "ENABLED" "TIMER"
    printf "%-40s %-10s %-10s %-15s\n" "-------" "------" "-------" "-----"

    for service in $services; do
        local is_active=$(systemctl is-active "$service" 2>/dev/null || echo "inactive")
        local is_enabled=$(systemctl is-enabled "$service" 2>/dev/null || echo "disabled")
        local timer_active=$(systemctl is-active "${service}.timer" 2>/dev/null || echo "inactive")

        local status_color="${RED}"
        [ "$is_active" = "active" ] && status_color="${GREEN}"

        printf "${status_color}%-40s${NC} %-10s %-10s %-15s\n" "$service" "$is_active" "$is_enabled" "$timer_active"
    done
}

# SYNC: ServerManagerV1OctaneServiceManager::restartAllOctaneServices()
restart_all_octane() {
    echo -e "${BLUE}$SCRIPT_INDEX Restarting all Octane services...${NC}"

    local services=$(list_octane_services)

    if [ -z "$services" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX No Octane services found${NC}"
        return 0
    fi

    local success_count=0
    local fail_count=0

    for service in $services; do
        if systemctl restart "$service" 2>/dev/null; then
            echo -e "${GREEN}âœ?$service${NC}"
            ((success_count++))
        else
            echo -e "${RED}âœ?$service${NC}"
            ((fail_count++))
        fi
        sleep 1
    done

    echo ""
    echo -e "${CYAN}$SCRIPT_INDEX Restart Summary:${NC}"
    echo -e "  ${GREEN}Success: $success_count${NC}"
    [ $fail_count -gt 0 ] && echo -e "  ${RED}Failed: $fail_count${NC}"

    return 0
}

show_octane_help() {
    cat << 'EOF'
Laravel Octane Service Manager

Usage: octane_service_manager.sh <command> [arguments]

Commands:
  create <domain> [port] [workers] [laravel_path] [user] [group]
      Create and start Octane service (port auto-assigned if not provided)
      Default user: root (for shell scripts and CLI commands)
      Example: ./octane_service_manager.sh create api.example.com
      Example: ./octane_service_manager.sh create api.example.com 9000 4
      Example: ./octane_service_manager.sh create api.example.com 9000 4 /path/to/laravel www-data www-data

  start <service_name|domain port>
      Start Octane service
      Example: ./octane_service_manager.sh start octane-api-example-com-8000
      Example: ./octane_service_manager.sh start api.example.com 8000

  stop <service_name|domain port>
      Stop Octane service
      Example: ./octane_service_manager.sh stop octane-api-example-com-8000

  restart <service_name|domain port>
      Restart Octane service
      Example: ./octane_service_manager.sh restart octane-api-example-com-8000

  status [service_name|domain port]
      Show service status (all services if no argument)
      Example: ./octane_service_manager.sh status
      Example: ./octane_service_manager.sh status octane-api-example-com-8000

  remove <service_name|domain port>
      Remove Octane service
      Example: ./octane_service_manager.sh remove octane-api-example-com-8000

  list
      List all Octane services

  restart-all
      Restart all Octane services (used by cron for 48h auto-restart)

Service Naming Convention:
  octane-<domain>-<port>
  Example: octane-api-example-com-8000

Auto-restart Feature:
  All services automatically restart every 48 hours via systemd timer
  This prevents memory leaks in long-running Swoole processes

EOF
}

main() {
    local command="${1:-}"

    case "$command" in
        create)
            if [ -z "$2" ]; then
                echo -e "${RED}Error: domain required${NC}"
                show_octane_help
                exit 1
            fi
            # Check root permissions
            if ! check_root_permissions; then
                exit 1
            fi
            # Port is now optional - will auto-assign if not provided
            local assigned_port="${3:-}"
            local workers="${4:-4}"
            local laravel_path="${5:-}"
            local service_user="${6:-root}"
            local service_group="${7:-root}"

            create_octane_service "$2" "$assigned_port" "$workers" "$laravel_path" "$service_user" "$service_group"
            # Get the actual port used (either provided or auto-assigned)
            if [ -z "$assigned_port" ]; then
                assigned_port=$(get_next_available_port)
            fi
            start_octane_service "$(get_octane_service_name "$2" "$assigned_port")"
            ;;
        start)
            if [ -z "$2" ]; then
                echo -e "${RED}Error: service name or domain required${NC}"
                show_octane_help
                exit 1
            fi
            if [ -n "$3" ]; then
                service_name=$(get_octane_service_name "$2" "$3")
            else
                service_name="$2"
            fi
            start_octane_service "$service_name"
            ;;
        stop)
            if [ -z "$2" ]; then
                echo -e "${RED}Error: service name or domain required${NC}"
                show_octane_help
                exit 1
            fi
            if [ -n "$3" ]; then
                service_name=$(get_octane_service_name "$2" "$3")
            else
                service_name="$2"
            fi
            stop_octane_service "$service_name"
            ;;
        restart)
            if [ -z "$2" ]; then
                echo -e "${RED}Error: service name or domain required${NC}"
                show_octane_help
                exit 1
            fi
            if [ -n "$3" ]; then
                service_name=$(get_octane_service_name "$2" "$3")
            else
                service_name="$2"
            fi
            restart_octane_service "$service_name"
            ;;
        status)
            if [ -z "$2" ]; then
                status_all_octane
            else
                if [ -n "$3" ]; then
                    service_name=$(get_octane_service_name "$2" "$3")
                else
                    service_name="$2"
                fi
                status_octane_service "$service_name"
            fi
            ;;
        remove)
            if [ -z "$2" ]; then
                echo -e "${RED}Error: service name or domain required${NC}"
                show_octane_help
                exit 1
            fi
            if [ -n "$3" ]; then
                service_name=$(get_octane_service_name "$2" "$3")
            else
                service_name="$2"
            fi
            remove_octane_service "$service_name"
            ;;
        list)
            list_octane_services
            ;;
        restart-all)
            restart_all_octane
            ;;
        help|--help|-h|'')
            show_octane_help
            ;;
        *)
            echo -e "${RED}Error: Unknown command '$command'${NC}"
            show_octane_help
            exit 1
            ;;
    esac
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
