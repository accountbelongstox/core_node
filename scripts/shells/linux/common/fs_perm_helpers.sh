#!/bin/bash
# Idempotent recursive chown/chmod that do NOT pin the userspace ntfs-3g FUSE
# driver. ntfs-3g is single-threaded per mount and runs in userspace, so a
# recursive chown/chmod on an NTFS/FUSE mount walks the whole tree through one
# process and pins a CPU core - while the operation is a no-op in effect because
# ownership/permissions on those mounts are fixed by mount options (uid=/gid=
# /umask=/dmask=/fmask=). The same holds for ntfs3 (kernel driver): perms are
# mount-fixed too, so recursive chown/chmod are wasted walks there as well.
#
# Behavior:
#   - Legacy safe_chown_R/safe_chmod_R skip mount-fixed filesystems.
#   - The owner/mode-777 policy helpers inspect the full tree and enforce the
#     requested state, including Code Sync preparation.
#
# Sourced transitively via common_functions.sh -> available to every installer.

# fstype values whose permissions are fixed by mount options, so recursive
# chown/chmod are no-ops-in-effect and full-tree-walks-in-cost -> skipped.
FS_PERM_MOUNT_FIXED_FSTYPES="fuse fuseblk ntfs ntfs3 exfat vfat drvfs"
# Never opened to mode 777 by a tree walk: secret stores (incl. acme.sh TLS
# keys and DNS API credentials) become owner-only,
# git metadata keeps its own modes and only loses group/other write.
FS_PERM_PRIVATE_TREE_NAMES=(".secret_keys" ".secrets" ".acme.sh")
FS_PERM_GIT_TREE_NAME=".git"
# Application secret stores whose owner is the reading runtime (Laravel's
# .core_node_secrets, read by the PHP user): the owner is kept, files become
# 0600 and directories lose group/other write.
FS_PERM_APP_SECRET_TREE_NAMES=(".core_node_secrets")
# Decrypted secret directories inside a private tree (files there are 0600).
FS_PERM_PRIVATE_RAW_DIR_NAMES=(".secret_ignore" "raw")
# Regular login accounts start at UID_MIN (login.defs); uid 1..UID_MIN-1 and
# nobody are service accounts. A tree walk never takes over service-owned
# data (e.g. a PostgreSQL cluster requires owner-only postgres modes and
# refuses to start once opened to 777).
FS_PERM_REGULAR_UID_MIN=1000
FS_PERM_NOBODY_UID=65534
ACTIVE_PERMISSION_USER=""
ACTIVE_PERMISSION_GROUP=""
ACTIVE_PERMISSION_SOURCE=""

# permission_user_is_excluded <user> -> 0 for known service-only accounts.
permission_user_is_excluded() {
    local candidate="$1"

    case "$candidate" in
        root|bin|sys|sync|games|man|lp|mail|news|uucp|proxy|backup|list|irc|_apt|git|gitea|mysql|postgres|redis|nginx|www-data|node|nobody|daemon|messagebus|sshd|polkitd|systemd-network|systemd-timesync)
            return 0
            ;;
    esac
    return 1
}

# active_permission_user_is_regular <user> -> 0 only for an interactive user.
active_permission_user_is_regular() {
    local candidate="$1"
    local candidate_uid=""
    local candidate_entry=""
    local candidate_shell=""

    [ -n "$candidate" ] || return 1
    candidate_uid="$(id -u "$candidate" 2>/dev/null || true)"
    [ -n "$candidate_uid" ] || return 1
    [ "$candidate_uid" -ge "$FS_PERM_REGULAR_UID_MIN" ] 2>/dev/null || return 1
    [ "$candidate_uid" -lt "$FS_PERM_NOBODY_UID" ] 2>/dev/null || return 1
    permission_user_is_excluded "$candidate" && return 1
    if command -v getent >/dev/null 2>&1; then
        candidate_entry="$(getent passwd "$candidate" 2>/dev/null || true)"
        candidate_shell="${candidate_entry##*:}"
        case "$candidate_shell" in
            */nologin|*/false) return 1 ;;
        esac
    fi
    return 0
}

