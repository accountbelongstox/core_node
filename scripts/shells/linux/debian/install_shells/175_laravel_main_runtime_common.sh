#!/bin/bash

# the PORT env var as the explicit override.
PORT="${PORT:-$(sc_get ports.laravel_api_backend)}"

cleanup_runtime() {
    local shown_code="$GENERATED_ACCESS_CODE"
    local stored_code=""
    if [ -d "$ORIGINAL_DIR" ]; then
        cd "$ORIGINAL_DIR"
    fi
    echo ""
    echo "Restored to initial directory: $ORIGINAL_DIR"
    echo ""
    # The code lives in the external runtime store (PathMapper
    # laravel_data_dir); show the STORED value when resolvable - it wins over
    # this run's candidate once provisioned (the code is stable across runs).
    if [ -n "$PHP_BIN" ]; then
        stored_code="$(runtime_config_get "INSTALLATION_ACCESS_CODE" 2>/dev/null)"
        if [ -n "$stored_code" ]; then
            shown_code="$stored_code"
        fi
    fi
    echo "Installation access value: ${shown_code}"
}

print_usage() {
    echo "Usage: bash ${SELF} [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h          Show this help message and exit."
    echo "  --show-super-code   Show the last generated super code and exit."
    echo "  --service           Register and start the background service."
    echo "  --no-service        Run without registering the background service."
    echo "  --with-ui           Include the dashboard background service."
    echo "  --no-ui             Do not include the dashboard background service."
    echo "  --domains-only      Run prerequisites + the plane's domain/web phase, no runtime start."
    echo "  --ssl-only          Run prerequisites + certificates only, no runtime start."
    echo "  --no-domains        Skip the domain/SSL/nginx phases entirely."
    echo "  --skip-ssh          Skip the SSH server ensure phase."
}

# The code lives in the external runtime store (RuntimeConfigurationStore,
# rooted at the PathMapper laravel_data_dir outside the repository);
# InstallationAccessCode.php only reads it and is never regenerated.
read_stored_super_code() {
    local stored_code=""
    resolve_php
    if [ -z "$PHP_BIN" ]; then
        echo "ERROR: php not found; cannot read the runtime configuration store." >&2
        return
    fi
    stored_code="$(runtime_config_get "INSTALLATION_ACCESS_CODE" 2>/dev/null)"
    if [ -z "$stored_code" ]; then
        echo "ERROR: Installation access code not provisioned yet; run the full start once." >&2
        return
    fi
    STORED_SUPER_CODE="$stored_code"
}

# Parse startup arguments (the orchestrator passes service options so it never re-prompts).
for ARG in "$@"; do
    case "$ARG" in
        --help|-h) HELP_REQUESTED="yes" ;;
        --show-super-code) SHOW_SUPER_CODE="yes" ;;
        --service) AS_SERVICE="yes" ;;
        --no-service) AS_SERVICE="no" ;;
        --with-ui) INCLUDE_UI="yes" ;;
        --no-ui) INCLUDE_UI="no" ;;
        --domains-only) RUNTIME_START="no"; DOMAIN_SCOPE="all" ;;
        --ssl-only) RUNTIME_START="no"; DOMAIN_SCOPE="certs" ;;
        --no-domains) DOMAIN_SCOPE="none" ;;
        --skip-ssh) SKIP_SSH="yes" ;;
    esac
done

if [ "$HELP_REQUESTED" = "yes" ]; then
    print_usage
fi

# Restore initial directory on any exit (normal, error, Ctrl+C)
if [ "$HELP_REQUESTED" != "yes" ]; then
    trap cleanup_runtime EXIT
fi

# --- Functions ---

new_installation_access_code() {
    local segment_one segment_two segment_three segment_four
    segment_one="$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n' | tr '[:lower:]' '[:upper:]')"
    segment_two="$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n' | tr '[:lower:]' '[:upper:]')"
    segment_three="$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n' | tr '[:lower:]' '[:upper:]')"
    segment_four="$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n' | tr '[:lower:]' '[:upper:]')"
    printf 'NEXU-%s-%s-%s-%s' "$segment_one" "$segment_two" "$segment_three" "$segment_four"
}

