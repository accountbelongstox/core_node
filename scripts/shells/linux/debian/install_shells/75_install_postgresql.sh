#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
POSTGRESQL_INSTALL_COMMON="$SCRIPT_DIR/75_postgresql_install_common.sh"
source "$COMMON_DIR/common_functions.sh"
source "$POSTGRESQL_INSTALL_COMMON"

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Declare all variables at the beginning
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
SCRIPT_INDEX="47"
START_POSTGRESQL=""
INSTALL_MODE=""
POSTGRESQL_VERSION=""
POSTGRESQL_DATA_DIR=""
POSTGRESQL_CONFIG_DIR=""
POSTGRESQL_LOG_DIR=""
POSTGRESQL_USER="postgres"
POSTGRESQL_SERVICE_NAME="postgresql"
# WSL persistence: loop-mount point for the D-drive ext4 image (see
# wsl_mount_pg_image). Resolved from the central mapping (map_web_path "pg_mount")
# AFTER gvar_common.sh is sourced -- never hardcoded here.
PG_D_MOUNT=""
# Per-app databases to provision. SOURCE OF TRUTH: Laravel's config/database.php
# (its polyConnection('NAME') calls), so adding an app there auto-creates its DB here
# and this list cannot drift -- it previously omitted pdd_tool_v1_database, which made
# that app's migrations fail with 'database "pdd_tool_v1_database" does not exist'. We
# union the config-declared names with core_node_main plus the legacy DBs that predate
# config (awy_v0/bank_v1/vipclub_v1); if the config is unreadable we fall back to a
# fixed (corrected) list. Same on WSL/Debian/Ubuntu/Kali.
APP_DATABASES="$(
    _cfg="$SCRIPT_DIR/../../../../../poly_apps/laravel_main/config/database.php"
    if [ -f "$_cfg" ]; then
        printf '%s\n' \
            $(grep -oE "polyConnection\('[a-z0-9_]+'\)" "$_cfg" | grep -oE "'[a-z0-9_]+'" | tr -d "'") \
            core_node_main awy_v0_database bank_v1_database vipclub_v1_database \
            | sort -u | tr '\n' ' '
    fi
)"
[ -z "${APP_DATABASES// /}" ] && APP_DATABASES="core_node_main app_qy_v1_database awy_v0_database vipclub_v1_database server_manager_v1_database achat_v1_database code_mart_v1_database mcp_v1_database it_tools_v1_database bank_v1_database pdd_tool_v1_database ding_duo_duo_v1_database"

# Source gvar_common.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Initialize variables
SCRIPT_INDEX="47"
START_POSTGRESQL=$(get_var "START_POSTGRESQL" "false")
INSTALL_MODE=$(get_var "INSTALL_MODE")
# Major version to install on Debian via the official PGDG repo (override with the
# global var POSTGRESQL_VERSION). On Ubuntu the distro-default `postgresql`
# metapackage is used and the ACTUAL version is auto-detected after install.
POSTGRESQL_VERSION="$(get_var "POSTGRESQL_VERSION" "15")"
# Use compile_dir for database data and logs (auto-selects based on environment)
POSTGRESQL_DATA_DIR=$(map_web_path "compile_dir" "postgresql/data")
POSTGRESQL_CONFIG_DIR=""
POSTGRESQL_LOG_DIR=$(map_web_path "compile_dir" "postgresql/logs")
# Loop-mount target for the WSL D-drive image, from the central mapping (bash
# gvar_common.sh + Python system_paths.py both define the "pg_mount" key).
PG_D_MOUNT=$(map_web_path "pg_mount")

echo "[$SCRIPT_INDEX] PostgreSQL Database Management Script"
echo "[$SCRIPT_INDEX] START_POSTGRESQL: $START_POSTGRESQL"


