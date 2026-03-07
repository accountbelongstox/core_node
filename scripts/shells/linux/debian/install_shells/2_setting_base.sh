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
# Mount library: single fstab entry per UUID, real-time remount
source "$PARENT_DIR_LEVEL_2/common/mount_common.sh"
MOUNT_LOG_PREFIX="[2]"

# Default mount base directory
DEFAULT_MOUNT_BASE="/mnt"

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
    # Convert /dev/sdb3 to dev_sdb3
    local mount_name=$(echo "$device" | sed 's|/dev/|dev_|g')
    echo "$DEFAULT_MOUNT_BASE/$mount_name"
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
    if mount | grep -q "^$device "; then
        return 0
    else
        return 1
    fi
}

get_mount_point() {
    local device="$1"
    mount | grep "^$device " | awk '{print $3}'
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
        mount_options="defaults,nofail,x-systemd.device-timeout=10,uid=1000,gid=1000,umask=0022"
    else
        mount_options="defaults,nofail,x-systemd.device-timeout=10"
    fi

    local uuid=$($USE_SUDO blkid -s UUID -o value "$device")

    update_fstab "$uuid" "$mount_point" "$fstype" "$mount_options"

    echo "[2] $USE_SUDO mount $mount_point"
    if $USE_SUDO mount "$mount_point" 2>/dev/null; then
        log "Successfully mounted $device to $mount_point"
        echo "[2] $USE_SUDO chmod 755 $mount_point"
        $USE_SUDO chmod 755 "$mount_point"
        return 0
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

    read -r confirm

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

    # Update fstab (single entry per UUID, no duplicates)
    local mount_options="defaults,nofail,x-systemd.device-timeout=10,uid=1000,gid=1000,umask=0022"
    mount_fstab_ensure_single_entry "$uuid" "$mount_point" "$fstype" "$mount_options"
    log "Added fstab entry: UUID=$uuid $mount_point $fstype $mount_options 0 2"

    # Real-time mount: not mounted -> mount at target; mounted elsewhere -> remount to target
    if [ "$is_mounted" = false ]; then
        echo "[2] $USE_SUDO mount -t $fstype -o $mount_options $device $mount_point"
        if $USE_SUDO mount -t "$fstype" -o "$mount_options" "$device" "$mount_point" 2>/dev/null; then
            log "Successfully mounted $device to $mount_point"
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
        if mount_remount_to_target "$device" "$current_mount" "$mount_point" "$fstype" "$mount_options"; then
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
        read -r confirm

        if [[ "$confirm" =~ ^[Nn]$ ]]; then
            info "Skipped fixing data disk configuration"
            return 0
        fi
    else
        echo ""
        echo -n "Do you want to mount this data disk? (y/N): "
        read -r mount_data

        if [[ ! "$mount_data" =~ ^[Yy]$ ]]; then
            info "Skipped mounting data disk"
            return 0
        fi

        echo -n "Proceed to configure fstab? (Y/n): "
        read -r confirm

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

detect_desktop_type() {
    local desktop_type=""
    
    # Check for GNOME
    if pgrep -x "gnome-session" >/dev/null 2>&1 || [ "$XDG_CURRENT_DESKTOP" = "GNOME" ] || [ "$DESKTOP_SESSION" = "gnome" ]; then
        desktop_type="gnome"
    # Check for KDE
    elif pgrep -x "kde-session" >/dev/null 2>&1 || [ "$XDG_CURRENT_DESKTOP" = "KDE" ] || [ "$DESKTOP_SESSION" = "kde-plasma" ]; then
        desktop_type="kde"
    # Check for XFCE
    elif pgrep -x "xfce4-session" >/dev/null 2>&1 || [ "$XDG_CURRENT_DESKTOP" = "XFCE" ] || [ "$DESKTOP_SESSION" = "xfce" ]; then
        desktop_type="xfce"
    # Check for MATE
    elif pgrep -x "mate-session" >/dev/null 2>&1 || [ "$XDG_CURRENT_DESKTOP" = "MATE" ] || [ "$DESKTOP_SESSION" = "mate" ]; then
        desktop_type="mate"
    # Check for Cinnamon
    elif pgrep -x "cinnamon-session" >/dev/null 2>&1 || [ "$XDG_CURRENT_DESKTOP" = "X-Cinnamon" ] || [ "$DESKTOP_SESSION" = "cinnamon" ]; then
        desktop_type="cinnamon"
    fi
    
    echo "$desktop_type"
}

configure_gnome_desktop() {
    log "Configuring GNOME desktop for high performance..."
    
    # Detect desktop user
    local desktop_user=""
    if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
        desktop_user="$SUDO_USER"
    else
        # Try to find desktop user
        for user_home in /home/*; do
            if [ -d "$user_home" ]; then
                local user_name=$(basename "$user_home")
                if pgrep -u "$user_name" -x "gnome-session" >/dev/null 2>&1; then
                    desktop_user="$user_name"
                    break
                fi
            fi
        done
    fi
    
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
    
    # Detect desktop user
    local desktop_user=""
    if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
        desktop_user="$SUDO_USER"
    else
        # Try to find desktop user
        for user_home in /home/*; do
            if [ -d "$user_home" ]; then
                local user_name=$(basename "$user_home")
                if pgrep -u "$user_name" -x "kde-session" >/dev/null 2>&1; then
                    desktop_user="$user_name"
                    break
                fi
            fi
        done
    fi
    
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
    
    # Create or update kscreensaverrc
    if [ -f "$screensaver_config" ]; then
        $USE_SUDO -u "$desktop_user" sed -i '/\[ScreenSaver\]/,/^\[/ {
            /Enabled=/d
            /Lock=/d
            /Timeout=/d
        }' "$screensaver_config" 2>/dev/null || true
    fi
    
    # Add screen saver configuration
    if ! grep -q "\[ScreenSaver\]" "$screensaver_config" 2>/dev/null; then
        $USE_SUDO -u "$desktop_user" bash -c "echo '[ScreenSaver]' >> '$screensaver_config'" 2>/dev/null || true
    fi
    
    $USE_SUDO -u "$desktop_user" bash -c "grep -q '^Enabled=' '$screensaver_config' 2>/dev/null || echo 'Enabled=false' >> '$screensaver_config'" 2>/dev/null || true
    $USE_SUDO -u "$desktop_user" bash -c "grep -q '^Lock=' '$screensaver_config' 2>/dev/null || echo 'Lock=false' >> '$screensaver_config'" 2>/dev/null || true
    $USE_SUDO -u "$desktop_user" bash -c "grep -q '^Timeout=' '$screensaver_config' 2>/dev/null || echo 'Timeout=36000060' >> '$screensaver_config'" 2>/dev/null || true
    
    # Update existing values if they exist
    $USE_SUDO -u "$desktop_user" sed -i 's/^Enabled=.*/Enabled=false/' "$screensaver_config" 2>/dev/null || true
    $USE_SUDO -u "$desktop_user" sed -i 's/^Lock=.*/Lock=false/' "$screensaver_config" 2>/dev/null || true
    $USE_SUDO -u "$desktop_user" sed -i 's/^Timeout=.*/Timeout=36000060/' "$screensaver_config" 2>/dev/null || true
    
    # Set ownership
    echo "[2] $USE_SUDO chown $desktop_user:$desktop_user $screensaver_config"
    $USE_SUDO chown "$desktop_user:$desktop_user" "$screensaver_config" 2>/dev/null || true
    
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
    
    case "$desktop_type" in
        gnome)
            configure_gnome_desktop
            ;;
        kde)
            configure_kde_desktop
            ;;
        xfce|mate|cinnamon)
            info "Desktop type $desktop_type detected but configuration not yet implemented"
            info "You may need to configure power management and screen lock manually"
            ;;
        *)
            info "Unknown desktop type: $desktop_type"
            ;;
    esac
    
    return 0
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
        $USE_SUDO systemctl daemon-reload
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

    log "Base system setup completed!"

    # Mark disk setup as completed
    if [ -n "$GLOBAL_VAR_DIR" ]; then
        echo "[2] echo \"\$(date +%Y%m%d_%H%M%S)\" | $USE_SUDO tee $GLOBAL_VAR_DIR/DISK_SETUP_COMPLETED"
        echo "$(date +%Y%m%d_%H%M%S)" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DISK_SETUP_COMPLETED" >/dev/null
        log "Disk setup completion flag saved"
    fi
}

main
