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
DIAG_MONITOR_SCRIPT="$PARENT_DIR_LEVEL_1/debian_com/natgateway_diag_monitor.sh"
NETWORK_ROUTER_APP_DIR="$(cd "$PARENT_DIR_LEVEL_2/../../.." && pwd)/apps/network_router"
NETWORK_ROUTER_CGI_NAME="network_router"
NETWORK_ROUTER_CGI_SCRIPT="$PARENT_DIR_LEVEL_1/debian_com/natgateway_files_cgi.sh"
NETWORK_ROUTER_CANONICAL="network-router-file-v1"
NETWORK_ROUTER_LINK_TTL=3600
NETWORK_ROUTER_MAX_TTL=86400
OPENWRT_AP_FILE="openwrt/ap_mode.sh"
OPENWRT_AP_SCRIPT="$NETWORK_ROUTER_APP_DIR/$OPENWRT_AP_FILE"
OPENWRT_AP_HOST="2"
LEGACY_MONITOR_COPY="/usr/local/bin/natgateway-monitor.sh"
NATGATEWAY_LINK="/usr/local/bin/natgateway"
NATGATEWAY_COMMAND_NAME="natgateway"
SERVICE_SHORT_NAME="natgateway"
SERVICE_DESCRIPTION="NAT Gateway (USB uplink relay)"
SERVICE_CPU_LIMIT="10%"
SERVICE_MEMORY_LIMIT="100M"
SERVICE_UNIT_FILE="/etc/systemd/system/ncore-natgateway.service"
DIAG_SERVICE_SHORT_NAME="natgateway-diag"
DIAG_SERVICE_DESCRIPTION="NAT Gateway disconnect diagnostics"
DIAG_SERVICE_UNIT_FILE="/etc/systemd/system/ncore-natgateway-diag.service"
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
source "$COMMON_DIR/service_contract_common.sh"
source "$COMMON_DIR/client_key_common.sh"
source "$COMMON_DIR/laravel_rescue_signature.sh"
source "$COMMON_DIR/natgateway_engine_common.sh"
source "$COMMON_DIR/natgateway_diag_common.sh"
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
  diag [list]                Disconnect incidents saved by ncore-natgateway-diag (only the
                             ${NATGW_DIAG_WINDOW_SECONDS}s before an outage, the outage and ${NATGW_DIAG_POST_SECONDS}s after it are kept)
  diag show <incident>|latest  Summary, samples, kernel/gateway/phone logs of one incident
  diag clear                 Delete all saved incidents
  openwrt                    One-line command that turns an OpenWrt router behind a relay port into
                             a Wi-Fi access point, and its admin address afterwards

Changes are picked up by the running service within $NATGW_POLL_SECONDS seconds.
Menu: $MENU_PATH_HINT
EOF
}

natgw_service_installed() {
    [ -f "$SERVICE_UNIT_FILE" ]
}

natgw_service_current() {
    natgw_unit_current "$SERVICE_UNIT_FILE" "$MONITOR_SCRIPT" "$NATGW_SERVICE_NAME"
}

natgw_unit_current() {
    [ -f "$1" ] && grep -qF "$2" "$1" && systemctl is-active --quiet "$3"
}

# A daemon keeps its scripts in memory: a service started before the newest of
# the given files still runs the old code.
natgw_unit_stale() {
    local service="$1"
    shift
    local pid=""
    local elapsed=""
    local started=""
    local file=""
    pid="$(systemctl show -p MainPID --value "$service" 2>/dev/null)"
    [ -n "$pid" ] && [ "$pid" != "0" ] || return 1
    elapsed="$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ')"
    [ -n "$elapsed" ] || return 1
    started=$(($(date +%s) - elapsed))
    for file in "$@"; do
        [ "$(stat -c %Y "$file" 2>/dev/null || echo 0)" -gt "$started" ] && return 0
    done
    return 1
}

natgw_service_stale() {
    natgw_unit_stale "$NATGW_SERVICE_NAME" "$MONITOR_SCRIPT" "$COMMON_DIR/natgateway_engine_common.sh" "$COMMON_DIR/runtime_environment.sh" \
        || natgw_unit_stale "$NATGW_DIAG_SERVICE_NAME" "$DIAG_MONITOR_SCRIPT" "$COMMON_DIR/natgateway_diag_common.sh" "$COMMON_DIR/natgateway_engine_common.sh"
}

# Device files (apps/network_router: openwrt/, ...) are served only through
# the signed cgi-bin/network_router of the rescue httpd (contract
# ports.laravel_rescue_httpd): links carry a CORE_NODE_CLIENT_KEY_1 HMAC and an
# expiry, issued on this host, so :16888 has no unauthenticated file path.
# Skipped while that httpd is not installed.
natgw_rescue_docroot() {
    local subpath=""
    subpath="$(sc_get laravel_rescue.docroot_subpath)"
    [ -n "$subpath" ] && [ -d "$CORE_NODE_DATA_DIR/$subpath" ] && echo "$CORE_NODE_DATA_DIR/$subpath"
}

