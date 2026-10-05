#!/bin/bash
# NAT gateway (network router): when a USB network adapter is the uplink, this
# host's onboard ports relay it (NAT + DHCP) to other computers or routers:
# one USB for every relay port (single) or a USB picked per relay port (pairs).
# Installed as the ncore-natgateway background service; `natgateway` is the CLI.
# Supported: Ubuntu 24.04-26.04, Debian 12-13 (nftables, iproute2, dnsmasq).

SCRIPT_INDEX="113"
REAL_SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "$REAL_SCRIPT_PATH")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
COMMON_DIR="$PARENT_DIR_LEVEL_2/common"
MONITOR_SCRIPT="$PARENT_DIR_LEVEL_1/debian_com/natgateway_monitor.sh"
LEGACY_MONITOR_COPY="/usr/local/bin/natgateway-monitor.sh"
NATGATEWAY_LINK="/usr/local/bin/natgateway"
NATGATEWAY_COMMAND_NAME="natgateway"
SERVICE_SHORT_NAME="natgateway"
SERVICE_DESCRIPTION="NAT Gateway (USB uplink relay)"
SERVICE_CPU_LIMIT="10%"
SERVICE_MEMORY_LIMIT="100M"
SERVICE_UNIT_FILE="/etc/systemd/system/ncore-natgateway.service"
INSTALL_FLAG_KEY="INSTALL_NETWORK_ROUTER"
MENU_PATH_HINT="dd.sh > Linux Management > Linux System Tools > [#] Setup Network Router"
ASSUME_YES="false"
CONFIRM_REPLY=""
INVOKED_AS="$(basename "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

source "$COMMON_DIR/gvar_common.sh"
source "$COMMON_DIR/arrow_menu.sh"
source "$COMMON_DIR/prompt_common.sh"
source "$COMMON_DIR/systemd_service_manager.sh"
source "$COMMON_DIR/natgateway_engine_common.sh"
source "$COMMON_DIR/natgateway_runtime_common.sh"
source "$COMMON_DIR/natgateway_menu_common.sh"

usage() {
    cat <<EOF
Usage: $NATGATEWAY_COMMAND_NAME [command]

  (no command)               Interactive menu
  install [--yes]            Install/repair the ncore-natgateway background service
  uninstall [--yes]          Stop and remove the service (configuration is kept)
  status                     Configuration, service state, ports and DHCP leases
  ports                      Detected ports and their current role
  set-mode single|pairs      single: one uplink for the relay ports (default)
                             pairs: each relay port gets its own USB uplink (1:1 or a pool many:1)
  set-wan usb|<iface>|usb@<port>
                             single: any USB adapter (default, auto) or a named interface
  set-lan all                single: relay on every onboard wired port
  set-lan one <iface>        single: relay on one port
  set-lan list <if1,if2,...> single: relay on the listed ports
  set-lan-map auto | LAN1:<iface>,LAN2:<iface>,...
                             LAN names used by pairs (default auto: LAN<N> = N-th onboard wired port)
  set-pairs auto             pairs: one auto pair per LAN name, USBs in plug-in order (default;
                             with fewer USBs than ports LAN1 is served first)
  set-pairs <usb>:<lan>,...  pairs (config order = priority): <lan> = LAN<N> or an interface;
                             <usb> = auto, an interface,
                             usb@<port> (physical USB port, stable across phone reconnects)
                             or a pool <usb>+<usb>... (first ready wins); a USB serves one port
  set-system-wan auto|none|<iface>|usb@<port>
                             pairs: the one pair USB that also serves this host (default auto);
                             every other pair USB only relays
  set-address <a.b.c.d/24>   Gateway address of the relay network (default $NATGW_DEFAULT_ADDRESS;
                             pairs: pair N uses the next N-th /24)
  set-dhcp on|off            DHCP/DNS server for relay clients
  start | stop | restart     Control the background service
  logs                       Recent service logs

Changes are picked up by the running service within $NATGW_POLL_SECONDS seconds.
Menu: $MENU_PATH_HINT
EOF
}

natgw_service_installed() {
    [ -f "$SERVICE_UNIT_FILE" ]
}

