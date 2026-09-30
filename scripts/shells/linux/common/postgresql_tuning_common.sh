#!/bin/bash

# Source-once guard: repeated `source` is a no-op.
if [ "${POSTGRESQL_TUNING_COMMON_LOADED:-false}" = "true" ]; then
    return 0 2>/dev/null || true
fi
POSTGRESQL_TUNING_COMMON_LOADED="true"

# ============================================================================
# postgresql_tuning_common.sh - managed, idempotent PostgreSQL tuning for
# every ONLINE cluster (never a stopped or broken one).
#
# The package defaults (shared_buffers 128MB, random_page_cost 4, jit on,
# WAL compression off, 5 min checkpoints) suit a 1 GB spinning-disk box, not a
# 4 GB SSD host that serves timers and APIs: backends wrote 4.2M buffers
# themselves against 376k written by checkpoints, and full-page WAL images
# amplified every hot-row update (cache, global_tasks, sessions).
#
# The drop-in is rendered from RAM, compared by content and written only when
# it changed. Reloadable settings apply through a reload (no connection is
# dropped); postmaster-context settings (shared_buffers, shared_preload_libraries)
# are only REPORTED as pending a restart - this library never restarts a cluster.
#
# Contracts (string variables, never exit codes):
#   PG_TUNING_CHANGED   yes | no    (any cluster drop-in was rewritten)
#   PG_TUNING_PENDING   space separated setting names awaiting a restart
# ============================================================================

PG_TUNING_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_TUNING_CONF_NAME="90-core-node-tuning.conf"
PG_TUNING_MARKER="managed-by: postgresql_tuning_common"
# Cloud block storage reports rotational=1 even on SSD (measured r_await 0.5 ms),
# so the planner cost is an explicit knob, not a sysfs probe.
PG_TUNING_RANDOM_PAGE_COST="${PG_TUNING_RANDOM_PAGE_COST:-1.1}"
PG_TUNING_IO_CONCURRENCY="${PG_TUNING_IO_CONCURRENCY:-200}"
PG_TUNING_MAX_WAL_MB="${PG_TUNING_MAX_WAL_MB:-1536}"
PG_TUNING_SLOW_QUERY_MS="${PG_TUNING_SLOW_QUERY_MS:-2000}"
PG_TUNING_SHARED_BUFFERS_MB=""
PG_TUNING_CACHE_SIZE_MB=""
PG_TUNING_MAINTENANCE_MB=""
PG_TUNING_PRELOAD=""
PG_TUNING_CHANGED="no"
PG_TUNING_PENDING=""
PG_TUNING_SUDO=""

if ! type write_file_if_changed >/dev/null 2>&1; then
    # shellcheck source=/dev/null
    source "$PG_TUNING_COMMON_DIR/file_ops_common.sh"
fi

pg_tuning_run_as_postgres() {
    if command -v sudo >/dev/null 2>&1; then
        sudo -n -u postgres "$@"
    elif [ "$(id -u)" -eq 0 ]; then
        su -s /bin/bash postgres -c "$(printf '%q ' "$@")"
    else
        "$@"
    fi
}

# Sizes from MemTotal: shared_buffers = RAM/16 rounded to 64MB (128MB..1GB),
# effective_cache_size = RAM/2, maintenance_work_mem = 128MB (64MB under 2GB).
pg_tuning_compute() {
    local total_kb=""
    local total_mb=""
    local shared_mb=""

    total_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null)"
    case "$total_kb" in ''|*[!0-9]*) total_kb=2097152 ;; esac
    total_mb=$((total_kb / 1024))
    shared_mb=$(( (total_mb / 16 + 32) / 64 * 64 ))
    [ "$shared_mb" -lt 128 ] && shared_mb=128
    [ "$shared_mb" -gt 1024 ] && shared_mb=1024
    PG_TUNING_SHARED_BUFFERS_MB="$shared_mb"
    PG_TUNING_CACHE_SIZE_MB=$((total_mb / 2))
    PG_TUNING_MAINTENANCE_MB=128
    [ "$total_mb" -lt 2048 ] && PG_TUNING_MAINTENANCE_MB=64
    return 0
}

# pg_stat_statements is preloaded only when its library exists (a missing
# library would stop the cluster from starting after the next restart).
pg_tuning_resolve_preload() {
    local pkglib=""

    PG_TUNING_PRELOAD=""
    pkglib="$(pg_config --pkglibdir 2>/dev/null)"
    if [ -z "$pkglib" ]; then
        pkglib="/usr/lib/postgresql/${1}/lib"
    fi
    if [ -f "$pkglib/pg_stat_statements.so" ]; then
        PG_TUNING_PRELOAD="pg_stat_statements"
    fi
}