# list_real_users_and_root -> one user per line: root, then every real login
# user (active_permission_user_is_regular). The single enumerator for
# per-user state; service accounts (git, postgres, ...) are never listed.
list_real_users_and_root() {
    local user_name=""

    echo "root"
    while IFS=: read -r user_name _; do
        [ -n "$user_name" ] || continue
        active_permission_user_is_regular "$user_name" && echo "$user_name"
    done < <(getent passwd 2>/dev/null)
    return 0
}

# resolve_active_permission_owner -> sets ACTIVE_PERMISSION_* and prints user.
# Explicit owner (CORE_NODE_DATA_OWNER, exported by pyservice_entry.sh and the
# pycore unit; Python twin: pycore/pyfoundations/data_owner.py), callers and
# active sessions take priority. A root-only process scores
# valid /home users by interactive folders. Existing path owners are never used.
resolve_active_permission_owner() {
    local candidate=""
    local candidate_home=""
    local home_entry=""
    local marker=""
    local candidate_score=0
    local best_score=-1

    ACTIVE_PERMISSION_USER=""
    ACTIVE_PERMISSION_GROUP=""
    ACTIVE_PERMISSION_SOURCE=""

    candidate="${CORE_NODE_DATA_OWNER:-}"
    if active_permission_user_is_regular "$candidate"; then
        ACTIVE_PERMISSION_USER="$candidate"
        ACTIVE_PERMISSION_SOURCE="explicit owner"
    elif [ "$candidate" = "root" ]; then
        # Explicit root owner (hosted notebook VMs): no delegation to a login user.
        ACTIVE_PERMISSION_USER="root"
        ACTIVE_PERMISSION_GROUP="root"
        ACTIVE_PERMISSION_SOURCE="explicit root owner"
        echo "$ACTIVE_PERMISSION_USER"
        return 0
    fi

    candidate="${SUDO_USER:-}"
    if [ -z "$ACTIVE_PERMISSION_USER" ] && active_permission_user_is_regular "$candidate"; then
        ACTIVE_PERMISSION_USER="$candidate"
        ACTIVE_PERMISSION_SOURCE="sudo caller"
    fi

    if [ -z "$ACTIVE_PERMISSION_USER" ]; then
        candidate="$(id -un 2>/dev/null || true)"
        if active_permission_user_is_regular "$candidate"; then
            ACTIVE_PERMISSION_USER="$candidate"
            ACTIVE_PERMISSION_SOURCE="current caller"
        fi
    fi

    if [ -z "$ACTIVE_PERMISSION_USER" ] && command -v who >/dev/null 2>&1; then
        candidate="$(who 2>/dev/null | awk 'NF { print $1; exit }')"
        if active_permission_user_is_regular "$candidate"; then
            ACTIVE_PERMISSION_USER="$candidate"
            ACTIVE_PERMISSION_SOURCE="active login"
        fi
    fi

    if [ -z "$ACTIVE_PERMISSION_USER" ] && command -v loginctl >/dev/null 2>&1; then
        while read -r candidate; do
            [ -n "$candidate" ] || continue
            if active_permission_user_is_regular "$candidate"; then
                ACTIVE_PERMISSION_USER="$candidate"
                ACTIVE_PERMISSION_SOURCE="active systemd login"
                break
            fi
        done < <(loginctl list-sessions --no-legend 2>/dev/null | awk 'NF >= 3 { print $3 }')
    fi

    if [ -z "$ACTIVE_PERMISSION_USER" ]; then
        for candidate_home in /home/*; do
            [ -d "$candidate_home" ] || continue
            candidate="${candidate_home##*/}"
            active_permission_user_is_regular "$candidate" || continue
            home_entry="$(getent passwd "$candidate" 2>/dev/null | cut -d: -f6)"
            [ "$home_entry" = "$candidate_home" ] || continue
            candidate_score=0
            for marker in Downloads Documents Desktop; do
                [ -d "$candidate_home/$marker" ] && candidate_score=$((candidate_score + 1))
            done
            if [ "$candidate_score" -gt "$best_score" ]; then
                ACTIVE_PERMISSION_USER="$candidate"
                best_score="$candidate_score"
            fi
        done
        if [ -n "$ACTIVE_PERMISSION_USER" ]; then
            ACTIVE_PERMISSION_SOURCE="home directory score $best_score"
        fi
    fi

    if [ -z "$ACTIVE_PERMISSION_USER" ]; then
        ACTIVE_PERMISSION_USER="root"
        ACTIVE_PERMISSION_SOURCE="root fallback"
    fi

    ACTIVE_PERMISSION_GROUP="$(id -gn "$ACTIVE_PERMISSION_USER" 2>/dev/null || echo "$ACTIVE_PERMISSION_USER")"
    echo "$ACTIVE_PERMISSION_USER"
}

