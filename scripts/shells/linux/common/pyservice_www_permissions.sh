#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# pyservice_www_permissions.sh - The ONE idempotent permission gateway that hands
# root-created entries back to the real (regular) user: the mapped web data
# root plus every tool, cache and HOME path root installers write and the user
# later uses.
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
# Callers (each as root; a non-root caller exits at once): pyservice_entry.sh
# (post-elevation, and again right before dropping to the desktop user, after
# the prerequisite installers), the pycore unit's ExecStartPre=+, the install
# step runners after every step (install_item_runner.sh,
# prepare_pycore_prerequisites.sh, testselector.sh, app_install_menu.sh) and
# the owner guard's periodic full sweep (runtime root writers: root IDE / AI
# CLI sessions in the user's HOME).
#
# Idempotency tiers:
#   1. Every run, synchronous (one find walk each; only mismatched entries
#      change), so the worker never meets a root-owned entry it needs:
#      - CORE_NODE_DATA_DIR and the scratch temp LEGACY_CORE_NODE_DATA_DIR/_tmp
#        (e.g. _tmp/work): shared owner/mode-777 policy;
#      - the rest of LEGACY_CORE_NODE_DATA_DIR (model caches, sticky shared
#        dirs, private agent_history): owner only, modes untouched;
#      - user-run tool trees under $COMPILE_DIR (project venv, pipx, poetry,
#        ruby gems, android-sdk, isolated py_venv_* engines): owned by the user
#        without shared write, so the user can install into them;
#      - the pnpm global dir: shared owner/mode-777 policy (as step 17);
#      - the shared tool caches (contract cache_root: uv/npm/corepack/bun/
#        composer/pip), the --user pip base and COMPOSER_HOME: owner only;
#      - the real user's HOME: owner only (modes untouched, so ~/.ssh and
#        private 600 files keep their modes).
#   1b. Every run, in the background behind a lock: owner only on
#      $CORE_NODE_WWW_BASE/programing and /wwwroot (root git clones, data).
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
PWP_COMPILE_DIR=""
PWP_PNPM_DIR=""
PWP_CACHE_ROOT=""
PWP_USERBASE_DIR=""
PWP_LANG_DIR=""
PWP_HOME_DIR=""
PWP_KEY=""
PWP_VALUE=""
PWP_TOOL=""

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
    repair_owned_tree_owner_only "$PWP_LEGACY_TREE" "$PWP_REAL_USER" "$PWP_REAL_GROUP" || true
    [[ -d "$PWP_LEGACY_TREE/_tmp" ]] && { repair_owned_tree_777 "$PWP_LEGACY_TREE/_tmp" "$PWP_REAL_USER" "$PWP_REAL_GROUP" || true; }
fi
# Tool and cache locations from their single sources (gvar_common.sh,
# venv_python_common.sh, the service contract), resolved in an isolated
# subshell like pyservice_entry.sh resolve_python; no venv on hosted notebooks,
# where the system python is the interpreter.
while IFS='=' read -r PWP_KEY PWP_VALUE; do
    case "$PWP_KEY" in
        VENV) PWP_VENV_DIR="$PWP_VALUE" ;;
        COMPILE) PWP_COMPILE_DIR="$PWP_VALUE" ;;
        PNPM) PWP_PNPM_DIR="$PWP_VALUE" ;;
        CACHE) PWP_CACHE_ROOT="$PWP_VALUE" ;;
        USERBASE) PWP_USERBASE_DIR="$PWP_VALUE" ;;
        LANG) PWP_LANG_DIR="$PWP_VALUE" ;;
    esac
done < <(
    set +uo pipefail
    source "$PWP_SCRIPT_DIR/gvar_common.sh" >/dev/null 2>&1
    source "$PWP_SCRIPT_DIR/venv_python_common.sh" >/dev/null 2>&1
    source "$PWP_SCRIPT_DIR/service_contract_common.sh" >/dev/null 2>&1
    venv_notebook_platform_from_common || echo "VENV=${VENV_DIR:-}"
    echo "COMPILE=${COMPILE_DIR:-}"
    echo "PNPM=${PNPM_GLOBAL_DIR:-}"
    echo "CACHE=$(sc_get paths.drive_layout.cache_root.linux 2>/dev/null)"
    echo "USERBASE=${PYCORE_PYUSERBASE:-}"
    [ -n "${VENV_PYTHON3:-}" ] && echo "LANG=$(dirname "$(dirname "$(readlink -f "$VENV_PYTHON3")")")"
)
PWP_HOME_DIR="$(getent passwd "$PWP_REAL_USER" 2>/dev/null | cut -d: -f6)"

pwp_safe_dir() {
    [[ -n "$1" && "$1" == /*/* && -d "$1" ]]
}

pwp_tool_tree() {
    pwp_safe_dir "$1" && { repair_owned_tree_no_shared_write "$1" "$PWP_REAL_USER" "$PWP_REAL_GROUP" || true; }
}

pwp_owner_tree() {
    pwp_safe_dir "$1" && { repair_owned_tree_owner_only "$1" "$PWP_REAL_USER" "$PWP_REAL_GROUP" || true; }
}

pwp_tool_tree "$PWP_VENV_DIR"
if pwp_safe_dir "$PWP_COMPILE_DIR"; then
    for PWP_TOOL in pipx_home pipx_venv poetry_venv applications/ruby/gems android-sdk; do
        pwp_tool_tree "$PWP_COMPILE_DIR/$PWP_TOOL"
    done
fi
for PWP_TOOL in "$PWP_COMPILE_DIR"/py_venv_* "$PWP_LANG_DIR"/py_venv_*; do
    pwp_tool_tree "$PWP_TOOL"
done
pwp_safe_dir "$PWP_PNPM_DIR" && { repair_owned_tree_777 "$PWP_PNPM_DIR" "$PWP_REAL_USER" "$PWP_REAL_GROUP" || true; }
pwp_owner_tree "$PWP_CACHE_ROOT"
pwp_owner_tree "${PWP_USERBASE_DIR:-/opt/_core_node/pyuserbase}"
pwp_owner_tree "${COMPOSER_HOME:-/usr/local/share/composer}"
[[ "$PWP_HOME_DIR" == /home/* ]] && pwp_owner_tree "$PWP_HOME_DIR"

# Tier 1b: root git clones and data under the web root, owner only, in the
# background behind a lock (a large NTFS tree never blocks; overlapping callers
# skip instead of stacking walks).
(
    exec 9>"/run/pyservice_www_permissions.lock" || exit 0
    flock -n 9 || exit 0
    for PWP_TOOL in "$PWP_WWW_ROOT/programing" "$PWP_WWW_ROOT/wwwroot"; do
        pwp_owner_tree "$PWP_TOOL"
    done
) &

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