pg_tuning_render() {
    cat <<EOF
# ${PG_TUNING_MARKER} (do not edit; rewritten on every 175 run)
# Reloadable
effective_cache_size = ${PG_TUNING_CACHE_SIZE_MB}MB
maintenance_work_mem = ${PG_TUNING_MAINTENANCE_MB}MB
random_page_cost = ${PG_TUNING_RANDOM_PAGE_COST}
effective_io_concurrency = ${PG_TUNING_IO_CONCURRENCY}
wal_compression = on
jit = off
checkpoint_timeout = 15min
checkpoint_completion_target = 0.9
max_wal_size = ${PG_TUNING_MAX_WAL_MB}MB
autovacuum_vacuum_scale_factor = 0.05
autovacuum_analyze_scale_factor = 0.03
track_io_timing = on
log_min_duration_statement = ${PG_TUNING_SLOW_QUERY_MS}
# Postmaster context: takes effect at the next restart (never restarted here)
shared_buffers = ${PG_TUNING_SHARED_BUFFERS_MB}MB
EOF
    if [ -n "$PG_TUNING_PRELOAD" ]; then
        printf "shared_preload_libraries = '%s'\n" "$PG_TUNING_PRELOAD"
    fi
}

# One online cluster: args version name port.
pg_tuning_ensure_cluster() {
    local version="$1"
    local name="$2"
    local port="$3"
    local conf_dir="/etc/postgresql/${version}/${name}/conf.d"
    local target="${conf_dir}/${PG_TUNING_CONF_NAME}"
    local pending=""
    local unapplied=""

    if [ ! -d "/etc/postgresql/${version}/${name}" ]; then
        return 0
    fi
    if ! grep -Eq "^[[:space:]]*include_dir[[:space:]]*=[[:space:]]*'conf\.d'" "/etc/postgresql/${version}/${name}/postgresql.conf" 2>/dev/null; then
        echo "[pg-tuning] ${version}/${name}: postgresql.conf has no include_dir 'conf.d'; skipped"
        return 0
    fi
    pg_tuning_resolve_preload "$version"
    # Process substitution (not a pipe): write_file_if_changed must run in THIS
    # shell so WRITE_FILE_CHANGED survives the call.
    write_file_if_changed "$target" "" 644 postgres postgres < <(pg_tuning_render)
    # Reload when the file changed OR the server still holds reloadable values
    # from this file that it has not loaded (a previous write whose reload was
    # lost): pg_settings.sourcefile points at the file only after a reload.
    # Postmaster-context entries carry an error and are excluded.
    unapplied="$(pg_tuning_run_as_postgres psql -p "$port" -d postgres -tAc "SELECT count(*) FROM pg_file_settings f JOIN pg_settings s ON s.name = f.name WHERE f.sourcefile = '${target}' AND f.applied AND f.error IS NULL AND COALESCE(s.sourcefile, '') <> f.sourcefile" 2>/dev/null | tr -d '[:space:]')"
    if [ "$WRITE_FILE_CHANGED" = true ] || { [ -n "$unapplied" ] && [ "$unapplied" != "0" ]; }; then
        PG_TUNING_CHANGED="yes"
        echo "[pg-tuning] ${version}/${name}: applying tuning through a reload (no connection is dropped)"
        $PG_TUNING_SUDO pg_ctlcluster "$version" "$name" reload
    else
        echo "[pg-tuning] ${version}/${name}: tuning already converged (no change)"
    fi
    pending="$(pg_tuning_run_as_postgres psql -p "$port" -d postgres -tAc "SELECT string_agg(name, ' ') FROM pg_settings WHERE pending_restart" 2>/dev/null)"
    if [ -n "$pending" ]; then
        PG_TUNING_PENDING="${PG_TUNING_PENDING} ${pending}"
        echo "[pg-tuning] ${version}/${name}: awaiting a restart (not performed here): ${pending}"
    fi
}

pg_tuning_ensure() {
    local version=""
    local name=""
    local port=""
    local status=""

    PG_TUNING_CHANGED="no"
    PG_TUNING_PENDING=""
    if ! command -v pg_lsclusters >/dev/null 2>&1; then
        return 0
    fi
    if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
        PG_TUNING_SUDO="sudo"
    else
        PG_TUNING_SUDO=""
    fi
    pg_tuning_compute
    while read -r version name port status _; do
        [ -n "$version" ] || continue
        if [ "$status" != "online" ]; then
            continue
        fi
        pg_tuning_ensure_cluster "$version" "$name" "$port"
    done < <(pg_lsclusters -h 2>/dev/null)
    PG_TUNING_PENDING="${PG_TUNING_PENDING# }"
}
