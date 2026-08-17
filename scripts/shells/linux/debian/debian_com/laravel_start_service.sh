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

# Canonical Laravel production service launcher (Octane/Swoole), common-area
# copy used by 132_laravel_main_start.sh and the systemd units it registers.
# LARAVEL_DIR falls back to the core_node layout; PORT selects the bind port.
#
# SYNC CONTRACT: the per-app instance is
#   poly_apps/laravel_main/scripts/start_service.sh
# Change both together.

LARAVEL_SERVICE_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_SERVICE_REPO_ROOT="$(cd "$LARAVEL_SERVICE_COMMON_DIR/../../../../.." && pwd)"
LARAVEL_DIR="${LARAVEL_DIR:-${CORE_NODE_DIR:-$LARAVEL_SERVICE_REPO_ROOT}/poly_apps/laravel_main}"
APP_NAME="$(basename "$LARAVEL_DIR")"
PORT="${PORT:-}"
WORKERS="${WORKERS:-4}"
OCTANE_SERVER="${OCTANE_SERVER:-swoole}"
RUNTIME_SCRIPT="${RUNTIME_SCRIPT:-$LARAVEL_SERVICE_COMMON_DIR/laravel_run_runtime.sh}"
PHP_BIN="${PHP_BIN:-$(command -v php)}"
VENDOR_AUTOLOAD="${LARAVEL_DIR}/vendor/autoload.php"
BOOTSTRAP_APP="${LARAVEL_DIR}/bootstrap/app.php"
RUNTIME_CONFIG_DIR=""
COMPOSER_VENDOR_COMMON="${LARAVEL_SERVICE_COMMON_DIR}/../../common/composer_vendor_common.sh"

. "$COMPOSER_VENDOR_COMMON"
# Central service contract (config/service_contract.json) via the shell
# adapter: the default bind port is ports.laravel_api_backend; PORT env wins.
# shellcheck source=/dev/null
. "$LARAVEL_SERVICE_COMMON_DIR/../../common/service_contract_common.sh"
PORT="${PORT:-$(sc_get ports.laravel_api_backend)}"

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

# Phase 1: dependencies (vendor/ must match composer.lock AND load cleanly)
ensure_composer_vendor "$LARAVEL_DIR" --no-dev --optimize-autoloader
if [ "$COMPOSER_VENDOR_AUTOLOAD_OK" != "yes" ]; then
    echo "ERROR: composer vendor setup failed"
    exit 1
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

# Phase 2: configuration and system initialization
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

# Phase 3: safe deployment caches
echo "Warming route, event, and view caches..."
"$PHP_BIN" artisan route:cache 2>&1 || echo "WARNING: route cache could not be created"
"$PHP_BIN" artisan event:cache 2>&1 || echo "WARNING: event cache could not be created"
"$PHP_BIN" artisan view:cache 2>&1 || echo "WARNING: view cache could not be created"

# Phase 4: clean up legacy services
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

# Phase 5: start realtime and HTTP runtimes
echo ""
echo "Starting Octane ($OCTANE_SERVER) on 0.0.0.0:$PORT with $WORKERS workers..."
PORT="$PORT" WORKERS="$WORKERS" OCTANE_SERVER="$OCTANE_SERVER" LARAVEL_DIR="$LARAVEL_DIR" \
    exec /bin/bash "$RUNTIME_SCRIPT"
