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

# Canonical laravel_main start script (Debian/Ubuntu/WSL). This is the single
# entry point merged from poly_apps/laravel_main/scripts/start.sh plus the old
# 132_prepare_domain_setup.sh / 133_setup_domain_ssl.sh pair (both deleted -
# no thin wrappers; the menu runs this file directly):
#   - full toolchain ensure (php / composer / node / swoole / p7zip / postgres)
#   - vendor/ integrity ensure driven by the shared composer-lock contract
#     (common/composer_vendor_common.sh): install / repair / rebuild from
#     composer.lock, verified by a clean autoloader load
#   - SSH server ensure (via 23_setup_ssh_remote.sh, itself idempotent)
#   - nginx ensure driven by the shared management architecture
#     (common/nginx_manager.sh): install / in-place upgrade / idempotent
#     repair / per-file HTTP/3 + 301 + early-data stanza migration
#   - certbot ensure (via 35_install_certbot.sh) + certificate auto-renewal
#   - domain install from decrypted DNSPod secrets: api.<region>.<domain>
#     sites rendered natively with HTTP/3, reverse-proxied to the canonical
#     API backend (service contract ports.laravel_api_backend on loopback)
#     with plain HTTP on :80 proxying DIRECTLY
#     (no 301 - works even while the cloud security group blocks 443); apex
#     domains keep the 301 -> https pair. The region prefix (si/sh/sz/hk or
#     custom) is persisted in the file-backed global-var store, so later
#     runs only ask whether to modify it
# poly_apps/laravel_main/scripts/start.sh delegates here; every phase is
# independently idempotent and safe to re-run.
#
# SYNC CONTRACT: nginx behavior here is the shell end of the contract declared
# in common/nginx_manager.sh; the Laravel end is ServerManagerV1 under
# poly_apps/laravel_main. Change both ends together.

# --- All variables and file references (declared at top) ---
ORIGINAL_DIR=$(pwd)
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEBIAN_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
LINUX_DIR="$(dirname "$DEBIAN_DIR")"
SHELLS_DIR="$(dirname "$LINUX_DIR")"
SCRIPTS_DIR="$(dirname "$SHELLS_DIR")"
REPO_ROOT="$(dirname "$SCRIPTS_DIR")"
POLY_APPS_DIR="${REPO_ROOT}/poly_apps"
LARAVEL_DIR="${POLY_APPS_DIR}/laravel_main"
LARAVEL_SCRIPTS_DIR="${LARAVEL_DIR}/scripts"
DEBIAN_COM_DIR="${DEBIAN_DIR}/debian_com"
COMMON_DIR="${LINUX_DIR}/common"
INSTALL_SHELLS_DIR="$SCRIPT_CURRENT_DIR"
CORE_NODE_DIR="${CORE_NODE_DIR:-$REPO_ROOT}"
# Runtime port resolves from the central service contract after the common
# libraries are sourced below (sc_get); PORT env still overrides.
PORT="${PORT:-}"
LARAVEL_RUNTIME_FRANKENPHP_SCRIPT="${DEBIAN_COM_DIR}/laravel_runtime_frankenphp.sh"
LARAVEL_RUNTIME_NGINX_SCRIPT="${DEBIAN_COM_DIR}/laravel_runtime_nginx.sh"
RUNTIME_CONFIG_COMMON="${COMMON_DIR}/runtime_config_common.sh"
LARAVEL_13_UPGRADE_SCRIPT="${DEBIAN_COM_DIR}/laravel_upgrade_13.sh"
DOMAIN_SETUP_COMMON="${COMMON_DIR}/domain_setup_common.sh"
NGINX_MANAGER_SCRIPT="${COMMON_DIR}/nginx_manager.sh"
VENDOR_AUTOLOAD="${LARAVEL_DIR}/vendor/autoload.php"
BOOTSTRAP_APP="${LARAVEL_DIR}/bootstrap/app.php"
RUNTIME_CONFIG_DIR=""

# Canonical init-ensure installer scripts
PHP_ENSURE_SCRIPT="${INSTALL_SHELLS_DIR}/43_ensure_php85_intelligent.sh"
COMPOSER_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/94_install_composer.sh"
NODE_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/17_install_node_24.sh"
SWOOLE_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/33_install_swoole.sh"
P7ZIP_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/69_install_p7zip.sh"
POSTGRES_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/75_install_postgresql.sh"
PHP_PGSQL_ENSURE_SCRIPT="${INSTALL_SHELLS_DIR}/77_ensure_php_pgsql.sh"
SSH_SETUP_SCRIPT="${INSTALL_SHELLS_DIR}/23_setup_ssh_remote.sh"
NGINX_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/33_install_nginx.sh"
CERTBOT_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/35_install_certbot.sh"
GVAR_COMMON_SCRIPT="${COMMON_DIR}/gvar_common.sh"
COMPOSER_VENDOR_COMMON="${COMMON_DIR}/composer_vendor_common.sh"
CERT_SELFHEAL_COMMON="${COMMON_DIR}/cert_selfheal_common.sh"
GLOBAL_VAR_DIR="${CORE_NODE_DATA_DIR:-/var/_core_node}/global_var"
SECRETS_DIR="${REPO_ROOT}/.secret_keys/.secret_ignore"

# Per-app PostgreSQL databases (one per app connection; mirrors config/database.php
# $polyConnection(... , pgDatabase) targets). Created idempotently before migrate.
APP_DB_NAMES="core_node_main app_qy_v1_database awy_v0_database vipclub_v1_database server_manager_v1_database achat_v1_database code_mart_v1_database mcp_v1_database it_tools_v1_database bank_v1_database pdd_tool_v1_database"

# Laravel runtime directories that MUST exist and be writable (git does not track
# empty dirs, so a fresh checkout/restore can miss these -> package:discover fails).
LARAVEL_RUNTIME_DIRS=(
    "bootstrap/cache"
    "storage/framework/cache/data"
    "storage/framework/sessions"
    "storage/framework/views"
    "storage/framework/testing"
    "storage/logs"
    "storage/app/public"
    "storage/app/private"
)

# Tool resolution state
PHP_BIN=""
COMPOSER_CMD=""
NPX_BIN=""
PHP_CANDIDATE=""
COMPOSER_CANDIDATE=""
NPX_CANDIDATE=""
RUNTIME_DIR=""
IP_LIST=""
IP=""
OCTANE_AVAILABLE=""
WATCH_FLAG=""
PG_VER=""
DB_NAME=""
CURRENT_INSTALL_MODE=""
PG_READY_WAIT=""
NODE_GLOBAL_VAR_DIR=""
PG_DATA_ACTUAL=""
PG_CONF_ACTUAL=""
PG_DATA_SRC=""
WIN_SCRIPT_PATH=""
WIN_DRIVE=""
WIN_REST=""
GENERATED_ACCESS_CODE=""
OCTANE_RUNTIME_WATCH="0"
OCTANE_RUNTIME_POLL="0"

# Background systemd service options (idempotent registration via debian_service_manager).
# AS_SERVICE: yes|no|empty(ask). LARAVEL_SERVICE_RUN=1 marks the in-service run so it
# skips registration and runs the full setup + Octane in the foreground.
AS_SERVICE="${AS_SERVICE:-}"
LARAVEL_SERVICE_NAME="ncore-laravel-main"
LARAVEL_SERVICE_DESC="laravel_main backend (Octane)"
LARAVEL_SERVICE_CPU="${LARAVEL_SERVICE_CPU:-100%}"
LARAVEL_SERVICE_MEM="${LARAVEL_SERVICE_MEM:-}"
LARAVEL_SERVICE_MEM_CAP_MB="${LARAVEL_SERVICE_MEM_CAP_MB:-2048}"
SERVICE_MANAGER="${COMMON_DIR}/debian_service_manager.sh"
SELF="${SCRIPT_CURRENT_DIR}/175_laravel_main_start.sh"
SERVICE_EXEC_CMD=""
ARG=""
HELP_REQUESTED="no"
SHOW_SUPER_CODE="no"
STORED_SUPER_CODE=""

