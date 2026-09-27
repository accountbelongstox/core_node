#!/bin/bash

# Mount library: fstab single-entry (no duplicate UUID) and real-time remount.
# Caller should set USE_SUDO (e.g. by sourcing gvar_common.sh) or it defaults to sudo.

MOUNT_USE_SUDO="${USE_SUDO:-sudo}"
MOUNT_LOG_PREFIX="${MOUNT_LOG_PREFIX:-[MOUNT]}"
# Single definition of the standardized mount base (was duplicated in 3_setting_base.sh).
DEFAULT_MOUNT_BASE="/mnt"

# Prompt helpers (read_default): single definition in prompt_common.sh.
if ! command -v prompt_read_default >/dev/null 2>&1; then
    source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/prompt_common.sh"
fi

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
    local fsck_pass="2"
    if [ -z "$uuid" ] || [ -z "$mount_point" ] || [ -z "$fstype" ]; then
        return 1
    fi
    # NTFS has no Linux fsck; pass 0 for every NTFS-family fstype so systemd/fsck
    # never tries to check it. Every other type keeps the historical pass 2.
    case "$fstype" in
        ntfs|ntfs3|fuseblk|ntfs-3g) fsck_pass="0" ;;
    esac
    entry="UUID=$uuid $mount_point $fstype ${options:-defaults} 0 $fsck_pass"

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
    local excluded_partuuid="" dev_partuuid=""

    # Skip the program-drive PARTUUID (get_program_drive_partuuid,
    # gvar_storage_common.sh) when one is recorded, so the Windows-only
    # program drive (E:) is never offered as a Linux NTFS candidate.
    declare -F get_program_drive_partuuid >/dev/null 2>&1 && excluded_partuuid="$(get_program_drive_partuuid)"

    while IFS= read -r line; do
        if [ -n "$line" ]; then
            if [ -n "$excluded_partuuid" ]; then
                dev_partuuid="$($USE_SUDO blkid -s PARTUUID -o value "$line" 2>/dev/null)"
                if [ -n "$dev_partuuid" ] && [ "$dev_partuuid" = "$excluded_partuuid" ]; then
                    info "Skipping program-drive PARTUUID=$dev_partuuid ($line): excluded by contract (linux_mounts_program_drive=false)." >&2
                    continue
                fi
            fi
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

# Path to the udev rule that hides the Windows program drive (E:) from
# udisks2/GVfs auto-mounting on Linux, when the contract says Linux does not
# mount it (paths.drive_layout.linux_mounts_program_drive = false). A
# dedicated 99- filename keeps this as the ONLY rule this project owns.
PROGRAM_DRIVE_UDEV_RULE_FILE="/etc/udev/rules.d/99-core-node-ignore-program-drive.rules"

# Idempotently ensure the udev exclusion rule for the program-drive PARTUUID
# recorded in the global var store (get_program_drive_partuuid,
# gvar_storage_common.sh). No-op when: the PARTUUID is not known yet; the
# service contract is unreadable (fresh machine, no node/php yet -- degrades
# gracefully instead of guessing); or the contract says Linux DOES mount the
# program drive. Writes the rule file only when its content differs from what
# is already on disk. The udevadm reload below is the real convergence
# action for whoever calls this function; it is never invoked by review/dry-
# run tooling, which must not call this function at all.
ensure_program_drive_udev_exclusion() {
    local partuuid="" mounts_program_drive="" desired_content="" current_content=""
    local sc_common_script=""

    if ! declare -F get_program_drive_partuuid >/dev/null 2>&1; then
        return 0
    fi
    partuuid="$(get_program_drive_partuuid)"
    if [ -z "$partuuid" ]; then
        echo "$MOUNT_LOG_PREFIX Program-drive PARTUUID not recorded yet; skipping the udev exclusion rule." >&2
        return 0
    fi

    if ! command -v sc_get >/dev/null 2>&1; then
        sc_common_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/service_contract_common.sh"
        [ -f "$sc_common_script" ] && source "$sc_common_script"
    fi
    if ! command -v sc_get >/dev/null 2>&1; then
        echo "$MOUNT_LOG_PREFIX service_contract_common.sh unavailable; skipping the udev exclusion rule." >&2
        return 0
    fi
    mounts_program_drive="$(sc_get paths.drive_layout.linux_mounts_program_drive)"
    if [ -z "$mounts_program_drive" ]; then
        echo "$MOUNT_LOG_PREFIX Service contract unreadable for paths.drive_layout.linux_mounts_program_drive (no node/php yet?); skipping the udev exclusion rule." >&2
        return 0
    fi
    if [ "$mounts_program_drive" != "false" ]; then
        echo "$MOUNT_LOG_PREFIX Contract says Linux mounts the program drive; skipping the udev exclusion rule." >&2
        return 0
    fi

    desired_content="ENV{ID_PART_ENTRY_UUID}==\"$partuuid\", ENV{UDISKS_IGNORE}=\"1\", ENV{UDISKS_AUTO}=\"0\""
    current_content=""
    [ -f "$PROGRAM_DRIVE_UDEV_RULE_FILE" ] && current_content="$($MOUNT_USE_SUDO cat "$PROGRAM_DRIVE_UDEV_RULE_FILE" 2>/dev/null)"
    if [ "$current_content" = "$desired_content" ]; then
        echo "$MOUNT_LOG_PREFIX udev exclusion rule already correct for PARTUUID=$partuuid; skipping."
        return 0
    fi

    echo "$desired_content" | $MOUNT_USE_SUDO tee "$PROGRAM_DRIVE_UDEV_RULE_FILE" >/dev/null
    echo "$MOUNT_LOG_PREFIX Wrote $PROGRAM_DRIVE_UDEV_RULE_FILE for PARTUUID=$partuuid"
    $MOUNT_USE_SUDO udevadm control --reload-rules 2>/dev/null || true
    $MOUNT_USE_SUDO udevadm trigger 2>/dev/null || true
    return 0
}

