#!/bin/bash
SCRIPT_INDEX="175"
# Tailnet binding (development-guides/LARAVEL_GUIDE.md "Tailnet"): --domains-only adds <machine>.ts.net -> UI and /laravel-api -> 9000 when Tailscale is connected.

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
LARAVEL_START_FRANKENPHP_SUB="${DEBIAN_COM_DIR}/175_laravel_main_start_frankenphp.sh"
LARAVEL_START_NGINX_SUB="${DEBIAN_COM_DIR}/175_laravel_main_start_nginx.sh"
RUNTIME_CONFIG_COMMON="${COMMON_DIR}/runtime_config_common.sh"
LARAVEL_MAIN_RUNTIME_COMMON="${COMMON_DIR}/laravel_main_runtime_common.sh"
LARAVEL_13_UPGRADE_SCRIPT="${DEBIAN_COM_DIR}/laravel_upgrade_13.sh"
DOMAIN_SETUP_COMMON="${COMMON_DIR}/domain_setup_common.sh"
REDIS_ENDPOINT_COMMON="${COMMON_DIR}/redis_endpoint_common.sh"
PHP_SYSTEM_INSTALL_COMMON="${COMMON_DIR}/php_system_install_common.sh"
CLIENT_KEY_COMMON="${COMMON_DIR}/client_key_common.sh"
VENDOR_AUTOLOAD="${LARAVEL_DIR}/vendor/autoload.php"
BOOK_SEED_ARCHIVE="${LARAVEL_DIR}/database/seed_data/books/bible-corpus.unique.tar.xz.js"
BOOK_SEED_TOP_DIR="zeoinjesus-bible"
BOOK_SEED_SUBPATH="seed_data/books"
BOOTSTRAP_APP="${LARAVEL_DIR}/bootstrap/app.php"
RUNTIME_CONFIG_DIR=""
RUNTIME_CONFIGURATION_READY="no"

# Canonical init-ensure installer scripts
PHP_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/93_install_php.sh"
NODE_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/17_install_node_toolchain_26.sh"
P7ZIP_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/69_install_p7zip.sh"
DICTIONARIES_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/123_install_dictionaries.sh"
POSTGRES_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/75_install_postgresql.sh"
SSH_SETUP_SCRIPT="${INSTALL_SHELLS_DIR}/23_setup_ssh_remote.sh"
PUBLIC_IP_PROBE_SCRIPT="${INSTALL_SHELLS_DIR}/9_fix_dns.sh"
GVAR_COMMON_SCRIPT="${COMMON_DIR}/gvar_common.sh"
COMPOSER_VENDOR_COMMON="${COMMON_DIR}/composer_vendor_common.sh"
# GLOBAL_VAR_DIR comes from gvar_system_common.sh via common_functions.sh (sourced below).

# Per-app PostgreSQL databases (one per app connection; mirrors config/database.php
# $polyConnection(... , pgDatabase) targets). Created idempotently before migrate.
APP_DB_NAMES="core_node_main app_qy_v1_database awy_v0_database vipclub_v1_database server_manager_v1_database achat_v1_database code_mart_v1_database mcp_v1_database it_tools_v1_database bank_v1_database pdd_tool_v1_database ding_duo_duo_v1_database"

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
PHP_PDO_PGSQL_READY="no"
PHP_REDIS_READY="no"
LARAVEL_REDIS_INDEX_COMMAND="app_qy_v1:resource-index"
RUNTIME_EXTENSIONS_CHANGED="no"
COMPOSER_CMD=""
COMPOSER_COMMAND_READY="no"
NPX_BIN=""
PHP_CANDIDATE=""
COMPOSER_CANDIDATE=""
NPX_CANDIDATE=""
BUN_BIN=""
RUNTIME_DIR=""
IP_LIST=""
IP=""
OCTANE_AVAILABLE=""
WATCH_FLAG=""
PG_VER=""
DB_NAME=""
CURRENT_INSTALL_MODE=""
CURRENT_WEB_SERVER_PLANE=""
PG_READY_WAIT=""
NODE_GLOBAL_VAR_DIR=""
PG_DATA_ACTUAL=""
PG_CONF_ACTUAL=""
PG_DATA_SRC=""
WIN_SCRIPT_PATH=""
WIN_DRIVE=""
WIN_REST=""
GENERATED_ACCESS_CODE=""
OCTANE_RUNTIME_WATCH="${OCTANE_RUNTIME_WATCH:-1}"
OCTANE_RUNTIME_POLL="0"