# Domain/SSL/nginx phases. RUNTIME_START: no skips the foreground server and the
# service-registration prompt (the old 132/133 behaviour). DOMAIN_SCOPE:
# all = certificates + nginx sites, certs = certificates only, none = skip.
RUNTIME_START="yes"
DOMAIN_SCOPE="all"
SKIP_SSH="no"

# Optional: also bring the nexus-dash UI up as its own background service when this
# service is registered (idempotent; the UI script owns its own systemd registration).
INCLUDE_UI="${INCLUDE_UI:-}"
UI_START="${POLY_APPS_DIR}/pycore_laravel_wordnew_ui/scripts/start.sh"

. "$LARAVEL_13_UPGRADE_SCRIPT"
# domain_setup_common pulls in the canonical file_ops_common.sh writer
# (write_file_if_changed + lazy_sudo); source it before cert_selfheal_common.
. "$DOMAIN_SETUP_COMMON"
. "$COMPOSER_VENDOR_COMMON"
. "$CERT_SELFHEAL_COMMON"

# Runtime port: central service contract (config/service_contract.json), with
# the PORT env var as the explicit override.
PORT="${PORT:-$(sc_get ports.laravel_api_backend)}"

cleanup_runtime() {
    local shown_code="$GENERATED_ACCESS_CODE"
    local stored_code=""
    cd "$ORIGINAL_DIR" || true
    echo ""
    echo "Restored to initial directory: $ORIGINAL_DIR"
    echo ""
    # The code lives in the external runtime store (PathMapper
    # laravel_data_dir); show the STORED value when resolvable - it wins over
    # this run's candidate once provisioned (the code is stable across runs).
    if [ -n "$PHP_BIN" ]; then
        stored_code="$(runtime_config_get "INSTALLATION_ACCESS_CODE" 2>/dev/null || true)"
        [ -n "$stored_code" ] && shown_code="$stored_code"
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
    echo "  --domains-only      Run prerequisites + domain/SSL/nginx setup, no runtime start."
    echo "  --ssl-only          Run prerequisites + SSL certificates only, no runtime start."
    echo "  --no-domains        Skip the domain/SSL/nginx phases entirely."
    echo "  --skip-ssh          Skip the SSH server ensure phase."
}

# The code lives in the external runtime store (RuntimeConfigurationStore,
# rooted at the PathMapper laravel_data_dir outside the repository);
# InstallationAccessCode.php only reads it and is never regenerated.
read_stored_super_code() {
    local stored_code=""
    if ! resolve_php; then
        echo "ERROR: php not found; cannot read the runtime configuration store." >&2
        return 1
    fi
    stored_code="$(runtime_config_get "INSTALLATION_ACCESS_CODE" 2>/dev/null || true)"
    if [ -z "$stored_code" ]; then
        echo "ERROR: Installation access code not provisioned yet; run the full start once." >&2
        return 1
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
    exit 0
fi

# Restore initial directory on any exit (normal, error, Ctrl+C)
trap cleanup_runtime EXIT

# --- Functions ---

new_installation_access_code() {
    local segment_one segment_two segment_three segment_four
    segment_one="$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n' | tr '[:lower:]' '[:upper:]')"
    segment_two="$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n' | tr '[:lower:]' '[:upper:]')"
    segment_three="$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n' | tr '[:lower:]' '[:upper:]')"
    segment_four="$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n' | tr '[:lower:]' '[:upper:]')"
    printf 'NEXU-%s-%s-%s-%s' "$segment_one" "$segment_two" "$segment_three" "$segment_four"
}

# Resolve php into PHP_BIN: PATH -> known bin locations.
resolve_php() {
    PHP_BIN=""
    if command -v php >/dev/null 2>&1; then
        PHP_BIN="$(command -v php)"
        return 0
    fi
    for PHP_CANDIDATE in "/usr/local/bin/php" "/usr/bin/php" "$HOME/.local/bin/php"; do
        if [ -x "$PHP_CANDIDATE" ]; then
            PHP_BIN="$PHP_CANDIDATE"
            return 0
        fi
    done
    return 1
}

# Resolve composer into COMPOSER_CMD: PATH -> local phar (via php) -> known locations.
resolve_composer() {
    COMPOSER_CMD=""
    if command -v composer >/dev/null 2>&1; then
        COMPOSER_CMD="$(command -v composer)"
        return 0
    fi
    if [ -n "$PHP_BIN" ] && [ -f "${LARAVEL_DIR}/composer.phar" ]; then
        COMPOSER_CMD="${PHP_BIN} ${LARAVEL_DIR}/composer.phar"
        return 0
    fi
    if [ -n "$PHP_BIN" ] && [ -f "${REPO_ROOT}/composer.phar" ]; then
        COMPOSER_CMD="${PHP_BIN} ${REPO_ROOT}/composer.phar"
        return 0
    fi
    for COMPOSER_CANDIDATE in \
        "$HOME/.config/composer/vendor/bin/composer" \
        "$HOME/.composer/vendor/bin/composer" \
        "/usr/local/bin/composer" \
        "/usr/bin/composer"; do
        if [ -x "$COMPOSER_CANDIDATE" ]; then
            COMPOSER_CMD="$COMPOSER_CANDIDATE"
            return 0
        fi
    done
    return 1
}

# Shared RuntimeConfigurationStore adapter (was duplicated here; the common
# implementation is the single source - callers provide PHP_BIN,
# VENDOR_AUTOLOAD, BOOTSTRAP_APP which are declared at the top of this file).
# shellcheck source=/dev/null
source "$RUNTIME_CONFIG_COMMON"

ensure_runtime_config_value() {
    local key="$1"
    local value="$2"
    local current=""

    current="$(runtime_config_get "$key")"
    if [ -n "$current" ]; then
        return 0
    fi

    runtime_config_put "$key" "$value"
}

initialize_runtime_configuration_store() {
    local generated_value=""

    RUNTIME_CONFIG_DIR="$(runtime_config_directory)"
    if [ -z "$RUNTIME_CONFIG_DIR" ]; then
        echo "ERROR: Runtime configuration store directory could not be resolved."
        return 1
    fi

    generated_value="$($PHP_BIN -r 'echo "base64:".base64_encode(random_bytes(32));')"
    ensure_runtime_config_value "APP_KEY" "$generated_value" || return 1
    # Mercure hub keys (HS256 secrets, server-side only - never shipped to
    # pycore, the browser UI or the extension; the runtime injects them as
    # process env for Caddy's {env...} references; the trusted issuer is
    # derived per launch by the runtime branch). Provisioned once.
    generated_value="$($PHP_BIN -r 'echo base64_encode(random_bytes(48));')"
    ensure_runtime_config_value "MERCURE_PUBLISHER_JWT" "$generated_value" || return 1
    generated_value="$($PHP_BIN -r 'echo base64_encode(random_bytes(48));')"
    ensure_runtime_config_value "MERCURE_SUBSCRIBER_JWT" "$generated_value" || return 1
    # Installation access (super) code: provisioned once into the external
    # store, stable across runs; InstallationAccessCode.php only reads it.
    ensure_runtime_config_value "INSTALLATION_ACCESS_CODE" "$GENERATED_ACCESS_CODE" || return 1

    echo "Runtime configuration store ready: $RUNTIME_CONFIG_DIR"
}

# Resolve npx into NPX_BIN (needed by composer dev / dev:win).
resolve_npx() {
    NPX_BIN=""
    # Drop any stale command hash so a freshly-installed npx is seen this shell.
    hash -r 2>/dev/null || true
    if command -v npx >/dev/null 2>&1; then
        NPX_BIN="$(command -v npx)"
        return 0
    fi
    # 17_install_node_24.sh symlinks into /usr/local/bin; also probe nvm-style dirs.
    for NPX_CANDIDATE in "/usr/local/bin/npx" "/usr/bin/npx" "$HOME/.local/bin/npx"; do
        if [ -x "$NPX_CANDIDATE" ]; then
            NPX_BIN="$NPX_CANDIDATE"
            return 0
        fi
    done
    return 1
}

# True when the local PostgreSQL server is accepting connections.
pg_is_ready() {
    command -v pg_isready >/dev/null 2>&1 && pg_isready -q >/dev/null 2>&1
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
    case "${PORT_CONFLICT_AUTO_STOP:-}" in [Yy]*) return 0 ;; [Nn]*) return 1 ;; esac
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '%s [y/N] ' "$msg" > /dev/tty
        read -r reply < /dev/tty || reply=""
    fi
    case "$reply" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# If a Docker container PUBLISHES <port> (e.g. MinIO on :9000, pgvector on :5432),
