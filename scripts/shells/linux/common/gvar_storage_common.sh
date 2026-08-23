#!/bin/bash

# Return largest NTFS device and its size (bytes), output "size device"
get_largest_ntfs_with_size() {
    local best_device=""
    local best_size=0
    local device size
    while IFS= read -r device; do
        [ -z "$device" ] && continue
        size=$($USE_SUDO blockdev --getsize64 "$device" 2>/dev/null || echo 0)
        if [ -n "$size" ] && [ "$size" -gt "$best_size" ] 2>/dev/null; then
            best_size="$size"
            best_device="$device"
        fi
    done < <($USE_SUDO blkid | grep -i "TYPE=\"ntfs\"" | cut -d: -f1)
    [ -n "$best_device" ] && echo "$best_size $best_device"
}

# Return largest data device (ext4/xfs/btrfs) and its size, excluding root and boot; output "size device"
get_largest_data_with_size() {
    local best_device=""
    local best_size=0
    local device mount_point size
    while IFS= read -r device; do
        [ -z "$device" ] && continue
        mount_point=$(findmnt -n -o TARGET "$device" 2>/dev/null || echo "")
        [ "$mount_point" = "/" ] && continue
        [ "$mount_point" = "/boot" ] && continue
        [ -n "$mount_point" ] && [ "$mount_point" = "/boot/efi" ] && continue
        size=$($USE_SUDO blockdev --getsize64 "$device" 2>/dev/null || echo 0)
        if [ -n "$size" ] && [ "$size" -gt "$best_size" ] 2>/dev/null; then
            best_size="$size"
            best_device="$device"
        fi
    done < <($USE_SUDO blkid | grep -iE "TYPE=\"(ext4|xfs|btrfs)\"" | cut -d: -f1)
    [ -n "$best_device" ] && echo "$best_size $best_device"
}

# Resolve usable mount path for a device. Prefer CURRENT mount so we use the path where data actually is
# (e.g. /media/ubuntu/Soft); std path like /mnt/dev_nvme0n1p4 may exist but be empty until reboot.
_resolve_device_mount_path() {
    local device="$1"
    local std_mount current_mount
    std_mount=$(device_to_mount_point "$device")
    current_mount=$(findmnt -n -o TARGET "$device" 2>/dev/null || echo "")
    if [ -n "$current_mount" ] && [ -d "$current_mount" ] && ( [ -w "$current_mount" ] || [ "$(id -u)" -eq 0 ] ); then
        echo "$current_mount"
        return 0
    fi
    if [ -d "$std_mount" ] && ( [ -w "$std_mount" ] || [ "$(id -u)" -eq 0 ] ); then
        echo "$std_mount"
        return 0
    fi
    echo ""
    return 1
}