# Background systemd service options (idempotent registration via systemd_service_manager).
# AS_SERVICE: yes|no|empty(ask). The service exec is a plane-specific runtime
# launcher (175_laravel_main_service_{frankenphp,nginx}.sh) that skips ALL init
# (domain setup, certs, installers) and only runs minimal convergence + octane.
# 175 init is the ONE-TIME setup; the service is "just start octane".
# LARAVEL_SERVICE_RUN=1 is no longer needed (the service launcher is init-free).
AS_SERVICE="${AS_SERVICE:-}"
LARAVEL_SERVICE_NAME_BASE="ncore-laravel"
LARAVEL_SERVICE_DESC_FRANKENPHP="laravel_main backend (FrankenPHP + Laravel Octane worker, h2/h3)"
LARAVEL_SERVICE_DESC_NGINX="laravel_main backend (octane:swoole, nginx proxy)"
# Laravel service resource policy (Laravel-specific; the manager's own
# defaults stay 20% + tiered memory): CPU 100% of one core (25% throttled
# 85% of periods), memory = 50% of total RAM floored at 200M, capped by
# LARAVEL_SERVICE_MEM_CAP_MB.
LARAVEL_SERVICE_CPU="${LARAVEL_SERVICE_CPU:-100%}"
LARAVEL_SERVICE_MEM="${LARAVEL_SERVICE_MEM:-}"
LARAVEL_SERVICE_MEM_CAP_MB="${LARAVEL_SERVICE_MEM_CAP_MB:-2048}"
# Unit policy of the request-serving plane (see laravel_service_converge_apply).
# interactive = CPUWeight/IOWeight + RAM-relative MemoryMax, no hard CPUQuota
# (LARAVEL_SERVICE_CPU applies to the capped profile only) and no MemoryHigh
# throttle; converge mode exec = restart only for restart-relevant unit lines.
LARAVEL_SERVICE_RESOURCE_PROFILE="${LARAVEL_SERVICE_RESOURCE_PROFILE:-interactive}"
LARAVEL_SERVICE_CONVERGE_MODE="${LARAVEL_SERVICE_CONVERGE_MODE:-exec}"
LARAVEL_SERVICE_DEFERRED_ENV_KEYS="${LARAVEL_SERVICE_DEFERRED_ENV_KEYS:-PHP_BIN}"
LARAVEL_SERVICE_RESTART_SEC="${LARAVEL_SERVICE_RESTART_SEC:-10s}"
LARAVEL_SERVICE_RESTART_STEPS="${LARAVEL_SERVICE_RESTART_STEPS:-6}"
LARAVEL_SERVICE_RESTART_MAX_DELAY_SEC="${LARAVEL_SERVICE_RESTART_MAX_DELAY_SEC:-300}"
LARAVEL_SERVICE_START_TIMEOUT="${LARAVEL_SERVICE_START_TIMEOUT:-900s}"
# cgroup keys whose `systemctl set-property` drop-ins (hand-applied hotfixes that
# vanish or diverge across reboots) are removed so the declared unit is the
# single owner of the limits.
LARAVEL_SERVICE_OVERRIDE_KEYS="${LARAVEL_SERVICE_OVERRIDE_KEYS:-CPUQuota|MemoryHigh}"
# yes = run the canonical PostgreSQL ensurer even when the cluster is healthy.
PG_ENSURE_FORCE="${PG_ENSURE_FORCE:-no}"
PG_APP_DATABASES_READY="no"
PG_APP_DATABASES_MISSING=""
PG_COLLATION_DRIFT="no"
POSTGRESQL_TUNING_COMMON="${COMMON_DIR}/postgresql_tuning_common.sh"
SERVICE_MANAGER="${COMMON_DIR}/systemd_service_manager.sh"
SELF="${SCRIPT_CURRENT_DIR}/175_laravel_main_start.sh"
SERVICE_FRANKENPHP_LAUNCHER="${DEBIAN_COM_DIR}/175_laravel_main_service_frankenphp.sh"
SERVICE_NGINX_LAUNCHER="${DEBIAN_COM_DIR}/175_laravel_main_service_nginx.sh"
SERVICE_EXEC_CMD=""
LARAVEL_SERVICE_PLANE=""
LARAVEL_SERVICE_PLANE_NAME=""
LARAVEL_SERVICE_PLANE_LAUNCHER=""
LARAVEL_SERVICE_EXEC_STOP=""
LARAVEL_SERVICE_TIMEOUT_STOP=""
LARAVEL_SERVICE_READY="no"
LARAVEL_SERVICE_ENABLED_STATE=""
LARAVEL_SERVICE_ACTIVE_STATE=""
_opposite_service=""
_old_service=""
ARG=""
HELP_REQUESTED="no"
SHOW_SUPER_CODE="no"
STORED_SUPER_CODE=""
GLOBAL_VAR_WRITE_READY="no"
PROMPT_ANSWER="no"
DOCKER_PUBLISHER_STOPPED="no"
PORT_READY="no"
POSTGRES_READY="no"
SYSTEMD_READY="no"
WSL_READY="no"
SSH_READY="no"
PSQL_BIN=""
DB_EXISTS=""
UNZIP_BIN=""
SEVEN_Z_BIN=""
NODE_BIN=""
CONFIG_CACHE_FILE="${LARAVEL_DIR}/bootstrap/cache/config.php"
PHP_MODULES=""
SWOOLE_MODULE=""

# Domain/SSL/nginx phases. RUNTIME_START: no skips the foreground server and the
# service-registration prompt (the old 132/133 behaviour). DOMAIN_SCOPE:
# all = certificates + nginx sites, certs = certificates only, none = skip.
RUNTIME_START="yes"
DOMAIN_SCOPE="all"
SKIP_SSH="no"

# Optional: converge the nexus-dash dev service and domain binding in every setup mode
# (idempotent; converge_nexus_dash_service in laravel_main_runtime_common.sh owns
# the fine-grained systemd registration for the dashboard).
INCLUDE_UI="${INCLUDE_UI:-}"
UI_START="${POLY_APPS_DIR}/pycore_laravel_wordnew_ui/scripts/start.sh"
UI_BINDING_CONVERGED="no"

# Optional: seed CodeMart demo accounts/projects via `php artisan sys:codemartinit`
# after sys:init. CODEMART_INIT=yes|no skips the interactive prompt (default N).
CODEMART_INIT="${CODEMART_INIT:-}"

. "$LARAVEL_13_UPGRADE_SCRIPT"
# Shared global var helpers (file-backed selectors: START_WEB_SERVER/WEB_SERVER_PLANE,
# USE_SUDO and CORE_NODE_DATA_DIR defaults).
. "$GVAR_COMMON_SCRIPT"
source "$COMMON_DIR/common_functions.sh"
init_global_vars >/dev/null 2>&1
FRANKENPHP_MANAGER_SCRIPT="${LINUX_DIR}/common/frankenphp_manager.sh"
FRANKENPHP_DOMAIN_COMMON_SCRIPT="${LINUX_DIR}/common/frankenphp_domain_common.sh"

# domain_setup_common pulls in the canonical file_ops_common.sh writer
# (write_file_if_changed + lazy_sudo) and stays sourced here: the UI domain
# binding (service-registration branch) renders through it.
. "$DOMAIN_SETUP_COMMON"
. "$COMPOSER_VENDOR_COMMON"
. "$FRANKENPHP_MANAGER_SCRIPT"
. "$REDIS_ENDPOINT_COMMON"
. "$PHP_SYSTEM_INSTALL_COMMON"
. "$CLIENT_KEY_COMMON"
# FrankenPHP plane live-apply library (fm_domain_caddy_apply_converged /
# fm_domain_workers_restart): the idempotent re-run branch applies the
# converged Caddy configuration to an ACTIVE plane service.
. "$FRANKENPHP_DOMAIN_COMMON_SCRIPT"
web_access_config_ensure

# Runtime port: central service contract (config/service_contract.json), with
source "$LARAVEL_MAIN_RUNTIME_COMMON"