# it surfaces as a docker-proxy holder we must NOT kill directly. Identify the
# owning container and offer to stop it (default Yes). Returns 0 if one was stopped.
# Detection/stop primitives come from the shared port guard (port_guard_common.sh).
stop_docker_publisher() {
    local port="$1" row="" cid="" cname=""
    row=$(pg_docker_publisher_container "$port")
    [ -n "$row" ] || return 1
    cid=$(printf '%s' "$row" | awk '{print $1}')
    cname=$(printf '%s' "$row" | awk '{print $2}')
    echo "  Port ${port} is published by Docker container: ${cname:-$cid}"
    if prompt_default_no "  Stop container ${cname:-$cid} and disable its auto-startup to free port ${port}?"; then
        echo "  Stopping container ${cname:-$cid} ..."
        pg_docker_container_stop "$cid"
        echo "  Container ${cname:-$cid} stopped and auto-startup disabled."
        return 0
    fi
    echo "  Left container ${cname:-$cid} running; port ${port} still occupied."
    return 1
}

# Free the runtime PORT before starting (idempotent restart). Stops ONLY
# leftover app servers (octane/swoole/artisan serve) -- a non-app holder is
# reported, never killed.
ensure_port_free() {
    local port="$1"
    local php_bin="$2"
    local pids="" pid="" cmd=""

    "$php_bin" artisan octane:stop >/dev/null 2>&1 || true
    sleep 1

    if command -v ss >/dev/null 2>&1; then
        pids=$(ss -ltnpH 2>/dev/null | grep -E "[:.]${port}[[:space:]]" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
    fi
    if [ -z "$pids" ] && command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null | sort -u)
    fi
    if [ -z "$pids" ]; then
        return 0
    fi

    if stop_docker_publisher "$port"; then
        sleep 2
        if command -v ss >/dev/null 2>&1; then
            pids=$(ss -ltnpH 2>/dev/null | grep -E "[:.]${port}[[:space:]]" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
        fi
        if [ -z "$pids" ] && command -v lsof >/dev/null 2>&1; then
            pids=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null | sort -u)
        fi
        [ -z "$pids" ] && return 0
    fi

    for pid in $pids; do
        cmd=$(ps -p "$pid" -o args= 2>/dev/null)
        if echo "$cmd" | grep -qiE 'octane|swoole|artisan serve'; then
            echo "  Port ${port}: stopping stale app server PID ${pid}"
            kill "$pid" 2>/dev/null || ${USE_SUDO:-} kill "$pid" 2>/dev/null || true
        else
            echo "  *** Port ${port} held by non-app PID ${pid}: ${cmd}"
        fi
    done
    sleep 2

    if command -v ss >/dev/null 2>&1 && ss -ltnH 2>/dev/null | grep -qE "[:.]${port}[[:space:]]"; then
        echo "  *** ACTION REQUIRED: port ${port} still in use. Stop the holder, or start with another port: PORT=<other> bash $0"
        return 1
    fi
    return 0
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
    [ -z "$pids" ] && return 0
    for pid in $pids; do
        echo "  Stopping stale schedule:work PID ${pid}"
        kill "$pid" 2>/dev/null || ${USE_SUDO:-} kill "$pid" 2>/dev/null || true
    done
    sleep 1
}

# DEFAULT YES prompt on the controlling TTY; no TTY -> yes.
ask_default_yes() {
    local msg="$1" reply=""
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '%s [Y/n] ' "$msg" > /dev/tty
        read -r reply < /dev/tty || reply=""
    fi
    case "$reply" in [Nn]*) return 1 ;; *) return 0 ;; esac
}