# fs_perm_target_safety <path> -> "safe" or the reason it is refused. The path
# and its fully resolved form (symlinks, "//", "/.", "..") are both checked:
# chown/chmod follow a symlink, so a link to "/" must never pass as a target.
fs_perm_target_safety() {
    local target_path="$1"
    local resolved_path=""
    local candidate=""

    if [ -z "$target_path" ] || [[ "$target_path" != /* ]]; then
        echo "not absolute"
        return
    fi
    resolved_path="$(readlink -f -- "$target_path" 2>/dev/null || true)"
    for candidate in "$target_path" "$resolved_path"; do
        [ -n "$candidate" ] || continue
        case "$candidate" in
            /usr/local|/usr/local/*|/var/_core_node|/var/_core_node/*) ;;
            /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/lib64|/lib64/*|/var|/var/lib|/var/log|/boot|/boot/*|/root|/home|/opt|/srv|/mnt|/media|/tmp|/run|/run/*|/proc|/proc/*|/sys|/sys/*|/dev|/dev/*)
                echo "system path $candidate"
                return
                ;;
        esac
    done
    echo "safe"
}

# repair_private_tree <absolute-path> [user] [group]
# Owner-only secret store: directories 0700, decrypted files 0600, other files
# (git-tracked encrypted copies) lose every group/other bit but keep the owner
# bits git tracks.
repair_private_tree() {
    local target_path="$1"
    local target_user="${2:-}"
    local target_group="${3:-}"
    local privilege_prefix=""
    local list_dir=""
    local raw_name=""
    local repair_status=0
    local privilege_command=()
    local owner_mismatch=()
    local raw_match=()
    local raw_exclude=()

    [[ "$target_path" == /* ]] || return 1
    [ -e "$target_path" ] || return 0
    fs_perm_is_fuse_mount "$target_path" && return 0
    if [ -z "$target_user" ]; then
        resolve_active_permission_owner >/dev/null
        target_user="$ACTIVE_PERMISSION_USER"
        target_group="$ACTIVE_PERMISSION_GROUP"
    elif [ -z "$target_group" ]; then
        target_group="$(id -gn "$target_user" 2>/dev/null || echo "$target_user")"
    fi
    privilege_prefix="$(fs_perm_sudo_prefix)"
    if [ "$(id -u)" -ne 0 ]; then
        [ -n "$privilege_prefix" ] || return 1
        privilege_command=("$privilege_prefix")
    fi
    owner_mismatch=(! -user "$target_user" -o ! -group "$target_group")
    for raw_name in "${FS_PERM_PRIVATE_RAW_DIR_NAMES[@]}"; do
        [ "${#raw_match[@]}" -gt 0 ] && raw_match+=(-o)
        raw_match+=(-path "*/$raw_name/*")
        raw_exclude+=(! -path "*/$raw_name/*")
    done

    list_dir="$(mktemp -d)" || return 1
    "${privilege_command[@]}" find "$target_path" \
        \( -type d \( "${owner_mismatch[@]}" -o ! -perm 0700 \) -fprint0 "$list_dir/dirs" \) \
        -o \( -type f \( "${raw_match[@]}" \) \( "${owner_mismatch[@]}" -o ! -perm 0600 \) -fprint0 "$list_dir/raw" \) \
        -o \( -type f "${raw_exclude[@]}" \( "${owner_mismatch[@]}" -o -perm /077 \) -fprint0 "$list_dir/files" \) \
        2>/dev/null || repair_status=$?
    cat "$list_dir/dirs" "$list_dir/raw" "$list_dir/files" 2>/dev/null \
        | "${privilege_command[@]}" xargs -0 -r chown "$target_user:$target_group" -- || repair_status=$?
    "${privilege_command[@]}" xargs -0 -r chmod 700 -- < "$list_dir/dirs" 2>/dev/null || repair_status=$?
    "${privilege_command[@]}" xargs -0 -r chmod 600 -- < "$list_dir/raw" 2>/dev/null || repair_status=$?
    "${privilege_command[@]}" xargs -0 -r chmod go-rwx -- < "$list_dir/files" 2>/dev/null || repair_status=$?
    rm -rf "$list_dir"
    return "$repair_status"
}

# repair_app_secret_tree <absolute-path>
# Owner kept (the runtime that reads it); files 0600, directories without
# group/other write.
repair_app_secret_tree() {
    local target_path="$1"
    local privilege_prefix=""
    local list_dir=""
    local repair_status=0
    local privilege_command=()

    [[ "$target_path" == /* ]] || return 1
    [ -e "$target_path" ] || return 0
    fs_perm_is_fuse_mount "$target_path" && return 0
    privilege_prefix="$(fs_perm_sudo_prefix)"
    if [ "$(id -u)" -ne 0 ]; then
        [ -n "$privilege_prefix" ] || return 1
        privilege_command=("$privilege_prefix")
    fi
    list_dir="$(mktemp -d)" || return 1
    "${privilege_command[@]}" find "$target_path" \
        \( -type d -perm /022 -fprint0 "$list_dir/dirs" \) \
        -o \( -type f ! -perm 0600 -fprint0 "$list_dir/files" \) \
        2>/dev/null || repair_status=$?
    "${privilege_command[@]}" xargs -0 -r chmod go-w -- < "$list_dir/dirs" 2>/dev/null || repair_status=$?
    "${privilege_command[@]}" xargs -0 -r chmod 600 -- < "$list_dir/files" 2>/dev/null || repair_status=$?
    rm -rf "$list_dir"
    return "$repair_status"
}

# repair_owned_tree_owner_only <absolute-path> [user] [group]
# Hands entries a root process created back to the permission user; every mode
# bit stays as its owner set it (sticky shared dirs, private 750/640 stores).
# Symlinks are re-owned themselves (chown -h).
repair_owned_tree_owner_only() {
    local target_path="$1"
    local target_user="${2:-}"
    local target_group="${3:-}"
    local privilege_prefix=""
    local mismatch_list=""
    local repair_status=0
    local privilege_command=()

    [[ "$target_path" == /* ]] || return 1
    [ -e "$target_path" ] || return 0
    fs_perm_is_fuse_mount "$target_path" && return 0
    if [ -z "$target_user" ]; then
        resolve_active_permission_owner >/dev/null
        target_user="$ACTIVE_PERMISSION_USER"
        target_group="$ACTIVE_PERMISSION_GROUP"
    elif [ -z "$target_group" ]; then
        target_group="$(id -gn "$target_user" 2>/dev/null || echo "$target_user")"
    fi
    privilege_prefix="$(fs_perm_sudo_prefix)"
    if [ "$(id -u)" -ne 0 ]; then
        [ -n "$privilege_prefix" ] || return 1
        privilege_command=("$privilege_prefix")
    fi
    mismatch_list="$(mktemp)" || return 1
    "${privilege_command[@]}" find "$target_path" -xdev \( ! -user "$target_user" -o ! -group "$target_group" \) \
        -print0 > "$mismatch_list" 2>/dev/null || repair_status=$?
    "${privilege_command[@]}" xargs -0 -r chown -h "$target_user:$target_group" -- < "$mismatch_list" || repair_status=$?
    rm -f "$mismatch_list"
    return "$repair_status"
}

# repair_owned_tree_no_shared_write <absolute-path> [user] [group]
# Git metadata: owned by the permission user, group/other write removed, every
# other mode bit left as git wrote it.
repair_owned_tree_no_shared_write() {
    local target_path="$1"
    local target_user="${2:-}"
    local target_group="${3:-}"
    local privilege_prefix=""
    local mismatch_list=""
    local repair_status=0
    local privilege_command=()

    [[ "$target_path" == /* ]] || return 1
    [ -e "$target_path" ] || return 0
    fs_perm_is_fuse_mount "$target_path" && return 0
    if [ -z "$target_user" ]; then
        resolve_active_permission_owner >/dev/null
        target_user="$ACTIVE_PERMISSION_USER"
        target_group="$ACTIVE_PERMISSION_GROUP"
    elif [ -z "$target_group" ]; then
        target_group="$(id -gn "$target_user" 2>/dev/null || echo "$target_user")"
    fi
    privilege_prefix="$(fs_perm_sudo_prefix)"
    if [ "$(id -u)" -ne 0 ]; then
        [ -n "$privilege_prefix" ] || return 1
        privilege_command=("$privilege_prefix")
    fi
    mismatch_list="$(mktemp)" || return 1
    "${privilege_command[@]}" find "$target_path" \( -type d -o -type f \) \
        \( ! -user "$target_user" -o ! -group "$target_group" -o -perm /022 \) \
        -print0 > "$mismatch_list" 2>/dev/null || repair_status=$?
    "${privilege_command[@]}" xargs -0 -r chown "$target_user:$target_group" -- < "$mismatch_list" || repair_status=$?
    "${privilege_command[@]}" xargs -0 -r chmod go-w -- < "$mismatch_list" || repair_status=$?
    rm -f "$mismatch_list"
    return "$repair_status"
}

# repair_owned_tree_777 <absolute-path> [user] [group]
# Makes the complete tree writable by the active regular user. Root performs
# the privileged operation but does not become owner unless no active regular
# user exists. One full-tree walk collects the mismatched entries; only those
# entries are repaired, so a correct tree costs one walk and a partly wrong
# tree never pays a second recursive chown/chmod walk. Secret stores and git
# metadata are pruned from the walk and repaired by their own policy.
repair_owned_tree_777() {
    local target_path="$1"
    local target_user="${2:-}"
    local target_group="${3:-}"
    local mismatch_list=""
    local protected_list=""
    local protected_path=""
    local tree_name=""
    local mismatch_count=0
    local privilege_prefix=""
    local scan_status=0
    local repair_status=0
    local privilege_command=()
    local prune_names=()
    local service_owned=()
    local target_safety=""

    target_safety="$(fs_perm_target_safety "$target_path")"
    if [ "$target_safety" != "safe" ]; then
        echo "[permissions] Refusing unsafe recursive target ($target_safety): $target_path" >&2
        return 1
    fi
    [ -e "$target_path" ] || return 0

    if [ -z "$target_user" ]; then
        resolve_active_permission_owner >/dev/null
        target_user="$ACTIVE_PERMISSION_USER"
        target_group="$ACTIVE_PERMISSION_GROUP"
    elif [ -z "$target_group" ]; then
        target_group="$(id -gn "$target_user" 2>/dev/null || echo "$target_user")"
    fi

    privilege_prefix="$(fs_perm_sudo_prefix)"
    if [ "$(id -u)" -ne 0 ]; then
        if [ -z "$privilege_prefix" ]; then
            echo "[permissions] Root privileges are required for: $target_path" >&2
            return 1
        fi
        privilege_command=("$privilege_prefix")
    fi

    for tree_name in "${FS_PERM_PRIVATE_TREE_NAMES[@]}" "${FS_PERM_APP_SECRET_TREE_NAMES[@]}" "$FS_PERM_GIT_TREE_NAME"; do
        [ "${#prune_names[@]}" -gt 0 ] && prune_names+=(-o)
        prune_names+=(-name "$tree_name")
    done

    service_owned=(\( ! -uid 0 \( -uid "-$FS_PERM_REGULAR_UID_MIN" -o -uid "$FS_PERM_NOBODY_UID" \) \))

    mismatch_list="$(mktemp)" || return 1
    protected_list="$(mktemp)" || { rm -f "$mismatch_list"; return 1; }
    "${privilege_command[@]}" find "$target_path" \
        \( "${prune_names[@]}" \) -prune -fprint0 "$protected_list" \
        -o \( -type d "${service_owned[@]}" \) -prune \
        -o \( -type d -o -type f \) ! "${service_owned[@]}" \
        \( ! -user "$target_user" -o ! -group "$target_group" -o ! -perm 0777 \) \
        -print0 > "$mismatch_list" 2>/dev/null || scan_status=$?
    while IFS= read -r -d '' protected_path; do
        if [ "${protected_path##*/}" = "$FS_PERM_GIT_TREE_NAME" ]; then
            repair_owned_tree_no_shared_write "$protected_path" "$target_user" "$target_group" || repair_status=$?
        elif [[ " ${FS_PERM_APP_SECRET_TREE_NAMES[*]} " == *" ${protected_path##*/} "* ]]; then
            repair_app_secret_tree "$protected_path" || repair_status=$?
        else
            repair_private_tree "$protected_path" "$target_user" "$target_group" || repair_status=$?
        fi
    done < "$protected_list"
    rm -f "$protected_list"
    mismatch_count="$(tr -cd '\0' < "$mismatch_list" | wc -c)"
    if [ "$scan_status" -ne 0 ] && [ "$mismatch_count" -eq 0 ]; then
        rm -f "$mismatch_list"
        echo "[permissions] Unable to inspect: $target_path" >&2
        return "$scan_status"
    fi
    if [ "$mismatch_count" -eq 0 ]; then
        rm -f "$mismatch_list"
        echo "[permissions] Ready: $target_path -> $target_user:$target_group mode 777"
        return "$repair_status"
    fi

    echo "[permissions] Repairing $mismatch_count entries: $target_path -> $target_user:$target_group mode 777"
    "${privilege_command[@]}" xargs -0 -r chown "$target_user:$target_group" -- < "$mismatch_list" || repair_status=$?
    "${privilege_command[@]}" xargs -0 -r chmod 777 -- < "$mismatch_list" || repair_status=$?
    rm -f "$mismatch_list"
    if [ "$scan_status" -ne 0 ]; then
        echo "[permissions] Partially inspected: $target_path" >&2
        return "$scan_status"
    fi
    return "$repair_status"
}

# ensure_owned_tree_777 <absolute-path> [user] [group]
# Creates a missing managed directory, then applies the shared ownership policy.
ensure_owned_tree_777() {
    local target_path="$1"
    local target_user="${2:-}"
    local target_group="${3:-}"
    local privilege_prefix=""
    local privilege_command=()
    local target_safety=""

    target_safety="$(fs_perm_target_safety "$target_path")"
    if [ "$target_safety" != "safe" ]; then
        echo "[permissions] Refusing unsafe managed target ($target_safety): $target_path" >&2
        return 1
    fi
    privilege_prefix="$(fs_perm_sudo_prefix)"
    if [ "$(id -u)" -ne 0 ]; then
        [ -n "$privilege_prefix" ] || return 1
        privilege_command=("$privilege_prefix")
    fi
    if [ ! -d "$target_path" ]; then
        echo "[permissions] Creating managed directory: $target_path"
        "${privilege_command[@]}" mkdir -p "$target_path" || return $?
    fi
    repair_owned_tree_777 "$target_path" "$target_user" "$target_group"
}

# repair_owned_entry_777 <absolute-path> [user] [group]
# Applies the policy only to one existing entry, without walking its children.
owned_entry_777_ready() {
    local target_path="$1"
    local target_user="$2"
    local target_group="$3"
    local current_owner=""
    local current_mode=""

    if [ ! -e "$target_path" ]; then
        echo "no"
        return
    fi
    current_owner="$(stat -c '%U:%G' "$target_path" 2>/dev/null)"
    current_mode="$(stat -c '%a' "$target_path" 2>/dev/null)"
    if [ "$current_owner" = "$target_user:$target_group" ] && [ "$current_mode" = "777" ]; then
        echo "yes"
    else
        echo "no"
    fi
}

repair_owned_entry_777() {
    local target_path="$1"
    local target_user="${2:-}"
    local target_group="${3:-}"
    local privilege_prefix=""
    local privilege_command=()

    [ "$(fs_perm_target_safety "$target_path")" = "safe" ] || return 1
    [ -e "$target_path" ] || return 0
    if [ -z "$target_user" ]; then
        resolve_active_permission_owner >/dev/null
        target_user="$ACTIVE_PERMISSION_USER"
        target_group="$ACTIVE_PERMISSION_GROUP"
    elif [ -z "$target_group" ]; then
        target_group="$(id -gn "$target_user" 2>/dev/null || echo "$target_user")"
    fi
    privilege_prefix="$(fs_perm_sudo_prefix)"
    if [ "$(id -u)" -ne 0 ]; then
        [ -n "$privilege_prefix" ] || return 1
        privilege_command=("$privilege_prefix")
    fi
    if [ "$(owned_entry_777_ready "$target_path" "$target_user" "$target_group")" = "yes" ]; then
        return
    fi
    "${privilege_command[@]}" chown "$target_user:$target_group" "$target_path" 2>/dev/null || true
    "${privilege_command[@]}" chmod 777 "$target_path" 2>/dev/null || true
}

# fs_perm_is_fuse_mount <path> -> 0 if path sits on a mount-fixed-permission fs.
fs_perm_is_fuse_mount() {
    local path="$1"
    local fstype=""
    [ -n "$path" ] || return 1
    fstype="$(findmnt -no FSTYPE "$path" 2>/dev/null | head -n1)"
    [ -z "$fstype" ] && return 1
    case " $FS_PERM_MOUNT_FIXED_FSTYPES " in
        *" $fstype "*) return 0 ;;
        *) return 1 ;;
    esac
}

