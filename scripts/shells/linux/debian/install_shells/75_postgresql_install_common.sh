#!/bin/bash

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Echo the filesystem type backing a path. The leaf may not exist yet, so walk up
# to the nearest existing ancestor (a not-yet-created data dir inherits its
# parent's filesystem). Used to keep PostgreSQL OFF non-POSIX mounts.
pg_path_fstype() {
    local p="$1"
    while [ -n "$p" ] && [ "$p" != "/" ] && [ ! -e "$p" ]; do
        p="$(dirname "$p")"
    done
    [ -z "$p" ] && { echo ""; return 0; }
    findmnt -n -o FSTYPE --target "$p" 2>/dev/null | head -n1
}

# True when $1 is on a filesystem where PostgreSQL can run: it needs a
# postgres-owned data dir at mode 0700, which NTFS/exFAT/FUSE/drvfs cannot provide.
pg_fs_is_posix() {
    case "$(pg_path_fstype "$1")" in
        ext2|ext3|ext4|xfs|btrfs|zfs|reiserfs|jfs|f2fs) return 0 ;;
        *) return 1 ;;
    esac
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
# IMPORTANT: psql is the CLIENT (package postgresql-client) - its presence does
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
# global-var store, mirroring the MySQL pattern (85_install_mysql.sh). The same
# value is read by Laravel via App\Support\CoreNodeSecrets (never written into
# any .env file), so dd.sh and the runtime stay aligned. A fresh (re)install
# with no stored value regenerates it.
get_postgresql_password() {
    local pw="" mirror=""
    pw=$(get_global_var "POSTGRES_PASSWORD" "")
    # Safety net: the global-var store lives on the OS disk (/var/_core_node) and is
    # lost on a fresh reinstall, while the laravel_db secret mirror lives with the
    # app data and survives. If the store is empty but a mirror exists, REUSE it
    # (don't regenerate) so the password stays stable and keeps matching the value
    # Laravel reads first. Only generate when BOTH are empty.
    if [ -z "$pw" ]; then
        mirror="$(map_web_path "laravel_db" ".core_node_secrets/POSTGRES_PASSWORD" 2>/dev/null)"
        if [ -n "$mirror" ] && [ -s "$mirror" ]; then
            pw="$(head -n1 "$mirror" 2>/dev/null | tr -d '\r\n')"
        fi
    fi
    if [ -z "$pw" ]; then
        if command_exists openssl; then
            pw=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)
        else
            pw=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
        fi
    fi
    # Always (re)persist to the global-var store so it is present for later reads.
    set_global_var "POSTGRES_PASSWORD" "$pw"
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
        # Read with sudo: postgresql.conf/pg_hba.conf live under /etc/postgresql and
        # are root/postgres-owned (pg_hba.conf is mode 0640), so a non-root grep
        # fails with "Permission denied" and the localhost lockdown silently misfires
        # (the failed read makes the rule look absent and we blindly append).
        if $USE_SUDO grep -qE "^[#[:space:]]*listen_addresses[[:space:]]*=" "$cfg"; then
            $USE_SUDO sed -E -i "s|^[#[:space:]]*listen_addresses[[:space:]]*=.*|listen_addresses = 'localhost'|" "$cfg"
        else
            echo "listen_addresses = 'localhost'" | $USE_SUDO tee -a "$cfg" >/dev/null
        fi
    fi

    if [ -f "$hba" ]; then
        [ -f "$hba.backup.localhost" ] || $USE_SUDO cp "$hba" "$hba.backup.localhost" 2>/dev/null || true
        if ! $USE_SUDO grep -qE "^[[:space:]]*host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1/32" "$hba"; then
            echo "host    all    all    127.0.0.1/32    scram-sha-256" | $USE_SUDO tee -a "$hba" >/dev/null
        fi
        if ! $USE_SUDO grep -qE "^[[:space:]]*host[[:space:]]+all[[:space:]]+all[[:space:]]+::1/128" "$hba"; then
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
        safe_chown_R postgres:postgres "$postgresql_parent"
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

