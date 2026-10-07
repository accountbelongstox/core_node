#!/bin/bash
# Interactive NAT gateway menu (`natgateway`, dd.sh > Linux System Tools >
# [#] Setup Network Router). Configure is a form: Up/Down picks a row,
# Left/Right changes its value, Enter edits free-form values or runs an
# action. Changes stay a draft until Save / Save & Apply writes router.conf
# (same keys as the 113_natgateway.sh set-* commands).

NATGW_MENU_PICK=""
NATGW_MENU_INPUT=""

# Configure draft (one value per router.conf key; LAN rows as arrays).
NATGW_DRAFT_MODE=""
NATGW_DRAFT_WAN=""
NATGW_DRAFT_LAN_MODE=""
NATGW_DRAFT_LAN_PORTS=""
NATGW_DRAFT_SYSTEM_WAN=""
NATGW_DRAFT_ADDRESS=""
NATGW_DRAFT_DHCP=""
NATGW_DRAFT_LAN_NAMES=()
NATGW_DRAFT_LAN_IFACES=()
NATGW_DRAFT_UPLINKS=()
NATGW_DRAFT_EXTRA_PAIRS=()
NATGW_DRAFT_SAVED=""
NATGW_DRAFT_MESSAGE=""
NATGW_FORM_OPTIONS=()

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
    echo "Service: $(systemctl is-active "$NATGW_SERVICE_NAME" 2>/dev/null)$(natgw_service_stale && echo " (old code: Install / Upgrade / Repair restarts it)") | State: ${links[*]:-IDLE}"
    if [ "$ROUTE_MODE" = "pairs" ]; then
        echo "Saved: pairs | LANs: $(natgw_lan_map_entries | paste -sd ' ') | Pairs: ${PAIRS:-auto} | Host uplink: $SYSTEM_WAN | Gateway: $LAN_ADDRESS+ | DHCP: $DHCP_ENABLED"
    else
        echo "Saved: single | Uplink: $WAN_SELECT | Relay: $LAN_MODE${LAN_PORTS:+ ($LAN_PORTS)} | Gateway: $LAN_ADDRESS | DHCP: $DHCP_ENABLED"
    fi
}

natgw_menu_port_label() {
    local iface="$1"
    echo "$iface ($(natgw_is_usb "$iface" && echo "$NATGW_USB_PORT_PREFIX$(natgw_usb_port_of "$iface")" || echo onboard), link $(natgw_has_carrier "$iface" && echo up || echo down)${iface:+, $(natgw_ipv4_of "$iface")})"
}

natgw_menu_usb_ifaces() {
    local iface=""
    while IFS= read -r iface; do
        natgw_is_usb "$iface" && echo "$iface"
    done < <(natgw_physical_ifaces)
}

# Onboard wired ports (relay candidates; USB adapters are uplinks).
natgw_menu_wired_ifaces() {
    local iface=""
    while IFS= read -r iface; do
        natgw_is_wireless "$iface" && continue
        natgw_is_usb "$iface" && continue
        echo "$iface"
    done < <(natgw_physical_ifaces)
}

# A typed interface name or usb@<port>, or a "+" pool of them (first ready
# wins), for uplinks of USBs not plugged in now.
natgw_menu_type_uplink() {
    local entry=""
    local -a entries=()
    local -a usbs=()
    local index=0
    mapfile -t usbs < <(natgw_menu_usb_ifaces)
    for index in "${!usbs[@]}"; do
        echo "  $((index + 1))) $(natgw_menu_port_label "${usbs[$index]}")"
    done
    prompt_read_default NATGW_MENU_INPUT "" 120 "USB uplink(s) in priority order (numbers above, interface or ${NATGW_USB_PORT_PREFIX}<port>, comma separated): "
    IFS=',' read -r -a entries <<< "${NATGW_MENU_INPUT// /}"
    NATGW_MENU_PICK=""
    for entry in "${entries[@]}"; do
        if [[ "$entry" =~ ^[0-9]+$ ]] && [ "$entry" -ge 1 ] && [ "$entry" -le "${#usbs[@]}" ]; then
            entry="$NATGW_USB_PORT_PREFIX$(natgw_usb_port_of "${usbs[$((entry - 1))]}")"
        elif ! natgw_valid_uplink_spec "$entry"; then
            continue
        fi
        NATGW_MENU_PICK="${NATGW_MENU_PICK:+$NATGW_MENU_PICK+}$entry"
    done
    [ -n "$NATGW_MENU_PICK" ]
}

