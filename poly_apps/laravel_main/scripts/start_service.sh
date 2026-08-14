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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_NAME="$(basename "$LARAVEL_DIR")"
PORT="${PORT:-9000}"
WORKERS="${WORKERS:-4}"
OCTANE_SERVER="${OCTANE_SERVER:-swoole}"
RUNTIME_SCRIPT="${SCRIPT_DIR}/run_runtime.sh"

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

if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
    echo "node_modules not found. Running pnpm install..."
    pnpm install 2>/dev/null || npm install 2>/dev/null || true
    echo ""
fi

# ── Phase 2: Database ────────────────────────────────────────────────────────
echo "Running migrations..."
php artisan migrate --force 2>&1 || echo "WARNING: migration failed (may be first run without DB)"

# Queue jobs table is created by migration 0001_01_01_000001_create_queue_tables.php
# The migrate --force above handles it; no separate check needed

# ── Phase 3: Cache & Init ────────────────────────────────────────────────────
echo "Clearing caches..."
php artisan config:cache 2>&1 || true
php artisan route:cache 2>&1 || true
php artisan view:cache 2>&1 || true

echo "Initializing system..."
php artisan sys:init 2>&1 || true

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