# installer 23_setup_ssh_remote.sh carries its own persistent completion flag).
ensure_ssh_server() {
    SSH_READY="no"
    if [ "$SKIP_SSH" = "yes" ]; then
        SSH_READY="yes"
        return
    fi
    if [ -n "$(command -v sshd 2>/dev/null)" ] || [ -x /usr/sbin/sshd ]; then
        echo "SSH server present."
        SSH_READY="yes"
        return
    fi
    if [ ! -f "$SSH_SETUP_SCRIPT" ]; then
        echo "  Warning: SSH setup script missing: $SSH_SETUP_SCRIPT"
        return
    fi
    ask_default_yes "SSH server (sshd) not found. Install and configure remote SSH now?"
    if [ "$PROMPT_ANSWER" = "yes" ]; then
        bash "$SSH_SETUP_SCRIPT"
        if [ -n "$(command -v sshd 2>/dev/null)" ] || [ -x /usr/sbin/sshd ]; then
            SSH_READY="yes"
        else
            echo "  Warning: SSH server is still unavailable after setup."
        fi
    else
        echo "  SSH installation skipped."
    fi
}

# Ensure the bun runtime for the pycore_laravel_wordnew_ui dashboard (the
# frontend package scripts run via bun). Idempotent: bun on PATH short-circuits;
# otherwise the canonical node toolchain installer (which also provisions bun)
# is invoked, and the runtime upgrade is printed.
ensure_ui_bun_runtime() {
    BUN_BIN="$(resolve_tool_bin bun 2>/dev/null || true)"
    if [ -n "$BUN_BIN" ]; then
        echo "bun present -> dashboard frontend runtime ready ($BUN_BIN)."
        return
    fi
    if [ ! -f "$NODE_INSTALL_SCRIPT" ]; then
        echo "  *** ACTION REQUIRED: bun not found and node installer missing: $NODE_INSTALL_SCRIPT"
        return
    fi
    persist_global_var_file_value "INSTALL_NODE" "true"
    echo "bun not found. Invoking init-ensure installer (INSTALL_NODE=true, installs bun idempotently):"
    echo "  $NODE_INSTALL_SCRIPT"
    bash "$NODE_INSTALL_SCRIPT"
    hash -r 2>/dev/null
    BUN_BIN="$(resolve_tool_bin bun 2>/dev/null || true)"
    if [ -n "$BUN_BIN" ]; then
        echo "Upgraded the dashboard frontend runtime to bun: $BUN_BIN ($("$BUN_BIN" --version 2>/dev/null))"
    else
        echo "  *** ACTION REQUIRED: bun still unavailable after the installer."
        echo "  *** Manual (Debian/Ubuntu/WSL): npm i -g bun"
    fi
}

# Extract the book seed corpus (an xz-compressed tar disguised as .js) into
# <laravel_db>/seed_data/books/<top dir>/; Laravel's sys:init only reads the extracted
# files and names this step when they are missing. Idempotent: skipped when the corpus
# dir already holds a *.json. Extracted into a sibling temp dir on the same filesystem
# and moved into place, so a half-extracted corpus never passes the presence check.
ensure_book_seed_corpus() {
    local laravel_db="" books_dir="" corpus_dir="" stage_dir=""
    laravel_db="$(map_web_path "laravel_db")"
    if [ -z "$laravel_db" ]; then
        echo "  *** ACTION REQUIRED: laravel_db path did not resolve; book seed corpus not extracted." >&2
        return 1
    fi
    books_dir="${laravel_db}/${BOOK_SEED_SUBPATH}"
    corpus_dir="${books_dir}/${BOOK_SEED_TOP_DIR}"
    if [ -d "$corpus_dir" ] && [ -n "$(find "$corpus_dir" -maxdepth 1 -name '*.json' -print -quit 2>/dev/null)" ]; then
        echo "Book seed corpus present: $corpus_dir"
        return 0
    fi
    if [ ! -f "$BOOK_SEED_ARCHIVE" ]; then
        echo "  *** ACTION REQUIRED: book seed archive missing: $BOOK_SEED_ARCHIVE" >&2
        return 1
    fi
    if ! command -v xz >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1; then
        echo "xz/tar missing -> installing xz-utils and tar (apt)."
        $USE_SUDO apt-get install -y xz-utils tar || { echo "  *** ACTION REQUIRED: install xz-utils manually." >&2; return 1; }
    fi
    mkdir -p "${laravel_db}/seed_data" || return 1
    stage_dir="$(mktemp -d "${laravel_db}/seed_data/.books_extract.XXXXXX")" || return 1
    echo "Extracting book seed corpus: $BOOK_SEED_ARCHIVE -> $books_dir"
    if ! xz -dc "$BOOK_SEED_ARCHIVE" | tar -x -C "$stage_dir"; then
        echo "  *** ACTION REQUIRED: book seed extraction failed." >&2
        rm -rf "$stage_dir"
        return 1
    fi
    if [ -z "$(find "$stage_dir/$BOOK_SEED_TOP_DIR" -maxdepth 1 -name '*.json' -print -quit 2>/dev/null)" ]; then
        echo "  *** ACTION REQUIRED: archive did not contain $BOOK_SEED_TOP_DIR/*.json." >&2
        rm -rf "$stage_dir"
        return 1
    fi
    mkdir -p "$books_dir" || { rm -rf "$stage_dir"; return 1; }
    rm -rf "$corpus_dir"
    mv "$stage_dir/$BOOK_SEED_TOP_DIR" "$corpus_dir" || { rm -rf "$stage_dir"; return 1; }
    rm -rf "$stage_dir"
    $USE_SUDO chown -R --reference="$laravel_db" "${laravel_db}/seed_data"
    $USE_SUDO chmod -R a+rX "${laravel_db}/seed_data"
    echo "Book seed corpus ready: $corpus_dir"
}