persist_global_var_file_value() {
    local key="$1"
    local value="$2"
    local gdir="${GLOBAL_VAR_DIR:-${CORE_NODE_DATA_DIR:-/var/_core_node}/global_var}"

    GLOBAL_VAR_WRITE_READY="no"
    if [ -n "$key" ] && declare -F set_global_var >/dev/null 2>&1; then
        set_global_var "$key" "$value"
    elif [ -n "$key" ]; then
        $USE_SUDO mkdir -p "$gdir" 2>/dev/null
        printf '%s\n' "$value" | $USE_SUDO tee "$gdir/$key" >/dev/null 2>&1
        $USE_SUDO chmod 777 "$gdir/$key" 2>/dev/null
    fi
    if [ -n "$key" ] && [ -f "$gdir/$key" ] && [ "$(tr -d '\r\n' < "$gdir/$key")" = "$value" ]; then
        GLOBAL_VAR_WRITE_READY="yes"
    fi
}

# Resolve php into PHP_BIN: PATH -> known bin locations.
# In frankenphp plane, use shared frankenPHP shims first, then other known candidates.
resolve_php() {
    local runtime_plane=""
    local resolved_php=""

    PHP_BIN=""
    runtime_plane="$(php_runtime_plane)"

    if [ "$runtime_plane" = "frankenphp" ]; then
        fm_runtime_converge
        fm_ensure_php_cli_shim
        if [ -x "$FRANKENPHP_PHP_CLI_SHIM_PATH" ]; then
            PHP_BIN="$FRANKENPHP_PHP_CLI_SHIM_PATH"
        elif [ -x "$FRANKENPHP_PHP_SHIM_PATH" ]; then
            PHP_BIN="$FRANKENPHP_PHP_SHIM_PATH"
        else
            echo "WARNING: frankenphp plane detected but the PHP CLI shim is missing."
        fi
    else
        for resolved_php in \
            "/usr/local/bin/php" \
            "/usr/bin/php8.5" \
            "/usr/bin/php"; do
            if [ -x "$resolved_php" ] && [ -z "$PHP_BIN" ]; then
                PHP_BIN="$resolved_php"
            fi
        done
    fi
}

# Converge the PostgreSQL PDO contract before Composer or Laravel bootstrap.
# FrankenPHP variants are prepared by step 93 and are only re-probed here;
# system PHP delegates installation to its canonical package ensurer.
ensure_php_pdo_pgsql() {
    local runtime_binary=""

    PHP_PDO_PGSQL_READY="no"
    CURRENT_WEB_SERVER_PLANE="$(php_runtime_plane 2>/dev/null)"
    if [ -z "$CURRENT_WEB_SERVER_PLANE" ]; then
        CURRENT_WEB_SERVER_PLANE="frankenphp"
    fi
    if [ "$CURRENT_WEB_SERVER_PLANE" = "frankenphp" ]; then
        runtime_binary="$(fm_variant_binary)"
        if [ "$(fm_php_runtime_extensions_ready "$runtime_binary")" = "yes" ]; then
            PHP_PDO_PGSQL_READY="yes"
            echo "FrankenPHP runtime extension contract ready."
        else
            echo "ERROR: The selected FrankenPHP variant does not satisfy the required PHP extension contract."
            echo "  Repair: run $PHP_ENSURE_SCRIPT_FRANKENPHP and select the intended variant."
        fi
        return
    fi

    if "$PHP_BIN" -m 2>/dev/null | grep -qi '^pdo_pgsql$'; then
        PHP_PDO_PGSQL_READY="yes"
        echo "PHP pdo_pgsql extension present."
        return
    fi

    echo "PHP pdo_pgsql missing. Invoking init-ensure installer:"
    echo "  $PHP_PGSQL_ENSURE_SCRIPT"
    bash "$PHP_PGSQL_ENSURE_SCRIPT"
    if "$PHP_BIN" -m 2>/dev/null | grep -qi '^pdo_pgsql$'; then
        PHP_PDO_PGSQL_READY="yes"
        echo "pdo_pgsql installed -> PostgreSQL driver available."
    else
        echo "ERROR: pdo_pgsql remains unavailable after package convergence."
    fi
}

