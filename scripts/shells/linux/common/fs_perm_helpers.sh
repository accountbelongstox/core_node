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