natgw_service_current() {
    natgw_service_installed \
        && grep -qF "$MONITOR_SCRIPT" "$SERVICE_UNIT_FILE" \
        && systemctl is-active --quiet "$NATGW_SERVICE_NAME"
}

# The monitor keeps its scripts in memory: a service started before the newest
# monitor/engine file still runs the old code.
natgw_service_stale() {
    local pid=""
    local elapsed=""
    local started=""
    local file=""
    pid="$(systemctl show -p MainPID --value "$NATGW_SERVICE_NAME" 2>/dev/null)"
    [ -n "$pid" ] && [ "$pid" != "0" ] || return 1
    elapsed="$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ')"
    [ -n "$elapsed" ] || return 1
    started=$(($(date +%s) - elapsed))
    for file in "$MONITOR_SCRIPT" "$COMMON_DIR/natgateway_engine_common.sh" "$COMMON_DIR/runtime_environment.sh"; do
        [ "$(stat -c %Y "$file" 2>/dev/null || echo 0)" -gt "$started" ] && return 0
    done
    return 1
}

# y/N confirmation; --yes and unattended runs take the given default.
natgw_confirm() {
    local question="$1"
    local default_answer="$2"
    if [ "$ASSUME_YES" = "true" ]; then
        return 0
    fi
    prompt_read_default CONFIRM_REPLY "$default_answer" 60 "$question "
    [[ "$CONFIRM_REPLY" =~ ^[Yy]([Ee][Ss])?$ ]]
}

natgw_ensure_command_link() {
    [ "$(readlink -f "$NATGATEWAY_LINK" 2>/dev/null)" = "$REAL_SCRIPT_PATH" ] && return 0
    ln -sfn "$REAL_SCRIPT_PATH" "$NATGATEWAY_LINK"
    log_success "Command available: $NATGATEWAY_LINK"
}

natgw_ensure_sysctl_file() {
    local content="net.ipv4.ip_forward = 1"
    [ "$(cat "$NATGW_SYSCTL_FILE" 2>/dev/null)" = "$content" ] && return 0
    printf '%s\n' "$content" > "$NATGW_SYSCTL_FILE"
    log_info "Persisted IP forwarding: $NATGW_SYSCTL_FILE"
}

natgw_ensure_config_file() {
    [ -f "$NATGW_CONFIG_FILE" ] && return 0
    natgw_load_config
    natgw_save_config
    log_info "Configuration created: $NATGW_CONFIG_FILE"
}

cmd_install() {
    log_header "NAT Gateway: install as background service"
    echo "Uplink: USB network adapter (auto). Relay: onboard wired ports (NAT + DHCP on $NATGW_DEFAULT_ADDRESS)."
    echo "Mode single: one USB for every relay port. Mode pairs: a USB (auto, named or pool) per relay port ('$NATGATEWAY_COMMAND_NAME set-mode pairs')."
    echo "Ports carrying this machine's own default route are never taken."
    if ! natgw_confirm "Install and start the ncore-natgateway background service? [Y/n]:" "y"; then
        log_info "Installation cancelled"
        return 0
    fi
    check_permissions || return 1
    check_dependencies || return 1
    cleanup_old_lnxrouter
    [ -e "$LEGACY_MONITOR_COPY" ] && rm -f "$LEGACY_MONITOR_COPY"
    natgw_ensure_config_file
    natgw_ensure_sysctl_file
    chmod +x "$MONITOR_SCRIPT" "$REAL_SCRIPT_PATH" 2>/dev/null || true
    natgw_ensure_command_link

    if natgw_service_current && natgw_service_stale; then
        log_info "Code updated since $NATGW_SERVICE_NAME started: restarting it"
        systemctl restart "$NATGW_SERVICE_NAME"
        if ! systemctl is-active --quiet "$NATGW_SERVICE_NAME"; then
            log_error "Service $NATGW_SERVICE_NAME failed to start: journalctl -u $NATGW_SERVICE_NAME -n 50"
            return 1
        fi
    elif natgw_service_current; then
        log_success "Service $NATGW_SERVICE_NAME already installed and running"
    else
        create_ncore_service "$MONITOR_SCRIPT" "$SERVICE_SHORT_NAME" "$SERVICE_DESCRIPTION" "$SERVICE_CPU_LIMIT" "$SERVICE_MEMORY_LIMIT"
        if ! systemctl is-active --quiet "$NATGW_SERVICE_NAME"; then
            log_error "Service $NATGW_SERVICE_NAME failed to start: journalctl -u $NATGW_SERVICE_NAME -n 50"
            return 1
        fi
    fi
    set_var "$INSTALL_FLAG_KEY" "true" >/dev/null 2>&1 || true
    log_success "Installed. Run '$NATGATEWAY_COMMAND_NAME status' or '$NATGATEWAY_COMMAND_NAME help'."
    return 0
}

