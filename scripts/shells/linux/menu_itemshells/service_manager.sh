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

# Service Manager
# Menu interface for the components provisioned by the install shells:
# FrankenPHP (93), Composer (94), PHP 8.5 configuration (96) and the
# laravel_main systemd service (175). Runtime components expose
# status/install actions; the laravel_main item owns the systemd lifecycle.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
COMMON_DIR="$PARENT_DIR_LEVEL_1/common"
SERVICE_MANAGER_REGISTRY_SCRIPT="$SCRIPT_CURRENT_DIR/service_manager_registry.sh"
SERVICE_MANAGER_UI_SCRIPT="$SCRIPT_CURRENT_DIR/service_manager_ui.sh"

# Source global variables
source "$COMMON_DIR/gvar_common.sh"
source "$COMMON_DIR/common_functions.sh"
source "$COMMON_DIR/arrow_menu.sh"
# Core service prefixes + pycore unit policy (core_services aggregate)
source "$COMMON_DIR/runtime_service_policy.sh"
# fm_* probes (fm_get_binary / fm_binary_usable / fm_variant / fm_verify ...)
source "$COMMON_DIR/frankenphp_manager.sh"
# COMPOSER_* path contract (wrapper / phar / laravel installer)
source "$COMMON_DIR/composer_install_common.sh"
source "$SERVICE_MANAGER_REGISTRY_SCRIPT"
source "$SERVICE_MANAGER_UI_SCRIPT"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Prefixes owned by the unified app manager (unified_apps aggregate)
UNIFIED_APP_PREFIXES=("app-" "webapp-" "nuxt-" "laravel-" "flutter-" "react-" "vue-") # No Color

# --- Status probes (one function per service; single dispatch below) ---

service_status_frankenphp() {
    local variant=""

    if [ "$(fm_binary_usable "$(fm_get_binary)")" = "yes" ]; then
        variant="$(fm_variant)"
        echo "READY:${variant:-unrecorded}"
    else
        echo "NOT_INSTALLED"
    fi
}

service_status_composer() {
    if [ -x "$COMPOSER_TARGET_PATH" ] && [ -s "$COMPOSER_PHAR_PATH" ]; then
        echo "READY"
    else
        echo "NOT_INSTALLED"
    fi
}

service_status_php85() {
    if [ "$(php_runtime_plane)" = "frankenphp" ]; then
        if [ "$(fm_binary_usable "$(fm_get_binary)")" != "yes" ]; then
            echo "NOT_INSTALLED"
        elif [ -f "$(fm_php_ini_dir)/99-core-node.ini" ]; then
            echo "READY:frankenphp"
        else
            echo "CONFIG_PENDING:frankenphp"
        fi
        return
    fi
    if [ -x "/usr/local/bin/php" ] || [ -x "/usr/bin/php8.5" ]; then
        echo "READY:system"
    else
        echo "NOT_INSTALLED"
    fi
}

# State of a single resolved systemd unit (existence is handled by the resolver).
service_status_unit_state() {
    if systemctl is-active --quiet "$1"; then
        echo "RUNNING"
    elif systemctl is-enabled --quiet "$1" 2>/dev/null; then
        echo "STOPPED_ENABLED"
    else
        echo "STOPPED_DISABLED"
    fi
}

# First existing systemd unit among the candidates (empty when none exists).
service_unit_first_existing() {
    local unit=""

    for unit in "$@"; do
        if systemctl list-unit-files --type=service 2>/dev/null | awk '{print $1}' | grep -q "^${unit}\.service$"; then
            echo "$unit"
            return
        fi
    done
}

# List installed unit names matching the given service-name prefixes.
service_aggregate_units() {
    local prefix=""
    local pattern=""
    local found=""

    for prefix in "$@"; do
        pattern="^${prefix}[A-Za-z0-9_.@-]*\.service$"
        found="$(systemctl list-unit-files --type=service --no-pager --no-legend 2>/dev/null | awk '{print $1}' | grep -E "$pattern" | sed 's/\.service$//')"
        if [ -n "$found" ]; then
            # Skip the internal timer-driven housekeeping unit (matches core_service_manager).
            found="$(printf '%s\n' "$found" | grep -v '^app-manager-log-trim$' || true)"
            [ -n "$found" ] && printf '%s\n' "$found"
        fi
    done
}