# Function to install PostgreSQL
install_postgresql() {
    echo "[$SCRIPT_INDEX] Installing PostgreSQL $POSTGRESQL_VERSION..."

    local os_id=""
    local use_pgdg=false
    os_id="$(os_release_id)"

    # Debian 12/13: prefer the official PGDG repo so a KNOWN major version installs
    # regardless of what bookworm/trixie ship. Best-effort -> distro repo on failure.
    if [ "$os_id" = "debian" ]; then
        if ensure_pgdg_repository; then
            use_pgdg=true
        fi
    fi

    # Update package list
    $USE_SUDO apt update

    # PGDG path: install the pinned version (postgresql-<ver> bundles the contrib
    # modules; postgresql-client-<ver> + postgresql-common are pulled as deps).
    if [ "$use_pgdg" = true ]; then
        if $USE_SUDO apt install -y "postgresql-$POSTGRESQL_VERSION" "postgresql-client-$POSTGRESQL_VERSION"; then
            echo "[$SCRIPT_INDEX] PostgreSQL $POSTGRESQL_VERSION installed from PGDG (Debian)"
            return 0
        fi
        echo "[$SCRIPT_INDEX] PGDG install failed; falling back to distro packages..."
    fi

    # Distro default (Ubuntu, or Debian fallback when PGDG is unavailable).
    if $USE_SUDO apt install -y postgresql postgresql-contrib postgresql-client; then
        echo "[$SCRIPT_INDEX] PostgreSQL installed successfully"
        return 0
    else
        echo "[$SCRIPT_INDEX] Failed to install PostgreSQL"
        return 1
    fi
}

