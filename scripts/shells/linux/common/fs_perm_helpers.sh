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
#   - On FUSE/NTFS/ntfs3/exfat/vfat mounts: skip entirely (perms mount-fixed).
#   - On native filesystems: run the recursive walk ONLY when the root entry is
#     not already in the desired state (idempotent re-runs). For a forced full
#     subtree fix, call chown/chmod directly instead of these helpers.
#
# Sourced transitively via common_functions.sh -> available to every installer.

# fstype values whose permissions are fixed by mount options, so recursive
# chown/chmod are no-ops-in-effect and full-tree-walks-in-cost -> skipped.
FS_PERM_MOUNT_FIXED_FSTYPES="fuse fuseblk ntfs ntfs3 exfat vfat drvfs"
ACTIVE_PERMISSION_USER=""
ACTIVE_PERMISSION_GROUP=""
ACTIVE_PERMISSION_SOURCE=""

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
# Only an explicit caller or active login session qualifies as a regular user.
# Dormant passwd entries, /home directories, and existing path owners are never
# used as identity evidence. Root is the deterministic fallback.
resolve_active_permission_owner() {
    local candidate=""

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
        candidate="$(loginctl list-users --no-legend 2>/dev/null | awk 'NF >= 2 { print $2; exit }')"
        if active_permission_user_is_regular "$candidate"; then
            ACTIVE_PERMISSION_USER="$candidate"
            ACTIVE_PERMISSION_SOURCE="active systemd login"
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
        \( \( -type d -o -type f \) \( ! -user "$target_user" -o ! -perm 0777 \) \) \
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
