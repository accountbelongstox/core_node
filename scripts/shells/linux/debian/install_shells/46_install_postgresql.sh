#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

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
SCRIPT_INDEX="46"
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
APP_DATABASES="core_node_main app_qy_v1_database awy_v0_database vipclub_v1_database server_manager_v1_database achat_v1_database code_mart_v1_database mcp_v1_database it_tools_v1_database bank_v1_database"

# Source gvar_common.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Initialize variables
SCRIPT_INDEX="46"
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# True if something is LISTENING on the given TCP port.
port_in_use() {
    local port="$1"
    if command_exists ss; then
        ss -ltnH 2>/dev/null | grep -qE "[:.]${port}[[:space:]]"
    elif command_exists lsof; then
        lsof -ti "tcp:${port}" -sTCP:LISTEN >/dev/null 2>&1
    else
        return 1
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

# Detect & resolve a conflict on <port>. A Docker-published port (e.g. a
# pgvector/postgres container on 5432) blocks the LOCAL cluster from binding.
# Offer to stop the owning container (default Yes); else offer to kill a plain
# process holder. Returns 0 if the port is free (or freed), 1 otherwise.
resolve_port_conflict() {
    local port="$1" label="${2:-service}" row="" cid="" cname="" pids=""

    port_in_use "$port" || return 0
    echo "[$SCRIPT_INDEX] Port $port ($label) is already in use."

    if command_exists docker; then
        row=$($USE_SUDO docker ps --filter "publish=${port}" --format '{{.ID}} {{.Names}}' 2>/dev/null | head -1)
        [ -n "$row" ] || row=$(docker ps --filter "publish=${port}" --format '{{.ID}} {{.Names}}' 2>/dev/null | head -1)
    fi
    if [ -n "$row" ]; then
        cid=$(printf '%s' "$row" | awk '{print $1}')
        cname=$(printf '%s' "$row" | awk '{print $2}')
        echo "[$SCRIPT_INDEX] Held by Docker container: ${cname:-$cid} (publishes :$port)."
        if prompt_default_no "[$SCRIPT_INDEX] Stop container ${cname:-$cid} and disable its auto-startup to free port $port?"; then
            echo "[$SCRIPT_INDEX] Stopping container ${cname:-$cid} ..."
            $USE_SUDO docker stop "$cid" >/dev/null 2>&1 || docker stop "$cid" >/dev/null 2>&1 || true
            $USE_SUDO docker update --restart=no "$cid" >/dev/null 2>&1 || docker update --restart=no "$cid" >/dev/null 2>&1 || true
            echo "[$SCRIPT_INDEX] Container ${cname:-$cid} stopped and auto-startup disabled."
            sleep 2
            if port_in_use "$port"; then
                echo "[$SCRIPT_INDEX] Port $port still in use after stopping the container."
                return 1
            fi
            echo "[$SCRIPT_INDEX] Port $port is now free."
            return 0
        fi
        echo "[$SCRIPT_INDEX] Container left running; port $port still occupied."
        return 1
    fi

    if command_exists ss; then
        pids=$(ss -ltnpH 2>/dev/null | grep -E "[:.]${port}[[:space:]]" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
    fi
    if [ -z "$pids" ] && command_exists lsof; then
        pids=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null | sort -u)
    fi
    if [ -n "$pids" ]; then
        # If EVERY holder is the local PostgreSQL server itself, this is not a
        # conflict -- it is exactly the cluster we want on this port. Killing it
        # would tear down the running server and leave the socket gone, so the
        # follow-up setup_postgresql_user/createdb steps die with
        # "connection to server on socket ... failed: No such file or directory".
        # Leave it running and report the port as effectively free for our use.
        local holder_comms=""
        holder_comms=$(ps -o comm= -p $pids 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' | sort -u)
        if [ -n "$holder_comms" ] && ! printf '%s\n' "$holder_comms" | grep -qvE '^(postgres|postmaster)$'; then
            echo "[$SCRIPT_INDEX] Port $port is held by the local PostgreSQL server (postgres) -> already serving; leaving it running."
            return 0
        fi
        echo "[$SCRIPT_INDEX] Held by process PID(s): $pids"
        ps -o pid=,comm= -p $pids 2>/dev/null | sed "s/^/[$SCRIPT_INDEX]   /"
        if prompt_default_no "[$SCRIPT_INDEX] Kill process(es) $pids holding port $port?"; then
            $USE_SUDO kill $pids 2>/dev/null || kill $pids 2>/dev/null || true
            sleep 1
            $USE_SUDO kill -9 $pids 2>/dev/null || true
            sleep 1
            port_in_use "$port" || { echo "[$SCRIPT_INDEX] Port $port is now free."; return 0; }
        fi
    fi
    echo "[$SCRIPT_INDEX] Port $port still occupied."
    return 1
}

# Function to check if the PostgreSQL SERVER is already installed.
# IMPORTANT: psql is the CLIENT (package postgresql-client) — its presence does
# NOT mean the server is installed. A client-only box has NO `postgres` OS user,
# NO cluster tools (pg_createcluster/pg_ctlcluster from postgresql-common) and NO
# server daemon, so the old `command_exists psql` check wrongly took the "already
# installed" path and then died with "sudo: unknown user postgres" and
# "pg_createcluster: command not found". Require real SERVER artifacts here so a
# client-only host falls through to install_postgresql.
check_postgresql() {
    # Debian/Ubuntu: server pulls postgresql-common (cluster tools) + creates the
    # postgres OS user. Both present => server installed.
    if command_exists pg_ctlcluster && id postgres >/dev/null 2>&1; then
        return 0
    fi
    # Non-Debian layout: server daemon on PATH.
    if command_exists postgres; then
        return 0
    fi
    # Debian server binary present even when not on PATH (e.g. /usr/lib/postgresql/16/bin/postgres).
    if ls /usr/lib/postgresql/*/bin/postgres >/dev/null 2>&1; then
        return 0
    fi
    return 1  # client-only or absent -> trigger install_postgresql
}

# Function to check if PostgreSQL service is running.
# WSL-safe: systemd is often absent, so fall back to pg_isready / pgrep.
is_postgresql_running() {
    # pg_isready is AUTHORITATIVE: it actually opens a connection on the default
    # socket -- the same one psql/createdb use here. Prefer it over
    # `systemctl is-active postgresql`, which on Debian is a meta-service that
    # stays "active (exited)" even when the real cluster (postgresql@<ver>-main)
    # is down. Trusting the meta-service made the script run setup against a dead
    # server and fail with "socket ... No such file or directory".
    if command_exists pg_isready; then
        pg_isready -q 2>/dev/null && return 0
        return 1
    fi
    if command_exists systemctl && systemctl is-active --quiet postgresql 2>/dev/null; then
        return 0
    fi
    if pgrep -x postgres >/dev/null 2>&1; then
        return 0
    fi
    return 1  # false, is not running
}

# WSL-safe service control: systemd -> sysv service -> Debian cluster tool.
# action is one of: start|stop|restart|reload|enable|disable
pg_service() {
    local action="$1"
    local ver=""
    if command_exists systemctl; then
        if $USE_SUDO systemctl "$action" postgresql 2>/dev/null; then
            return 0
        fi
    fi
    if command_exists service; then
        if $USE_SUDO service postgresql "$action" 2>/dev/null; then
            return 0
        fi
    fi
    # No systemd (e.g. WSL): drive the cluster directly.
    ver="$(detect_postgresql_version)"
    case "$action" in
        start|restart|reload)
            $USE_SUDO pg_ctlcluster "$ver" main "$action" 2>/dev/null || true
            ;;
        *)
            : # enable/disable/stop are best-effort no-ops without an init system
            ;;
    esac
    return 0
}

# Run a command as the postgres OS user regardless of whether sudo is available.
# Handles the root-without-sudo case (USE_SUDO empty) where `$USE_SUDO -u postgres`
# would otherwise expand to a broken `-u postgres ...` invocation.
run_as_postgres() {
    if command -v sudo >/dev/null 2>&1; then
        sudo -u postgres "$@"
    elif [ "$(id -u)" -eq 0 ]; then
        su -s /bin/bash postgres -c "$(printf '%q ' "$@")"
    else
        "$@"
    fi
}

# Idempotently create the per-app databases. Only run when the server is ready so
# non-start.sh paths don't leave them missing (migrations would otherwise fail).
create_app_databases() {
    echo "[$SCRIPT_INDEX] Ensuring per-app databases..."
    local db=""
    for db in $APP_DATABASES; do
        if run_as_postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" 2>/dev/null | grep -q 1; then
            : # exists
        else
            echo "[$SCRIPT_INDEX] Creating database: ${db}"
            run_as_postgres createdb "${db}" 2>/dev/null || echo "[$SCRIPT_INDEX] WARN: failed to create ${db}"
        fi
    done
}

# Resolve (or generate + persist) the postgres superuser password via the shared
# global-var store, mirroring the MySQL pattern (50_install_mysql.sh). The same
# value is read by start.sh and written into the Laravel .env, so dd.sh and
# start.sh stay aligned. A fresh (re)install with no stored value regenerates it.
get_postgresql_password() {
    local pw=""
    pw=$(get_global_var "POSTGRES_PASSWORD" "")
    if [ -z "$pw" ]; then
        if command_exists openssl; then
            pw=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)
        else
            pw=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
        fi
        set_global_var "POSTGRES_PASSWORD" "$pw"
    fi
    echo "$pw"
}

# Restrict the server to loopback only: listen_addresses=localhost and pg_hba TCP
# host rules limited to 127.0.0.1/::1 (scram), local socket kept on peer so that
# `sudo -u postgres psql` admin access keeps working. Any all-interfaces rule is
# disabled. Safe to call repeatedly.
configure_localhost_only() {
    local cfg="$POSTGRESQL_CONFIG_DIR/postgresql.conf"
    local hba="$POSTGRESQL_CONFIG_DIR/pg_hba.conf"

    echo "[$SCRIPT_INDEX] Restricting PostgreSQL to localhost-only access..."

    if [ -f "$cfg" ]; then
        if grep -qE "^[#[:space:]]*listen_addresses[[:space:]]*=" "$cfg"; then
            $USE_SUDO sed -E -i "s|^[#[:space:]]*listen_addresses[[:space:]]*=.*|listen_addresses = 'localhost'|" "$cfg"
        else
            echo "listen_addresses = 'localhost'" | $USE_SUDO tee -a "$cfg" >/dev/null
        fi
    fi

    if [ -f "$hba" ]; then
        $USE_SUDO cp "$hba" "$hba.backup.localhost" 2>/dev/null || true
        if ! grep -qE "^[[:space:]]*host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1/32" "$hba"; then
            echo "host    all    all    127.0.0.1/32    scram-sha-256" | $USE_SUDO tee -a "$hba" >/dev/null
        fi
        if ! grep -qE "^[[:space:]]*host[[:space:]]+all[[:space:]]+all[[:space:]]+::1/128" "$hba"; then
            echo "host    all    all    ::1/128    scram-sha-256" | $USE_SUDO tee -a "$hba" >/dev/null
        fi
        # Disable any all-interfaces rule (defense in depth; default has none).
        $USE_SUDO sed -E -i "s|^([[:space:]]*host[[:space:]]+all[[:space:]]+all[[:space:]]+)0\.0\.0\.0/0(.*)$|# DISABLED (localhost-only) \10.0.0.0/0\2|" "$hba"
    fi
}

##############################
# Debian/Ubuntu cluster model #
##############################

# Detect installed PostgreSQL major version safely
detect_postgresql_version() {
    local ver=""
    if command_exists psql; then
        ver=$(psql -V 2>/dev/null | awk '{print $3}' | cut -d. -f1)
    fi
    if [[ -z "$ver" || ! "$ver" =~ ^[0-9]+$ ]]; then
        if [ -d "/usr/lib/postgresql" ]; then
            ver=$(ls -1 "/usr/lib/postgresql" 2>/dev/null | sed -n '/^[0-9]\+$/p' | sort -n | tail -1)
        fi
    fi
    if [[ -z "$ver" || ! "$ver" =~ ^[0-9]+$ ]]; then
        ver="$POSTGRESQL_VERSION" # fallback to default defined earlier
    fi
    echo "$ver"
}

# Function to create necessary directories (do not pre-create data dir to avoid pg_createcluster conflicts)
create_postgresql_directories() {
    echo "[$SCRIPT_INDEX] Ensuring PostgreSQL directories..."

    # Use compile_dir for database directories (auto-selects based on environment)
    local postgresql_parent=$(map_web_path "compile_dir" "postgresql")

    # Parent and logs
    $USE_SUDO mkdir -p "$postgresql_parent"
    $USE_SUDO mkdir -p "$POSTGRESQL_LOG_DIR"

    # Set proper ownership (skip in WSL as Windows filesystem doesn't support chown)
    if [ "$IS_WSL" = false ]; then
        $USE_SUDO chown -R postgres:postgres "$postgresql_parent"
    fi
    $USE_SUDO chmod 755 "$POSTGRESQL_LOG_DIR" 2>/dev/null || true

    echo "[$SCRIPT_INDEX] Directories prepared"
}

# Detect the OS id (debian / ubuntu) from /etc/os-release.
os_release_id() {
    [ -f /etc/os-release ] || { echo ""; return 0; }
    ( . /etc/os-release 2>/dev/null; echo "$ID" )
}

# Resolve the Debian release codename used by the PGDG suite ("<codename>-pgdg"),
# e.g. bookworm (Debian 12), trixie (Debian 13), bullseye (Debian 11). Prefer the
# os-release VERSION_CODENAME; fall back to mapping VERSION_ID.
pg_debian_codename() {
    local cn="" vid=""
    if [ -f /etc/os-release ]; then
        cn="$( . /etc/os-release 2>/dev/null; echo "$VERSION_CODENAME" )"
        vid="$( . /etc/os-release 2>/dev/null; echo "$VERSION_ID" )"
    fi
    if [ -z "$cn" ]; then
        case "$vid" in
            13*) cn="trixie" ;;
            12*) cn="bookworm" ;;
            11*) cn="bullseye" ;;
        esac
    fi
    echo "$cn"
}

# Ensure the official PostgreSQL APT (PGDG) repository is configured so a specific
# PostgreSQL major version is installable on Debian 12 (bookworm) / 13 (trixie),
# regardless of what the distro ships (bookworm=15, trixie=17 by default).
# Reference: https://www.postgresql.org/download/linux/debian/
# Idempotent and best-effort: returns 1 on any failure so the caller falls back to
# the distro repository. Only acts on Debian (Ubuntu keeps the distro-default path).
ensure_pgdg_repository() {
    local codename=""
    local key_file="/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc"
    local list_file="/etc/apt/sources.list.d/pgdg.list"
    local key_url="https://www.postgresql.org/media/keys/ACCC4CF8.asc"

    [ "$(os_release_id)" = "debian" ] || return 1

    codename="$(pg_debian_codename)"
    if [ -z "$codename" ]; then
        echo "[$SCRIPT_INDEX] Could not detect Debian codename; skipping PGDG repo."
        return 1
    fi

    # Already configured -> nothing to do.
    if [ -f "$list_file" ] && [ -f "$key_file" ]; then
        echo "[$SCRIPT_INDEX] PGDG repository already configured (${codename}-pgdg)."
        return 0
    fi

    echo "[$SCRIPT_INDEX] Configuring PostgreSQL PGDG repository for Debian ${codename}..."
    $USE_SUDO apt-get update -qq || true
    if ! $USE_SUDO apt-get install -y curl ca-certificates gnupg >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] WARN: cannot install curl/ca-certificates; skipping PGDG."
        return 1
    fi

    # Fetch the (ASCII-armored) signing key. apt on Debian 12/13 accepts an armored
    # key directly via signed-by, matching the official .asc setup.
    $USE_SUDO install -d /usr/share/postgresql-common/pgdg 2>/dev/null || true
    if ! $USE_SUDO curl -fsSL -o "$key_file" "$key_url"; then
        echo "[$SCRIPT_INDEX] WARN: failed to fetch PGDG signing key; skipping PGDG."
        return 1
    fi

    echo "deb [signed-by=$key_file] https://apt.postgresql.org/pub/repos/apt ${codename}-pgdg main" \
        | $USE_SUDO tee "$list_file" >/dev/null

    if ! $USE_SUDO apt-get update -qq; then
        echo "[$SCRIPT_INDEX] WARN: apt update failed after adding PGDG; reverting to distro repo."
        $USE_SUDO rm -f "$list_file" 2>/dev/null || true
        return 1
    fi

    echo "[$SCRIPT_INDEX] PGDG repository ready (${codename}-pgdg)."
    return 0
}

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
            $USE_SUDO chown -R postgres:postgres "${PG_D_MOUNT}/${POSTGRESQL_VERSION}" 2>/dev/null || true
            echo "[$SCRIPT_INDEX] WSL -> PG data on D-drive image: $POSTGRESQL_DATA_DIR"
        else
            echo "[$SCRIPT_INDEX] WSL detected -> keeping PostgreSQL on native ext4 (no drvfs relocation)"
            POSTGRESQL_DATA_DIR="/var/lib/postgresql/$POSTGRESQL_VERSION/main"
        fi
        POSTGRESQL_LOG_DIR="/var/log/postgresql"
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
            $USE_SUDO chown -R postgres:postgres "$POSTGRESQL_DATA_DIR"
        fi
        # Ensure config dir exists
        if [ ! -d "$cluster_dir" ]; then
            echo "[$SCRIPT_INDEX] Creating cluster directory structure"
            $USE_SUDO mkdir -p "$cluster_dir"
            $USE_SUDO chown -R postgres:postgres "/etc/postgresql/$POSTGRESQL_VERSION"
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
                $USE_SUDO chown -R postgres:postgres "$(dirname "$POSTGRESQL_DATA_DIR")"
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
