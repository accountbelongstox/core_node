#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Cross-system Linux/Unix start script (WSL, Ubuntu desktop/server, headless, native
# Linux, /mnt drvfs, /home, /www). Windows use scripts/start.ps1.
# All paths are derived dynamically from this script's location (no hard-coded paths).
# Missing toolchain (php / composer / node) is auto-installed via the canonical
# init-ensure installers under scripts/shells/linux/debian/install_shells.
# All variables and file references are declared at the top of this file.

# --- All variables and file references (declared at top) ---
ORIGINAL_DIR=$(pwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
POLY_APPS_DIR="$(cd "${LARAVEL_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${POLY_APPS_DIR}/.." && pwd)"
PORT="${PORT:-9000}"

# Canonical init-ensure installer scripts (dynamic, derived from REPO_ROOT)
INSTALL_SHELLS_DIR="${REPO_ROOT}/scripts/shells/linux/debian/install_shells"
PHP_ENSURE_SCRIPT="${INSTALL_SHELLS_DIR}/31_ensure_php85_intelligent.sh"
COMPOSER_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/34_install_composer.sh"
NODE_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/15_install_node_24.sh"
SWOOLE_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/32_install_swoole.sh"
P7ZIP_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/43_install_p7zip.sh"
POSTGRES_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/46_install_postgresql.sh"
PHP_PGSQL_ENSURE_SCRIPT="${INSTALL_SHELLS_DIR}/47_ensure_php_pgsql.sh"
GVAR_COMMON_SCRIPT="${REPO_ROOT}/scripts/shells/linux/common/gvar_common.sh"
# Per-app PostgreSQL databases (one per app connection; mirrors config/database.php
# $polyConnection(... , pgDatabase) targets). Created idempotently before migrate.
APP_DB_NAMES="core_node_main app_qy_v1_database awy_v0_database vipclub_v1_database server_manager_v1_database achat_v1_database code_mart_v1_database mcp_v1_database it_tools_v1_database bank_v1_database"

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
WATCH_FS_TYPE=""
WATCH_IS_WSL=""
PG_VER=""
DB_NAME=""
CURRENT_INSTALL_MODE=""
PG_READY_WAIT=""
NODE_GLOBAL_VAR_DIR=""
PG_DATA_ACTUAL=""
PG_CONF_ACTUAL=""
PG_DATA_SRC=""
ENV_DRIVER_OVERRIDE=""
WIN_SCRIPT_PATH=""
WIN_DRIVE=""
WIN_REST=""

# Background systemd service options (idempotent registration via debian_service_manager).
# AS_SERVICE: yes|no|empty(ask). LARAVEL_SERVICE_RUN=1 marks the in-service run so it
# skips registration and runs the full setup + Octane in the foreground.
AS_SERVICE="${AS_SERVICE:-}"
LARAVEL_SERVICE_NAME="ncore-laravel-main"
LARAVEL_SERVICE_DESC="laravel_main backend (Octane)"
LARAVEL_SERVICE_CPU="${LARAVEL_SERVICE_CPU:-100%}"
LARAVEL_SERVICE_MEM="${LARAVEL_SERVICE_MEM:-}"
LARAVEL_SERVICE_MEM_CAP_MB="${LARAVEL_SERVICE_MEM_CAP_MB:-2048}"
SERVICE_MANAGER="${REPO_ROOT}/scripts/shells/linux/common/debian_service_manager.sh"
SELF="${SCRIPT_DIR}/start.sh"
SERVICE_EXEC_CMD=""
ARG=""

# Parse service-related arguments (the orchestrator passes these so it never re-prompts).
for ARG in "$@"; do
    case "$ARG" in
        --service) AS_SERVICE="yes" ;;
        --no-service) AS_SERVICE="no" ;;
    esac
done

# Restore initial directory on any exit (normal, error, Ctrl+C)
trap 'cd "$ORIGINAL_DIR" && echo "" && echo "Restored to initial directory: $ORIGINAL_DIR"' EXIT

