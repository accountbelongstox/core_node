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
# copy used by 175_laravel_main_start.sh and the systemd units it registers.
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
RUNTIME_SCRIPT="${RUNTIME_SCRIPT:-}"
PHP_BIN="${PHP_BIN:-$(command -v php)}"
VENDOR_AUTOLOAD="${LARAVEL_DIR}/vendor/autoload.php"
BOOTSTRAP_APP="${LARAVEL_DIR}/bootstrap/app.php"
RUNTIME_CONFIG_DIR=""
RUNTIME_CONFIGURATION_READY="no"
COMPOSER_VENDOR_COMMON="${LARAVEL_SERVICE_COMMON_DIR}/../../common/composer_vendor_common.sh"
RUNTIME_CONFIG_COMMON="${LARAVEL_SERVICE_COMMON_DIR}/../../common/runtime_config_common.sh"
GVAR_COMMON_SCRIPT="${LARAVEL_SERVICE_COMMON_DIR}/../../common/gvar_common.sh"

. "$COMPOSER_VENDOR_COMMON"
# Central service contract (config/service_contract.json) via the shell
# adapter: the default bind port is ports.laravel_api_backend; PORT env wins.
# shellcheck source=/dev/null
. "$LARAVEL_SERVICE_COMMON_DIR/../../common/service_contract_common.sh"
# shellcheck source=/dev/null
. "$GVAR_COMMON_SCRIPT"
PORT="${PORT:-$(sc_get ports.laravel_api_backend)}"

# Plane dispatch (web_server_plane, gvar_common.sh): the runtime branch is
# selected by the shared plane constant - frankenphp plane runs the single
# octane:frankenphp process (HTTPS + Mercure hub), nginx plane keeps the
# system-PHP Swoole branch on the loopback backend. RUNTIME_SCRIPT env wins.
if [ -z "$RUNTIME_SCRIPT" ]; then
    if [ "$(web_server_plane)" = "frankenphp" ]; then
        RUNTIME_SCRIPT="$LARAVEL_SERVICE_COMMON_DIR/laravel_runtime_frankenphp.sh"
    else
        RUNTIME_SCRIPT="$LARAVEL_SERVICE_COMMON_DIR/laravel_runtime_nginx.sh"
    fi
fi

# Shared RuntimeConfigurationStore adapter (common area; was duplicated here).
# shellcheck source=/dev/null
. "$RUNTIME_CONFIG_COMMON"

initialize_runtime_configuration_store() {
    local generated_value=""
    local config_state=""

    RUNTIME_CONFIGURATION_READY="no"
    RUNTIME_CONFIG_DIR="$(runtime_config_directory)"
    if [ -z "$RUNTIME_CONFIG_DIR" ]; then
        echo "ERROR: Runtime configuration store directory could not be resolved."
    else
        generated_value="$(RC_ARG_AUTOLOAD="$VENDOR_AUTOLOAD" RC_ARG_BOOTSTRAP="$BOOTSTRAP_APP" php_script_run 'require getenv("RC_ARG_AUTOLOAD"); require getenv("RC_ARG_BOOTSTRAP"); echo "base64:".base64_encode(random_bytes(32));')"
        config_state="$(ensure_runtime_config_value "APP_KEY" "$generated_value")"
        if [ "$config_state" != "ready" ]; then
            echo "ERROR: Failed to provision APP_KEY."
        else
            # The Mercure hub keys are provisioned independently and then
            # re-probed from the canonical store.
            runtime_config_ensure_mercure_keys
            if [ "$(runtime_config_mercure_keys_ready)" != "yes" ]; then
                echo "ERROR: Failed to provision the Mercure hub keys."
            else
                RUNTIME_CONFIGURATION_READY="yes"
                echo "Runtime configuration store ready: $RUNTIME_CONFIG_DIR"
            fi
        fi
    fi
}

echo "=== Laravel Production Service ==="
echo "Project: $APP_NAME"
echo "Working directory: $LARAVEL_DIR"
echo "Port: $PORT"
echo "Runtime branch: $RUNTIME_SCRIPT"
echo "Workers: $WORKERS"
echo ""

cd "$LARAVEL_DIR" || exit 1

# Phase 1: dependencies (vendor/ must match composer.lock AND load cleanly)
ensure_composer_vendor "$LARAVEL_DIR" --no-dev --optimize-autoloader
if [ "$COMPOSER_VENDOR_AUTOLOAD_OK" != "yes" ]; then
    echo "ERROR: composer vendor setup failed"
    exit 1
fi

# Initialize each canonical runtime-store value and probe the resulting state
# before any Artisan command. Function status is not used as business data.
initialize_runtime_configuration_store
if [ "$RUNTIME_CONFIGURATION_READY" != "yes" ]; then
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
        | grep -oE "octane-[a-zA-Z0-9-]+\.service" | sed 's/.service$//' || true)
    if [ -n "$local_old_services" ]; then
        echo "Cleaning up legacy Octane services..."
        for old_svc in $local_old_services; do
            echo "  Stopping and disabling: $old_svc (+ trigger timer)"
            systemctl stop "$old_svc" 2>/dev/null || true
            systemctl disable "$old_svc" 2>/dev/null || true
            # The generator (ServerManagerV1OctaneServiceManager) registers a
            # matching .timer that re-triggers a disabled service - retire the
            # pair together or the unit restarts forever.
            if systemctl list-unit-files --type=timer --no-legend 2>/dev/null \
                | awk '{print $1}' | grep -qx "${old_svc}.timer"; then
                systemctl stop "${old_svc}.timer" 2>/dev/null || true
                systemctl disable "${old_svc}.timer" 2>/dev/null || true
            fi
        done
        systemctl daemon-reload 2>/dev/null || true
    fi
fi

# Phase 5: start realtime and HTTP runtimes
echo ""
echo "Starting laravel_main runtime branch on the active web-server plane..."
PORT="$PORT" WORKERS="$WORKERS" PHP_BIN="$PHP_BIN" LARAVEL_DIR="$LARAVEL_DIR" \
    exec /bin/bash "$RUNTIME_SCRIPT"
