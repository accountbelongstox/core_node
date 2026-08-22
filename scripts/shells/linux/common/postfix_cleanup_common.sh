#!/bin/bash

POSTFIX_LOG_PREFIX="${POSTFIX_LOG_PREFIX:-[POSTFIX]}"
POSTFIX_INIT_SCRIPT="/etc/init.d/postfix"
POSTFIX_SYSTEMD_AVAILABLE="false"
POSTFIX_ALL_STOPPED="true"
POSTFIX_UNIT_LOAD_STATE="not-found"
POSTFIX_UNIT_ACTIVE_STATE="inactive"
POSTFIX_UNIT_FILE_STATE="disabled"
POSTFIX_QUEUE_DIRECTORY=""
POSTFIX_QUEUE_FILE_COUNT="0"
POSTFIX_MASTER_PROCESS_STATE="inactive"
POSTFIX_PRIMARY_CONFIG_DIRECTORY=""
POSTFIX_MULTI_CONFIG_DIRECTORIES=""
POSTFIX_SYSTEMD_UNIT_OUTPUT=""
POSTFIX_SYSTEMD_ACTIVE_OUTPUT=""
POSTFIX_SYSV_START_LINK_COUNT="0"
declare -a POSTFIX_SYSTEMD_UNITS=()
declare -a POSTFIX_CONFIG_DIRECTORIES=()
declare -a POSTFIX_QUEUE_NAMES=("maildrop" "incoming" "active" "deferred" "hold")

postfix_cleanup_log() {
    local level="$1"
    local message="$2"
    echo "${POSTFIX_LOG_PREFIX} [${level}] ${message}"
}

postfix_add_systemd_unit() {
    local candidate="$1"
    local existing=""
    local found="false"

    for existing in "${POSTFIX_SYSTEMD_UNITS[@]}"; do
        if [ "$existing" = "$candidate" ]; then
            found="true"
        fi
    done
    if [ "$found" = "false" ]; then
        POSTFIX_SYSTEMD_UNITS+=("$candidate")
    fi
}

postfix_add_config_directory() {
    local candidate="$1"
    local existing=""
    local found="false"

    if [ -n "$candidate" ] && [ -f "$candidate/main.cf" ]; then
        for existing in "${POSTFIX_CONFIG_DIRECTORIES[@]}"; do
            if [ "$existing" = "$candidate" ]; then
                found="true"
            fi
        done
        if [ "$found" = "false" ]; then
            POSTFIX_CONFIG_DIRECTORIES+=("$candidate")
        fi
    fi
}

postfix_discover_systemd_units() {
    local unit=""
    local state=""

    POSTFIX_SYSTEMD_AVAILABLE="false"
    POSTFIX_SYSTEMD_UNITS=()
    POSTFIX_SYSTEMD_UNIT_OUTPUT=""
    POSTFIX_SYSTEMD_ACTIVE_OUTPUT=""

    if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
        POSTFIX_SYSTEMD_AVAILABLE="true"
        POSTFIX_SYSTEMD_UNIT_OUTPUT="$(systemctl list-unit-files --no-legend --no-pager 2>/dev/null || true)"
        POSTFIX_SYSTEMD_ACTIVE_OUTPUT="$(systemctl list-units --all --no-legend --no-pager 2>/dev/null || true)"

        while read -r unit state; do
            case "$unit" in
                postfix.service|postfix@*.service|postfix-resolvconf.service|postfix-resolvconf.path)
                    if [ "$unit" = "postfix@.service" ]; then
                        postfix_add_systemd_unit "postfix@-.service"
                    else
                        postfix_add_systemd_unit "$unit"
                    fi
                    ;;
            esac
        done <<< "$POSTFIX_SYSTEMD_UNIT_OUTPUT"

        while read -r unit state; do
            case "$unit" in
                postfix.service|postfix@*.service|postfix-resolvconf.service|postfix-resolvconf.path)
                    postfix_add_systemd_unit "$unit"
                    ;;
            esac
        done <<< "$POSTFIX_SYSTEMD_ACTIVE_OUTPUT"
    fi
}