# --- Functions ---

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

# Resolve npx into NPX_BIN (needed by composer dev / dev:win).
resolve_npx() {
    NPX_BIN=""
    # Drop any stale command hash so a freshly-installed npx is seen this shell.
    hash -r 2>/dev/null || true
    if command -v npx >/dev/null 2>&1; then
        NPX_BIN="$(command -v npx)"
        return 0
    fi
    # 15_install_node_24.sh symlinks into /usr/local/bin; also probe nvm-style dirs.
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

# Free the runtime PORT before starting (idempotent restart). Steps: (1) native
# graceful `octane:stop` for a previously-started Octane server; (2) detect any
# remaining listener on the port; (3) stop ONLY leftover app servers
# (octane/swoole/artisan serve) -- a non-app holder is reported, never killed.
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
stop_docker_publisher() {
    local port="$1" row="" cid="" cname=""
    command -v docker >/dev/null 2>&1 || return 1
    row=$(docker ps --filter "publish=${port}" --format '{{.ID}} {{.Names}}' 2>/dev/null | head -1)
    [ -n "$row" ] || row=$(${USE_SUDO:-} docker ps --filter "publish=${port}" --format '{{.ID}} {{.Names}}' 2>/dev/null | head -1)
    [ -n "$row" ] || return 1
    cid=$(printf '%s' "$row" | awk '{print $1}')
    cname=$(printf '%s' "$row" | awk '{print $2}')
    echo "  Port ${port} is published by Docker container: ${cname:-$cid}"
    if prompt_default_no "  Stop container ${cname:-$cid} and disable its auto-startup to free port ${port}?"; then
        echo "  Stopping container ${cname:-$cid} ..."
        docker stop "$cid" >/dev/null 2>&1 || ${USE_SUDO:-} docker stop "$cid" >/dev/null 2>&1 || true
        docker update --restart=no "$cid" >/dev/null 2>&1 || ${USE_SUDO:-} docker update --restart=no "$cid" >/dev/null 2>&1 || true
        echo "  Container ${cname:-$cid} stopped and auto-startup disabled."
        return 0
    fi
    echo "  Left container ${cname:-$cid} running; port ${port} still occupied."
    return 1
}

# Returns non-zero only when the port is still occupied by something we won't kill.
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

    # Docker-published holder -> stop the owning container (default Yes), then
    # re-detect any remaining native listeners.
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

# DEFAULT YES prompt on the controlling TTY; no TTY -> yes.
ask_default_yes() {
    local msg="$1" reply=""
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '%s [Y/n] ' "$msg" > /dev/tty
        read -r reply < /dev/tty || reply=""
    fi
    case "$reply" in [Nn]*) return 1 ;; *) return 0 ;; esac
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
# /run/systemd/system exists ONLY when systemd booted as PID 1; without it systemctl
# fails with "System has not been booted with systemd as init system" / "Failed to
# connect to bus" -- common on WSL distros not started with `systemd=true`, and in
# plain containers. We check this up front so we never leak those raw bus errors.
systemd_available() {
    [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1
}

# Register (or refresh) the laravel_main systemd service via debian_service_manager.
# Writes /etc/systemd/system -> needs root; falls back to sudo. The unit is composed
# by create_systemd_service (CPUQuota + MemoryMax/High + auto restart). The manager's
# top-level side effects (it sources gvar_common.sh) are isolated in a subshell.
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

echo "Initial directory (invocation): $ORIGINAL_DIR"
echo "Working directory (Laravel root): $LARAVEL_DIR"
echo "Repo root (dynamic): $REPO_ROOT"
echo ""

cd "$LARAVEL_DIR" || exit 1

# --- Ensure php (auto-install via init-ensure script if missing) ---
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

# --- Best-effort: ensure unzip (composer warns and is slower without it) ---
if ! command -v unzip >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
        echo "unzip not found; installing (best-effort)..."
        apt-get update -y >/dev/null 2>&1 || true
        apt-get install -y unzip >/dev/null 2>&1 || echo "  Warning: unzip install failed (continuing; composer will use PHP zip)."
    fi
fi

# --- Ensure Laravel runtime directories exist and are writable ---
# Root cause of 'bootstrap/cache directory must be present and writable':
# these dirs are not tracked by git. Create them BEFORE composer install so the
# post-autoload-dump 'artisan package:discover' succeeds on every system.
echo "Ensuring Laravel runtime directories..."
for RUNTIME_DIR in "${LARAVEL_RUNTIME_DIRS[@]}"; do
    mkdir -p "${LARAVEL_DIR}/${RUNTIME_DIR}"
done
chmod -R u+rwX,g+rwX "${LARAVEL_DIR}/bootstrap/cache" "${LARAVEL_DIR}/storage" 2>/dev/null || true

# --- Ensure .env exists (mirrors composer post-root-package-install) ---
if [ ! -f "${LARAVEL_DIR}/.env" ] && [ -f "${LARAVEL_DIR}/.env.example" ]; then
    echo "Creating .env from .env.example..."
    cp "${LARAVEL_DIR}/.env.example" "${LARAVEL_DIR}/.env"
fi

# Ensure vendor dependencies are installed before running any artisan command
if [ ! -d "vendor" ] || [ ! -f "vendor/autoload.php" ]; then
    echo "vendor/ not found. Running composer install..."
    $COMPOSER_CMD install
    if [ $? -ne 0 ]; then
        echo "ERROR: composer install failed"
        exit 1
    fi
    echo ""
fi

# --- Ensure APP_KEY (needs framework; run after composer install) ---
if [ -f "${LARAVEL_DIR}/.env" ] && ! grep -qE '^APP_KEY=base64:' "${LARAVEL_DIR}/.env"; then
    echo "Generating APP_KEY..."
    "$PHP_BIN" artisan key:generate --force --ansi || echo "  Warning: key:generate failed (continuing)."
fi

# --- Neutralize stale DB lines in .env (database config is code-only PG) ---
# config/database.php hardcodes pgsql for every active connection and reads
# NOTHING from .env (driver/host/port/user/database are code literals; the
# password comes from the CoreNodeSecrets store). Leftover POLY_DB_DRIVER /
# DB_* lines are inert but mislead readers and used to repoint the runtime in
# older revisions (the known /mnt/d SQLite DrvFs corruption source): comment
# them out idempotently so .env can never even APPEAR to own the database.
if [ -f "${LARAVEL_DIR}/.env" ]; then
    if grep -qE '^(POLY_DB_DRIVER|DB_CONNECTION|DB_HOST|DB_PORT|DB_DATABASE|DB_USERNAME|DB_PASSWORD|DB_URL)=' "${LARAVEL_DIR}/.env"; then
        echo "  *** .env contains DB override line(s) -> commenting out (database config is code-only PostgreSQL)."
        sed -i 's/^\(POLY_DB_DRIVER\|DB_CONNECTION\|DB_HOST\|DB_PORT\|DB_DATABASE\|DB_USERNAME\|DB_PASSWORD\|DB_URL\)=/# [disabled by start.sh: database config is code-only PostgreSQL, .env is ignored] \1=/' "${LARAVEL_DIR}/.env"
        "$PHP_BIN" artisan config:clear >/dev/null 2>&1 || true
    fi
fi

# --- Ensure the PHP pdo_pgsql extension (the app uses PostgreSQL on Linux) ---
# A source-built PHP may lack pdo_pgsql -> Laravel dies at migrate with "could not
# find driver". 47_ensure_php_pgsql.sh builds + enables it (phpize) idempotently.
# Must run BEFORE any artisan DB access below.
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

# --- Database: PostgreSQL (forced on Linux), localhost-only, one DB per app ---
# On Linux this project runs on PostgreSQL (config/database.php defaults
# POLY_DB_DRIVER=pgsql for PHP_OS_FAMILY===Linux). The CANONICAL installer and
# configurer is dd.sh's chain (scripts/shells/linux/debian/install.sh ->
# 46_install_postgresql.sh); start.sh only ENSURES the outcome and is fully
# idempotent:
#   * dd.sh PRIORITY: set the shared global-var flags so the canonical chain
#     agrees, then invoke 46_install_postgresql.sh (itself idempotent/self-healing)
#     only when Postgres is not already up.
#   * Credentials are GENERATED by the .sh and stored in the global-var store
#     (never in .env); Laravel reads them via App\Support\CoreNodeSecrets.
#   * WSL-safe start (systemd often absent): systemctl -> service -> pg_ctlcluster.
#   * Create each per-app database before migrate runs.
echo "Ensuring PostgreSQL (localhost-only, per-app databases)..."

# Resolve sudo locally. We deliberately do NOT source gvar_common.sh here: sourcing
# it triggers heavy top-level side effects (writing /etc/environment, scanning all
# disks via blkid/findmnt, sudo mkdir) and can HANG on a sudo password prompt on
# every app start. The canonical 46_install_postgresql.sh sources it itself.
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# dd.sh priority: align the canonical chain by writing the shared global-var flags
# DIRECTLY into the same file-backed store gvar_common.sh uses (one file per key,
# value + newline). Force START_POSTGRESQL=true; only raise INSTALL_MODE to 'server'
# when unset/base so an explicit dd.sh choice (server/full/desktop) is preserved.
GLOBAL_VAR_DIR="${CORE_NODE_DATA_DIR:-/var/_core_node}/global_var"
$USE_SUDO mkdir -p "$GLOBAL_VAR_DIR" 2>/dev/null || true
printf 'true\n' | $USE_SUDO tee "$GLOBAL_VAR_DIR/START_POSTGRESQL" >/dev/null 2>&1 || true
CURRENT_INSTALL_MODE=""
if [ -f "$GLOBAL_VAR_DIR/INSTALL_MODE" ]; then
    CURRENT_INSTALL_MODE="$(tr -d '[:space:]' < "$GLOBAL_VAR_DIR/INSTALL_MODE" 2>/dev/null || echo "")"
fi
if [ -z "$CURRENT_INSTALL_MODE" ] || [ "$CURRENT_INSTALL_MODE" = "base" ]; then
    printf 'server\n' | $USE_SUDO tee "$GLOBAL_VAR_DIR/INSTALL_MODE" >/dev/null 2>&1 || true
fi

# ALWAYS invoke the canonical PostgreSQL ensurer (it is fully idempotent). Beyond
# install, every run it (a) auto-fixes the WSL D-image loop mount and (b) RECONCILES
# the cluster onto the mapped data dir -- adopting an existing mapped cluster, or
# recreating there if the running cluster drifted to native (sys:init re-seeds from
# init_data; no dump/restore migration). Running it every time is what makes
# "data path == mapped dir" idempotent, instead of skipping when pg is already up.
if [ -f "$POSTGRES_INSTALL_SCRIPT" ]; then
    echo "  Running canonical PostgreSQL ensurer (idempotent: install + mount-fix + data-dir reconcile):"
    echo "    $POSTGRES_INSTALL_SCRIPT"
    bash "$POSTGRES_INSTALL_SCRIPT" || echo "  Warning: PostgreSQL ensurer reported a failure (continuing)."
else
    echo "  *** ACTION REQUIRED: PostgreSQL ensurer missing: $POSTGRES_INSTALL_SCRIPT"
    echo "  *** Install manually: sudo apt-get install -y postgresql postgresql-contrib"
fi

# Idempotent WSL-safe start: if still not accepting connections, try systemd ->
# sysv service -> Debian cluster tool, then wait briefly for readiness.
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

    # Idempotent status (printed every run, installed or not): where the data
    # ACTUALLY lives + whether the D-drive image mapping is in effect. The data dir
    # is queried from the running server (authoritative), and the backing device
    # tells us if it is on a loop-mounted D-image (mapping active) or native ext4.
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
    echo "  *** Start it (sudo service postgresql start) then re-run start.sh; migrations will fail until then."
fi

echo "Clearing route cache..."
"$PHP_BIN" artisan route:clear

echo "Listing routes..."
"$PHP_BIN" artisan route:list

# config/database.php reads a RUNTIME secret (the PG password via CoreNodeSecrets)
# that must NEVER be frozen into a config cache. A stale bootstrap/cache/config.php
# left by a prior `artisan config:cache`/`optimize` bakes in the password value as it
# was AT CACHE TIME (empty, before the secret store existed) and is then used verbatim
# WITHOUT ever calling CoreNodeSecrets -> migrate dies with "fe_sendauth: no password
# supplied" even though the store holds the password. The earlier config:clear only
# fires when .env has DB lines; make it unconditional here so every run reads the live
# secret. Idempotent and cross-OS (no-op when nothing is cached).
"$PHP_BIN" artisan config:clear >/dev/null 2>&1 || true

echo "Running migrations..."
"$PHP_BIN" artisan migrate --force

# Queue jobs table is created by migration 0001_01_01_000001_create_queue_tables.php
# The migrate command above handles it; no separate check needed

# --- Ensure Swoole (Octane is the single task-system driver on Linux/WSL) ---
# The sub-minute task system (TTS / covers / translation / global tasks) is driven
# ONLY by the Laravel Octane (Swoole) timer. Without Swoole, Octane cannot run and
# none of those tasks are processed. Install it (idempotent; builds from source for
# PHP 8.5 and applies the Octane 6.x compat patch) before sys:init so the compat
# fixer in sys:init sees Swoole present.
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
# sys:init's dictionary Step 2 extracts the split 7z archives under
# init_data/AppQyV1/VoiceStaticServer/translate/*.js into olddb.txt via the 7z
# binary, then promotes the parsed translations into tts_cache_{lang}. Without
# 7z the extraction fails silently and EVERY dictionary word stays
# has_translation=0 (dashboard shows Translated = 0). Install it BEFORE sys:init.
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
# sys:init's chokidar step + Octane --watch need a WORKING `node` binary. Gate on
# node ITSELF (not npx): a stale /usr/local/bin/npx symlink can exist while node is
# absent, which previously made resolve_npx succeed and skip the installer (so
# sys:init still reported "Node.js not found"). 15_install_node_24.sh is gated by
# the INSTALL_NODE global-var flag, so set it true (file-backed store) first or the
# installer silently exits.
if ! node --version >/dev/null 2>&1; then
    if [ -f "$NODE_INSTALL_SCRIPT" ]; then
        NODE_GLOBAL_VAR_DIR="${CORE_NODE_DATA_DIR:-/var/_core_node}/global_var"
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

echo "Initializing system (php artisan sys:init)..."
"$PHP_BIN" artisan sys:init

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
# Under WSL2's default NAT networking, octane:start binds 0.0.0.0:PORT on the WSL VM
# (172.x.x.x), NOT the Windows host. A Tailscale daemon on the Windows host advertises
# the host's 100.x address, but inbound packets from another Tailscale device land on
# the host where nothing listens on PORT -- so the service is unreachable from outside
# even though localhost works. The companion Windows script wsl_port_forward.ps1 sets a
# netsh portproxy (0.0.0.0:PORT -> WSL_IP:PORT) + firewall rule to bridge this. Only
# emit the hint under WSL; mirrored networking (Win11 22H2+) makes it unnecessary.
if is_wsl; then
    # The hint command is pasted into WINDOWS PowerShell, so present a Windows path.
    # Convert a /mnt/<drive>/... script dir to '<DRIVE>:\...'; leave non-/mnt paths
    # (script living on the Linux fs) as-is with a \\wsl$ UNC hint instead.
    WIN_SCRIPT_PATH=""
    case "$SCRIPT_DIR" in
        /mnt/[a-z]/*)
            WIN_DRIVE="$(printf '%s' "$SCRIPT_DIR" | sed -E 's#^/mnt/([a-z])/.*#\1#' | tr '[:lower:]' '[:upper:]')"
            WIN_REST="$(printf '%s' "$SCRIPT_DIR" | sed -E 's#^/mnt/[a-z]/##; s#/#\\#g')"
            WIN_SCRIPT_PATH="${WIN_DRIVE}:\\${WIN_REST}\\wsl_port_forward.ps1"
            ;;
        *)
            WIN_SCRIPT_PATH="\\\\wsl\$\\${WSL_DISTRO_NAME:-<distro>}$(printf '%s' "$SCRIPT_DIR" | sed 's#/#\\#g')\\wsl_port_forward.ps1"
            ;;
    esac
    echo ""
    echo "ℹ️  WSL detected. To reach http://...:${PORT} from ANOTHER Tailscale/LAN device"
    echo "    (not just this host's localhost), the Windows host needs a port-forward."
    echo "    If you launched this via start.ps1, it is set up AUTOMATICALLY -- nothing"
    echo "    to do. If you started start.sh directly, run ONCE on the WINDOWS host in"
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
# Without this a leftover Octane/server from a previous run makes octane:start
# abort with "Port ${PORT} is already in use." ensure_port_free stops a stale app
# server gracefully first (native octane:stop), then frees the port.
echo "Ensuring port ${PORT} is free..."
ensure_port_free "$PORT" "$PHP_BIN" || echo "  Continuing; the runtime may fail to bind if the port is truly occupied."

# --- Optional background service registration (AFTER the full prerequisite setup) ---
# All prerequisites (php/composer/pg/migrate/swoole/node/sys:init/...) are done by
# this point. Only now do we ask whether to install a background systemd unit. When
# accepted, register a unit that runs this same idempotent start.sh (it sets
# LARAVEL_SERVICE_RUN=1, so the in-service run skips this block and goes straight to
# the server below), then exit. The --service / --no-service flags (and AS_SERVICE
# env) pre-answer the prompt for non-interactive callers (e.g. the orchestrator).
if [ "${LARAVEL_SERVICE_RUN:-}" != "1" ]; then
    # A systemd unit is only meaningful when systemd is the active init. If it is not
    # (WSL without `systemd=true`, containers, ...), don't ask and don't attempt the
    # registration -- that would only emit raw "not been booted with systemd" / bus
    # errors. Show a differentiated hint (WSL-aware) and fall through to foreground.
    if [ "$AS_SERVICE" != "no" ] && ! systemd_available; then
        echo ""
        if is_wsl; then
            echo "ℹ️  Background systemd service unavailable: this WSL distro was not booted with systemd."
            echo "    (systemctl would fail with 'System has not been booted with systemd as init system'.)"
            echo "    To enable it (optional): add the following to /etc/wsl.conf, then run 'wsl --shutdown'"
            echo "    from Windows PowerShell and reopen the distro:"
            echo "        [boot]"
            echo "        systemd=true"
            echo "    For now, laravel_main will run in the FOREGROUND in this terminal (Ctrl+C to stop)."
        else
            echo "ℹ️  Background systemd service unavailable: systemd is not the active init (no /run/systemd/system)."
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
            exit 0
        else
            echo "Service registration failed; continuing in the foreground."
        fi
    fi
fi

# --- Start runtime ---
# PRIMARY (Linux/WSL): Laravel Octane on Swoole. Octane is the SINGLE driver for the
# sub-minute task system (OctaneTimerServiceProvider -> OctaneTimerService); per
# development-guides/COMMON_TIMER_DESIGN_SPECIFICATION.md there is exactly one timer
# instance and no Laravel-Scheduler/queue duplicate. octane:start binds 0.0.0.0:PORT
# (matches the advertised LAN URL). --watch (hot reload) needs chokidar, which needs
# node; only enable it when npx is available.
#
# FALLBACK (Swoole unavailable, e.g. install failed): the legacy node 'composer
# dev:win' (serve + queue:listen) or a node-free serve + queue:listen. In fallback
# mode the Octane timer does NOT run, so TTS/cover/translation/global tasks are NOT
# processed -- this is a degraded backend-only mode. queue:listen uses --timeout=0 so
# a long job cannot crash the listener (see CodeMart off-queue migration).
if [ -n "$OCTANE_AVAILABLE" ]; then
    # `octane:start --watch` requires BOTH node and the chokidar package
    # (Laravel Octane docs). node/npx alone is not enough -> only pass --watch
    # when chokidar is actually installed. Also skip --watch in production
    # (file-watch restarts are a dev-only convenience).
    WATCH_FLAG=""
    if grep -qE '^APP_ENV=production' "${LARAVEL_DIR}/.env" 2>/dev/null; then
        echo "APP_ENV=production -> Octane runs without --watch."
    elif [ -z "$NPX_BIN" ]; then
        echo "node/npx not available -> Octane runs without --watch (no hot reload)."
    elif [ ! -d "${LARAVEL_DIR}/node_modules/chokidar" ]; then
        echo "chokidar not installed -> Octane runs without --watch (run sys:init / 'pnpm add -D chokidar' to enable hot reload)."
    else
        WATCH_FLAG="--watch"
        # inotify events are NOT delivered on WSL DrvFs mounts (9p) and other
        # network-backed filesystems, so chokidar in inotify mode never fires --
        # especially for edits made from the Windows side. Octane's --poll
        # switches chokidar to stat-polling, which sees changes from any side.
        # Detection is based on the ACTUAL filesystem of LARAVEL_DIR (derived
        # from this script's own location), not on a hard-coded path, so native
        # Ubuntu/Debian/Ubuntu-desktop checkouts on ext4 keep fast inotify mode.
        WATCH_FS_TYPE="$(findmnt -n -o FSTYPE -T "$LARAVEL_DIR" 2>/dev/null \
            || stat -f -c %T "$LARAVEL_DIR" 2>/dev/null \
            || echo unknown)"
        if grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null || [ -n "${WSL_DISTRO_NAME:-}" ] || [ -n "${WSL_INTEROP:-}" ]; then
            WATCH_IS_WSL="1"
        fi
        case "$WATCH_FS_TYPE" in
            9p|v9fs|drvfs|cifs|smb*|nfs*)
                WATCH_FLAG="--watch --poll"
                echo "Filesystem '${WATCH_FS_TYPE}' at ${LARAVEL_DIR} does not deliver inotify -> Octane hot reload uses --watch --poll."
                ;;
            unknown)
                # Fallback when fs type could not be resolved: WSL kernel + /mnt
                # path means a Windows drive mount -> polling required.
                if [ -n "$WATCH_IS_WSL" ]; then
                    case "$LARAVEL_DIR" in
                        /mnt/*)
                            WATCH_FLAG="--watch --poll"
                            echo "WSL Windows-drive mount detected (${LARAVEL_DIR}) -> Octane hot reload uses --watch --poll."
                            ;;
                    esac
                fi
                ;;
        esac
    fi
    echo "Starting headless API runtime (Octane swoole -> server 0.0.0.0:${PORT}, single timer driver)"
    "$PHP_BIN" artisan octane:start --server=swoole --host=0.0.0.0 --port="$PORT" $WATCH_FLAG
elif [ -n "$NPX_BIN" ]; then
    echo "WARNING: Swoole unavailable -> Octane timer tasks DISABLED."
    echo "Starting degraded fallback (composer dev:win -> server 0.0.0.0:${PORT} + queue)"
    $COMPOSER_CMD dev:win
else
    echo "WARNING: Swoole unavailable and no node -> Octane timer tasks DISABLED."
    echo "node-free fallback: php artisan serve + queue:listen"
    "$PHP_BIN" artisan queue:listen --tries=1 --timeout=0 &
    "$PHP_BIN" artisan serve --host=0.0.0.0 --port="$PORT"
fi