# Resolve composer into COMPOSER_CMD: prefer frankenphp shim/installed wrapper on frankenphp plane.
resolve_composer() {
    local runtime_plane=""

    COMPOSER_CMD=""
    runtime_plane="$(php_runtime_plane)"

    if [ "$runtime_plane" = "frankenphp" ] && [ -x "/usr/local/bin/composer" ]; then
        COMPOSER_CMD="/usr/local/bin/composer"
        return
    fi

    if [ -n "$PHP_BIN" ] && [ -f "${LARAVEL_DIR}/composer.phar" ]; then
        COMPOSER_CMD="${PHP_BIN} ${LARAVEL_DIR}/composer.phar"
        return
    fi
    if [ -n "$PHP_BIN" ] && [ -f "${REPO_ROOT}/composer.phar" ]; then
        COMPOSER_CMD="${PHP_BIN} ${REPO_ROOT}/composer.phar"
        return
    fi

    for COMPOSER_CANDIDATE in \
        "/usr/local/bin/composer" \
        "$HOME/.config/composer/vendor/bin/composer" \
        "$HOME/.composer/vendor/bin/composer"; do
        if [ -x "$COMPOSER_CANDIDATE" ]; then
            COMPOSER_CMD="$COMPOSER_CANDIDATE"
            return
        fi
    done

    if [ "$runtime_plane" != "frankenphp" ] && [ -x "/usr/bin/composer" ]; then
        COMPOSER_CMD="/usr/bin/composer"
        return
    fi

}

composer_command_healthy() {
    local command_line="$1"
    local command_path=""

    COMPOSER_COMMAND_READY="no"
    command_path="${command_line%% *}"
    if [ -x "$command_path" ]; then
        if [ "$command_path" = "/usr/local/bin/composer" ]; then
            if [ -s "/usr/local/lib/composer/composer.phar" ]; then
                COMPOSER_COMMAND_READY="yes"
            fi
        else
            COMPOSER_COMMAND_READY="yes"
        fi
    fi
}

# Shared RuntimeConfigurationStore adapter (central source in runtime_config_common;
# callers provide PHP_BIN, VENDOR_AUTOLOAD, BOOTSTRAP_APP at file top).
# shellcheck source=/dev/null
source "$RUNTIME_CONFIG_COMMON"

initialize_runtime_configuration_store() {
    local generated_value=""
    local config_state=""

    RUNTIME_CONFIGURATION_READY="no"
    RUNTIME_CONFIG_DIR="$(runtime_config_directory)"
    if [ -z "$RUNTIME_CONFIG_DIR" ]; then
        echo "ERROR: Runtime configuration store directory could not be resolved."
    else
        generated_value="$(RC_ARG_AUTOLOAD="$VENDOR_AUTOLOAD" RC_ARG_BOOTSTRAP="$BOOTSTRAP_APP" php_script_run 'require getenv("RC_ARG_AUTOLOAD"); require getenv("RC_ARG_BOOTSTRAP"); echo "base64:".base64_encode(random_bytes(32));')"
        if [ -z "$generated_value" ]; then
            echo "ERROR: Failed to generate APP_KEY."
        else
            config_state="$(ensure_runtime_config_value "APP_KEY" "$generated_value")"
            if [ "$config_state" != "ready" ]; then
                echo "ERROR: Failed to provision APP_KEY."
            else
                # The Mercure hub keys are converged independently and then re-probed.
                runtime_config_ensure_mercure_keys
                if [ "$(runtime_config_mercure_keys_ready)" != "yes" ]; then
                    echo "ERROR: Failed to provision the Mercure hub keys."
                else
                    # Installation access code is its own idempotent step.
                    config_state="$(ensure_runtime_config_value "INSTALLATION_ACCESS_CODE" "$GENERATED_ACCESS_CODE")"
                    if [ "$config_state" != "ready" ]; then
                        echo "ERROR: Failed to provision the installation access code."
                    else
                        RUNTIME_CONFIGURATION_READY="yes"
                        echo "Runtime configuration store ready: $RUNTIME_CONFIG_DIR"
                    fi
                fi
            fi
        fi
    fi
}