# Relay ports for single mode: numbers or names, comma separated.
natgw_menu_type_ports() {
    local -a ports=()
    local -a entries=()
    local entry=""
    local index=0
    mapfile -t ports < <(natgw_menu_wired_ifaces)
    for index in "${!ports[@]}"; do
        echo "  $((index + 1))) $(natgw_menu_port_label "${ports[$index]}")"
    done
    prompt_read_default NATGW_MENU_INPUT "" 120 "Relay ports (numbers or names, comma separated): "
    IFS=',' read -r -a entries <<< "${NATGW_MENU_INPUT// /}"
    NATGW_MENU_PICK=""
    for entry in "${entries[@]}"; do
        if [[ "$entry" =~ ^[0-9]+$ ]] && [ "$entry" -ge 1 ] && [ "$entry" -le "${#ports[@]}" ]; then
            entry="${ports[$((entry - 1))]}"
        elif ! natgw_valid_iface_name "$entry"; then
            continue
        fi
        NATGW_MENU_PICK="${NATGW_MENU_PICK:+$NATGW_MENU_PICK,}$entry"
    done
    [ -n "$NATGW_MENU_PICK" ]
}

# ----------------------------------------------------------------- draft ----

natgw_draft_load() {
    local entry=""
    local name=""
    local port=""
    local item=""
    local matched=""
    natgw_load_config
    natgw_collect_pair_specs
    NATGW_DRAFT_MODE="$ROUTE_MODE"
    NATGW_DRAFT_WAN="$WAN_SELECT"
    NATGW_DRAFT_LAN_MODE="$LAN_MODE"
    NATGW_DRAFT_LAN_PORTS="$LAN_PORTS"
    NATGW_DRAFT_SYSTEM_WAN="$SYSTEM_WAN"
    NATGW_DRAFT_ADDRESS="$LAN_ADDRESS"
    NATGW_DRAFT_DHCP="$DHCP_ENABLED"
    NATGW_DRAFT_LAN_NAMES=()
    NATGW_DRAFT_LAN_IFACES=()
    NATGW_DRAFT_UPLINKS=()
    NATGW_DRAFT_EXTRA_PAIRS=()
    while IFS= read -r entry; do
        name="${entry%%:*}"
        port="${entry#*:}"
        NATGW_DRAFT_LAN_NAMES+=("$name")
        NATGW_DRAFT_LAN_IFACES+=("$port")
        item="off"
        for matched in "${NATGW_PAIR_SPECS[@]}"; do
            if [ "${matched#*:}" = "$name" ] || [ "${matched#*:}" = "$port" ]; then
                item="${matched%%:*}"
                break
            fi
        done
        NATGW_DRAFT_UPLINKS+=("$item")
    done < <(natgw_lan_map_entries)
    for entry in "${NATGW_PAIR_SPECS[@]}"; do
        natgw_list_contains "${entry#*:}" "${NATGW_DRAFT_LAN_NAMES[@]}" "${NATGW_DRAFT_LAN_IFACES[@]}" || NATGW_DRAFT_EXTRA_PAIRS+=("$entry")
    done
    NATGW_DRAFT_SAVED="$(natgw_draft_signature)"
    NATGW_DRAFT_MESSAGE=""
}

# LAN_MAP of the draft: empty when it equals the default numbering.
natgw_draft_lan_map() {
    local index=0
    local draft=""
    local default=""
    for index in "${!NATGW_DRAFT_LAN_NAMES[@]}"; do
        draft="${draft:+$draft,}${NATGW_DRAFT_LAN_NAMES[$index]}:${NATGW_DRAFT_LAN_IFACES[$index]}"
    done
    default="$(LAN_MAP="" natgw_lan_map_entries | paste -sd ',')"
    [ "$draft" = "$default" ] || echo "$draft"
}