postfix_refresh_systemd_unit_state() {
    local unit="$1"

    POSTFIX_UNIT_LOAD_STATE="not-found"
    POSTFIX_UNIT_ACTIVE_STATE="inactive"
    POSTFIX_UNIT_FILE_STATE="disabled"

    if [ "$POSTFIX_SYSTEMD_AVAILABLE" = "true" ]; then
        POSTFIX_UNIT_LOAD_STATE="$(systemctl show "$unit" --property=LoadState --value 2>/dev/null || true)"
        POSTFIX_UNIT_ACTIVE_STATE="$(systemctl show "$unit" --property=ActiveState --value 2>/dev/null || true)"
        POSTFIX_UNIT_FILE_STATE="$(systemctl show "$unit" --property=UnitFileState --value 2>/dev/null || true)"
        [ -n "$POSTFIX_UNIT_LOAD_STATE" ] || POSTFIX_UNIT_LOAD_STATE="not-found"
        [ -n "$POSTFIX_UNIT_ACTIVE_STATE" ] || POSTFIX_UNIT_ACTIVE_STATE="inactive"
        [ -n "$POSTFIX_UNIT_FILE_STATE" ] || POSTFIX_UNIT_FILE_STATE="disabled"
    fi
}

postfix_stop_systemd_unit() {
    local unit="$1"

    postfix_refresh_systemd_unit_state "$unit"
    if [ "$POSTFIX_UNIT_LOAD_STATE" = "not-found" ]; then
        postfix_cleanup_log "SKIP" "$unit is not installed"
    elif [ "$POSTFIX_UNIT_ACTIVE_STATE" = "inactive" ]; then
        postfix_cleanup_log "OK" "$unit is already stopped"
    else
        postfix_cleanup_log "ACTION" "Stopping $unit"
        $USE_SUDO systemctl stop "$unit" >/dev/null 2>&1 || true
        postfix_refresh_systemd_unit_state "$unit"
        if [ "$POSTFIX_UNIT_ACTIVE_STATE" = "inactive" ]; then
            postfix_cleanup_log "OK" "$unit is stopped"
        else
            postfix_cleanup_log "WARN" "$unit remains $POSTFIX_UNIT_ACTIVE_STATE"
        fi
    fi
}

postfix_disable_systemd_unit() {
    local unit="$1"

    postfix_refresh_systemd_unit_state "$unit"
    if [ "$POSTFIX_UNIT_LOAD_STATE" = "not-found" ]; then
        postfix_cleanup_log "SKIP" "$unit is not installed"
    else
        case "$POSTFIX_UNIT_FILE_STATE" in
            disabled|masked|masked-runtime|static|generated|transient)
                postfix_cleanup_log "OK" "$unit boot state is already $POSTFIX_UNIT_FILE_STATE"
                ;;
            *)
                postfix_cleanup_log "ACTION" "Disabling $unit"
                $USE_SUDO systemctl disable "$unit" >/dev/null 2>&1 || true
                postfix_refresh_systemd_unit_state "$unit"
                case "$POSTFIX_UNIT_FILE_STATE" in
                    disabled|masked|masked-runtime|static|generated|transient)
                        postfix_cleanup_log "OK" "$unit boot state is $POSTFIX_UNIT_FILE_STATE"
                        ;;
                    *)
                        postfix_cleanup_log "WARN" "$unit boot state remains $POSTFIX_UNIT_FILE_STATE"
                        ;;
                esac
                ;;
        esac
    fi
}

postfix_refresh_sysv_start_links() {
    POSTFIX_SYSV_START_LINK_COUNT="$(find /etc/rc?.d -maxdepth 1 -type l -name 'S??postfix' 2>/dev/null | awk 'END { print NR + 0 }')"
}

postfix_stop_and_disable_sysv() {
    if [ -f "$POSTFIX_INIT_SCRIPT" ]; then
        postfix_cleanup_log "ACTION" "Stopping Postfix through the Debian init script"
        $USE_SUDO "$POSTFIX_INIT_SCRIPT" stop >/dev/null 2>&1 || true
    else
        postfix_cleanup_log "SKIP" "Postfix init script is not installed"
    fi

    postfix_refresh_sysv_start_links
    if [ "$POSTFIX_SYSV_START_LINK_COUNT" -gt 0 ] && command -v update-rc.d >/dev/null 2>&1; then
        postfix_cleanup_log "ACTION" "Disabling Postfix SysV startup links"
        $USE_SUDO update-rc.d postfix disable >/dev/null 2>&1 || true
        postfix_refresh_sysv_start_links
    fi
    if [ "$POSTFIX_SYSV_START_LINK_COUNT" -eq 0 ]; then
        postfix_cleanup_log "OK" "Postfix SysV startup links are disabled"
    else
        postfix_cleanup_log "WARN" "$POSTFIX_SYSV_START_LINK_COUNT Postfix SysV startup link(s) remain"
    fi
}