# Resolve npx into NPX_BIN (needed by composer dev / dev:win).
resolve_npx() {
    NPX_BIN=""
    # Drop any stale command hash so a freshly-installed npx is seen this shell.
    hash -r 2>/dev/null
    if command -v npx >/dev/null 2>&1; then
        NPX_BIN="$(command -v npx)"
    fi
    # 17_install_node_toolchain_24.sh symlinks into /usr/local/bin; also probe nvm-style dirs.
    for NPX_CANDIDATE in "/usr/local/bin/npx" "/usr/bin/npx" "$HOME/.local/bin/npx"; do
        if [ -x "$NPX_CANDIDATE" ] && [ -z "$NPX_BIN" ]; then
            NPX_BIN="$NPX_CANDIDATE"
        fi
    done
}

pg_is_ready() {
    local ready_output=""
    POSTGRES_READY="no"
    if command -v pg_isready >/dev/null 2>&1; then
        ready_output="$(pg_isready 2>/dev/null)"
    fi
    case "$ready_output" in
        *"accepting connections"*) POSTGRES_READY="yes" ;;
    esac
}

# Run a command as the postgres OS user (peer auth, no password). Root- and
# sudo-safe: prefer sudo (ensured by the toolchain), fall back to su when root.
pg_run_as_postgres() {
    if command -v sudo >/dev/null 2>&1; then
        sudo -u postgres "$@"
    elif [ "$(id -u)" -eq 0 ]; then
        su -s /bin/bash postgres -c "$(printf '%q ' "$@")"
    else
        "$@"
    fi
}

# y/N prompt that DEFAULTS TO NO. Non-interactive (no controlling TTY) -> NO
# automatically (policy: keep container running). Override with
# PORT_CONFLICT_AUTO_STOP=yes (pre-confirm) or =no (force No).
prompt_default_no() {
    local msg="$1" reply=""
    PROMPT_ANSWER="no"
    case "${PORT_CONFLICT_AUTO_STOP:-}" in
        [Yy]*) PROMPT_ANSWER="yes" ;;
        [Nn]*) PROMPT_ANSWER="no" ;;
        *)
            if [ -t 0 ] && [ -r /dev/tty ]; then
                printf '%s [y/N] ' "$msg" > /dev/tty
                read -r reply < /dev/tty
            fi
            case "$reply" in [Yy]*) PROMPT_ANSWER="yes" ;; esac
            ;;
    esac
}

# If a Docker container PUBLISHES <port> (e.g. MinIO on :9000, pgvector on :5432),
# it surfaces as a docker-proxy holder we must NOT kill directly. Identify the
# owning container and offer to stop it (default Yes). Returns 0 if one was stopped.
# Detection/stop primitives come from the shared port guard (port_guard_common.sh).
stop_docker_publisher() {
    local port="$1" row="" cid="" cname=""
    DOCKER_PUBLISHER_STOPPED="no"
    row=$(pg_docker_publisher_container "$port")
    if [ -n "$row" ]; then
        cid=$(printf '%s' "$row" | awk '{print $1}')
        cname=$(printf '%s' "$row" | awk '{print $2}')
        echo "  Port ${port} is published by Docker container: ${cname:-$cid}"
        prompt_default_no "  Stop container ${cname:-$cid} and disable its auto-startup to free port ${port}?"
        if [ "$PROMPT_ANSWER" = "yes" ]; then
            echo "  Stopping container ${cname:-$cid} ..."
            pg_docker_container_stop "$cid"
            DOCKER_PUBLISHER_STOPPED="yes"
            echo "  Container ${cname:-$cid} stopped and auto-startup disabled."
        else
            echo "  Left container ${cname:-$cid} running; port ${port} still occupied."
        fi
    fi
}