# PAIRS of the draft, in LAN order (LAN1 first = top priority); empty = all auto.
natgw_draft_pairs() {
    local index=0
    local all_auto="true"
    local -a pairs=()
    for index in "${!NATGW_DRAFT_LAN_NAMES[@]}"; do
        if [ "${NATGW_DRAFT_UPLINKS[$index]}" = "off" ]; then
            all_auto="false"
            continue
        fi
        [ "${NATGW_DRAFT_UPLINKS[$index]}" = "auto" ] || all_auto="false"
        pairs+=("${NATGW_DRAFT_UPLINKS[$index]}:${NATGW_DRAFT_LAN_NAMES[$index]}")
    done
    if [ ${#NATGW_DRAFT_EXTRA_PAIRS[@]} -gt 0 ]; then
        pairs+=("${NATGW_DRAFT_EXTRA_PAIRS[@]}")
        all_auto="false"
    fi
    [ "$all_auto" = "true" ] || (IFS=','; echo "${pairs[*]}")
}

natgw_draft_signature() {
    echo "$NATGW_DRAFT_MODE|$NATGW_DRAFT_WAN|$NATGW_DRAFT_LAN_MODE|$NATGW_DRAFT_LAN_PORTS|$NATGW_DRAFT_SYSTEM_WAN|$NATGW_DRAFT_ADDRESS|$NATGW_DRAFT_DHCP|$(natgw_draft_lan_map)|$(natgw_draft_pairs)"
}

natgw_draft_dirty() {
    [ "$(natgw_draft_signature)" != "$NATGW_DRAFT_SAVED" ]
}

natgw_draft_save() {
    local pairs=""
    local index=0
    local active=0
    if [ "$(printf '%s\n' "${NATGW_DRAFT_LAN_IFACES[@]}" | sort | uniq -d)" != "" ]; then
        NATGW_DRAFT_MESSAGE="Not saved: two LAN names use the same port"
        return 1
    fi
    for index in "${!NATGW_DRAFT_UPLINKS[@]}"; do
        [ "${NATGW_DRAFT_UPLINKS[$index]}" = "off" ] || active=$((active + 1))
    done
    if [ "$NATGW_DRAFT_MODE" = "pairs" ] && [ "$active" -eq 0 ] && [ ${#NATGW_DRAFT_EXTRA_PAIRS[@]} -eq 0 ]; then
        NATGW_DRAFT_MESSAGE="Not saved: at least one LAN needs an uplink"
        return 1
    fi
    pairs="$(natgw_draft_pairs)"
    natgw_load_config
    ROUTE_MODE="$NATGW_DRAFT_MODE"
    WAN_SELECT="$NATGW_DRAFT_WAN"
    LAN_MODE="$NATGW_DRAFT_LAN_MODE"
    LAN_PORTS="$NATGW_DRAFT_LAN_PORTS"
    PAIRS="$pairs"
    LAN_MAP="$(natgw_draft_lan_map)"
    SYSTEM_WAN="$NATGW_DRAFT_SYSTEM_WAN"
    LAN_ADDRESS="$NATGW_DRAFT_ADDRESS"
    DHCP_ENABLED="$NATGW_DRAFT_DHCP"
    natgw_save_config
    NATGW_DRAFT_SAVED="$(natgw_draft_signature)"
    NATGW_DRAFT_MESSAGE="Saved to $NATGW_CONFIG_FILE$(systemctl is-active --quiet "$NATGW_SERVICE_NAME" && echo "; the running service applies it within $NATGW_POLL_SECONDS s")"
}

# Saves, then installs, upgrades (restarts old code) or keeps the service.
natgw_draft_apply() {
    local assume_yes="$ASSUME_YES"
    natgw_draft_save || return 1
    ASSUME_YES="true"
    cmd_install
    ASSUME_YES="$assume_yes"
    natgw_load_config
    natgw_resolve_links
    [ "$ROUTE_MODE" = "pairs" ] && natgw_print_pairs
    natgw_menu_pause
    NATGW_DRAFT_MESSAGE="Saved and applied"
}

# ------------------------------------------------------------------ form ----

# Values a row cycles through (NATGW_FORM_OPTIONS); the current value is kept
# in the list even when it is a typed one.
natgw_form_options() {
    local row="$1"
    local current="$2"
    local iface=""
    NATGW_FORM_OPTIONS=()
    case "$row" in
        mode) NATGW_FORM_OPTIONS=(pairs single) ;;
        dhcp) NATGW_FORM_OPTIONS=(yes no) ;;
        lanport) mapfile -t NATGW_FORM_OPTIONS < <(natgw_menu_wired_ifaces) ;;
        uplink|syswan)
            if [ "$row" = "uplink" ]; then
                NATGW_FORM_OPTIONS=(auto off)
            else
                NATGW_FORM_OPTIONS=(auto none)
            fi
            while IFS= read -r iface; do
                NATGW_FORM_OPTIONS+=("$NATGW_USB_PORT_PREFIX$(natgw_usb_port_of "$iface")")
            done < <(natgw_menu_usb_ifaces)
            ;;
        wan)
            NATGW_FORM_OPTIONS=(usb)
            while IFS= read -r iface; do
                if natgw_is_usb "$iface"; then
                    NATGW_FORM_OPTIONS+=("$NATGW_USB_PORT_PREFIX$(natgw_usb_port_of "$iface")")
                else
                    NATGW_FORM_OPTIONS+=("$iface")
                fi
            done < <(natgw_physical_ifaces)
            ;;
        lan)
            NATGW_FORM_OPTIONS=(all)
            while IFS= read -r iface; do
                NATGW_FORM_OPTIONS+=("one:$iface")
            done < <(natgw_menu_wired_ifaces)
            ;;
    esac
    [ -z "$current" ] || natgw_list_contains "$current" "${NATGW_FORM_OPTIONS[@]}" || NATGW_FORM_OPTIONS+=("$current")
}