cmd_uninstall() {
    if ! natgw_confirm "Remove the ncore-natgateway service and release all relay ports? [y/N]:" "n"; then
        log_info "Uninstall cancelled"
        return 0
    fi
    if natgw_service_installed; then
        remove_ncore_service "$SERVICE_SHORT_NAME"
    fi
    natgw_teardown "uninstalled"
    rm -f "$NATGW_SYSCTL_FILE"
    [ "$(readlink -f "$NATGATEWAY_LINK" 2>/dev/null)" = "$REAL_SCRIPT_PATH" ] && rm -f "$NATGATEWAY_LINK"
    set_var "$INSTALL_FLAG_KEY" "false" >/dev/null 2>&1 || true
    log_success "Uninstalled (configuration kept: $NATGW_CONFIG_FILE)"
}

natgw_config_saved() {
    natgw_save_config
    log_success "Saved: ROUTE_MODE=$ROUTE_MODE WAN_SELECT=$WAN_SELECT LAN_MODE=$LAN_MODE LAN_PORTS=${LAN_PORTS:--} PAIRS=${PAIRS:-auto} LAN_MAP=${LAN_MAP:-auto} SYSTEM_WAN=$SYSTEM_WAN LAN_ADDRESS=$LAN_ADDRESS DHCP=$DHCP_ENABLED"
    if systemctl is-active --quiet "$NATGW_SERVICE_NAME"; then
        log_info "The running service applies it within $NATGW_POLL_SECONDS seconds."
    else
        log_warning "Service is not running: '$NATGATEWAY_COMMAND_NAME install' or '$NATGATEWAY_COMMAND_NAME start'."
    fi
}

natgw_valid_iface_name() {
    [[ "$1" =~ ^[A-Za-z0-9_.:-]{1,15}$ ]]
}

# An interface name or usb@<port> (the physical USB port, e.g. usb@3-3).
natgw_valid_uplink_spec() {
    [[ "$1" =~ ^${NATGW_USB_PORT_PREFIX}[0-9]+-[0-9.]+$ ]] || natgw_valid_iface_name "$1"
}

# A pair USB spec: one uplink spec or a "+" pool of them.
natgw_valid_pool_spec() {
    local entry=""
    local -a entries=()
    IFS='+' read -r -a entries <<< "$1"
    [ ${#entries[@]} -gt 0 ] || return 1
    for entry in "${entries[@]}"; do
        natgw_valid_uplink_spec "$entry" || return 1
    done
}

cmd_set_wan() {
    local value="$1"
    if [ "$value" != "usb" ] && ! natgw_valid_uplink_spec "$value"; then
        log_error "Usage: set-wan usb|<iface>|${NATGW_USB_PORT_PREFIX}<port>"
        return 1
    fi
    natgw_load_config
    WAN_SELECT="$value"
    natgw_config_saved
}

cmd_set_lan() {
    local mode="$1"
    local ports="$2"
    local port=""
    local -a port_list=()

    case "$mode" in
        all) ports="" ;;
        one|list)
            IFS=',' read -r -a port_list <<< "${ports// /}"
            if [ ${#port_list[@]} -eq 0 ]; then
                log_error "Usage: set-lan $mode <iface>[,<iface>...]"
                return 1
            fi
            for port in "${port_list[@]}"; do
                if ! natgw_valid_iface_name "$port"; then
                    log_error "Invalid interface name: $port"
                    return 1
                fi
                [ -e "/sys/class/net/$port" ] || log_warning "Not present now (used when plugged in): $port"
            done
            [ "$mode" = "one" ] && ports="${port_list[0]}"
            ;;
        *)
            log_error "Usage: set-lan all | one <iface> | list <if1,if2>"
            return 1
            ;;
    esac
    natgw_load_config
    LAN_MODE="$mode"
    LAN_PORTS="$ports"
    natgw_config_saved
}

cmd_set_mode() {
    case "$1" in
        single|pairs) ;;
        *) log_error "Usage: set-mode single|pairs"; return 1 ;;
    esac
    natgw_load_config
    ROUTE_MODE="$1"
    natgw_config_saved
}