# Free the runtime PORT before starting (idempotent restart). Stops ONLY
# leftover app servers (octane/swoole/artisan serve) -- a non-app holder is
# reported, never killed.
ensure_port_free() {
    local port="$1"
    local php_bin="$2"
    local pids="" pid="" cmd=""

    PORT_READY="no"
    "$php_bin" artisan octane:stop >/dev/null 2>&1
    sleep 1

    if command -v ss >/dev/null 2>&1; then
        pids=$(ss -ltnpH 2>/dev/null | grep -E "[:.]${port}[[:space:]]" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
    fi
    if [ -z "$pids" ] && command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null | sort -u)
    fi
    if [ -n "$pids" ]; then
        stop_docker_publisher "$port"
    fi
    if [ "$DOCKER_PUBLISHER_STOPPED" = "yes" ]; then
        sleep 2
        if command -v ss >/dev/null 2>&1; then
            pids=$(ss -ltnpH 2>/dev/null | grep -E "[:.]${port}[[:space:]]" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
        fi
        if [ -z "$pids" ] && command -v lsof >/dev/null 2>&1; then
            pids=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null | sort -u)
        fi
    fi

    for pid in $pids; do
        cmd=$(ps -p "$pid" -o args= 2>/dev/null)
        if echo "$cmd" | grep -qiE 'octane|swoole|artisan serve'; then
            echo "  Port ${port}: stopping stale app server PID ${pid}"
            kill "$pid" 2>/dev/null
            if [ -d "/proc/$pid" ]; then
                ${USE_SUDO:-} kill "$pid" 2>/dev/null
            fi
        else
            echo "  *** Port ${port} held by non-app PID ${pid}: ${cmd}"
        fi
    done
    sleep 2

    pids=""
    if command -v ss >/dev/null 2>&1; then
        pids="$(ss -ltnH 2>/dev/null | grep -E "[:.]${port}[[:space:]]")"
    fi
    if [ -n "$pids" ]; then
        echo "  *** ACTION REQUIRED: port ${port} still in use. Stop the holder, or start with another port: PORT=<other> bash $0"
    else
        PORT_READY="yes"
    fi
}

# schedule:work binds NO port, so ensure_port_free() can never catch a stale
# instance; stop leftover schedule:work processes explicitly (single tick source).
ensure_schedule_work_stopped() {
    local pids="" pid=""
    if command -v pgrep >/dev/null 2>&1; then
        pids=$(pgrep -f 'artisan schedule:work' 2>/dev/null)
    else
        pids=$(ps -eo pid,args 2>/dev/null | grep 'artisan schedule:work' | grep -v grep | awk '{print $1}')
    fi
    if [ -n "$pids" ]; then
        for pid in $pids; do
            echo "  Stopping stale schedule:work PID ${pid}"
            kill "$pid" 2>/dev/null
            if [ -d "/proc/$pid" ]; then
                ${USE_SUDO:-} kill "$pid" 2>/dev/null
            fi
        done
        sleep 1
    fi
}

# DEFAULT YES prompt on the controlling TTY; no TTY -> yes.
ask_default_yes() {
    local msg="$1" reply=""
    PROMPT_ANSWER="yes"
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '%s [Y/n] ' "$msg" > /dev/tty
        read -r reply < /dev/tty
    fi
    case "$reply" in [Nn]*) PROMPT_ANSWER="no" ;; esac
}

# DEFAULT NO prompt on the controlling TTY; no TTY -> no.
ask_default_no() {
    local msg="$1" reply=""
    PROMPT_ANSWER="no"
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '%s [y/N] ' "$msg" > /dev/tty
        read -r reply < /dev/tty
    fi
    case "$reply" in [Yy]*) PROMPT_ANSWER="yes" ;; esac
}