# Returns 0 if path is safe for recursive chown/chmod (not /, /usr, /etc, etc.). Prints path to stderr. Use before chown -R/chmod -R.
safe_path_for_recursive_chown() {
    local path="$1"
    echo "[SAFE_PATH] path=$path" >&2
    [ -z "$path" ] && return 1
    case "$path" in
        /) return 1;;
        /usr|/usr/*) return 1;;
        /etc|/etc/*) return 1;;
        /bin|/bin/*) return 1;;
        /sbin|/sbin/*) return 1;;
        /lib|/lib/*) return 1;;
        /var) return 1;;
    esac
    [[ "$path" != /* ]] && return 1
    return 0
}
export -f safe_path_for_recursive_chown

# Centralized path for persisted base data directory (used by bootstrap and project)
BASE_DATA_DIR_FILE="/var/_core_node/global_var/BASE_DATA_DIR"

# True when the filesystem backing $1 supports POSIX ownership/permissions, which
# the web DATA root REQUIRES: PostgreSQL needs a postgres-owned 0700 data dir and
# Laravel must chown/chmod its storage tree. NTFS/exFAT/FUSE/drvfs cannot do this,
# so they must NEVER be selected as the base data dir -- otherwise bash (which
# would pick the big NTFS disk) diverges from PHP PathMapper (which falls back to
# /www), and the installer writes secrets/creates dirs where the app never reads
# them (symptom: PG "password authentication failed", Laravel "mkdir: Permission
# denied"). Walks up to the nearest existing ancestor since the leaf may not exist.
_fs_is_posix_capable() {
    local p="$1" fstype=""
    while [ -n "$p" ] && [ "$p" != "/" ] && [ ! -e "$p" ]; do p="$(dirname "$p")"; done
    [ -z "$p" ] && return 1
    fstype="$(findmnt -n -o FSTYPE --target "$p" 2>/dev/null)"
    case "$fstype" in
        ext2|ext3|ext4|xfs|btrfs|zfs|reiserfs|jfs|f2fs|overlay) return 0 ;;
        *) return 1 ;;
    esac
}

# True when $1 is a REAL disk mountpoint on a device different from the root (/)
# filesystem. This is what distinguishes a genuine data-disk base from an empty
# leftover directory that was auto-created on the root fs (e.g. a stale
# /mnt/dev_nvme0n1p1 carried over from a previous host): the leftover is a plain
# dir on '/', not a mountpoint, so it is rejected. Falls back to "not a real mount"
# when mountpoint/findmnt are unavailable.
_is_real_distinct_mount() {
    local p="$1" src root_src
    [ -n "$p" ] && [ -d "$p" ] || return 1
    mountpoint -q "$p" 2>/dev/null || return 1
    src="$(findmnt -n -o SOURCE --target "$p" 2>/dev/null)"
    root_src="$(findmnt -n -o SOURCE --target / 2>/dev/null)"
    [ -n "$src" ] && [ "$src" != "$root_src" ]
}

# True when base $1 actually hosts a real core_node checkout. Uses the SAME adopt
# predicate as 7_project_validator.sh (a .git entry or package.json under
# programing/core_node), so "the project is really here" means the same thing
# everywhere.
_path_hosts_project() {
    local base="$1" proj
    [ -n "$base" ] || return 1
    proj="$base/programing/core_node"
    [ -d "$proj" ] && { [ -e "$proj/.git" ] || [ -f "$proj/package.json" ]; }
}

# Function to get optimal base directory for data storage. This is the PROJECT /
# CODE base (where the core_node checkout lives); it may be a large NTFS data disk,
# which is fine for source code, so it is NOT POSIX-restricted. The POSIX-only
# requirement applies ONLY to the WEB DATA base, which map_web_path derives and
# guards separately (PostgreSQL/Laravel need ownership). Keeping them separate is
# why CORE_NODE_PROJECT_ROOT maps to the real /mnt checkout while web data uses /www.
# Priority: WSL -> persisted BASE_DATA_DIR (center) -> largest NTFS/data disk -> Desktop Windows -> /www
get_base_data_directory() {
    local base_dir="" run_anchor="" run_base="" persisted_now=""

    # Priority 1: WSL /mnt/d
    if [ "$IS_WSL" = true ]; then
        base_dir="/mnt/d"
        echo "$base_dir"
        return 0
    fi

    # Priority 1.5: Adopt the disk where the project ACTUALLY runs. Ground truth is
    # where THIS checkout lives -- the persisted base (Priority 2) can still point at
    # a leftover path migrated from another host. Derive the run anchor from
    # CORE_NODE_ROOT_DIR (set by dd.sh) or this script's own resolved location, strip
    # the trailing /programing/core_node, and adopt that base ONLY when it really
    # hosts the project. Self-heal: rewrite the persisted file when it disagrees.
    if [ -n "${CORE_NODE_ROOT_DIR:-}" ]; then
        run_anchor="$CORE_NODE_ROOT_DIR"
    elif [ -n "${BASH_SOURCE[0]:-}" ]; then
        run_anchor="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../../../.." 2>/dev/null && pwd)"
    fi
    case "$run_anchor" in
        */programing/core_node)
            run_base="${run_anchor%/programing/core_node}"
            if _path_hosts_project "$run_base"; then
                persisted_now=""
                [ -s "$BASE_DATA_DIR_FILE" ] && persisted_now=$(head -n1 "$BASE_DATA_DIR_FILE" 2>/dev/null | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
                [ "$persisted_now" != "$run_base" ] && persist_base_data_directory "$run_base"
                echo "$run_base"
                return 0
            fi
            ;;
    esac

    # Priority 2: persisted base, but ONLY when still valid. A bare existence test
    # accepts a stale leftover dir on the root fs; instead require that it is a real
    # distinct disk mount OR actually hosts the project. An invalid value falls
    # through (and is re-persisted by the adopt step / callers), so it self-heals.
    if [ -s "$BASE_DATA_DIR_FILE" ]; then
        read_base=$(head -n1 "$BASE_DATA_DIR_FILE" 2>/dev/null | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        if [ -n "$read_base" ] && { _is_real_distinct_mount "$read_base" || _path_hosts_project "$read_base"; }; then
            echo "$read_base"
            return 0
        fi
    fi

    # Priority 3: Compare largest NTFS vs largest data disk; use the absolute largest
    local ntfs_line data_line ntfs_size data_size ntfs_device data_device chosen_device path
    ntfs_line=$(get_largest_ntfs_with_size)
    data_line=$(get_largest_data_with_size)
    ntfs_size=0
    data_size=0
    ntfs_device=""
    data_device=""
    [ -n "$ntfs_line" ] && ntfs_size=$(echo "$ntfs_line" | awk '{print $1}') && ntfs_device=$(echo "$ntfs_line" | awk '{print $2}')
    [ -n "$data_line" ] && data_size=$(echo "$data_line" | awk '{print $1}') && data_device=$(echo "$data_line" | awk '{print $2}')
    chosen_device=""
    if [ -n "$ntfs_device" ] && [ -n "$data_device" ]; then
        if [ "${ntfs_size:-0}" -ge "${data_size:-0}" ] 2>/dev/null; then
            chosen_device="$ntfs_device"
        else
            chosen_device="$data_device"
        fi
    elif [ -n "$ntfs_device" ]; then
        chosen_device="$ntfs_device"
    elif [ -n "$data_device" ]; then
        chosen_device="$data_device"
    fi

    if [ -n "$chosen_device" ]; then
        path=$(_resolve_device_mount_path "$chosen_device")
        if [ -n "$path" ]; then
            base_dir="$path"
            echo "$base_dir"
            return 0
        fi
    fi

    # Priority 4: Desktop with Windows drives
    if [ "$IS_DESKTOP_WITH_WINDOWS" = true ] && [ -n "$DESKTOP_LARGEST_WINDOWS_PATH" ]; then
        if [ -d "$DESKTOP_LARGEST_WINDOWS_PATH" ] && [ -w "$DESKTOP_LARGEST_WINDOWS_PATH" ]; then
            base_dir="$DESKTOP_LARGEST_WINDOWS_PATH"
            echo "$base_dir"
            return 0
        fi
    fi

    # Fallback: /www
    base_dir="/www"
    echo "$base_dir"
    return 0
}

# Persist base data directory to global var so all scripts (bootstrap, project dd.sh) use the same path
persist_base_data_directory() {
    local base_dir="${1:-$(get_base_data_directory)}"
    local dir_file="${2:-$BASE_DATA_DIR_FILE}"
    local parent_dir
    # Refuse to persist a base that is not real: it must be a distinct disk mount,
    # actually host the project, or be one of the sanctioned logical roots (/www, or
    # WSL /mnt/d). This breaks the old feedback loop where a stale/leftover path
    # (e.g. a migrated /mnt/dev_nvme0n1p1) kept getting re-written into the file.
    if ! _is_real_distinct_mount "$base_dir" && ! _path_hosts_project "$base_dir" \
        && [ "$base_dir" != "/www" ] && [ "$base_dir" != "/mnt/d" ]; then
        return 0
    fi
    parent_dir=$(dirname "$dir_file")
    if [ ! -d "$parent_dir" ]; then
        $USE_SUDO mkdir -p "$parent_dir" 2>/dev/null || mkdir -p "$parent_dir" 2>/dev/null || true
    fi
    echo "$base_dir" | $USE_SUDO tee "$dir_file" >/dev/null 2>&1 || echo "$base_dir" > "$dir_file" 2>/dev/null || true
}

# Development-tooling base directory: where the per-distro dev tree
# <base>/_${SYSTEM_NAME}_${major} (node, py, etc.) is installed. Mirrors
# PHP App\Providers\PathMapper::getDevCompileParts() and Python system_paths.py so
# all three resolve to the SAME directory.
#
# Selection (non-WSL):
#   1. STICKY /opt: if /opt/_${name}_${ver} already exists, keep using /opt forever
#      -- even if root (/) later drops below the free-space threshold. Once /opt is
#      chosen, all subsequent installs stay on /opt.
#   2. Else prefer /opt when root (/) has MORE THAN DEV_ROOT_MIN_FREE_GB free
#      (default 50 GB). This replaces the old "always use the largest secondary
#      disk" behaviour.
#   3. Else fall back to the largest secondary disk (get_base_data_directory).
# WSL keeps its data-disk design (root / is the ephemeral vhdx).
get_dev_compile_base() {
    local suffix root_free min_gb min_bytes
    suffix="$SYS_DIR"
    min_gb="${DEV_ROOT_MIN_FREE_GB:-50}"

    if [ "${IS_WSL:-false}" != "true" ]; then
        # 1. Sticky: an existing /opt dev dir wins regardless of current free space.
        if [ -d "/opt/$suffix" ]; then
            echo "/opt"
            return 0
        fi
        # 2. Prefer /opt when root (/) has more than min_gb free (precise bytes).
        root_free="$(df -B1 --output=avail / 2>/dev/null | tail -1 | tr -dc '0-9')"
        min_bytes=$(( min_gb * 1024 * 1024 * 1024 ))
        if [ -n "$root_free" ] && [ "$root_free" -gt "$min_bytes" ]; then
            echo "/opt"
            return 0
        fi
    fi

    # 3. Fallback: largest secondary disk (or /www).
    get_base_data_directory
}

# Function to detect if system has NTFS disks
has_ntfs_disk() {
    local ntfs_devices=$($USE_SUDO blkid | grep -i "TYPE=\"ntfs\"")
    if [ -n "$ntfs_devices" ]; then
        return 0
    else
        return 1
    fi
}

# Function to convert device name to standardized mount point
# Example: /dev/sdb3 -> /mnt/dev_sdb3
device_to_mount_point() {
    local device="$1"
    local mount_base="${2:-/mnt}"
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

# Function to get mount point from device (check actual mount or derive standardized path)
get_device_mount_point() {
    local device="$1"

    # First check if device is currently mounted
    if mount | grep -q "^$device "; then
        mount | grep "^$device " | awk '{print $3}'
        return 0
    fi

    # If not mounted, return standardized mount point
    device_to_mount_point "$device"
    return 0
}

# Function to detect if system has unmounted data disks
has_unmounted_data_disk() {
    # Check for ext4, xfs, btrfs partitions that are not root or boot
    while IFS= read -r device; do
        if [ -n "$device" ]; then
            local mount_point=$(findmnt -n -o TARGET "$device" 2>/dev/null || echo "")
            if [ -z "$mount_point" ]; then
                # Found unmounted data disk
                return 0
            fi
        fi
    done < <($USE_SUDO blkid | grep -iE "TYPE=\"(ext4|xfs|btrfs)\"" | cut -d: -f1)

    return 1
}
# Function to detect desktop system with Windows drives
detect_desktop_windows_drives() {
    # Get current user
    CURRENT_USER=$(whoami)
    
    # Check if /media/current_user directory exists
    local media_user_path="/media/$CURRENT_USER"
    
    if [ -d "$media_user_path" ]; then
        DESKTOP_WINDOWS_MOUNT_PATH="$media_user_path"
        
        # Look for Windows drives (typically C:, D:, E:, etc.)
        local windows_drives=""
        local drive_count=0
        
        # Check for common Windows drive patterns
        for drive_letter in {A..Z}; do
            local drive_path="$media_user_path/$drive_letter"
            if [ -d "$drive_path" ]; then
                # Check if it looks like a Windows drive (has Windows-specific directories)
                if [ -d "$drive_path/Windows" ] || [ -d "$drive_path/Program Files" ] || [ -d "$drive_path/Users" ] || [ -f "$drive_path/bootmgr" ]; then
                    windows_drives="$windows_drives$drive_letter "
                    drive_count=$((drive_count + 1))
                fi
            fi
        done
        
        # Also check for numbered drives (common in some Linux distributions)
        for drive_num in {0..9}; do
            local drive_path="$media_user_path/$drive_num"
            if [ -d "$drive_path" ]; then
                # Check if it looks like a Windows drive
                if [ -d "$drive_path/Windows" ] || [ -d "$drive_path/Program Files" ] || [ -d "$drive_path/Users" ] || [ -f "$drive_path/bootmgr" ]; then
                    windows_drives="$windows_drives$drive_num "
                    drive_count=$((drive_count + 1))
                fi
            fi
        done
        
        # Check for generic "disk" or "drive" patterns
        for pattern in "disk" "drive" "volume"; do
            for item in "$media_user_path"/*; do
                if [ -d "$item" ]; then
                    local item_name=$(basename "$item")
                    if [[ "$item_name" =~ ^$pattern ]]; then
                        # Check if it looks like a Windows drive
                        if [ -d "$item/Windows" ] || [ -d "$item/Program Files" ] || [ -d "$item/Users" ] || [ -f "$item/bootmgr" ]; then
                            windows_drives="$windows_drives$item_name "
                            drive_count=$((drive_count + 1))
                        fi
                    fi
                fi
            done
        done
        
        DESKTOP_WINDOWS_DRIVES="$windows_drives"
        
        if [ "$drive_count" -gt 0 ]; then
            IS_DESKTOP_WITH_WINDOWS=true
            # Determine the largest drive (usually C: or the system drive)
            determine_largest_windows_drive
        else
            IS_DESKTOP_WITH_WINDOWS=false
        fi
    else
        IS_DESKTOP_WITH_WINDOWS=false
    fi
}

# Function to determine the largest Windows drive
determine_largest_windows_drive() {
    local largest_drive=""
    local largest_size=0
    
    for drive in $DESKTOP_WINDOWS_DRIVES; do
        local drive_path="$DESKTOP_WINDOWS_MOUNT_PATH/$drive"
        if [ -d "$drive_path" ]; then
            # Get drive size using df
            local drive_size=$(df "$drive_path" 2>/dev/null | awk 'NR==2 {print $2}' | sed 's/[^0-9]//g')
            if [ -n "$drive_size" ] && [ "$drive_size" -gt "$largest_size" ]; then
                largest_size="$drive_size"
                largest_drive="$drive"
            fi
        fi
    done
    
    if [ -n "$largest_drive" ]; then
        export DESKTOP_LARGEST_WINDOWS_DRIVE="$largest_drive"
        export DESKTOP_LARGEST_WINDOWS_PATH="$DESKTOP_WINDOWS_MOUNT_PATH/$largest_drive"
    fi
}

# Detect desktop system with Windows drives
detect_desktop_windows_drives

# Set core node project root directory (derived from base data directory)
# Unified path for both server and desktop: base_dir/programing/core_node
get_core_node_project_root() {
    local base_dir=$(get_base_data_directory)

    # Unified path structure for all environments
    echo "$base_dir/programing/core_node"
}

CORE_NODE_PROJECT_ROOT="$(get_core_node_project_root)"

# Export desktop Windows drive variables
export IS_DESKTOP_WITH_WINDOWS
export CURRENT_USER
export DESKTOP_WINDOWS_MOUNT_PATH
export DESKTOP_WINDOWS_DRIVES
export DESKTOP_LARGEST_WINDOWS_DRIVE
export DESKTOP_LARGEST_WINDOWS_PATH

# Function to get comprehensive environment information
get_environment_info() {
    # Environment detection summary
    if [ "$IS_WSL" = true ]; then
        # WSL environment details
        true
    elif [ "$IS_DESKTOP_WITH_WINDOWS" = true ]; then
        # Desktop with Windows drives details
        true
    elif [ "$IS_PRODUCTION" = true ]; then
        # Production environment details
        true
    else
        # Standard Linux Desktop/Server details
        true
    fi
    
    if [ "$HAS_DESKTOP_ENVIRONMENT" = true ]; then
        # Desktop environment details
        true
    fi
}

# Multi-disk detection variables
HAS_MULTIPLE_DISKS=false
DISK_COUNT=0
DISK_LIST=""
DISK_MOUNT_INFO=""

# Function to detect multiple hard drives
detect_multiple_disks() {
    # Skip when sysfs is not available (containers, chroot, restricted env)
    if [ ! -d /sys/dev/block ] 2>/dev/null; then
        DISK_COUNT=0
        DISK_LIST=""
        HAS_MULTIPLE_DISKS=false
        return 0
    fi
    local disks
    disks=$(lsblk -d -n -o NAME,TYPE 2>/dev/null | grep -E "disk|nvme" | awk '{print $1}' | sort)
    # Count disks
    DISK_COUNT=$(echo "$disks" | wc -l)
    DISK_LIST="$disks"
    if [ "$DISK_COUNT" -gt 1 ]; then
        HAS_MULTIPLE_DISKS=true
        get_disk_mount_info
    else
        HAS_MULTIPLE_DISKS=false
    fi
}

# Function to get mount information for all disks
get_disk_mount_info() {
    DISK_MOUNT_INFO=""
    [ ! -d /sys/dev/block ] 2>/dev/null && return 0
    while IFS= read -r disk; do
        if [ -n "$disk" ]; then
            local disk_path="/dev/$disk"
            local disk_info=""
            local disk_size mount_points fs_type disk_model
            disk_size=$(lsblk -d -n -o SIZE "$disk_path" 2>/dev/null || echo "Unknown")
            mount_points=$(lsblk -n -o MOUNTPOINT "$disk_path" 2>/dev/null | grep -v "^$" | tr '\n' ',' | sed 's/,$//')
            fs_type=$(lsblk -d -n -o FSTYPE "$disk_path" 2>/dev/null || echo "Unknown")
            disk_model=$(lsblk -d -n -o MODEL "$disk_path" 2>/dev/null || echo "Unknown")
            local is_mounted="No"
            [ -n "$mount_points" ] && is_mounted="Yes"
            disk_info="Disk: $disk_path | Size: $disk_size | Model: $disk_model | FS: $fs_type | Mounted: $is_mounted"
            [ -n "$mount_points" ] && disk_info="$disk_info | Mount Points: $mount_points"
            DISK_MOUNT_INFO="$DISK_MOUNT_INFO$disk_info\n"
        fi
    done <<< "$DISK_LIST"
}

# Function to get available mount points for additional disks
get_available_mount_points() {
    local available_mounts=""
    
    # Check common mount point directories
    local common_mounts=("/mnt" "/media" "/opt" "/var" "/home")
    
    for mount_dir in "${common_mounts[@]}"; do
        if [ -d "$mount_dir" ]; then
            # Check if directory is writable and has space
            if [ -w "$mount_dir" ]; then
                local available_space=$(df "$mount_dir" 2>/dev/null | awk 'NR==2 {print $4}')
                if [ -n "$available_space" ] && [ "$available_space" -gt 1048576 ]; then  # More than 1MB
                    available_mounts="$available_mounts$mount_dir (Available: ${available_space}KB)\n"
                fi
            fi
        fi
    done
    
    if [ -n "$available_mounts" ]; then
        # Available mount points found
        true
    else
        # No suitable mount points found
        true
    fi
}

# Function to suggest optimal disk usage strategy
suggest_disk_usage_strategy() {
    if [ "$HAS_MULTIPLE_DISKS" = true ]; then
        # Multi-disk usage strategy suggestions
        # System has multiple disks available
        # Recommended disk usage strategy:
        # 1. Primary disk (/dev/sda): System files, OS, and core applications
        # 2. Secondary disk (/dev/sdb): Data storage, web content, and user files
        # 3. Additional disks: Backup storage, logs, or specialized applications
        # Suggested mount points for additional disks:
        get_available_mount_points
        # To mount additional disks, consider:
        # - /mnt/data for general data storage
        # - /mnt/web for web content
        # - /mnt/backup for backup storage
        # - /mnt/logs for log files
    else
        # Single disk system - no additional disk configuration needed
        true
    fi
}

# Execute multi-disk detection
detect_multiple_disks

# Initialize global variables function (compatibility placeholder)
init_global_vars() {
    # Global variables are already initialized above
    # This function exists for compatibility with existing scripts
    return 0
}

# Export the function
export -f init_global_vars

# Export key variables for use by other scripts
export USE_SUDO
export CORE_NODE_PROJECT_ROOT
export IS_WSL
export IS_PRODUCTION
export IS_DESKTOP_WITH_WINDOWS
export HAS_DESKTOP_ENVIRONMENT
export IS_HEADLESS_SERVER
export DESKTOP_ENVIRONMENT
export CURRENT_USER
export DESKTOP_WINDOWS_MOUNT_PATH
export DESKTOP_WINDOWS_DRIVES
export DESKTOP_LARGEST_WINDOWS_DRIVE
export DESKTOP_LARGEST_WINDOWS_PATH
export HAS_MULTIPLE_DISKS
export DISK_COUNT
export DISK_LIST
export DISK_MOUNT_INFO
export GLOBAL_TEMP_DIR
export GLOBAL_VAR_DIR
export CORE_NODE_DATA_DIR
export CORE_NODE_SHARED_DOWNLOADS