# DEFAULT NO prompt on the controlling TTY; no TTY -> no.
ask_default_no() {
    local msg="$1" reply=""
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '%s [y/N] ' "$msg" > /dev/tty
        read -r reply < /dev/tty || reply=""
    fi
    case "$reply" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# Echo a systemd memory limit "<n>M" = min(total RAM / 4, cap_mb), floored at 128M.
compute_mem_limit() {
    local cap_mb="$1"
    local total_kb total_mb quarter
    total_kb=$(grep -m1 MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')
    [ -n "$total_kb" ] || total_kb=0
    total_mb=$(( total_kb / 1024 ))
    quarter=$(( total_mb / 4 ))
    [ "$quarter" -lt 128 ] && quarter=128
    if [ "$quarter" -gt "$cap_mb" ]; then echo "${cap_mb}M"; else echo "${quarter}M"; fi
}

# True (0) when this distro is running under WSL (any of the standard markers).
is_wsl() {
    grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null \
        || [ -n "${WSL_DISTRO_NAME:-}" ] || [ -n "${WSL_INTEROP:-}" ]
}

# True (0) when systemd is the active init (PID 1) and systemctl can actually operate.
systemd_available() {
    [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1
}

# Register (or refresh) the laravel_main systemd service via debian_service_manager.
register_laravel_service() {
    local exec_cmd="$1"
    if [ ! -f "$SERVICE_MANAGER" ]; then echo "ERROR: debian_service_manager not found: $SERVICE_MANAGER"; return 1; fi
    if [ "$(id -u)" -eq 0 ]; then
        (
            # shellcheck disable=SC1090
            source "$SERVICE_MANAGER"
            create_systemd_service "$LARAVEL_SERVICE_NAME" "$LARAVEL_SERVICE_DESC" "$exec_cmd" "$LARAVEL_DIR" "root" "always" "10s" "$LARAVEL_SERVICE_CPU" "$LARAVEL_SERVICE_MEM"
        ) || return 1
        systemctl enable "$LARAVEL_SERVICE_NAME" >/dev/null 2>&1 || true
        systemctl restart "$LARAVEL_SERVICE_NAME" || return 1
        systemctl status "$LARAVEL_SERVICE_NAME" --no-pager -l || true
        return 0
    fi
    if command -v sudo >/dev/null 2>&1; then
        sudo bash -c '
            source "$1"
            create_systemd_service "$2" "$3" "$4" "$5" root always 10s "$6" "$7"
            systemctl enable "$2" >/dev/null 2>&1 || true
            systemctl restart "$2"
            systemctl status "$2" --no-pager -l || true
        ' _ "$SERVICE_MANAGER" "$LARAVEL_SERVICE_NAME" "$LARAVEL_SERVICE_DESC" "$exec_cmd" "$LARAVEL_DIR" "$LARAVEL_SERVICE_CPU" "$LARAVEL_SERVICE_MEM"
        return $?
    fi
    echo "ERROR: Need root (or sudo) to register a systemd service. Re-run as root."
    return 1
}

# Ensure the SSH server exists (fine-grained idempotent: binary check first,
# installer 23_setup_ssh_remote.sh carries its own persistent completion flag).
ensure_ssh_server() {
    if [ "$SKIP_SSH" = "yes" ]; then
        return 0
    fi
    if command -v sshd >/dev/null 2>&1 || [ -x /usr/sbin/sshd ]; then
        echo "SSH server present."
        return 0
    fi
    if [ ! -f "$SSH_SETUP_SCRIPT" ]; then
        echo "  Warning: SSH setup script missing: $SSH_SETUP_SCRIPT"
        return 0
    fi
    if ask_default_yes "SSH server (sshd) not found. Install and configure remote SSH now?"; then
        bash "$SSH_SETUP_SCRIPT" || echo "  Warning: SSH setup reported failure (continuing)."
    else
        echo "  SSH installation skipped."
    fi
    return 0
}

# Ensure nginx with HTTP/3 + 301 + early-data support, driven by the shared
# management architecture (common/nginx_manager.sh). Fine-grained idempotent:
# missing -> canonical installer; outdated -> upgrade prompt (in-place, sites
# preserved); broken config -> repair prompt; healthy -> silent repair sweep
# plus the per-file HTTP/3 stanza migration.
ensure_nginx_stack() {
    local current_version=""

    # shellcheck source=/dev/null
    source "$NGINX_MANAGER_SCRIPT"

    # Edge-port guard (80/TCP, 443/TCP, 443/UDP for QUIC): stop foreign
    # occupiers (e.g. hysteria on UDP/443) and offer their uninstall (y/N,
    # default No) BEFORE any install/upgrade/repair below - every reload or
    # restart downstream can only take effect when nginx can actually bind.
    # Self-detecting: no-op when the ports are free; nginx's own sockets are
    # never touched.
    nm_edge_ports_ensure

    current_version=$(nginx_get_version)
    if [ -z "$current_version" ]; then
        echo "nginx not found. Setting START_WEB_SERVER=nginx and invoking the canonical installer:"
        echo "  $NGINX_INSTALL_SCRIPT"
        $USE_SUDO mkdir -p "$GLOBAL_VAR_DIR" 2>/dev/null || true
        printf 'nginx\n' | $USE_SUDO tee "$GLOBAL_VAR_DIR/START_WEB_SERVER" >/dev/null 2>&1 || true
        if [ -f "$NGINX_INSTALL_SCRIPT" ]; then
            bash "$NGINX_INSTALL_SCRIPT" || echo "  Warning: nginx installer reported failure (continuing)."
        else
            echo "  *** ACTION REQUIRED: nginx installer missing: $NGINX_INSTALL_SCRIPT"
        fi
        return 0
    fi

    echo "nginx present: nginx/$current_version (HTTP/3: $(nginx_has_http3 && echo yes || echo no))"

    # Binary/link unification is self-detecting (every alias check no-ops when
    # correct); run it every time so link drift (loops, dangling aliases) is
    # repaired on every start.
    nginx_unify_binaries || echo "  Warning: nginx binary unify reported issues (continuing)."

    if ! nginx_version_ge "$current_version" "$NGINX_MAINLINE_VERSION"; then
        echo "  nginx $current_version is older than the reference mainline $NGINX_MAINLINE_VERSION."
        if ask_default_yes "  Upgrade nginx to the official mainline build? Sites and certificates are preserved and repaired idempotently."; then
            nm_install_or_upgrade || echo "  Warning: nginx upgrade reported failure (continuing)."
            nm_http3_migrate || true
            nginx_repair_sites || echo "  Warning: post-upgrade repair reported issues (continuing)."
            return 0
        fi
    fi

    if ! $USE_SUDO nginx -t -c "$NGINX_MAIN_CONF" >/dev/null 2>&1; then
        echo "  nginx configuration test FAILED."
        if ask_default_yes "  Run the idempotent site repair now (quarantines broken managed sites, reloads on success)?"; then
            nginx_repair_sites || bash "$NGINX_INSTALL_SCRIPT" || echo "  Warning: nginx repair reported failure (continuing)."
        fi
    else
        # Healthy config: guarantee the main conf includes the mapped
        # sites-enabled (content-hash idempotent, no-op when current), an
        # explicit default_server exists (without one, the first site file
        # silently becomes the default and answers every unmatched host),
        # then the fine-grained repair sweep and the HTTP/3 stanza migration.
        nm_main_config
        nm_default_vhost
        nginx_repair_sites || echo "  Warning: site repair sweep reported issues (continuing)."
        nm_http3_migrate || echo "  Warning: HTTP/3 migration sweep reported issues (continuing)."
    fi

    # Service state ensure (fine-grained idempotent): a configured but
    # STOPPED nginx serves nothing - the repair/reload paths above never
    # start it ("service not active, reload skipped"). nm_service_state
    # self-gates on nginx -t and is effect-idempotent when already active
    # (systemctl enable/start on a running unit is a no-op).
    nm_service_state "start" || echo "  Warning: nginx service start reported issues (continuing)."
    nginx_serve_truth_report
    return 0
}

# Ensure certbot tooling when domain setup is in scope (27 self-skips without nginx).
# Ensure certbot tooling when domain setup is in scope. Detection is
# file-based and flavor-aware: /usr/local/bin/certbot must resolve INTO the
# pipx venv (35_install_certbot.sh owns that link). A stale real file (old
# system-pip/apt console script at the same path) passes a bare -x check but
# is NOT the managed install -> invoke the canonical installer to re-link.
ensure_certbot_stack() {
    local certbot_resolved=""
    certbot_resolved="$(readlink -f /usr/local/bin/certbot 2>/dev/null || true)"
    if [ -n "$certbot_resolved" ] && [ -x "$certbot_resolved" ]; then
        case "$certbot_resolved" in
            *"/venvs/certbot/bin/certbot")
                # The venv must also carry the WORKING DNSPod authenticator
                # (the zope-era dns-dnspod plugin cannot load on modern
                # certbot). Functional probe: plugins listing.
                if /usr/local/bin/certbot plugins 2>/dev/null | grep -q "certbot-dnspod"; then
                    echo "certbot present: $(/usr/local/bin/certbot --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
                    return 0
                fi
                echo "certbot venv lacks the working certbot-dnspod plugin. Re-provisioning via the canonical installer:"
                echo "  $CERTBOT_INSTALL_SCRIPT"
                if [ -f "$CERTBOT_INSTALL_SCRIPT" ]; then
                    bash "$CERTBOT_INSTALL_SCRIPT" || echo "  Warning: certbot installer reported failure (continuing)."
                fi
                return 0
                ;;
        esac
    fi
    if [ -e /usr/local/bin/certbot ]; then
        echo "certbot at /usr/local/bin/certbot is stale (not the pipx-isolated venv build). Re-linking via the canonical installer:"
    else
        echo "certbot not found. Invoking the canonical installer:"
    fi
    echo "  $CERTBOT_INSTALL_SCRIPT"
    if [ -f "$CERTBOT_INSTALL_SCRIPT" ]; then
        bash "$CERTBOT_INSTALL_SCRIPT" || echo "  Warning: certbot installer reported failure (continuing)."
    else
        echo "  Warning: certbot installer missing: $CERTBOT_INSTALL_SCRIPT"
    fi
    return 0
}

# Domain install from decrypted DNSPod secrets: api.<region>.<domain> nginx
# sites (HTTP/3 + 301) plus idempotent certificate issuance. The region prefix
# is stored in the global-var store; re-runs only ask whether to modify it.
run_domain_setup_phase() {
    if [ ! -d "$SECRETS_DIR" ]; then
        echo "Domain setup skipped: secrets not decrypted ($SECRETS_DIR missing; run dd.sh first)."
        return 0
    fi
    if [ "$(id -u)" -ne 0 ] && ! sudo -n true 2>/dev/null; then
        echo "Domain setup needs root privileges; re-run when convenient:"
        echo "  sudo bash $SELF --domains-only"
        return 0
    fi
    # shellcheck source=/dev/null
    # (domain_setup_common already sourced at file top; it provides the
    # canonical file_ops_common.sh writer)
    if [ "$DOMAIN_SCOPE" = "certs" ]; then
        domain_setup_certificates_only "$LARAVEL_DIR" || echo "  Warning: certificate phase reported issues (continuing)."
    else
        domain_setup_install_all "http://127.0.0.1:$PORT" "$LARAVEL_DIR" || echo "  Warning: domain phase reported issues (continuing)."
    fi
    # Certificate self-heal (independent fine-grained steps): deploy hooks that
    # reload nginx only after an actual renewal, the twice-daily renewal timer,
    # and a startup renewal pass (certbot renews only near-expiry certificates;
    # the artisan end reconciles stale renewal configs first).
    cert_selfheal_run_once "$LARAVEL_DIR" || echo "  Warning: certificate self-heal reported issues (continuing)."
    # Detail: what is actually serving now (binary, master, includes, sites).
    nginx_serve_truth_report
    return 0
}

# --show-super-code runs HERE: it needs resolve_php + runtime_config_get,
# which are defined in the function section above. Cleanup trap is skipped
# for this read-only query.
if [ "$SHOW_SUPER_CODE" = "yes" ]; then
    trap - EXIT
    if read_stored_super_code; then
        echo "Super code: $STORED_SUPER_CODE"
        exit 0
    fi
    exit 1
fi

# Fail loud on an unreadable service contract: an empty PORT would start
# Octane on its default and render the domain backend as "http://127.0.0.1:".
if [ -z "$PORT" ]; then
    echo "ERROR: service contract unreadable (ports.laravel_api_backend empty; check config/service_contract.json and common/service_contract_common.sh)." >&2
    exit 1
fi

echo "Initial directory (invocation): $ORIGINAL_DIR"
echo "Working directory (Laravel root): $LARAVEL_DIR"
echo "Repo root (dynamic): $REPO_ROOT"
echo ""

cd "$LARAVEL_DIR" || exit 1

# --- Ensure php (auto-install via init-ensure script if missing) ---
# Candidate access code for THIS provisioning run; persisted into the
# external runtime store by initialize_runtime_configuration_store (only
# when the store has none - the code is stable across runs, and the
# InstallationAccessCode.php repository file is never rewritten).
GENERATED_ACCESS_CODE="$(new_installation_access_code)"

if ! resolve_php; then
    echo "php not found. Invoking init-ensure installer:"
    echo "  $PHP_ENSURE_SCRIPT"
    if [ -f "$PHP_ENSURE_SCRIPT" ]; then
        bash "$PHP_ENSURE_SCRIPT"
        if [ $? -ne 0 ]; then
            echo "ERROR: PHP init-ensure installer failed ($PHP_ENSURE_SCRIPT)"
            exit 1
        fi
        if ! resolve_php; then
            echo "ERROR: php still not found after running $PHP_ENSURE_SCRIPT"
            exit 1
        fi
    else
        echo "ERROR: php not found and installer missing: $PHP_ENSURE_SCRIPT"
        echo "  Manual (Debian/Ubuntu/WSL): sudo apt update && sudo apt install -y php-cli php-xml php-mbstring php-sqlite3"
        exit 1
    fi
fi

# --- Ensure composer (auto-install via init-ensure script if missing) ---
if ! resolve_composer; then
    echo "composer not found. Invoking init-ensure installer:"
    echo "  $COMPOSER_INSTALL_SCRIPT"
    if [ -f "$COMPOSER_INSTALL_SCRIPT" ]; then
        bash "$COMPOSER_INSTALL_SCRIPT"
        if [ $? -ne 0 ]; then
            echo "ERROR: Composer init-ensure installer failed ($COMPOSER_INSTALL_SCRIPT)"
            exit 1
        fi
        if ! resolve_composer; then
            echo "ERROR: composer still not found after running $COMPOSER_INSTALL_SCRIPT"
            exit 1
        fi
    else
        echo "ERROR: composer not found and installer missing: $COMPOSER_INSTALL_SCRIPT"
        echo "  Manual (Debian/Ubuntu/WSL): sudo apt update && sudo apt install -y composer"
        exit 1
    fi
fi

echo "Using php:      $PHP_BIN"
echo "Using composer: $COMPOSER_CMD"

# --- Ensure the SSH server (idempotent; skipped with --skip-ssh) ---
ensure_ssh_server

# --- Best-effort: ensure unzip (composer warns and is slower without it) ---
if ! command -v unzip >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
        echo "unzip not found; installing (best-effort)..."
        apt-get update -y >/dev/null 2>&1 || true
        apt-get install -y unzip >/dev/null 2>&1 || echo "  Warning: unzip install failed (continuing; composer will use PHP zip)."
    fi
fi

# --- Ensure Laravel runtime directories exist and are writable ---
echo "Ensuring Laravel runtime directories..."
for RUNTIME_DIR in "${LARAVEL_RUNTIME_DIRS[@]}"; do
    mkdir -p "${LARAVEL_DIR}/${RUNTIME_DIR}"
done
chmod -R u+rwX,g+rwX "${LARAVEL_DIR}/bootstrap/cache" "${LARAVEL_DIR}/storage" 2>/dev/null || true

if ! upgrade_laravel_to_13; then
    exit 1
fi

# Ensure vendor/ matches composer.lock AND the autoloader actually loads before
# any artisan command (file existence alone does not prove vendor integrity).
ensure_composer_vendor "$LARAVEL_DIR"
if [ "$COMPOSER_VENDOR_AUTOLOAD_OK" != "yes" ]; then
    echo "ERROR: composer vendor setup failed"
    exit 1
fi

# Initialize the canonical runtime store before any Artisan command.
if ! initialize_runtime_configuration_store; then
    echo "ERROR: Runtime configuration store initialization failed."
    exit 1
fi

# --- Ensure the PHP pdo_pgsql extension (the app uses PostgreSQL on Linux) ---
if "$PHP_BIN" -m 2>/dev/null | grep -qi '^pdo_pgsql$'; then
    echo "PHP pdo_pgsql extension present."
else
    echo "PHP pdo_pgsql missing. Invoking init-ensure installer:"
    echo "  $PHP_PGSQL_ENSURE_SCRIPT"
    if [ -f "$PHP_PGSQL_ENSURE_SCRIPT" ]; then
        bash "$PHP_PGSQL_ENSURE_SCRIPT" || echo "  Warning: pdo_pgsql installer reported failure."
        if "$PHP_BIN" -m 2>/dev/null | grep -qi '^pdo_pgsql$'; then
            echo "pdo_pgsql installed -> PostgreSQL driver available."
        else
            echo "  *** ACTION REQUIRED: pdo_pgsql still missing -> all DB access will fail."
            echo "  *** Build manually: bash $PHP_PGSQL_ENSURE_SCRIPT"
        fi
    else
        echo "  Warning: pdo_pgsql installer missing: $PHP_PGSQL_ENSURE_SCRIPT"
    fi
fi

# --- PostgreSQL cross-environment sync adapter ---
_PG_SYNC_ADAPTER="${REPO_ROOT}/pycore/pyfoundations/pg_sync_adapter.py"
if command -v python3 >/dev/null 2>&1 && [ -f "$_PG_SYNC_ADAPTER" ]; then
    python3 "$_PG_SYNC_ADAPTER" --startup || true
fi
unset _PG_SYNC_ADAPTER

# --- Database: PostgreSQL (forced on Linux), localhost-only, one DB per app ---
echo "Ensuring PostgreSQL (localhost-only, per-app databases)..."

# Resolve sudo locally. We deliberately do NOT source gvar_common.sh here: sourcing
# it triggers heavy top-level side effects (writing /etc/environment, scanning all
# disks via blkid/findmnt, sudo mkdir) and can HANG on a sudo password prompt on
# every app start. The canonical 75_install_postgresql.sh sources it itself.
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# dd.sh priority: force START_POSTGRESQL=true; only raise INSTALL_MODE to 'server'
# when unset/base so an explicit dd.sh choice (server/full/desktop) is preserved.
$USE_SUDO mkdir -p "$GLOBAL_VAR_DIR" 2>/dev/null || true
printf 'true\n' | $USE_SUDO tee "$GLOBAL_VAR_DIR/START_POSTGRESQL" >/dev/null 2>&1 || true
CURRENT_INSTALL_MODE=""
if [ -f "$GLOBAL_VAR_DIR/INSTALL_MODE" ]; then
    CURRENT_INSTALL_MODE="$(tr -d '[:space:]' < "$GLOBAL_VAR_DIR/INSTALL_MODE" 2>/dev/null || echo "")"
fi
if [ -z "$CURRENT_INSTALL_MODE" ] || [ "$CURRENT_INSTALL_MODE" = "base" ]; then
    printf 'server\n' | $USE_SUDO tee "$GLOBAL_VAR_DIR/INSTALL_MODE" >/dev/null 2>&1 || true
fi

# ALWAYS invoke the canonical PostgreSQL ensurer (fully idempotent: install +
# mount-fix + data-dir reconcile every run).
if [ -f "$POSTGRES_INSTALL_SCRIPT" ]; then
    echo "  Running canonical PostgreSQL ensurer (idempotent: install + mount-fix + data-dir reconcile):"
    echo "    $POSTGRES_INSTALL_SCRIPT"
    bash "$POSTGRES_INSTALL_SCRIPT" || echo "  Warning: PostgreSQL ensurer reported a failure (continuing)."
else
    echo "  *** ACTION REQUIRED: PostgreSQL ensurer missing: $POSTGRES_INSTALL_SCRIPT"
    echo "  *** Install manually: sudo apt-get install -y postgresql postgresql-contrib"
fi

# Idempotent WSL-safe start: systemd -> sysv service -> Debian cluster tool.
if ! pg_is_ready; then
    echo "  PostgreSQL not accepting connections yet; attempting to start..."
    PG_VER="$(ls -1 /etc/postgresql 2>/dev/null | sed -n '/^[0-9]\+$/p' | sort -n | tail -1)"
    ${USE_SUDO:-} systemctl start postgresql 2>/dev/null \
        || ${USE_SUDO:-} service postgresql start 2>/dev/null \
        || { [ -n "$PG_VER" ] && ${USE_SUDO:-} pg_ctlcluster "$PG_VER" main start 2>/dev/null; } \
        || true
    for PG_READY_WAIT in 1 2 3 4 5 6 7 8 9 10; do
        if pg_is_ready; then break; fi
        sleep 1
    done
fi

# Create each per-app database if missing (idempotent; peer auth as postgres).
if command -v psql >/dev/null 2>&1 && pg_is_ready; then
    for DB_NAME in $APP_DB_NAMES; do
        if pg_run_as_postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1; then
            : # already exists
        else
            echo "  Creating database: ${DB_NAME}"
            pg_run_as_postgres createdb "${DB_NAME}" 2>/dev/null || echo "    Warning: failed to create ${DB_NAME}"
        fi
    done
    echo "  Per-app PostgreSQL databases ensured."

    PG_DATA_ACTUAL="$(pg_run_as_postgres psql -tAc 'SHOW data_directory;' 2>/dev/null | tr -d '[:space:]')"
    PG_CONF_ACTUAL="$(pg_run_as_postgres psql -tAc 'SHOW config_file;' 2>/dev/null | tr -d '[:space:]')"
    echo "  PostgreSQL data directory (actual): ${PG_DATA_ACTUAL:-unknown}"
    echo "  PostgreSQL config file: ${PG_CONF_ACTUAL:-unknown}"
    if [ -n "$PG_DATA_ACTUAL" ]; then
        PG_DATA_SRC="$(df --output=source "$PG_DATA_ACTUAL" 2>/dev/null | tail -1 | tr -d '[:space:]')"
        case "$PG_DATA_SRC" in
            /dev/loop*)
                echo "  Persistence mapping: ON D-drive image via ${PG_DATA_SRC} (pg_mount mapping ACTIVE -> survives WSL reset)" ;;
            "")
                echo "  Persistence mapping: unknown (could not resolve backing device of ${PG_DATA_ACTUAL})" ;;
            *)
                echo "  Persistence mapping: native ext4 (${PG_DATA_SRC}); D-drive image NOT active (existing native cluster kept; recreate to move to D)" ;;
        esac
    fi