natgw_client_key_file() {
    client_key_load_contract >/dev/null
    [ -n "$CLIENT_KEY_NAME" ] && echo "$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME"
}

natgw_publish_device_files() {
    local docroot=""
    local wrapper=""
    local content=""
    docroot="$(natgw_rescue_docroot)"
    [ -n "$docroot" ] || return 0
    rm -rf "$docroot/openwrt" "$docroot/network_router"
    wrapper="$docroot/cgi-bin/$NETWORK_ROUTER_CGI_NAME"
    content="#!/bin/sh
export LR_SIGNATURE_LIB='$COMMON_DIR/laravel_rescue_signature.sh'
export NATGW_FILES_ROOT='$NETWORK_ROUTER_APP_DIR'
export NATGW_FILES_KEY_FILE='$(natgw_client_key_file)'
export NATGW_FILES_KEY_ID_LENGTH='$CLIENT_KEY_ID_LENGTH'
export NATGW_FILES_CANONICAL='$NETWORK_ROUTER_CANONICAL'
export NATGW_FILES_MAX_TTL='$NETWORK_ROUTER_MAX_TTL'
exec /bin/bash '$NETWORK_ROUTER_CGI_SCRIPT'"
    [ "$(cat "$wrapper" 2>/dev/null)" = "$content" ] && return 0
    mkdir -p "$(dirname "$wrapper")"
    printf '%s\n' "$content" > "$wrapper"
    chmod 755 "$wrapper"
    log_success "Signed device-file download installed: $wrapper"
}

# Signed link to one device file: natgw_signed_file_url <host> <file> [ttl].
natgw_signed_file_url() {
    local host="$1"
    local file="$2"
    local exp=""
    local port=""
    port="$(sc_get ports.laravel_rescue_httpd)"
    exp=$(( $(date +%s) + ${3:-$NETWORK_ROUTER_LINK_TTL} ))
    lr_sig_load_key "$(natgw_client_key_file)" "$CLIENT_KEY_ID_LENGTH"
    lr_sig_sign "$NETWORK_ROUTER_CANONICAL" "$file" "$exp"
    [ -n "$port" ] && [ -n "$LR_SIG_VALUE" ] || return 1
    echo "http://$host:$port/cgi-bin/$NETWORK_ROUTER_CGI_NAME?path=$file&exp=$exp&sig=$LR_SIG_VALUE"
}

# One line per LAN: the command to paste on the router (it fetches the script
# from this host's address on that LAN) and the AP admin address afterwards.
cmd_openwrt() {
    local index=0
    local entry=""
    local address=""
    local gateway=""
    local ap=""
    local url=""
    local -a entries=()
    natgw_load_config
    mapfile -t entries < <(natgw_lan_map_entries)
    [ "$ROUTE_MODE" = "pairs" ] || entries=("${entries[0]:-LAN1:-}")
    echo "OpenWrt as a Wi-Fi access point: this host routes, serves DHCP/DNS and shapes; the router only bridges Wi-Fi."
    echo "Wire this host's relay port to a router LAN port (apply also bridges the router WAN port), then run on the router"
    echo "(SSH or LuCI > System > TTYD/Command, while it still gets an address from this host)."
    echo "Each link is signed with CORE_NODE_CLIENT_KEY_1 and valid for $((NETWORK_ROUTER_LINK_TTL / 60)) minutes; run this command again for fresh links:"
    for index in "${!entries[@]}"; do
        entry="${entries[$index]}"
        if [ "$ROUTE_MODE" = "pairs" ]; then
            address="$(natgw_pair_address "$index")"
        else
            address="$LAN_ADDRESS"
        fi
        gateway="${address%/*}"
        ap="${gateway%.*}.$OPENWRT_AP_HOST"
        [ "$ap" = "$gateway" ] && ap="${gateway%.*}.$((OPENWRT_AP_HOST + 1))"
        echo
        echo "  ${entry%%:*} (${entry#*:}), gateway $gateway:"
        if [ -n "$(natgw_rescue_docroot)" ] && url="$(natgw_signed_file_url "$gateway" "$OPENWRT_AP_FILE")"; then
            echo "    wget -qO /tmp/ap_mode.sh '$url' && sh /tmp/ap_mode.sh apply $ap/24 $gateway"
        else
            echo "    (no signed download: rescue httpd or client key missing; copy $OPENWRT_AP_SCRIPT to the router) sh ap_mode.sh apply $ap/24 $gateway"
        fi
        echo "    AP admin afterwards: http://$ap  ssh root@$ap  ($(ping -c1 -W1 "$ap" >/dev/null 2>&1 && echo reachable now || echo not reachable now))"
        echo "    Undo on the router: sh /tmp/ap_mode.sh restore  (backups in /root/ap-mode-backups)"
    done
    grep -h ' OpenWrt ' "$NATGW_RUN_DIR"/dnsmasq.*.leases 2>/dev/null | awk '{print "  OpenWrt lease now: " $3 " (router mode; its LuCI/SSH are usually closed on WAN)"}' | sort -u
    return 0
}

