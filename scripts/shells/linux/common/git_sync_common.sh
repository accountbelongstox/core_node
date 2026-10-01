#!/bin/bash

# =============================================================================
# Git Sync Common (D20) — shared "gitsync" behavior
# =============================================================================
# Ensures origin is the GitHub SSH remote (never Gitee), commits any pending
# local changes with a generated message, then pulls and pushes the target
# branch. One implementation, reused by:
#   - scripts/linuxenvs/gitsync.sh   (the "gitsync" quick command)
#   - dd.sh "gitsync" argument       (scripts/shells/linux/dd_helper/main_execution.sh)
#   - scripts/git/gitput_unified.sh  (origin-ensuring step only)
#
# Every git write here (remote add/set-url, add, commit, pull, push) is
# skipped entirely when dry_run="true"; only read-only git commands
# (remote get-url, status, diff) run in that mode.

GIT_SYNC_TARGET_BRANCH="main"
GIT_SYNC_REMOTE_NAME="origin"
GIT_SYNC_REMOTES_CONF_RELATIVE="scripts/git/git_remotes.conf"
GIT_SYNC_PACKAGE_JSON_RELATIVE="package.json"
GIT_SYNC_OS_RELEASE_FILE="/etc/os-release"
GIT_SYNC_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_SYNC_LOCK_FILES=("index.lock" "HEAD.lock" "ORIG_HEAD.lock" "refs/heads/$GIT_SYNC_TARGET_BRANCH.lock")
GIT_SYNC_LOCK_STALE_SECONDS=60
GIT_SYNC_LOCK_POLL_SECONDS=2

# Resolve the dd project root without a hardcoded path: prefer the central
# constant CORE_NODE_PROJECT_ROOT (gvar_common.sh -> gvar_storage_common.sh),
# then CORE_NODE_ROOT_DIR (dd.sh context), then this file's own fixed
# location under scripts/shells/linux/common/, then `git rev-parse`.
git_sync_resolve_repo_root() {
    local candidate=""

    if [ -n "${CORE_NODE_PROJECT_ROOT:-}" ] && [ -f "$CORE_NODE_PROJECT_ROOT/dd.sh" ]; then
        echo "$CORE_NODE_PROJECT_ROOT"
        return 0
    fi

    if [ -n "$CORE_NODE_ROOT_DIR" ] && [ -f "$CORE_NODE_ROOT_DIR/dd.sh" ]; then
        echo "$CORE_NODE_ROOT_DIR"
        return 0
    fi

    candidate="$(cd "$GIT_SYNC_COMMON_DIR/../../../.." 2>/dev/null && pwd)"
    if [ -n "$candidate" ] && [ -f "$candidate/dd.sh" ]; then
        echo "$candidate"
        return 0
    fi

    candidate="$(git rev-parse --show-toplevel 2>/dev/null)"
    if [ -n "$candidate" ] && [ -f "$candidate/dd.sh" ]; then
        echo "$candidate"
        return 0
    fi

    return 1
}

# Reads the "github=" SSH URL from git_remotes.conf (owned by shell-windows
# for D20; read-only here). Keeps one definition of the URL.
git_sync_get_github_ssh_url() {
    local repo_root="$1"
    local conf_file="$repo_root/$GIT_SYNC_REMOTES_CONF_RELATIVE"
    local url=""

    if [ -f "$conf_file" ]; then
        url="$(grep -E '^[[:space:]]*github[[:space:]]*=' "$conf_file" | head -n1 | cut -d'=' -f2-)"
        url="$(echo "$url" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    fi
    echo "$url"
}

# Unconditionally points $1 remote at $2: `git remote add` when the remote
# does not exist yet, else `git remote set-url`. This is the ONE function that
# performs the actual git remote write, reused by:
#   - git_sync_set_remote_if_different below (the idempotent D20 check), and
#   - gitput_repository_state.sh's set_remote_url (the existing gitput_unified
#     multi-target push/restore flow, D20-LIN-LINKAGE), instead of a second
#     inline `git remote set-url origin ...` line there.
# Never used in dry-run mode.
git_sync_set_remote_url() {
    local remote_name="$1"
    local target_url="$2"
    local current_url=""

    current_url="$(git remote get-url "$remote_name" 2>/dev/null)"
    if [ -z "$current_url" ]; then
        echo "[gitsync] Executing: git remote add $remote_name $target_url"
        git remote add "$remote_name" "$target_url"
    else
        echo "[gitsync] Executing: git remote set-url $remote_name $target_url"
        git remote set-url "$remote_name" "$target_url"
    fi
}

