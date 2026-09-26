#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Redis-compatible endpoint convergence for laravel_main. The endpoint is the
# service contract pair hosts.loopback + ports.redis (the same values
# config/database.php reads through ServiceContract). Any process answering
# RESP PING there (redis-server, Dragonfly, a container) is reused as is.
#
#   redis_endpoint_ensure               175 init: reuse -> start -> install
#                                       (73_install_redis.sh only when the
#                                       redis-server binary is missing), then
#                                       the Laravel index config contract
#   redis_endpoint_service_state_ensure service launchers: start an already
#                                       selected local store, never install
#
# Callers source gvar_common.sh and service_contract_common.sh first.
# Results are published through variables (string contracts yes/no), never
# through exit codes.

REDIS_ENDPOINT_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REDIS_ENDPOINT_INSTALL_SCRIPT="$(dirname "$REDIS_ENDPOINT_COMMON_DIR")/debian/install_shells/73_install_redis.sh"
REDIS_ENDPOINT_REDIS_UNIT="redis-server"
REDIS_ENDPOINT_DRAGONFLY_UNIT="dragonfly"
REDIS_ENDPOINT_SELECTED_KEY="LARAVEL_REDIS_ENDPOINT"
REDIS_ENDPOINT_WAIT_SECONDS=10
REDIS_ENDPOINT_HOST=""
REDIS_ENDPOINT_PORT=""
REDIS_ENDPOINT_READY="no"
REDIS_ENDPOINT_KIND=""
REDIS_ENDPOINT_SIGNATURE=""
# Laravel resource-index contract (W7): keys never evicted, bucketed hashes
# kept in listpack encoding, AOF persistence (index is rebuildable anyway).
REDIS_ENDPOINT_CONFIG_DIRECTIVES=(
    "maxmemory-policy noeviction"
    "hash-max-listpack-entries 1024"
    "hash-max-listpack-value 128"
    "appendonly yes"
)
# maxmemory hard cap for Redis and Dragonfly: share of MemTotal. The index
# stores keys and short values only. With noeviction, writes fail at the cap
# (Laravel falls back to DB/disk) instead of exhausting host RAM. The marker
# comment identifies the cap this script owns; a lower explicit cap is kept,
# a higher one is lowered to the hard cap.
REDIS_ENDPOINT_MAXMEMORY_PERCENT=10
REDIS_ENDPOINT_MAXMEMORY_MARKER="# core_node managed: maxmemory"
# Dragonfly reads flags from the flagfile of its systemd unit (not redis.conf)
# and requires maxmemory >= 256 MiB per proactor thread, so the thread count
# is derived from the cap.
REDIS_ENDPOINT_DRAGONFLY_FLAGFILE_DEFAULT="/etc/dragonfly/dragonfly.conf"
REDIS_ENDPOINT_DRAGONFLY_THREAD_MIN_MB=256
REDIS_ENDPOINT_DRAGONFLY_CHANGED="no"

redis_endpoint_resolve() {
    REDIS_ENDPOINT_HOST="$(sc_get hosts.loopback)"
    REDIS_ENDPOINT_PORT="$(sc_get ports.redis)"
}

# RESP PING probe (string contract: yes/no). redis-cli when present, else a
# bash /dev/tcp inline request so Dragonfly-only hosts need no extra client.
redis_endpoint_ping() {
    local host="$1"
    local port="$2"
    local reply=""

    if [ -z "$host" ] || [ -z "$port" ]; then
        echo "no"
        return
    fi
    if command -v redis-cli >/dev/null 2>&1; then
        reply="$(timeout 3 redis-cli -h "$host" -p "$port" PING 2>/dev/null)"
    else
        reply="$(timeout 3 bash -c 'exec 3<>"/dev/tcp/$1/$2" || exit 0; printf "PING\r\n" >&3; IFS= read -r line <&3; printf "%s" "$line"' _ "$host" "$port" 2>/dev/null)"
    fi
    case "$reply" in
        *PONG*) echo "yes" ;;
        *) echo "no" ;;
    esac
}