# Aggregate status over service-name prefixes: RUNNING:x/y | PARTIAL:x/y | STOPPED:x/y.
service_aggregate_status() {
    local svc=""
    local running=0
    local total=0

    while IFS= read -r svc; do
        [ -z "$svc" ] && continue
        total=$((total + 1))
        if systemctl is-active --quiet "$svc"; then
            running=$((running + 1))
        fi
    done < <(service_aggregate_units "$@")
    if [ "$total" -eq 0 ]; then
        echo "NOT_INSTALLED"
    elif [ "$running" -eq "$total" ]; then
        echo "RUNNING:${running}/${total}"
    elif [ "$running" -eq 0 ]; then
        echo "STOPPED:0/${total}"
    else
        echo "PARTIAL:${running}/${total}"
    fi
}

service_status_from_unit() {
    local unit="$(service_resolve_systemd_unit "$1")"

    if [ -z "$unit" ]; then
        echo "NOT_INSTALLED"
    else
        service_status_unit_state "$unit"
    fi
}

service_status_laravel_main() {
    service_status_from_unit laravel_main
}

service_status_nexus_dash() {
    service_status_from_unit nexus_dash
}

service_status_redis() {
    service_status_from_unit redis
}

service_status_postgresql() {
    service_status_from_unit postgresql
}

service_status_docker() {
    service_status_from_unit docker
}

service_status_mysql() {
    service_status_from_unit mysql
}

service_status_nginx() {
    service_status_from_unit nginx
}

service_status_ssh() {
    service_status_from_unit ssh
}

service_status_pycore() {
    service_status_from_unit pycore
}

service_status_unified_apps() {
    service_aggregate_status "${UNIFIED_APP_PREFIXES[@]}"
}

service_status_core_services() {
    service_aggregate_status "${CORE_RUNTIME_SERVICE_PREFIXES[@]}"
}

get_service_status() {
    "service_status_$1"
}

is_service_installed() {
    [ "$(get_service_status "$1")" != "NOT_INSTALLED" ]
}

service_is_systemd_managed() {
    [ "${SERVICE_KIND[$1]}" = "systemd" ]
}

service_is_aggregate() {
    [ "${SERVICE_KIND[$1]}" = "aggregate" ]
}

# Resolve the plane-preferred laravel_main unit (frankenphp | nginx), then the
# legacy fallbacks. Empty when no laravel unit is registered.
service_laravel_unit_resolve() {
    local plane_unit=""
    local unit=""

    plane_unit="${SERVICE_MANAGER_LARAVEL_SERVICE_BASE}-$(web_server_plane)"
    for unit in "$plane_unit" \
        "${SERVICE_MANAGER_LARAVEL_SERVICE_BASE}-frankenphp" \
        "${SERVICE_MANAGER_LARAVEL_SERVICE_BASE}-nginx" \
        "${SERVICE_MANAGER_LARAVEL_SERVICE_BASE}-main"; do
        if systemctl list-unit-files --type=service 2>/dev/null | awk '{print $1}' | grep -q "^${unit}\.service$"; then
            echo "$unit"
            return
        fi
    done
}

# Managed systemd unit for a service item (empty for runtime/aggregate items).
# Fixed-unit items resolve their canonical unit with distro fallbacks; laravel_main
# is plane-aware.
service_resolve_systemd_unit() {
    case "$1" in
        laravel_main) service_laravel_unit_resolve ;;
        nexus_dash) service_unit_first_existing "ncore-nexus-dash" ;;
        redis) service_unit_first_existing "redis-server" "redis" ;;
        postgresql) service_unit_first_existing "postgresql" ;;
        docker) service_unit_first_existing "docker" ;;
        mysql) service_unit_first_existing "mysql" "mariadb" ;;
        nginx) service_unit_first_existing "nginx" ;;
        ssh) service_unit_first_existing "ssh" "sshd" ;;
        pycore) service_unit_first_existing "pycore-module-caller" "pycore" ;;
        *) echo "" ;;
    esac
}

