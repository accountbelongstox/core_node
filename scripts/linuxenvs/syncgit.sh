#!/bin/bash

# =============================================================================
# syncgit — quick command (D20)
# =============================================================================
# cd to the dd project root (central constant CORE_NODE_PROJECT_ROOT), ensure
# origin is the GitHub SSH remote, then add/commit/pull/push. All behavior
# lives in scripts/shells/linux/common/git_sync_common.sh; this is a thin
# wrapper so `syncgit` (and `syncgit --dry-run`) is available on PATH, in the
# same style as the other scripts/linuxenvs/ commands.

# Only this script's own location is resolved here (needed to locate its
# sibling library); the repo root itself is resolved by the shared
# git_sync_resolve_repo_root function below, so there is one implementation
# of "repo root from the script's own location" (git_sync_common.sh), not a
# second one duplicated here.
SYNCGIT_SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SYNCGIT_SCRIPT_DIR="$(dirname "$SYNCGIT_SCRIPT_PATH")"
SYNCGIT_COMMON_DIR="$SYNCGIT_SCRIPT_DIR/../shells/linux/common"
GVAR_COMMON_SH="$SYNCGIT_COMMON_DIR/gvar_common.sh"
GIT_SYNC_COMMON_SH="$SYNCGIT_COMMON_DIR/git_sync_common.sh"
SYNCGIT_DRY_RUN=false
SYNCGIT_REPO_ROOT=""
syncgit_arg=""

for syncgit_arg in "$@"; do
    case "$syncgit_arg" in
        --dry-run)
            SYNCGIT_DRY_RUN=true
            ;;
        *)
            echo "[syncgit] Unknown option ignored: $syncgit_arg" >&2
            ;;
    esac
done

if [ ! -f "$GIT_SYNC_COMMON_SH" ]; then
    echo "[syncgit] ERROR: shared function not found: $GIT_SYNC_COMMON_SH" >&2
    exit 1
fi

source "$GVAR_COMMON_SH" >/dev/null
source "$GIT_SYNC_COMMON_SH"
SYNCGIT_REPO_ROOT="$(git_sync_resolve_repo_root)"
if [ -z "$SYNCGIT_REPO_ROOT" ]; then
    echo "[syncgit] ERROR: could not resolve the repo root" >&2
    exit 1
fi
git_sync_run "$SYNCGIT_REPO_ROOT" "$SYNCGIT_DRY_RUN"
