#!/bin/bash

# ---------------------------------------------------------------------------
# Timer / oneshot primitives (content-hash idempotent).
# Used by the certificate self-heal layer (cert_selfheal_common.sh) and any
# scheduled maintenance unit. The unit file is rewritten only when its content
# changed; daemon-reload runs only on change; the resulting state is verified
# by direct file detection and published in DSM_UNIT_CHANGED ("yes"/"no") -
# never inferred from a command exit code.
# ---------------------------------------------------------------------------
DSM_UNIT_CHANGED="no"

# dsm_write_unit <unit_file> <content> - write only when changed.
dsm_write_unit() {
    local unit_file="$1"
    local content="$2"

    DSM_UNIT_CHANGED="no"
    if [ -f "$unit_file" ] && printf '%s' "$content" | cmp -s - "$unit_file" 2>/dev/null; then
        echo "[INFO] Unit unchanged: $unit_file"
    else
        printf '%s' "$content" > "$unit_file"
        DSM_UNIT_CHANGED="yes"
        systemctl daemon-reload 2>/dev/null || true
        echo "[INFO] Unit written: $unit_file"
    fi
}

# Create (or content-update) a Type=oneshot service unit. No Restart policy,
# no [Install] wanted target - it is activated by its timer or manually.
# Usage: create_systemd_oneshot_service <name> <description> <exec_command> [working_dir]
create_systemd_oneshot_service() {
    local service_name="$1"
    local description="$2"
    local exec_command="$3"
    local working_dir="${4:-/}"
    local service_file="$SYSTEMD_DIR/${service_name}.service"

    dsm_write_unit "$service_file" "[Unit]
Description=$description
After=network.target

[Service]
Type=oneshot
User=root
WorkingDirectory=$working_dir
ExecStart=$exec_command
Environment=\"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\"
"
    if [ -f "$service_file" ]; then
        echo "[INFO] oneshot service ready: $service_name (changed: $DSM_UNIT_CHANGED)"
    else
        echo "[ERROR] oneshot service could not be written: $service_file"
    fi
}

# Create (or content-update) a systemd timer pairing with the same-name
# oneshot service, then enable + start the timer (no-op when already active).
# Usage: create_systemd_timer <name> <description> <oncalendar...> [randomized_delay]
#   oncalendar: one or more OnCalendar expressions as separate arguments.
create_systemd_timer() {
    local timer_name="$1"
    local description="$2"
    shift
    shift
    local randomized_delay="0"
    local calendar_lines=""
    local entry=""
    local timer_file="$SYSTEMD_DIR/${timer_name}.timer"

    for entry in "$@"; do
        case "$entry" in
            RandomizedDelaySec=*) randomized_delay="${entry#RandomizedDelaySec=}" ;;
            *) calendar_lines="${calendar_lines}OnCalendar=$entry
" ;;
        esac
    done

    dsm_write_unit "$timer_file" "[Unit]
Description=$description

[Timer]
${calendar_lines}RandomizedDelaySec=$randomized_delay
Persistent=true

[Install]
WantedBy=timers.target
"
    if [ ! -f "$timer_file" ]; then
        echo "[ERROR] timer could not be written: $timer_file"
    else
        systemctl enable --now "${timer_name}.timer" 2>/dev/null || true
        if systemctl is-enabled --quiet "${timer_name}.timer" 2>/dev/null; then
            echo "[INFO] timer enabled: ${timer_name}.timer (changed: $DSM_UNIT_CHANGED)"
        else
            echo "[ERROR] timer not enabled: ${timer_name}.timer"
        fi
    fi
}