# Function to print colored status
print_status() {
    local service="$1"
    local status="$(get_service_status "$service")"

    case "$status" in
        READY:*)
            echo -e "${GREEN}[READY (${status#READY:})]${NC}"
            ;;
        READY)
            echo -e "${GREEN}[READY]${NC}"
            ;;
        CONFIG_PENDING:*)
            echo -e "${YELLOW}[CONFIG PENDING (${status#CONFIG_PENDING:})]${NC}"
            ;;
        CONFIG_PENDING)
            echo -e "${YELLOW}[CONFIG PENDING]${NC}"
            ;;
        RUNNING)
            echo -e "${GREEN}[RUNNING]${NC}"
            ;;
        RUNNING:*)
            echo -e "${GREEN}[RUNNING (${status#RUNNING:})]${NC}"
            ;;
        PARTIAL:*)
            echo -e "${YELLOW}[PARTIAL (${status#PARTIAL:})]${NC}"
            ;;
        STOPPED:*)
            echo -e "${YELLOW}[STOPPED (${status#STOPPED:})]${NC}"
            ;;
        STOPPED_ENABLED)
            echo -e "${YELLOW}[STOPPED - Auto-start ENABLED]${NC}"
            ;;
        STOPPED_DISABLED)
            echo -e "${YELLOW}[STOPPED - Auto-start DISABLED]${NC}"
            ;;
        NOT_INSTALLED)
            echo -e "${RED}[NOT INSTALLED]${NC}"
            ;;
        *)
            echo -e "${RED}[UNKNOWN]${NC}"
            ;;
    esac
}

# Function to start service
start_service() {
    local service="$1"
    local systemd_name="$(service_resolve_systemd_unit "$service")"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "Starting $service_name..."
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}Error: $service_name is not installed${NC}"
        return 1
    fi

    if [ -z "$systemd_name" ]; then
        echo -e "${YELLOW}$service_name has no single systemd unit to start; use its manager or install action${NC}"
        return 0
    fi

    if systemctl is-active --quiet "$systemd_name"; then
        echo -e "${YELLOW}$service_name ($systemd_name) is already running${NC}"
        return 0
    fi

    if $USE_SUDO systemctl start "$systemd_name"; then
        echo -e "${GREEN}$service_name ($systemd_name) started successfully${NC}"

        # Enable auto-start
        if ! systemctl is-enabled --quiet "$systemd_name" 2>/dev/null; then
            echo "Enabling auto-start for $service_name..."
            $USE_SUDO systemctl enable "$systemd_name"
        fi

        # Show status
        echo ""
        echo "Service status:"
        systemctl status "$systemd_name" --no-pager --lines=10
        return 0
    else
        echo -e "${RED}Failed to start $service_name${NC}"
        systemctl status "$systemd_name" --no-pager
        return 1
    fi
}

# Function to stop service
stop_service() {
    local service="$1"
    local systemd_name="$(service_resolve_systemd_unit "$service")"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "Stopping $service_name..."
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}Error: $service_name is not installed${NC}"
        return 1
    fi

    if [ -z "$systemd_name" ]; then
        echo -e "${YELLOW}$service_name has no single systemd unit to stop; use its manager or install action${NC}"
        return 0
    fi

    if ! systemctl is-active --quiet "$systemd_name"; then
        echo -e "${YELLOW}$service_name ($systemd_name) is not running${NC}"
        return 0
    fi

    if $USE_SUDO systemctl stop "$systemd_name"; then
        echo -e "${GREEN}$service_name ($systemd_name) stopped successfully${NC}"
        return 0
    else
        echo -e "${RED}Failed to stop $service_name${NC}"
        return 1
    fi
}