# Kind of the answering store: dragonfly | redis | external.
redis_endpoint_kind() {
    local host="$1"
    local port="$2"
    local info=""

    if command -v redis-cli >/dev/null 2>&1; then
        info="$(timeout 3 redis-cli -h "$host" -p "$port" INFO server 2>/dev/null)"
    fi
    if printf '%s' "$info" | grep -q '^dragonfly_version:' \
        || systemctl is-active --quiet "$REDIS_ENDPOINT_DRAGONFLY_UNIT" 2>/dev/null; then
        echo "dragonfly"
    elif printf '%s' "$info" | grep -q '^redis_version:' \
        || systemctl is-active --quiet "$REDIS_ENDPOINT_REDIS_UNIT" 2>/dev/null; then
        echo "redis"
    else
        echo "external"
    fi
}

redis_endpoint_wait_ready() {
    local waited=0

    REDIS_ENDPOINT_READY="$(redis_endpoint_ping "$REDIS_ENDPOINT_HOST" "$REDIS_ENDPOINT_PORT")"
    while [ "$REDIS_ENDPOINT_READY" != "yes" ] && [ "$waited" -lt "$REDIS_ENDPOINT_WAIT_SECONDS" ]; do
        sleep 1
        waited=$((waited + 1))
        REDIS_ENDPOINT_READY="$(redis_endpoint_ping "$REDIS_ENDPOINT_HOST" "$REDIS_ENDPOINT_PORT")"
    done
}

# Idempotent gvar write: only when the stored value differs.
redis_endpoint_gvar_ensure() {
    local key="$1"
    local value="$2"

    if [ "$(get_global_var "$key" "")" != "$value" ]; then
        set_global_var "$key" "$value"
    fi
}

redis_endpoint_unit_start() {
    local unit="$1"

    if [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
        if ! systemctl is-enabled --quiet "$unit" 2>/dev/null; then
            $USE_SUDO systemctl enable "$unit" >/dev/null 2>&1
        fi
        if ! systemctl is-active --quiet "$unit" 2>/dev/null; then
            $USE_SUDO systemctl start "$unit" >/dev/null 2>&1
        fi
    elif command -v service >/dev/null 2>&1; then
        $USE_SUDO service "$unit" start >/dev/null 2>&1
    fi
}

# Record the reused/started store: the selector gvar keeps step 73/71 from
# stopping it on later dd.sh runs and marks phpredis as desired for step 93.
redis_endpoint_publish() {
    REDIS_ENDPOINT_KIND="$(redis_endpoint_kind "$REDIS_ENDPOINT_HOST" "$REDIS_ENDPOINT_PORT")"
    REDIS_ENDPOINT_SIGNATURE="${REDIS_ENDPOINT_KIND}@${REDIS_ENDPOINT_HOST}:${REDIS_ENDPOINT_PORT}"
    case "$REDIS_ENDPOINT_KIND" in
        redis) redis_endpoint_gvar_ensure "START_REDIS" "true" ;;
        dragonfly) redis_endpoint_gvar_ensure "START_DRAGONFLY" "true" ;;
    esac
    redis_endpoint_gvar_ensure "$REDIS_ENDPOINT_SELECTED_KEY" "$REDIS_ENDPOINT_SIGNATURE"
}

# Converge one redis.conf directive and its live value independently; each
# side is written only when it differs (no restart needed).
redis_endpoint_directive_ensure() {
    local conf="$1"
    local name="$2"
    local value="$3"
    local live=""

    live="$(timeout 3 redis-cli -h "$REDIS_ENDPOINT_HOST" -p "$REDIS_ENDPOINT_PORT" --raw CONFIG GET "$name" 2>/dev/null | sed -n 2p)"
    if [ "$live" != "$value" ]; then
        timeout 10 redis-cli -h "$REDIS_ENDPOINT_HOST" -p "$REDIS_ENDPOINT_PORT" CONFIG SET "$name" "$value" >/dev/null 2>&1
        echo "  Redis live config: ${name} ${value}"
    fi
    if [ -f "$conf" ] && ! $USE_SUDO grep -qx "${name} ${value}" "$conf" 2>/dev/null; then
        if $USE_SUDO grep -q "^${name} " "$conf" 2>/dev/null; then
            $USE_SUDO sed -i "s|^${name} .*|${name} ${value}|" "$conf"
        else
            printf '%s %s\n' "$name" "$value" | $USE_SUDO tee -a "$conf" >/dev/null
        fi
        echo "  Redis config file: ${name} ${value} (${conf})"
    fi
}