# Sets $1 remote to $2 only when it currently differs (idempotent, finest
# grain); read-only (git remote get-url) when already correct. Never touches
# any other remote.
git_sync_set_remote_if_different() {
    local remote_name="$1"
    local target_url="$2"
    local dry_run="${3:-false}"
    local current_url=""

    current_url="$(git remote get-url "$remote_name" 2>/dev/null)"
    if [ "$current_url" = "$target_url" ]; then
        echo "[gitsync] $remote_name already set to: $target_url (no change needed)"
        return 0
    fi

    if [ "$dry_run" = "true" ]; then
        if [ -z "$current_url" ]; then
            echo "[gitsync] Would run: git remote add $remote_name $target_url"
        else
            echo "[gitsync] Would run: git remote set-url $remote_name $target_url  (current: $current_url)"
        fi
        return 0
    fi

    git_sync_set_remote_url "$remote_name" "$target_url"
}

# Ensures origin is the GitHub SSH URL, never Gitee. Reused by gitsync and by
# gitput_unified.sh so there is one behavior for this step.
git_sync_ensure_github_ssh_origin() {
    local repo_root="$1"
    local dry_run="${2:-false}"
    local github_url=""

    github_url="$(git_sync_get_github_ssh_url "$repo_root")"
    if [ -z "$github_url" ]; then
        echo "[gitsync] ERROR: no 'github=' SSH entry in $repo_root/$GIT_SYNC_REMOTES_CONF_RELATIVE" >&2
        return 1
    fi

    git_sync_set_remote_if_different "$GIT_SYNC_REMOTE_NAME" "$github_url" "$dry_run"
}

# <distro id><major> from /etc/os-release, e.g. debian13, ubuntu26. Kali is a
# rolling release with no stable major version, so it stays bare "kali".
git_sync_get_systemname() {
    local id="" version_id="" major=""

    if [ -f "$GIT_SYNC_OS_RELEASE_FILE" ]; then
        id="$(grep -E '^ID=' "$GIT_SYNC_OS_RELEASE_FILE" | head -n1 | cut -d= -f2- | tr -d '"')"
        version_id="$(grep -E '^VERSION_ID=' "$GIT_SYNC_OS_RELEASE_FILE" | head -n1 | cut -d= -f2- | tr -d '"')"
    fi
    [ -z "$id" ] && id="linux"

    if [ "$id" = "kali" ]; then
        echo "$id"
        return 0
    fi

    major="${version_id%%.*}"
    if [ -n "$major" ] && [[ "$major" =~ ^[0-9]+$ ]]; then
        echo "${id}${major}"
    else
        echo "$id"
    fi
}

# The project's single version definition: root package.json "version". No
# dedicated dd/core_node version constant exists in dd.sh, dd.ps1 or the
# gitunified modules (checked for D20); never add a second one here.
git_sync_get_project_version() {
    local repo_root="$1"
    local package_json="$repo_root/$GIT_SYNC_PACKAGE_JSON_RELATIVE"
    local version=""

    if [ -f "$package_json" ]; then
        version="$(grep -m1 '"version"[[:space:]]*:' "$package_json" | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')"
    fi
    [ -z "$version" ] && version="0.0.0"
    echo "$version"
}

# <systemname><version>up<timestamp>, e.g. debian131.0.0up20260927-171530.
git_sync_compute_commit_message() {
    local repo_root="$1"
    local systemname="" version="" timestamp=""

    systemname="$(git_sync_get_systemname)"
    version="$(git_sync_get_project_version "$repo_root")"
    timestamp="$(date "+%Y%m%d-%H%M%S")"
    echo "${systemname}${version}up${timestamp}"
}

# Seconds since $1 was last modified.
git_sync_file_age_seconds() {
    local file_path="$1"
    local mtime=""

    mtime="$(stat -c %Y "$file_path" 2>/dev/null || stat -f %m "$file_path" 2>/dev/null)"
    [ -z "$mtime" ] && mtime="$(date +%s)"
    echo $(( $(date +%s) - mtime ))
}

# Waits for each git lock file to be released; one still present after
# GIT_SYNC_LOCK_STALE_SECONDS without changes is a leftover of a crashed git
# process and is removed.
git_sync_clear_stale_locks() {
    local dry_run="${1:-false}"
    local lock_name="" lock_path="" lock_age=0

    for lock_name in "${GIT_SYNC_LOCK_FILES[@]}"; do
        lock_path="$(git rev-parse --git-path "$lock_name" 2>/dev/null)"
        [ -n "$lock_path" ] || continue
        while [ -e "$lock_path" ]; do
            lock_age="$(git_sync_file_age_seconds "$lock_path")"
            if [ "$lock_age" -ge "$GIT_SYNC_LOCK_STALE_SECONDS" ]; then
                if [ "$dry_run" = "true" ]; then
                    echo "[gitsync] Would remove stale lock (${lock_age}s old): $lock_path"
                    break
                fi
                echo "[gitsync] Removing stale lock (${lock_age}s old): $lock_path"
                rm -f "$lock_path" || { echo "[gitsync] ERROR: cannot remove $lock_path" >&2; return 1; }
                break
            fi
            echo "[gitsync] Waiting for active git lock: $lock_path (${lock_age}s old)"
            sleep "$GIT_SYNC_LOCK_POLL_SECONDS"
        done
    done
}