# Print an English "needs a Windows repair" warning for a dirty NTFS volume
# that was mounted read-write via the runtime-only ntfs-3g fallback (see the
# mount_disk / handle_ntfs_disk fallback blocks), and -- ONLY when it can be
# done safely -- schedule ONE Windows boot so the pending Windows repair
# actually runs (docs_fix/REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md
# section 2, root cause #6: the firmware boots Debian first, so a pending
# chkdsk schedule never gets a chance to run on its own). Both conditions
# below are required before grub-reboot is used:
#   - /etc/default/grub has GRUB_DEFAULT=saved (grub-reboot's one-shot only
#     takes effect with the "saved" default; using it otherwise would permanently
#     change the boot default, which this function must never do);
#   - a Windows menu entry is found in the generated grub.cfg (os-prober).
# Either condition failing prints the manual instruction instead. This
# function itself never mounts, unmounts, edits fstab, or reloads udev; the
# grub-reboot call is the one system-changing action, gated as above.
warn_ntfs_dirty_windows_repair() {
    local device="$1"
    local grub_default="" win_entry="" grub_cfg="/boot/grub/grub.cfg"

    echo "$MOUNT_LOG_PREFIX WARNING: ${device:-the NTFS volume} is a DIRTY NTFS volume (Windows was not shut down cleanly, or a repair is pending)." >&2
    echo "$MOUNT_LOG_PREFIX WARNING: it was mounted read-write with ntfs-3g for THIS BOOT ONLY. Boot Windows and let it finish its disk repair (chkdsk /f) to clear the dirty flag permanently." >&2

    if [ -f /etc/default/grub ]; then
        grub_default="$(awk -F= '/^GRUB_DEFAULT=/{gsub(/"/,"",$2); print $2; exit}' /etc/default/grub 2>/dev/null)"
    fi
    if [ "$grub_default" != "saved" ]; then
        echo "$MOUNT_LOG_PREFIX GRUB_DEFAULT is not 'saved'; cannot schedule a one-time Windows boot automatically." >&2
        echo "$MOUNT_LOG_PREFIX MANUAL STEP: reboot and pick the Windows entry yourself, then let Windows finish its repair." >&2
        return 0
    fi
    if [ -f "$grub_cfg" ]; then
        win_entry="$(awk -F"'" '/^menuentry/ && tolower($0) ~ /windows/ {print $2; exit}' "$grub_cfg" 2>/dev/null)"
    fi
    if [ -z "$win_entry" ]; then
        echo "$MOUNT_LOG_PREFIX No Windows menu entry found in $grub_cfg; cannot schedule a one-time Windows boot automatically." >&2
        echo "$MOUNT_LOG_PREFIX MANUAL STEP: reboot and pick the Windows entry yourself, then let Windows finish its repair." >&2
        return 0
    fi

    echo "$MOUNT_LOG_PREFIX Scheduling one Windows boot to run its pending repair: $MOUNT_USE_SUDO grub-reboot \"$win_entry\"" >&2
    $MOUNT_USE_SUDO grub-reboot "$win_entry" 2>/dev/null \
        || echo "$MOUNT_LOG_PREFIX WARNING: grub-reboot failed; reboot and pick the Windows entry manually." >&2
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
    local fsck_pass="2"
    case "$fstype" in
        ntfs|ntfs3|fuseblk|ntfs-3g) fsck_pass="0" ;;
    esac
    mount_fstab_ensure_single_entry "$uuid" "$mount_point" "$fstype" "${options:-defaults}"
    log "Added fstab entry: UUID=$uuid $mount_point $fstype ${options:-defaults} 0 $fsck_pass"
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
            echo "[2] $USE_SUDO apt-get update"
            $USE_SUDO apt-get update
            echo "[2] $USE_SUDO apt-get install -y ntfs-3g"
            $USE_SUDO apt-get install -y ntfs-3g
        fi
        mount_options="defaults,nofail,x-systemd.device-timeout=10,$(ntfs_owner_opts),umask=0022,windows_names"
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
        # ntfs3 (in-kernel) refused the volume -- almost always an unclean
        # ("dirty") NTFS journal left by an interrupted Windows session. Mount
        # read-write with ntfs-3g for THIS BOOT ONLY, bypassing fstab entirely
        # (explicit device + type), so fstab keeps ntfs3 and is NEVER rewritten
        # to the fallback: the old code persisted the fallback type here, which
        # kept Linux writing to an unrepaired volume forever (see docs_fix/
        # REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md section 2). Never
        # pass ntfs3's "force" option and never run ntfsfix: either would let
        # Linux silently clear the dirty flag instead of a real Windows chkdsk.
        warning "ntfs3 mount failed for $device (dirty NTFS volume); mounting read-write with ntfs-3g for this boot only."
        echo "[2] $USE_SUDO mount -t ntfs-3g -o $mount_options $device $mount_point"
        if $USE_SUDO mount -t ntfs-3g -o "$mount_options" "$device" "$mount_point" 2>/dev/null; then
            log "Successfully mounted $device to $mount_point (ntfs-3g, runtime-only fallback)"
            echo "[2] $USE_SUDO chmod 755 $mount_point"
            $USE_SUDO chmod 755 "$mount_point"
            warn_ntfs_dirty_windows_repair "$device"
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
    local mount_options="defaults,nofail,x-systemd.device-timeout=10,$(ntfs_owner_opts),umask=0022,windows_names"
    mount_fstab_ensure_single_entry "$uuid" "$mount_point" "$ntfs_type" "$mount_options"
    log "Added fstab entry: UUID=$uuid $mount_point $ntfs_type $mount_options 0 0"

    # Real-time mount: not mounted -> mount at target; mounted elsewhere -> remount to target
    if [ "$is_mounted" = false ]; then
        local _mounted=false
        local _dirty_fallback=false
        echo "[2] $USE_SUDO mount -t $ntfs_type -o $mount_options $device $mount_point"
        if $USE_SUDO mount -t "$ntfs_type" -o "$mount_options" "$device" "$mount_point" 2>/dev/null; then
            _mounted=true
        elif [ "$ntfs_type" = "ntfs3" ]; then
            # ntfs3 (in-kernel) refused the volume -- almost always an unclean
            # ("dirty") NTFS journal. Mount read-write with ntfs-3g for THIS
            # BOOT ONLY: fstab above already keeps $ntfs_type == ntfs3 and is
            # NEVER rewritten to the fallback (the old code re-persisted the
            # fallback type here, which kept Linux writing to an unrepaired
            # volume forever; see docs_fix/
            # REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md section 2). Never
            # pass ntfs3's "force" option and never run ntfsfix.
            warning "ntfs3 mount failed for $device (dirty NTFS volume); mounting read-write with ntfs-3g for this boot only."
            echo "[2] $USE_SUDO mount -t ntfs-3g -o $mount_options $device $mount_point"
            if $USE_SUDO mount -t ntfs-3g -o "$mount_options" "$device" "$mount_point" 2>/dev/null; then
                _mounted=true
                _dirty_fallback=true
            fi
        fi
        if [ "$_mounted" = true ]; then
            if [ "$_dirty_fallback" = true ]; then
                warn_ntfs_dirty_windows_repair "$device"
                log "Successfully mounted $device to $mount_point (ntfs-3g, runtime-only fallback)"
            else
                log "Successfully mounted $device to $mount_point ($ntfs_type)"
            fi
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

