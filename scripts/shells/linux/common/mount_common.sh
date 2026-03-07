#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Mount library: fstab single-entry (no duplicate UUID) and real-time remount.
# Caller should set USE_SUDO (e.g. by sourcing gvar_common.sh) or it defaults to sudo.

MOUNT_USE_SUDO="${USE_SUDO:-sudo}"
MOUNT_LOG_PREFIX="${MOUNT_LOG_PREFIX:-[MOUNT]}"

# Ensure exactly one fstab entry for this UUID: backup, remove all lines with this UUID, append one.
# Usage: mount_fstab_ensure_single_entry <uuid> <mount_point> <fstype> <options>
# Options are the comma-separated mount options (e.g. defaults,nofail,...).
mount_fstab_ensure_single_entry() {
    local uuid="$1"
    local mount_point="$2"
    local fstype="$3"
    local options="$4"
    local entry
    if [ -z "$uuid" ] || [ -z "$mount_point" ] || [ -z "$fstype" ]; then
        return 1
    fi
    entry="UUID=$uuid $mount_point $fstype ${options:-defaults} 0 2"
    echo "$MOUNT_LOG_PREFIX $MOUNT_USE_SUDO cp /etc/fstab /etc/fstab.backup.$(date +%Y%m%d_%H%M%S)"
    $MOUNT_USE_SUDO cp /etc/fstab "/etc/fstab.backup.$(date +%Y%m%d_%H%M%S)"
    echo "$MOUNT_LOG_PREFIX $MOUNT_USE_SUDO sed -i \"\\|UUID=$uuid|d\" /etc/fstab"
    $MOUNT_USE_SUDO sed -i "\|UUID=$uuid|d" /etc/fstab
    echo "$MOUNT_LOG_PREFIX echo \"\$entry\" | $MOUNT_USE_SUDO tee -a /etc/fstab"
    echo "$entry" | $MOUNT_USE_SUDO tee -a /etc/fstab >/dev/null
    return 0
}

# Remount device from current_mount to target_mount so it takes effect without reboot.
# Returns 0 if umount and mount succeeded; 1 if umount failed (e.g. busy) or mount failed.
# Usage: mount_remount_to_target <device> <current_mount> <target_mount> <fstype> <options>
mount_remount_to_target() {
    local device="$1"
    local current_mount="$2"
    local target_mount="$3"
    local fstype="$4"
    local options="$5"
    if [ -z "$device" ] || [ -z "$current_mount" ] || [ -z "$target_mount" ] || [ -z "$fstype" ]; then
        return 1
    fi
    echo "$MOUNT_LOG_PREFIX $MOUNT_USE_SUDO umount \"$current_mount\""
    if ! $MOUNT_USE_SUDO umount "$current_mount" 2>/dev/null; then
        return 1
    fi
    echo "$MOUNT_LOG_PREFIX $MOUNT_USE_SUDO mount -t \"$fstype\" -o \"${options:-defaults}\" \"$device\" \"$target_mount\""
    if ! $MOUNT_USE_SUDO mount -t "$fstype" -o "${options:-defaults}" "$device" "$target_mount" 2>/dev/null; then
        return 1
    fi
    echo "$MOUNT_LOG_PREFIX $MOUNT_USE_SUDO chmod 755 \"$target_mount\""
    $MOUNT_USE_SUDO chmod 755 "$target_mount" 2>/dev/null || true
    return 0
}
