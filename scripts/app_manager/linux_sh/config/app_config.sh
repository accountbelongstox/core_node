#!/bin/bash
# App Manager - Linux SH Configuration
# Central config for scan paths, ports, and command templates (Linux)

BASE_PORT=10000
PORT_RANGE=5000
AUTO_INCREMENT=true

# Laravel projects (detected by composer.json + artisan) use a dedicated port range.
# Sorted alphabetically: first project -> 9000, second -> 9001, ...
LARAVEL_BASE_PORT=9000

# Laravel service memory limit (Octane holds everything in memory, needs more)
LARAVEL_MEMORY_LIMIT="1600M"
LARAVEL_CPU_LIMIT="50%"

# --- Unified log namespace: paths (single source of truth) ------------------
# Canonical location is the repo path-map key 'app_manager_logs' -> /opt/_core_node/logs.
# That key is mirrored across all four language path maps (keep in sync):
#   Shell : scripts/shells/linux/common/gvar_common.sh        map_web_path
#   Python: pycore/pyfoundations/system_paths.py              map_web_path
#   PHP   : poly_apps/laravel_main/app/Providers/PathMapper.php  mapWebPath
#   JS    : scripts/nodetools/gvar_common.js                  mapWebPath
# ONE unified data dir for all users (no per-user/$HOME, no fallback list). The
# DATA dir is the parent of the log root. /opt is the canonical, FHS-standard,
# all-users-readable location; the manager runs as root and creates it world-
# accessible (mode 0777) on first run so any user can read/write the logs.
# Override only via CORE_NODE_APP_MANAGER_DATA.
APP_MANAGER_DATA_DIR_DEFAULT="/opt/_core_node"

# Retired data roots - every OTHER place logs were ever written before unifying on
# /opt/_core_node: the old 'core_node_unified_manager' tree AND the earlier
# multi-candidate '_core_node' fallbacks under /var and /tmp. cleanup_old_log_dirs()
# DELETES each of these (guarded so it never touches the active dir). Path-map key
# 'app_manager_logs_old' documents the primary retired root.
APP_MANAGER_OLD_DATA_DIRS="/opt/core_node_unified_manager /var/tmp/core_node_unified_manager /tmp/core_node_unified_manager /var/_core_node /var/tmp/_core_node /tmp/_core_node"

# --- Unified log namespace: budget + trim throttle --------------------------
# systemd "append:" has no rotation, so service.log is trimmed in place
# (see utils/log_budget.sh) to keep the whole logs folder under
# APP_MANAGER_LOG_TOTAL_BYTES (50MB), each file capped at APP_MANAGER_LOG_FILE_BYTES.
APP_MANAGER_LOG_TOTAL_BYTES=$((50 * 1024 * 1024))
APP_MANAGER_LOG_FILE_BYTES=$((10 * 1024 * 1024))

# Throttle for the in-process "trim on every log write" trigger AND the systemd
# timer cadence: re-check/clean at most once per this many seconds (30 min), so
# frequent log writes do not pay the scan cost every time.
APP_MANAGER_LOG_TRIM_INTERVAL=1800

ENTRY_POINTS="main.py main.js package.json composer.json pubspec.yaml index.php build.gradle build.gradle.kts nuxt.config.js nuxt.config.ts"

# Command template for a key; placeholders: app_path, app_name, port, root_dir
get_command_tpl() {
    local key="$1"
    case "$key" in
        react_dev)          echo 'cd "${app_path}" && pnpm run dev' ;;
        react_build)        echo 'cd "${app_path}" && pnpm run build && pnpm start' ;;
        reactnative_dev)    echo 'cd "${app_path}" && pnpm run dev' ;;
        reactnative_build)  echo 'cd "${app_path}" && pnpm run build && pnpm start' ;;
        vue_dev)            echo 'cd "${app_path}" && pnpm run dev' ;;
        vue_build)          echo 'cd "${app_path}" && pnpm run build && pnpm start' ;;
        nuxt_dev)           echo 'cd "${app_path}" && pnpm run dev' ;;
        nuxt_build)         echo 'cd "${app_path}" && pnpm run build && pnpm start' ;;
        laravel_dev)        echo 'cd "${app_path}" && php artisan serve --host=0.0.0.0 --port=${port}' ;;
        laravel_prod)       echo 'cd "${app_path}" && php artisan serve --host=0.0.0.0 --port=${port} --env=production' ;;
        flutter_dev)        echo 'cd "${app_path}" && flutter run -d web-server --web-hostname=0.0.0.0 --web-port=${port}' ;;
        flutter_build)      echo 'cd "${app_path}" && flutter build web' ;;
        kotlin_dev)         echo 'cd "${app_path}" && ./gradlew run' ;;
        php_dev)            echo 'php -S 0.0.0.0:${port} -t "${app_path}"' ;;
        python_dev)         echo 'python3 "${app_path}/main.py"' ;;
        ncore_dev)          echo 'node "${root_dir}/main.js" app=${app_name}' ;;
        pycore_dev)         echo 'python3 "${root_dir}/pymain.py" app=${app_name}' ;;
        polyLauncher)       echo 'cd "${app_path}" && pnpm run dev' ;;
        *)                  echo 'cd "${app_path}" && pnpm run dev' ;;
    esac
}