natgw_form_step() {
    local row="$1"
    local current="$2"
    local direction="$3"
    local index=0
    local position=0
    natgw_form_options "$row" "$current"
    [ ${#NATGW_FORM_OPTIONS[@]} -gt 0 ] || { echo "$current"; return; }
    for index in "${!NATGW_FORM_OPTIONS[@]}"; do
        [ "${NATGW_FORM_OPTIONS[$index]}" = "$current" ] && position="$index"
    done
    position=$(((position + direction + ${#NATGW_FORM_OPTIONS[@]}) % ${#NATGW_FORM_OPTIONS[@]}))
    echo "${NATGW_FORM_OPTIONS[$position]}"
}

natgw_form_lan_value() {
    case "$NATGW_DRAFT_LAN_MODE" in
        all) echo "all" ;;
        one) echo "one:$NATGW_DRAFT_LAN_PORTS" ;;
        *) echo "list:$NATGW_DRAFT_LAN_PORTS" ;;
    esac
}

natgw_form_set_lan_value() {
    case "$1" in
        all) NATGW_DRAFT_LAN_MODE="all"; NATGW_DRAFT_LAN_PORTS="" ;;
        one:*) NATGW_DRAFT_LAN_MODE="one"; NATGW_DRAFT_LAN_PORTS="${1#one:}" ;;
        list:*) NATGW_DRAFT_LAN_MODE="list"; NATGW_DRAFT_LAN_PORTS="${1#list:}" ;;
    esac
}