# auto (LAN<N> = N-th onboard wired port), or "LAN<N>:<iface>" entries.
cmd_set_lan_map() {
    local value="${1// /}"
    local entry=""
    local name=""
    local port=""
    local -a entries=()
    local -a names=()
    local -a ports=()
    local -a normalized=()

    if [ -z "$value" ]; then
        log_error "Usage: set-lan-map auto | ${NATGW_LAN_NAME_PREFIX}1:<iface>[,${NATGW_LAN_NAME_PREFIX}2:<iface>...]"
        return 1
    fi
    if [ "$value" != "auto" ]; then
        IFS=',' read -r -a entries <<< "$value"
        for entry in "${entries[@]}"; do
            [ -n "$entry" ] || continue
            name="${entry%%:*}"
            port="${entry#*:}"
            if [[ ! "$name" =~ ^${NATGW_LAN_NAME_PREFIX}[0-9]+$ ]] || [ "$port" = "$entry" ] || ! natgw_valid_iface_name "$port"; then
                log_error "Invalid LAN name entry: $entry"
                return 1
            fi
            if natgw_list_contains "$name" "${names[@]}" || natgw_list_contains "$port" "${ports[@]}"; then
                log_error "Each LAN name and port may appear once: $entry"
                return 1
            fi
            names+=("$name")
            ports+=("$port")
            normalized+=("$name:$port")
            [ -e "/sys/class/net/$port" ] || log_warning "Not present now (used when plugged in): $port"
        done
        [ ${#names[@]} -gt 0 ] || { log_error "No LAN name given"; return 1; }
    fi
    natgw_load_config
    LAN_MAP="$(IFS=','; echo "${normalized[*]}")"
    natgw_config_saved
}

# auto, or "<usb>:<lan>" entries (lan = LAN<N> or an interface); a bare
# "<lan>" means "auto:<lan>".
cmd_set_pairs() {
    local value="${1// /}"
    local entry=""
    local usb=""
    local lan=""
    local -a entries=()
    local -a normalized=()
    local -a lans=()

    if [ -z "$value" ]; then
        log_error "Usage: set-pairs auto | <usb|auto>:<lan>[,<usb|auto>:<lan>...] (usb = <iface>, ${NATGW_USB_PORT_PREFIX}<port> or a <usb>+<usb> pool)"
        return 1
    fi
    if [ "$value" != "auto" ]; then
        IFS=',' read -r -a entries <<< "$value"
        for entry in "${entries[@]}"; do
            [ -n "$entry" ] || continue
            [[ "$entry" == *:* ]] || entry="auto:$entry"
            usb="${entry%%:*}"
            lan="${entry#*:}"
            if ! natgw_valid_iface_name "$lan" || { [ "$usb" != "auto" ] && ! natgw_valid_pool_spec "$usb"; }; then
                log_error "Invalid pair: $entry"
                return 1
            fi
            if natgw_list_contains "$lan" "${lans[@]}"; then
                log_error "Each relay port may appear in one pair only: $entry"
                return 1
            fi
            lans+=("$lan")
            normalized+=("$usb:$lan")
            [ -e "/sys/class/net/$(natgw_lan_port_of "$lan")" ] || log_warning "Not present now (used when plugged in): $lan"
            [ "$usb" = "auto" ] || [[ "$usb" == *+* ]] || [ -n "$(natgw_resolve_uplink "$usb")" ] || log_warning "Not present now (used when plugged in): $usb"
        done
        if [ ${#normalized[@]} -gt "$NATGW_MAX_PAIRS" ]; then
            log_error "At most $NATGW_MAX_PAIRS pairs"
            return 1
        fi
        [ ${#normalized[@]} -gt 0 ] || { log_error "No pair given"; return 1; }
    fi
    natgw_load_config
    PAIRS="$(IFS=','; echo "${normalized[*]}")"
    natgw_config_saved
}

cmd_set_system_wan() {
    local value="$1"
    if [ "$value" != "auto" ] && [ "$value" != "none" ] && ! natgw_valid_uplink_spec "$value"; then
        log_error "Usage: set-system-wan auto|none|<iface>|${NATGW_USB_PORT_PREFIX}<port>"
        return 1
    fi
    natgw_load_config
    SYSTEM_WAN="$value"
    natgw_config_saved
}

cmd_set_address() {
    local value="$1"
    if ! natgw_address_valid "$value"; then
        log_error "Usage: set-address a.b.c.d/24 (host part 1-254)"
        return 1
    fi
    natgw_load_config
    LAN_ADDRESS="$value"
    natgw_config_saved
}

cmd_set_dhcp() {
    natgw_load_config
    case "$1" in
        on) DHCP_ENABLED="yes" ;;
        off) DHCP_ENABLED="no" ;;
        *) log_error "Usage: set-dhcp on|off"; return 1 ;;
    esac
    natgw_config_saved
}

cmd_service() {
    local action="$1"
    if ! natgw_service_installed; then
        log_error "Service not installed: run '$NATGATEWAY_COMMAND_NAME install'"
        return 1
    fi
    case "$action" in
        start) systemctl enable --now "$NATGW_SERVICE_NAME" ;;
        stop) systemctl stop "$NATGW_SERVICE_NAME" ;;
        restart) systemctl restart "$NATGW_SERVICE_NAME" ;;
    esac
    log_info "$NATGW_SERVICE_NAME: $(systemctl is-active "$NATGW_SERVICE_NAME")"
}