laravel_main_run() {
# --ui-service converges ONLY the nexus-dash dashboard unit and returns (the
# Service Manager install/reinstall path; merged from the retired
# 176_laravel_ui_service.sh). Runs before any prerequisite work.
if [ "$UI_SERVICE_ONLY" = "yes" ]; then
    converge_nexus_dash_service
    return
fi

# --show-super-code runs HERE: it needs resolve_php + runtime_config_get,
# which are defined in the function section above. Cleanup trap is skipped
# for this read-only query.
if [ "$SHOW_SUPER_CODE" = "yes" ]; then
    trap - EXIT
    read_stored_super_code
    if [ -n "$STORED_SUPER_CODE" ]; then
        echo "Super code: $STORED_SUPER_CODE"
    fi
    return
fi

# Fail loud on an unreadable service contract: an empty PORT would start
# Octane on its default and render the domain backend as "http://127.0.0.1:".
if [ -z "$PORT" ]; then
    echo "ERROR: service contract unreadable (ports.laravel_api_backend empty; check config/service_contract.json and common/service_contract_common.sh)." >&2
    return
fi

echo "Initial directory (invocation): $ORIGINAL_DIR"
echo "Working directory (Laravel root): $LARAVEL_DIR"
echo "Repo root (dynamic): $REPO_ROOT"
echo ""

if [ ! -d "$LARAVEL_DIR" ]; then
    echo "ERROR: Laravel directory is missing: $LARAVEL_DIR"
    return
fi
cd "$LARAVEL_DIR"

# --- Ensure php (auto-install via init-ensure script if missing) ---
# Candidate access code for THIS provisioning run; persisted into the
# external runtime store by initialize_runtime_configuration_store (only
# when the store has none - the code is stable across runs, and the
# InstallationAccessCode.php repository file is never rewritten).
GENERATED_ACCESS_CODE="$(new_installation_access_code)"

set_php_runtime_plane "frankenphp"
set_web_server_plane "frankenphp"
resolve_php
if [ -z "$PHP_BIN" ]; then
    # Plane-aware init-ensure: 93_install_php.sh provisions php for the active
    # plane (frankenphp pipeline or system apt packages) and converges the
    # canonical /usr/local/bin/php link (php_link_common.sh).
    echo "php not found. Invoking init-ensure installer:"
    echo "  $PHP_INSTALL_SCRIPT --only=runtime,config"
    bash "$PHP_INSTALL_SCRIPT" --only=runtime,config
    resolve_php
    if [ -z "$PHP_BIN" ]; then
        echo "ERROR: PHP init-ensure installer failed or left php missing ($PHP_INSTALL_SCRIPT)"
        return
    fi
fi

# Redis-compatible endpoint first: its selector gvar decides whether phpredis
# joins the install-time extension set repaired by ensure_php_pdo_pgsql.
echo "Ensuring Redis endpoint (reuse running Redis/Dragonfly, start or install only when missing)..."
redis_endpoint_ensure

ensure_php_pdo_pgsql
if [ "$PHP_PDO_PGSQL_READY" != "yes" ]; then
    return
fi
ensure_php_redis

# --- Ensure composer (auto-install via init-ensure script if missing or wrapper broken) ---
resolve_composer
composer_command_healthy "$COMPOSER_CMD"
if [ "$COMPOSER_COMMAND_READY" != "yes" ]; then
    echo "composer not found. Invoking init-ensure installer:"
    echo "  $PHP_INSTALL_SCRIPT --only=composer"
    bash "$PHP_INSTALL_SCRIPT" --only=composer
    resolve_composer
    composer_command_healthy "$COMPOSER_CMD"
    if [ "$COMPOSER_COMMAND_READY" != "yes" ]; then
        echo "ERROR: Composer init-ensure installer failed or left composer missing ($PHP_INSTALL_SCRIPT)"
        return
    fi
fi

echo "Using php:      $PHP_BIN"
echo "Using composer: $COMPOSER_CMD"
echo "Web server plane: $CURRENT_WEB_SERVER_PLANE"

# --- Ensure the SSH server (idempotent; skipped with --skip-ssh) ---
ensure_ssh_server

# --- Best-effort: ensure unzip (composer warns and is slower without it) ---
UNZIP_BIN="$(command -v unzip 2>/dev/null)"
if [ -z "$UNZIP_BIN" ]; then
    if [ -n "$(command -v apt-get 2>/dev/null)" ]; then
        echo "unzip not found; installing (best-effort)..."
        apt-get update -y >/dev/null 2>&1
        apt-get install -y unzip >/dev/null 2>&1
        UNZIP_BIN="$(command -v unzip 2>/dev/null)"
        if [ -z "$UNZIP_BIN" ]; then
            echo "  Warning: unzip is still unavailable; Composer will use PHP zip if available."
        fi
    fi
fi

# --- Ensure Laravel runtime directories exist and are writable ---
echo "Ensuring Laravel runtime directories..."
for RUNTIME_DIR in "${LARAVEL_RUNTIME_DIRS[@]}"; do
    mkdir -p "${LARAVEL_DIR}/${RUNTIME_DIR}"
done
chmod -R u+rwX,g+rwX "${LARAVEL_DIR}/bootstrap/cache" "${LARAVEL_DIR}/storage" 2>/dev/null

upgrade_laravel_to_13
if [ "$LARAVEL_13_UPGRADE_READY" != "yes" ]; then
    return
fi

# Ensure vendor/ matches composer.lock AND the autoloader actually loads before
# any artisan command (file existence alone does not prove vendor integrity).
ensure_composer_vendor "$LARAVEL_DIR"
if [ "$COMPOSER_VENDOR_AUTOLOAD_OK" != "yes" ]; then
    echo "ERROR: composer vendor setup failed"
    return
fi

# Initialize each canonical runtime-store value and probe the resulting state
# before any Artisan command. Function status is not used as business data.
initialize_runtime_configuration_store
if [ "$RUNTIME_CONFIGURATION_READY" != "yes" ]; then
    echo "ERROR: Runtime configuration store initialization failed."
    return
fi

# --- PostgreSQL cross-environment sync adapter ---
_PG_SYNC_ADAPTER="${REPO_ROOT}/pycore/bootstrap/pg_sync.py"
if command -v python3 >/dev/null 2>&1 && [ -f "$_PG_SYNC_ADAPTER" ]; then
    python3 "$_PG_SYNC_ADAPTER" --startup
fi
unset _PG_SYNC_ADAPTER

# --- Database: PostgreSQL (forced on Linux), localhost-only, one DB per app ---
echo "Ensuring PostgreSQL (localhost-only, per-app databases)..."

# Resolve sudo locally. Global-variable persistence uses persist_global_var_file_value()
# (set_global_var when available) so we do not inject menu state through runtime env.
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# dd.sh priority: force START_POSTGRESQL=true; only raise INSTALL_MODE to 'server'
# when unset/base so an explicit dd.sh choice (server/full/desktop) is preserved.
persist_global_var_file_value "START_POSTGRESQL" "true"
CURRENT_INSTALL_MODE=""
if [ -f "$GLOBAL_VAR_DIR/INSTALL_MODE" ]; then
    CURRENT_INSTALL_MODE="$(tr -d '[:space:]' < "$GLOBAL_VAR_DIR/INSTALL_MODE" 2>/dev/null)"
fi
if [ -z "$CURRENT_INSTALL_MODE" ] || [ "$CURRENT_INSTALL_MODE" = "base" ]; then
    persist_global_var_file_value "INSTALL_MODE" "server"
fi

# Probe first, repair only what is broken: a cluster that accepts connections
# and holds every per-app database is left untouched (the ensurer stops and
# restarts the cluster on its repair paths, which drops every Laravel worker
# connection). The canonical ensurer runs only for a missing/unhealthy
# cluster, or when PG_ENSURE_FORCE=yes.
pg_is_ready
if [ "$POSTGRES_READY" = "yes" ]; then
    pg_app_databases_present
    pg_collation_drift_present
fi
if [ "$POSTGRES_READY" = "yes" ] && [ "$PG_APP_DATABASES_READY" = "yes" ] && [ "$PG_COLLATION_DRIFT" != "yes" ] && [ "$PG_ENSURE_FORCE" != "yes" ]; then
    echo "  PostgreSQL healthy (accepting connections, all per-app databases present): canonical ensurer skipped; the running cluster is not touched"
elif [ -f "$POSTGRES_INSTALL_SCRIPT" ]; then
    if [ "$POSTGRES_READY" = "yes" ]; then
        echo "  PostgreSQL is up but per-app databases are missing (${PG_APP_DATABASES_MISSING}); running the canonical ensurer"
    fi
    echo "  Running canonical PostgreSQL ensurer (install + mount-fix + data-dir reconcile):"
    echo "    $POSTGRES_INSTALL_SCRIPT"
    bash "$POSTGRES_INSTALL_SCRIPT"
else
    echo "  *** ACTION REQUIRED: PostgreSQL ensurer missing: $POSTGRES_INSTALL_SCRIPT"
    echo "  *** Install manually: sudo apt-get install -y postgresql postgresql-contrib"
fi

# Idempotent WSL-safe start: each launcher is followed by a fresh state probe.
pg_is_ready
if [ "$POSTGRES_READY" != "yes" ]; then
    echo "  PostgreSQL not accepting connections yet; attempting to start..."
    PG_VER="$(ls -1 /etc/postgresql 2>/dev/null | sed -n '/^[0-9]\+$/p' | sort -n | tail -1)"
    ${USE_SUDO:-} systemctl start postgresql 2>/dev/null
    pg_is_ready
    if [ "$POSTGRES_READY" != "yes" ]; then
        ${USE_SUDO:-} service postgresql start 2>/dev/null
        pg_is_ready
    fi
    if [ "$POSTGRES_READY" != "yes" ] && [ -n "$PG_VER" ]; then
        ${USE_SUDO:-} pg_ctlcluster "$PG_VER" main start 2>/dev/null
        pg_is_ready
    fi
    for PG_READY_WAIT in 1 2 3 4 5 6 7 8 9 10; do
        pg_is_ready
        if [ "$POSTGRES_READY" = "yes" ]; then
            break
        fi
        sleep 1
    done
fi

# Create each per-app database if missing (idempotent; peer auth as postgres).
PSQL_BIN="$(command -v psql 2>/dev/null)"
pg_is_ready
if [ -n "$PSQL_BIN" ] && [ "$POSTGRES_READY" = "yes" ]; then
    for DB_NAME in $APP_DB_NAMES; do
        DB_EXISTS="$(pg_run_as_postgres "$PSQL_BIN" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | tr -d '[:space:]')"
        if [ "$DB_EXISTS" != "1" ]; then
            echo "  Creating database: ${DB_NAME}"
            pg_run_as_postgres createdb "${DB_NAME}" 2>/dev/null
            DB_EXISTS="$(pg_run_as_postgres "$PSQL_BIN" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | tr -d '[:space:]')"
            if [ "$DB_EXISTS" != "1" ]; then
                echo "    Warning: failed to create ${DB_NAME}"
            fi
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

# Managed PostgreSQL tuning (idempotent drop-in, reload only; postmaster-context
# settings are reported as pending a restart and never restarted here).
if [ "$POSTGRES_READY" = "yes" ] && [ -f "$POSTGRESQL_TUNING_COMMON" ]; then
    . "$POSTGRESQL_TUNING_COMMON"
    pg_tuning_ensure
fi

echo "Clearing route cache..."
"$PHP_BIN" artisan route:clear

echo "Listing routes..."
"$PHP_BIN" artisan route:list

# Runtime credentials must never be serialized into Laravel's configuration cache.
"$PHP_BIN" artisan config:clear >/dev/null 2>&1
if [ -f "$CONFIG_CACHE_FILE" ]; then
    echo "  Warning: Laravel configuration cache remains present: $CONFIG_CACHE_FILE"
fi

# --- Ensure Swoole (nginx plane ONLY: the Octane swoole driver; the
# frankenphp plane embeds its app server in the static binary - Swoole is
# never probed, installed or required there). The `php -m` module probe runs
# only on the nginx plane: the frankenphp plane's canonical php link resolves
# to php-zts, but probing modules there is unnecessary and adds noise. ---
if [ "$CURRENT_WEB_SERVER_PLANE" = "frankenphp" ]; then
    echo "frankenphp plane -> Swoole not required (octane:frankenphp embeds the app server)."
else
    PHP_MODULES="$("$PHP_BIN" -m 2>/dev/null)"
    SWOOLE_MODULE="$(printf '%s\n' "$PHP_MODULES" | grep -i -x 'swoole')"
    if [ -n "$SWOOLE_MODULE" ]; then
        OCTANE_AVAILABLE=1
        echo "Swoole extension present -> Octane runtime available."
    else
        echo "Swoole extension not loaded. Invoking init-ensure installer:"
        echo "  $PHP_INSTALL_SCRIPT --only=swoole"
        if [ -f "$PHP_INSTALL_SCRIPT" ]; then
            bash "$PHP_INSTALL_SCRIPT" --only=swoole
            PHP_MODULES="$("$PHP_BIN" -m 2>/dev/null)"
            SWOOLE_MODULE="$(printf '%s\n' "$PHP_MODULES" | grep -i -x 'swoole')"
            if [ -n "$SWOOLE_MODULE" ]; then
                OCTANE_AVAILABLE=1
                echo "Swoole installed -> Octane runtime available."
            else
                OCTANE_AVAILABLE=""
                echo "  Warning: Swoole still not loaded after installer; using non-Octane fallback."
            fi
        else
            echo "  Warning: Swoole installer missing: $PHP_INSTALL_SCRIPT"
            echo "  Manual (Debian/Ubuntu/WSL): bash $PHP_INSTALL_SCRIPT --only=swoole"
        fi
    fi
fi

# --- Ensure 7z (p7zip) for dictionary translation extraction ---
SEVEN_Z_BIN="$(command -v 7z 2>/dev/null)"
if [ -z "$SEVEN_Z_BIN" ]; then
    SEVEN_Z_BIN="$(command -v 7za 2>/dev/null)"
fi
if [ -z "$SEVEN_Z_BIN" ]; then
    SEVEN_Z_BIN="$(command -v 7zr 2>/dev/null)"
fi
if [ -n "$SEVEN_Z_BIN" ]; then
    echo "7z present -> dictionary translations can be extracted."
else
    echo "7z not found. Invoking init-ensure installer:"
    echo "  $P7ZIP_INSTALL_SCRIPT"
    if [ -f "$P7ZIP_INSTALL_SCRIPT" ]; then
        bash "$P7ZIP_INSTALL_SCRIPT"
        SEVEN_Z_BIN="$(command -v 7z 2>/dev/null)"
        if [ -z "$SEVEN_Z_BIN" ]; then
            SEVEN_Z_BIN="$(command -v 7za 2>/dev/null)"
        fi
        if [ -z "$SEVEN_Z_BIN" ]; then
            SEVEN_Z_BIN="$(command -v 7zr 2>/dev/null)"
        fi
        if [ -n "$SEVEN_Z_BIN" ]; then
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

# --- Ensure the offline ECDICT word dictionary (shared stardict.db) ---
# The same database backs the pycore translator AND the Laravel
# /api/app_qy_v1/ecdict/* endpoints. The installer is idempotent (verifies the
# db and skips when present) and never fails this setup fatally.
if [ -f "$DICTIONARIES_INSTALL_SCRIPT" ]; then
    echo "Ensuring offline ECDICT dictionary (idempotent):"
    echo "  $DICTIONARIES_INSTALL_SCRIPT"
    bash "$DICTIONARIES_INSTALL_SCRIPT"
else
    echo "  Warning: dictionary installer missing: $DICTIONARIES_INSTALL_SCRIPT"
fi

# --- Book seed corpus (read by sys:init; extraction lives here, not in PHP) ---
ensure_book_seed_corpus || echo "  Warning: book seed corpus is not ready; sys:init will report step 175."

# --- Ensure Node.js BEFORE sys:init (composer dev / UI tooling; on the
# nginx plane also the Octane --watch chokidar dependency) ---
# Prefer the gvar absolute NODE_BIN (install-time PATH may be minimal); fall back to PATH lookup.
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then NODE_BIN="$(resolve_tool_bin node 2>/dev/null || command -v node 2>/dev/null || true)"; fi
if [ -z "$NODE_BIN" ]; then
    if [ -f "$NODE_INSTALL_SCRIPT" ]; then
        NODE_GLOBAL_VAR_DIR="$GLOBAL_VAR_DIR"
        persist_global_var_file_value "INSTALL_NODE" "true"
        echo "node not found/working. Invoking init-ensure installer (INSTALL_NODE=true):"
        echo "  $NODE_INSTALL_SCRIPT"
        bash "$NODE_INSTALL_SCRIPT"
        hash -r 2>/dev/null
    else
        echo "  Warning: node installer missing: $NODE_INSTALL_SCRIPT"
    fi
fi
resolve_npx
# Prefer the gvar absolute NODE_BIN (install-time PATH may be minimal); fall back to PATH lookup.
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then NODE_BIN="$(resolve_tool_bin node 2>/dev/null || command -v node 2>/dev/null || true)"; fi
if [ "$CURRENT_WEB_SERVER_PLANE" = "frankenphp" ]; then
    if [ -n "$NODE_BIN" ]; then
        echo "node present -> composer dev / UI tooling ready (hot-reload is FrankenPHP worker 'watch': no Node/chokidar needed)."
    else
        echo "  *** node unavailable -> composer dev and UI tooling degrade (hot-reload itself is unaffected: FrankenPHP worker 'watch')."
    fi
else
    if [ -n "$NODE_BIN" ]; then
        echo "node present -> Octane hot-reload chokidar can be enabled."
    else
        echo "  *** node still unavailable -> Octane runs without --watch hot reload."
        echo "  *** Install manually: INSTALL_NODE=true bash $NODE_INSTALL_SCRIPT"
    fi
fi

# --- Shared client key (signed machine routes; idempotent: decrypt or generate) ---
client_key_ensure_ready

# Ensure the mapped web data dir is owned by the invoking user BEFORE sys:init.
REAL_USER="${SUDO_USER:-$(id -un)}"
LARAVEL_DATA_DIR="$(cd "$LARAVEL_DIR" && RC_ARG_AUTOLOAD="$VENDOR_AUTOLOAD" RC_ARG_BOOTSTRAP="$BOOTSTRAP_APP" php_script_run 'require getenv("RC_ARG_AUTOLOAD"); require getenv("RC_ARG_BOOTSTRAP"); echo \App\Providers\PathMapper::mapWebPath("laravel_data_dir");')"
if [ -n "$REAL_USER" ] && [ "$REAL_USER" != "root" ] && [ -n "$LARAVEL_DATA_DIR" ] && [ -d "$LARAVEL_DATA_DIR" ]; then
    echo "Ensuring ownership of web data dir for '$REAL_USER': $LARAVEL_DATA_DIR"
    $USE_SUDO chown -R "$REAL_USER:$REAL_USER" "$LARAVEL_DATA_DIR" 2>/dev/null
fi

echo "Initializing system (php artisan sys:init)..."
"$PHP_BIN" artisan sys:init
ensure_laravel_redis_index

# --- Optional: CodeMart demo data (sys:codemartinit) ---
# sys:init already applies the idempotent CodeMart demo dataset unless the
# environment is production or CODEMART_SEED_DEMO=false. This explicit run
# seeds it regardless (e.g. on production installs). Unconditional y/N prompt
# (defaults to N; safe non-interactively); CODEMART_INIT=yes|no skips it.
if [ -z "$CODEMART_INIT" ]; then
    ask_default_no "Force CodeMart demo data seeding (php artisan sys:codemartinit)?"
    if [ "$PROMPT_ANSWER" = "yes" ]; then
        CODEMART_INIT="yes"
    else
        CODEMART_INIT="no"
    fi
fi
if [ "$CODEMART_INIT" = "yes" ]; then
    echo "Seeding CodeMart demo data (php artisan sys:codemartinit)..."
    "$PHP_BIN" artisan sys:codemartinit
fi

# --- Public-reachability probe before domain convergence (idempotent): the
# interface-based classifier reads a 1:1-NAT VPS as "LAN"; 9_fix_dns.sh
# --detect-public-ip proves inbound-80 reachability ONCE and caches
# HAS_PUBLIC_IP/PUBLIC_IP in the global-var store. A cached/confirmed public
# server forces the domain plane into server mode (public certificates via
# DNS-01) instead of the LAN mkcert fallback. The probe only ever runs (and
# only briefly interrupts port 80) while the constant is absent. ---
if [ "$DOMAIN_SCOPE" != "none" ] && [ -f "$PUBLIC_IP_PROBE_SCRIPT" ]; then
    bash "$PUBLIC_IP_PROBE_SCRIPT" --detect-public-ip || true
    if [ "$(get_var HAS_PUBLIC_IP "")" = "yes" ]; then
        export DOMAIN_SETUP_NET_MODE="server"
        echo "Public reachability confirmed (HAS_PUBLIC_IP=yes, PUBLIC_IP=$(get_var PUBLIC_IP "")); domain plane forced to server mode."
    fi
fi

# --- Plane-specific web/domain phases (merged 132_prepare_domain_setup +
# 133_setup_domain_ssl behaviour): dispatched per plane, idempotent and
# prompt-driven repair/upgrade on the nginx plane; DNS-01 readiness (no
# nginx, no certbot - Caddy ACME owns TLS) on the frankenphp plane ---
if [ "$DOMAIN_SCOPE" != "none" ]; then
    echo ""
    if [ "$CURRENT_WEB_SERVER_PLANE" = "frankenphp" ]; then
        echo "Converging frankenphp plane domains (DNSPod secrets + DNS-01 readiness; nginx/certbot skipped)..."
        PORT="$PORT" PHP_BIN="$PHP_BIN" LARAVEL_DIR="$LARAVEL_DIR" \
            DOMAIN_SCOPE="$DOMAIN_SCOPE" \
            /bin/bash "$LARAVEL_START_FRANKENPHP_SUB" domains
    else
        echo "Converging nginx plane domains (nginx + certbot + DNSPod sites)..."
        PORT="$PORT" PHP_BIN="$PHP_BIN" LARAVEL_DIR="$LARAVEL_DIR" \
            DOMAIN_SCOPE="$DOMAIN_SCOPE" \
            /bin/bash "$LARAVEL_START_NGINX_SUB" domains
    fi
fi

ensure_ui_domain_binding

if [ "$RUNTIME_START" != "yes" ]; then
    echo ""
    echo "Setup-only mode complete (runtime start skipped: --domains-only/--ssl-only)."
    return
fi

# --- Optional: nexus-dash UI background service (frontend deployment) ---
# Unconditional y/N prompt: the frontend deployment must be offered no matter
# how the previous steps went (domain setup result, re-run convergence, or the
# laravel service choice). Requires systemd; defaults to N on a TTY and stays
# N without one (non-interactive safe).
if [ -z "$INCLUDE_UI" ]; then
    systemd_available
    if [ "$SYSTEMD_READY" = "yes" ]; then
        ask_default_no "Also add the pycore_laravel_wordnew_ui dashboard to a background service?"
        if [ "$PROMPT_ANSWER" = "yes" ]; then
            INCLUDE_UI="yes"
        else
            INCLUDE_UI="no"
        fi
    else
        INCLUDE_UI="no"
    fi
fi
if [ "$INCLUDE_UI" = "yes" ]; then
    ensure_ui_bun_runtime
    ensure_ui_domain_binding
fi

# --- Declarative unit convergence (idempotent re-run): an existing plane unit
# is converged in ONE pass - the unit file is rewritten only on drift, the
# service is enabled/started when needed and restarted ONLY when a
# restart-relevant unit line changed; resource-limit/policy drift is applied
# live by daemon-reload. A running plane then gets the least-disruptive live
# apply (laravel_runtime_live_apply): Caddy admin /load, graceful workers
# restart only for code newer than the workers, unit restart only for a
# changed PHP extension set or a provably wedged unit. Foreground launches
# never compete with an active unit.
_resolve_laravel_service_plane
# PHP_BIN is NOT pinned in the unit: the plane launcher resolves `php` from
# PATH on every start (the converged canonical link), so a later php link
# convergence can never leave a dead binary path in the systemd environment;
# a legacy pin is a behavior-neutral deferred key (LARAVEL_SERVICE_DEFERRED_ENV_KEYS).
# WORKERS and MAX_REQUESTS use the runtime launcher's own defaults; the site
# host is resolved from the central service contract on every start.
SERVICE_EXEC_CMD="PORT=${PORT} LARAVEL_DIR=${LARAVEL_DIR} bash ${LARAVEL_SERVICE_PLANE_LAUNCHER}"
LARAVEL_SERVICE_UNIT_FILE="/etc/systemd/system/${LARAVEL_SERVICE_PLANE_NAME}.service"
if [ -f "$LARAVEL_SERVICE_UNIT_FILE" ]; then
    if [ -z "$LARAVEL_SERVICE_MEM" ]; then
        LARAVEL_SERVICE_MEM="$(compute_mem_limit "$LARAVEL_SERVICE_MEM_CAP_MB")"
    fi
    echo "Plane service ${LARAVEL_SERVICE_PLANE_NAME} exists; converging declaratively (profile=${LARAVEL_SERVICE_RESOURCE_PROFILE}, MemoryMax=${LARAVEL_SERVICE_MEM})..."
    register_laravel_service "$SERVICE_EXEC_CMD"
    if [ "$LARAVEL_SERVICE_READY" = "yes" ]; then
        laravel_runtime_live_apply
        echo "  Manage:  systemctl {status|restart|stop} $LARAVEL_SERVICE_PLANE_NAME"
        return
    fi
    echo "  Warning: ${LARAVEL_SERVICE_PLANE_NAME} did not come up; inspect: journalctl -u ${LARAVEL_SERVICE_PLANE_NAME} -n 100"
fi

echo "Detecting local IPs (excluding loopback)..."

if command -v ip >/dev/null 2>&1; then
    IP_LIST=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -vE '^127\.|^0\.')