postfix_discover_config_directories() {
    local config_directory=""

    POSTFIX_CONFIG_DIRECTORIES=()
    POSTFIX_PRIMARY_CONFIG_DIRECTORY=""
    POSTFIX_MULTI_CONFIG_DIRECTORIES=""

    if command -v postconf >/dev/null 2>&1; then
        POSTFIX_PRIMARY_CONFIG_DIRECTORY="$($USE_SUDO postconf -h config_directory 2>/dev/null || true)"
        POSTFIX_MULTI_CONFIG_DIRECTORIES="$($USE_SUDO postconf -h multi_instance_directories 2>/dev/null || true)"
        postfix_add_config_directory "$POSTFIX_PRIMARY_CONFIG_DIRECTORY"
        for config_directory in $POSTFIX_MULTI_CONFIG_DIRECTORIES; do
            postfix_add_config_directory "$config_directory"
        done
    fi
}

postfix_refresh_master_process_state() {
    local config_directory="$1"
    local queue_directory=""
    local master_pid_file=""
    local master_pid=""
    local process_command=""

    POSTFIX_MASTER_PROCESS_STATE="inactive"
    queue_directory="$($USE_SUDO postconf -c "$config_directory" -h queue_directory 2>/dev/null || true)"
    master_pid_file="$queue_directory/pid/master.pid"

    if [ -f "$master_pid_file" ]; then
        master_pid="$($USE_SUDO sed -n '1p' "$master_pid_file" 2>/dev/null | tr -dc '0-9')"
        if [ -n "$master_pid" ] && [ -d "/proc/$master_pid" ]; then
            process_command="$($USE_SUDO tr '\0' ' ' < "/proc/$master_pid/cmdline" 2>/dev/null || true)"
            case "$process_command" in
                *postfix*master*|*/master*)
                    POSTFIX_MASTER_PROCESS_STATE="active"
                    ;;
                "")
                    POSTFIX_MASTER_PROCESS_STATE="unknown"
                    ;;
            esac
        fi
    fi
}

postfix_refresh_stopped_state() {
    local unit=""
    local config_directory=""

    POSTFIX_ALL_STOPPED="true"
    postfix_discover_systemd_units

    if [ "$POSTFIX_SYSTEMD_AVAILABLE" = "true" ]; then
        for unit in "${POSTFIX_SYSTEMD_UNITS[@]}"; do
            postfix_refresh_systemd_unit_state "$unit"
            case "$POSTFIX_UNIT_ACTIVE_STATE" in
                inactive|failed)
                    ;;
                *)
                    POSTFIX_ALL_STOPPED="false"
                    postfix_cleanup_log "WARN" "$unit active state is $POSTFIX_UNIT_ACTIVE_STATE"
                    ;;
            esac
        done
    fi

    postfix_discover_config_directories
    for config_directory in "${POSTFIX_CONFIG_DIRECTORIES[@]}"; do
        postfix_refresh_master_process_state "$config_directory"
        if [ "$POSTFIX_MASTER_PROCESS_STATE" != "inactive" ]; then
            POSTFIX_ALL_STOPPED="false"
            postfix_cleanup_log "WARN" "Postfix master state for $config_directory is $POSTFIX_MASTER_PROCESS_STATE"
        fi
    done
}

