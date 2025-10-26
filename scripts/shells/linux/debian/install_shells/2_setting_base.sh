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

# Source gvar_common.sh
if [ -f "$PARENT_DIR_LEVEL_2/common/gvar_common.sh" ]; then
    source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
fi

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

    $USE_SUDO cp /etc/fstab /etc/fstab.backup.$(date +%Y%m%d_%H%M%S)

    $USE_SUDO sed -i "\|UUID=$uuid|d" /etc/fstab

    local fstab_entry="UUID=$uuid $mount_point $fstype $options 0 2"
    echo "$fstab_entry" | $USE_SUDO tee -a /etc/fstab >/dev/null

    log "Added fstab entry: $fstab_entry"
}

mount_disk() {
    local device="$1"
    local mount_point="$2"
    local fstype="$3"

    if [ ! -d "$mount_point" ]; then
        $USE_SUDO mkdir -p "$mount_point"
        log "Created mount point: $mount_point"
    fi

    local mount_options=""
    if [ "$fstype" = "ntfs" ]; then
        if ! command -v ntfs-3g >/dev/null 2>&1; then
            warning "ntfs-3g not installed, installing..."
            $USE_SUDO apt-get update -qq
            $USE_SUDO apt-get install -y ntfs-3g
        fi
        mount_options="defaults,nofail,x-systemd.device-timeout=10,uid=1000,gid=1000,umask=0022"
    else
        mount_options="defaults,nofail,x-systemd.device-timeout=10"
    fi

    local uuid=$($USE_SUDO blkid -s UUID -o value "$device")

    update_fstab "$uuid" "$mount_point" "$fstype" "$mount_options"

    if $USE_SUDO mount "$mount_point" 2>/dev/null; then
        log "Successfully mounted $device to $mount_point"
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

    if is_device_mounted "$device"; then
        local current_mount=$(get_mount_point "$device")
        warning "Device is already mounted at: $current_mount"
        echo ""
        echo -n "Do you want to change the mount point? (y/N): "
        read -r change_mount

        if [[ ! "$change_mount" =~ ^[Yy]$ ]]; then
            info "Keeping current mount point: $current_mount"

            if [ -n "$GLOBAL_VAR_DIR" ]; then
                echo "$current_mount" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_MOUNT_POINT" >/dev/null
                echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_DEVICE" >/dev/null
            fi

            return 0
        fi

        info "Unmounting $device..."
        if ! $USE_SUDO umount "$device" 2>/dev/null; then
            warning "Device is busy, attempting lazy unmount..."
            if $USE_SUDO umount -l "$device" 2>/dev/null; then
                info "Lazy unmount successful"
                sleep 2
            else
                error "Failed to unmount device. Please close any programs using the device and try again."
                return 1
            fi
        fi
    fi

    local suggested_mount=""
    if [ -n "$label" ] && is_label_english "$label"; then
        suggested_mount="$DEFAULT_MOUNT_BASE/$(sanitize_mount_name "$label")"
    else
        if [ -n "$label" ]; then
            warning "Label contains non-English characters: $label"
            local english_label=$(generate_english_label "$label" "$device")
            info "Generated English label: $english_label"
            suggested_mount="$DEFAULT_MOUNT_BASE/$english_label"
        else
            local auto_label=$(generate_english_label "ntfs" "$device")
            suggested_mount="$DEFAULT_MOUNT_BASE/$auto_label"
        fi
    fi

    echo ""
    echo "Suggested mount point: $suggested_mount"
    echo -n "Press Enter to accept, or type a custom mount point: "
    read -r custom_mount

    local final_mount=""
    if [ -n "$custom_mount" ]; then
        if [[ "$custom_mount" != /* ]]; then
            custom_mount="/$custom_mount"
        fi
        final_mount="$custom_mount"
    else
        final_mount="$suggested_mount"
    fi

    echo ""
    echo "Will mount $device to $final_mount"
    echo -n "Proceed? (Y/n): "
    read -r confirm

    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        info "Skipped mounting $device"
        return 0
    fi

    if mount_disk "$device" "$final_mount" "$fstype"; then
        log "NTFS disk successfully mounted"

        if [ -n "$GLOBAL_VAR_DIR" ]; then
            echo "$final_mount" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_MOUNT_POINT" >/dev/null
            echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_DEVICE" >/dev/null
        fi

        return 0
    else
        error "Failed to mount NTFS disk"
        return 1
    fi
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

    if is_device_mounted "$device"; then
        local current_mount=$(get_mount_point "$device")
        info "Device is already mounted at: $current_mount"

        if [ -n "$GLOBAL_VAR_DIR" ]; then
            echo "$current_mount" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_MOUNT_POINT" >/dev/null
            echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_DEVICE" >/dev/null
        fi

        return 0
    fi

    echo ""
    echo -n "Do you want to mount this data disk? (y/N): "
    read -r mount_data

    if [[ ! "$mount_data" =~ ^[Yy]$ ]]; then
        info "Skipped mounting data disk"
        return 0
    fi

    local suggested_mount=""
    if [ -n "$label" ]; then
        suggested_mount="$DEFAULT_MOUNT_BASE/$(sanitize_mount_name "$label")"
    else
        suggested_mount="$DEFAULT_MOUNT_BASE/data_disk"
    fi

    echo ""
    echo "Suggested mount point: $suggested_mount"
    echo -n "Press Enter to accept, or type a custom mount point: "
    read -r custom_mount

    local final_mount=""
    if [ -n "$custom_mount" ]; then
        if [[ "$custom_mount" != /* ]]; then
            custom_mount="/$custom_mount"
        fi
        final_mount="$custom_mount"
    else
        final_mount="$suggested_mount"
    fi

    if mount_disk "$device" "$final_mount" "$fstype"; then
        log "Data disk successfully mounted"

        if [ -n "$GLOBAL_VAR_DIR" ]; then
            echo "$final_mount" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_MOUNT_POINT" >/dev/null
            echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_DEVICE" >/dev/null
        fi

        return 0
    else
        error "Failed to mount data disk"
        return 1
    fi
}

# =============================================================================
# Main Function
# =============================================================================

main() {
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

    echo ""
    log "Current mount points:"
    df -h | grep -E "^/dev/(sd|nvme|vd)" | awk '{printf "  %-20s %-15s %-10s %s\n", $1, $6, $3, $5}'

    # Step 2: Mail service control
    echo ""
    log "Step 2: Mail service control"
    stop_mail_services

    log "Base system setup completed!"

    # Mark disk setup as completed
    if [ -n "$GLOBAL_VAR_DIR" ]; then
        echo "$(date +%Y%m%d_%H%M%S)" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DISK_SETUP_COMPLETED" >/dev/null
        log "Disk setup completion flag saved"
    fi
}

main

exit 0