elif command -v ifconfig >/dev/null 2>&1; then
    IP_LIST=$(ifconfig | grep -E 'inet [0-9]' | grep -v 127.0.0.1 | awk '{print $2}' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$')
else
    IP_LIST=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -vE '^127\.|^0\.|^$')
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
is_wsl
if [ "$WSL_READY" = "yes" ]; then
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
resolve_npx
if [ -z "$NPX_BIN" ]; then
    if [ -f "$NODE_INSTALL_SCRIPT" ]; then
        echo "npx not found. Invoking init-ensure installer:"
        echo "  $NODE_INSTALL_SCRIPT"
        bash "$NODE_INSTALL_SCRIPT"
        resolve_npx
        if [ -z "$NPX_BIN" ]; then
            echo "  Warning: npx is still unavailable after the installer."
        fi
    fi
fi

# --- Ensure the runtime port is free (idempotent restart) ---
echo "Ensuring port ${PORT} is free..."
ensure_port_free "$PORT" "$PHP_BIN"
if [ "$PORT_READY" != "yes" ]; then
    echo "  Continuing; the runtime may fail to bind if the port is truly occupied."
fi

# schedule:work binds no port -- its own idempotent cleanup (single tick source).
ensure_schedule_work_stopped

# --- Optional background service registration (AFTER the full prerequisite setup) ---
# The service ExecStart is a plane-specific runtime launcher that does only
# minimal convergence + octane (NO init, NO domain setup, NO installers).
# 175 init is the ONE-TIME setup; the service is "just start octane".
systemd_available
if [ "$AS_SERVICE" != "no" ] && [ "$SYSTEMD_READY" != "yes" ]; then
    echo ""
    is_wsl
    if [ "$WSL_READY" = "yes" ]; then
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
    _resolve_laravel_service_plane
    ask_default_yes "Prerequisites ready. Add laravel_main to a background systemd service (${LARAVEL_SERVICE_PLANE_NAME}, via systemd_service_manager)?"
    if [ "$PROMPT_ANSWER" = "yes" ]; then
        AS_SERVICE="yes"
    else
        AS_SERVICE="no"
    fi