# Resumes an interrupted sync: stops on an unfinished rebase/cherry-pick or
# unresolved merge conflicts, and concludes a merge whose conflicts are all
# resolved so the following pull/push can proceed.
git_sync_resume_pending_state() {
    local dry_run="${1:-false}"
    local unmerged="" state_name=""

    for state_name in rebase-merge rebase-apply CHERRY_PICK_HEAD REVERT_HEAD; do
        if [ -e "$(git rev-parse --git-path "$state_name")" ]; then
            echo "[gitsync] ERROR: an unfinished git operation is in progress ($state_name)." >&2
            echo "[gitsync] Next step: finish it ('git rebase --continue' / 'git cherry-pick --continue') or abort it, then run 'gitsync' again." >&2
            return 1
        fi
    done

    unmerged="$(git diff --name-only --diff-filter=U 2>/dev/null)"
    if [ -n "$unmerged" ]; then
        echo "[gitsync] ERROR: unresolved conflicts. Push skipped." >&2
        echo "[gitsync] Conflicted paths:" >&2
        echo "$unmerged" >&2
        echo "[gitsync] Next step: resolve the conflicts, 'git add <file>', then run 'gitsync' again." >&2
        return 1
    fi

    if [ -e "$(git rev-parse --git-path MERGE_HEAD)" ]; then
        if [ "$dry_run" = "true" ]; then
            echo "[gitsync] Would run: git add . && git commit --no-edit  (conclude pending merge)"
            return 0
        fi
        echo "[gitsync] Concluding pending merge: git add . && git commit --no-edit"
        git add . && git commit --no-edit || return 1
    fi
}

# Full gitsync behavior (idempotent, safe to re-run after any interruption):
# cd repo root, ensure GitHub SSH origin, clear stale locks, resume a pending
# merge, add, commit
# (skipped when nothing changed), pull, push. On a pull conflict or failure:
# stop, print the conflicted paths and the next manual step, never push,
# never auto-resolve, never force. dry_run="true" prints every command it
# would run and executes none of the git writes.
git_sync_run() {
    local repo_root="$1"
    local dry_run="${2:-false}"
    local commit_message="" pull_output="" pull_rc=0

    if [ -z "$repo_root" ] || [ ! -d "$repo_root" ]; then
        echo "[gitsync] ERROR: repo root not found: $repo_root" >&2
        return 1
    fi

    cd "$repo_root" || { echo "[gitsync] ERROR: cannot cd to $repo_root" >&2; return 1; }
    echo "[gitsync] Repo root: $repo_root"

    if ! git_sync_ensure_github_ssh_origin "$repo_root" "$dry_run"; then
        return 1
    fi

    git_sync_clear_stale_locks "$dry_run" || return 1
    git_sync_resume_pending_state "$dry_run" || return 1

    commit_message="$(git_sync_compute_commit_message "$repo_root")"
    echo "[gitsync] Commit message: $commit_message"

    if [ "$dry_run" = "true" ]; then
        echo "[gitsync] Would run: git add ."
        if [ -n "$(git status --porcelain)" ]; then
            echo "[gitsync] Would run: git commit -m \"$commit_message\""
        else
            echo "[gitsync] Working tree already clean; commit would be skipped."
        fi
        echo "[gitsync] Would run: git pull --no-rebase origin $GIT_SYNC_TARGET_BRANCH"
        echo "[gitsync] Would run: git push origin $GIT_SYNC_TARGET_BRANCH"
        echo "[gitsync] Dry run complete; no git command was executed."
        return 0
    fi

    echo "[gitsync] Executing: git add ."
    git add . || return 1
    if git diff --cached --quiet; then
        echo "[gitsync] Nothing staged; skipping commit."
    else
        echo "[gitsync] Executing: git commit -m \"$commit_message\""
        git commit -m "$commit_message" || return 1
    fi

    echo "[gitsync] Executing: git pull --no-rebase origin $GIT_SYNC_TARGET_BRANCH"
    pull_output="$(git pull --no-rebase origin "$GIT_SYNC_TARGET_BRANCH" 2>&1)"
    pull_rc=$?
    echo "$pull_output"

    if [ $pull_rc -ne 0 ] || echo "$pull_output" | grep -qiE "CONFLICT|Automatic merge failed"; then
        echo "[gitsync] ERROR: pull failed or produced conflicts. Push skipped." >&2
        echo "[gitsync] Conflicted paths:" >&2
        git diff --name-only --diff-filter=U >&2 2>/dev/null
        echo "[gitsync] Next step: resolve the conflicts manually (edit the files, 'git add <file>'), then run 'gitsync' again." >&2
        return 1
    fi

    echo "[gitsync] Executing: git push origin $GIT_SYNC_TARGET_BRANCH"
    git push origin "$GIT_SYNC_TARGET_BRANCH"
}
