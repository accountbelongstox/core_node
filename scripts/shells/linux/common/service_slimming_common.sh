#!/bin/bash

# Source-once guard: repeated `source` is a no-op.
if [ "${SERVICE_SLIMMING_COMMON_LOADED:-false}" = "true" ]; then
    return 0 2>/dev/null || true
fi
SERVICE_SLIMMING_COMMON_LOADED="true"

# ============================================================================
# service_slimming_common.sh - catalog + idempotent disable/enable of
# background services that dd.sh (or the base image) installs but a
# laravel-main API host does not need. Load-time side effect free and
# dependency free (no gvar_common.sh): safe to source from pyservice/codesync
# helpers and from the server_manager CLI.
#
# Every operation is state-driven and idempotent: an absent unit is skipped, an
# already disabled+inactive unit is a no-op, and disabling keeps the unit file
# (no uninstall), so `enable` reverts it. Re-running the owning dd.sh step
# re-enables what that step installs.
#
# Catalog entry: key|units (space separated)|origin|reason
# Contracts (string variables, never exit codes):
#   SVC_SLIM_STATE       absent | enabled-active | enabled-inactive |
#                        disabled-active | disabled-inactive
#   SVC_SLIM_MEM_MB      cgroup memory of the (first) unit in MB, "0" if none
#   SVC_SLIM_CHANGED     yes | no (last disable/enable changed anything)
#   SVC_SLIM_PROMPT_ANSWER yes | no
# ============================================================================

SVC_SLIM_CATALOG=(
    "codesync|codesync.service|pyservice codesync|Live code receiver on :59000; redundant when code is synced with dd syncgit (peer-push updates stop)."
    "rustdesk|rustdesk-hbbs.service rustdesk-hbbr.service ncore-rustdesk-dashboard.service|dd 169|RustDesk ID/relay server and dashboard; remote-desktop relay is not needed on an API host and publishes ports 21115-21120."
    "postgres17|postgresql@17-main.service|dd 75|Unused PostgreSQL 17 cluster that fails on every boot (live data is served by the other cluster)."
    "snapd|snapd.service snapd.socket snapd.seeded.service snapd.snap-repair.timer|base image|Snap daemon with no snaps installed besides itself."
    "iscsi|iscsid.service iscsid.socket open-iscsi.service|base image|iSCSI initiator; no iSCSI targets are used."
    "cloudinit|cloud-init-local.service cloud-init.service cloud-config.service cloud-final.service tat_install.service|cloud image|Provider first-boot units that already fail on every boot."
)

SVC_SLIM_STATE=""
SVC_SLIM_MEM_MB="0"
SVC_SLIM_CHANGED="no"
SVC_SLIM_PROMPT_ANSWER="no"
SVC_SLIM_NEEDS_ACTION="no"
SVC_SLIM_SUDO=""

svc_slim_init() {
    if [ -n "${USE_SUDO+x}" ]; then
        SVC_SLIM_SUDO="$USE_SUDO"
    elif [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
        SVC_SLIM_SUDO="sudo"
    else
        SVC_SLIM_SUDO=""
    fi
}

svc_slim_entry_field() {
    local entry="$1"
    local index="$2"

    printf '%s' "$entry" | cut -d'|' -f"$index"
}

svc_slim_find_entry() {
    local key="$1"
    local entry=""

    for entry in "${SVC_SLIM_CATALOG[@]}"; do
        if [ "$(svc_slim_entry_field "$entry" 1)" = "$key" ]; then
            printf '%s' "$entry"
            return
        fi
    done
}

# PostgreSQL instance state: auto-start comes from start.conf, activity from systemd.
svc_slim_pg_instance_state() {
    local unit="$1"
    local name="${unit#postgresql@}"
    local start_conf=""
    local mode=""
    local active="inactive"

    name="${name%.service}"
    start_conf="/etc/postgresql/${name%%-*}/${name#*-}/start.conf"
    mode="$(grep -v '^[[:space:]]*#' "$start_conf" 2>/dev/null | tr -d '[:space:]')"
    if systemctl is-active --quiet "$unit" 2>/dev/null; then
        active="active"
    fi
    if [ "$mode" = "auto" ]; then
        SVC_SLIM_STATE="enabled-${active}"
    else
        SVC_SLIM_STATE="disabled-${active}"
    fi
}

# Sets SVC_SLIM_STATE / SVC_SLIM_MEM_MB for ONE unit.
svc_slim_unit_state() {
    local unit="$1"
    local enabled=""
    local active=""
    local cgroup=""

    SVC_SLIM_STATE="absent"
    SVC_SLIM_MEM_MB="0"
    if ! command -v systemctl >/dev/null 2>&1; then
        return
    fi
    if ! systemctl cat "$unit" >/dev/null 2>&1; then
        return
    fi
    case "$unit" in
        postgresql@*)
            svc_slim_pg_instance_state "$unit"
            return
            ;;
    esac
    enabled="$(systemctl is-enabled "$unit" 2>/dev/null)"
    case "$enabled" in
        masked*|static|alias|indirect|generated|transient) enabled="disabled" ;;
        enabled|enabled-runtime) enabled="enabled" ;;
        *) enabled="disabled" ;;
    esac
    if systemctl is-active --quiet "$unit" 2>/dev/null; then
        active="active"
    else
        active="inactive"
    fi
    SVC_SLIM_STATE="${enabled}-${active}"
    cgroup="/sys/fs/cgroup/system.slice/${unit}"
    if [ -f "$cgroup/memory.current" ]; then
        SVC_SLIM_MEM_MB="$(( $(cat "$cgroup/memory.current" 2>/dev/null || echo 0) / 1048576 ))"
    fi
}

