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

# =============================================================================
# Index 2 - Base System Setup: Disk Detection, Mount Management, and Mail Service Control
# =============================================================================

set -e

SCRIPT_INDEX="2"

# Color codes
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[36m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source gvar_common.sh (trust-based coding)
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/fs_perm_helpers.sh"
# Mount library: single fstab entry per UUID, real-time remount
source "$PARENT_DIR_LEVEL_2/common/mount_common.sh"
# Repository manager (merged from former 12_update.sh: repo repair + management).
source "$PARENT_DIR_LEVEL_2/common/apt_repository_manager.sh"
MOUNT_LOG_PREFIX="[2]"

# Default mount base directory
DEFAULT_MOUNT_BASE="/mnt"

# PID of the background sudo keepalive loop (empty when not started / as root)
SUDO_KEEPALIVE_PID=""

# =============================================================================
# Logging Functions
# =============================================================================

log() {
    echo -e "${GREEN}[$SCRIPT_INDEX] $1${NC}"
}

info() {
    echo -e "${BLUE}[$SCRIPT_INDEX] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$SCRIPT_INDEX] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$SCRIPT_INDEX] ERROR: $1${NC}"
}

# TTY-guarded prompt read. Echoes the user's reply, or $1 (the prompt's documented
# default) when there is no interactive terminal -- so a piped/orchestrated re-run
# proceeds with the intended default instead of letting `read` hit EOF and abort
# the whole script under `set -e`. Empty interactive input also yields the default,
# matching the "(Y/n)"/"(y/N)" convention. Usage: confirm="$(read_default y)"
read_default() {
    local default="$1" reply=""
    if [ -t 0 ] && [ -r /dev/tty ]; then
        read -r reply < /dev/tty || reply=""
    fi
    printf '%s' "${reply:-$default}"
}

# =============================================================================
# Sudo Session Keepalive
# =============================================================================

# Prime the sudo credential cache once and keep it warm for the whole run. Every
# privileged op here goes through `$USE_SUDO` (= sudo) including `sudo -u <user>`
# drops; sudo's timestamp lapses (~15 min, per-tty) so otherwise a later command
# re-prompts mid-run. No-op when already root or when there is no terminal to
# prompt on. The refresher is a child of this script and is reaped on exit.
start_sudo_keepalive() {
    [ "$(id -u)" -eq 0 ] && return 0            # root: nothing to authenticate
    [ -n "$USE_SUDO" ] || return 0              # no sudo binary: nothing to do
    [ -t 0 ] || [ -r /dev/tty ] || return 0     # no terminal: cannot prompt
    log "Caching sudo credentials once for the whole base setup..."
    sudo -v || { warning "sudo authentication failed; per-command prompts may still appear."; return 0; }
    ( while kill -0 "$$" 2>/dev/null; do sudo -n true 2>/dev/null || exit 0; sleep 50; done ) &
    SUDO_KEEPALIVE_PID=$!
    trap 'stop_sudo_keepalive' EXIT INT TERM
    return 0
}

# Stop the background refresher (idempotent).
stop_sudo_keepalive() {
    [ -n "$SUDO_KEEPALIVE_PID" ] && kill "$SUDO_KEEPALIVE_PID" 2>/dev/null
    SUDO_KEEPALIVE_PID=""
}

# =============================================================================
# NTFS Support Functions
# =============================================================================

ensure_ntfs_support() {
    if ! command -v ntfs-3g >/dev/null 2>&1; then
        warning "ntfs-3g not installed, installing..."
        $USE_SUDO apt-get update -qq
        if $USE_SUDO apt-get install -y ntfs-3g; then
            log "ntfs-3g installed successfully"
            return 0
        else
            error "Failed to install ntfs-3g"
            return 1
        fi
    else
        info "ntfs-3g is already installed"
        return 0
    fi
}

# =============================================================================
# Original Mail Service Control Functions (Encapsulated)
# =============================================================================

stop_mail_services() {
    log "Stopping and disabling mail services..."

    # Stop exim4 service
    if systemctl list-units --full -all | grep -Fq "exim4.service"; then
        info "exim4.service exists, stopping the service..."
        $USE_SUDO systemctl stop exim4.service 2>/dev/null || true
    else
        info "exim4.service does not exist, skipping."
    fi

    # Stop postfix service
    if systemctl list-units --full -all | grep -Fq "postfix.service"; then
        info "postfix.service exists, stopping the service..."
        $USE_SUDO systemctl stop postfix.service 2>/dev/null || true
    else
        info "postfix.service does not exist, skipping."
    fi

    # Disable exim4 service
    if systemctl list-units --full -all | grep -Fq "exim4.service"; then
        info "exim4.service exists, disabling the service..."
        $USE_SUDO systemctl disable exim4.service 2>/dev/null || true
    else
        info "exim4.service does not exist, skipping."
    fi

    # Disable postfix service
    if systemctl list-units --full -all | grep -Fq "postfix.service"; then
        info "postfix.service exists, disabling the service..."
        $USE_SUDO systemctl disable postfix.service 2>/dev/null || true
    else
        info "postfix.service does not exist, skipping."
    fi

    # Legacy service command support
    if [ -x "$(command -v service)" ]; then
        if [ -f "/etc/init.d/exim4" ]; then
            info "exim4.service exists (init.d), stopping the service..."
            service exim4 stop 2>/dev/null || true
        fi

        if [ -f "/etc/init.d/postfix" ]; then
            info "postfix.service exists (init.d), stopping the service..."
            service postfix stop 2>/dev/null || true
        fi
    fi

    log "Mail service control completed"
}

# =============================================================================
# Disk Label and Mount Point Functions
# =============================================================================

device_to_mount_point() {
    local device="$1"
    local mount_base="${2:-$DEFAULT_MOUNT_BASE}"
    local existing
    existing=$(findmnt -n -o TARGET "$device" 2>/dev/null | head -n1)
    if [ -n "$existing" ] && [ "${existing#${mount_base}/}" != "$existing" ]; then
        echo "$existing"
        return 0
    fi
    # Convert /dev/sdb3 to dev_sdb3
    local mount_name=$(echo "$device" | sed 's|/dev/|dev_|g')
    echo "$mount_base/$mount_name"
}

is_label_english() {
    local label="$1"
    if [[ "$label" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        return 0
    else
        return 1
    fi
}

generate_english_label() {
    local original_label="$1"
    local device_name="$2"

    local short_name=$(basename "$device_name")
    local timestamp=$(date +%s)
    local hash=$(echo "$original_label$timestamp" | md5sum | cut -c1-6)

    echo "disk_${short_name}_${hash}"
}

sanitize_mount_name() {
    local name="$1"
    echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/_/g'
}

# Remove an orphaned mount directory left over from an unstable device-node name
# (e.g. /mnt/dev_nvme1n1p1 created on a boot when the disk enumerated as nvme1,
# now that device_to_mount_point returns the real live mount /mnt/dev_nvme0n1p1).
# Safe by construction: only removes a dir that is under the mount base, EMPTY,
# and NOT itself a mountpoint. $1=device, $2=the live mount point to KEEP.
cleanup_orphan_mount_dir() {
    local device="$1"
    local keep_mount="$2"
    local node_name node_dir
    node_name=$(echo "$device" | sed 's|/dev/|dev_|g')
    node_dir="$DEFAULT_MOUNT_BASE/$node_name"
    [ "$node_dir" = "$keep_mount" ] && return 0
    [ -d "$node_dir" ] || return 0
    mountpoint -q "$node_dir" 2>/dev/null && return 0
    if [ -z "$(ls -A "$node_dir" 2>/dev/null)" ]; then
        if $USE_SUDO rmdir "$node_dir" 2>/dev/null; then
            info "Removed orphaned empty mount dir from a device-node rename: $node_dir"
        fi
    fi
}

# =============================================================================
# Disk Detection Functions
# =============================================================================

detect_ntfs_disks() {
    log "Detecting NTFS disks..." >&2

    local ntfs_disks=()

    while IFS= read -r line; do
        if [ -n "$line" ]; then
            ntfs_disks+=("$line")
        fi
    done < <($USE_SUDO blkid | grep -i "TYPE=\"ntfs\"" | cut -d: -f1)

    if [ ${#ntfs_disks[@]} -eq 0 ]; then
        info "No NTFS disks detected" >&2
        return 1
    fi

    log "Found ${#ntfs_disks[@]} NTFS partition(s)" >&2
    echo "${ntfs_disks[@]}"
    return 0
}

detect_data_disks() {
    log "Detecting data disks (ext4, xfs, etc.)..." >&2

    local data_disks=()

    while IFS= read -r line; do
        if [ -n "$line" ]; then
            local device="$line"
            local mount_point=$(findmnt -n -o TARGET "$device" 2>/dev/null || echo "")

            if [ "$mount_point" != "/" ] && [ "$mount_point" != "/boot" ]; then
                data_disks+=("$device")
            fi
        fi
    done < <($USE_SUDO blkid | grep -iE "TYPE=\"(ext4|xfs|btrfs)\"" | cut -d: -f1)

    if [ ${#data_disks[@]} -eq 0 ]; then
        info "No additional data disks detected" >&2
        return 1
    fi

    log "Found ${#data_disks[@]} data disk(s)" >&2
    echo "${data_disks[@]}"
    return 0
}

# =============================================================================
# Disk Information Functions
# =============================================================================

get_disk_info() {
    local device="$1"

    local uuid=$($USE_SUDO blkid -s UUID -o value "$device" 2>/dev/null || echo "")
    local label=$($USE_SUDO blkid -s LABEL -o value "$device" 2>/dev/null || echo "")
    local fstype=$($USE_SUDO blkid -s TYPE -o value "$device" 2>/dev/null || echo "")
    local size=$($USE_SUDO lsblk -n -o SIZE "$device" 2>/dev/null | xargs)

    echo "UUID=$uuid|LABEL=$label|TYPE=$fstype|SIZE=$size"
}

is_device_mounted() {
    local device="$1"
    # findmnt is robust where `mount | grep` is not: it avoids treating $device as
    # a regex and collapses btrfs/subvolume multi-line output (head -n1).
    [ -n "$(findmnt -n -o TARGET --source "$device" 2>/dev/null | head -n1)" ]
}

get_mount_point() {
    local device="$1"
    findmnt -n -o TARGET --source "$device" 2>/dev/null | head -n1
}

# NTFS has no native ownership, so it is mounted with uid=/gid= of the real login
# user. Resolve them at runtime (resolve_desktop_user is defined below; this is
# only CALLED from the disk loop in main(), by which point it exists) instead of
# hardcoding 1000 -- the first human user is not UID 1000 on every Debian/Kali box.
ntfs_owner_opts() {
    local u uid gid
    u="$(resolve_desktop_user "" 2>/dev/null)"
    uid="$(id -u "$u" 2>/dev/null || echo 1000)"; [ -n "$uid" ] || uid=1000
    gid="$(id -g "$u" 2>/dev/null || echo 1000)"; [ -n "$gid" ] || gid=1000
    printf 'uid=%s,gid=%s' "$uid" "$gid"
}

# ntfs_mount_type -> echo "ntfs3" (preferred in-kernel driver) or "ntfs" (ntfs-3g
# FUSE fallback). ntfs3 is SMP-friendly and runs in-kernel, avoiding the
# single-threaded userspace FUSE bottleneck of ntfs-3g under metadata-heavy ops
# (recursive chown/chmod, find). Both drivers accept the same uid=/gid=/umask=
# mount options, so only the fstab type field changes. Loads the module as a side
# effect of the availability probe.
ntfs_mount_type() {
    if modprobe ntfs3 >/dev/null 2>&1; then
        echo "ntfs3"
    elif grep -q ntfs3 /proc/filesystems 2>/dev/null; then
        echo "ntfs3"
    else
        echo "ntfs"
    fi
}

# =============================================================================
# Mount Management Functions
# =============================================================================

update_fstab() {
    local uuid="$1"
    local mount_point="$2"
    local fstype="$3"
    local options="$4"
    mount_fstab_ensure_single_entry "$uuid" "$mount_point" "$fstype" "${options:-defaults}"
    log "Added fstab entry: UUID=$uuid $mount_point $fstype ${options:-defaults} 0 2"
}

mount_disk() {
    local device="$1"
    local mount_point="$2"
    local fstype="$3"

    if [ ! -d "$mount_point" ]; then
        echo "[2] $USE_SUDO mkdir -p $mount_point"
        $USE_SUDO mkdir -p "$mount_point"
        log "Created mount point: $mount_point"
    fi

    local mount_options=""
    if [ "$fstype" = "ntfs" ]; then
        if ! command -v ntfs-3g >/dev/null 2>&1; then
            warning "ntfs-3g not installed, installing..."
            echo "[2] $USE_SUDO apt-get update -qq"
            $USE_SUDO apt-get update -qq
            echo "[2] $USE_SUDO apt-get install -y ntfs-3g"
            $USE_SUDO apt-get install -y ntfs-3g
        fi
        mount_options="defaults,nofail,x-systemd.device-timeout=10,$(ntfs_owner_opts),umask=0022"
    else
        mount_options="defaults,nofail,x-systemd.device-timeout=10"
    fi

    local uuid=$($USE_SUDO blkid -s UUID -o value "$device")

    # Prefer in-kernel ntfs3 for NTFS volumes (see ntfs_mount_type).
    local fstab_type="$fstype"
    [ "$fstype" = "ntfs" ] && fstab_type="$(ntfs_mount_type)"
    update_fstab "$uuid" "$mount_point" "$fstab_type" "$mount_options"

    echo "[2] $USE_SUDO mount $mount_point"
    if $USE_SUDO mount "$mount_point" 2>/dev/null; then
        log "Successfully mounted $device to $mount_point"
        echo "[2] $USE_SUDO chmod 755 $mount_point"
        $USE_SUDO chmod 755 "$mount_point"
        return 0
    elif [ "$fstab_type" = "ntfs3" ]; then
        # ntfs3 mount failed (e.g. dirty volume) -> fall back to ntfs-3g.
        warning "ntfs3 mount failed for $device; falling back to ntfs-3g"
        fstab_type="ntfs"
        update_fstab "$uuid" "$mount_point" "$fstab_type" "$mount_options"
        if $USE_SUDO mount "$mount_point" 2>/dev/null; then
            log "Successfully mounted $device to $mount_point (ntfs-3g)"
            echo "[2] $USE_SUDO chmod 755 $mount_point"
            $USE_SUDO chmod 755 "$mount_point"
            return 0
        fi
        error "Failed to mount $device to $mount_point"
        return 1
    else
        error "Failed to mount $device to $mount_point"
        return 1
    fi
}

# =============================================================================
# Disk Handling Functions
# =============================================================================

handle_ntfs_disk() {
    local device="$1"

    info "Processing NTFS disk: $device"

    # Ensure ntfs-3g is installed
    if ! ensure_ntfs_support; then
        error "Cannot mount NTFS without ntfs-3g support"
        return 1
    fi

    local disk_info=$(get_disk_info "$device")
    local uuid=$(echo "$disk_info" | cut -d'|' -f1 | cut -d'=' -f2)
    local label=$(echo "$disk_info" | cut -d'|' -f2 | cut -d'=' -f2)
    local fstype=$(echo "$disk_info" | cut -d'|' -f3 | cut -d'=' -f2)
    local size=$(echo "$disk_info" | cut -d'|' -f4 | cut -d'=' -f2)

    echo ""
    echo "=========================================="
    echo "Device: $device"
    echo "Size: $size"
    echo "Label: ${label:-<no label>}"
    echo "UUID: $uuid"
    echo "=========================================="

    # Generate mount point from device name
    local mount_point=$(device_to_mount_point "$device")
    info "Standardized mount point: $mount_point"
    # Drop any orphaned empty mount dir left by an earlier device-node rename.
    cleanup_orphan_mount_dir "$device" "$mount_point"

    # Check if device is already mounted
    local is_mounted=false
    local current_mount=""
    if is_device_mounted "$device"; then
        current_mount=$(get_mount_point "$device")
        is_mounted=true
        info "Device is already mounted at: $current_mount"
    fi

    # Check fstab configuration
    local fstab_correct=false
    local fstab_mount_point=""
    if grep -q "UUID=$uuid" /etc/fstab; then
        fstab_mount_point=$(grep "UUID=$uuid" /etc/fstab | awk '{print $2}')
        if [ "$fstab_mount_point" = "$mount_point" ]; then
            fstab_correct=true
        fi
    fi

    # Smart detection: check if configuration is already correct
    if [ "$is_mounted" = true ] && [ "$current_mount" = "$mount_point" ] && [ "$fstab_correct" = true ]; then
        log "Device is already correctly mounted at: $mount_point"
        log "fstab configuration is correct"
        log "No action needed, skipping..."

        # Save to global variables
        if [ -n "$GLOBAL_VAR_DIR" ]; then
            echo "[2] echo \"\$mount_point\" | $USE_SUDO tee $GLOBAL_VAR_DIR/NTFS_MOUNT_POINT"
            echo "$mount_point" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_MOUNT_POINT" >/dev/null
            echo "[2] echo \"\$device\" | $USE_SUDO tee $GLOBAL_VAR_DIR/NTFS_DEVICE"
            echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_DEVICE" >/dev/null
        fi

        return 0
    fi

    # Show current status and expected configuration
    echo ""
    echo "=========================================="
    echo "Current Status:"
    if [ "$is_mounted" = true ]; then
        echo "  Mounted at: $current_mount"
    else
        echo "  Mounted: No"
    fi
    if [ -n "$fstab_mount_point" ]; then
        echo "  fstab mount point: $fstab_mount_point"
    else
        echo "  fstab entry: Not found"
    fi
    echo ""
    echo "Expected Configuration:"
    echo "  Target mount point: $mount_point"
    echo "=========================================="

    # Determine what needs to be fixed
    local needs_fix=false
    local fix_message=""

    if [ "$is_mounted" = true ] && [ "$current_mount" != "$mount_point" ]; then
        needs_fix=true
        fix_message="${fix_message}  - Current mount point ($current_mount) differs from standard ($mount_point)\n"
    fi

    if [ "$fstab_correct" = false ]; then
        needs_fix=true
        if [ -n "$fstab_mount_point" ]; then
            fix_message="${fix_message}  - fstab mount point ($fstab_mount_point) differs from standard ($mount_point)\n"
        else
            fix_message="${fix_message}  - fstab entry missing\n"
        fi
    fi

    if [ "$needs_fix" = true ]; then
        echo ""
        echo -e "${YELLOW}Configuration issues detected:${NC}"
        echo -e "$fix_message"
        echo -n "Do you want to fix the configuration? (Y/n): "
    else
        echo ""
        echo -n "Proceed to configure fstab? (Y/n): "
    fi

    confirm="$(read_default y)"

    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        info "Skipped mounting $device"
        return 0
    fi

    # Create mount point directory
    if [ ! -d "$mount_point" ]; then
        echo "[2] $USE_SUDO mkdir -p $mount_point"
        $USE_SUDO mkdir -p "$mount_point"
        log "Created mount point: $mount_point"
    fi

    # Prefer in-kernel ntfs3 (see ntfs_mount_type); fall back to ntfs-3g on failure.
    local ntfs_type="$(ntfs_mount_type)"
    # Update fstab (single entry per UUID, no duplicates)
    local mount_options="defaults,nofail,x-systemd.device-timeout=10,$(ntfs_owner_opts),umask=0022"
    mount_fstab_ensure_single_entry "$uuid" "$mount_point" "$ntfs_type" "$mount_options"
    log "Added fstab entry: UUID=$uuid $mount_point $ntfs_type $mount_options 0 2"

    # Real-time mount: not mounted -> mount at target; mounted elsewhere -> remount to target
    if [ "$is_mounted" = false ]; then
        local _mounted=false
        local _tries="$ntfs_type"
        [ "$ntfs_type" = "ntfs" ] || _tries="$ntfs_type ntfs"
        for _try_type in $_tries; do
            [ "$_try_type" = "$ntfs_type" ] || warning "Retrying $device with ntfs-3g"
            echo "[2] $USE_SUDO mount -t $_try_type -o $mount_options $device $mount_point"
            if $USE_SUDO mount -t "$_try_type" -o "$mount_options" "$device" "$mount_point" 2>/dev/null; then
                ntfs_type="$_try_type"
                _mounted=true
                break
            fi
        done
        if [ "$_mounted" = true ]; then
            # Persist the fstab type that actually mounted.
            mount_fstab_ensure_single_entry "$uuid" "$mount_point" "$ntfs_type" "$mount_options"
            log "Successfully mounted $device to $mount_point ($ntfs_type)"
            echo "[2] $USE_SUDO chmod 755 $mount_point"
            $USE_SUDO chmod 755 "$mount_point"
            if [ -n "$GLOBAL_VAR_DIR" ]; then
                echo "[2] echo \"\$mount_point\" | $USE_SUDO tee $GLOBAL_VAR_DIR/NTFS_MOUNT_POINT"
                echo "$mount_point" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_MOUNT_POINT" >/dev/null
                echo "[2] echo \"\$device\" | $USE_SUDO tee $GLOBAL_VAR_DIR/NTFS_DEVICE"
                echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_DEVICE" >/dev/null
            fi
            return 0
        else
            error "Failed to mount $device to $mount_point"
            warning "The fstab has been updated. Please reboot to apply changes."
            return 1
        fi
    fi
    if [ "$current_mount" != "$mount_point" ]; then
        if mount_remount_to_target "$device" "$current_mount" "$mount_point" "$ntfs_type" "$mount_options"; then
            log "Remounted $device to $mount_point (effective immediately)"
            if [ -n "$GLOBAL_VAR_DIR" ]; then
                echo "[2] echo \"\$mount_point\" | $USE_SUDO tee $GLOBAL_VAR_DIR/NTFS_MOUNT_POINT"
                echo "$mount_point" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_MOUNT_POINT" >/dev/null
                echo "[2] echo \"\$device\" | $USE_SUDO tee $GLOBAL_VAR_DIR/NTFS_DEVICE"
                echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_DEVICE" >/dev/null
            fi
            return 0
        fi
        warning "Could not unmount $current_mount (e.g. in use). Using current path until reboot."
        if [ -n "$GLOBAL_VAR_DIR" ]; then
            echo "[2] echo \"\$current_mount\" | $USE_SUDO tee $GLOBAL_VAR_DIR/NTFS_MOUNT_POINT"
            echo "$current_mount" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_MOUNT_POINT" >/dev/null
            echo "[2] echo \"\$device\" | $USE_SUDO tee $GLOBAL_VAR_DIR/NTFS_DEVICE"
            echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_DEVICE" >/dev/null
        fi
        return 0
    fi
    if [ -n "$GLOBAL_VAR_DIR" ]; then
        echo "[2] echo \"\$mount_point\" | $USE_SUDO tee $GLOBAL_VAR_DIR/NTFS_MOUNT_POINT"
        echo "$mount_point" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_MOUNT_POINT" >/dev/null
        echo "[2] echo \"\$device\" | $USE_SUDO tee $GLOBAL_VAR_DIR/NTFS_DEVICE"
        echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_DEVICE" >/dev/null
    fi
    return 0
}

handle_data_disk() {
    local device="$1"

    info "Processing data disk: $device"

    local disk_info=$(get_disk_info "$device")
    local uuid=$(echo "$disk_info" | cut -d'|' -f1 | cut -d'=' -f2)
    local label=$(echo "$disk_info" | cut -d'|' -f2 | cut -d'=' -f2)
    local fstype=$(echo "$disk_info" | cut -d'|' -f3 | cut -d'=' -f2)
    local size=$(echo "$disk_info" | cut -d'|' -f4 | cut -d'=' -f2)

    echo ""
    echo "=========================================="
    echo "Device: $device"
    echo "Size: $size"
    echo "Filesystem: $fstype"
    echo "Label: ${label:-<no label>}"
    echo "UUID: $uuid"
    echo "=========================================="

    # Generate mount point from device name
    local mount_point=$(device_to_mount_point "$device")
    info "Standardized mount point: $mount_point"
    # Drop any orphaned empty mount dir left by an earlier device-node rename.
    cleanup_orphan_mount_dir "$device" "$mount_point"

    # Check if device is already mounted
    local is_mounted=false
    local current_mount=""
    if is_device_mounted "$device"; then
        current_mount=$(get_mount_point "$device")
        is_mounted=true
        info "Device is already mounted at: $current_mount"
    fi

    # Check fstab configuration
    local fstab_correct=false
    local fstab_mount_point=""
    if grep -q "UUID=$uuid" /etc/fstab; then
        fstab_mount_point=$(grep "UUID=$uuid" /etc/fstab | awk '{print $2}')
        if [ "$fstab_mount_point" = "$mount_point" ]; then
            fstab_correct=true
        fi
    fi

    # Smart detection: check if configuration is already correct
    if [ "$is_mounted" = true ] && [ "$current_mount" = "$mount_point" ] && [ "$fstab_correct" = true ]; then
        log "Device is already correctly mounted at: $mount_point"
        log "fstab configuration is correct"
        log "No action needed, skipping..."

        # Save to global variables
        if [ -n "$GLOBAL_VAR_DIR" ]; then
            echo "$mount_point" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_MOUNT_POINT" >/dev/null
            echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_DEVICE" >/dev/null
        fi

        return 0
    fi

    # Show current status and expected configuration
    echo ""
    echo "=========================================="
    echo "Current Status:"
    if [ "$is_mounted" = true ]; then
        echo "  Mounted at: $current_mount"
    else
        echo "  Mounted: No"
    fi
    if [ -n "$fstab_mount_point" ]; then
        echo "  fstab mount point: $fstab_mount_point"
    else
        echo "  fstab entry: Not found"
    fi
    echo ""
    echo "Expected Configuration:"
    echo "  Target mount point: $mount_point"
    echo "=========================================="

    # Determine what needs to be fixed
    local needs_fix=false
    local fix_message=""

    if [ "$is_mounted" = true ] && [ "$current_mount" != "$mount_point" ]; then
        needs_fix=true
        fix_message="${fix_message}  - Current mount point ($current_mount) differs from standard ($mount_point)\n"
    fi

    if [ "$fstab_correct" = false ]; then
        needs_fix=true
        if [ -n "$fstab_mount_point" ]; then
            fix_message="${fix_message}  - fstab mount point ($fstab_mount_point) differs from standard ($mount_point)\n"
        else
            fix_message="${fix_message}  - fstab entry missing\n"
        fi
    fi

    if [ "$needs_fix" = true ]; then
        echo ""
        echo -e "${YELLOW}Configuration issues detected:${NC}"
        echo -e "$fix_message"
        echo -n "Do you want to fix the configuration? (Y/n): "
        confirm="$(read_default y)"

        if [[ "$confirm" =~ ^[Nn]$ ]]; then
            info "Skipped fixing data disk configuration"
            return 0
        fi
    else
        echo ""
        echo -n "Do you want to mount this data disk? (y/N): "
        mount_data="$(read_default n)"

        if [[ ! "$mount_data" =~ ^[Yy]$ ]]; then
            info "Skipped mounting data disk"
            return 0
        fi

        echo -n "Proceed to configure fstab? (Y/n): "
        confirm="$(read_default y)"

        if [[ "$confirm" =~ ^[Nn]$ ]]; then
            info "Skipped mounting $device"
            return 0
        fi
    fi

    # Create mount point directory
    if [ ! -d "$mount_point" ]; then
        echo "[2] $USE_SUDO mkdir -p $mount_point"
        $USE_SUDO mkdir -p "$mount_point"
        log "Created mount point: $mount_point"
    fi

    # Update fstab (single entry per UUID, no duplicates)
    local mount_options="defaults,nofail,x-systemd.device-timeout=10"
    mount_fstab_ensure_single_entry "$uuid" "$mount_point" "$fstype" "$mount_options"
    log "Added fstab entry: UUID=$uuid $mount_point $fstype $mount_options 0 2"

    # Real-time mount: already at target -> save only; elsewhere -> remount to target; not mounted -> mount
    if [ "$is_mounted" = true ] && [ "$current_mount" = "$mount_point" ]; then
        if [ -n "$GLOBAL_VAR_DIR" ]; then
            echo "[2] echo \"\$mount_point\" | $USE_SUDO tee $GLOBAL_VAR_DIR/DATA_MOUNT_POINT"
            echo "$mount_point" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_MOUNT_POINT" >/dev/null
            echo "[2] echo \"\$device\" | $USE_SUDO tee $GLOBAL_VAR_DIR/DATA_DEVICE"
            echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_DEVICE" >/dev/null
        fi
        return 0
    fi
    if [ "$is_mounted" = true ] && [ -n "$current_mount" ] && [ "$current_mount" != "$mount_point" ]; then
        if mount_remount_to_target "$device" "$current_mount" "$mount_point" "$fstype" "$mount_options"; then
            log "Remounted data disk to $mount_point (effective immediately)"
            if [ -n "$GLOBAL_VAR_DIR" ]; then
                echo "[2] echo \"\$mount_point\" | $USE_SUDO tee $GLOBAL_VAR_DIR/DATA_MOUNT_POINT"
                echo "$mount_point" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_MOUNT_POINT" >/dev/null
                echo "[2] echo \"\$device\" | $USE_SUDO tee $GLOBAL_VAR_DIR/DATA_DEVICE"
                echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_DEVICE" >/dev/null
            fi
            return 0
        fi
        warning "Could not unmount $current_mount (e.g. in use). Using current path until reboot."
        if [ -n "$GLOBAL_VAR_DIR" ]; then
            echo "[2] echo \"\$current_mount\" | $USE_SUDO tee $GLOBAL_VAR_DIR/DATA_MOUNT_POINT"
            echo "$current_mount" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_MOUNT_POINT" >/dev/null
            echo "[2] echo \"\$device\" | $USE_SUDO tee $GLOBAL_VAR_DIR/DATA_DEVICE"
            echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_DEVICE" >/dev/null
        fi
        return 0
    fi
    echo "[2] $USE_SUDO mount -t $fstype -o $mount_options $device $mount_point"
    if $USE_SUDO mount -t "$fstype" -o "$mount_options" "$device" "$mount_point" 2>/dev/null; then
        log "Data disk successfully mounted at $mount_point"
        echo "[2] $USE_SUDO chmod 755 $mount_point"
        $USE_SUDO chmod 755 "$mount_point"
        if [ -n "$GLOBAL_VAR_DIR" ]; then
            echo "[2] echo \"\$mount_point\" | $USE_SUDO tee $GLOBAL_VAR_DIR/DATA_MOUNT_POINT"
            echo "$mount_point" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_MOUNT_POINT" >/dev/null
            echo "[2] echo \"\$device\" | $USE_SUDO tee $GLOBAL_VAR_DIR/DATA_DEVICE"
            echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_DEVICE" >/dev/null
        fi
        return 0
    fi
    error "Failed to mount data disk"
    warning "The fstab has been updated. Please reboot to apply changes."
    return 1
}

# =============================================================================
# Desktop System Configuration Functions
# =============================================================================

# Case-insensitive substring match against XDG_CURRENT_DESKTOP + DESKTOP_SESSION
# (handles values like "ubuntu:GNOME", "X-Cinnamon", "LXQt", "pop:GNOME").
_de_has() {
    local hay
    hay="$(printf '%s:%s' "${XDG_CURRENT_DESKTOP:-}" "${DESKTOP_SESSION:-}" | tr '[:upper:]' '[:lower:]')"
    case "$hay" in *"$1"*) return 0 ;; *) return 1 ;; esac
}

# Resolve the desktop type across the common Debian/Ubuntu/Kali environments.
# Order matters: the GNOME-derivatives (Cinnamon/MATE/Budgie/Unity/Pantheon) and
# the lightweight DEs are checked BEFORE plain GNOME so "Budgie:GNOME" etc. don't
# fall through to gnome. A running session process (pgrep) wins; otherwise the
# env-var substring match decides. Echoes "" when nothing is recognized.
detect_desktop_type() {
    if pgrep -x "cinnamon-session" >/dev/null 2>&1 || _de_has cinnamon; then echo "cinnamon"; return; fi
    if pgrep -x "mate-session"     >/dev/null 2>&1 || _de_has mate;     then echo "mate";     return; fi
    if pgrep -x "budgie-daemon"    >/dev/null 2>&1 || _de_has budgie;   then echo "budgie";   return; fi
    if pgrep -x "xfce4-session"    >/dev/null 2>&1 || _de_has xfce;     then echo "xfce";     return; fi
    if pgrep -x "lxqt-session"     >/dev/null 2>&1 || _de_has lxqt;     then echo "lxqt";     return; fi
    if pgrep -x "lxsession"        >/dev/null 2>&1 || _de_has lxde;     then echo "lxde";     return; fi
    if _de_has pantheon; then echo "pantheon"; return; fi
    if _de_has unity;    then echo "unity";    return; fi
    if _de_has deepin;   then echo "deepin";   return; fi
    if pgrep -x "plasmashell" >/dev/null 2>&1 || _de_has kde || _de_has plasma; then echo "kde"; return; fi
    if pgrep -x "gnome-shell"  >/dev/null 2>&1 || _de_has gnome; then echo "gnome"; return; fi
    echo ""
}

configure_gnome_desktop() {
    log "Configuring GNOME desktop for high performance..."
    
    # Detect desktop user
    local desktop_user="$(resolve_desktop_user gnome-session)"
    
    if [ -z "$desktop_user" ]; then
        warning "Could not detect desktop user, skipping GNOME configuration"
        return 1
    fi
    
    local user_home=$(getent passwd "$desktop_user" 2>/dev/null | cut -d: -f6)
    if [ -z "$user_home" ] || [ ! -d "$user_home" ]; then
        warning "Could not find home directory for user $desktop_user"
        return 1
    fi
    
    info "Configuring GNOME for user: $desktop_user"
    
    # Disable screen lock (compatible with Ubuntu 24.04, 26.04, and GNOME 50)
    if command -v gsettings >/dev/null 2>&1; then
        local user_id=$(id -u "$desktop_user" 2>/dev/null)
        local dbus_address="unix:path=/run/user/$user_id/bus"
        
        # Try to get DBUS_SESSION_BUS_ADDRESS from user's environment (works for both X11 and Wayland)
        if [ -S "/run/user/$user_id/bus" ]; then
            dbus_address="unix:path=/run/user/$user_id/bus"
        fi
        
        # Method 1: Complete lock screen disable (Ubuntu 24.04+, GNOME 50 compatible)
        info "Disabling lock screen completely..."
        $USE_SUDO -u "$desktop_user" env DBUS_SESSION_BUS_ADDRESS="$dbus_address" gsettings set org.gnome.desktop.lockdown disable-lock-screen true 2>/dev/null || \
        $USE_SUDO -u "$desktop_user" gsettings set org.gnome.desktop.lockdown disable-lock-screen true 2>/dev/null || \
        warning "Failed to disable lock screen via lockdown (may not be available in all GNOME versions)"
        
        # Method 2: Disable automatic screen lock (fallback method, works on all GNOME versions)
        info "Disabling automatic screen lock..."
        $USE_SUDO -u "$desktop_user" env DBUS_SESSION_BUS_ADDRESS="$dbus_address" gsettings set org.gnome.desktop.screensaver lock-enabled false 2>/dev/null || \
        $USE_SUDO -u "$desktop_user" gsettings set org.gnome.desktop.screensaver lock-enabled false 2>/dev/null || \
        warning "Failed to disable screen lock (may need to run from desktop session)"
        
        # Disable idle delay (prevent screen from going idle)
        info "Disabling idle delay..."
        $USE_SUDO -u "$desktop_user" env DBUS_SESSION_BUS_ADDRESS="$dbus_address" gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null || \
        $USE_SUDO -u "$desktop_user" gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null || \
        warning "Failed to disable idle delay (may need to run from desktop session)"
        
        # Disable screensaver idle activation
        info "Disabling screensaver idle activation..."
        $USE_SUDO -u "$desktop_user" env DBUS_SESSION_BUS_ADDRESS="$dbus_address" gsettings set org.gnome.desktop.screensaver idle-activation-enabled false 2>/dev/null || \
        $USE_SUDO -u "$desktop_user" gsettings set org.gnome.desktop.screensaver idle-activation-enabled false 2>/dev/null || \
        warning "Failed to disable screensaver idle activation"
    else
        warning "gsettings command not found, skipping GNOME configuration"
        return 1
    fi
    
    # Set high performance power profile
    if command -v powerprofilesctl >/dev/null 2>&1; then
        info "Setting power profile to performance mode..."
        if $USE_SUDO powerprofilesctl set performance 2>/dev/null; then
            log "Power profile set to performance mode"
        else
            warning "Failed to set power profile to performance mode (may require system-level configuration)"
        fi
    else
        info "powerprofilesctl not available, skipping power profile configuration"
    fi
    
    log "GNOME desktop configuration completed"
    return 0
}

configure_kde_desktop() {
    log "Configuring KDE desktop for high performance..."
    
    # Detect the desktop user via the shared resolver (SUDO_USER -> a user running
    # the Plasma session -> first uid>=1000). The old `pgrep -x kde-session` never
    # matched: the Plasma session process is plasmashell/ksmserver, not "kde-session".
    local desktop_user
    desktop_user="$(resolve_desktop_user plasmashell)"

    if [ -z "$desktop_user" ]; then
        warning "Could not detect desktop user, skipping KDE configuration"
        return 1
    fi
    
    local user_home=$(getent passwd "$desktop_user" 2>/dev/null | cut -d: -f6)
    if [ -z "$user_home" ] || [ ! -d "$user_home" ]; then
        warning "Could not find home directory for user $desktop_user"
        return 1
    fi
    
    info "Configuring KDE for user: $desktop_user"
    
    # Configure KDE screensaver settings
    local kde_config_dir="$user_home/.config"
    local screensaver_config="$kde_config_dir/kscreensaverrc"
    
    if [ ! -d "$kde_config_dir" ]; then
        echo "[2] $USE_SUDO mkdir -p $kde_config_dir"
        $USE_SUDO mkdir -p "$kde_config_dir"
        echo "[2] $USE_SUDO chown $desktop_user:$desktop_user $kde_config_dir"
        $USE_SUDO chown "$desktop_user:$desktop_user" "$kde_config_dir"
    fi
    
    info "Disabling screen lock in KDE..."
    $USE_SUDO -u "$desktop_user" mkdir -p "$kde_config_dir" 2>/dev/null || true

    # Prefer KDE's own group-aware writer (kwriteconfig6 for Plasma 6, kwriteconfig5
    # for Plasma 5): it guarantees keys land in the right [group] and is idempotent,
    # unlike the old EOF-append + whole-file sed (which drifted keys into the wrong
    # section and rewrote Enabled=/Lock= everywhere on each re-run). On Plasma 5/6 the
    # ACTUAL lock lives in kscreenlockerrc [Daemon], not kscreensaverrc.
    local kw=""
    kw="$(command -v kwriteconfig6 2>/dev/null || command -v kwriteconfig5 2>/dev/null || true)"
    if [ -n "$kw" ]; then
        $USE_SUDO -u "$desktop_user" "$kw" --file kscreenlockerrc --group Daemon --key Autolock false 2>/dev/null || true
        $USE_SUDO -u "$desktop_user" "$kw" --file kscreenlockerrc --group Daemon --key LockOnResume false 2>/dev/null || true
        $USE_SUDO -u "$desktop_user" "$kw" --file kscreensaverrc --group ScreenSaver --key Enabled false 2>/dev/null || true
        $USE_SUDO -u "$desktop_user" "$kw" --file kscreensaverrc --group ScreenSaver --key Lock false 2>/dev/null || true
    elif [ -f "$screensaver_config" ] && grep -q "^\[ScreenSaver\]" "$screensaver_config" 2>/dev/null; then
        # Section exists: update IN PLACE, scoped to [ScreenSaver] (idempotent).
        $USE_SUDO -u "$desktop_user" sed -i \
            -e '/^\[ScreenSaver\]/,/^\[/{s/^Enabled=.*/Enabled=false/; s/^Lock=.*/Lock=false/}' \
            "$screensaver_config" 2>/dev/null || true
    else
        # No section yet: write a fresh [ScreenSaver] block once.
        printf '[ScreenSaver]\nEnabled=false\nLock=false\n' \
            | $USE_SUDO -u "$desktop_user" tee -a "$screensaver_config" >/dev/null 2>&1 || true
    fi
    $USE_SUDO chown "$desktop_user:$desktop_user" "$kde_config_dir" 2>/dev/null || true
    
    # Configure power management (Power Devil)
    # Note: Plasma 6.0+ uses powerdevilrc, older versions may use powermanagementprofilesrc
    local powerdevil_config="$kde_config_dir/powerdevilrc"
    local powerdevil_legacy_config="$kde_config_dir/powermanagementprofilesrc"
    
    # Configure Plasma 6.0+ powerdevilrc
    if [ -f "$powerdevil_config" ]; then
        info "Configuring KDE power management (Plasma 6.0+)..."
        $USE_SUDO -u "$desktop_user" sed -i 's/^idleTime=.*/idleTime=36000000/' "$powerdevil_config" 2>/dev/null || true
        $USE_SUDO -u "$desktop_user" sed -i 's/^idleTimeDim=.*/idleTimeDim=36000000/' "$powerdevil_config" 2>/dev/null || true
    # Fallback to legacy config for older Plasma versions
    elif [ -f "$powerdevil_legacy_config" ]; then
        info "Configuring KDE power management (Plasma 5.x)..."
        $USE_SUDO -u "$desktop_user" sed -i 's/^idleTime=.*/idleTime=36000000/' "$powerdevil_legacy_config" 2>/dev/null || true
        $USE_SUDO -u "$desktop_user" sed -i 's/^idleTimeDim=.*/idleTimeDim=36000000/' "$powerdevil_legacy_config" 2>/dev/null || true
    fi
    
    log "KDE desktop configuration completed"
    return 0
}

# --------------------------------------------------------------------------- #
# Shared desktop helpers (used by every per-DE configuration function below).
# Every privileged step is entered via $USE_SUDO; per-user settings are applied
# AS the target user (never as root) so they land in the right profile. Each
# helper is defensive and returns 0 so they are safe under the script's set -e.
# --------------------------------------------------------------------------- #

# Resolve the desktop user through the shared filtered/scored user policy.
resolve_desktop_user() {
    local session_proc="$1" uh uname resolved_user
    if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
        echo "$SUDO_USER"; return 0
    fi
    if [ -n "$session_proc" ]; then
        for uh in /home/*; do
            [ -d "$uh" ] || continue
            uname="$(basename "$uh")"
            if pgrep -u "$uname" -x "$session_proc" >/dev/null 2>&1; then
                echo "$uname"; return 0
            fi
        done
    fi
    resolved_user="$(detect_system_user)"
    [ "$resolved_user" != "root" ] && echo "$resolved_user"
    return 0
}

# Run a command AS the desktop user. Tries the live session bus first (immediate
# effect on a running session); falls back to a private D-Bus via dbus-run-session
# so values still persist to the user's config during a headless/root install
# with no active login. Returns non-zero only if neither path is available.
run_user_session() {
    local user="$1"; shift
    local uid home bus
    uid="$(id -u "$user" 2>/dev/null)"
    home="$(getent passwd "$user" 2>/dev/null | cut -d: -f6)"
    bus="/run/user/$uid/bus"

    # Build a run-AS-user prefix that works whether we are root or not, and even
    # before sudo is installed. USE_SUDO is a sudo/no-sudo flag (empty when sudo is
    # absent), so `$USE_SUDO -u` could emit a bare `-u`. runuser (util-linux, always
    # present on Debian/Ubuntu/Kali) drops privileges when we are root.
    local -a as_user
    if [ "$(id -u)" -eq 0 ]; then
        if command -v runuser >/dev/null 2>&1; then as_user=(runuser -u "$user" --)
        elif command -v sudo >/dev/null 2>&1;     then as_user=(sudo -u "$user")
        else as_user=(env); fi
    elif command -v sudo >/dev/null 2>&1; then
        as_user=(sudo -u "$user")
    else
        as_user=(env)
    fi

    if [ -n "$uid" ] && [ -S "$bus" ]; then
        if "${as_user[@]}" env HOME="$home" XDG_RUNTIME_DIR="/run/user/$uid" \
                DBUS_SESSION_BUS_ADDRESS="unix:path=$bus" DISPLAY="${DISPLAY:-:0}" \
                "$@" 2>/dev/null; then
            return 0
        fi
    fi
    if command -v dbus-run-session >/dev/null 2>&1; then
        "${as_user[@]}" env HOME="$home" XDG_CONFIG_HOME="$home/.config" \
            dbus-run-session -- "$@" 2>/dev/null && return 0
    fi
    return 1
}

# gset <user> <schema> <key> <value> : set one gsettings key as the user.
gset() { run_user_session "$1" gsettings set "$2" "$3" "$4"; }

# xfce_run_xfconf <user> <xfconf-query args...> : set one xfconf key as the user.
xfce_run_xfconf() { local u="$1"; shift; run_user_session "$u" xfconf-query "$@"; }

# Neutralize a system autostart entry for one user with a per-user Hidden=true
# XDG override (freedesktop autostart spec: a user file shadows the system one).
# Idempotent and reversible; a no-op when $user is empty.
disable_user_autostart() {
    local user="$1" desktop_file="$2" home override_dir override
    [ -n "$user" ] || return 0
    home="$(getent passwd "$user" 2>/dev/null | cut -d: -f6)"
    [ -n "$home" ] && [ -d "$home" ] || return 0
    override_dir="$home/.config/autostart"
    override="$override_dir/$desktop_file"
    $USE_SUDO mkdir -p "$override_dir" 2>/dev/null || true
    printf '[Desktop Entry]\nType=Application\nName=%s\nHidden=true\nX-GNOME-Autostart-enabled=false\n' \
        "${desktop_file%.desktop}" | $USE_SUDO tee "$override" >/dev/null 2>&1 || true
    # chown ~/.config too: `mkdir -p` as root would otherwise leave a freshly
    # created ~/.config root-owned, breaking the user's first GUI login.
    $USE_SUDO chown "$user:$user" "$home/.config" "$override_dir" "$override" 2>/dev/null || true
    return 0
}

# light-locker conflicts with the screensaver lockers and is the usual cause of
# the Kali "auto-lock despite settings" bug (Kali bug tracker #9060). Stop it and
# disable its autostart. Idempotent; a no-op when light-locker is absent.
disable_light_locker() {
    local user="$1"
    if ! command -v light-locker >/dev/null 2>&1 \
        && [ ! -f /etc/xdg/autostart/light-locker.desktop ]; then
        return 0
    fi
    info "Disabling light-locker (conflicts with screensaver lockers)..."
    $USE_SUDO pkill -x light-locker 2>/dev/null || true
    disable_user_autostart "$user" "light-locker.desktop"
    [ -n "$user" ] && log "Neutralized light-locker autostart for $user (Hidden override)"
    info "If lock still occurs, fully remove it: $USE_SUDO apt-get remove -y light-locker"
    return 0
}

# Generic xscreensaver disabler (LXDE/LXQt/standalone): stop it, set ~/.xscreensaver
# to mode off, and neutralize its autostart. No-op when xscreensaver is absent.
disable_xscreensaver() {
    local user="$1" home
    if ! command -v xscreensaver >/dev/null 2>&1 \
        && [ ! -f /etc/xdg/autostart/xscreensaver.desktop ]; then
        return 0
    fi
    info "Disabling xscreensaver..."
    $USE_SUDO pkill -x xscreensaver 2>/dev/null || true
    disable_user_autostart "$user" "xscreensaver.desktop"
    if [ -n "$user" ]; then
        home="$(getent passwd "$user" 2>/dev/null | cut -d: -f6)"
        if [ -n "$home" ] && [ -d "$home" ]; then
            printf 'mode: off\n' | $USE_SUDO tee "$home/.xscreensaver" >/dev/null 2>&1 || true
            $USE_SUDO chown "$user:$user" "$home/.xscreensaver" 2>/dev/null || true
        fi
    fi
    return 0
}

# Generic X11 DPMS/blank disable for the user's live session (no-op headless).
disable_x11_blanking() {
    local user="$1"
    command -v xset >/dev/null 2>&1 || return 0
    run_user_session "$user" xset s off       2>/dev/null || true
    run_user_session "$user" xset s noblank   2>/dev/null || true
    run_user_session "$user" xset -dpms       2>/dev/null || true
    return 0
}

# XFCE (Kali's default desktop): disable the screensaver, screen lock, display
# blanking/DPMS and lock-on-suspend via the xfce4-screensaver and
# xfce4-power-manager xfconf channels, then neutralize light-locker/xscreensaver.
# Works on a live session (immediate) and during a root install (persists to XML).
configure_xfce_desktop() {
    local user k
    log "Configuring XFCE desktop: disabling screen lock, screensaver and blanking..."
    user="$(resolve_desktop_user "xfce4-session")"
    if [ -z "$user" ]; then
        warning "Could not determine XFCE desktop user; skipping XFCE configuration"
        return 0
    fi
    info "Configuring XFCE for user: $user"
    if command -v xfconf-query >/dev/null 2>&1; then
        xfce_run_xfconf "$user" -c xfce4-screensaver -p /saver/enabled -n -t bool -s false || true
        xfce_run_xfconf "$user" -c xfce4-screensaver -p /saver/idle-activation/enabled -n -t bool -s false || true
        xfce_run_xfconf "$user" -c xfce4-screensaver -p /lock/enabled -n -t bool -s false || true
        xfce_run_xfconf "$user" -c xfce4-screensaver -p /lock/saver-activation/enabled -n -t bool -s false || true
        xfce_run_xfconf "$user" -c xfce4-power-manager -p /xfce4-power-manager/dpms-enabled -n -t bool -s false || true
        for k in dpms-on-ac-off dpms-on-ac-sleep dpms-on-battery-off dpms-on-battery-sleep blank-on-ac blank-on-battery; do
            xfce_run_xfconf "$user" -c xfce4-power-manager -p "/xfce4-power-manager/$k" -n -t int -s 0 || true
        done
        xfce_run_xfconf "$user" -c xfce4-power-manager -p /xfce4-power-manager/lock-screen-suspend-hibernate -n -t bool -s false || true
    else
        info "xfconf-query not found; relying on light-locker/xscreensaver/x11 disable only."
    fi
    disable_light_locker "$user"
    disable_xscreensaver "$user"
    disable_x11_blanking "$user"
    log "XFCE desktop configuration completed"
    return 0
}

# MATE: disable the screensaver lock + idle activation and all power-manager
# display/computer sleep via the org.mate.* gsettings schemas.
configure_mate_desktop() {
    local user
    log "Configuring MATE desktop: disabling screen lock, screensaver and blanking..."
    user="$(resolve_desktop_user "mate-session")"
    if [ -z "$user" ]; then
        warning "Could not determine MATE desktop user; skipping MATE configuration"
        return 0
    fi
    info "Configuring MATE for user: $user"
    gset "$user" org.mate.screensaver lock-enabled false || true
    gset "$user" org.mate.screensaver idle-activation-enabled false || true
    gset "$user" org.mate.session idle-delay 0 || true
    gset "$user" org.mate.power-manager sleep-display-ac 0 || true
    gset "$user" org.mate.power-manager sleep-display-battery 0 || true
    gset "$user" org.mate.power-manager sleep-computer-ac 0 || true
    gset "$user" org.mate.power-manager sleep-computer-battery 0 || true
    gset "$user" org.mate.power-manager idle-dim-ac false || true
    disable_light_locker "$user"
    disable_xscreensaver "$user"
    disable_x11_blanking "$user"
    log "MATE desktop configuration completed"
    return 0
}

# Cinnamon: disable the screensaver lock + idle activation and the
# settings-daemon power sleep via the org.cinnamon.* gsettings schemas.
configure_cinnamon_desktop() {
    local user
    log "Configuring Cinnamon desktop: disabling screen lock, screensaver and blanking..."
    user="$(resolve_desktop_user "cinnamon-session")"
    if [ -z "$user" ]; then
        warning "Could not determine Cinnamon desktop user; skipping Cinnamon configuration"
        return 0
    fi
    info "Configuring Cinnamon for user: $user"
    gset "$user" org.cinnamon.desktop.screensaver lock-enabled false || true
    gset "$user" org.cinnamon.desktop.screensaver idle-activation-enabled false || true
    gset "$user" org.cinnamon.desktop.session idle-delay 0 || true
    gset "$user" org.cinnamon.settings-daemon.plugins.power sleep-inactive-ac-type nothing || true
    gset "$user" org.cinnamon.settings-daemon.plugins.power sleep-inactive-battery-type nothing || true
    gset "$user" org.cinnamon.settings-daemon.plugins.power sleep-inactive-ac-timeout 0 || true
    gset "$user" org.cinnamon.settings-daemon.plugins.power sleep-inactive-battery-timeout 0 || true
    gset "$user" org.cinnamon.settings-daemon.plugins.power idle-dim false || true
    disable_light_locker "$user"
    disable_xscreensaver "$user"
    disable_x11_blanking "$user"
    log "Cinnamon desktop configuration completed"
    return 0
}

# LXQt / LXDE: lightweight DEs with no gsettings power schema -- they rely on
# xscreensaver/light-locker + X11 DPMS. LXQt additionally has an idleness watcher
# in lxqt-powermanagement.conf; turn it off. $1 = label, $2 = session proc name.
configure_lxqt_lxde_desktop() {
    local label="$1" session_proc="$2" user home conf
    log "Configuring $label desktop: disabling screen lock, screensaver and blanking..."
    user="$(resolve_desktop_user "$session_proc")"
    if [ -z "$user" ]; then
        warning "Could not determine $label desktop user; skipping $label configuration"
        return 0
    fi
    info "Configuring $label for user: $user"
    disable_light_locker "$user"
    disable_xscreensaver "$user"
    disable_x11_blanking "$user"
    if [ "$label" = "LXQt" ]; then
        home="$(getent passwd "$user" 2>/dev/null | cut -d: -f6)"
        if [ -n "$home" ] && [ -d "$home" ]; then
            conf="$home/.config/lxqt/lxqt-powermanagement.conf"
            $USE_SUDO -u "$user" mkdir -p "$home/.config/lxqt" 2>/dev/null \
                || $USE_SUDO mkdir -p "$home/.config/lxqt" 2>/dev/null || true
            printf '[Idleness]\nidlenessWatcher=false\nidlenessBacklightWatcher=false\n' \
                | $USE_SUDO tee "$conf" >/dev/null 2>&1 || true
            $USE_SUDO chown "$user:$user" "$conf" 2>/dev/null || true
        fi
    fi
    log "$label desktop configuration completed"
    return 0
}

configure_desktop_system() {
    # Check if desktop environment is detected
    if [ "${HAS_DESKTOP_ENVIRONMENT:-false}" != "true" ]; then
        info "No desktop environment detected, skipping desktop system configuration"
        return 0
    fi
    
    log "Desktop environment detected: ${DESKTOP_ENVIRONMENT:-unknown}"
    
    # Detect desktop type
    local desktop_type=$(detect_desktop_type)
    
    if [ -z "$desktop_type" ]; then
        info "Could not determine desktop type, skipping desktop configuration"
        return 0
    fi
    
    info "Detected desktop type: $desktop_type"
    
    # GNOME-family DEs (budgie/unity/pantheon) share the org.gnome.* gsettings
    # schemas, so they reuse configure_gnome_desktop. Each call is guarded with
    # `|| true` so a per-DE failure never aborts the whole base setup (set -e).
    local generic_user=""
    case "$desktop_type" in
        gnome|budgie|unity|pantheon)
            configure_gnome_desktop || true
            ;;
        kde)
            configure_kde_desktop || true
            ;;
        xfce)
            configure_xfce_desktop || true
            ;;
        mate)
            configure_mate_desktop || true
            ;;
        cinnamon)
            configure_cinnamon_desktop || true
            ;;
        lxqt)
            configure_lxqt_lxde_desktop "LXQt" "lxqt-session" || true
            ;;
        lxde)
            configure_lxqt_lxde_desktop "LXDE" "lxsession" || true
            ;;
        deepin|*)
            # Deepin (and any unrecognized DE): only the generic light-locker /
            # xscreensaver / X11-DPMS disable is applied. Deepin's native lock keys
            # live under com.deepin.dde.* OR org.deepin.dde.* depending on DDE version,
            # so they are intentionally not set here (the generic pass still stops most
            # blanking/locking). Add a dedicated deepin) case if full DDE support is needed.
            info "Desktop '$desktop_type': applying generic screensaver/blank disable"
            generic_user="$(resolve_desktop_user "")"
            disable_light_locker "$generic_user" || true
            disable_xscreensaver "$generic_user" || true
            disable_x11_blanking "$generic_user" || true
            ;;
    esac

    return 0
}

# =============================================================================
# Desktop Power Policy (merged from former 4_set_desktop_power.sh)
# Keep a graphical desktop fully awake: never suspend/hibernate, never blank or
# power off the display, never spin down disks. DE-agnostic system-level pieces
# (systemd + logind + hdparm) complement the per-DE screen-lock config above.
# All steps are idempotent and guarded for `set -e`.
# References (official / canonical):
#   - systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
#   - systemd-logind: IdleAction=ignore, HandleLidSwitch=ignore (logind.conf.d drop-in)
#   - GNOME defaults via the dconf system db (/etc/dconf/db/local.d)
# =============================================================================

# Robust desktop detection: gvar_common's HAS_DESKTOP_ENVIRONMENT relies on
# session env vars that are often absent during a root install, so OR it with
# on-disk evidence. Returns 0 when this is a graphical desktop.
power_is_desktop_system() {
    if [ "${HAS_DESKTOP_ENVIRONMENT:-false}" = "true" ]; then
        return 0
    fi
    if command -v gnome-shell >/dev/null 2>&1 \
        || command -v plasmashell >/dev/null 2>&1 \
        || command -v xfce4-session >/dev/null 2>&1 \
        || command -v mate-session >/dev/null 2>&1 \
        || command -v cinnamon-session >/dev/null 2>&1; then
        return 0
    fi
    if [ -d /usr/share/xsessions ] && ls -A /usr/share/xsessions 2>/dev/null | grep -q .; then
        return 0
    fi
    if [ -d /usr/share/wayland-sessions ] && ls -A /usr/share/wayland-sessions 2>/dev/null | grep -q .; then
        return 0
    fi
    if command -v systemctl >/dev/null 2>&1 \
        && [ "$(systemctl get-default 2>/dev/null || true)" = "graphical.target" ] \
        && [ -e /etc/systemd/system/display-manager.service ]; then
        return 0
    fi
    return 1
}

# systemd: never auto-suspend / hibernate (DE-agnostic).
power_disable_systemd_sleep() {
    local sleep_targets="sleep.target suspend.target hibernate.target hybrid-sleep.target"
    local logind_dropin_dir="/etc/systemd/logind.conf.d"
    local logind_dropin_file="/etc/systemd/logind.conf.d/10-core-node-no-sleep.conf"
    local already_masked="true"
    local t=""
    local desired=""

    info "Masking systemd sleep targets..."
    for t in $sleep_targets; do
        if [ "$(systemctl is-enabled "$t" 2>/dev/null || true)" != "masked" ]; then
            already_masked="false"
        fi
    done
    if [ "$already_masked" = "true" ]; then
        info "Sleep targets already masked, skipping."
    else
        $USE_SUDO systemctl mask $sleep_targets 2>/dev/null || true
        log "Masked: $sleep_targets"
    fi

    info "Configuring systemd-logind to ignore idle/lid..."
    $USE_SUDO mkdir -p "$logind_dropin_dir" 2>/dev/null || true
    desired="$(cat <<'EOF'
# Managed by core_node 2_setting_base.sh -- keep desktop awake.
[Login]
IdleAction=ignore
IdleActionSec=0
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
HandleSuspendKey=ignore
HandleHibernateKey=ignore
EOF
)"
    if [ -f "$logind_dropin_file" ] && [ "$(cat "$logind_dropin_file" 2>/dev/null || true)" = "$desired" ]; then
        info "logind drop-in already up to date, skipping."
    else
        echo "$desired" | $USE_SUDO tee "$logind_dropin_file" >/dev/null 2>&1 || true
        log "Wrote $logind_dropin_file"
        # Reloading logind can drop the active graphical session; only re-exec
        # when no session is currently logged in (safe during install).
        if ! who 2>/dev/null | grep -q .; then
            $USE_SUDO systemctl kill -s HUP systemd-logind 2>/dev/null || true
        fi
    fi
}

# GNOME / MATE / Cinnamon (the gsettings+dconf family): never blank the display,
# never sleep, no screensaver lock -- applied system-wide via the dconf "local"
# system database (covers every user, works during a no-session root install).
power_disable_gnome_blanking() {
    local dconf_profile="/etc/dconf/profile/user"
    local dconf_db_dir="/etc/dconf/db/local.d"
    local dconf_db_file="/etc/dconf/db/local.d/00-core-node-power"
    local dconf_locks_dir="/etc/dconf/db/local.d/locks"
    local dconf_locks_file="/etc/dconf/db/local.d/locks/core-node-power"
    local db_desired=""
    local locks_desired=""
    local changed="false"

    if ! command -v dconf >/dev/null 2>&1; then
        info "dconf not installed; skipping system-wide GNOME defaults."
        return 0
    fi
    info "Writing system-wide GNOME/MATE/Cinnamon power defaults via dconf..."
    $USE_SUDO mkdir -p "$dconf_db_dir" "$dconf_locks_dir" "$(dirname "$dconf_profile")" 2>/dev/null || true

    if [ ! -f "$dconf_profile" ] || ! grep -q "^system-db:local" "$dconf_profile" 2>/dev/null; then
        printf 'user-db:user\nsystem-db:local\n' | $USE_SUDO tee "$dconf_profile" >/dev/null 2>&1 || true
        info "Configured $dconf_profile"
    fi

    # The dconf "local" system-db applies to ALL gsettings clients, so the same
    # file covers GNOME, MATE, Cinnamon and Budgie. Keys for an absent schema are
    # simply ignored by dconf (no validation), so listing all three is safe.
    db_desired="$(cat <<'EOF'
# Managed by core_node 2_setting_base.sh -- desktop stays awake.
[org/gnome/settings-daemon/plugins/power]
sleep-inactive-ac-type='nothing'
sleep-inactive-battery-type='nothing'
sleep-inactive-ac-timeout=uint32 0
sleep-inactive-battery-timeout=uint32 0
idle-dim=false

[org/gnome/desktop/session]
idle-delay=uint32 0

[org/gnome/desktop/screensaver]
idle-activation-enabled=false
lock-enabled=false

[org/mate/screensaver]
idle-activation-enabled=false
lock-enabled=false

[org/mate/session]
idle-delay=0

[org/mate/power-manager]
sleep-display-ac=0
sleep-display-battery=0
sleep-computer-ac=0
sleep-computer-battery=0
idle-dim-ac=false

[org/cinnamon/desktop/screensaver]
idle-activation-enabled=false
lock-enabled=false

[org/cinnamon/desktop/session]
idle-delay=uint32 0

[org/cinnamon/settings-daemon/plugins/power]
sleep-inactive-ac-type='nothing'
sleep-inactive-battery-type='nothing'
sleep-inactive-ac-timeout=uint32 0
sleep-inactive-battery-timeout=uint32 0
idle-dim=false
EOF
)"
    locks_desired="$(cat <<'EOF'
/org/gnome/settings-daemon/plugins/power/sleep-inactive-ac-type
/org/gnome/settings-daemon/plugins/power/sleep-inactive-battery-type
/org/gnome/desktop/session/idle-delay
/org/gnome/desktop/screensaver/idle-activation-enabled
/org/gnome/desktop/screensaver/lock-enabled
/org/mate/screensaver/idle-activation-enabled
/org/mate/screensaver/lock-enabled
/org/mate/session/idle-delay
/org/cinnamon/desktop/screensaver/idle-activation-enabled
/org/cinnamon/desktop/screensaver/lock-enabled
/org/cinnamon/desktop/session/idle-delay
EOF
)"

    if [ ! -f "$dconf_db_file" ] || [ "$(cat "$dconf_db_file" 2>/dev/null || true)" != "$db_desired" ]; then
        echo "$db_desired" | $USE_SUDO tee "$dconf_db_file" >/dev/null 2>&1 || true
        changed="true"
    fi
    if [ ! -f "$dconf_locks_file" ] || [ "$(cat "$dconf_locks_file" 2>/dev/null || true)" != "$locks_desired" ]; then
        echo "$locks_desired" | $USE_SUDO tee "$dconf_locks_file" >/dev/null 2>&1 || true
        changed="true"
    fi

    if [ "$changed" = "true" ]; then
        $USE_SUDO dconf update 2>/dev/null || true
        log "Updated dconf system database."
    else
        info "dconf desktop power defaults already in place, skipping."
    fi
}

# Disks: keep fixed (non-removable) ATA/SATA disks spinning; persist in
# /etc/hdparm.conf. USB/removable disks are skipped.
power_disable_disk_spindown() {
    local hdparm_conf="/etc/hdparm.conf"
    local marker="# core_node: keep disk spinning"
    local disk="" dev="" rm=""
    local persisted_any="false"

    if ! command -v hdparm >/dev/null 2>&1; then
        info "hdparm not installed; skipping disk spindown control."
        return 0
    fi
    for disk in /sys/block/sd*; do
        [ -e "$disk" ] || continue
        dev="/dev/$(basename "$disk")"
        rm="$(cat "$disk/removable" 2>/dev/null || echo 0)"
        if [ "$rm" = "1" ]; then
            continue
        fi
        info "Disabling standby/spindown on $dev (-S 0, -B 254)..."
        $USE_SUDO hdparm -S 0 "$dev" >/dev/null 2>&1 || true
        $USE_SUDO hdparm -B 254 "$dev" >/dev/null 2>&1 || true
        if ! grep -q "^${dev} {" "$hdparm_conf" 2>/dev/null && ! grep -Fq "$dev $marker" "$hdparm_conf" 2>/dev/null; then
            {
                echo ""
                echo "$dev $marker"
                echo "$dev {"
                echo "    spindown_time = 0"
                echo "    apm = 254"
                echo "}"
            } | $USE_SUDO tee -a "$hdparm_conf" >/dev/null 2>&1 || true
            persisted_any="true"
        fi
    done
    if [ "$persisted_any" = "true" ]; then
        log "Persisted disk no-spindown settings in $hdparm_conf."
    fi
}

# Orchestrator: apply the keep-awake policy on a graphical desktop (skip on
# headless/server). Uses robust detection so it still runs when a root install
# leaves HAS_DESKTOP_ENVIRONMENT unset.
configure_desktop_power_policy() {
    if ! power_is_desktop_system; then
        info "No graphical desktop detected (headless/server); skipping desktop power policy"
        return 0
    fi
    log "Applying desktop power policy: no suspend, no display blank, no disk spindown"
    power_disable_systemd_sleep
    power_disable_gnome_blanking
    # XFCE (Kali default): the per-DE pass above only runs with a live session;
    # cover the root-install case here too, where on-disk Xfce tools are present
    # but no session is active. Idempotent, so a second pass is harmless.
    if command -v xfce4-session >/dev/null 2>&1 || command -v xfce4-screensaver >/dev/null 2>&1; then
        configure_xfce_desktop || true
    fi
    # Lightweight DEs (LXDE/LXQt) and any stray locker: neutralize light-locker /
    # xscreensaver for the primary user even when no session is active. Both are
    # no-ops when the respective tool is absent.
    local primary_user; primary_user="$(resolve_desktop_user "")"
    disable_light_locker "$primary_user" || true
    disable_xscreensaver "$primary_user" || true
    power_disable_disk_spindown
    log "Desktop power policy applied"
    return 0
}

# =============================================================================
# Sudo + system update/init (merged from former 11_install_sudo.sh / 12_update.sh)
# =============================================================================

# Ensure sudo is installed and the invoking user is in the sudo group (was 11).
ensure_sudo_installed() {
    local current_user distro
    current_user=${USER:-$(whoami)}
    distro=$(lsb_release -is 2>/dev/null || echo "Unknown")
    log "Ensuring sudo is installed for $distro..."

    if [ "$(id -u)" -ne 0 ] && [ -z "$USE_SUDO" ]; then
        error "This step needs root/sudo to install sudo; skipping."
        return 1
    fi

    if command -v sudo >/dev/null 2>&1; then
        info "sudo is already installed."
    else
        info "Installing sudo package..."
        if [ "$(id -u)" -eq 0 ]; then
            apt-get update || true
            apt-get install -y sudo || { error "Failed to install sudo package."; return 1; }
        else
            $USE_SUDO apt-get update || true
            $USE_SUDO apt-get install -y sudo || { error "Failed to install sudo package."; return 1; }
        fi
        log "sudo installed successfully."
    fi

    if ! getent group sudo >/dev/null 2>&1; then
        info "Creating sudo group..."
        if [ "$(id -u)" -eq 0 ]; then groupadd sudo || true; else $USE_SUDO groupadd sudo || true; fi
    fi

    if [ -n "$current_user" ] && [ "$current_user" != "root" ]; then
        if id -nG "$current_user" | grep -qw "sudo"; then
            info "User $current_user is already in the sudo group."
        else
            info "Adding user $current_user to sudo group..."
            if [ "$(id -u)" -eq 0 ]; then
                usermod -aG sudo "$current_user" && info "User $current_user added (re-login for effect)." || warning "Failed to add $current_user to sudo group."
            else
                $USE_SUDO usermod -aG sudo "$current_user" && info "User $current_user added (re-login for effect)." || warning "Failed to add $current_user to sudo group."
            fi
        fi
    else
        info "Running as root user, no need to add to sudo group."
    fi

    log "Sudo installation and configuration completed."
    return 0
}

# Initialize core_node shared directories (was 12).
initialize_core_node_directories() {
    local CORE_NODE_BASE="${CORE_NODE_DATA_DIR}"
    local SHARED_DOWNLOADS="${CORE_NODE_SHARED_DOWNLOADS}"

    echo "Initializing core_node shared directories..."
    echo "[SAFE_PATH] CORE_NODE_BASE=$CORE_NODE_BASE SHARED_DOWNLOADS=$SHARED_DOWNLOADS"
    _safe_dir() {
        local d="$1"
        [ -z "$d" ] && return 1
        [[ "$d" != /* ]] && return 1
        case "$d" in
            /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*) return 1 ;;
            /var) return 1 ;;
            *) return 0 ;;
        esac
    }
    if _safe_dir "$CORE_NODE_BASE" && ensure_owned_tree_777 "$CORE_NODE_BASE"; then
        echo "Created base directory: $CORE_NODE_BASE"
    else
        echo "[SKIP] Refusing chmod on system or invalid path: $CORE_NODE_BASE"
    fi
    if _safe_dir "$SHARED_DOWNLOADS" && ensure_owned_tree_777 "$SHARED_DOWNLOADS"; then
        echo "Created shared downloads directory: $SHARED_DOWNLOADS"
    else
        echo "[SKIP] Refusing chmod on system or invalid path: $SHARED_DOWNLOADS"
    fi
}

# Install essential packages and configure Git (was 12).
install_packages_and_configure_git() {
    echo "Installing essential packages..."
    $USE_SUDO apt install -y lsof cron curl vim git build-essential rsync htop \
        nano wget openssl libssl-dev zlib1g-dev libbz2-dev \
        libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
        xz-utils tk-dev libffi-dev liblzma-dev make software-properties-common \
        cron dnsutils libvips-dev cpulimit expect tar gzip procps || true
    # xdg-utils provides xdg-open (used by pycore to open files/URLs). Idempotent,
    # non-fatal: only installs when xdg-open is missing.
    if ! command -v xdg-open >/dev/null 2>&1; then $USE_SUDO apt-get install -y xdg-utils >/dev/null 2>&1 || true; fi
    git config --global http.sslVerify "false" || true
    git config --global user.name "prop-dev" || true
    git config --global user.email "prop-dev@serve.com" || true
    echo "Essential packages installed."
}

# Fix temporary directory permissions (was 12).
fix_temp_permissions() {
    echo "Fixing temporary directory permissions..."
    $USE_SUDO chmod 1777 /tmp || true
    $USE_SUDO chown root:root /tmp || true
    $USE_SUDO mkdir -p /var/cache/apt/archives/partial || true
    $USE_SUDO mkdir -p /var/lib/apt/lists/partial || true
    $USE_SUDO mkdir -p /var/log/apt || true
    $USE_SUDO chmod 755 /var/cache/apt/archives/partial || true
    $USE_SUDO chmod 755 /var/lib/apt/lists/partial || true
    $USE_SUDO chmod 755 /var/log/apt || true
    $USE_SUDO rm -f /tmp/apt.conf.* 2>/dev/null || true
    $USE_SUDO rm -f /tmp/apt-key.* 2>/dev/null || true
    echo "Temporary directory permissions fixed"
}

# =============================================================================
# Main Function
# =============================================================================

main() {
    # Check if running in WSL environment (skip disk setup in WSL)
    if [ "${IS_WSL:-false}" = "true" ]; then
        log "WSL environment detected - skipping disk setup"
        log "WSL manages disk mounts automatically via /mnt/c, /mnt/d, etc."
        # Don't exit, just return from main function
        # The calling script (dd.sh) will continue execution
        return 0
    fi

    log "Starting base system setup..."

    # Step 0: ensure sudo is installed (merged from former 11_install_sudo.sh).
    ensure_sudo_installed || warning "sudo setup incomplete (continuing base setup)"
    # gvar_common sets USE_SUDO once at source time (only if the sudo binary then
    # existed). If ensure_sudo_installed just installed it, refresh USE_SUDO now so
    # every later `$USE_SUDO -u <user>` resolves to `sudo -u <user>` instead of a
    # bare `-u` (command not found) -- which would silently skip all per-user
    # desktop config on a root install that started without sudo.
    command -v sudo >/dev/null 2>&1 && USE_SUDO="sudo"

    # Authenticate sudo once up front and keep the ticket warm, so the many later
    # `sudo`/`sudo -u` calls don't each re-prompt when running as a non-root user.
    start_sudo_keepalive

    # Step 0b: system update + initialization (merged from former 12_update.sh).
    # Run with `set +e` so a failing apt/git/repo step never aborts the base setup.
    log "System update and initialization (merged from former 12_update.sh)..."
    set +e
    initialize_core_node_directories
    fix_temp_permissions
    # Ensure the distro archive signing key is present BEFORE any apt update so a
    # rotated/missing key (e.g. Kali's sqv "Missing key ..." breakage) cannot abort
    # the base setup. Idempotent; runs before repair so repair's apt update succeeds.
    if command -v ensure_distro_archive_keyring_from_apt_repository_manager >/dev/null 2>&1; then
        ensure_distro_archive_keyring_from_apt_repository_manager
    fi
    if command -v repair_repositories_from_apt_repository_manager >/dev/null 2>&1; then
        echo "=== Repository Repair and Verification ==="
        repair_repositories_from_apt_repository_manager
        verify_repository_health_from_apt_repository_manager
    fi
    if command -v manage_repositories_from_apt_repository_manager >/dev/null 2>&1; then
        manage_repositories_from_apt_repository_manager
    fi
    $USE_SUDO apt update 2>/dev/null || $USE_SUDO apt update --allow-unauthenticated 2>/dev/null || true
    install_packages_and_configure_git
    $USE_SUDO sysctl fs.inotify.max_user_watches=524288 2>/dev/null || true
    $USE_SUDO sysctl -p 2>/dev/null || true
    $USE_SUDO rm -rf /tmp/apt.* /tmp/apt-key.* 2>/dev/null || true
    set -e

    # Step 1: Disk detection and mount management
    log "Step 1: Disk detection and mount management"
    echo ""

    local ntfs_disks=$(detect_ntfs_disks)
    local has_ntfs=$?

    if [ $has_ntfs -eq 0 ]; then
        log "Processing NTFS disks..."

        for device in $ntfs_disks; do
            handle_ntfs_disk "$device"
            echo ""
        done
    fi

    local data_disks=$(detect_data_disks)
    local has_data=$?

    if [ $has_data -eq 0 ]; then
        log "Processing data disks..."

        for device in $data_disks; do
            handle_data_disk "$device"
            echo ""
        done
    fi

    if command -v systemctl >/dev/null 2>&1; then
        # Guard: in a chroot/container/WSL where systemctl exists but systemd is not
        # PID 1, daemon-reload exits non-zero ("Failed to connect to bus") and would
        # abort the run under set -e before the remaining steps.
        $USE_SUDO systemctl daemon-reload 2>/dev/null || true
    fi

    log "Disk setup completed!"

    # Persist base data directory so project and all scripts use the same path (center)
    if command -v persist_base_data_directory >/dev/null 2>&1; then
        persist_base_data_directory "$(get_base_data_directory)"
    fi

    echo ""
    log "Current mount points:"
    df -h | grep -E "^/dev/(sd|nvme|vd)" | awk '{printf "  %-20s %-15s %-10s %s\n", $1, $6, $3, $5}'

    # Step 2: Mail service control
    echo ""
    log "Step 2: Mail service control"
    stop_mail_services

    # Step 3: Desktop system optimization (if desktop environment detected)
    echo ""
    log "Step 3: Desktop system optimization"
    configure_desktop_system
    # Keep the desktop fully awake (merged from former 4_set_desktop_power.sh):
    # no suspend/hibernate, no display blank, no disk spindown.
    configure_desktop_power_policy

    log "Base system setup completed!"

    # Mark disk setup as completed
    if [ -n "$GLOBAL_VAR_DIR" ]; then
        echo "[2] echo \"\$(date +%Y%m%d_%H%M%S)\" | $USE_SUDO tee $GLOBAL_VAR_DIR/DISK_SETUP_COMPLETED"
        echo "$(date +%Y%m%d_%H%M%S)" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DISK_SETUP_COMPLETED" >/dev/null
        log "Disk setup completion flag saved"
    fi
}

main
