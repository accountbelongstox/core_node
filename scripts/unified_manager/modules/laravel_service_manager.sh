#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Laravel Service Manager
# Unified script for managing Laravel services using poly app deployment method
# This script is used by Unified App Manager and installation scripts (131-134)
#
# IMPORTANT NOTES:
# - All detected Laravel projects under poly_apps/ share a port range starting at 9000
# - Port assignment: sorted alphabetically, first project -> 9000, second -> 9001, ...
# - Each project must have scripts/start_service.sh (Octane/Swoole production launcher)
# - Same start_service.sh is used by both App Manager (Ns) and dd_helper scripts
#
# DEPLOYMENT PATHS (unified):
# - App Manager "Ns" command -> create_systemd_service() with start_service.sh
# - dd_helper 131-134 scripts -> install_laravel_service() -> same start_service.sh
# - Both paths produce identical systemd services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DEBIAN_SERVICE_MANAGER="$ROOT_DIR/scripts/shells/linux/common/debian_service_manager.sh"

# Laravel-specific constants (shared with app_config.sh)
LARAVEL_BASE_PORT=9000
LARAVEL_MEMORY_LIMIT="1600M"
LARAVEL_CPU_LIMIT="50%"
LARAVEL_RESTART_SEC="10"
LARAVEL_APP_READY=false
LARAVEL_SERVICE_READY=false
LARAVEL_WEBSITE_READY=false
LARAVEL_STATUS_FOUND=false

# Detect sudo command (use existing USE_SUDO if available from gvar_common.sh, otherwise detect)
if [ -z "${USE_SUDO:-}" ]; then
    if command -v sudo >/dev/null 2>&1; then
        USE_SUDO="sudo"
    else
        USE_SUDO=""
    fi
fi

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Function to check if a Laravel project exists at the given path
# Args: app_path (absolute path to the Laravel project root)
check_laravel_app() {
    local app_path="$1"
    LARAVEL_APP_READY=false

    if [[ ! -d "$app_path" ]]; then
        echo -e "${RED}Error: Laravel project not found at: $app_path${NC}" >&2
    elif [[ ! -f "$app_path/artisan" ]]; then
        echo -e "${RED}Error: artisan not found in $app_path${NC}" >&2
    elif [[ ! -f "$app_path/composer.json" ]]; then
        echo -e "${RED}Error: composer.json not found in $app_path${NC}" >&2
    else
        LARAVEL_APP_READY=true
    fi
}

