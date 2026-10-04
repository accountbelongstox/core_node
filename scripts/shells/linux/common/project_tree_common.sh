#!/bin/bash

# Per-project heavy-directory ext4 bind (node_modules, vendor, .venv): the
# Linux counterpart of scripts/shells/win/win_common/ProjectTreeCommon.ps1.
#
# Background: docs_fix/DESIGN_SHELL_HOSTS.md section
# 4.5 traces the D: dirty-volume corruption to Linux hard-linking/reparse-
# writing toolchain caches (Bun/pnpm) onto the NTFS share. Windows itself has
# no such problem writing plain files to its own native NTFS, so while the E:
# program drive is absent Windows simply keeps node_modules/vendor/.venv
# local (ProjectTreeCommon.ps1 Invoke-ProjectTreeLinks -> the
# Restore-ProjectTreeLocalDirectory branch, no linking at all). On Linux the
# LINUX_SHELL_RULES.md "NTFS holds code and shared data only" rule still
# forbids letting an active install (npm/pnpm/composer/uv) write its heavy
# tree onto the NTFS-backed repo checkout, so THIS file binds the ext4
# directory <trees_root.linux>/<ns>/<dir> (contract paths.drive_layout,
# read once here through service_contract_common.sh, never redeclared as a
# literal) directly over the plain in-repo directory at start time, guarded
# by mountpoint -q. Runtime bind only: no fstab entry, no persisted state --
# every start re-runs `ensure`. See docs section "P1b audit result" group G11
# and the "User decision (2026-09-27)" note right after it: this applies only
# while the repo entry is a plain directory (Windows without E:); once a
# project's entry becomes a Windows junction translated by ntfs3 into a
# symlink, this script leaves it alone (the P6 junction-translation proof).
#
# Never writes, deletes or creates anything on the NTFS share: a missing
# in-repo directory is never created (skip only), a symlink/junction is never
# touched (skip only), and an existing plain directory's CONTENT is never
# deleted or moved (unlike Windows' DirectoryWithContent handling) -- it is
# only ever bound over, which is a pure VFS overlay and touches no NTFS data.
#
# <ns> (project namespace) matches ProjectTreeCommon.ps1's
# Get-ProjectTreeNamespace byte for byte: the repo root itself is the literal
# "root"; any other project directory is its repo-relative path with "/"
# replaced by "__", lowercased (contract paths.drive_layout.tree_namespace_rule
# documents the general rule; the "root" special case is Windows' own, kept
# here for parity so both sides resolve one project to one directory name).
#
# CLI: ensure | status | release | help, plus --check / --dry-run (preview,
# no mkdir/mount/umount). Sourceable as a library too (every project_tree_*
# function stays side-effect free at load time -- see the USE_SUDO guard
# below -- so a future start-script hook-in, P4, can source this file and
# call project_tree_ensure directly without paying for gvar_common.sh's
# heavy disk detection on every project start).
#
# Not wired into any start script yet (P4, later). Not wired into
# composer/start helpers yet either (G11 rollout note).

# ---- variable declarations ----
PROJECT_TREE_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_TREE_SERVICE_CONTRACT_LIB="$PROJECT_TREE_COMMON_DIR/service_contract_common.sh"
PROJECT_TREE_MARKER_NAME=".cn_link"
PROJECT_TREE_ROOT_NAMESPACE_LABEL="root"
PROJECT_TREE_LOG_PREFIX="[project-tree]"
PROJECT_TREE_REPO_ROOT=""
PROJECT_TREE_TREES_ROOT_LINUX=""
PROJECT_TREE_NAMESPACE_RULE=""
PROJECT_TREE_LINK_DIRS=()
PROJECT_TREE_CONTRACT_READY=false
PROJECT_TREE_DRY_RUN=false

# USE_SUDO: read the one project-wide constant when a caller already sourced
# gvar_common.sh; otherwise a load-time-side-effect-free guarded fallback
# (same idiom as apt_repository_backup.sh / pycore_service.sh) so this
# library stays usable standalone -- tests, or a future start-script hook --
# without pulling in gvar_common's heavy disk detection just to bind a
# directory. Never redeclares USE_SUDO when it is already set.
if [ -z "${USE_SUDO:-}" ]; then
    if [ "$(id -u)" -eq 0 ]; then
        USE_SUDO=""
    else
        USE_SUDO="sudo"
    fi