# A PostgreSQL cluster instance (postgresql@<ver>-<name>.service) auto-starts
# through /etc/postgresql/<ver>/<name>/start.conf, not through systemctl enable.
# svc_slim_pg_cluster_start <unit> <auto|disabled>: idempotent, and a cluster
# that is online is never touched (it serves live data). Sets SVC_SLIM_CHANGED.
svc_slim_pg_cluster_start() {
    local unit="$1"
    local mode="$2"
    local name="${unit#postgresql@}"
    local version=""
    local cluster=""
    local start_conf=""
    local current=""

    name="${name%.service}"
    version="${name%%-*}"
    cluster="${name#*-}"
    start_conf="/etc/postgresql/${version}/${cluster}/start.conf"
    if [ ! -f "$start_conf" ]; then
        return
    fi
    if [ "$mode" = "disabled" ] && command -v pg_lsclusters >/dev/null 2>&1 \
        && pg_lsclusters -h 2>/dev/null | awk -v v="$version" -v c="$cluster" '$1==v && $2==c && $4=="online" {found=1} END {exit !found}'; then
        echo "[svc-slim] $unit is an ONLINE cluster; refusing to touch it"
        return
    fi
    current="$(grep -v '^[[:space:]]*#' "$start_conf" 2>/dev/null | tr -d '[:space:]')"
    if [ "$current" = "$mode" ]; then
        echo "[svc-slim] $unit start.conf already '$mode' (no change)"
    else
        echo "[svc-slim] setting $start_conf to '$mode'"
        printf '%s\n' "$mode" | $SVC_SLIM_SUDO tee "$start_conf" >/dev/null
        SVC_SLIM_CHANGED="yes"
    fi
    if [ "$mode" = "disabled" ]; then
        $SVC_SLIM_SUDO systemctl reset-failed "$unit" >/dev/null 2>&1 || true
    fi
}

# Idempotent disable of a space separated unit list. Sets SVC_SLIM_CHANGED.
svc_slim_disable_units() {
    local units="$1"
    local unit=""

    svc_slim_init
    SVC_SLIM_CHANGED="no"
    for unit in $units; do
        case "$unit" in
            postgresql@*)
                svc_slim_pg_cluster_start "$unit" "disabled"
                continue
                ;;
        esac
        svc_slim_unit_state "$unit"
        case "$SVC_SLIM_STATE" in
            absent)
                continue
                ;;
            disabled-inactive)
                echo "[svc-slim] $unit already disabled and stopped (no change)"
                continue
                ;;
        esac
        echo "[svc-slim] disabling $unit (state: $SVC_SLIM_STATE)"
        $SVC_SLIM_SUDO systemctl disable --now "$unit" >/dev/null 2>&1 || true
        $SVC_SLIM_SUDO systemctl reset-failed "$unit" >/dev/null 2>&1 || true
        svc_slim_unit_state "$unit"
        if [ "$SVC_SLIM_STATE" = "disabled-inactive" ] || [ "$SVC_SLIM_STATE" = "absent" ]; then
            SVC_SLIM_CHANGED="yes"
        else
            echo "[svc-slim] [WARN] $unit is still $SVC_SLIM_STATE after disable"
        fi
    done
}