ensure_ui_domain_binding() {
    if [ "$UI_BINDING_CONVERGED" = "yes" ]; then
        return
    fi
    domain_setup_resolve_ui_binding_state
    if [ "$INCLUDE_UI" != "yes" ] && [ "$DOMAIN_UI_BINDING_ENABLED" != "yes" ]; then
        return
    fi

    if [ "$INCLUDE_UI" = "yes" ]; then
        if [ -f "$UI_START" ]; then
            echo "Bringing up pycore_laravel_wordnew_ui dashboard with Vite hot reload (idempotent)..."
            bash "$UI_START" --no-backend --service --dev
        else
            echo "  Warning: UI start script not found: $UI_START (domain binding still converges)."
        fi
    else
        echo "Refreshing the persisted dashboard domain binding (idempotent)..."
    fi

    if [ "$CURRENT_WEB_SERVER_PLANE" = "frankenphp" ]; then
        PORT="$PORT" PHP_BIN="$PHP_BIN" LARAVEL_DIR="$LARAVEL_DIR" \
            /bin/bash "$LARAVEL_START_FRANKENPHP_SUB" ui-binding
    else
        domain_setup_enable_ui_binding
    fi
    UI_BINDING_CONVERGED="yes"
}

# Echo a systemd memory limit "<n>M" = min(total RAM / 4, cap_mb), floored at 128M.
# Laravel memory limit: 50% of total RAM, floored at 200M, capped at cap_mb.
compute_mem_limit() {
    local cap_mb="$1"
    local total_kb total_mb half
    total_kb=$(grep -m1 MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')
    if [ -z "$total_kb" ]; then
        total_kb=0
    fi
    total_mb=$(( total_kb / 1024 ))
    half=$(( total_mb / 2 ))
    [ "$half" -lt 200 ] && half=200
    if [ "$half" -gt "$cap_mb" ]; then echo "${cap_mb}M"; else echo "${half}M"; fi
}

# Resolve WSL state from the standard kernel and environment markers.
is_wsl() {
    local kernel_version=""
    WSL_READY="no"
    kernel_version="$(tr '[:upper:]' '[:lower:]' < /proc/version 2>/dev/null)"
    case "$kernel_version" in
        *microsoft*|*wsl*) WSL_READY="yes" ;;
    esac
    if [ -n "${WSL_DISTRO_NAME:-}" ] || [ -n "${WSL_INTEROP:-}" ]; then
        WSL_READY="yes"
    fi
}

# Resolve whether systemd is the active init and systemctl is available.
systemd_available() {
    local systemctl_path=""
    SYSTEMD_READY="no"
    systemctl_path="$(command -v systemctl 2>/dev/null)"
    if [ -d /run/systemd/system ] && [ -n "$systemctl_path" ]; then
        SYSTEMD_READY="yes"
    fi
}

# Resolve the plane-specific service name, description, and launcher script
# from the CURRENT web-server plane. The service is always plane-aware:
#   frankenphp -> ncore-laravel-frankenphp  (175SF launcher)
#   nginx       -> ncore-laravel-nginx       (175SN launcher)
# A plane-neutral "ncore-laravel-main" alias is NOT created (the service
# manager's grep patterns recognize both plane names).
_resolve_laravel_service_plane() {
    LARAVEL_SERVICE_PLANE="$(web_server_plane)"
    case "$LARAVEL_SERVICE_PLANE" in
        frankenphp)
            LARAVEL_SERVICE_PLANE_NAME="${LARAVEL_SERVICE_NAME_BASE}-frankenphp"
            LARAVEL_SERVICE_PLANE_DESC="$LARAVEL_SERVICE_DESC_FRANKENPHP"
            LARAVEL_SERVICE_PLANE_LAUNCHER="$SERVICE_FRANKENPHP_LAUNCHER"
            LARAVEL_SERVICE_EXEC_STOP=""
            LARAVEL_SERVICE_TIMEOUT_STOP="15s"
            ;;
        nginx)
            LARAVEL_SERVICE_PLANE_NAME="${LARAVEL_SERVICE_NAME_BASE}-nginx"
            LARAVEL_SERVICE_PLANE_DESC="$LARAVEL_SERVICE_DESC_NGINX"
            LARAVEL_SERVICE_PLANE_LAUNCHER="$SERVICE_NGINX_LAUNCHER"
            LARAVEL_SERVICE_EXEC_STOP=""
            LARAVEL_SERVICE_TIMEOUT_STOP=""
            ;;
        *)
            LARAVEL_SERVICE_PLANE_NAME="${LARAVEL_SERVICE_NAME_BASE}-main"
            LARAVEL_SERVICE_PLANE_DESC="laravel_main backend (Octane)"
            LARAVEL_SERVICE_PLANE_LAUNCHER="$SELF"
            LARAVEL_SERVICE_EXEC_STOP=""
            LARAVEL_SERVICE_TIMEOUT_STOP=""
            ;;
    esac
}

