#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Laravel Production Service Launcher (Octane/Swoole)
# Used by: App Manager (Ns command), dd_helper scripts (131-134), laravel_service_manager.sh
# Each Laravel project under poly_apps/ should have its own copy of this script.
# Port is passed via PORT env var; multiple projects get 9000, 9001, ... automatically.
# start.sh = dev mode (composer dev, hot reload)
# start_service.sh = production mode (Octane, systemd)
#
# SYNC CONTRACT: this is the per-app instance; the canonical common-area copy is
#   scripts/shells/linux/debian/debian_com/laravel_start_service.sh
# (used by install_shells/132_laravel_main_start.sh). Change both together.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_NAME="$(basename "$LARAVEL_DIR")"
PORT="${PORT:-9000}"
WORKERS="${WORKERS:-4}"
OCTANE_SERVER="${OCTANE_SERVER:-swoole}"
RUNTIME_SCRIPT="${SCRIPT_DIR}/run_runtime.sh"
PHP_BIN="${PHP_BIN:-$(command -v php)}"
VENDOR_AUTOLOAD="${LARAVEL_DIR}/vendor/autoload.php"
BOOTSTRAP_APP="${LARAVEL_DIR}/bootstrap/app.php"
RUNTIME_CONFIG_DIR=""

runtime_config_directory() {
    "$PHP_BIN" -r '
        $autoload = $argv[1];
        $bootstrap = $argv[2];
        require $autoload;
        require $bootstrap;
        echo \App\Support\RuntimeConfigurationStore::directory();
    ' "$VENDOR_AUTOLOAD" "$BOOTSTRAP_APP"
}

runtime_config_get() {
    local key="$1"

    "$PHP_BIN" -r '
        $autoload = $argv[1];
        $bootstrap = $argv[2];
        $key = $argv[3];
        $value = null;
        require $autoload;
        require $bootstrap;
        $value = \App\Support\RuntimeConfigurationStore::get($key);
        if ($value !== null) {
            echo $value;
        }
    ' "$VENDOR_AUTOLOAD" "$BOOTSTRAP_APP" "$key"
}

runtime_config_put() {
    local key="$1"
    local value="$2"

    printf '%s' "$value" | "$PHP_BIN" -r '
        $autoload = $argv[1];
        $bootstrap = $argv[2];
        $key = $argv[3];
        $value = trim(stream_get_contents(STDIN));
        require $autoload;
        require $bootstrap;
        exit(\App\Support\RuntimeConfigurationStore::put($key, $value) ? 0 : 1);
    ' "$VENDOR_AUTOLOAD" "$BOOTSTRAP_APP" "$key"
}

ensure_runtime_config_value() {
    local key="$1"
    local value="$2"
    local current=""

    current="$(runtime_config_get "$key")"
    if [ -z "$current" ]; then
        runtime_config_put "$key" "$value"
    fi
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
    ensure_runtime_config_value "REVERB_APP_ID" "task-system" || return 1
    generated_value="$($PHP_BIN -r 'echo bin2hex(random_bytes(16));')"
    ensure_runtime_config_value "REVERB_APP_KEY" "$generated_value" || return 1
    generated_value="$($PHP_BIN -r 'echo bin2hex(random_bytes(32));')"
    ensure_runtime_config_value "REVERB_APP_SECRET" "$generated_value" || return 1

    echo "Runtime configuration store ready: $RUNTIME_CONFIG_DIR"
}

echo "=== Laravel Production Service ==="
echo "Project: $APP_NAME"
echo "Working directory: $LARAVEL_DIR"
echo "Port: $PORT"
echo "Server: $OCTANE_SERVER"
echo "Workers: $WORKERS"
echo ""

cd "$LARAVEL_DIR" || exit 1

# ── Phase 1: Dependencies ────────────────────────────────────────────────────
if [ ! -d "vendor" ] || [ ! -f "vendor/autoload.php" ]; then
    echo "vendor/ not found. Running composer install..."
    composer install --no-dev --optimize-autoloader
    if [ $? -ne 0 ]; then
        echo "ERROR: composer install failed"
        exit 1
    fi
    echo ""
fi

# Initialize the canonical runtime store before any Artisan command.
if ! initialize_runtime_configuration_store; then
    echo "ERROR: Runtime configuration store initialization failed."
    exit 1
fi

if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
    echo "node_modules not found. Running pnpm install..."
    pnpm install 2>/dev/null || npm install 2>/dev/null || true
    echo ""
fi

# ── Phase 2: Configuration & System Initialization ──────────────────────────
echo "Clearing configuration cache..."
if ! "$PHP_BIN" artisan config:clear; then
    echo "ERROR: config:clear failed; runtime credentials may be stale."
    exit 1
fi

echo "Initializing system..."
if ! "$PHP_BIN" artisan sys:init; then
    echo "ERROR: sys:init failed; production startup stopped."
    exit 1
fi

# ── Phase 3: Safe Deployment Caches ─────────────────────────────────────────
echo "Warming route, event, and view caches..."
"$PHP_BIN" artisan route:cache 2>&1 || echo "WARNING: route cache could not be created"
"$PHP_BIN" artisan event:cache 2>&1 || echo "WARNING: event cache could not be created"
"$PHP_BIN" artisan view:cache 2>&1 || echo "WARNING: view cache could not be created"

# ── Phase 4: Clean up legacy services ────────────────────────────────────────
# Stop old octane-poly-* services if they exist (replaced by app-manager-* naming)
if command -v systemctl >/dev/null 2>&1; then
    local_old_services=$(systemctl list-units --type=service --all --no-legend 2>/dev/null \
        | grep -oE "octane-poly-[0-9]+\.service" | sed 's/.service$//' || true)
    if [ -n "$local_old_services" ]; then
        echo "Cleaning up legacy Octane services..."
        for old_svc in $local_old_services; do
            echo "  Stopping and disabling: $old_svc"
            systemctl stop "$old_svc" 2>/dev/null || true
            systemctl disable "$old_svc" 2>/dev/null || true
        done
        systemctl daemon-reload 2>/dev/null || true
    fi
fi

# ── Phase 5: Start realtime and HTTP runtimes ───────────────────────────────
echo ""
echo "Starting Octane ($OCTANE_SERVER) on 0.0.0.0:$PORT with $WORKERS workers..."
PORT="$PORT" WORKERS="$WORKERS" OCTANE_SERVER="$OCTANE_SERVER" \
    exec /bin/bash "$RUNTIME_SCRIPT"