# Idempotent inverse: enable + start a space separated unit list.
svc_slim_enable_units() {
    local units="$1"
    local unit=""

    svc_slim_init
    SVC_SLIM_CHANGED="no"
    for unit in $units; do
        case "$unit" in
            postgresql@*)
                svc_slim_pg_cluster_start "$unit" "auto"
                continue
                ;;
        esac
        svc_slim_unit_state "$unit"
        case "$SVC_SLIM_STATE" in
            absent)
                continue
                ;;
            enabled-active)
                echo "[svc-slim] $unit already enabled and running (no change)"
                continue
                ;;
        esac
        echo "[svc-slim] enabling $unit (state: $SVC_SLIM_STATE)"
        $SVC_SLIM_SUDO systemctl enable --now "$unit" >/dev/null 2>&1 || true
        SVC_SLIM_CHANGED="yes"
    done
}

# Default-NO prompt. SVC_SLIM_ASSUME=yes|all answers yes without asking (unattended);
# no controlling TTY answers no.
svc_slim_prompt_no() {
    local message="$1"
    local reply=""

    SVC_SLIM_PROMPT_ANSWER="no"
    case "${SVC_SLIM_ASSUME:-}" in
        [Yy]*|all) SVC_SLIM_PROMPT_ANSWER="yes"; return ;;
    esac
    if [ ! -t 0 ] || [ ! -r /dev/tty ]; then
        return
    fi
    if type prompt_read_default >/dev/null 2>&1; then
        prompt_read_default reply "" 30 "$message [y/N] "
    else
        while IFS= read -r -s -t 0.05 -n 4096 reply </dev/tty 2>/dev/null; do :; done
        printf '%s [y/N] ' "$message" >/dev/tty
        read -r -t 30 reply </dev/tty 2>/dev/null || reply=""
    fi
    case "$reply" in
        [Yy]*) SVC_SLIM_PROMPT_ANSWER="yes" ;;
    esac
}

# Report table for the whole catalog (or one key).
svc_slim_scan() {
    local only_key="${1:-}"
    local entry=""
    local key=""
    local units=""
    local unit=""
    local present="no"
    local total_mem=0

    printf '%-11s %-42s %-17s %6s  %s\n' "KEY" "UNIT" "STATE" "MEM" "ORIGIN / REASON"
    for entry in "${SVC_SLIM_CATALOG[@]}"; do
        key="$(svc_slim_entry_field "$entry" 1)"
        if [ -n "$only_key" ] && [ "$only_key" != "$key" ]; then
            continue
        fi
        units="$(svc_slim_entry_field "$entry" 2)"
        for unit in $units; do
            svc_slim_unit_state "$unit"
            if [ "$SVC_SLIM_STATE" = "absent" ]; then
                continue
            fi
            present="yes"
            total_mem=$((total_mem + SVC_SLIM_MEM_MB))
            printf '%-11s %-42s %-17s %5sM  %s: %s\n' "$key" "$unit" "$SVC_SLIM_STATE" "$SVC_SLIM_MEM_MB" \
                "$(svc_slim_entry_field "$entry" 3)" "$(svc_slim_entry_field "$entry" 4)"
        done
    done
    if [ "$present" = "no" ]; then
        echo "(no catalog service is installed)"
    fi
    echo "Total memory of listed units: ${total_mem}M"
}

# Sets SVC_SLIM_NEEDS_ACTION=yes|no: does any unit of the entry still run or auto-start?
svc_slim_entry_needs_action() {
    local units="$1"
    local unit=""

    SVC_SLIM_NEEDS_ACTION="no"
    for unit in $units; do
        svc_slim_unit_state "$unit"
        case "$SVC_SLIM_STATE" in
            enabled-*|disabled-active) SVC_SLIM_NEEDS_ACTION="yes"; return ;;
        esac
    done
}

# Prompt (default N) for one catalog key, then disable idempotently.
svc_slim_prompt_disable_key() {
    local key="$1"
    local entry=""
    local units=""

    entry="$(svc_slim_find_entry "$key")"
    if [ -z "$entry" ]; then
        echo "[svc-slim] unknown key: $key"
        return
    fi
    units="$(svc_slim_entry_field "$entry" 2)"
    svc_slim_entry_needs_action "$units"
    if [ "$SVC_SLIM_NEEDS_ACTION" != "yes" ]; then
        echo "[svc-slim] $key: nothing to do (absent or already disabled)"
        return
    fi
    svc_slim_prompt_no "[svc-slim] Disable ${key} ($(svc_slim_entry_field "$entry" 4))?"
    if [ "$SVC_SLIM_PROMPT_ANSWER" = "yes" ]; then
        svc_slim_disable_units "$units"
    else
        echo "[svc-slim] $key kept."
    fi
}

svc_slim_prompt_all() {
    local entry=""

    for entry in "${SVC_SLIM_CATALOG[@]}"; do
        svc_slim_prompt_disable_key "$(svc_slim_entry_field "$entry" 1)"
    done
}
