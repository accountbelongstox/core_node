#!/bin/bash
SCRIPT_INDEX="193"
# ---------------------------------------------------------------------------
# install_frontend_packages.sh - Frontend dependency prerequisite for the UI that
# pycore launches (poly_apps/pycore_laravel_wordnew_ui, the callmodule FRONTEND_DIR;
# every native_ui frontend app lives in that one workspace root). pycore only checks
# that node_modules exists and names this step; it never runs a package manager.
#
# Reuses the UI's own idempotent installer (scripts/start.sh --prepare --dev: node + bun
# toolchain, then `bun install` against bun.lock, a no-op when the tree is current).
# node_modules stays on ext4: on an NTFS repo checkout the empty in-repo mount point is
# bound to <trees_root.linux>/<ns>/node_modules first (project_tree_common.sh, contract
# trees_rule), so the install never writes the heavy tree onto NTFS. A Windows junction
# (symlink on Linux) is left alone and already resolves to ext4.
#
# Invocation: 193_install_frontend_packages.sh [--python <py>] [--force]
#   --python is accepted and unused; --force reinstalls from scratch (start.sh --force-install).
# ---------------------------------------------------------------------------
set -uo pipefail

FORCE=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$SCRIPT_DIR/../../common"
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
UI_APP_ROOT="$CORE_NODE_ROOT/poly_apps/pycore_laravel_wordnew_ui"
UI_START="$UI_APP_ROOT/scripts/start.sh"
NODE_MODULES="$UI_APP_ROOT/node_modules"
VITE_BIN="$NODE_MODULES/vite/bin/vite.js"
PREFIX="[install_frontend_packages] "
START_ARGS=(--prepare --dev)
REPO_FSTYPE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) shift 2 2>/dev/null || shift ;;
        --force)  FORCE=1; shift ;;
        *)        shift ;;
    esac
done
[[ "$FORCE" -eq 1 ]] && START_ARGS+=(--force-install)

. "$COMMON_DIR/shared_cache_env.sh"
. "$COMMON_DIR/mount_common.sh"
. "$COMMON_DIR/project_tree_common.sh"

echo "============================================================"
echo " Installing frontend packages (pycore UI)"
echo "============================================================"

[[ -f "$UI_APP_ROOT/package.json" && -f "$UI_START" ]] || { echo "${PREFIX}[!] frontend app not found: $UI_APP_ROOT" >&2; exit 1; }

REPO_FSTYPE="$(findmnt -n -o FSTYPE -T "$UI_APP_ROOT" 2>/dev/null | head -n1)"
if mount_is_ntfs_fstype "$REPO_FSTYPE"; then
    if [[ ! -e "$NODE_MODULES" ]]; then
        mkdir -p "$NODE_MODULES" || { echo "${PREFIX}[!] could not create the empty mount point $NODE_MODULES" >&2; exit 1; }
    fi
    project_tree_ensure "$UI_APP_ROOT" || { echo "${PREFIX}[!] ext4 trees bind failed; refusing to install node_modules onto NTFS." >&2; exit 1; }
fi

if [[ "$FORCE" -eq 0 && -f "$VITE_BIN" ]]; then
    echo "${PREFIX}[OK] dependencies present ($NODE_MODULES); converging in place."
fi
bash "$UI_START" "${START_ARGS[@]}" || { echo "${PREFIX}[!] frontend dependency install failed; will retry next run." >&2; exit 1; }
[[ -f "$VITE_BIN" ]] || { echo "${PREFIX}[!] vite is still missing under $NODE_MODULES." >&2; exit 1; }
echo "${PREFIX}[OK] frontend dependencies ready."