fi

if ! command -v sc_get >/dev/null 2>&1; then
    [ -f "$PROJECT_TREE_SERVICE_CONTRACT_LIB" ] && source "$PROJECT_TREE_SERVICE_CONTRACT_LIB"
fi

# ---- logging ----
project_tree_log() { echo "$PROJECT_TREE_LOG_PREFIX $*"; }
project_tree_warn() { echo "$PROJECT_TREE_LOG_PREFIX WARNING: $*" >&2; }
project_tree_err() { echo "$PROJECT_TREE_LOG_PREFIX ERROR: $*" >&2; }

# ---- repo root ----
# Same walk-up depth used throughout scripts/shells/linux/common (this file
# sits 4 levels below the repo root: common -> linux -> shells -> scripts).
project_tree_default_repo_root() {
    (cd "$PROJECT_TREE_COMMON_DIR/../../../.." 2>/dev/null && pwd)
}

# Priority: an explicit test/caller override, then the CORE_NODE_ROOT_DIR
# anchor dd.sh and gvar_storage_common.sh already use, then this file's own
# location. PROJECT_TREE_REPO_ROOT_OVERRIDE exists so the scratch ext4 test
# (and any future caller that already knows the repo root) never depends on
# this file's on-disk location.
project_tree_resolve_repo_root() {
    if [ -n "${PROJECT_TREE_REPO_ROOT_OVERRIDE:-}" ]; then
        PROJECT_TREE_REPO_ROOT="$PROJECT_TREE_REPO_ROOT_OVERRIDE"
    elif [ -n "${CORE_NODE_ROOT_DIR:-}" ]; then
        PROJECT_TREE_REPO_ROOT="$CORE_NODE_ROOT_DIR"
    else
        PROJECT_TREE_REPO_ROOT="$(project_tree_default_repo_root)"
    fi
}

# ---- contract (single read point for these three keys) ----
# Refuses to guess: an unreadable contract (no node/php yet, or a moved key)
# disables ensure/status/release for every project dir instead of falling
# back to a literal that would re-declare an existing library value
# (LINUX_SHELL_RULES.md #1). PROJECT_TREE_TREES_ROOT_OVERRIDE lets a test
# point at a scratch ext4 directory without needing node/php at all.
project_tree_load_contract() {
    PROJECT_TREE_CONTRACT_READY=false
    PROJECT_TREE_LINK_DIRS=()

    if [ -n "${PROJECT_TREE_TREES_ROOT_OVERRIDE:-}" ]; then
        PROJECT_TREE_TREES_ROOT_LINUX="$PROJECT_TREE_TREES_ROOT_OVERRIDE"
    elif command -v sc_get >/dev/null 2>&1; then
        PROJECT_TREE_TREES_ROOT_LINUX="$(sc_get paths.drive_layout.trees_root.linux)" || PROJECT_TREE_TREES_ROOT_LINUX=""
    fi

    if command -v sc_get >/dev/null 2>&1; then
        PROJECT_TREE_NAMESPACE_RULE="$(sc_get paths.drive_layout.tree_namespace_rule)" || PROJECT_TREE_NAMESPACE_RULE=""
    fi

    if [ -n "${PROJECT_TREE_LINK_DIRS_OVERRIDE:-}" ]; then
        read -r -a PROJECT_TREE_LINK_DIRS <<<"$PROJECT_TREE_LINK_DIRS_OVERRIDE"
    elif command -v sc_list >/dev/null 2>&1; then
        local raw_dirs=""
        raw_dirs="$(sc_list paths.drive_layout.link_dirs)" || raw_dirs=""
        [ -n "$raw_dirs" ] && read -r -a PROJECT_TREE_LINK_DIRS <<<"$raw_dirs"
    fi

    if [ -z "$PROJECT_TREE_TREES_ROOT_LINUX" ] || [ "${#PROJECT_TREE_LINK_DIRS[@]}" -eq 0 ]; then
        project_tree_warn "service contract unreadable for paths.drive_layout.trees_root.linux / link_dirs (no node/php yet, or the keys moved); refusing to guess -- every project dir is skipped."
        return 1
    fi
    PROJECT_TREE_CONTRACT_READY=true
    return 0
}