# Function to restart service
restart_service() {
    local service="$1"
    local systemd_name="$(service_resolve_systemd_unit "$service")"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "Restarting $service_name..."
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}Error: $service_name is not installed${NC}"
        return 1
    fi

    if [ -z "$systemd_name" ]; then
        echo -e "${YELLOW}$service_name has no single systemd unit to restart; use its manager or install action${NC}"
        return 0
    fi

    if $USE_SUDO systemctl restart "$systemd_name"; then
        echo -e "${GREEN}$service_name ($systemd_name) restarted successfully${NC}"

        # Show status
        echo ""
        echo "Service status:"
        systemctl status "$systemd_name" --no-pager --lines=10
        return 0
    else
        echo -e "${RED}Failed to restart $service_name${NC}"
        systemctl status "$systemd_name" --no-pager
        return 1
    fi
}

show_composer_details() {
    echo "Wrapper:          $( [ -x "$COMPOSER_TARGET_PATH" ] && echo "$COMPOSER_TARGET_PATH" || echo "missing" )"
    echo "Safe wrapper:     $( [ -x "$COMPOSER_SAFE_PATH" ] && echo "$COMPOSER_SAFE_PATH" || echo "missing" )"
    echo "PHAR payload:     $( [ -s "$COMPOSER_PHAR_PATH" ] && echo "$COMPOSER_PHAR_PATH" || echo "missing" )"
    echo "Laravel installer:$( [ -x "$COMPOSER_LARAVEL_LINK" ] && echo " $COMPOSER_LARAVEL_LINK" || echo " missing" )"
    echo ""
    if [ -x "$COMPOSER_TARGET_PATH" ]; then
        "$COMPOSER_TARGET_PATH" --version 2>/dev/null || true
    fi
}

show_php85_details() {
    local runtime_plane="$(php_runtime_plane)"
    local php_ini=""
    local php_cmd=""

    echo "Runtime plane: $runtime_plane"
    if [ "$runtime_plane" = "frankenphp" ]; then
        echo "Runtime binary: $(fm_get_binary)"
        echo "Embedded PHP: $(fm_php_version)"
        php_ini="$(fm_php_ini_dir)/99-core-node.ini"
        if [ -f "$php_ini" ]; then
            echo "PHP ini: $php_ini"
        else
            echo "PHP ini: missing (re-run 96_configure_php85.sh)"
        fi
        return
    fi
    for php_cmd in /usr/local/bin/php /usr/bin/php8.5 /usr/bin/php; do
        if [ -x "$php_cmd" ]; then
            echo "System PHP: $php_cmd"
            "$php_cmd" -v 2>/dev/null | sed -n '1p'
            return
        fi
    done
    echo "System PHP: not found"
}

# Function to show service status / component details
show_service_status() {
    local service="$1"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "$service_name Status"
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}$service_name is not installed${NC}"
        return 1
    fi

    case "$service" in
        frankenphp)
            fm_verify
            ;;
        composer)
            show_composer_details
            ;;
        php85)
            show_php85_details
            ;;
        unified_apps)
            show_aggregate_details "${UNIFIED_APP_PREFIXES[@]}"
            ;;
        core_services)
            show_aggregate_details "${CORE_RUNTIME_SERVICE_PREFIXES[@]}"
            ;;
        *)
            systemctl status "$(service_resolve_systemd_unit "$service")" --no-pager
            ;;
    esac
}

# One-line state per installed unit under the given prefixes.
show_aggregate_details() {
    local svc=""
    local state=""

    while IFS= read -r svc; do
        [ -z "$svc" ] && continue
        if systemctl is-active --quiet "$svc"; then
            state="RUNNING"
        else
            state="stopped"
        fi
        printf "  %-40s [%s]\n" "$svc" "$state"
    done < <(service_aggregate_units "$@")
}

has_advanced_manager() {
    [ -n "${SERVICE_MANAGER_SCRIPT[$1]:-}" ] && [ -f "${SERVICE_MANAGER_SCRIPT[$1]}" ]
}

launch_advanced_manager() {
    local service="$1"
    local manager_script="${SERVICE_MANAGER_SCRIPT[$service]}"

    echo ""
    if [ -f "$manager_script" ]; then
        bash "$manager_script"
    else
        echo -e "${RED}Manager script not found for ${SERVICE_NAME[$service]}${NC}"
    fi
}