# Function to configure PostgreSQL using Debian/Ubuntu cluster tools
configure_postgresql() {
    echo "[$SCRIPT_INDEX] Configuring PostgreSQL (Debian/Ubuntu cluster)..."

    # Self-heal: the "already installed" path in main() calls us directly, and a
    # client-only box reaches here with NO cluster tools and NO postgres user.
    # Without this, pg_createcluster ("command not found") + chown postgres:postgres
    # ("invalid user") both fail. Ensure the SERVER (postgresql + postgresql-common,
    # which also creates the postgres user and a default cluster) is installed first.
    if ! command_exists pg_createcluster || ! id postgres >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Server tools/user missing (client-only?) -> installing PostgreSQL server first"
        if ! install_postgresql; then
            echo "[$SCRIPT_INDEX] ERROR: PostgreSQL server install failed; cannot configure cluster"
            return 1
        fi
    fi

    # Ensure directories
    create_postgresql_directories

    # Remove any previous custom override that may break the distro unit
    if [ -d "/etc/systemd/system/postgresql.service.d" ]; then
        echo "[$SCRIPT_INDEX] Removing custom systemd override for postgresql.service"
        $USE_SUDO rm -rf "/etc/systemd/system/postgresql.service.d"
        $USE_SUDO systemctl daemon-reload || true
    fi

    # Determine installed major version
    POSTGRESQL_VERSION="$(detect_postgresql_version)"

    # WSL: compile_dir lives on drvfs (/mnt/*), where PostgreSQL cannot run (the
    # data dir must be owned by postgres with mode 0700, impossible on drvfs).
    # Pin data/log dirs to the native ext4 distro-default cluster so the logic
    # below adopts the default cluster and performs NO relocation/recreate.
    if [ "$IS_WSL" = true ]; then
        if wsl_mount_pg_image; then
            # PG_DATA_ON_D=true and the D-image is mounted -> data lives on D.
            POSTGRESQL_DATA_DIR="${PG_D_MOUNT}/${POSTGRESQL_VERSION}/main"
            $USE_SUDO mkdir -p "${PG_D_MOUNT}/${POSTGRESQL_VERSION}" 2>/dev/null || true
            safe_chown_R postgres:postgres "${PG_D_MOUNT}/${POSTGRESQL_VERSION}"
            echo "[$SCRIPT_INDEX] WSL -> PG data on D-drive image: $POSTGRESQL_DATA_DIR"
        else
            echo "[$SCRIPT_INDEX] WSL detected -> keeping PostgreSQL on native ext4 (no drvfs relocation)"
            POSTGRESQL_DATA_DIR="/var/lib/postgresql/$POSTGRESQL_VERSION/main"
        fi
        POSTGRESQL_LOG_DIR="/var/log/postgresql"
    else
        # Linux (non-WSL): prefer the project mapping path (map_web_path
        # "postgresql" -> wwwroot/postgresql on the persistent data disk) so PG data
        # lives with the rest of the app data. GUARD by filesystem type: PostgreSQL
        # cannot run on NTFS/exFAT/FUSE (no postgres-owned 0700 dir), so fall back to
        # the compile_dir value (native OS disk) when the mapped path is not POSIX.
        local pg_mapped_base
        pg_mapped_base="$(map_web_path "postgresql" 2>/dev/null)"
        if [ -n "$pg_mapped_base" ] && pg_fs_is_posix "$pg_mapped_base"; then
            POSTGRESQL_DATA_DIR="$pg_mapped_base/data"
            POSTGRESQL_LOG_DIR="$pg_mapped_base/logs"
            echo "[$SCRIPT_INDEX] PG data dir -> mapping path ($(pg_path_fstype "$pg_mapped_base")): $POSTGRESQL_DATA_DIR"
        else
            echo "[$SCRIPT_INDEX] Mapping path '$pg_mapped_base' is not POSIX-capable ($(pg_path_fstype "$pg_mapped_base")) -> keeping compile_dir: $POSTGRESQL_DATA_DIR"
        fi
    fi

    POSTGRESQL_CONFIG_DIR="/etc/postgresql/$POSTGRESQL_VERSION/main"

    # If cluster exists in /etc/postgresql/<ver>/main
    local cluster_dir="$POSTGRESQL_CONFIG_DIR"
    local need_recreate=false
    if [ -d "$cluster_dir" ]; then
        echo "[$SCRIPT_INDEX] Found existing cluster directory: $cluster_dir"
        # Read current data_directory from config if present
        local current_data_dir
        current_data_dir=$($USE_SUDO grep -E "^[[:space:]]*data_directory[[:space:]]*=" "$cluster_dir/postgresql.conf" 2>/dev/null | sed -E "s/^[^=]*=[[:space:]]*'?([^']*)'?[[:space:]]*$/\1/")
        if [ -z "$current_data_dir" ]; then
            # Try to infer default path
            current_data_dir="/var/lib/postgresql/$POSTGRESQL_VERSION/main"
        fi
        if [ "$current_data_dir" != "$POSTGRESQL_DATA_DIR" ]; then
            need_recreate=true
        fi
    else
        need_recreate=true
    fi

    # Stop base service to avoid conflicts
    pg_service stop

    # Case 1: If target data dir already initialized (PG_VERSION exists), adopt it via config
    if [ -f "$POSTGRESQL_DATA_DIR/PG_VERSION" ]; then
        echo "[$SCRIPT_INDEX] Existing initialized data directory detected: $POSTGRESQL_DATA_DIR"
        # Set proper ownership (skip in WSL as Windows filesystem doesn't support chown)
        if [ "$IS_WSL" = false ]; then
            safe_chown_R postgres:postgres "$POSTGRESQL_DATA_DIR"
        fi
        # Ensure config dir exists
        if [ ! -d "$cluster_dir" ]; then
            echo "[$SCRIPT_INDEX] Creating cluster directory structure"
            $USE_SUDO mkdir -p "$cluster_dir"
            safe_chown_R postgres:postgres "/etc/postgresql/$POSTGRESQL_VERSION"
        fi
        # Ensure base config exists (copy from package template if needed)
        if [ ! -f "$cluster_dir/postgresql.conf" ]; then
            echo "[$SCRIPT_INDEX] Bootstrapping configuration files"
            $USE_SUDO pg_createcluster "$POSTGRESQL_VERSION" main --datadir="/var/lib/postgresql/$POSTGRESQL_VERSION/main" --start
            pg_service stop
        fi
        # Point data_directory to our path and set logging options
        local cfg="$cluster_dir/postgresql.conf"
        if grep -qE "^[[:space:]]*data_directory[[:space:]]*=" "$cfg"; then
            $USE_SUDO sed -E -i "s|^[[:space:]]*data_directory[[:space:]]*=.*$|data_directory = '$POSTGRESQL_DATA_DIR'|" "$cfg"
        else
            echo "data_directory = '$POSTGRESQL_DATA_DIR'" | $USE_SUDO tee -a "$cfg" >/dev/null
        fi
        if grep -qE "^[#[:space:]]*logging_collector[[:space:]]*=" "$cfg"; then
            $USE_SUDO sed -E -i "s|^[#[:space:]]*logging_collector[[:space:]]*=.*$|logging_collector = on|" "$cfg"
        else
            echo "logging_collector = on" | $USE_SUDO tee -a "$cfg" >/dev/null
        fi
        if grep -qE "^[#[:space:]]*log_directory[[:space:]]*=" "$cfg"; then
            $USE_SUDO sed -E -i "s|^[#[:space:]]*log_directory[[:space:]]*=.*$|log_directory = '$POSTGRESQL_LOG_DIR'|" "$cfg"
        else
            echo "log_directory = '$POSTGRESQL_LOG_DIR'" | $USE_SUDO tee -a "$cfg" >/dev/null
        fi
        # Enable and start service
        pg_service enable
        pg_service start
    else
        # Case 2: Recreate cluster with target data dir
        if [ "$need_recreate" = true ]; then
            echo "[$SCRIPT_INDEX] Recreating cluster with data dir: $POSTGRESQL_DATA_DIR"
            # Drop existing cluster if present
            if [ -d "$cluster_dir" ]; then
                $USE_SUDO pg_dropcluster --stop "$POSTGRESQL_VERSION" main || true
            fi
            # Ensure parent and permissions; do not pre-create data dir (pg_createcluster will create it)
            $USE_SUDO mkdir -p "$(dirname "$POSTGRESQL_DATA_DIR")"
            # Set proper ownership (skip in WSL as Windows filesystem doesn't support chown)
            if [ "$IS_WSL" = false ]; then
                safe_chown_R postgres:postgres "$(dirname "$POSTGRESQL_DATA_DIR")"
            fi
            # Create cluster in the desired data directory and start it
            $USE_SUDO pg_createcluster "$POSTGRESQL_VERSION" main --datadir="$POSTGRESQL_DATA_DIR" --start
            POSTGRESQL_CONFIG_DIR="/etc/postgresql/$POSTGRESQL_VERSION/main"
        fi
        # Update logging settings in cluster config
        local cfg="$POSTGRESQL_CONFIG_DIR/postgresql.conf"
        if grep -qE "^[#[:space:]]*logging_collector[[:space:]]*=" "$cfg"; then
            $USE_SUDO sed -E -i "s|^[#[:space:]]*logging_collector[[:space:]]*=.*$|logging_collector = on|" "$cfg"
        else
            echo "logging_collector = on" | $USE_SUDO tee -a "$cfg" >/dev/null
        fi
        if grep -qE "^[#[:space:]]*log_directory[[:space:]]*=" "$cfg"; then
            $USE_SUDO sed -E -i "s|^[#[:space:]]*log_directory[[:space:]]*=.*$|log_directory = '$POSTGRESQL_LOG_DIR'|" "$cfg"
        else
            echo "log_directory = '$POSTGRESQL_LOG_DIR'" | $USE_SUDO tee -a "$cfg" >/dev/null
        fi
        pg_service enable
        pg_service restart
    fi

    echo "[$SCRIPT_INDEX] PostgreSQL cluster configuration completed"
}