# Hard cap in bytes: MemTotal * percent.
redis_endpoint_maxmemory_bytes() {
    local total_kb=""

    total_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null)"
    echo $(( ${total_kb:-0} * 1024 / 100 * REDIS_ENDPOINT_MAXMEMORY_PERCENT ))
}

# Flagfile the dragonfly unit starts with (default package path otherwise).
redis_endpoint_dragonfly_flagfile() {
    local flagfile=""

    flagfile="$(systemctl cat "$REDIS_ENDPOINT_DRAGONFLY_UNIT" 2>/dev/null | grep -o -- '--flagfile=[^ ]*' | head -1)"
    echo "${flagfile#--flagfile=}" | grep . || echo "$REDIS_ENDPOINT_DRAGONFLY_FLAGFILE_DEFAULT"
}

# Set one --name=value flag in the Dragonfly flagfile only when it differs.
redis_endpoint_dragonfly_flag_ensure() {
    local flagfile="$1"
    local name="$2"
    local value="$3"

    if $USE_SUDO grep -qxF -- "--${name}=${value}" "$flagfile" 2>/dev/null; then
        return
    fi
    $USE_SUDO mkdir -p "$(dirname "$flagfile")"
    $USE_SUDO touch "$flagfile"
    $USE_SUDO sed -i "/^--${name}=/d" "$flagfile"
    printf -- '--%s=%s\n' "$name" "$value" | $USE_SUDO tee -a "$flagfile" >/dev/null
    REDIS_ENDPOINT_DRAGONFLY_CHANGED="yes"
    echo "  Dragonfly flagfile: --${name}=${value} (${flagfile})"
}

# Dragonfly: cap maxmemory at the hard cap and derive proactor_threads so the
# cap satisfies Dragonfly's per-thread minimum; restart only on a change.
redis_endpoint_dragonfly_maxmemory_ensure() {
    local flagfile=""
    local desired=""
    local thread_min_bytes=0
    local threads=1
    local cpus=1

    if ! command -v dragonfly >/dev/null 2>&1; then
        return
    fi
    REDIS_ENDPOINT_DRAGONFLY_CHANGED="no"
    flagfile="$(redis_endpoint_dragonfly_flagfile)"
    desired="$(redis_endpoint_maxmemory_bytes)"
    thread_min_bytes=$((REDIS_ENDPOINT_DRAGONFLY_THREAD_MIN_MB * 1024 * 1024))
    if [ "$desired" -lt "$thread_min_bytes" ]; then
        echo "  Warning: ${REDIS_ENDPOINT_MAXMEMORY_PERCENT}% of RAM is below Dragonfly's ${REDIS_ENDPOINT_DRAGONFLY_THREAD_MIN_MB} MiB minimum; using the minimum."
        desired="$thread_min_bytes"
    fi
    cpus="$(nproc 2>/dev/null || echo 1)"
    threads=$((desired / thread_min_bytes))
    if [ "$threads" -gt "$cpus" ]; then
        threads="$cpus"
    fi
    redis_endpoint_dragonfly_flag_ensure "$flagfile" "maxmemory" "$desired"
    redis_endpoint_dragonfly_flag_ensure "$flagfile" "proactor_threads" "$threads"
    if [ "$REDIS_ENDPOINT_DRAGONFLY_CHANGED" = "yes" ] && systemctl is-active --quiet "$REDIS_ENDPOINT_DRAGONFLY_UNIT" 2>/dev/null; then
        echo "  Restarting Dragonfly to apply the memory cap..."
        $USE_SUDO systemctl restart "$REDIS_ENDPOINT_DRAGONFLY_UNIT" 2>/dev/null || true
        redis_endpoint_wait_ready
    fi
}

