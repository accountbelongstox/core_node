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
GIT_SYNC_VM_MARKER="VM"
GIT_SYNC_DESCRIPTION_PROMPT_SECONDS=3
GIT_SYNC_CHANGE_LIST_MAX=30
# Opt-in Laravel code-sync notice after a successful push (config/service_contract.json code_sync):
# the signed CLI starts the server job (gitsync --skip-notice-laravel, safe migrations, worker
# restart) and polls its status. The skip flag always wins; it is what the server job passes.
GIT_SYNC_NOTICE_FLAG="--notice-laravel"
GIT_SYNC_SKIP_NOTICE_FLAG="--skip-notice-laravel"
GIT_SYNC_SIGNED_CLI_RELATIVE="ncore/foundation/common/laravel_signed_cli.js"

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

# Succeeds when running inside a virtual machine.
git_sync_is_vm() {
    if command -v systemd-detect-virt >/dev/null 2>&1; then
        systemd-detect-virt --vm --quiet
        return
    fi
    grep -qw hypervisor /proc/cpuinfo 2>/dev/null
}

# Collapses whitespace in $1 to "-" so the commit message has no spaces.
git_sync_sanitize_description() {
    printf '%s' "$1" | tr -s '[:space:]' '-' | sed 's/^-*//;s/-*$//'
}

# Prints the staged changes (status + path, at most GIT_SYNC_CHANGE_LIST_MAX
# lines) so the user sees what will be committed before describing it.
git_sync_print_staged_changes() {
    local changes="" change_count=0

    changes="$(git diff --cached --name-status 2>/dev/null)"
    [ -n "$changes" ] && change_count="$(printf '%s\n' "$changes" | wc -l | tr -d ' ')"
    echo "[gitsync] Staged changes: $change_count file(s)" >&2
    [ "$change_count" -gt 0 ] || return 0
    printf '%s\n' "$changes" | head -n "$GIT_SYNC_CHANGE_LIST_MAX" | sed 's/^/[gitsync]   /' >&2
    if [ "$change_count" -gt "$GIT_SYNC_CHANGE_LIST_MAX" ]; then
        echo "[gitsync]   ... and $((change_count - GIT_SYNC_CHANGE_LIST_MAX)) more" >&2
    fi
}

# Description from $1, else from the terminal: typing any key within
# GIT_SYNC_DESCRIPTION_PROMPT_SECONDS starts it, Enter finishes it.
# no_prompt="true" ($2, set by -m/--message) never prompts, so AI agents and
# scripts commit non-interactively.
git_sync_read_description() {
    local description="$1"
    local no_prompt="${2:-false}"
    local first_char="" rest=""

    git_sync_print_staged_changes
    if [ -z "$description" ] && [ "$no_prompt" != "true" ] && [ -t 0 ]; then
        echo "[gitsync] Type a commit description within ${GIT_SYNC_DESCRIPTION_PROMPT_SECONDS}s (Enter to finish), or wait to skip:" >&2
        if IFS= read -r -n 1 -t "$GIT_SYNC_DESCRIPTION_PROMPT_SECONDS" first_char && [ -n "$first_char" ]; then
            IFS= read -r rest
            description="$first_char$rest"
        fi
    fi
    git_sync_sanitize_description "$description"
}