# Left/Right on a row: step its value; Enter: typed value or the same step.
natgw_form_change() {
    local row="$1"
    local arg="$2"
    local key="$3"
    local direction=1
    [ "$key" = "left" ] && direction=-1
    case "$row" in
        mode) NATGW_DRAFT_MODE="$(natgw_form_step mode "$NATGW_DRAFT_MODE" "$direction")" ;;
        dhcp) NATGW_DRAFT_DHCP="$(natgw_form_step dhcp "$NATGW_DRAFT_DHCP" "$direction")" ;;
        lanport) NATGW_DRAFT_LAN_IFACES[arg]="$(natgw_form_step lanport "${NATGW_DRAFT_LAN_IFACES[$arg]}" "$direction")" ;;
        uplink)
            if [ "$key" = "enter" ]; then
                natgw_menu_type_uplink && NATGW_DRAFT_UPLINKS[arg]="$NATGW_MENU_PICK"
            else
                NATGW_DRAFT_UPLINKS[arg]="$(natgw_form_step uplink "${NATGW_DRAFT_UPLINKS[$arg]}" "$direction")"
            fi
            ;;
        syswan)
            if [ "$key" = "enter" ]; then
                natgw_menu_type_uplink && [[ "$NATGW_MENU_PICK" != *+* ]] && NATGW_DRAFT_SYSTEM_WAN="$NATGW_MENU_PICK"
            else
                NATGW_DRAFT_SYSTEM_WAN="$(natgw_form_step syswan "$NATGW_DRAFT_SYSTEM_WAN" "$direction")"
            fi
            ;;
        wan)
            if [ "$key" = "enter" ]; then
                natgw_menu_type_uplink && [[ "$NATGW_MENU_PICK" != *+* ]] && NATGW_DRAFT_WAN="$NATGW_MENU_PICK"
            else
                NATGW_DRAFT_WAN="$(natgw_form_step wan "$NATGW_DRAFT_WAN" "$direction")"
            fi
            ;;
        lan)
            if [ "$key" = "enter" ]; then
                natgw_menu_type_ports && natgw_form_set_lan_value "list:$NATGW_MENU_PICK"
            else
                natgw_form_set_lan_value "$(natgw_form_step lan "$(natgw_form_lan_value)" "$direction")"
            fi
            ;;
        address)
            prompt_read_default NATGW_MENU_INPUT "$NATGW_DRAFT_ADDRESS" 120 "Gateway address [$NATGW_DRAFT_ADDRESS]: "
            if natgw_address_valid "$NATGW_MENU_INPUT"; then
                NATGW_DRAFT_ADDRESS="$NATGW_MENU_INPUT"
            else
                NATGW_DRAFT_MESSAGE="Invalid address (a.b.c.d/24, host part 1-254): $NATGW_MENU_INPUT"
            fi
            ;;
    esac
}

natgw_form_header() {
    natgw_menu_header
    if natgw_draft_dirty; then
        echo "* Unsaved changes: Save, Save & Apply, or Discard"
    fi
    [ -z "$NATGW_DRAFT_MESSAGE" ] || echo "$NATGW_DRAFT_MESSAGE"
}

# Asks what to do with unsaved changes; fails when the user stays in the form.
natgw_form_leave() {
    local -a leave_items=("Save" "Save & Apply" "Discard changes" "Stay in Configure")
    natgw_draft_dirty || return 0
    arrow_menu_select "Unsaved changes" leave_items 0 3
    case "$ARROW_MENU_SELECTED_INDEX" in
        0) natgw_draft_save ;;
        1) natgw_draft_apply ;;
        2) return 0 ;;
        *) return 1 ;;
    esac
}