# Converge the managed maxmemory cap (live + redis.conf, each only when it
# differs). An explicit cap not owned by this script is kept only when it is
# non-zero and not above the hard cap.
redis_endpoint_maxmemory_ensure() {
    local conf="$1"
    local desired=""
    local live=""
    local managed="no"
    local conf_value=""
    local operator_cap=""

    desired="$(redis_endpoint_maxmemory_bytes)"
    live="$(timeout 3 redis-cli -h "$REDIS_ENDPOINT_HOST" -p "$REDIS_ENDPOINT_PORT" --raw CONFIG GET maxmemory 2>/dev/null | sed -n 2p)"
    if [ -f "$conf" ] && $USE_SUDO grep -qxF "$REDIS_ENDPOINT_MAXMEMORY_MARKER" "$conf" 2>/dev/null; then
        managed="yes"
    fi
    if [ -f "$conf" ]; then
        conf_value="$($USE_SUDO awk '/^maxmemory[ \t]/ {print $2}' "$conf" 2>/dev/null | tail -1)"
    fi
    if [ "$managed" != "yes" ]; then
        operator_cap="$conf_value"
        if [ -z "$operator_cap" ] || [ "$operator_cap" = "0" ]; then
            operator_cap="$live"
        fi
        if [ -n "$operator_cap" ] && [ "$operator_cap" != "0" ] && [ "$operator_cap" -le "$desired" ] 2>/dev/null; then
            echo "  Redis maxmemory: operator cap ${operator_cap} kept (within the ${REDIS_ENDPOINT_MAXMEMORY_PERCENT}% hard cap)."
            return
        fi
    fi
    if [ -n "$live" ] && [ "$live" != "$desired" ]; then
        timeout 10 redis-cli -h "$REDIS_ENDPOINT_HOST" -p "$REDIS_ENDPOINT_PORT" CONFIG SET maxmemory "$desired" >/dev/null 2>&1
        echo "  Redis live config: maxmemory ${desired}"
    fi
    if [ -f "$conf" ] && { [ "$managed" != "yes" ] || [ "$conf_value" != "$desired" ]; }; then
        $USE_SUDO sed -i -e "\|^${REDIS_ENDPOINT_MAXMEMORY_MARKER}\$|d" -e '/^maxmemory[ \t]/d' "$conf"
        printf '%s\nmaxmemory %s\n' "$REDIS_ENDPOINT_MAXMEMORY_MARKER" "$desired" | $USE_SUDO tee -a "$conf" >/dev/null
        echo "  Redis config file: maxmemory ${desired} (${conf})"
    fi
}

# Apply the Laravel index contract to a local redis-server; a local Dragonfly
# gets the memory hard cap through its flagfile (it never evicts unless
# started in cache mode; listpack tuning does not apply). External stores are
# reported only.
redis_endpoint_config_ensure() {
    local conf=""
    local directive=""

    if [ "$REDIS_ENDPOINT_READY" != "yes" ]; then
        return
    fi
    if [ "$REDIS_ENDPOINT_KIND" = "dragonfly" ]; then
        redis_endpoint_dragonfly_maxmemory_ensure
        return
    fi
    if [ "$REDIS_ENDPOINT_KIND" != "redis" ] || ! command -v redis-cli >/dev/null 2>&1; then
        echo "Redis config contract not applied to ${REDIS_ENDPOINT_SIGNATURE} (managed outside redis-server)."
        return
    fi
    conf="$(get_global_var "REDIS_CONFIG_FILE" "/etc/redis/redis.conf")"
    for directive in "${REDIS_ENDPOINT_CONFIG_DIRECTIVES[@]}"; do
        redis_endpoint_directive_ensure "$conf" "${directive%% *}" "${directive#* }"
    done
    redis_endpoint_maxmemory_ensure "$conf"
}

