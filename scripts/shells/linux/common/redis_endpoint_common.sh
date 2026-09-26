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
# maxmemory cap: share of MemTotal with a floor. With noeviction, writes fail
# at the cap (Laravel falls back to DB/disk) instead of exhausting host RAM.
# The marker comment identifies the cap this script owns; any other explicit
# cap is an operator decision and is kept.
REDIS_ENDPOINT_MAXMEMORY_PERCENT=25
REDIS_ENDPOINT_MAXMEMORY_FLOOR_MB=256
REDIS_ENDPOINT_MAXMEMORY_MARKER="# core_node managed: maxmemory"

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

# Desired cap in bytes: MemTotal * percent, never below the floor.
redis_endpoint_maxmemory_bytes() {
    local total_kb=""
    local cap_bytes=0
    local floor_bytes=0

    total_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null)"
    floor_bytes=$((REDIS_ENDPOINT_MAXMEMORY_FLOOR_MB * 1024 * 1024))
    if [ -n "$total_kb" ]; then
        cap_bytes=$((total_kb * 1024 / 100 * REDIS_ENDPOINT_MAXMEMORY_PERCENT))
    fi
    if [ "$cap_bytes" -lt "$floor_bytes" ]; then
        cap_bytes="$floor_bytes"
    fi
    echo "$cap_bytes"
}

# Converge the managed maxmemory cap (live + redis.conf, each only when it
# differs). An explicit cap not owned by this script (unmarked non-zero
# redis.conf line, or a non-zero live value without our marker) is kept.
redis_endpoint_maxmemory_ensure() {
    local conf="$1"
    local desired=""
    local live=""
    local managed="no"
    local conf_value=""

    desired="$(redis_endpoint_maxmemory_bytes)"
    live="$(timeout 3 redis-cli -h "$REDIS_ENDPOINT_HOST" -p "$REDIS_ENDPOINT_PORT" --raw CONFIG GET maxmemory 2>/dev/null | sed -n 2p)"
    if [ -f "$conf" ] && $USE_SUDO grep -qxF "$REDIS_ENDPOINT_MAXMEMORY_MARKER" "$conf" 2>/dev/null; then
        managed="yes"
    fi
    if [ -f "$conf" ]; then
        conf_value="$($USE_SUDO awk '/^maxmemory[ \t]/ {print $2}' "$conf" 2>/dev/null | tail -1)"
    fi
    if [ "$managed" != "yes" ] \
        && { { [ -n "$conf_value" ] && [ "$conf_value" != "0" ]; } \
            || { [ -n "$live" ] && [ "$live" != "0" ] && [ "$live" != "$desired" ]; }; }; then
        echo "  Redis maxmemory: operator cap kept (live ${live:-unknown}, config ${conf_value:-unset})."
        return
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

# Apply the Laravel index contract to a local redis-server. Dragonfly and
# external stores are reported only (Dragonfly never evicts unless started
# in cache mode; listpack tuning does not apply; step 71 owns no Dragonfly
# config file, so its --maxmemory stays at Dragonfly's own default).
redis_endpoint_config_ensure() {
    local conf=""
    local directive=""

    if [ "$REDIS_ENDPOINT_READY" != "yes" ]; then
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