else
    echo "  PostgreSQL data directory (actual): unknown (server not reachable)"
    echo "  *** ACTION REQUIRED: PostgreSQL not reachable; per-app databases NOT created."
    echo "  *** Start it (sudo service postgresql start) then re-run; migrations will fail until then."
fi

echo "Clearing route cache..."
"$PHP_BIN" artisan route:clear

echo "Listing routes..."
"$PHP_BIN" artisan route:list

# Runtime credentials must never be serialized into Laravel's configuration cache.
"$PHP_BIN" artisan config:clear >/dev/null 2>&1 || true

# --- Ensure Swoole (Octane is the PREFERRED task-system tick source on Linux/WSL) ---
if "$PHP_BIN" -m 2>/dev/null | grep -qi '^swoole$'; then
    OCTANE_AVAILABLE=1
    echo "Swoole extension present -> Octane runtime available."
else
    echo "Swoole extension not loaded. Invoking init-ensure installer:"
    echo "  $SWOOLE_INSTALL_SCRIPT"
    if [ -f "$SWOOLE_INSTALL_SCRIPT" ]; then
        bash "$SWOOLE_INSTALL_SCRIPT" || echo "  Warning: Swoole installer reported failure (will fall back)."
        if "$PHP_BIN" -m 2>/dev/null | grep -qi '^swoole$'; then
            OCTANE_AVAILABLE=1
            echo "Swoole installed -> Octane runtime available."
        else
            OCTANE_AVAILABLE=""
            echo "  Warning: Swoole still not loaded after installer; using non-Octane fallback."
        fi
    else
        echo "  Warning: Swoole installer missing: $SWOOLE_INSTALL_SCRIPT"
        echo "  Manual (Debian/Ubuntu/WSL): bash $SWOOLE_INSTALL_SCRIPT"
    fi