# ---- namespace (mirrors ProjectTreeCommon.ps1 Get-ProjectTreeNamespace) ----
project_tree_namespace() {
    local repo_root="$1" project_dir="$2" repo_real="" project_real="" rel=""
    repo_real="$(cd "$repo_root" 2>/dev/null && pwd)" || { project_tree_err "repo root not found: $repo_root"; return 1; }
    project_real="$(cd "$project_dir" 2>/dev/null && pwd)" || { project_tree_err "project directory not found: $project_dir"; return 1; }
    if [ "$project_real" = "$repo_real" ]; then
        printf '%s' "$PROJECT_TREE_ROOT_NAMESPACE_LABEL"
        return 0
    fi
    case "$project_real" in
        "$repo_real"/*) ;;
        *) project_tree_err "project directory is outside the repository: $project_real"; return 1 ;;
    esac
    rel="${project_real#"$repo_real"/}"
    printf '%s' "$rel" | tr '/' '__' | tr '[:upper:]' '[:lower:]'
}

# ---- in-repo entry classification ----
# A translated Windows junction and a native Linux symlink are indistinguishable
# from userspace (ntfs3 6.2+ presents a reparse-point junction as a POSIX
# symlink) -- both are skipped the same way, on purpose (task requirement).
project_tree_entry_kind() {
    local path="$1"
    if [ -L "$path" ]; then
        echo "symlink"
    elif [ -d "$path" ]; then
        echo "directory"
    elif [ -e "$path" ]; then
        echo "other"
    else
        echo "missing"
    fi
}

# Device+inode identity, not a path-string compare: `findmnt -o SOURCE`
# reports a bind mount as "<device>[<subpath-on-that-device>]" (verified live
# in WSL Debian: a bind under a tmpfs /tmp read back as
# "tmpfs[/sl12_trees/root/node_modules]"), which never equals the plain
# absolute path this script binds from -- comparing dev:ino is correct
# regardless of the backing fstype or mount topology and needs no parsing.
project_tree_same_directory() {
    local a="$1" b="$2" id_a="" id_b=""
    command -v stat >/dev/null 2>&1 || return 1
    [ -d "$a" ] && [ -d "$b" ] || return 1
    id_a="$(stat -c '%d:%i' "$a" 2>/dev/null)" || return 1
    id_b="$(stat -c '%d:%i' "$b" 2>/dev/null)" || return 1
    [ -n "$id_a" ] && [ "$id_a" = "$id_b" ]
}

# rc 0 = bound, and CONFIRMED to be exactly ext4_dir (identity verified via
# project_tree_same_directory); rc 1 = not a mountpoint at all; rc 2 = mounted,
# but not confirmed as ext4_dir -- either verified to be a different source,
# or identity cannot be verified at all because ext4_dir does not exist on
# disk yet. The second case matters as much as the first: an existing mount
# is never reported/treated as "ours" (rc 0) on the strength of "nothing
# proved it isn't" -- this must fail closed, exactly like
# project_tree_same_directory and project_tree_release_dir already do,
# instead of failing open the way returning 0 here unconditionally once did.
project_tree_bind_state() {
    local link_path="$1" ext4_dir="$2"
    mountpoint -q "$link_path" 2>/dev/null || return 1
    if [ -z "$ext4_dir" ] || [ ! -d "$ext4_dir" ]; then
        return 2
    fi
    project_tree_same_directory "$link_path" "$ext4_dir" || return 2
    return 0
}

# Best-effort: match the ownership of the reference path (the project
# directory itself, which already belongs to whichever real user runs the
# project) so a freshly root-created ext4 dir does not immediately EACCES the
# next non-root `npm install`/`composer install`. Never fatal.
project_tree_match_ownership() {
    local reference_path="$1" ext4_dir="$2" owner=""
    command -v stat >/dev/null 2>&1 || return 0
    owner="$(stat -c '%u:%g' "$reference_path" 2>/dev/null)" || return 0
    [ -n "$owner" ] || return 0
    $USE_SUDO chown "$owner" "$ext4_dir" 2>/dev/null || true
}

# ---- one link dir: ensure / status / release ----
project_tree_ensure_dir() {
    local project_dir="$1" ns="$2" link_dir="$3"
    local link_path="$project_dir/$link_dir"
    local ext4_dir="$PROJECT_TREE_TREES_ROOT_LINUX/$ns/$link_dir"
    local kind bind_rc marker_path created=false

    kind="$(project_tree_entry_kind "$link_path")"
    case "$kind" in
        missing)
            project_tree_log "skip $link_path: absent (never created on the NTFS share by this script)"
            return 0
            ;;
        symlink)
            project_tree_log "skip $link_path: already a symlink/junction (Windows-owned; waits for the P6 junction proof)"
            return 0
            ;;
        other)
            project_tree_warn "skip $link_path: not a directory"
            return 0
            ;;
    esac

    project_tree_bind_state "$link_path" "$ext4_dir"
    bind_rc=$?
    if [ "$bind_rc" -eq 0 ]; then
        project_tree_log "already bound: $link_path -> $ext4_dir"
        return 0
    fi

    # bind_rc 2: already a mountpoint, but bound to something other than
    # ext4_dir. Mirrors release_dir's own posture exactly (same
    # project_tree_same_directory identity check): a foreign/unrecognized
    # bind is left alone, never force-unmounted and taken over. Matches the
    # task's own "bind only when not already a mountpoint" guard and
    # LINUX_SHELL_RULES.md #3 ("skip whatever is already initialized, never
    # reset").
    if [ "$bind_rc" -eq 2 ]; then
        project_tree_warn "skip $link_path: already a mountpoint bound to something other than $ext4_dir -- leaving it alone"
        return 0
    fi

    if [ "$PROJECT_TREE_DRY_RUN" = true ]; then
        project_tree_log "[dry-run] would create $ext4_dir and bind $link_path -> $ext4_dir"
        return 0
    fi

    if [ ! -d "$ext4_dir" ]; then
        $USE_SUDO mkdir -p "$ext4_dir" || { project_tree_err "could not create ext4 directory $ext4_dir"; return 1; }
        created=true
    fi
    marker_path="$ext4_dir/$PROJECT_TREE_MARKER_NAME"
    [ -f "$marker_path" ] || { printf '%s\n' "$link_path" | $USE_SUDO tee "$marker_path" >/dev/null 2>&1 || true; }
    [ "$created" = true ] && project_tree_match_ownership "$project_dir" "$ext4_dir"

    if $USE_SUDO mount --bind "$ext4_dir" "$link_path"; then
        project_tree_log "bound $link_path -> $ext4_dir"
        return 0
    fi
    project_tree_err "bind failed: $link_path -> $ext4_dir"
    return 1
}

project_tree_status_dir() {
    local project_dir="$1" ns="$2" link_dir="$3"
    local link_path="$project_dir/$link_dir"
    local ext4_dir="$PROJECT_TREE_TREES_ROOT_LINUX/$ns/$link_dir"
    local kind bind_rc state=""

    kind="$(project_tree_entry_kind "$link_path")"
    case "$kind" in
        missing) state="absent" ;;
        symlink) state="symlink/junction (P6 path, left alone)" ;;
        other) state="not a directory" ;;
        directory)
            project_tree_bind_state "$link_path" "$ext4_dir"
            bind_rc=$?
            case "$bind_rc" in
                0) state="bound -> $ext4_dir" ;;
                2) state="bound, but NOT confirmed as $ext4_dir (different source, or $ext4_dir does not exist yet)" ;;
                *) state="plain directory, not bound" ;;
            esac
            ;;
    esac
    printf '%-12s %-60s %s\n' "$link_dir" "$link_path" "$state"
}

project_tree_release_dir() {
    local project_dir="$1" ns="$2" link_dir="$3"
    local link_path="$project_dir/$link_dir"
    local ext4_dir="$PROJECT_TREE_TREES_ROOT_LINUX/$ns/$link_dir"
    local kind=""

    kind="$(project_tree_entry_kind "$link_path")"
    if [ "$kind" != "directory" ]; then
        project_tree_log "skip $link_path: not a plain directory ($kind)"
        return 0
    fi
    if ! mountpoint -q "$link_path" 2>/dev/null; then
        project_tree_log "not mounted: $link_path"
        return 0
    fi
    # Ownership check: only ever unmount when the CURRENT bind is exactly the
    # ext4 directory this project+link_dir would also resolve to on ensure
    # (dev:ino identity, see project_tree_same_directory) -- a foreign bind,
    # or one pointing at a different/stale target, is left alone untouched.
    if ! project_tree_same_directory "$link_path" "$ext4_dir"; then
        project_tree_warn "skip $link_path: bound to something other than $ext4_dir -- leaving it alone"
        return 0
    fi
    if [ "$PROJECT_TREE_DRY_RUN" = true ]; then
        project_tree_log "[dry-run] would unmount $link_path"
        return 0
    fi
    if $USE_SUDO umount "$link_path"; then
        project_tree_log "unmounted $link_path (ext4 directory kept at $ext4_dir for an idempotent re-ensure)"
        return 0
    fi
    project_tree_err "could not unmount $link_path"
    return 1
}

# ---- one project dir, every link dir ----
project_tree_for_each_dir() {
    local handler="$1" project_dir="$2" ns="" link_dir="" rc=0
    project_tree_load_contract || return 1
    ns="$(project_tree_namespace "$PROJECT_TREE_REPO_ROOT" "$project_dir")" || return 1
    for link_dir in "${PROJECT_TREE_LINK_DIRS[@]}"; do
        "$handler" "$project_dir" "$ns" "$link_dir" || rc=1
    done
    return $rc
}

project_tree_ensure() {
    local project_dir="$1"
    project_tree_resolve_repo_root
    [ -n "$project_dir" ] || project_dir="$PROJECT_TREE_REPO_ROOT"
    project_tree_for_each_dir project_tree_ensure_dir "$project_dir"
}

project_tree_status() {
    local project_dir="$1"
    project_tree_resolve_repo_root
    [ -n "$project_dir" ] || project_dir="$PROJECT_TREE_REPO_ROOT"
    project_tree_for_each_dir project_tree_status_dir "$project_dir"
}

project_tree_release() {
    local project_dir="$1"
    project_tree_resolve_repo_root
    [ -n "$project_dir" ] || project_dir="$PROJECT_TREE_REPO_ROOT"
    project_tree_for_each_dir project_tree_release_dir "$project_dir"
}

# ---- CLI ----
project_tree_usage() {
    cat <<EOF
Usage: $(basename "${BASH_SOURCE[0]}") <ensure|status|release|help> [project_dir] [--check|--dry-run]

Per-project ext4 bind for node_modules/vendor/.venv (contract
paths.drive_layout: trees_root.linux, link_dirs, tree_namespace_rule).
Windows counterpart: scripts/shells/win/win_common/ProjectTreeCommon.ps1.

  ensure [dir]   Bind each link dir under [dir] (default: the repo root) onto
                 its ext4 directory (<trees_root.linux>/<ns>/<dir>). Skips a
                 dir that is missing, a symlink/junction, or not a directory.
                 Creates the ext4 directory idempotently; binds only when not
                 already a mountpoint (mountpoint -q guard). A dir already
                 mounted from something other than its ext4 directory is left
                 alone (skip + warn), never force-unmounted or taken over.
                 Uses sudo when the caller is not root.
  status [dir]   Report the current state of every link dir. Read-only.
  release [dir]  Unmount a bind, but only when it is currently bound to
                 exactly the ext4 directory ensure would also target for that
                 project+dir; a foreign or stale bind is left alone. Never
                 touches the in-repo directory or anything on the NTFS share.
  help           Show this message.

Flags:
  --check, --dry-run   Report what ensure/release would do; no mkdir, mount
                        or umount.

Env overrides (testing, or a caller that already knows the paths):
  PROJECT_TREE_REPO_ROOT_OVERRIDE   Repo root, instead of CORE_NODE_ROOT_DIR
                                     or this file's own on-disk location.
  PROJECT_TREE_TREES_ROOT_OVERRIDE  trees_root.linux, instead of the contract.
  PROJECT_TREE_LINK_DIRS_OVERRIDE   Space-separated link dirs, instead of the
                                     contract's link_dirs.
EOF
}

project_tree_main() {
    local action="${1:-help}" project_dir="" arg
    shift || true
    for arg in "$@"; do
        case "$arg" in
            --check|--dry-run) PROJECT_TREE_DRY_RUN=true ;;
            *) [ -n "$project_dir" ] || project_dir="$arg" ;;
        esac
    done
    case "$action" in
        ensure) project_tree_ensure "$project_dir" ;;
        status) project_tree_status "$project_dir" ;;
        release) project_tree_release "$project_dir" ;;
        help|-h|--help) project_tree_usage ;;
        *) project_tree_usage; return 1 ;;
    esac
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    project_tree_main "$@"
fi