# 175 init convergence. Each step runs only when the previous one left the
# endpoint unreachable: reuse -> start selected Dragonfly -> start installed
# redis-server -> canonical Redis installer (binary missing only).
redis_endpoint_ensure() {
    REDIS_ENDPOINT_READY="no"
    REDIS_ENDPOINT_KIND=""
    REDIS_ENDPOINT_SIGNATURE=""
    redis_endpoint_resolve
    if [ -z "$REDIS_ENDPOINT_HOST" ] || [ -z "$REDIS_ENDPOINT_PORT" ]; then
        echo "  Warning: service contract lacks hosts.loopback/ports.redis; Redis convergence skipped."
        return
    fi

    REDIS_ENDPOINT_READY="$(redis_endpoint_ping "$REDIS_ENDPOINT_HOST" "$REDIS_ENDPOINT_PORT")"
    if [ "$REDIS_ENDPOINT_READY" = "yes" ]; then
        redis_endpoint_publish
        echo "Redis endpoint present: ${REDIS_ENDPOINT_SIGNATURE} (reused)."
        redis_endpoint_config_ensure
        return
    fi

    if [ "$(get_global_var "START_DRAGONFLY" "false")" = "true" ] && command -v dragonfly >/dev/null 2>&1; then
        echo "Redis endpoint unreachable; starting the selected Dragonfly service..."
        redis_endpoint_unit_start "$REDIS_ENDPOINT_DRAGONFLY_UNIT"
        redis_endpoint_wait_ready
    fi

    if [ "$REDIS_ENDPOINT_READY" != "yes" ] && command -v redis-server >/dev/null 2>&1; then
        echo "Redis endpoint unreachable; starting the installed redis-server..."
        redis_endpoint_gvar_ensure "START_REDIS" "true"
        redis_endpoint_unit_start "$REDIS_ENDPOINT_REDIS_UNIT"
        redis_endpoint_wait_ready
    fi

    if [ "$REDIS_ENDPOINT_READY" != "yes" ] && ! command -v redis-server >/dev/null 2>&1; then
        echo "redis-server not found. Invoking init-ensure installer (START_REDIS=true):"
        echo "  $REDIS_ENDPOINT_INSTALL_SCRIPT"
        redis_endpoint_gvar_ensure "START_REDIS" "true"
        bash "$REDIS_ENDPOINT_INSTALL_SCRIPT"
        hash -r 2>/dev/null
        redis_endpoint_wait_ready
    fi

    if [ "$REDIS_ENDPOINT_READY" = "yes" ]; then
        redis_endpoint_publish
        echo "Redis endpoint ready: ${REDIS_ENDPOINT_SIGNATURE}."
        redis_endpoint_config_ensure
    else
        echo "  Warning: no Redis-compatible endpoint answers on ${REDIS_ENDPOINT_HOST}:${REDIS_ENDPOINT_PORT}; Laravel uses its database path."
        echo "  Inspect: systemctl status ${REDIS_ENDPOINT_REDIS_UNIT} --no-pager"
    fi
}

# Service-launcher convergence: start the store selected by 175 when it is
# down. Never installs; an unselected or foreign endpoint is left alone.
redis_endpoint_service_state_ensure() {
    REDIS_ENDPOINT_READY="no"
    if [ -z "$(get_global_var "$REDIS_ENDPOINT_SELECTED_KEY" "")" ]; then
        return
    fi
    redis_endpoint_resolve
    REDIS_ENDPOINT_READY="$(redis_endpoint_ping "$REDIS_ENDPOINT_HOST" "$REDIS_ENDPOINT_PORT")"
    if [ "$REDIS_ENDPOINT_READY" = "yes" ]; then
        return
    fi
    case "$(get_global_var "$REDIS_ENDPOINT_SELECTED_KEY" "")" in
        dragonfly@*) redis_endpoint_unit_start "$REDIS_ENDPOINT_DRAGONFLY_UNIT" ;;
        redis@*) redis_endpoint_unit_start "$REDIS_ENDPOINT_REDIS_UNIT" ;;
    esac
    redis_endpoint_wait_ready
    if [ "$REDIS_ENDPOINT_READY" != "yes" ]; then
        echo "  Warning: selected Redis endpoint is down; Laravel uses its database path until it returns."
    fi
}