# Register (or refresh) the laravel_main systemd service via systemd_service_manager.
# The ExecStart is a plane-specific runtime launcher (175SF/175SN) that does
# minimal convergence + octane - NO init, NO domain setup, NO installers.
# Default: hot-reload (OCTANE_WATCH=1).
register_laravel_service() {
    local exec_cmd="$1"
    LARAVEL_SERVICE_READY="no"
    if [ ! -f "$SERVICE_MANAGER" ]; then
        echo "ERROR: systemd_service_manager not found: $SERVICE_MANAGER"
    elif [ ! -f "$LARAVEL_SERVICE_PLANE_LAUNCHER" ]; then
        echo "ERROR: service launcher missing: $LARAVEL_SERVICE_PLANE_LAUNCHER"
    elif [ "$(id -u)" -eq 0 ]; then
        (
            # shellcheck disable=SC1090
            source "$SERVICE_MANAGER"
            create_systemd_service "$LARAVEL_SERVICE_PLANE_NAME" "$LARAVEL_SERVICE_PLANE_DESC" "$exec_cmd" "$LARAVEL_DIR" "root" "always" "10s" "$LARAVEL_SERVICE_CPU" "$LARAVEL_SERVICE_MEM" "" "900s" "no" "$LARAVEL_SERVICE_EXEC_STOP" "$LARAVEL_SERVICE_TIMEOUT_STOP"
        )
        systemctl enable "$LARAVEL_SERVICE_PLANE_NAME" >/dev/null 2>&1
        systemctl restart "$LARAVEL_SERVICE_PLANE_NAME"
        systemctl status "$LARAVEL_SERVICE_PLANE_NAME" --no-pager -l
    elif command -v sudo >/dev/null 2>&1; then
        sudo bash -c '
            source "$1"
            create_systemd_service "$2" "$3" "$4" "$5" root always 10s "$6" "$7" "" "900s" no "$8" "$9"
            systemctl enable "$2" >/dev/null 2>&1
            systemctl restart "$2"
            systemctl status "$2" --no-pager -l
        ' _ "$SERVICE_MANAGER" "$LARAVEL_SERVICE_PLANE_NAME" "$LARAVEL_SERVICE_PLANE_DESC" "$exec_cmd" "$LARAVEL_DIR" "$LARAVEL_SERVICE_CPU" "$LARAVEL_SERVICE_MEM" "$LARAVEL_SERVICE_EXEC_STOP" "$LARAVEL_SERVICE_TIMEOUT_STOP"
    else
        echo "ERROR: Need root (or sudo) to register a systemd service. Re-run as root."
    fi
    LARAVEL_SERVICE_ENABLED_STATE="$(systemctl is-enabled "$LARAVEL_SERVICE_PLANE_NAME" 2>/dev/null)"
    LARAVEL_SERVICE_ACTIVE_STATE="$(systemctl is-active "$LARAVEL_SERVICE_PLANE_NAME" 2>/dev/null)"
    if [ "$LARAVEL_SERVICE_ENABLED_STATE" = "enabled" ] && [ "$LARAVEL_SERVICE_ACTIVE_STATE" = "active" ]; then
        LARAVEL_SERVICE_READY="yes"
    fi
}

# Ensure the SSH server exists (fine-grained idempotent: binary check first,

