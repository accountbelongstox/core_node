#!/bin/bash

# =============================================================================
# Git Sync Common (D20) — shared "syncgit" behavior
# =============================================================================
# Ensures origin is the GitHub SSH remote (never Gitee), commits any pending
# local changes with a generated message, then pulls and pushes the target
# branch. One implementation, reused by:
#   - scripts/linuxenvs/syncgit.sh   (the "syncgit" quick command)
#   - dd.sh "syncgit" argument       (scripts/shells/linux/dd_helper/main_execution.sh)
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

# Resolve the repo root without a hardcoded path: prefer an already-known
# CORE_NODE_ROOT_DIR (dd.sh context), else derive it from this file's own
# fixed location under scripts/shells/linux/common/, else fall back to `git
# rev-parse` from the current directory.
git_sync_resolve_repo_root() {
    local candidate=""

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
        echo "[syncgit] $remote_name already set to: $target_url (no change needed)"
        return 0
    fi

    if [ "$dry_run" = "true" ]; then
        if [ -z "$current_url" ]; then
            echo "[syncgit] Would run: git remote add $remote_name $target_url"
        else
            echo "[syncgit] Would run: git remote set-url $remote_name $target_url  (current: $current_url)"
        fi
        return 0
    fi

    if [ -z "$current_url" ]; then
        echo "[syncgit] Executing: git remote add $remote_name $target_url"
        git remote add "$remote_name" "$target_url"
    else
        echo "[syncgit] Executing: git remote set-url $remote_name $target_url"
        git remote set-url "$remote_name" "$target_url"
    fi
}

# Ensures origin is the GitHub SSH URL, never Gitee. Reused by syncgit and by
# gitput_unified.sh so there is one behavior for this step.
git_sync_ensure_github_ssh_origin() {
    local repo_root="$1"
    local dry_run="${2:-false}"
    local github_url=""

    github_url="$(git_sync_get_github_ssh_url "$repo_root")"
    if [ -z "$github_url" ]; then
        echo "[syncgit] ERROR: no 'github=' SSH entry in $repo_root/$GIT_SYNC_REMOTES_CONF_RELATIVE" >&2
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

# Full syncgit behavior: cd repo root, ensure GitHub SSH origin, add, commit
# (skipped when nothing changed), pull, push. On a pull conflict or failure:
# stop, print the conflicted paths and the next manual step, never push,
# never auto-resolve, never force. dry_run="true" prints every command it
# would run and executes none of the git writes.
git_sync_run() {
    local repo_root="$1"
    local dry_run="${2:-false}"
    local commit_message="" pull_output="" pull_rc=0

    if [ -z "$repo_root" ] || [ ! -d "$repo_root" ]; then
        echo "[syncgit] ERROR: repo root not found: $repo_root" >&2
        return 1
    fi

    cd "$repo_root" || { echo "[syncgit] ERROR: cannot cd to $repo_root" >&2; return 1; }
    echo "[syncgit] Repo root: $repo_root"

    if ! git_sync_ensure_github_ssh_origin "$repo_root" "$dry_run"; then
        return 1
    fi

    commit_message="$(git_sync_compute_commit_message "$repo_root")"
    echo "[syncgit] Commit message: $commit_message"

    if [ "$dry_run" = "true" ]; then
        echo "[syncgit] Would run: git add ."
        if [ -n "$(git status --porcelain)" ]; then
            echo "[syncgit] Would run: git commit -m \"$commit_message\""
        else
            echo "[syncgit] Working tree already clean; commit would be skipped."
        fi
        echo "[syncgit] Would run: git pull origin $GIT_SYNC_TARGET_BRANCH"
        echo "[syncgit] Would run: git push origin $GIT_SYNC_TARGET_BRANCH"
        echo "[syncgit] Dry run complete; no git command was executed."
        return 0
    fi

    echo "[syncgit] Executing: git add ."
    git add .
    if git diff --cached --quiet; then
        echo "[syncgit] Nothing staged; skipping commit."
    else
        echo "[syncgit] Executing: git commit -m \"$commit_message\""
        git commit -m "$commit_message"
    fi

    echo "[syncgit] Executing: git pull origin $GIT_SYNC_TARGET_BRANCH"
    pull_output="$(git pull origin "$GIT_SYNC_TARGET_BRANCH" 2>&1)"
    pull_rc=$?
    echo "$pull_output"

    if [ $pull_rc -ne 0 ] || echo "$pull_output" | grep -qiE "CONFLICT|Automatic merge failed"; then
        echo "[syncgit] ERROR: pull failed or produced conflicts. Push skipped." >&2
        echo "[syncgit] Conflicted paths:" >&2
        git diff --name-only --diff-filter=U >&2
        echo "[syncgit] Next step: resolve the conflicts manually (edit the files, 'git add <file>', 'git commit'), then run 'syncgit' again." >&2
        return 1
    fi

    echo "[syncgit] Executing: git push origin $GIT_SYNC_TARGET_BRANCH"
    git push origin "$GIT_SYNC_TARGET_BRANCH"
}
