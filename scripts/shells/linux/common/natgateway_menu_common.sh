#!/bin/bash
# Interactive NAT gateway menu (`natgateway`, dd.sh > Linux System Tools >
# [#] Setup Network Router). Every action goes through the 113_natgateway.sh
# commands, so the menu and the CLI share one implementation.

NATGW_MENU_PICK=""
NATGW_MENU_INPUT=""

natgw_menu_pause() {
    prompt_read_default NATGW_MENU_INPUT "" 300 "Press Enter to continue..."
}

natgw_menu_header() {
    local state="IDLE"
    natgw_load_config
    natgw_load_applied
    [ -n "$NATGW_APPLIED_WAN" ] && state="ACTIVE ($NATGW_APPLIED_WAN -> $(natgw_bridge_members | tr '\n' ' '))"
    echo "Service: $(systemctl is-active "$NATGW_SERVICE_NAME" 2>/dev/null) | State: $state"
    echo "Uplink: $WAN_SELECT | Relay: $LAN_MODE${LAN_PORTS:+ ($LAN_PORTS)} | Gateway: $LAN_ADDRESS | DHCP: $DHCP_ENABLED"
}

# Wired ports that can relay (the current uplink is excluded).
natgw_menu_relay_candidates() {
    local iface=""
    natgw_load_config
    natgw_resolve_wan
    while IFS= read -r iface; do
        natgw_is_wireless "$iface" && continue
        [ "$iface" = "$NATGW_WAN" ] && continue
        echo "$iface"
    done < <(natgw_physical_ifaces)
}

natgw_menu_pick_one() {
    local -a ports=()
    local -a items=()
    local iface=""
    mapfile -t ports < <(natgw_menu_relay_candidates)
    if [ ${#ports[@]} -eq 0 ]; then
        log_warning "No wired port available"
        return 1
    fi
    for iface in "${ports[@]}"; do
        items+=("$iface ($(natgw_is_usb "$iface" && echo usb || echo onboard), link $(natgw_has_carrier "$iface" && echo up || echo down))")
    done
    items+=("Cancel")
    arrow_menu_select "Relay on one port" items 0 "${#ports[@]}"
    [ "$ARROW_MENU_SELECTED_INDEX" -ge 0 ] && [ "$ARROW_MENU_SELECTED_INDEX" -lt "${#ports[@]}" ] || return 1
    NATGW_MENU_PICK="${ports[$ARROW_MENU_SELECTED_INDEX]}"
}

natgw_menu_pick_list() {
    local -a ports=()
    local -a picked=()
    local -a numbers=()
    local number=""
    local index=0
    mapfile -t ports < <(natgw_menu_relay_candidates)
    if [ ${#ports[@]} -eq 0 ]; then
        log_warning "No wired port available"
        return 1
    fi
    for index in "${!ports[@]}"; do
        echo "  $((index + 1))) ${ports[$index]}"
    done
    prompt_read_default NATGW_MENU_INPUT "" 120 "Ports (numbers or names, comma separated): "
    IFS=',' read -r -a numbers <<< "${NATGW_MENU_INPUT// /}"
    for number in "${numbers[@]}"; do
        if [[ "$number" =~ ^[0-9]+$ ]] && [ "$number" -ge 1 ] && [ "$number" -le "${#ports[@]}" ]; then
            picked+=("${ports[$((number - 1))]}")
        elif [ -n "$number" ]; then
            picked+=("$number")
        fi
    done
    [ ${#picked[@]} -gt 0 ] || return 1
    NATGW_MENU_PICK="$(IFS=','; echo "${picked[*]}")"
}

natgw_menu_pick_wan() {
    local -a ports=()
    local -a items=("USB network adapter (auto-detect)")
    local iface=""
    mapfile -t ports < <(natgw_physical_ifaces)
    for iface in "${ports[@]}"; do
        items+=("$iface ($(natgw_is_usb "$iface" && echo usb || echo onboard), $(natgw_is_wireless "$iface" && echo wifi || echo wired), ${iface:+$(natgw_ipv4_of "$iface")})")
    done
    items+=("Cancel")
    arrow_menu_select "Uplink (WAN)" items 0 "$((${#ports[@]} + 1))"
    case "$ARROW_MENU_SELECTED_INDEX" in
        0) NATGW_MENU_PICK="usb" ;;
        *)
            [ "$ARROW_MENU_SELECTED_INDEX" -ge 1 ] && [ "$ARROW_MENU_SELECTED_INDEX" -le "${#ports[@]}" ] || return 1
            NATGW_MENU_PICK="${ports[$((ARROW_MENU_SELECTED_INDEX - 1))]}"
            ;;
    esac
}

natgw_menu_edit_network() {
    natgw_load_config
    prompt_read_default NATGW_MENU_INPUT "$LAN_ADDRESS" 120 "Gateway address [$LAN_ADDRESS]: "
    [ "$NATGW_MENU_INPUT" = "$LAN_ADDRESS" ] || cmd_set_address "$NATGW_MENU_INPUT"
    prompt_read_default NATGW_MENU_INPUT "" 60 "DHCP server for relay clients (on/off, Enter keeps $DHCP_ENABLED): "
    [ -n "$NATGW_MENU_INPUT" ] && cmd_set_dhcp "$NATGW_MENU_INPUT"
    return 0
}

show_interactive_menu() {
    local selected_index=0
    local -a menu_items=(
        "Quick Install / Repair (background service)"
        "Status"
        "Detected Ports"
        "Relay: All onboard ports"
        "Relay: One port..."
        "Relay: Selected ports..."
        "Uplink (WAN): USB auto / specific..."
        "Gateway Address & DHCP..."
        "Restart Service"
        "Stop Service"
        "View Logs"
        "Uninstall"
        "Back"
    )
    local back_index=$((${#menu_items[@]} - 1))

    while true; do
        arrow_menu_select "Network Router (NAT Gateway)" menu_items "$selected_index" "$back_index" natgw_menu_header
        selected_index="$ARROW_MENU_SELECTED_INDEX"
        [ "$ARROW_MENU_CANCELLED" = "true" ] && return 0
        case "$selected_index" in
            0) cmd_install ;;
            1) natgw_print_status ;;
            2) natgw_print_ports ;;
            3) cmd_set_lan all ;;
            4) natgw_menu_pick_one && cmd_set_lan one "$NATGW_MENU_PICK" ;;
            5) natgw_menu_pick_list && cmd_set_lan list "$NATGW_MENU_PICK" ;;
            6) natgw_menu_pick_wan && cmd_set_wan "$NATGW_MENU_PICK" ;;
            7) natgw_menu_edit_network ;;
            8) cmd_service restart ;;
            9) cmd_service stop ;;
            10) cmd_logs ;;
            11) cmd_uninstall ;;
            *) return 0 ;;
        esac
        natgw_menu_pause
    done
}