natgw_menu_configure() {
    local selected=0
    local index=0
    local row=""
    local arg=""
    local -a form_items=()
    local -a form_rows=()
    natgw_draft_load
    while true; do
        form_items=()
        form_rows=()
        form_items+=("Mode                 < $NATGW_DRAFT_MODE >"); form_rows+=("mode")
        if [ "$NATGW_DRAFT_MODE" = "pairs" ]; then
            for index in "${!NATGW_DRAFT_LAN_NAMES[@]}"; do
                form_items+=("${NATGW_DRAFT_LAN_NAMES[$index]} port            < ${NATGW_DRAFT_LAN_IFACES[$index]} >"); form_rows+=("lanport $index")
                form_items+=("${NATGW_DRAFT_LAN_NAMES[$index]} uplink          < ${NATGW_DRAFT_UPLINKS[$index]} >  (Enter: type / pool)"); form_rows+=("uplink $index")
            done
            form_items+=("Host internet uplink < $NATGW_DRAFT_SYSTEM_WAN >"); form_rows+=("syswan")
        else
            form_items+=("Uplink (WAN)         < $NATGW_DRAFT_WAN >  (Enter: type)"); form_rows+=("wan")
            form_items+=("Relay ports          < $(natgw_form_lan_value) >  (Enter: pick several)"); form_rows+=("lan")
        fi
        form_items+=("Gateway address        $NATGW_DRAFT_ADDRESS$([ "$NATGW_DRAFT_MODE" = "pairs" ] && echo " (next /24 per LAN)")  (Enter: edit)"); form_rows+=("address")
        form_items+=("DHCP server          < $NATGW_DRAFT_DHCP >"); form_rows+=("dhcp")
        form_items+=("[ Save ]"); form_rows+=("save")
        form_items+=("[ Save & Apply ]  (install / upgrade / restart the service as needed)"); form_rows+=("apply")
        form_items+=("[ Discard changes ]"); form_rows+=("discard")
        form_items+=("[ Disconnect logs (view / clear) ]  $(natgw_diag_incidents | wc -l) saved"); form_rows+=("diag")
        form_items+=("Back"); form_rows+=("back")

        [ "$selected" -lt "${#form_items[@]}" ] || selected=0
        arrow_menu_select "Configure Network Router" form_items "$selected" "$((${#form_items[@]} - 1))" natgw_form_header true
        selected="$ARROW_MENU_SELECTED_INDEX"
        if [ "$ARROW_MENU_CANCELLED" = "true" ]; then
            natgw_form_leave && return 0
            continue
        fi
        NATGW_DRAFT_MESSAGE=""
        read -r row arg <<< "${form_rows[$selected]}"
        case "$row" in
            save) [ "$ARROW_MENU_KEY" = "enter" ] && natgw_draft_save ;;
            apply) [ "$ARROW_MENU_KEY" = "enter" ] && natgw_draft_apply ;;
            discard) [ "$ARROW_MENU_KEY" = "enter" ] && natgw_draft_load && NATGW_DRAFT_MESSAGE="Changes discarded" ;;
            diag) [ "$ARROW_MENU_KEY" = "enter" ] && natgw_menu_diag ;;
            back) [ "$ARROW_MENU_KEY" = "enter" ] && natgw_form_leave && return 0 ;;
            *) natgw_form_change "$row" "$arg" "$ARROW_MENU_KEY" ;;
        esac
    done
}

# Saved disconnect incidents: Enter shows one; the last rows clear all or go back.
natgw_menu_diag() {
    local selected=0
    local dir=""
    local -a dirs=()
    local -a diag_items=()
    local -a confirm_items=("Delete every saved incident" "Cancel")
    while true; do
        mapfile -t dirs < <(natgw_diag_incidents)
        diag_items=()
        for dir in "${dirs[@]}"; do
            diag_items+=("$(basename "$dir")  outage: $(sed -n 's/^outage: //p' "$dir/summary.txt" 2>/dev/null)")
        done
        diag_items+=("[ Clear disconnect logs ]" "Back")
        [ "$selected" -lt "${#diag_items[@]}" ] || selected=0
        arrow_menu_select "Disconnect logs" diag_items "$selected" "$((${#diag_items[@]} - 1))" natgw_diag_print_list
        [ "$ARROW_MENU_CANCELLED" = "true" ] && return 0
        selected="$ARROW_MENU_SELECTED_INDEX"
        if [ "$selected" -lt "${#dirs[@]}" ]; then
            natgw_diag_show "${dirs[$selected]}"
        elif [ "$selected" -eq "${#dirs[@]}" ]; then
            arrow_menu_select "Clear disconnect logs" confirm_items 1 1
            [ "$ARROW_MENU_SELECTED_INDEX" -eq 0 ] && natgw_diag_clear
        else
            return 0
        fi
    done
}

show_interactive_menu() {
    local selected_index=0
    local -a menu_items=(
        "Configure (mode, LAN ports and uplinks, address, DHCP)..."
        "Install / Upgrade / Repair background service"
        "Status (config, ports, pairs, DHCP leases)"
        "Disconnect logs (view / clear)..."
        "OpenWrt as Wi-Fi AP (one-line setup, admin address)"
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
            0) natgw_menu_configure; continue ;;
            1) cmd_install ;;
            2) natgw_print_status ;;
            3) natgw_menu_diag; continue ;;
            4) cmd_openwrt ;;
            5) cmd_service restart ;;
            6) cmd_service stop ;;
            7) cmd_logs ;;
            8) cmd_uninstall ;;
            *) return 0 ;;
        esac
        natgw_menu_pause
    done
}