fi
if [ "$AS_SERVICE" = "yes" ]; then
    if [ -z "$LARAVEL_SERVICE_MEM" ]; then
        LARAVEL_SERVICE_MEM="$(compute_mem_limit "$LARAVEL_SERVICE_MEM_CAP_MB")"
    fi
    _resolve_laravel_service_plane
    echo "Registering systemd service $LARAVEL_SERVICE_PLANE_NAME (plane=$LARAVEL_SERVICE_PLANE, profile=$LARAVEL_SERVICE_RESOURCE_PROFILE, MemoryMax=$LARAVEL_SERVICE_MEM, cap ${LARAVEL_SERVICE_MEM_CAP_MB}M)..."
    echo "  ExecStart: $LARAVEL_SERVICE_PLANE_LAUNCHER (runtime-only, init-free, hot-reload default)"

    # Idempotent opposite-plane cleanup: remove the OTHER plane's service when
    # registering this one (frankenphp <-> nginx, legacy main). File-state
    # driven: no-op when the unit does not exist.
    _opposite_service=""
    case "$LARAVEL_SERVICE_PLANE" in
        frankenphp) _opposite_service="${LARAVEL_SERVICE_NAME_BASE}-nginx" ;;
        nginx)      _opposite_service="${LARAVEL_SERVICE_NAME_BASE}-frankenphp" ;;
        *)          _opposite_service="" ;;
    esac
    for _old_service in "$_opposite_service" "${LARAVEL_SERVICE_NAME_BASE}-main"; do
        if [ -n "$_old_service" ] && [ -f "/etc/systemd/system/${_old_service}.service" ]; then
            echo "  Removing opposite-plane service: $_old_service"
            ${USE_SUDO:-} systemctl stop "$_old_service" 2>/dev/null
            ${USE_SUDO:-} systemctl disable "$_old_service" 2>/dev/null
            ${USE_SUDO:-} rm -f "/etc/systemd/system/${_old_service}.service"
        fi
    done
    ${USE_SUDO:-} systemctl daemon-reload 2>/dev/null

    register_laravel_service "$SERVICE_EXEC_CMD"
    if [ "$LARAVEL_SERVICE_READY" = "yes" ]; then
        echo "Service $LARAVEL_SERVICE_PLANE_NAME registered and started."
        echo "  Manage:  systemctl {status|restart|stop} $LARAVEL_SERVICE_PLANE_NAME"
        echo "  Boot:    systemctl is-enabled $LARAVEL_SERVICE_PLANE_NAME"
        echo "  Logs:    journalctl -u $LARAVEL_SERVICE_PLANE_NAME -f"
        return
    else
        echo "Service registration failed; continuing in the foreground."
    fi
