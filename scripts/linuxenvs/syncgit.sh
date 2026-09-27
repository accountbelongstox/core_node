#!/bin/bash

# =============================================================================
# syncgit — quick command (D20)
# =============================================================================
# cd to the repo root (resolved from this script's own location), ensure
# origin is the GitHub SSH remote, then add/commit/pull/push. All behavior
# lives in scripts/shells/linux/common/git_sync_common.sh; this is a thin
# wrapper so `syncgit` (and `syncgit --dry-run`) is available on PATH, in the
# same style as the other scripts/linuxenvs/ commands.

SYNCGIT_SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SYNCGIT_SCRIPT_DIR="$(dirname "$SYNCGIT_SCRIPT_PATH")"
SYNCGIT_REPO_ROOT="$(cd "$SYNCGIT_SCRIPT_DIR/../.." && pwd)"
GIT_SYNC_COMMON_SH="$SYNCGIT_REPO_ROOT/scripts/shells/linux/common/git_sync_common.sh"
SYNCGIT_DRY_RUN=false
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

source "$GIT_SYNC_COMMON_SH"
git_sync_run "$SYNCGIT_REPO_ROOT" "$SYNCGIT_DRY_RUN"