fi

# --- Ensure 7z (p7zip) for dictionary translation extraction ---
if command -v 7z >/dev/null 2>&1 || command -v 7za >/dev/null 2>&1 || command -v 7zr >/dev/null 2>&1; then
    echo "7z present -> dictionary translations can be extracted."
else
    echo "7z not found. Invoking init-ensure installer:"
    echo "  $P7ZIP_INSTALL_SCRIPT"
    if [ -f "$P7ZIP_INSTALL_SCRIPT" ]; then
        bash "$P7ZIP_INSTALL_SCRIPT" || echo "  Warning: p7zip installer reported failure."
        if command -v 7z >/dev/null 2>&1 || command -v 7za >/dev/null 2>&1 || command -v 7zr >/dev/null 2>&1; then
            echo "p7zip installed -> 7z available."
        else
            echo "  *** ACTION REQUIRED: 7z still missing -> dictionary translations will NOT import."
            echo "  *** Manual (Debian/Ubuntu/WSL): sudo apt-get install -y p7zip-full"
        fi
    else
        echo "  Warning: p7zip installer missing: $P7ZIP_INSTALL_SCRIPT"
        echo "  *** ACTION REQUIRED: install 7z manually: sudo apt-get install -y p7zip-full"
    fi
fi

# --- Ensure Node.js BEFORE sys:init (hot-reload dependency) ---
if ! node --version >/dev/null 2>&1; then
    if [ -f "$NODE_INSTALL_SCRIPT" ]; then
        NODE_GLOBAL_VAR_DIR="$GLOBAL_VAR_DIR"
        ${USE_SUDO:-} mkdir -p "$NODE_GLOBAL_VAR_DIR" 2>/dev/null || true
        printf 'true\n' | ${USE_SUDO:-} tee "$NODE_GLOBAL_VAR_DIR/INSTALL_NODE" >/dev/null 2>&1 || true
        echo "node not found/working. Invoking init-ensure installer (INSTALL_NODE=true):"
        echo "  $NODE_INSTALL_SCRIPT"
        bash "$NODE_INSTALL_SCRIPT" || echo "  Warning: node init-ensure installer failed (continuing)."
        hash -r 2>/dev/null || true
    else
        echo "  Warning: node installer missing: $NODE_INSTALL_SCRIPT"
    fi
