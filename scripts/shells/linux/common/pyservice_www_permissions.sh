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
# Why: the pycore worker runs as the desktop user (dropped by
# pyservice_entry.sh, or User= in the pycore unit). Entries a root process
# left behind (e.g. core_node/logs/pycore_console.jsonl) are unwritable for it
# and fail with EACCES. Root pycore processes create entries owned by the real
# user (pycore/pyfoundations/data_owner.py); this script repairs remnants.
#
# Callers: pyservice_entry.sh (post-elevation) and the pycore unit's
# ExecStartPre=+ (root although User=<desktop user>), so every start runs it.
#
# Idempotency tiers:
#   1. Every run, synchronous (one find walk each; only mismatched entries
#      change), so the worker never meets a root-owned entry it needs:
#      - CORE_NODE_DATA_DIR and LEGACY_CORE_NODE_DATA_DIR (model cache, scratch
#        temp such as _tmp/work): shared owner/mode-777 policy;
#      - the project venv ($COMPILE_DIR/python3_venv, built by root installers):
#        owned by the user without shared write, so the worker can pip-install
#        into it.
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
PWP_LEGACY_TREE=""
PWP_VENV_DIR=""

[[ "$(uname -s 2>/dev/null)" == "Linux" ]] || exit 0
[[ "${PYSERVICE_WWW_PERM_REPAIR:-1}" != "0" ]] || exit 0
[[ -f "$PWP_RUNTIME_ENV" && -f "$PWP_FS_HELPERS" ]] || exit 0

# shellcheck source=/dev/null
source "$PWP_RUNTIME_ENV"
# shellcheck source=/dev/null
source "$PWP_FS_HELPERS"

PWP_WWW_ROOT="${CORE_NODE_WWW_BASE:-/www}"
PWP_WWW_ROOT="$(readlink -f "$PWP_WWW_ROOT" 2>/dev/null || echo "$PWP_WWW_ROOT")"
PWP_HOT_TREE="$(readlink -f "$CORE_NODE_DATA_DIR" 2>/dev/null || echo "$CORE_NODE_DATA_DIR")"
PWP_STAMP_FILE="$PWP_WWW_ROOT/.pyservice_www_perm_repair.stamp"
PWP_LEGACY_TREE="$(readlink -f "$LEGACY_CORE_NODE_DATA_DIR" 2>/dev/null || echo "$LEGACY_CORE_NODE_DATA_DIR")"

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

# Tier 1: bounded trees the worker writes, synchronous.
if [[ -d "$PWP_HOT_TREE" ]]; then
    repair_owned_tree_777 "$PWP_HOT_TREE" "$PWP_REAL_USER" "$PWP_REAL_GROUP" || true
fi
if [[ -n "$PWP_LEGACY_TREE" && "$PWP_LEGACY_TREE" != "/" && -d "$PWP_LEGACY_TREE" ]]; then
    repair_owned_tree_777 "$PWP_LEGACY_TREE" "$PWP_REAL_USER" "$PWP_REAL_GROUP" || true
fi
# Venv location from its single source (gvar_common.sh VENV_DIR), resolved in
# an isolated subshell like pyservice_entry.sh resolve_python; none on hosted
# notebooks, where the system python is the interpreter.
PWP_VENV_DIR="$(
    set +uo pipefail
    source "$PWP_SCRIPT_DIR/gvar_common.sh" >/dev/null 2>&1
    source "$PWP_SCRIPT_DIR/venv_python_common.sh" >/dev/null 2>&1
    venv_notebook_platform_from_common && exit 0
    printf '%s' "${VENV_DIR:-}"
)"
if [[ -n "$PWP_VENV_DIR" && "$PWP_VENV_DIR" == /*/* && -d "$PWP_VENV_DIR" ]]; then
    repair_owned_tree_no_shared_write "$PWP_VENV_DIR" "$PWP_REAL_USER" "$PWP_REAL_GROUP" || true
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
