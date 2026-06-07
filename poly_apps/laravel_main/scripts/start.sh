#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
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
NODE_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/14_install_node_24.sh"
SWOOLE_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/32_install_swoole.sh"

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
RUNTIME_DIR=""
IP_LIST=""
IP=""
OCTANE_AVAILABLE=""
WATCH_FLAG=""

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
    if command -v npx >/dev/null 2>&1; then
        NPX_BIN="$(command -v npx)"
        return 0
    fi
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

# --- Ensure sqlite database file when DB_CONNECTION=sqlite ---
if [ -f "${LARAVEL_DIR}/.env" ] && grep -qE '^DB_CONNECTION=sqlite' "${LARAVEL_DIR}/.env"; then
    mkdir -p "${LARAVEL_DIR}/database"
    if [ ! -f "${LARAVEL_DIR}/database/database.sqlite" ]; then
        touch "${LARAVEL_DIR}/database/database.sqlite"
    fi
fi

echo "Clearing route cache..."
"$PHP_BIN" artisan route:clear

echo "Listing routes..."
"$PHP_BIN" artisan route:list

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

# --- Ensure node/npx (composer dev / dev:win use 'npx concurrently') ---
if ! resolve_npx; then
    if [ -f "$NODE_INSTALL_SCRIPT" ]; then
        echo "npx not found. Invoking init-ensure installer:"
        echo "  $NODE_INSTALL_SCRIPT"
        bash "$NODE_INSTALL_SCRIPT" || echo "  Warning: node init-ensure installer failed (continuing)."
        resolve_npx || true
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
