#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# pyservice_www_permissions.sh - Idempotent startup permission repair for the
# mapped web data root.
#
# Target: CORE_NODE_WWW_BASE (single-definition hub: runtime_environment.sh),
# i.e. /www/www on dual-boot NTFS (D:\ == /www, so D:\www == /www/www) or /www
# on native Linux. The target is the REAL backing directory of the mapping, so
# repairing it fixes every alias path at once.
#
# Why: pyservice_entry.sh drops the worker to the desktop user so the system
# tray (AppIndicator/StatusNotifierItem) can register on the user's D-Bus
# session bus. Files previously written by a privileged (root) run - e.g.
# core_node/data/audio_orchestration/tasks/*.json - then become unwritable and
# the worker logs EACCES "Permission denied". This script restores ownership of
# the mapped tree to the real login user.
#
# Idempotency tiers:
#   1. Every run: probe the bounded hot tree <www>/core_node (the pycore data
#      root where the EACCES class occurs) for foreign-owned non-world-writable
#      entries; the full owner/mode-777 policy repair runs only on a hit.
#   2. Full tree: only when the per-user stamp is missing or the real user
#      changed (force with PYSERVICE_WWW_PERM_FULL=1); runs in the background
#      so a drifted 100GB+ NTFS tree never blocks service startup.
#
# Exits 0 without side effects on non-Linux, missing root dir, non-root caller
# (a service process must never invoke sudo), unresolved regular user, or when
# PYSERVICE_WWW_PERM_REPAIR=0.
# ---------------------------------------------------------------------------
set -uo pipefail

PWP_SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
PWP_RUNTIME_ENV="$PWP_SCRIPT_DIR/runtime_environment.sh"
PWP_FS_HELPERS="$PWP_SCRIPT_DIR/fs_perm_helpers.sh"
PWP_LOG_TAG="[pyservice-permissions]"
PWP_WWW_ROOT=""
PWP_HOT_TREE=""
PWP_STAMP_FILE=""
PWP_REAL_USER=""
PWP_REAL_GROUP=""
PWP_STAMP_USER=""
PWP_HOT_MISMATCH=""

[[ "$(uname -s 2>/dev/null)" == "Linux" ]] || exit 0
[[ "${PYSERVICE_WWW_PERM_REPAIR:-1}" != "0" ]] || exit 0
[[ -f "$PWP_RUNTIME_ENV" && -f "$PWP_FS_HELPERS" ]] || exit 0

# shellcheck source=/dev/null
source "$PWP_RUNTIME_ENV"
# shellcheck source=/dev/null
source "$PWP_FS_HELPERS"

PWP_WWW_ROOT="${CORE_NODE_WWW_BASE:-/www}"
PWP_WWW_ROOT="$(readlink -f "$PWP_WWW_ROOT" 2>/dev/null || echo "$PWP_WWW_ROOT")"
PWP_HOT_TREE="$PWP_WWW_ROOT/core_node"
PWP_STAMP_FILE="$PWP_WWW_ROOT/.pyservice_www_perm_repair.stamp"

if [[ -z "$PWP_WWW_ROOT" || "$PWP_WWW_ROOT" == "/" || ! -d "$PWP_WWW_ROOT" ]]; then
    exit 0
fi

resolve_active_permission_owner >/dev/null
PWP_REAL_USER="$ACTIVE_PERMISSION_USER"
PWP_REAL_GROUP="$ACTIVE_PERMISSION_GROUP"
if [[ -z "$PWP_REAL_USER" || "$PWP_REAL_USER" == "root" ]]; then
    echo "$PWP_LOG_TAG No regular login user resolved; skipping $PWP_WWW_ROOT"
    exit 0
fi

if [[ "$(id -u)" != "0" ]]; then
    echo "$PWP_LOG_TAG Not root; skipping repair of $PWP_WWW_ROOT (chown needs root)."
    exit 0
fi

# Tier 1: bounded hot tree (pycore writes here; the tray privilege drop makes
# any root-owned remnant fail with EACCES). Synchronous and cheap: probe for
# the actual EACCES pattern (foreign-owned AND not world-writable), then apply
# the shared owner/mode-777 policy on a hit. Benign foreign-owned 777 entries
# (e.g. the root-run pip cache) stay writable and never trigger a repair.
PWP_HOT_MISMATCH=""
if [[ -d "$PWP_HOT_TREE" ]]; then
    PWP_HOT_MISMATCH="$(find "$PWP_HOT_TREE" \( -type d -o -type f \) ! -user "$PWP_REAL_USER" ! -perm -o+w -print -quit 2>/dev/null)"
    if [[ -n "$PWP_HOT_MISMATCH" ]]; then
        repair_owned_tree_777 "$PWP_HOT_TREE" "$PWP_REAL_USER" "$PWP_REAL_GROUP" || true
    else
        echo "$PWP_LOG_TAG Ready: $PWP_HOT_TREE owned by $PWP_REAL_USER"
    fi
fi

# Tier 2: full mapped tree, guarded by a per-user stamp; backgrounded so a
# drifted tree never blocks startup. Delete the stamp to force a re-repair.
if [[ -f "$PWP_STAMP_FILE" ]]; then
    PWP_STAMP_USER="$(sed -n 's/^user=//p' "$PWP_STAMP_FILE" 2>/dev/null | head -n1)"
fi
if [[ "${PYSERVICE_WWW_PERM_FULL:-0}" == "1" || "$PWP_STAMP_USER" != "$PWP_REAL_USER" ]]; then
    (
        repair_owned_tree_777 "$PWP_WWW_ROOT" "$PWP_REAL_USER" "$PWP_REAL_GROUP" \
            && printf 'user=%s\ndate=%s\n' "$PWP_REAL_USER" "$(date -Is)" > "$PWP_STAMP_FILE" \
            && chown "$PWP_REAL_USER:$PWP_REAL_GROUP" "$PWP_STAMP_FILE" 2>/dev/null
    ) &
    echo "$PWP_LOG_TAG Full-tree repair of $PWP_WWW_ROOT -> $PWP_REAL_USER:$PWP_REAL_GROUP running in background (pid $!)."
fi

exit 0