# Function to setup the postgres superuser password and localhost-only access.
# Idempotent: safe to re-run. Requires POSTGRESQL_CONFIG_DIR to be set.
setup_postgresql_user() {
    echo "[$SCRIPT_INDEX] Setting up PostgreSQL user and access rules..."

    # Wait for PostgreSQL to be ready
    sleep 3

    # Generate (or reuse) the superuser password from the shared global-var store
    # (/var/_core_node/global_var/POSTGRES_PASSWORD). It is NEVER written into the
    # Laravel .env; Laravel reads it back via App\Support\CoreNodeSecrets, so a
    # copied/committed .env can never leak the credential.
    local pg_password
    pg_password="$(get_postgresql_password)"

    echo "[$SCRIPT_INDEX] Setting postgres superuser password (stored in global_var POSTGRES_PASSWORD)..."
    run_as_postgres psql -d postgres -c "ALTER USER postgres WITH PASSWORD '$pg_password';"

    # Mirror the password into the app's OWN data dir as well. /var/_core_node may be
    # outside PHP's open_basedir on panel-style servers, so Laravel reads an empty
    # secret there and migrate fails with "fe_sendauth: no password supplied" -- while
    # WSL/desktop (no open_basedir) works. The laravel data dir is always inside
    # open_basedir and resolves cross-OS via the same path mapper App\Support\
    # CoreNodeSecrets uses (PathMapper 'laravel_data_dir' == map_web_path "laravel_db").
    # Idempotent: overwrite every run so it stays in sync with the role password.
    local secret_mirror_dir secret_mirror_file
    secret_mirror_dir="$(map_web_path "laravel_db" ".core_node_secrets" 2>/dev/null)"
    if [ -n "$secret_mirror_dir" ]; then
        $USE_SUDO mkdir -p "$secret_mirror_dir" 2>/dev/null || mkdir -p "$secret_mirror_dir" 2>/dev/null || true
        secret_mirror_file="$secret_mirror_dir/POSTGRES_PASSWORD"
        if printf '%s\n' "$pg_password" | $USE_SUDO tee "$secret_mirror_file" >/dev/null 2>&1 \
            || printf '%s\n' "$pg_password" > "$secret_mirror_file" 2>/dev/null; then
            $USE_SUDO chmod 666 "$secret_mirror_file" 2>/dev/null || chmod 666 "$secret_mirror_file" 2>/dev/null || true
            echo "[$SCRIPT_INDEX] Password mirrored to app data dir (open_basedir-safe): $secret_mirror_file"
        fi
    fi

    # Restrict to localhost only: listen_addresses=localhost and pg_hba scram auth
    # on 127.0.0.1/::1 (the local Unix socket stays on peer so that admin access
    # via `sudo -u postgres psql` keeps working without a password).
    configure_localhost_only

    # Reload so the new auth rules take effect (WSL-safe).
    pg_service reload

    echo "[$SCRIPT_INDEX] PostgreSQL user setup completed (localhost-only, scram auth)"
}