# fs_perm_can_escalate -> 0 when a privileged retry may run: already root, or an
# interactive terminal with sudo. A service process (systemd INVOCATION_ID or no
# TTY) never calls sudo, so it never fills the auth log with password failures.
fs_perm_can_escalate() {
    [ "${EUID:-$(id -u 2>/dev/null)}" -eq 0 ] 2>/dev/null && return 0
    [ -t 0 ] && [ -z "${INVOCATION_ID:-}" ] && command -v sudo >/dev/null 2>&1
}

# fs_perm_run_privileged <command...> -> runs the command; when it fails and a
# privileged retry is allowed (fs_perm_can_escalate, non-root), retries via sudo -n.
fs_perm_run_privileged() {
    "$@" 2>/dev/null && return 0
    [ "${EUID:-$(id -u 2>/dev/null)}" -ne 0 ] 2>/dev/null || return 1
    fs_perm_can_escalate && sudo -n "$@" 2>/dev/null
}

# ensure_shared_dir <mode> <dir...> -> idempotent shared directory: created when
# missing, chmod only when the current mode differs (e.g. 1777 sticky shared
# caches). A directory that is already correct costs one stat and no write.
ensure_shared_dir() {
    local mode="$1"
    local dir=""
    shift
    for dir in "$@"; do
        [ -n "$dir" ] || continue
        [ -d "$dir" ] || fs_perm_run_privileged mkdir -p "$dir" || continue
        [ "$(stat -c %a "$dir" 2>/dev/null)" = "$mode" ] || fs_perm_run_privileged chmod "$mode" "$dir" || true
    done
}