fi
resolve_npx || true
if node --version >/dev/null 2>&1; then
    echo "node present -> Octane hot-reload chokidar can be enabled."
else
    echo "  *** node still unavailable -> Octane runs without --watch hot reload."
    echo "  *** Install manually: INSTALL_NODE=true bash $NODE_INSTALL_SCRIPT"
fi

# Ensure the mapped web data dir is owned by the invoking user BEFORE sys:init.
REAL_USER="${SUDO_USER:-$(id -un)}"
LARAVEL_DATA_DIR="$(cd "$LARAVEL_DIR" && "$PHP_BIN" -r 'require "vendor/autoload.php"; require "bootstrap/app.php"; echo \App\Providers\PathMapper::mapWebPath("laravel_data_dir");' 2>/dev/null)"
if [ -n "$REAL_USER" ] && [ "$REAL_USER" != "root" ] && [ -n "$LARAVEL_DATA_DIR" ] && [ -d "$LARAVEL_DATA_DIR" ]; then
    echo "Ensuring ownership of web data dir for '$REAL_USER': $LARAVEL_DATA_DIR"
    $USE_SUDO chown -R "$REAL_USER:$REAL_USER" "$LARAVEL_DATA_DIR" 2>/dev/null || true
fi

echo "Initializing system (php artisan sys:init)..."
if ! "$PHP_BIN" artisan sys:init; then
    echo "ERROR: sys:init failed; Laravel runtime startup stopped."
    exit 1
fi

# --- nginx / certbot / domain phases (merged 132_prepare_domain_setup +
# 133_setup_domain_ssl): idempotent, prompt-driven repair and upgrade ---
if [ "$DOMAIN_SCOPE" != "none" ]; then
    echo ""
    echo "Ensuring nginx (HTTP/3 + 301 + early data, idempotent repair/upgrade)..."
    ensure_nginx_stack
    echo "Ensuring certbot tooling..."
    ensure_certbot_stack
    echo "Installing domains from decrypted DNSPod secrets (api.<region>.<domain>)..."
    run_domain_setup_phase
fi

if [ "$RUNTIME_START" != "yes" ]; then
    echo ""
    echo "Setup-only mode complete (runtime start skipped: --domains-only/--ssl-only)."
    exit 0
fi

echo "Detecting local IPs (excluding loopback)..."

if command -v ip >/dev/null 2>&1; then
    IP_LIST=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -vE '^127\.|^0\.')
elif command -v ifconfig >/dev/null 2>&1; then
    IP_LIST=$(ifconfig | grep -E 'inet [0-9]' | grep -v 127.0.0.1 | awk '{print $2}' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$')
else
    IP_LIST=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -vE '^127\.|^0\.|^$' || echo "Unable to detect IP")
fi

echo "Accessible URLs (ready to copy):"
if [ -n "$IP_LIST" ]; then
    for IP in $IP_LIST; do
        echo "  http://$IP:$PORT"
    done
else
    echo "  http://localhost:$PORT (fallback)"
fi

echo "Starting Laravel development environment with hot reload..."
echo "Note: Running in headless API mode - web.php serves only API debug interface"
echo "Press Ctrl+C to stop all services"