# Function to display PostgreSQL status and information
show_postgresql_info() {
    echo "[$SCRIPT_INDEX] PostgreSQL Installation Information:"
    echo "[$SCRIPT_INDEX] ========================================"

    if command_exists psql; then
        echo "[$SCRIPT_INDEX] PostgreSQL Version: $(psql --version)"
        # Show the ACTUAL data directory the running cluster uses (query the server)
        # rather than the in-script variable -- on WSL the cluster is pinned to
        # native ext4 (/var/lib/postgresql/<ver>/main), not the compile_dir value.
        local actual_data_dir=""
        if is_postgresql_running; then
            actual_data_dir="$(run_as_postgres psql -tAc 'SHOW data_directory;' 2>/dev/null | tr -d '[:space:]')"
        fi
        if [ -n "$actual_data_dir" ]; then
            POSTGRESQL_DATA_DIR="$actual_data_dir"
        fi
        echo "[$SCRIPT_INDEX] Data Directory: $POSTGRESQL_DATA_DIR"
        if [ -z "$POSTGRESQL_CONFIG_DIR" ]; then
            local ver_detected
            ver_detected="$(detect_postgresql_version)"
            POSTGRESQL_CONFIG_DIR="/etc/postgresql/${ver_detected}/main"
        fi
        echo "[$SCRIPT_INDEX] Config Directory: $POSTGRESQL_CONFIG_DIR"
        echo "[$SCRIPT_INDEX] Log Directory: $POSTGRESQL_LOG_DIR"
        echo "[$SCRIPT_INDEX] Default Port: 5432 (localhost-only)"
        echo "[$SCRIPT_INDEX] Default User: postgres"
        echo "[$SCRIPT_INDEX] Password: generated, stored in global_var POSTGRES_PASSWORD (read by Laravel via App\\Support\\CoreNodeSecrets; never in .env)"

        if is_postgresql_running; then
            echo "[$SCRIPT_INDEX] Status: Running"
            echo "[$SCRIPT_INDEX] Service: systemctl/service/pg_ctlcluster {start|stop|restart} postgresql"
        else
            echo "[$SCRIPT_INDEX] Status: Stopped"
        fi

        echo "[$SCRIPT_INDEX] Connect (admin): sudo -u postgres psql"
        echo "[$SCRIPT_INDEX] Config: $POSTGRESQL_CONFIG_DIR/postgresql.conf"
    else
        echo "[$SCRIPT_INDEX] PostgreSQL is not installed"
    fi

    echo "[$SCRIPT_INDEX] ========================================"
}