# Function to show service logs
show_service_logs() {
    local service="$1"
    local systemd_name="$(service_resolve_systemd_unit "$service")"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "$service_name Logs"
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}$service_name is not installed${NC}"
        return 1
    fi

    if [ -z "$systemd_name" ]; then
        echo -e "${YELLOW}$service_name has no single systemd unit; no service logs${NC}"
        return 0
    fi

    echo ""
    echo -e "${CYAN}Recent logs (last 50 lines):${NC}"
    echo "================================================"
    journalctl -u "$systemd_name" -n 50 --no-pager
    echo ""
    echo -e "${YELLOW}Tip: Use 'journalctl -u $systemd_name -f' to follow logs in real-time${NC}"
}

# Function to enable/disable auto-start
toggle_autostart() {
    local service="$1"
    local systemd_name="$(service_resolve_systemd_unit "$service")"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "Toggle Auto-start for $service_name"
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}Error: $service_name is not installed${NC}"
        return 1
    fi

    if [ -z "$systemd_name" ]; then
        echo -e "${YELLOW}$service_name has no single systemd unit; auto-start does not apply${NC}"
        return 0
    fi

    if systemctl is-enabled --quiet "$systemd_name" 2>/dev/null; then
        echo "Auto-start is currently: ENABLED"
        echo ""
        read -p "Do you want to DISABLE auto-start? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            $USE_SUDO systemctl disable "$systemd_name"
            echo -e "${GREEN}Auto-start disabled${NC}"
        fi
    else
        echo "Auto-start is currently: DISABLED"
        echo ""
        read -p "Do you want to ENABLE auto-start? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            $USE_SUDO systemctl enable "$systemd_name"
            echo -e "${GREEN}Auto-start enabled${NC}"
        fi
    fi
}

# Function to install/reinstall service (generic: registry script + args)
reinstall_service() {
    local service="$1"
    local install_script="${SERVICE_INSTALL_SCRIPT[$service]}"
    local install_args="${SERVICE_INSTALL_ARGS[$service]}"
    local service_name="${SERVICE_NAME[$service]}"
    local script_path="$SERVICE_MANAGER_INSTALL_SHELLS_DIR/$install_script"
    local confirm=""

    if [ -z "$install_script" ]; then
        echo -e "${YELLOW}$service_name has no standalone installer; use its manager${NC}"
        return 0
    fi

    echo ""
    echo "================================================"

    # Check if service is already installed
    if is_service_installed "$service"; then
        echo "Reinstalling $service_name"
        echo "================================================"
        echo ""
        echo -e "${YELLOW}$service_name is already installed${NC}"
        echo "This will re-run the installation script: $install_script"
        echo ""
        read -p "Do you want to continue? (Y/n): " confirm

        # Default to Yes (empty input or Y/y)
        if [[ "$confirm" =~ ^[Nn]$ ]]; then
            echo "Reinstallation cancelled"
            return 0
        fi
    else
        echo "Installing $service_name"
        echo "================================================"
        echo ""
        echo -e "${GREEN}Installing $service_name for the first time${NC}"
        echo "This will run the installation script: $install_script"
        echo ""
        read -p "Do you want to install? (Y/n): " confirm

        # Default to Yes (empty input or Y/y)
        if [[ "$confirm" =~ ^[Nn]$ ]]; then
            echo "Installation cancelled"
            return 0
        fi
    fi

    if [ ! -f "$script_path" ]; then
        echo -e "${RED}Error: Installation script not found: $script_path${NC}"
        return 1
    fi

    echo ""
    echo "Executing: bash $script_path $install_args"
    echo ""

    if bash "$script_path" $install_args; then
        echo ""
        if is_service_installed "$service"; then
            echo -e "${GREEN}$service_name installation/reinstallation completed successfully${NC}"
        else
            echo -e "${YELLOW}$service_name script execution completed${NC}"
            echo -e "${YELLOW}Service may need manual configuration${NC}"
        fi
        return 0
    else
        echo ""
        echo -e "${RED}$service_name installation/reinstallation failed${NC}"
        return 1
    fi
}

# Main execution
show_main_menu
