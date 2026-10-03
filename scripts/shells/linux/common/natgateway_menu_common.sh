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
    local bridge=""
    local -a links=()
    natgw_load_config
    while IFS= read -r bridge; do
        natgw_load_applied "$bridge"
        [ -n "$NATGW_APPLIED_WAN" ] && links+=("$NATGW_APPLIED_WAN->$(natgw_bridge_members "$bridge" | tr '\n' ' ' | sed 's/ $//')")
    done < <(natgw_known_bridges)
    echo "Service: $(systemctl is-active "$NATGW_SERVICE_NAME" 2>/dev/null) | State: ${links[*]:-IDLE}"
    if [ "$ROUTE_MODE" = "pairs" ]; then
        echo "Mode: pairs (1:1) | Pairs: ${PAIRS:-auto} | Host uplink: $SYSTEM_WAN | Gateway: $LAN_ADDRESS+ | DHCP: $DHCP_ENABLED"
    else
        echo "Mode: single | Uplink: $WAN_SELECT | Relay: $LAN_MODE${LAN_PORTS:+ ($LAN_PORTS)} | Gateway: $LAN_ADDRESS | DHCP: $DHCP_ENABLED"
    fi
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

natgw_menu_port_label() {
    local iface="$1"
    echo "$iface ($(natgw_is_usb "$iface" && echo usb || echo onboard), link $(natgw_has_carrier "$iface" && echo up || echo down)${iface:+, $(natgw_ipv4_of "$iface")})"
}

natgw_menu_usb_ifaces() {
    local iface=""
    while IFS= read -r iface; do
        natgw_is_usb "$iface" && echo "$iface"
    done < <(natgw_physical_ifaces)
}

# Picks a USB uplink: the leading choices (e.g. auto/none) come first, then the
# USB adapters present now, then a typed name for one not plugged in yet.
natgw_menu_pick_usb() {
    local title="$1"
    shift
    local -a leading=("$@")
    local -a usbs=()
    local -a items=()
    local iface=""
    local typed_index=0
    mapfile -t usbs < <(natgw_menu_usb_ifaces)
    items=("${leading[@]}")
    for iface in "${usbs[@]}"; do
        items+=("$(natgw_menu_port_label "$iface")")
    done
    items+=("Type an interface name (not plugged in yet)..." "Cancel")
    typed_index=$((${#leading[@]} + ${#usbs[@]}))
    arrow_menu_select "$title" items 0 "$((typed_index + 1))"
    if [ "$ARROW_MENU_SELECTED_INDEX" -ge 0 ] && [ "$ARROW_MENU_SELECTED_INDEX" -lt "${#leading[@]}" ]; then
        NATGW_MENU_PICK="${leading[$ARROW_MENU_SELECTED_INDEX]%% *}"
        return 0
    fi
    if [ "$ARROW_MENU_SELECTED_INDEX" -ge "${#leading[@]}" ] && [ "$ARROW_MENU_SELECTED_INDEX" -lt "$typed_index" ]; then
        NATGW_MENU_PICK="${usbs[$((ARROW_MENU_SELECTED_INDEX - ${#leading[@]}))]}"
        return 0
    fi
    [ "$ARROW_MENU_SELECTED_INDEX" -eq "$typed_index" ] || return 1
    prompt_read_default NATGW_MENU_INPUT "" 120 "Interface name: "
    natgw_valid_iface_name "$NATGW_MENU_INPUT" || return 1
    NATGW_MENU_PICK="$NATGW_MENU_INPUT"
}

# One choice per wired onboard port: USB auto, a specific USB, or no pair.
natgw_menu_edit_pairs() {
    local -a ports=()
    local -a pairs=()
    local iface=""
    while IFS= read -r iface; do
        natgw_is_wireless "$iface" && continue
        natgw_is_usb "$iface" && continue
        ports+=("$iface")
    done < <(natgw_physical_ifaces)
    if [ ${#ports[@]} -eq 0 ]; then
        log_warning "No onboard wired port available"
        return 1
    fi
    for iface in "${ports[@]}"; do
        natgw_menu_pick_usb "USB uplink for relay port $(natgw_menu_port_label "$iface")" \
            "auto (first free USB adapter, when plugged in)" "skip (no pair on this port)" || return 1
        [ "$NATGW_MENU_PICK" = "skip" ] && continue
        pairs+=("$NATGW_MENU_PICK:$iface")
    done
    if [ ${#pairs[@]} -eq 0 ]; then
        log_warning "No pair selected"
        return 1
    fi
    NATGW_MENU_PICK="$(IFS=','; echo "${pairs[*]}")"
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
        "Mode: Single (one USB -> relay ports)"
        "Mode: Pairs (one USB per relay port, 1:1)"
        "Single: Relay on all onboard ports"
        "Single: Relay on one port..."
        "Single: Relay on selected ports..."
        "Single: Uplink (WAN) USB auto / specific..."
        "Pairs: Auto (every onboard port, USB auto)"
        "Pairs: Edit pairs..."
        "Pairs: Host uplink (auto / none / specific)..."
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
            3) cmd_set_mode single ;;
            4) cmd_set_mode pairs ;;
            5) cmd_set_lan all ;;
            6) natgw_menu_pick_one && cmd_set_lan one "$NATGW_MENU_PICK" ;;
            7) natgw_menu_pick_list && cmd_set_lan list "$NATGW_MENU_PICK" ;;
            8) natgw_menu_pick_wan && cmd_set_wan "$NATGW_MENU_PICK" ;;
            9) cmd_set_pairs auto ;;
            10) natgw_menu_edit_pairs && cmd_set_pairs "$NATGW_MENU_PICK" ;;
            11) natgw_menu_pick_usb "Host uplink (the pair USB this machine uses for internet)" \
                    "auto (first live pair USB)" "none (pair USBs only relay)" && cmd_set_system_wan "$NATGW_MENU_PICK" ;;
            12) natgw_menu_edit_network ;;
            13) cmd_service restart ;;
            14) cmd_service stop ;;
            15) cmd_logs ;;
            16) cmd_uninstall ;;
            *) return 0 ;;
        esac
        natgw_menu_pause
    done
}