fi

# --- Start runtime ---
# Plane dispatch (shared php_runtime_plane from gvar_common.sh): the
# frankenphp plane runs the single octane:frankenphp branch (HTTPS 443/h3 +
# Mercure hub, NO Swoole - the app server is embedded in the binary); the
# nginx plane keeps the system-PHP Swoole branch on the loopback backend
# (node 'composer dev:win' / node-free serve fallbacks when Swoole is
# unavailable). In every mode OctaneTimerServiceProvider drives the SAME
# TimerTasks/* through a single, never duplicated tick source.
if [ "$CURRENT_WEB_SERVER_PLANE" = "frankenphp" ]; then
    PORT="$PORT" PHP_BIN="$PHP_BIN" LARAVEL_DIR="$LARAVEL_DIR" \
        DOMAIN_SCOPE="$DOMAIN_SCOPE" \
        LARAVEL_RUNTIME_FRANKENPHP_SCRIPT="$LARAVEL_RUNTIME_FRANKENPHP_SCRIPT" \
        OCTANE_RUNTIME_WATCH="$OCTANE_RUNTIME_WATCH" OCTANE_RUNTIME_POLL="$OCTANE_RUNTIME_POLL" \
        /bin/bash "$LARAVEL_START_FRANKENPHP_SUB" runtime
else
    PORT="$PORT" PHP_BIN="$PHP_BIN" COMPOSER_CMD="$COMPOSER_CMD" NPX_BIN="$NPX_BIN" \
        LARAVEL_DIR="$LARAVEL_DIR" \
        LARAVEL_RUNTIME_NGINX_SCRIPT="$LARAVEL_RUNTIME_NGINX_SCRIPT" \
        OCTANE_RUNTIME_WATCH="$OCTANE_RUNTIME_WATCH" OCTANE_RUNTIME_POLL="$OCTANE_RUNTIME_POLL" \
        /bin/bash "$LARAVEL_START_NGINX_SUB" runtime
fi
}

if [ "$HELP_REQUESTED" != "yes" ]; then
    laravel_main_run
fi