# =============================================================================
# /www canonical base convergence
# =============================================================================

# Converge the canonical /www path onto the storage selected by
# get_base_data_directory() (gvar_storage_common.sh), idempotently:
#   A) root filesystem only           -> /www is a plain directory on /
#   B) root fs + one NTFS/data disk   -> /www bind-mounts the disk root when the
#      disk has strictly more free space than / (get_base_data_directory decides)
#   C) root fs + multiple disks       -> same as B; the largest-free disk wins
# /www/programing/core_node (the project DefineVar center) is therefore valid on
# every machine. fstab carries exactly one bind entry for /www so the mount
# survives reboot; the bind is applied in real time. Identity is checked by
# device:inode (not mount-table parsing), so re-runs are cheap no-ops.
ensure_www_base_mount() {
    local base_dir ntfs_count disk_note desired_id current_id entry
    base_dir="$(get_base_data_directory 2>/dev/null)"
    [ -n "$base_dir" ] || base_dir="/www"

    ntfs_count="$($MOUNT_USE_SUDO blkid 2>/dev/null | grep -ci 'TYPE="ntfs"')"
    [ -n "$ntfs_count" ] || ntfs_count=0
    case "$ntfs_count" in
        0) disk_note="A: root filesystem only" ;;
        1) disk_note="B: root filesystem + one NTFS disk" ;;
        *) disk_note="C: root filesystem + $ntfs_count NTFS disks (largest free wins)" ;;
    esac
    echo "$MOUNT_LOG_PREFIX Machine scan: $disk_note"
    echo "$MOUNT_LOG_PREFIX Selected base data directory: $base_dir"

    if [ "$base_dir" = "/www" ] || [ "$base_dir" = "/" ]; then
        # Root filesystem wins: /www is a plain directory. Detach any stale bind
        # left from a run where a disk used to win.
        if mountpoint -q /www 2>/dev/null; then
            echo "$MOUNT_LOG_PREFIX Root fs now wins; removing stale /www bind from fstab."
            $MOUNT_USE_SUDO cp /etc/fstab /etc/fstab.core_node.bak 2>/dev/null || true
            $MOUNT_USE_SUDO sed -i '\|[[:space:]]/www[[:space:]]|d' /etc/fstab 2>/dev/null || true
            $MOUNT_USE_SUDO umount /www 2>/dev/null \
                || echo "$MOUNT_LOG_PREFIX WARNING: /www busy; stale bind detaches on reboot."
        fi
        if [ ! -d /www ]; then
            $MOUNT_USE_SUDO mkdir -p /www
            echo "$MOUNT_LOG_PREFIX Created /www on root filesystem"
        fi
    else
        # A disk base wins: bind the disk mount root onto /www so
        # /www/programing/core_node resolves to the real checkout.
        [ -d /www ] || $MOUNT_USE_SUDO mkdir -p /www
        desired_id="$(stat -c '%d:%i' "$base_dir" 2>/dev/null)"
        current_id="$(stat -c '%d:%i' /www 2>/dev/null)"
        if [ -n "$desired_id" ] && [ "$current_id" = "$desired_id" ]; then
            echo "$MOUNT_LOG_PREFIX /www already bound to $base_dir; skipping mount."
        else
            if mountpoint -q /www 2>/dev/null; then
                echo "$MOUNT_LOG_PREFIX /www bound to a different source; rebinding to $base_dir"
                if ! $MOUNT_USE_SUDO umount /www 2>/dev/null; then
                    echo "$MOUNT_LOG_PREFIX WARNING: /www busy; keeping current bind until reboot."
                    return 0
                fi
            elif [ -n "$(ls -A /www 2>/dev/null)" ]; then
                echo "$MOUNT_LOG_PREFIX NOTE: /www has content on the root fs; it stays on disk at $base_dir and is hidden under the new bind."
            fi
            if $MOUNT_USE_SUDO mount --bind "$base_dir" /www 2>/dev/null; then
                echo "$MOUNT_LOG_PREFIX Bound /www -> $base_dir"
            else
                echo "$MOUNT_LOG_PREFIX ERROR: Failed to bind /www to $base_dir"
                return 1
            fi
        fi
        # fstab: exactly one bind entry for /www (survives reboot). The sed
        # pattern requires whitespace after /www, so /wwwroot lines never match.
        entry="$base_dir /www none bind,nofail 0 0"
        if ! grep -Fxq "$entry" /etc/fstab 2>/dev/null; then
            $MOUNT_USE_SUDO cp /etc/fstab /etc/fstab.core_node.bak 2>/dev/null || true
            $MOUNT_USE_SUDO sed -i '\|[[:space:]]/www[[:space:]]|d' /etc/fstab 2>/dev/null || true
            echo "$entry" | $MOUNT_USE_SUDO tee -a /etc/fstab >/dev/null
            echo "$MOUNT_LOG_PREFIX Added fstab entry: $entry"
        fi
        # The cross-platform WWW root (Windows D:\www == Linux /www/www) lives
        # on the shared disk; create it so map_web_path can prefer the stable
        # /www/www spelling over the device-bound "$base_dir/www".
        if [ ! -d /www/www ]; then
            $MOUNT_USE_SUDO mkdir -p /www/www 2>/dev/null || mkdir -p /www/www
            echo "$MOUNT_LOG_PREFIX Created /www/www (shared web root on $base_dir)"
        fi
    fi

    # Ensure the canonical project root exists through /www.
    if [ ! -d /www/programing ]; then
        $MOUNT_USE_SUDO mkdir -p /www/programing 2>/dev/null || mkdir -p /www/programing
        echo "$MOUNT_LOG_PREFIX Created /www/programing"
    fi
    return 0
}