# Function to remove PostgreSQL
remove_postgresql() {
    echo "[$SCRIPT_INDEX] Removing PostgreSQL..."

    # Stop service
    if is_postgresql_running; then
        pg_service stop
    fi

    # Disable service
    pg_service disable

    # Remove packages
    $USE_SUDO apt remove --purge -y postgresql postgresql-contrib postgresql-client
    $USE_SUDO apt autoremove -y

    # Remove custom directories (ask for confirmation)
    echo "[$SCRIPT_INDEX] Do you want to remove PostgreSQL data directories? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        # Use compile_dir for database directories (auto-selects based on environment)
        local postgresql_parent=$(map_web_path "compile_dir" "postgresql")
        $USE_SUDO rm -rf "$postgresql_parent"
        echo "[$SCRIPT_INDEX] PostgreSQL data directories removed"
    fi

    # Remove any stray systemd override
    $USE_SUDO rm -rf "/etc/systemd/system/postgresql.service.d"
    $USE_SUDO systemctl daemon-reload

    echo "[$SCRIPT_INDEX] PostgreSQL removal completed"
}

# OPT-IN WSL persistence on the D: drive.
# drvfs (/mnt/*) cannot host a PostgreSQL data dir (it needs postgres-owned, mode
# 0700 -- impossible on drvfs). To keep PG data physically on D AND survive a WSL
# distro reset, we store a real ext4 filesystem IMAGE file on D and loop-mount it:
# PG then sees a native ext4 dir whose bytes live in the image on D.
#
# Auto-enabled on WSL (PG_DATA_ON_D defaults true; set false to opt out).
# Size via PG_DATA_IMG_SIZE (default 20G). Idempotent: image created once, mounted
# if not already. Returns 0 when the image is mounted at $PG_D_MOUNT, 1 otherwise
# (callers then fall back to native ext4 so PG always starts). All human-readable
# output goes to STDERR so callers can capture the resolved data dir from stdout.
wsl_mount_pg_image() {
    [ "$IS_WSL" = true ] || return 1
    # Default ON for WSL -- no manual global_var needed. Still overridable by
    # putting PG_DATA_ON_D=false in the global-var store.
    [ "$(get_var "PG_DATA_ON_D" "true")" = "true" ] || return 1

    local d_base img size
    # All paths come from the SINGLE canonical mapping (map_web_path), NOT hardcoded.
    # The image lives under the same "laravel_db" location as the sqlite DBs:
    #   map_web_path "laravel_db" == /mnt/d/www/wwwroot/laravel_db (WSL)
    #                             == D:\www\wwwroot\laravel_db      (Windows)
    img="$(map_web_path "laravel_db" "postgresql/pgdata.ext4")"
    d_base="$(dirname "$img")"
    # Only meaningful when that mapped location is actually on a drvfs (/mnt/*) mount.
    case "$d_base" in
        /mnt/*) : ;;
        *) return 1 ;;
    esac
    size="$(get_var "PG_DATA_IMG_SIZE" "20G")"

    $USE_SUDO mkdir -p "$d_base" "$PG_D_MOUNT" 2>/dev/null || true

    # Create the ext4 image once.
    if [ ! -f "$img" ]; then
        echo "[$SCRIPT_INDEX] Creating ${size} ext4 image on D for PG persistence: $img" >&2
        if ! $USE_SUDO truncate -s "$size" "$img" 2>/dev/null; then
            echo "[$SCRIPT_INDEX] WARN: cannot create image on D -> native ext4 fallback" >&2
            return 1
        fi
        if ! $USE_SUDO mkfs.ext4 -F -q "$img" 2>/dev/null; then
            echo "[$SCRIPT_INDEX] WARN: mkfs.ext4 failed -> native ext4 fallback" >&2
            $USE_SUDO rm -f "$img" 2>/dev/null || true
            return 1
        fi
    fi

    # Loop-mount (idempotent; WSL does not persist mounts across sessions).
    if ! mountpoint -q "$PG_D_MOUNT" 2>/dev/null; then
        if ! $USE_SUDO mount -o loop "$img" "$PG_D_MOUNT" 2>/dev/null; then
            echo "[$SCRIPT_INDEX] WARN: loop-mount failed -> native ext4 fallback" >&2
            return 1
        fi
        echo "[$SCRIPT_INDEX] Mounted D-image at $PG_D_MOUNT (PG data persists on D)" >&2
    fi

    $USE_SUDO chown postgres:postgres "$PG_D_MOUNT" 2>/dev/null || true
    $USE_SUDO chmod 700 "$PG_D_MOUNT" 2>/dev/null || true
    return 0
}

# Resolve the CANONICAL data dir from the central mapping (cross-system) and, as a
# side effect, auto-fix the mount. Echoes ONLY the path on stdout (wsl_mount_pg_image
# logs to stderr). WSL+D-image -> ${PG_D_MOUNT}/<ver>/main; WSL fallback / native
# server -> the standard native cluster dir or the compile_dir relocation.
pg_expected_data_dir() {
    local ver="$1"
    if [ "$IS_WSL" = true ]; then
        if wsl_mount_pg_image; then
            echo "${PG_D_MOUNT}/${ver}/main"
        else
            echo "/var/lib/postgresql/${ver}/main"
        fi
        return 0
    fi
    map_web_path "compile_dir" "postgresql/data"
}

# True when a RUNNING cluster's actual data dir differs from the canonical/mapped
# one (e.g. data still on native ext4 while the mapping now points at the D-image).
# Drives the idempotent reconcile: recreate on the mapped dir (sys:init re-seeds from
# init_data -- NOT a dump/restore migration).
pg_data_dir_drifted() {
    is_postgresql_running || return 1
    local ver actual expected
    ver="$(detect_postgresql_version)"
    actual="$(run_as_postgres psql -tAc 'SHOW data_directory;' 2>/dev/null | tr -d '[:space:]')"
    expected="$(pg_expected_data_dir "$ver")"
    [ -n "$actual" ] && [ -n "$expected" ] && [ "$actual" != "$expected" ]
}

# True when at least one PostgreSQL cluster exists (running or stopped). Used by
# the already-installed converge path: psql being present does NOT imply a cluster
# exists (e.g. a dropped/relocated cluster), so we must create one if none exist.
cluster_exists() {
    command -v pg_lsclusters >/dev/null 2>&1 || return 1
    [ -n "$(pg_lsclusters -h 2>/dev/null)" ]
}

# Main execution logic
main() {
    # Configure based on START_POSTGRESQL variable
    if [ "$START_POSTGRESQL" = "true" ]; then
        echo "[$SCRIPT_INDEX] ============================================"
        echo "[$SCRIPT_INDEX] START_POSTGRESQL is true - Installing and starting PostgreSQL..."
        echo "[$SCRIPT_INDEX] ============================================"

        # WSL D-drive persistence: the loop mount does NOT survive a WSL session, so
        # re-establish it BEFORE any cluster start (an existing D-image cluster's
        # data dir would otherwise be absent and PG would fail to start). Best-effort.
        if [ "$IS_WSL" = true ]; then
            wsl_mount_pg_image || true
        fi

        # Free port 5432 if a Docker container (e.g. a pgvector/postgres container)
        # publishes it -- the LOCAL cluster cannot bind an occupied port, and a
        # foreign DB on 5432 answers Laravel with "password authentication failed".
        # Offers to stop the container (default Yes); set PORT_CONFLICT_AUTO_STOP=no
        # to keep it (then use the Docker DB instead of the local one).
        resolve_port_conflict 5432 "PostgreSQL" || \
            echo "[$SCRIPT_INDEX] WARNING: port 5432 still occupied; the local cluster may fail to bind."

        # Check if PostgreSQL is already installed
        if check_postgresql; then
            # Already installed (possibly by an earlier dd.sh chain run). Converge
            # idempotently: ensure the cluster is running, then re-apply the
            # password + localhost-only access rules so re-runs are self-healing.
            echo "[$SCRIPT_INDEX] PostgreSQL is already installed - ensuring config (idempotent)"
            POSTGRESQL_VERSION="$(detect_postgresql_version)"
            POSTGRESQL_CONFIG_DIR="/etc/postgresql/$POSTGRESQL_VERSION/main"
            # psql present does NOT mean a cluster exists. If none exists or it is
            # not running, (re)configure to CREATE + start it on the correct
            # filesystem (ext4 on WSL, never drvfs). configure_postgresql is
            # idempotent and applies the WSL data-dir pin + localhost config.
            if ! cluster_exists || ! is_postgresql_running; then
                echo "[$SCRIPT_INDEX] No running cluster -> creating/starting via configure_postgresql"
                configure_postgresql
            elif pg_data_dir_drifted; then
                # The running cluster's data dir != the canonical/mapped dir (e.g.
                # still on native ext4 while the mapping now resolves to the D-image).
                # Idempotently reconcile to the mapped dir: configure_postgresql adopts
                # an existing mapped cluster (non-destructive) or recreates a fresh one
                # there (sys:init re-seeds from init_data -- NOT a dump/restore migration).
                echo "[$SCRIPT_INDEX] Data dir DRIFT detected (actual != mapped) -> reconciling to mapped dir"
                echo "[$SCRIPT_INDEX]   If the mapped dir has no cluster, the old one is dropped and recreated there;"
                echo "[$SCRIPT_INDEX]   sys:init then re-seeds from init_data (no dump/restore migration)."
                configure_postgresql
            fi
            if is_postgresql_running; then
                setup_postgresql_user
                create_app_databases
            else
                echo "[$SCRIPT_INDEX] WARNING: PostgreSQL still not running after configure"
            fi
            show_postgresql_info
        else
            echo "[$SCRIPT_INDEX] Installing PostgreSQL..."
            if install_postgresql; then
                configure_postgresql
                if is_postgresql_running; then
                    setup_postgresql_user
                    create_app_databases
                    show_postgresql_info
                else
                    echo "[$SCRIPT_INDEX] PostgreSQL installation failed - service not running"
                    exit 1
                fi
            else
                echo "[$SCRIPT_INDEX] PostgreSQL installation failed"
                exit 1
            fi
        fi

        # Enable and start service
        if ! is_postgresql_running; then
            pg_service enable
            pg_service start
        fi

        echo "[$SCRIPT_INDEX] ============================================"
        echo "[$SCRIPT_INDEX] PostgreSQL is installed and running"
        echo "[$SCRIPT_INDEX] ============================================"
    else
        echo "[$SCRIPT_INDEX] ============================================"
        echo "[$SCRIPT_INDEX] START_POSTGRESQL is false - Skipping PostgreSQL installation"
        echo "[$SCRIPT_INDEX] ============================================"

        # If PostgreSQL is already installed, stop and disable it
        if check_postgresql; then
            echo "[$SCRIPT_INDEX] PostgreSQL is already installed, stopping and disabling services..."

            if is_postgresql_running; then
                echo "[$SCRIPT_INDEX] Stopping PostgreSQL service..."
                pg_service stop
            fi

            # Wait a moment and check if PostgreSQL processes are still running
            sleep 1

            # Kill any remaining postgres processes
            if pgrep -x postgres >/dev/null 2>&1; then
                echo "[$SCRIPT_INDEX] PostgreSQL processes still running, killing them..."
                $USE_SUDO pkill -TERM postgres 2>/dev/null || true
                sleep 2

                # Force kill if still running
                if pgrep -x postgres >/dev/null 2>&1; then
                    echo "[$SCRIPT_INDEX] Force killing PostgreSQL processes..."
                    $USE_SUDO pkill -9 postgres 2>/dev/null || true
                fi
            fi

            # Verify PostgreSQL is stopped
            if pgrep -x postgres >/dev/null 2>&1; then
                echo "[$SCRIPT_INDEX] Warning: Failed to stop all PostgreSQL processes"
            else
                echo "[$SCRIPT_INDEX] PostgreSQL service stopped successfully"
            fi

            # Disable PostgreSQL service from auto-start
            echo "[$SCRIPT_INDEX] Disabling PostgreSQL service from auto-start..."
            pg_service disable

            echo "[$SCRIPT_INDEX] ============================================"
            echo "[$SCRIPT_INDEX] PostgreSQL is installed but stopped and disabled"
            echo "[$SCRIPT_INDEX] ============================================"
        else
            echo "[$SCRIPT_INDEX] PostgreSQL is not installed and will not be installed"

            echo "[$SCRIPT_INDEX] ============================================"
            echo "[$SCRIPT_INDEX] PostgreSQL skipped"
            echo "[$SCRIPT_INDEX] ============================================"
        fi
    fi

    echo "[$SCRIPT_INDEX] PostgreSQL configuration completed"
}

# Check if PostgreSQL should be processed based on installation mode
case "$INSTALL_MODE" in
    "base")
        echo "[$SCRIPT_INDEX] Base mode - PostgreSQL installation skipped"
        exit 0
        ;;
    "server"|"full"|"desktop")
        echo "[$SCRIPT_INDEX] Mode: $INSTALL_MODE - Processing PostgreSQL..."
        ;;
    *)
        echo "[$SCRIPT_INDEX] Unknown installation mode: $INSTALL_MODE"
        ;;
esac

# Execute main function
main
