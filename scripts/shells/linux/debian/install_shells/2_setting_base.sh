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
            echo "$mount_point" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_MOUNT_POINT" >/dev/null
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
        $USE_SUDO mkdir -p "$mount_point"
        log "Created mount point: $mount_point"
    fi

    # Update fstab
    local mount_options="defaults,nofail,x-systemd.device-timeout=10,uid=1000,gid=1000,umask=0022"

    $USE_SUDO cp /etc/fstab /etc/fstab.backup.$(date +%Y%m%d_%H%M%S)
    $USE_SUDO sed -i "\|UUID=$uuid|d" /etc/fstab

    local fstab_entry="UUID=$uuid $mount_point $fstype $mount_options 0 2"
    echo "$fstab_entry" | $USE_SUDO tee -a /etc/fstab >/dev/null

    log "Added fstab entry: $fstab_entry"

    # Save to global variables
    if [ -n "$GLOBAL_VAR_DIR" ]; then
        echo "$mount_point" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_MOUNT_POINT" >/dev/null
        echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/NTFS_DEVICE" >/dev/null
    fi

    # Try to mount immediately if not already mounted
    if [ "$is_mounted" = false ]; then
        if $USE_SUDO mount -t "$fstype" -o "$mount_options" "$device" "$mount_point" 2>/dev/null; then
            log "Successfully mounted $device to $mount_point"
            $USE_SUDO chmod 755 "$mount_point"
            return 0
        else
            error "Failed to mount $device to $mount_point"
            warning "The fstab has been updated. Please reboot to apply changes."
            return 1
        fi
    else
        warning "Device is currently mounted at: $current_mount"
        warning "The fstab has been updated to mount at: $mount_point"
        warning "Please reboot the system to apply the new mount point"
        log "After reboot, the device will be mounted at: $mount_point"
        return 0
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
        $USE_SUDO mkdir -p "$mount_point"
        log "Created mount point: $mount_point"
    fi

    # Update fstab
    local mount_options="defaults,nofail,x-systemd.device-timeout=10"

    $USE_SUDO cp /etc/fstab /etc/fstab.backup.$(date +%Y%m%d_%H%M%S)
    $USE_SUDO sed -i "\|UUID=$uuid|d" /etc/fstab

    local fstab_entry="UUID=$uuid $mount_point $fstype $mount_options 0 2"
    echo "$fstab_entry" | $USE_SUDO tee -a /etc/fstab >/dev/null

    log "Added fstab entry: $fstab_entry"

    # Save to global variables
    if [ -n "$GLOBAL_VAR_DIR" ]; then
        echo "$mount_point" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_MOUNT_POINT" >/dev/null
        echo "$device" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DATA_DEVICE" >/dev/null
    fi

    # Try to mount immediately
    if $USE_SUDO mount -t "$fstype" -o "$mount_options" "$device" "$mount_point" 2>/dev/null; then
        log "Data disk successfully mounted"
        $USE_SUDO chmod 755 "$mount_point"
        return 0
    else
        error "Failed to mount data disk"
        warning "The fstab has been updated. Please reboot to apply changes."
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