postfix_stop_and_disable() {
    local unit=""

    postfix_cleanup_log "STEP" "Discovering Postfix service units"
    postfix_discover_systemd_units

    if [ "$POSTFIX_SYSTEMD_AVAILABLE" = "true" ]; then
        for unit in "${POSTFIX_SYSTEMD_UNITS[@]}"; do
            postfix_stop_systemd_unit "$unit"
        done
        for unit in "${POSTFIX_SYSTEMD_UNITS[@]}"; do
            postfix_disable_systemd_unit "$unit"
        done
        for unit in "${POSTFIX_SYSTEMD_UNITS[@]}"; do
            postfix_stop_systemd_unit "$unit"
        done
    else
        postfix_stop_and_disable_sysv
    fi

    postfix_refresh_stopped_state
    if [ "$POSTFIX_ALL_STOPPED" = "true" ]; then
        postfix_cleanup_log "OK" "All discovered Postfix services and master processes are stopped"
    else
        postfix_cleanup_log "WARN" "Postfix is not fully stopped; queue cleanup will remain blocked"
    fi
}

postfix_count_queue_files() {
    local queue_directory="$1"
    local queue_name="$2"
    local queue_path="$queue_directory/$queue_name"

    POSTFIX_QUEUE_FILE_COUNT="0"
    if [ -d "$queue_path" ]; then
        POSTFIX_QUEUE_FILE_COUNT="$($USE_SUDO find "$queue_path" -type f 2>/dev/null | awk 'END { print NR + 0 }')"
    fi
}

postfix_cleanup_queue() {
    local config_directory="$1"
    local queue_name="$2"
    local before_count="0"
    local after_count="0"

    POSTFIX_QUEUE_DIRECTORY="$($USE_SUDO postconf -c "$config_directory" -h queue_directory 2>/dev/null || true)"
    if [ -z "$POSTFIX_QUEUE_DIRECTORY" ] || [ ! -d "$POSTFIX_QUEUE_DIRECTORY/$queue_name" ]; then
        postfix_cleanup_log "SKIP" "$queue_name queue is absent for $config_directory"
    else
        postfix_count_queue_files "$POSTFIX_QUEUE_DIRECTORY" "$queue_name"
        before_count="$POSTFIX_QUEUE_FILE_COUNT"
        if [ "$before_count" -eq 0 ]; then
            postfix_cleanup_log "OK" "$queue_name queue is already empty for $config_directory"
        else
            postfix_cleanup_log "ACTION" "Deleting $before_count file(s) from $queue_name for $config_directory"
            $USE_SUDO postsuper -c "$config_directory" -d ALL "$queue_name" >/dev/null 2>&1 || true
            postfix_count_queue_files "$POSTFIX_QUEUE_DIRECTORY" "$queue_name"
            after_count="$POSTFIX_QUEUE_FILE_COUNT"
            if [ "$after_count" -eq 0 ]; then
                postfix_cleanup_log "OK" "$queue_name queue is empty for $config_directory"
            else
                postfix_cleanup_log "WARN" "$queue_name queue still contains $after_count file(s) for $config_directory"
            fi
        fi
    fi
}

postfix_cleanup_all_queues() {
    local config_directory=""
    local queue_name=""

    postfix_refresh_stopped_state
    if [ "$POSTFIX_ALL_STOPPED" != "true" ]; then
        postfix_cleanup_log "SKIP" "Queue cleanup is blocked because Postfix is not fully stopped"
    elif ! command -v postsuper >/dev/null 2>&1 || ! command -v postconf >/dev/null 2>&1; then
        postfix_cleanup_log "SKIP" "Postfix queue administration commands are not installed"
    else
        for config_directory in "${POSTFIX_CONFIG_DIRECTORIES[@]}"; do
            for queue_name in "${POSTFIX_QUEUE_NAMES[@]}"; do
                postfix_cleanup_queue "$config_directory" "$queue_name"
            done
            postfix_cleanup_log "ACTION" "Purging stale temporary queue files for $config_directory"
            $USE_SUDO postsuper -c "$config_directory" -p >/dev/null 2>&1 || true
        done
        if [ "${#POSTFIX_CONFIG_DIRECTORIES[@]}" -eq 0 ]; then
            postfix_cleanup_log "SKIP" "No Postfix configuration directory was discovered"
        fi
    fi
}

postfix_stop_disable_and_cleanup() {
    postfix_cleanup_log "STEP" "Stopping and disabling Postfix"
    postfix_stop_and_disable
    postfix_cleanup_log "STEP" "Cleaning Postfix queues"
    postfix_cleanup_all_queues
}
