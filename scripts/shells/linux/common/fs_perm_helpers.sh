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
    [ "$candidate_uid" -ge 1000 ] 2>/dev/null || return 1
    [ "$candidate_uid" -lt 65534 ] 2>/dev/null || return 1
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

# resolve_active_permission_owner -> sets ACTIVE_PERMISSION_* and prints user.
# Explicit callers and active sessions take priority. A root-only process scores
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

    candidate="${SUDO_USER:-}"
    if active_permission_user_is_regular "$candidate"; then
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

# repair_owned_tree_777 <absolute-path> [user] [group]
# Makes the complete tree writable by the active regular user. Root performs
# the privileged operation but does not become owner unless no active regular
# user exists. Existing correct trees are skipped after a bounded first-match
# scan so repeated calls remain idempotent.
repair_owned_tree_777() {
    local target_path="$1"
    local target_user="${2:-}"
    local target_group="${3:-}"
    local mismatch=""
    local privilege_prefix=""
    local scan_status=0
    local privilege_command=()

    case "$target_path" in
        /usr/local|/usr/local/*) ;;
        ""|/|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var)
            echo "[permissions] Refusing unsafe recursive target: $target_path" >&2
            return 1
            ;;
    esac
    if [[ "$target_path" != /* ]]; then
        echo "[permissions] Target path is not absolute: $target_path" >&2
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

    mismatch="$("${privilege_command[@]}" find "$target_path" \
        \( \( -type d -o -type f \) \( ! -user "$target_user" -o ! -group "$target_group" -o ! -perm 0777 \) \) \
        -print -quit 2>/dev/null)" || scan_status=$?
    if [ "$scan_status" -ne 0 ]; then
        echo "[permissions] Unable to inspect: $target_path" >&2
        return "$scan_status"
    fi
    if [ -z "$mismatch" ]; then
        echo "[permissions] Ready: $target_path -> $target_user:$target_group mode 777"
        return 0
    fi

    echo "[permissions] Repairing: $target_path -> $target_user:$target_group mode 777"
    "${privilege_command[@]}" chown -R "$target_user:$target_group" "$target_path" || return $?
    "${privilege_command[@]}" chmod -R 777 "$target_path" || return $?
    return 0
}

# ensure_owned_tree_777 <absolute-path> [user] [group]
# Creates a missing managed directory, then applies the shared ownership policy.
ensure_owned_tree_777() {
    local target_path="$1"
    local target_user="${2:-}"
    local target_group="${3:-}"
    local privilege_prefix=""
    local privilege_command=()

    case "$target_path" in
        /usr/local|/usr/local/*) ;;
        ""|/|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var)
            echo "[permissions] Refusing unsafe managed target: $target_path" >&2
            return 1
            ;;
    esac
    [[ "$target_path" == /* ]] || return 1
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

    case "$target_path" in
        /usr/local|/usr/local/*) ;;
        ""|/|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var)
            return 1
            ;;
    esac
    [[ "$target_path" == /* ]] || return 1
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
# Idempotent recursive chown. Skips on mount-fixed-permission fs and when the
# root entry already has the requested owner.
safe_chown_R() {
    local owner="$1"
    local path="$2"
    local cur=""
    local prefix=""
    [ -e "$path" ] || return 0
    if fs_perm_is_fuse_mount "$path"; then
        return 0
    fi
    cur="$(stat -c '%U:%G' "$path" 2>/dev/null)"
    [ -n "$cur" ] && [ "$cur" = "$owner" ] && return 0
    prefix="$(fs_perm_sudo_prefix)"
    ${prefix:+$prefix }chown -R "$owner" "$path" 2>/dev/null || true
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