cmd_logs() {
    journalctl -u "$NATGW_SERVICE_NAME" -n 80 --no-pager
}

# Install chain (no arguments, not invoked as `natgateway`): governed by the
# INSTALL_NETWORK_ROUTER selector flag; an existing install is repaired.
run_install_chain_step() {
    local flag=""
    flag="$(get_var "$INSTALL_FLAG_KEY" "false" 2>/dev/null)"
    if [ "$flag" = "true" ] || natgw_service_installed; then
        ASSUME_YES="true"
        cmd_install
        return
    fi
    log_info "Skipping NAT gateway ($INSTALL_FLAG_KEY=false). Enable: $MENU_PATH_HINT, or '$NATGATEWAY_COMMAND_NAME install'."
}

main() {
    local command="${1:-}"
    local arg=""

    for arg in "$@"; do
        [ "$arg" = "--yes" ] || [ "$arg" = "-y" ] && ASSUME_YES="true"
    done

    case "$command" in
        help|-h|--help) usage; return 0 ;;
        status) natgw_print_status; return 0 ;;
        ports) natgw_print_ports; return 0 ;;
    esac

    if [ "$EUID" -ne 0 ]; then
        exec ${USE_SUDO:-sudo} bash "$REAL_SCRIPT_PATH" "$@"
    fi

    case "$command" in
        "")
            if [ "$INVOKED_AS" = "$NATGATEWAY_COMMAND_NAME" ]; then
                show_interactive_menu
            else
                run_install_chain_step
            fi
            ;;
        menu) show_interactive_menu ;;
        install) cmd_install ;;
        uninstall) cmd_uninstall ;;
        set-mode) cmd_set_mode "${2:-}" ;;
        set-wan) cmd_set_wan "${2:-}" ;;
        set-pairs) cmd_set_pairs "${2:-}" ;;
        set-lan-map) cmd_set_lan_map "${2:-}" ;;
        set-system-wan) cmd_set_system_wan "${2:-}" ;;
        set-lan) cmd_set_lan "${2:-}" "${3:-}" ;;
        set-address) cmd_set_address "${2:-}" ;;
        set-dhcp) cmd_set_dhcp "${2:-}" ;;
        start|stop|restart) cmd_service "$command" ;;
        logs) cmd_logs ;;
        *) usage; return 1 ;;
    esac
}

main "$@"
