#!/bin/bash

# =============================================================================
# gitsync — quick command (D20)
# =============================================================================
# cd to the dd project root (central constant CORE_NODE_PROJECT_ROOT), ensure
# origin is the GitHub SSH remote, then add/commit/pull/push. All behavior
# lives in scripts/shells/linux/common/git_sync_common.sh; this is a thin
# wrapper so `gitsync` (and `gitsync --dry-run`) is available on PATH, in the
# same style as the other scripts/linuxenvs/ commands.

# Only this script's own location is resolved here (needed to locate its
# sibling library); the repo root itself is resolved by the shared
# git_sync_resolve_repo_root function below, so there is one implementation
# of "repo root from the script's own location" (git_sync_common.sh), not a
# second one duplicated here.
GITSYNC_SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
GITSYNC_SCRIPT_DIR="$(dirname "$GITSYNC_SCRIPT_PATH")"
GITSYNC_COMMON_DIR="$GITSYNC_SCRIPT_DIR/../shells/linux/common"
GVAR_COMMON_SH="$GITSYNC_COMMON_DIR/gvar_common.sh"
GIT_SYNC_COMMON_SH="$GITSYNC_COMMON_DIR/git_sync_common.sh"
GITSYNC_DRY_RUN=false
GITSYNC_REPO_ROOT=""
gitsync_arg=""

for gitsync_arg in "$@"; do
    case "$gitsync_arg" in
        --dry-run)
            GITSYNC_DRY_RUN=true
            ;;
        *)
            echo "[gitsync] Unknown option ignored: $gitsync_arg" >&2
            ;;
    esac
done

if [ ! -f "$GIT_SYNC_COMMON_SH" ]; then
    echo "[gitsync] ERROR: shared function not found: $GIT_SYNC_COMMON_SH" >&2
    exit 1
fi

source "$GVAR_COMMON_SH" >/dev/null
source "$GIT_SYNC_COMMON_SH"
GITSYNC_REPO_ROOT="$(git_sync_resolve_repo_root)"
if [ -z "$GITSYNC_REPO_ROOT" ]; then
    echo "[gitsync] ERROR: could not resolve the repo root" >&2
    exit 1
fi
git_sync_run "$GITSYNC_REPO_ROOT" "$GITSYNC_DRY_RUN"