# Function to find all Laravel projects under poly_apps/ (sorted alphabetically)
# Output: one line per project: "app_name|app_path"
find_laravel_apps() {
    local root="${1:-$ROOT_DIR}"
    local poly_dir="$root/poly_apps"
    [ -d "$poly_dir" ] || return

    local entry
    for entry in "$poly_dir"/*/; do
        [[ -d "$entry" ]] || continue
        [[ -f "$entry/composer.json" ]] || continue
        [[ -f "$entry/artisan" ]] || continue
        local base
        base="$(basename "$entry")"
        echo "$base|${entry%/}"
    done | sort -t'|' -k1,1 -f
}

# Function to calculate port for a Laravel project by its index among all detected projects
# Args: app_name
# Returns: port number (LARAVEL_BASE_PORT + index)
get_laravel_port() {
    local target_name="$1"
    local idx=0
    local name=""
    local path=""
    local selected_port="$LARAVEL_BASE_PORT"
    while IFS='|' read -r name path; do
        if [[ "$name" == "$target_name" ]]; then
            selected_port=$((LARAVEL_BASE_PORT + idx))
            break
        fi
        idx=$((idx + 1))
    done < <(find_laravel_apps)
    echo "$selected_port"
}

# Function to install a Laravel project as systemd service using start_service.sh
# This is the UNIFIED entry point - both App Manager and dd_helper scripts call this
# Args: app_name (directory name under poly_apps/, e.g. "laravel_main")
install_laravel_service() {
    local app_name="$1"
    local app_path="$ROOT_DIR/poly_apps/$app_name"
    local port
    port=$(get_laravel_port "$app_name")
    local service_name="app-manager-$app_name"
    local service_sh="$app_path/scripts/start_service.sh"
    local old_svcs=""
    local old_svc=""
    local description="App Manager: $app_name (Laravel Octane)"

    LARAVEL_SERVICE_READY=false

    echo -e "${BLUE}[LARAVEL SERVICE] Installing service (unified method)${NC}" >&2
    echo -e "${BLUE}[LARAVEL SERVICE] Project: $app_name${NC}" >&2
    echo -e "${BLUE}[LARAVEL SERVICE] Port: $port (base $LARAVEL_BASE_PORT)${NC}" >&2
    echo -e "${BLUE}[LARAVEL SERVICE] Script: start_service.sh (Octane/Swoole)${NC}" >&2

    check_laravel_app "$app_path"
    if [ "$LARAVEL_APP_READY" != true ]; then
        return
    fi

    if [[ ! -f "$service_sh" ]]; then
        echo -e "${RED}Error: start_service.sh not found: $service_sh${NC}" >&2
        echo -e "${RED}This file is required for production deployment.${NC}" >&2
        return
    fi

    if ! type create_systemd_service >/dev/null 2>&1; then
        source "$DEBIAN_SERVICE_MANAGER"
    fi

    # Clean up legacy octane-poly-* services that conflict with the new naming
    if command -v systemctl >/dev/null 2>&1; then
        old_svcs=$(systemctl list-units --type=service --all --no-legend 2>/dev/null \
            | grep -oE "octane-poly-[0-9]+\.service" | sed 's/.service$//' || true)
        if [[ -n "$old_svcs" ]]; then
            echo -e "${YELLOW}[LARAVEL SERVICE] Cleaning up legacy services...${NC}" >&2
            for old_svc in $old_svcs; do
                echo -e "${YELLOW}[LARAVEL SERVICE]   Stopping: $old_svc${NC}" >&2
                systemctl stop "$old_svc" 2>/dev/null || true
                systemctl disable "$old_svc" 2>/dev/null || true
            done
            systemctl daemon-reload 2>/dev/null || true
        fi
    fi

    echo -e "${YELLOW}[CMD]${NC} create_systemd_service \"$service_name\" ... start_service.sh (port=$port)" >&2

    create_systemd_service \
        "$service_name" \
        "$description" \
        "env PORT=$port bash ./scripts/start_service.sh" \
        "$app_path" \
        "root" \
        "always" \
        "$LARAVEL_RESTART_SEC" \
        "$LARAVEL_CPU_LIMIT" \
        "$LARAVEL_MEMORY_LIMIT"
    LARAVEL_SERVICE_READY="$SYSTEMD_OPERATION_READY"
    if [ "$LARAVEL_SERVICE_READY" = true ]; then
        echo -e "${GREEN}[LARAVEL SERVICE] Service installed: $service_name (port $port)${NC}" >&2
    else
        echo -e "${RED}[LARAVEL SERVICE] Service installation failed${NC}" >&2
    fi
}

# Function to install ALL detected Laravel projects as services
install_all_laravel_services() {
    local name path
    local ok=0 fail=0
    while IFS='|' read -r name path; do
        echo -e "${CYAN}--- $name ---${NC}" >&2
        install_laravel_service "$name"
        if [ "$LARAVEL_SERVICE_READY" = true ]; then
            ok=$((ok + 1))
        else
            fail=$((fail + 1))
        fi
    done < <(find_laravel_apps)
    echo -e "${BLUE}[LARAVEL SERVICE] Installed: $ok, Failed: $fail${NC}" >&2
}

# Function to add a website domain to a Laravel project (poly type, swoole mode)
# Args: app_name, domain, [ssl_mode]
add_laravel_website() {
    local app_name="$1"
    local domain="$2"
    local ssl_mode="${3:-auto}"
    local app_path="$ROOT_DIR/poly_apps/$app_name"

    if [[ -z "$domain" ]]; then
        echo -e "${RED}Error: Domain is required${NC}" >&2
        return
    fi

    echo -e "${BLUE}[LARAVEL WEBSITE] Project: $app_name${NC}" >&2
    echo -e "${BLUE}[LARAVEL WEBSITE] Adding domain: $domain${NC}" >&2
    echo -e "${BLUE}[LARAVEL WEBSITE] Type: poly, PHP Mode: swoole (Octane)${NC}" >&2

    check_laravel_app "$app_path"
    if [ "$LARAVEL_APP_READY" != true ]; then
        return
    fi

    local saved_dir="$(pwd)"
    cd "$app_path" || return

    echo -e "${YELLOW}[CMD]${NC} $USE_SUDO php artisan servermanager:website add \"$domain\" --type=poly --php-mode=swoole --ssl=$ssl_mode" >&2

    LARAVEL_WEBSITE_READY=false
    $USE_SUDO php artisan servermanager:website add "$domain" --type=poly --php-mode=swoole --ssl="$ssl_mode" 2>&1
    LARAVEL_WEBSITE_READY=true
    echo -e "${GREEN}[LARAVEL WEBSITE] Website command completed: $domain${NC}" >&2
    cd "$saved_dir" || true
}

# Function to list services for a Laravel project
# Args: app_name
list_laravel_services() {
    local app_name="$1"
    local app_path="$ROOT_DIR/poly_apps/$app_name"

    check_laravel_app "$app_path"
    if [ "$LARAVEL_APP_READY" != true ]; then
        return
    fi

    local saved_dir="$(pwd)"
    cd "$app_path" || return

    $USE_SUDO php artisan servermanager:swoole list 2>&1

    cd "$saved_dir" || true
}

# Function to check service status for a Laravel project
# Args: app_name
check_laravel_service_status() {
    local app_name="$1"
    local app_path="$ROOT_DIR/poly_apps/$app_name"

    check_laravel_app "$app_path"
    if [ "$LARAVEL_APP_READY" != true ]; then
        return
    fi

    local saved_dir="$(pwd)"
    cd "$app_path" || return

    local output
    output=$($USE_SUDO php artisan servermanager:swoole list 2>&1 | grep -i "octane-poly\|$app_name" || true)

    cd "$saved_dir" || true

    LARAVEL_STATUS_FOUND=false
    if [[ -n "$output" ]]; then
        LARAVEL_STATUS_FOUND=true
        echo "$output"
    fi
}

# Main function - route commands
main() {
    local command="${1:-help}"

    case "$command" in
        "install"|"install-service")
            if [[ -z "${2:-}" ]]; then
                echo -e "${RED}Error: app_name is required${NC}" >&2
                echo "Usage: $0 install <app_name>" >&2
                return
            fi
            install_laravel_service "$2"
            ;;
        "install-all")
            install_all_laravel_services
            ;;
        "add-website"|"add")
            if [[ -z "${2:-}" ]] || [[ -z "${3:-}" ]]; then
                echo -e "${RED}Error: app_name and domain are required${NC}" >&2
                echo "Usage: $0 add-website <app_name> <domain> [ssl_mode]" >&2
                return
            fi
            add_laravel_website "$2" "$3" "${4:-auto}"
            ;;
        "list"|"list-services")
            if [[ -z "${2:-}" ]]; then
                echo -e "${RED}Error: app_name is required${NC}" >&2
                echo "Usage: $0 list <app_name>" >&2
                return
            fi
            list_laravel_services "$2"
            ;;
        "status"|"check")
            if [[ -z "${2:-}" ]]; then
                echo -e "${RED}Error: app_name is required${NC}" >&2
                echo "Usage: $0 status <app_name>" >&2
                return
            fi
            check_laravel_service_status "$2"
            ;;
        "find"|"scan")
            echo "Detected Laravel projects under poly_apps/:"
            find_laravel_apps | while IFS='|' read -r name path; do
                local port
                port=$(get_laravel_port "$name")
                echo "  $name -> port $port ($path)"
            done
            ;;
        "help"|*)
            echo "Usage: $0 <command> [args...]"
            echo ""
            echo "Commands:"
            echo "  install <app_name>       - Install Laravel service via start_service.sh"
            echo "  install-all              - Install services for ALL detected Laravel projects"
            echo "  add-website <app_name> <domain> [ssl_mode] - Add website domain"
            echo "  list <app_name>          - List services for a Laravel project"
            echo "  status <app_name>        - Check service status"
            echo "  find                     - Scan and list all detected Laravel projects"
            echo "  help                     - Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 install laravel_main"
            echo "  $0 install-all"
            echo "  $0 add-website laravel_main api.example.com auto"
            echo "  $0 find"
            ;;
    esac
}

# If script is executed directly (not sourced), run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