# <systemname><version>[VM]<YYYY-MM-DD-HH-MM-SS>[-description], no spaces,
# e.g. debian131.0.0VM2026-10-01-17-51-18-fix-login.
git_sync_compute_commit_message() {
    local repo_root="$1"
    local description="$2"
    local systemname="" version="" vm_marker="" timestamp=""

    systemname="$(git_sync_get_systemname)"
    version="$(git_sync_get_project_version "$repo_root")"
    git_sync_is_vm && vm_marker="$GIT_SYNC_VM_MARKER"
    timestamp="$(date "+%Y-%m-%d-%H-%M-%S")"
    echo "${systemname}${version}${vm_marker}${timestamp}${description:+-$description}"
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
# would run and executes none of the git writes. no_prompt="true" skips the
# description prompt (see git_sync_read_description).
git_sync_run() {
    local repo_root="$1"
    local dry_run="${2:-false}"
    local description="$3"
    local no_prompt="${4:-false}"
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

    if [ "$dry_run" = "true" ]; then
        commit_message="$(git_sync_compute_commit_message "$repo_root" "$(git_sync_sanitize_description "$description")")"
        echo "[gitsync] Commit message: $commit_message"
        echo "[gitsync] Would run: git add ."
        git status --short | head -n "$GIT_SYNC_CHANGE_LIST_MAX" | sed 's/^/[gitsync]   /'
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
        commit_message="$(git_sync_compute_commit_message "$repo_root" "$(git_sync_read_description "$description" "$no_prompt")")"
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

# git_sync_notice_laravel REPO_ROOT DRY_RUN -> asks the Laravel server to pull, migrate and
# restart its workers, and waits for the job (bounded). Never fails the local gitsync.
git_sync_notice_laravel() {
    local repo_root="$1"
    local dry_run="${2:-false}"
    local cli="$repo_root/$GIT_SYNC_SIGNED_CLI_RELATIVE"

    if [ "$dry_run" = "true" ]; then
        echo "[gitsync] Would run: node $cli code-sync"
        return 0
    fi
    if ! command -v node >/dev/null 2>&1; then
        echo "[gitsync] WARNING: node not found; Laravel was not notified (run: node $cli code-sync)" >&2
        return 0
    fi
    echo "[gitsync] Notifying Laravel: node $cli code-sync"
    if ! node "$cli" code-sync; then
        echo "[gitsync] WARNING: Laravel code sync did not complete; check: node $cli request GET /api/system/code-sync/status" >&2
    fi
    return 0
}

# CLI entry shared by `gitsync` (scripts/linuxenvs/gitsync.sh) and
# `dd.sh gitsync`:
#   gitsync [--dry-run] [--notice-laravel] [--skip-notice-laravel] [-m|--message <description>] [description...]
#   --dry-run       print every git command, run no git write
#   --notice-laravel       after a successful push, make the Laravel server pull, migrate and
#                          restart its workers (opt-in; waits for the job)
#   --skip-notice-laravel  never notify (wins over --notice-laravel; used by the server job)
#   -m, --message   commit description, no 3s prompt (non-interactive; the
#                   form AI agents use to commit, e.g. `gitsync -m "fix login"`)
#   description...  bare words are the description too (also skips the prompt)
# Without a description the staged changes are listed, then a
# GIT_SYNC_DESCRIPTION_PROMPT_SECONDS prompt waits for an optional one.
git_sync_cli() {
    local dry_run=false no_prompt=false description="" arg="" repo_root="" notice=false skip_notice=false rc=0

    while [ $# -gt 0 ]; do
        arg="$1"
        shift
        case "$arg" in
            --dry-run)
                dry_run=true
                ;;
            "$GIT_SYNC_NOTICE_FLAG")
                notice=true
                ;;
            "$GIT_SYNC_SKIP_NOTICE_FLAG")
                skip_notice=true
                ;;
            -m|--message)
                no_prompt=true
                if [ $# -gt 0 ]; then
                    description="${description:+$description }$1"
                    shift
                fi
                ;;
            --message=*)
                no_prompt=true
                description="${description:+$description }${arg#--message=}"
                ;;
            -*)
                echo "[gitsync] Unknown option ignored: $arg" >&2
                ;;
            *)
                description="${description:+$description }$arg"
                ;;
        esac
    done

    repo_root="$(git_sync_resolve_repo_root)"
    if [ -z "$repo_root" ]; then
        echo "[gitsync] ERROR: could not resolve the repo root" >&2
        return 1
    fi
    git_sync_run "$repo_root" "$dry_run" "$description" "$no_prompt"
    rc=$?
    if [ $rc -eq 0 ] && [ "$notice" = true ] && [ "$skip_notice" = false ]; then
        git_sync_notice_laravel "$repo_root" "$dry_run"
    fi
    return $rc
}