# fs_perm_sudo_prefix -> echo privilege prefix ("sudo" or "") to use for the op.
# Honors a caller-set USE_SUDO; otherwise auto-detects (sudo only when non-root).
fs_perm_sudo_prefix() {
    if [ -n "${USE_SUDO:-}" ]; then
        printf '%s' "$USE_SUDO"
    elif [ "${EUID:-$(id -u 2>/dev/null)}" -ne 0 ] 2>/dev/null && command -v sudo >/dev/null 2>&1; then
        printf 'sudo'
    fi
}

# safe_chown_R <owner[:group]> <path>
# Idempotent recursive chown over the WHOLE tree: one find walk collects the
# entries whose owner (or group, when given) differs, only those change, so a
# root-created file inside an already user-owned directory is handed back too.
# Skips on mount-fixed-permission fs.
safe_chown_R() {
    local owner="$1"
    local path="$2"
    local user="${owner%%:*}"
    local group=""
    local prefix=""
    local -a mismatch=()
    [ -e "$path" ] || return 0
    if fs_perm_is_fuse_mount "$path"; then
        return 0
    fi
    [[ "$owner" == *:* ]] && group="${owner#*:}"
    mismatch=(! -user "$user")
    [ -n "$group" ] && mismatch=(\( ! -user "$user" -o ! -group "$group" \))
    prefix="$(fs_perm_sudo_prefix)"
    ${prefix:+$prefix }find "$path" -xdev "${mismatch[@]}" -print0 2>/dev/null \
        | ${prefix:+$prefix }xargs -0 -r chown -h "$owner" -- 2>/dev/null || true
}

# safe_chmod_R <mode> <path>
# Idempotent recursive chmod. Skips on mount-fixed-permission fs and when the
# root entry already has the requested mode.
safe_chmod_R() {
    local mode="$1"
    local path="$2"
    local cur=""
    local prefix=""
    [ -e "$path" ] || return 0
    if fs_perm_is_fuse_mount "$path"; then
        return 0
    fi
    cur="$(stat -c '%a' "$path" 2>/dev/null)"
    [ -n "$cur" ] && [ "$cur" = "$mode" ] && return 0
    prefix="$(fs_perm_sudo_prefix)"
    ${prefix:+$prefix }chmod -R "$mode" "$path" 2>/dev/null || true
}