# =============================================================================
# Dual-boot project tree root bind (contract paths.drive_layout.tree_root)
# =============================================================================

# Idempotent fstab bind for the dual-boot project tree root: binds the ext4
# backing store (CN_TREE_BACKING, contract tree_root.linux_backing, single
# definition in shared_cache_env.sh) onto the mountpoint under the NTFS /www
# share (CN_TREE_MNT, contract tree_root.linux), so Windows sees
# D:\core_node_trees while the data itself stays on ext4/opt. No-op unless the
# /www NTFS dual-boot share is actually configured -- on a Linux-only machine
# there is nothing to bind under, and CN_TREE_CACHE_ROOT (shared_cache_env.sh)
# already resolves straight to the ext4 backing directory in that case.
ensure_tree_root_bind_mount() {
    local ntfs_configured=false
    local entry="" shared_cache_env_script=""

    if [ -z "${CN_TREE_MNT:-}" ] || [ -z "${CN_TREE_BACKING:-}" ]; then
        shared_cache_env_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/shared_cache_env.sh"
        [ -f "$shared_cache_env_script" ] && source "$shared_cache_env_script"
    fi
    if [ -z "${CN_TREE_MNT:-}" ] || [ -z "${CN_TREE_BACKING:-}" ]; then
        echo "$MOUNT_LOG_PREFIX Tree-root contract values (paths.drive_layout.tree_root) unreadable; skipping the tree-root bind." >&2
        return 0
    fi

    if declare -F www_ntfs_root_mounted >/dev/null 2>&1; then
        www_ntfs_root_mounted && ntfs_configured=true
    elif command -v findmnt >/dev/null 2>&1; then
        case "$(findmnt -no FSTYPE -M /www 2>/dev/null)" in
            ntfs|ntfs3|fuseblk|ntfs-3g) ntfs_configured=true ;;
        esac
    fi
    if [ "$ntfs_configured" != true ]; then
        echo "$MOUNT_LOG_PREFIX /www is not the NTFS dual-boot share; the tree root stays on $CN_TREE_BACKING directly (no bind needed)." >&2
        return 0
    fi

    [ -d "$CN_TREE_BACKING" ] || $MOUNT_USE_SUDO mkdir -p "$CN_TREE_BACKING"
    # A plain mount-point directory only -- never a Windows reparse point.
    [ -d "$CN_TREE_MNT" ] || $MOUNT_USE_SUDO mkdir -p "$CN_TREE_MNT"

    entry="$CN_TREE_BACKING $CN_TREE_MNT none bind,nofail,x-systemd.requires-mounts-for=/www 0 0"
    if grep -Fxq "$entry" /etc/fstab 2>/dev/null; then
        echo "$MOUNT_LOG_PREFIX Tree-root bind fstab entry already correct."
    else
        $MOUNT_USE_SUDO cp /etc/fstab /etc/fstab.core_node.bak 2>/dev/null || true
        $MOUNT_USE_SUDO sed -i "\|[[:space:]]${CN_TREE_MNT}[[:space:]]|d" /etc/fstab 2>/dev/null || true
        echo "$entry" | $MOUNT_USE_SUDO tee -a /etc/fstab >/dev/null
        echo "$MOUNT_LOG_PREFIX Added tree-root bind fstab entry: $entry"
    fi

    if mountpoint -q "$CN_TREE_MNT" 2>/dev/null; then
        echo "$MOUNT_LOG_PREFIX $CN_TREE_MNT already mounted."
    elif $MOUNT_USE_SUDO mount --bind "$CN_TREE_BACKING" "$CN_TREE_MNT" 2>/dev/null; then
        echo "$MOUNT_LOG_PREFIX Bound $CN_TREE_MNT -> $CN_TREE_BACKING"
    else
        echo "$MOUNT_LOG_PREFIX WARNING: could not bind $CN_TREE_MNT now; fstab will apply it on next boot."
    fi
    return 0
}