# --- WSL2 reachability hint (Tailscale / external LAN access to :PORT) ---
if is_wsl; then
    WIN_SCRIPT_PATH=""
    case "$LARAVEL_SCRIPTS_DIR" in
        /mnt/[a-z]/*)
            WIN_DRIVE="$(printf '%s' "$LARAVEL_SCRIPTS_DIR" | sed -E 's#^/mnt/([a-z])/.*#\1#' | tr '[:lower:]' '[:upper:]')"
            WIN_REST="$(printf '%s' "$LARAVEL_SCRIPTS_DIR" | sed -E 's#^/mnt/[a-z]/##; s#/#\\#g')"
            WIN_SCRIPT_PATH="${WIN_DRIVE}:\\${WIN_REST}\\wsl_port_forward.ps1"
            ;;
        *)
            WIN_SCRIPT_PATH="\\\\wsl\$\\${WSL_DISTRO_NAME:-<distro>}$(printf '%s' "$LARAVEL_SCRIPTS_DIR" | sed 's#/#\\#g')\\wsl_port_forward.ps1"
            ;;
    esac
    echo ""
    echo "WSL detected. To reach http://...:${PORT} from ANOTHER Tailscale/LAN device"
    echo "    (not just this host's localhost), the Windows host needs a port-forward."
    echo "    If you launched this via start.ps1, it is set up AUTOMATICALLY -- nothing"
    echo "    to do. If you started this script directly, run ONCE on the WINDOWS host in"
    echo "    an ELEVATED (Administrator) PowerShell:"
    echo "        powershell -ExecutionPolicy Bypass -File \"${WIN_SCRIPT_PATH}\" -Port ${PORT}"
    echo "    Re-run it after every 'wsl --shutdown' / reboot (the WSL IP changes)."
    echo "    Then use this host's Tailscale IP: http://<host-tailscale-ip>:${PORT}"
    echo ""
fi

# --- Ensure node/npx (composer dev / dev:win use 'npx concurrently') ---
if ! resolve_npx; then
    if [ -f "$NODE_INSTALL_SCRIPT" ]; then
        echo "npx not found. Invoking init-ensure installer:"
        echo "  $NODE_INSTALL_SCRIPT"
        bash "$NODE_INSTALL_SCRIPT" || echo "  Warning: node init-ensure installer failed (continuing)."
        resolve_npx || true
    fi
fi

# --- Ensure the runtime port is free (idempotent restart) ---
echo "Ensuring port ${PORT} is free..."
ensure_port_free "$PORT" "$PHP_BIN" || echo "  Continuing; the runtime may fail to bind if the port is truly occupied."

# schedule:work binds no port -- its own idempotent cleanup (single tick source).
ensure_schedule_work_stopped

# --- Optional background service registration (AFTER the full prerequisite setup) ---
if [ "${LARAVEL_SERVICE_RUN:-}" != "1" ]; then
    if [ "$AS_SERVICE" != "no" ] && ! systemd_available; then
        echo ""
        if is_wsl; then
            echo "Background systemd service unavailable: this WSL distro was not booted with systemd."
            echo "    (systemctl would fail with 'System has not been booted with systemd as init system'.)"
            echo "    To enable it (optional): add the following to /etc/wsl.conf, then run 'wsl --shutdown'"
            echo "    from Windows PowerShell and reopen the distro:"
            echo "        [boot]"
            echo "        systemd=true"
            echo "    For now, laravel_main will run in the FOREGROUND in this terminal (Ctrl+C to stop)."
        else
            echo "Background systemd service unavailable: systemd is not the active init (no /run/systemd/system)."
            echo "    Running under a non-systemd init/container -> laravel_main will run in the FOREGROUND (Ctrl+C to stop)."
        fi
        echo ""
        AS_SERVICE="no"
    fi
    if [ -z "$AS_SERVICE" ]; then
        if ask_default_yes "Prerequisites ready. Add laravel_main to a background systemd service (via debian_service_manager)?"; then
            AS_SERVICE="yes"
        else
            AS_SERVICE="no"
        fi
    fi
    if [ "$AS_SERVICE" = "yes" ]; then
        [ -n "$LARAVEL_SERVICE_MEM" ] || LARAVEL_SERVICE_MEM="$(compute_mem_limit "$LARAVEL_SERVICE_MEM_CAP_MB")"
        echo "Registering systemd service $LARAVEL_SERVICE_NAME (CPU=$LARAVEL_SERVICE_CPU, Memory=$LARAVEL_SERVICE_MEM, cap ${LARAVEL_SERVICE_MEM_CAP_MB}M)..."
        SERVICE_EXEC_CMD="LARAVEL_SERVICE_RUN=1 PORT=${PORT} bash ${SELF}"
        if register_laravel_service "$SERVICE_EXEC_CMD"; then
            echo "Service $LARAVEL_SERVICE_NAME registered and started."
            echo "  Manage:  systemctl {status|restart|stop} $LARAVEL_SERVICE_NAME"
            echo "  Boot:    systemctl is-enabled $LARAVEL_SERVICE_NAME"
            echo "  Logs:    journalctl -u $LARAVEL_SERVICE_NAME -f"

            # --- Optional: also bring the nexus-dash UI up as its own background service ---
            if [ -z "$INCLUDE_UI" ]; then
                if [ -f "$UI_START" ] && ask_default_no "Also add the pycore_laravel_wordnew_ui dashboard to a background service?"; then
                    INCLUDE_UI="yes"
                else
                    INCLUDE_UI="no"
                fi
            fi
            if [ "$INCLUDE_UI" = "yes" ]; then
                if [ -f "$UI_START" ]; then
                    echo "Bringing up pycore_laravel_wordnew_ui dashboard as a background service (idempotent)..."
                    bash "$UI_START" --no-backend --service || echo "  Warning: UI dashboard service registration failed (continuing)."
                    # Optional dashboard domain binding: apex + www.<domain> +
                    # www.<prefix>.<domain> reverse-proxy to the UI backend
                    # (certificates reused; each site is content-hash
                    # idempotent; the stored region prefix is reused).
                    if ask_default_yes "Bind <domain>, www.<domain> and www.<prefix>.<domain> to the dashboard at $(domain_ui_backend_url) (certificates reused)?"; then
                        domain_setup_enable_ui_binding || echo "  Warning: UI domain binding reported issues (continuing)."
                    fi
                else
                    echo "  Warning: UI start script not found: $UI_START (skipping)."
                fi
            fi

            exit 0
        else
            echo "Service registration failed; continuing in the foreground."
        fi
    fi
fi

# --- Start runtime ---
# Plane dispatch (web_server_plane, gvar_common.sh): frankenphp plane runs
# the single octane:frankenphp branch (HTTPS 443/h3 + Mercure hub); the
# nginx plane keeps the system-PHP Swoole branch on the loopback backend.
# FALLBACK (nginx plane, Swoole unavailable): node 'composer dev:win' or a
# node-free serve + queue:listen + schedule:work. In every mode
# OctaneTimerServiceProvider drives the SAME TimerTasks/* through a single,
# never duplicated tick source.
if [ "$(web_server_plane)" = "frankenphp" ] && [ -n "$OCTANE_AVAILABLE" ]; then
    # Site host = first configured api.<region>.<domain>; the Mercure trusted
    # issuer (token `iss`) mirrors the same value through the runtime branch.
    FRANKENPHP_SITE_HOST="localhost"
    if [ "$DOMAIN_SCOPE" != "none" ] && [ -n "${DOMAIN_API_PREFIX:-}" ] && [ -n "${DOMAIN_DOMAINS_LIST:-}" ]; then
        FRANKENPHP_FIRST_DOMAIN="$(printf '%s\n' "$DOMAIN_DOMAINS_LIST" | head -n1)"
        if [ -n "$FRANKENPHP_FIRST_DOMAIN" ]; then
            FRANKENPHP_SITE_HOST="api.${DOMAIN_API_PREFIX}.${FRANKENPHP_FIRST_DOMAIN}"
        fi
    fi
    echo "Starting headless API runtime (frankenphp plane -> octane:frankenphp on :$(sc_get ports.frankenphp_https) h2/h3, Mercure hub at https://${FRANKENPHP_SITE_HOST}/.well-known/mercure)"
    PORT="$PORT" PHP_BIN="$PHP_BIN" LARAVEL_DIR="$LARAVEL_DIR" \
        FRANKENPHP_SITE_HOST="$FRANKENPHP_SITE_HOST" \
        OCTANE_WATCH="$OCTANE_RUNTIME_WATCH" OCTANE_POLL="$OCTANE_RUNTIME_POLL" \
        /bin/bash "$LARAVEL_RUNTIME_FRANKENPHP_SCRIPT"
elif [ -n "$OCTANE_AVAILABLE" ]; then
    echo "Starting headless API runtime (nginx plane -> Octane swoole on server 0.0.0.0:${PORT}, single timer driver)"
    PORT="$PORT" PHP_BIN="$PHP_BIN" LARAVEL_DIR="$LARAVEL_DIR" \
        OCTANE_WATCH="$OCTANE_RUNTIME_WATCH" OCTANE_POLL="$OCTANE_RUNTIME_POLL" \
        /bin/bash "$LARAVEL_RUNTIME_NGINX_SCRIPT"
elif [ -n "$NPX_BIN" ]; then
    echo "WARNING: Swoole unavailable -> Octane HTTP server disabled, using node-based fallback."
    echo "Starting fallback (composer dev:win -> server 0.0.0.0:${PORT} + queue + timer)"
    $COMPOSER_CMD dev:win
else
    echo "WARNING: Swoole unavailable and no node -> using node-free fallback."
    echo "node-free fallback: php artisan serve + queue:listen + schedule:work (sub-minute timer tasks still run via Laravel Schedule)"
    "$PHP_BIN" artisan queue:listen --tries=1 --timeout=0 &
    "$PHP_BIN" artisan schedule:work &
    "$PHP_BIN" artisan serve --host=0.0.0.0 --port="$PORT"
fi
