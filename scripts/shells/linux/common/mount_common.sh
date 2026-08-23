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
    local existing_count
    if [ -z "$uuid" ] || [ -z "$mount_point" ] || [ -z "$fstype" ]; then
        return 1
    fi
    entry="UUID=$uuid $mount_point $fstype ${options:-defaults} 0 2"

    # Idempotent fast-path: when the EXACT entry is already present and it is the
    # ONLY line for this UUID, nothing changes -- skip the backup + rewrite so a
    # repeated run does not accumulate fstab backups or churn /etc/fstab.
    existing_count="$(grep -c "UUID=$uuid" /etc/fstab 2>/dev/null || true)"
    [ -n "$existing_count" ] || existing_count=0
    if [ "$existing_count" = "1" ] && grep -Fxq "$entry" /etc/fstab 2>/dev/null; then
        echo "$MOUNT_LOG_PREFIX fstab entry already correct for UUID=$uuid; skipping."
        return 0
    fi

    # A change is needed: keep a SINGLE rolling backup (overwritten) rather than a
    # new timestamped file on every call, then ensure exactly one entry for this UUID.
    echo "$MOUNT_LOG_PREFIX $MOUNT_USE_SUDO cp /etc/fstab /etc/fstab.core_node.bak"
    $MOUNT_USE_SUDO cp /etc/fstab /etc/fstab.core_node.bak 2>/dev/null || true
    echo "$MOUNT_LOG_PREFIX $MOUNT_USE_SUDO sed -i \"\\|UUID=$uuid|d\" /etc/fstab"
    $MOUNT_USE_SUDO sed -i "\|UUID=$uuid|d" /etc/fstab
    echo "$MOUNT_LOG_PREFIX echo \"\$entry\" | $MOUNT_USE_SUDO tee -a /etc/fstab"
    echo "$entry" | $MOUNT_USE_SUDO tee -a /etc/fstab >/dev/null
    return 0
}

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