# A restart keeps the gateway's live links: the monitor skips its teardown and
# the next one takes them over (a plain stop still releases everything).
natgw_restart_unit() {
    if [ "$1" = "$NATGW_SERVICE_NAME" ]; then
        mkdir -p "$(dirname "$NATGW_KEEP_LINKS_MARKER")"
        touch "$NATGW_KEEP_LINKS_MARKER"
    fi
    systemctl restart "$1"
}

# Installs the unit, restarts it when it runs older code, or keeps it.
# Args: script short_name description service unit_file code_files...
natgw_ensure_unit() {
    local script="$1"
    local short_name="$2"
    local description="$3"
    local service="$4"
    local unit_file="$5"
    shift 5
    if natgw_unit_current "$unit_file" "$script" "$service" && natgw_unit_stale "$service" "$script" "$@"; then
        log_info "Code updated since $service started: restarting it"
        natgw_restart_unit "$service"
    elif natgw_unit_current "$unit_file" "$script" "$service"; then
        log_success "Service $service already installed and running"
        return 0
    else
        create_ncore_service "$script" "$short_name" "$description" "$SERVICE_CPU_LIMIT" "$SERVICE_MEMORY_LIMIT"
    fi
    if ! systemctl is-active --quiet "$service"; then
        log_error "Service $service failed to start: journalctl -u $service -n 50"
        return 1
    fi
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
    chmod +x "$MONITOR_SCRIPT" "$DIAG_MONITOR_SCRIPT" "$REAL_SCRIPT_PATH" 2>/dev/null || true
    natgw_ensure_command_link
    natgw_publish_device_files

    natgw_ensure_unit "$MONITOR_SCRIPT" "$SERVICE_SHORT_NAME" "$SERVICE_DESCRIPTION" "$NATGW_SERVICE_NAME" "$SERVICE_UNIT_FILE" \
        "$COMMON_DIR/natgateway_engine_common.sh" "$COMMON_DIR/runtime_environment.sh" || return 1
    natgw_ensure_unit "$DIAG_MONITOR_SCRIPT" "$DIAG_SERVICE_SHORT_NAME" "$DIAG_SERVICE_DESCRIPTION" "$NATGW_DIAG_SERVICE_NAME" "$DIAG_SERVICE_UNIT_FILE" \
        "$COMMON_DIR/natgateway_diag_common.sh" "$COMMON_DIR/natgateway_engine_common.sh" || return 1
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
    [ -f "$DIAG_SERVICE_UNIT_FILE" ] && remove_ncore_service "$DIAG_SERVICE_SHORT_NAME"
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
    local service=""
    for service in "$NATGW_SERVICE_NAME" "$NATGW_DIAG_SERVICE_NAME"; do
        [ -f "/etc/systemd/system/$service.service" ] || continue
        case "$action" in
            start) systemctl enable --now "$service" ;;
            stop) systemctl stop "$service" ;;
            restart) natgw_restart_unit "$service" ;;
        esac
        log_info "$service: $(systemctl is-active "$service")"
    done
}

# diag: list incidents; diag show [name|latest]; diag clear.
cmd_diag() {
    local action="${1:-list}"
    local name="${2:-latest}"
    local dir=""
    case "$action" in
        list) natgw_diag_print_list ;;
        show)
            if [ "$name" = "latest" ]; then
                dir="$(natgw_diag_incidents | head -n 1)"
            else
                dir="$NATGW_DIAG_INCIDENTS_DIR/$name"
            fi
            [ -n "$dir" ] && [ -d "$dir" ] || { log_warning "No incident: $name"; return 1; }
            natgw_diag_show "$dir"
            ;;
        clear)
            natgw_diag_clear
            log_success "Disconnect logs cleared: $NATGW_DIAG_INCIDENTS_DIR"
            ;;
        *) log_error "Usage: diag [list | show <incident>|latest | clear]"; return 1 ;;
    esac
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
        diag) cmd_diag "${2:-}" "${3:-}" ;;
        openwrt) cmd_openwrt ;;
        *) usage; return 1 ;;
    esac
}

main "$@"
