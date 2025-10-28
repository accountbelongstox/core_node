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

# Detect environment type
IS_WSL=false
IS_PRODUCTION=false
IS_DESKTOP_WITH_WINDOWS=false
HAS_DESKTOP_ENVIRONMENT=false
DESKTOP_ENVIRONMENT=""
CURRENT_USER=""
DESKTOP_WINDOWS_MOUNT_PATH=""
DESKTOP_WINDOWS_DRIVES=""
WSL_USERS_PATH="/mnt/c/Users"

# Check and set sudo
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# Core Node project root directory
CORE_NODE_PROJECT_ROOT=""

# Function to detect desktop environment
detect_desktop_environment() {
    # Check for X11 session
    if [ -n "$DISPLAY" ] && [ "$DISPLAY" != ":0" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
    fi

    # Check for Wayland session
    if [ -n "$WAYLAND_DISPLAY" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
    fi

    # Check for common desktop environment variables
    if [ -n "$XDG_CURRENT_DESKTOP" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
        DESKTOP_ENVIRONMENT="$XDG_CURRENT_DESKTOP"
    elif [ -n "$DESKTOP_SESSION" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
        DESKTOP_ENVIRONMENT="$DESKTOP_SESSION"
    fi

    # Check for running desktop processes
    if pgrep -x "gnome-session\|kde-session\|xfce4-session\|mate-session\|cinnamon-session\|lxde-session\|lxqt-session\|openbox\|fluxbox\|i3\|awesome\|dwm" >/dev/null 2>&1; then
        HAS_DESKTOP_ENVIRONMENT=true
    fi

    # Check for desktop environment directories
    if [ -d "/usr/share/xsessions" ] || [ -d "/usr/share/wayland-sessions" ]; then
        # Additional check: see if we're in a graphical session
        if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
            HAS_DESKTOP_ENVIRONMENT=true
        fi
    fi

    # Check for WSL with desktop environment
    if [ "$IS_WSL" = true ]; then
        # In WSL, check if X11 forwarding is available or if WSLg is running
        if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ] || pgrep -x "wslg" >/dev/null 2>&1; then
            HAS_DESKTOP_ENVIRONMENT=true
        fi
    fi
}

# Detect desktop environment first
detect_desktop_environment

# Check if running in WSL
if [ -d "$WSL_USERS_PATH" ]; then
    IS_WSL=true
elif [ "$HAS_DESKTOP_ENVIRONMENT" = false ]; then
    # Not WSL and no desktop environment = production server
    IS_PRODUCTION=true
fi

# Function to get optimal base directory for data storage
# Priority: WSL /mnt/d -> NTFS mount -> Data disk mount -> /www
get_base_data_directory() {
    local base_dir=""

    # Priority 1: WSL /mnt/d
    if [ "$IS_WSL" = true ]; then
        base_dir="/mnt/d"
        echo "$base_dir"
        return 0
    fi

    # Priority 2: NTFS mount point (derived from device detection)
    if has_ntfs_disk; then
        # Get first NTFS device
        local ntfs_device=$($USE_SUDO blkid | grep -i "TYPE=\"ntfs\"" | head -n 1 | cut -d: -f1)
        if [ -n "$ntfs_device" ]; then
            # Derive standard mount point from device name
            local ntfs_mount=$(device_to_mount_point "$ntfs_device")
            if [ -d "$ntfs_mount" ] && [ -w "$ntfs_mount" ]; then
                base_dir="$ntfs_mount"
                echo "$base_dir"
                return 0
            fi
        fi
    fi

    # Priority 3: Data disk mount point (derived from device detection)
    local data_device=$($USE_SUDO blkid | grep -iE "TYPE=\"(ext4|xfs|btrfs)\"" | head -n 1 | cut -d: -f1)
    if [ -n "$data_device" ]; then
        # Check if it's not root or boot partition
        local mount_point=$(findmnt -n -o TARGET "$data_device" 2>/dev/null || echo "")
        if [ "$mount_point" != "/" ] && [ "$mount_point" != "/boot" ]; then
            # Derive standard mount point from device name
            local data_mount=$(device_to_mount_point "$data_device")
            if [ -d "$data_mount" ] && [ -w "$data_mount" ]; then
                base_dir="$data_mount"
                echo "$base_dir"
                return 0
            fi
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

# Function to detect desktop environment
detect_desktop_environment() {
    # Check for X11 session
    if [ -n "$DISPLAY" ] && [ "$DISPLAY" != ":0" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
    fi
    
    # Check for Wayland session
    if [ -n "$WAYLAND_DISPLAY" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
    fi
    
    # Check for common desktop environment variables
    if [ -n "$XDG_CURRENT_DESKTOP" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
        DESKTOP_ENVIRONMENT="$XDG_CURRENT_DESKTOP"
    elif [ -n "$DESKTOP_SESSION" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
        DESKTOP_ENVIRONMENT="$DESKTOP_SESSION"
    fi
    
    # Check for running desktop processes
    if pgrep -x "gnome-session\|kde-session\|xfce4-session\|mate-session\|cinnamon-session\|lxde-session\|lxqt-session\|openbox\|fluxbox\|i3\|awesome\|dwm" >/dev/null 2>&1; then
        HAS_DESKTOP_ENVIRONMENT=true
    fi
    
    # Check for desktop environment directories
    if [ -d "/usr/share/xsessions" ] || [ -d "/usr/share/wayland-sessions" ]; then
        # Additional check: see if we're in a graphical session
        if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
            HAS_DESKTOP_ENVIRONMENT=true
        fi
    fi
    
    # Check for WSL with desktop environment
    if [ "$IS_WSL" = true ]; then
        # In WSL, check if X11 forwarding is available or if WSLg is running
        if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ] || pgrep -x "wslg" >/dev/null 2>&1; then
            HAS_DESKTOP_ENVIRONMENT=true
        fi
    fi
}

# Detect desktop environment
detect_desktop_environment

# Detect desktop system with Windows drives
detect_desktop_windows_drives

# Set core node project root directory (derived from base data directory)
# WSL/NTFS/Desktop environment: base_dir/programing/core_node
# Production server (no desktop, no data disk): base_dir/wwwroot/core_node
get_core_node_project_root() {
    local base_dir=$(get_base_data_directory)

    # Check if this is WSL, has NTFS disk, or has desktop environment
    if [ "$IS_WSL" = true ] || [ "$HAS_DESKTOP_ENVIRONMENT" = true ] || has_ntfs_disk 2>/dev/null; then
        # For WSL: use Linux path structure
        if [ "$IS_WSL" = true ]; then
            echo "$base_dir/programing/core_node"
        else
            echo "$base_dir/programing/core_node"
        fi
    else
        # Production server without desktop/NTFS
        echo "$base_dir/wwwroot/core_node"
    fi
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
    # Get list of all block devices (excluding loop devices and partitions)
    local disks=$(lsblk -d -n -o NAME,TYPE | grep -E "disk|nvme" | awk '{print $1}' | sort)
    
    # Count disks
    DISK_COUNT=$(echo "$disks" | wc -l)
    DISK_LIST="$disks"
    
    # Check if we have multiple disks
    if [ "$DISK_COUNT" -gt 1 ]; then
        HAS_MULTIPLE_DISKS=true
        # Get detailed mount information for each disk
        get_disk_mount_info
    else
        HAS_MULTIPLE_DISKS=false
    fi
}

# Function to get mount information for all disks
get_disk_mount_info() {
    DISK_MOUNT_INFO=""
    
    # Process each disk
    while IFS= read -r disk; do
        if [ -n "$disk" ]; then
            local disk_path="/dev/$disk"
            local disk_info=""
            
            # Get disk size
            local disk_size=$(lsblk -d -n -o SIZE "$disk_path" 2>/dev/null || echo "Unknown")
            
            # Get mount points for this disk
            local mount_points=$(lsblk -n -o MOUNTPOINT "$disk_path" 2>/dev/null | grep -v "^$" | tr '\n' ',' | sed 's/,$//')
            
            # Get filesystem type
            local fs_type=$(lsblk -d -n -o FSTYPE "$disk_path" 2>/dev/null || echo "Unknown")
            
            # Get disk model/vendor
            local disk_model=$(lsblk -d -n -o MODEL "$disk_path" 2>/dev/null || echo "Unknown")
            
            # Check if disk is mounted
            local is_mounted="No"
            if [ -n "$mount_points" ]; then
                is_mounted="Yes"
            fi
            
            # Build disk information string
            disk_info="Disk: $disk_path | Size: $disk_size | Model: $disk_model | FS: $fs_type | Mounted: $is_mounted"
            if [ -n "$mount_points" ]; then
                disk_info="$disk_info | Mount Points: $mount_points"
            fi
            
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

# System detection variables (merged from gvar_common.sh)
PRE_COMPILE_DIR=".dev"
OS_ID=""
OS_VERSION_ID=""
OS_NAME=""
SYSTEM_NAME=""
SYSTEM_VERSION=""
SYS_DIR=""

# System detection (merged from gvar_common.sh)
if [ -f /etc/os-release ]; then
    OS_ID=$(awk -F= '/^ID=/ { print $2 }' /etc/os-release | tr -d '"')
    OS_VERSION_ID=$(awk -F= '/^VERSION_ID=/ { print $2 }' /etc/os-release | tr -d '"')
    OS_NAME=$(awk -F= '/^NAME=/ { print $2 }' /etc/os-release | tr -d '"')

    # Handle special cases
    case "$OS_ID" in
    "centos" | "rhel" | "fedora")
        SYSTEM_NAME="centos"
        SYSTEM_VERSION="$OS_VERSION_ID"
        SYS_DIR="${PRE_COMPILE_DIR}_centos${OS_VERSION_ID}"
        ;;
    "ubuntu")
        SYSTEM_NAME="ubuntu"
        SYSTEM_VERSION="$OS_VERSION_ID"
        SYS_DIR="${PRE_COMPILE_DIR}_ubuntu${OS_VERSION_ID}"
        ;;
    "debian")
        SYSTEM_NAME="debian"
        SYSTEM_VERSION="$OS_VERSION_ID"
        SYS_DIR="${PRE_COMPILE_DIR}_debian${OS_VERSION_ID}"
        ;;
    "almalinux" | "rocky")
        SYSTEM_NAME="centos" # Treat AlmaLinux/Rocky as CentOS for compatibility
        SYSTEM_VERSION="$OS_VERSION_ID"
        SYS_DIR="${PRE_COMPILE_DIR}_centos${OS_VERSION_ID}"
        ;;
    *)
        SYSTEM_NAME="$OS_ID"
        SYSTEM_VERSION="$OS_VERSION_ID"
        SYS_DIR="${PRE_COMPILE_DIR}_${OS_ID}${OS_VERSION_ID}"
        ;;
    esac
elif [ -f /etc/redhat-release ]; then
    # Older RedHat-based systems
    SYSTEM_NAME="centos"
    SYSTEM_VERSION=$(cat /etc/redhat-release | sed -e 's/.*release \([0-9]\+\).*/\1/')
    SYS_DIR="${PRE_COMPILE_DIR}_centos${SYSTEM_VERSION}"
elif [ -f /etc/lsb-release ]; then
    # Older Ubuntu systems
    . /etc/lsb-release
    SYSTEM_NAME="${DISTRIB_ID,,}"
    SYSTEM_VERSION="$DISTRIB_RELEASE"
    SYS_DIR="${PRE_COMPILE_DIR}_${SYSTEM_NAME}${SYSTEM_VERSION}"
else
    # Fallback to uname
    SYSTEM_NAME=$(uname -s | tr '[:upper:]' '[:lower:]')
    SYSTEM_VERSION=$(uname -r)
    SYS_DIR="${PRE_COMPILE_DIR}_${SYSTEM_NAME}${SYSTEM_VERSION}"
fi

# Directory variables will be set after map_web_path function is defined

# Additional directory variables
SHELLS_DIR=""
SHELLS_SCRIPTS_DIR=""
CORE_SCRIPTS_DIR=""

# Set directory variables based on script location
if [ -n "${BASH_SOURCE[0]}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SHELLS_DIR="$(dirname "$SCRIPT_DIR")"
    SHELLS_SCRIPTS_DIR="$SHELLS_DIR/scripts"
    CORE_SCRIPTS_DIR="$(dirname "$SHELLS_DIR")"
fi

# Installation directories will be set after map_web_path function is defined

# Function to get system information (merged from gvar_common.sh)
get_system_info() {
    echo "${SYSTEM_NAME}_${SYSTEM_VERSION}"
}

# Export additional variables (merged from gvar_common.sh)
export PRE_COMPILE_DIR
export OS_ID
export OS_VERSION_ID
export OS_NAME
export SYSTEM_NAME
export SYSTEM_VERSION
export SYSTEM_FULL_NAME="${SYSTEM_NAME}_${SYSTEM_VERSION}"
export SYS_DIR
export BASE_DIR
export WIS_PROGRAMING_DIR
export COMPILE_DIR
export POETRY_HOME
export POETRY_LINK
export NODE_INSTALL_DIR
export NODE_SHORT_VERSION
export NODE_VERSION
export NODE_DOWNLOAD_URL
export NODE_BIN
export GO_DIR
export GO_BIN
export GO_VERSION_AMD64_FILE
export GO_TAR_URL
export RUBY_INSTALL_DIR
export RUBY_GEM_HOME
export RUBY_GEM_BIN_DIR
export UPS_CONF
export UPSD_CONF
export UPSD_USERS_CONF
export UPSMON_CONF
export MCP_SOURCE_DIR
export MCP_SERVER_DIR
export MCP_LOCAL_DIR
export SCRIPT_DIR
export SHELLS_DIR
export SHELLS_SCRIPTS_DIR
export CORE_SCRIPTS_DIR

# Function to get disk information for other scripts
get_disk_info() {
    local info_type="$1"
    
    case "$info_type" in
        "count")
            echo "$DISK_COUNT"
            ;;
        "list")
            echo "$DISK_LIST"
            ;;
        "multiple")
            if [ "$HAS_MULTIPLE_DISKS" = true ]; then
                echo "true"
            else
                echo "false"
            fi
            ;;
        "mount_info")
            echo -e "$DISK_MOUNT_INFO"
            ;;
        "suggest")
            suggest_disk_usage_strategy
            ;;
        *)
            echo "Usage: get_disk_info [count|list|multiple|mount_info|suggest]"
            echo "  count: Number of disks"
            echo "  list: List of disk names"
            echo "  multiple: true/false if multiple disks exist"
            echo "  mount_info: Detailed mount information"
            echo "  suggest: Disk usage strategy suggestions"
            ;;
    esac
}

# Export disk detection variables for use in other scripts
export HAS_MULTIPLE_DISKS
export DISK_COUNT
export DISK_LIST
export DISK_MOUNT_INFO

# Function to help with disk mounting operations
mount_additional_disk() {
    local disk_device="$1"
    local mount_point="$2"
    local filesystem_type="${3:-ext4}"
    
    if [ -z "$disk_device" ] || [ -z "$mount_point" ]; then
        echo "Usage: mount_additional_disk <device> <mount_point> [filesystem_type]"
        echo "Example: mount_additional_disk /dev/sdb /mnt/data ext4"
        return 1
    fi
    
    # Check if device exists
    if [ ! -b "$disk_device" ]; then
        echo "Error: Device $disk_device does not exist"
        return 1
    fi
    
    # Check if mount point exists, create if not
    if [ ! -d "$mount_point" ]; then
        echo "Creating mount point: $mount_point"
        $USE_SUDO mkdir -p "$mount_point"
    fi
    
    # Check if device is already mounted
    if mountpoint -q "$mount_point"; then
        echo "Warning: $mount_point is already mounted"
        return 1
    fi
    
    # Check if device has a filesystem
    if ! blkid "$disk_device" >/dev/null 2>&1; then
        echo "Device $disk_device has no filesystem. Creating $filesystem_type filesystem..."
        $USE_SUDO mkfs.$filesystem_type "$disk_device"
    fi
    
    # Mount the device
    echo "Mounting $disk_device to $mount_point..."
    if $USE_SUDO mount "$disk_device" "$mount_point"; then
        echo "Successfully mounted $disk_device to $mount_point"
        
        # Set proper permissions
        $USE_SUDO chmod 755 "$mount_point"
        
        # Add to fstab for persistent mounting
        local uuid=$(blkid -s UUID -o value "$disk_device")
        if [ -n "$uuid" ]; then
            local fstab_entry="UUID=$uuid $mount_point $filesystem_type defaults 0 2"
            if ! grep -q "$mount_point" /etc/fstab; then
                echo "Adding to /etc/fstab for persistent mounting..."
                echo "$fstab_entry" | $USE_SUDO tee -a /etc/fstab >/dev/null
            fi
        fi
        
        return 0
    else
        echo "Failed to mount $disk_device to $mount_point"
        return 1
    fi
}

# Determine CORE_NODE_DATA_DIR based on environment
CORE_NODE_DATA_DIR="/usr/.core_node"

# Check if WSL Windows users path exists
if [ -d "$WSL_USERS_PATH" ]; then
    # Loop through each user directory
    for user_dir in "$WSL_USERS_PATH"/*; do
        if [ -d "$user_dir" ]; then
            potential_dir="$user_dir/.core_node"

            # Check if the .core_node directory exists
            if [ -d "$potential_dir" ]; then
                CORE_NODE_DATA_DIR="$potential_dir"
                break
            fi
        fi
    done
fi

GLOBAL_VAR_DIR="$CORE_NODE_DATA_DIR/global_var"

# Function to map paths based on environment (using get_base_data_directory)
map_web_path() {
    local path_key="$1"
    local sub_path="$2"
    local mapped_path=""
    local base_path=""

    # Get optimal base directory
    local data_base=$(get_base_data_directory)

    # Determine base path for www based on environment
    if [ "$IS_WSL" = true ]; then
        base_path="$data_base/www"
    elif [ "$IS_PRODUCTION" = true ]; then
        base_path="/www"
    else
        # Use data base directory + www
        base_path="$data_base/www"
    fi

    # Map paths using common base path
    case "$path_key" in
        "wwwroot")
            mapped_path="$base_path/wwwroot"
            ;;
        "nginxconfig")
            mapped_path="$base_path/nginxconfig"
            ;;
        "shared-data")
            mapped_path="$base_path/shared-data"
            ;;
        "backup")
            mapped_path="$base_path/backup"
            ;;
        "www")
            mapped_path="$base_path"
            ;;
        "compile_dir")
            # Compile directory for development languages
            # Development (WSL/Desktop/NTFS): base_dir/_system_version (with underscore prefix)
            # Production server: /usr/system_version
            # Format: _ubuntu_24, _debian_12, _centos_8 (development) or ubuntu_24, debian_12 (production)
            local sys_name="${SYSTEM_NAME}"
            local sys_version=$(echo "${SYSTEM_VERSION}" | cut -d. -f1)

            # Check if this is development environment (same logic as get_core_node_project_root)
            if [ "$IS_WSL" = true ] || [ "$HAS_DESKTOP_ENVIRONMENT" = true ] || has_ntfs_disk 2>/dev/null; then
                # Development: base_dir/_system_version (with underscore prefix)
                local data_base=$(get_base_data_directory)
                mapped_path="${data_base}/_${sys_name}_${sys_version}"
            else
                # Production server without desktop/NTFS: /usr/system_version
                mapped_path="/usr/${sys_name}_${sys_version}"
            fi
            ;;
        "applications_dir")
            # Applications directory - same location as compile_dir for consistency
            local sys_name="${SYSTEM_NAME}"
            local sys_version=$(echo "${SYSTEM_VERSION}" | cut -d. -f1)

            # Check if this is development environment (same logic as compile_dir)
            if [ "$IS_WSL" = true ] || [ "$HAS_DESKTOP_ENVIRONMENT" = true ] || has_ntfs_disk 2>/dev/null; then
                # Development: base_dir/_system_version/applications (with underscore prefix)
                local data_base=$(get_base_data_directory)
                mapped_path="${data_base}/_${sys_name}_${sys_version}/applications"
            else
                # Production server without desktop/NTFS: /usr/.core_node/applications
                mapped_path="/usr/.core_node/applications"
            fi
            ;;
        "nginx")
            # Keep /etc/nginx in Linux filesystem
            mapped_path="/etc/nginx"
            ;;
        "php")
            # Keep /etc/php in Linux filesystem
            mapped_path="/etc/php"
            ;;
        "logs")
            # Keep logs in Linux filesystem
            mapped_path="/var/log"
            ;;
        *)
            # Default: return the key as-is (assume it's already a path)
            mapped_path="$path_key"
            ;;
    esac

    # If sub_path is provided, concatenate it to the mapped path
    if [ -n "$sub_path" ]; then
        # Remove leading slash from sub_path if present to avoid double slashes
        sub_path=$(echo "$sub_path" | sed 's|^/||')
        mapped_path="$mapped_path/$sub_path"
    fi

    # Create directory if it doesn't exist (only for web-related paths, not system paths)
    # IMPORTANT RULE:
    # - Never auto-create directories when sub_path is provided
    # - Only auto-create the main path_key directories when explicitly needed
    # - Scripts should use ensure_web_directory() for intentional directory creation
    case "$path_key" in
        "wwwroot"|"nginxconfig"|"shared-data"|"backup"|"compile_dir")
            # Only auto-create if no sub_path is provided (these are the target installation paths)
            if [ -z "$sub_path" ] && [ ! -d "$mapped_path" ]; then
                echo "Creating directory: $mapped_path"
                $USE_SUDO mkdir -p "$mapped_path"
                # Set proper permissions (skip chown in desktop Windows as it may not support it)
                if [ "$IS_DESKTOP_WITH_WINDOWS" = false ]; then
                    $USE_SUDO chown www-data:www-data "$mapped_path" 2>/dev/null || true
                fi
                $USE_SUDO chmod 755 "$mapped_path" 2>/dev/null || true
            fi
            ;;
        "www")
            # For "www" path, NEVER auto-create when sub_path is provided
            # Callers should use ensure_web_directory() for sub-paths like "mysql", "code-server", etc.
            # Only create the base www directory itself if no sub_path
            if [ -z "$sub_path" ] && [ ! -d "$mapped_path" ]; then
                echo "Creating directory: $mapped_path"
                $USE_SUDO mkdir -p "$mapped_path"
                # Set proper permissions (skip chown in desktop Windows as it may not support it)
                if [ "$IS_DESKTOP_WITH_WINDOWS" = false ]; then
                    $USE_SUDO chown www-data:www-data "$mapped_path" 2>/dev/null || true
                fi
                $USE_SUDO chmod 755 "$mapped_path" 2>/dev/null || true
            fi
            ;;
    esac

    echo "$mapped_path"
    return 0
}

# Function to ensure directory exists with proper permissions
ensure_web_directory() {
    local path_key="$1"
    local permissions="${2:-755}"
    local owner="${3:-www-data:www-data}"

    # Map to appropriate path using string key
    local actual_path=$(map_web_path "$path_key")

    # Create directory if it doesn't exist
    if [ ! -d "$actual_path" ]; then
        echo "Creating directory: $actual_path (mapped from key: $path_key)"
        $USE_SUDO mkdir -p "$actual_path"
    fi

    # Set permissions
    $USE_SUDO chmod "$permissions" "$actual_path" 2>/dev/null || true

    # Set owner (only if not in WSL, Windows filesystem doesn't support chown)
    if [ "$IS_WSL" = false ]; then
        $USE_SUDO chown "$owner" "$actual_path" 2>/dev/null || true
    fi

    echo "$actual_path"
    return 0
}

# Initialize global temporary directory
GLOBAL_TEMP_DIR="/usr/tmp"

# Ensure global temporary directory exists
if [ ! -d "$GLOBAL_TEMP_DIR" ]; then
    echo "Creating global temporary directory: $GLOBAL_TEMP_DIR"
    $USE_SUDO mkdir -p "$GLOBAL_TEMP_DIR"
    $USE_SUDO chmod 755 "$GLOBAL_TEMP_DIR"
fi

# Function to create script-specific temporary directory
create_script_temp_dir() {
    local script_name="$1"
    local script_temp_dir="$GLOBAL_TEMP_DIR/$script_name"

    if [ ! -d "$script_temp_dir" ]; then
        $USE_SUDO mkdir -p "$script_temp_dir"
        $USE_SUDO chmod 777 "$script_temp_dir"
        # Ensure current user can write to this directory
        if [ -n "$USER" ] && [ "$USER" != "root" ]; then
            $USE_SUDO chown -R "$USER:$USER" "$script_temp_dir" 2>/dev/null || true
        fi
    fi

    echo "$script_temp_dir"
    return 0
}

# Function to clean up script-specific temporary directory
cleanup_script_temp_dir() {
    local script_name="$1"
    local script_temp_dir="$GLOBAL_TEMP_DIR/$script_name"
    
    if [ -d "$script_temp_dir" ]; then
        echo "Cleaning up temporary directory: $script_temp_dir"
        $USE_SUDO rm -rf "$script_temp_dir"
    fi
}

# Ensure the global variable directory exists
if [ ! -d "$GLOBAL_VAR_DIR" ]; then
    $USE_SUDO mkdir -p "$GLOBAL_VAR_DIR" 2>/dev/null || mkdir -p "$GLOBAL_VAR_DIR" 2>/dev/null || true
    echo "Created global variable directory: $GLOBAL_VAR_DIR"
fi

# Set IS_GLOBAL based on SELECTED_REGION
set_is_global() {
    local selected_region=$(get_global_var "SELECTED_REGION" "Global")
    if [ "$selected_region" = "Global" ]; then
        IS_GLOBAL="true"
    else
        IS_GLOBAL="false"
    fi
}

# Helper function to normalize key and get file path
_get_var_file_path() {
    local key="$1"
    # Convert key to uppercase and remove any special characters
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]' | tr -cd '[:alnum:]_')
    echo "$GLOBAL_VAR_DIR/$key"
}

# Function to store path in global variables
store_path() {
    local name=$1
    local path=$2
    if [[ -n "$path" ]]; then
        set_var "${name}_path" "$path"
        echo "${name} path stored: $path"
    else
        echo "Warning: Could not find ${name} path"
    fi
}

# Function to set global variable in file
set_global_var() {
    local key="$1"
    local val="$2"
    local print="$3"

    # Check if parameters are provided
    if [[ -z "$key" ]] || [[ -z "$val" ]]; then
        echo "Error: Both key and value must be provided"
        echo "Usage: set_global_var <key> <value>"
        return 1
    fi

    # Get normalized file path
    local file_path=$(_get_var_file_path "$key")

    # Write value to file
    echo "$val" | $USE_SUDO tee "$file_path" >/dev/null
    if [[ $? -eq 0 ]]; then
        if [[ "$print" == "false" ]]; then
            echo "Successfully set global variable: $key -> $val"
        fi
        return 0
    else
        echo "Error: Failed to write to $file_path"
        return 1
    fi
}

# Function to get global variable from file
get_global_var() {
    local key="$1"
    local default_value="$2"

    # Check if key is provided
    if [[ -z "$key" ]]; then
        echo "Error: Key must be provided"
        echo "Usage: get_global_var <key> [default_value]"
        return 1
    fi

    # Get normalized file path
    local file_path=$(_get_var_file_path "$key")

    # Check if file exists
    if [[ ! -f "$file_path" ]]; then
        # Return default value if provided, otherwise return empty string
        echo "${default_value:-}"
        return 0
    fi

    # Read and return the value
    local val=$($USE_SUDO cat "$file_path" 2>/dev/null)
    if [[ $? -eq 0 ]]; then
        echo "$val"
        return 0
    else
        # Return default value if read fails
        echo "${default_value:-}"
        return 0
    fi
}

# Alias for get_global_var for backward compatibility
get_var() {
    get_global_var "$@"
}

# Function to clear all global variables
clear_all_global_vars() {
    if [[ ! -d "$GLOBAL_VAR_DIR" ]]; then
        echo "Global variable directory does not exist"
        return 0
    fi

    # Remove all files in the directory
    $USE_SUDO rm -f "$GLOBAL_VAR_DIR"/*
    if [[ $? -eq 0 ]]; then
        echo "Successfully cleared all global variables"
        return 0
    else
        echo "Error: Failed to clear global variables"
        return 1
    fi
}

# Function to set multiple global variables with value 'true'
set_multiple_global_vars() {
    local keys=("$@")
    local success=true

    if [[ ${#keys[@]} -eq 0 ]]; then
        echo "Error: No keys provided"
        echo "Usage: set_multiple_global_vars key1 key2 key3 ..."
        return 1
    fi

    for key in "${keys[@]}"; do
        if ! set_global_var "$key" "true"; then
            echo "Failed to set key: $key"
            success=false
        fi
    done

    if [[ "$success" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

# Function to remove one or more global variables
remove_global_vars() {
    local keys=("$@")
    local success=true

    if [[ ${#keys[@]} -eq 0 ]]; then
        echo "Error: No keys provided"
        echo "Usage: remove_global_vars key1 key2 key3 ..."
        return 1
    fi

    for key in "${keys[@]}"; do
        # Get normalized file path
        local file_path=$(_get_var_file_path "$key")

        if [[ -f "$file_path" ]]; then
            $USE_SUDO rm -f "$file_path"
            if [[ $? -eq 0 ]]; then
                echo "Successfully removed global variable: $key"
            else
                echo "Failed to remove global variable: $key"
                success=false
            fi
        else
            echo "Global variable not found: $key"
        fi
    done

    if [[ "$success" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

# Function to check if system is Debian-based (includes both Debian and Ubuntu)
is_debian_based() {
    if [[ -f /etc/debian_version ]]; then
        return 0
    else
        return 1
    fi
}

# Function to check if system is Debian
is_debian() {
    if is_debian_based && [[ ! -f /etc/lsb-release ]]; then
        return 0
    else
        return 1
    fi
}

# Function to check if system is Ubuntu
is_ubuntu() {
    if [[ -f /etc/lsb-release ]] && grep -qi "ubuntu" /etc/lsb-release; then
        return 0
    else
        return 1
    fi
}

# Function to check if system is CentOS/RHEL based
is_centos() {
    if [[ -f /etc/centos-release ]] || [[ -f /etc/redhat-release ]] ||
        ([[ -f /etc/os-release ]] && grep -qiE "centos|rhel|rocky|almalinux" /etc/os-release); then
        return 0
    else
        return 1
    fi
}

# Alias for set_global_var for backward compatibility
set_var() {
    set_global_var "$@"
}

# Function to set a variable both in global_var and /etc/environment
set_env_and_var() {
    local key="$1"
    local val="$2"
    set_var "$key" "$val"

    # Ensure /etc/environment contains the variable
    if grep -q "^${key}=" /etc/environment; then
        $USE_SUDO sed -i "s|^${key}=.*|${key}=\"${val}\"|g" /etc/environment
    else
        echo "${key}=\"${val}\"" | $USE_SUDO tee -a /etc/environment >/dev/null
    fi
    if [ "$USE_SUDO" = "sudo" ]; then
        sudo bash -c "source /etc/environment"
    else
        source /etc/environment
    fi
}

# Set Puppeteer skip download globally by default
set_env_and_var "PUPPETEER_SKIP_DOWNLOAD" "true"

# Git SSH related URLs - Auto-switch based on region
SELECTED_REGION=$(get_global_var "SELECTED_REGION" "Global" 2>/dev/null || echo "Global")

if [[ "$SELECTED_REGION" == "China" ]]; then
    GIT_SSH_BASE_URL="https://gitee.com/accountbelongstox/core_node/raw/main"
else
    GIT_SSH_BASE_URL="https://raw.githubusercontent.com/accountbelongstox/core_node/main"
fi

GIT_SSH_PUB_URL="$GIT_SSH_BASE_URL/scripts/git/git.ssh.id.ed.pub.js"
GIT_SSH_KEY_URL="$GIT_SSH_BASE_URL/scripts/git/git.ssh.id.ed.js"

# SSH directory configuration
# Always use user's .ssh directory for Git SSH keys
# This ensures Git can find the keys regardless of user privileges
SSH_DIR="$HOME/.ssh"
if [[ "$EUID" -eq 0 ]]; then
    SSH_INSTALLED_FLAG="$GLOBAL_VAR_DIR/SSH_KEYS_INSTALLED_ROOT"
else
    SSH_INSTALLED_FLAG="$GLOBAL_VAR_DIR/SSH_KEYS_INSTALLED_USER"
fi

# Export SSH related variables
export GIT_SSH_BASE_URL
export GIT_SSH_PUB_URL
export GIT_SSH_KEY_URL
export SSH_DIR
export SSH_INSTALLED_FLAG

# Export the GLOBAL_VAR_DIR and GLOBAL_TEMP_DIR
export GLOBAL_VAR_DIR
export GLOBAL_TEMP_DIR
export COMPILE_DIR

# Initialize batch decryption flag
BATCH_DECRYPTION_COMPLETED=false

# Function to detect and return CORE_NODE_DIR dynamically based on gvar_common.sh location
get_core_node_dir() {
    # Calculate CORE_NODE_DIR based on gvar_common.sh location
    # gvar_common.sh is at: core_node/scripts/shells/linux/common/gvar_common.sh
    # So we need to go up 4 levels: common -> linux -> shells -> scripts -> core_node

    local gvar_common_path="${BASH_SOURCE[0]}"

    # Resolve to absolute path if it's a symlink
    if [ -L "$gvar_common_path" ]; then
        gvar_common_path="$(readlink -f "$gvar_common_path")"
    fi

    # Get directory of gvar_common.sh
    local gvar_common_dir="$(cd "$(dirname "$gvar_common_path")" && pwd)"

    # Go up 4 levels to reach core_node root
    # common -> linux -> shells -> scripts -> core_node
    local core_node_dir="$(dirname "$(dirname "$(dirname "$(dirname "$gvar_common_dir")")")")"

    # Verify this is actually core_node directory by checking for markers
    if [ ! -d "$core_node_dir/.secret_keys" ] && [ ! -f "$core_node_dir/package.json" ]; then
        # Fallback: try environment variable
        if [ -n "$CORE_NODE_DIR" ]; then
            core_node_dir="$CORE_NODE_DIR"
        else
            # Fallback: check common paths based on environment
            if [ "$IS_WSL" = true ] && [ -d "/mnt/d/programing/core_node" ]; then
                core_node_dir="/mnt/d/programing/core_node"
            elif [ -d "/usr/wwwroot/core_node" ]; then
                core_node_dir="/usr/wwwroot/core_node"
            elif [ -d "/opt/core_node" ]; then
                core_node_dir="/opt/core_node"
            else
                # Final fallback
                core_node_dir="/opt/core_node"
            fi
        fi
    fi

    echo "$core_node_dir"
}

# Export CORE_NODE_DIR for use in other scripts
export CORE_NODE_DIR=$(get_core_node_dir)

# Debug function to analyze path issues
debug_path_analysis() {
    echo "=== PATH ANALYSIS DEBUG ==="
    echo "Current script location: ${BASH_SOURCE[0]}"
    echo "Script directory: $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    echo "IS_WSL: $IS_WSL"
    echo "IS_PRODUCTION: $IS_PRODUCTION"
    echo "HAS_DESKTOP_ENVIRONMENT: $HAS_DESKTOP_ENVIRONMENT"
    echo ""
    echo "Base data directory: $(get_base_data_directory)"
    echo "Core node project root: $(get_core_node_project_root)"
    echo "Core node dir: $(get_core_node_dir)"
    echo ""
    echo "Expected path structure:"
    echo "  Windows: D:\\programing\\core_node\\scripts\\shells\\linux"
    echo "  WSL: /mnt/d/programing/core_node/scripts/shells/linux"
    echo "=== END DEBUG ==="
}

# Export debug function
export -f debug_path_analysis

# Function to get encrypted content by key name (equivalent to Invoke-DisguiseDecryption)
get_secret_content() {
    local key_name="$1"

    if [ -z "$key_name" ]; then
        echo "Error: KeyName parameter is required"
        return 1
    fi

    # Use centralized core_node directory detection
    local core_node_dir=$(get_core_node_dir)

    # Variables declaration
    local scripts_dir="$core_node_dir/scripts"
    local secret_keys_dir="$core_node_dir/.secret_keys"
    local raw_dir="$secret_keys_dir/.secret_ignore"
    local encrypted_dir="$secret_keys_dir/already_encrypted"
    local raw_file="$raw_dir/$key_name"
    local encrypted_file="$encrypted_dir/$key_name.js"
    
    # First check if raw file exists
    if [ -f "$raw_file" ]; then
        local content=$(cat "$raw_file" 2>/dev/null | tr -d '\0' | sed '/^\s*$/d')
        if [ -n "$content" ]; then
            echo "$content"
            return 0
        fi
    fi
    
    # Check if encrypted file exists
    if [ ! -f "$encrypted_file" ]; then
        return 1
    fi
    
    # Check if we need to perform batch decryption
    if [ "$BATCH_DECRYPTION_COMPLETED" = false ]; then
        echo "[DECRYPT] Checking for encrypted files requiring batch decryption..." >&2
        
        # Find all encrypted .js files that don't have corresponding raw files
        local encrypted_files=()
        if [ -d "$encrypted_dir" ]; then
            while IFS= read -r -d '' enc_file; do
                local raw_file_name=$(basename "$enc_file" .js)
                local raw_file_path="$raw_dir/$raw_file_name"
                
                if [ ! -f "$raw_file_path" ]; then
                    encrypted_files+=("$enc_file")
                fi
            done < <(find "$encrypted_dir" -name "*.js" -print0 2>/dev/null)
        fi
        
        if [ ${#encrypted_files[@]} -gt 0 ]; then
            echo "[DECRYPT] Found ${#encrypted_files[@]} encrypted files requiring decryption" >&2
            
            # Find disguise.js
            local disguise_js=""
            if [ -d "$scripts_dir" ]; then
                disguise_js=$(find "$scripts_dir" -name "disguise.js" -type f | head -n 1)
            fi
            
            if [ -n "$disguise_js" ]; then
                echo "[DECRYPT] Found decryption tool: $disguise_js" >&2
                
                # Get password for batch decryption
                echo -n "[DECRYPT] Enter decryption password for all encrypted files: " >&2
                read -s password
                echo "" >&2
                
                if [ -n "$password" ]; then
                    # Ensure raw directory exists
                    if [ ! -d "$raw_dir" ]; then
                        mkdir -p "$raw_dir"
                    fi
                    
                    # Decrypt each file
                    local success_count=0
                    for encrypted_file in "${encrypted_files[@]}"; do
                        local file_name=$(basename "$encrypted_file")
                        echo "[DECRYPT] Decrypting: $file_name" >&2
                        
                        local result
                        result=$(node "$encrypted_file" pwd "$password" "$raw_dir" 2>&1)
                        local exit_code=$?
                        
                        if [ $exit_code -eq 0 ]; then
                            echo "[DECRYPT] SUCCESS: Decrypted $file_name" >&2
                            ((success_count++))
                        else
                            echo "[DECRYPT] WARNING: Failed to decrypt $file_name" >&2
                            echo "[DECRYPT] Error: $result" >&2
                        fi
                    done
                    
                    echo "[DECRYPT] Batch decryption completed: $success_count/${#encrypted_files[@]} files decrypted" >&2
                else
                    echo "[DECRYPT] WARNING: Empty password provided, skipping batch decryption" >&2
                fi
                
                # Clear password from memory
                password=""
            else
                echo "[DECRYPT] WARNING: disguise.js not found in scripts directory" >&2
            fi
        fi
        
        # Mark batch decryption as completed for this session
        BATCH_DECRYPTION_COMPLETED=true
    fi
    
    # Try to read the decrypted file again
    if [ -f "$raw_file" ]; then
        local content=$(cat "$raw_file" 2>/dev/null | tr -d '\0' | sed '/^\s*$/d')
        if [ -n "$content" ]; then
            echo "$content"
            return 0
        fi
    fi
    
    return 1
}


# Alias for set_global_var for backward compatibility  
# Call set_is_global after all functions are defined
set_is_global

# Directory variables (set after all functions are defined)
BASE_DIR=$(map_web_path "www")
WIS_PROGRAMING_DIR="$BASE_DIR/programing"
COMPILE_DIR=$(map_web_path "compile_dir")

# Installation directories (set after all functions are defined)
POETRY_HOME="$COMPILE_DIR/poetry"
POETRY_LINK="$COMPILE_DIR/bin/poetry"
NODE_INSTALL_DIR="$COMPILE_DIR/node"
NODE_SHORT_VERSION="22"
NODE_VERSION="v22.21.0"
NODE_DOWNLOAD_URL="https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz"
NODE_BIN="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin/node"

GO_DIR="$COMPILE_DIR/go"
GO_BIN="$GO_DIR/bin/go"
GO_VERSION_AMD64_FILE="go1.22.5.linux-amd64"
GO_TAR_URL="https://dl.google.com/go/$GO_VERSION_AMD64_FILE.tar.gz"

# Ruby installation directories
RUBY_INSTALL_DIR="$COMPILE_DIR/ruby"
RUBY_GEM_HOME="$RUBY_INSTALL_DIR/gems"
RUBY_GEM_BIN_DIR="$RUBY_GEM_HOME/bin"

UPS_CONF="/etc/nut/ups.conf"
UPSD_CONF="/etc/nut/upsd.conf"
UPSD_USERS_CONF="/etc/nut/upsd.users"
UPSMON_CONF="/etc/nut/upsmon.conf"

# MCP Services Configuration
MCP_SOURCE_DIR="$CORE_SCRIPTS_DIR/mcp"
MCP_SERVER_DIR="$COMPILE_DIR/mcp_server"
MCP_LOCAL_DIR="scripts/mcp"

# Export the additional variables
export BASE_DIR
export WIS_PROGRAMING_DIR
export COMPILE_DIR
export POETRY_HOME
export POETRY_LINK
export NODE_INSTALL_DIR
export NODE_SHORT_VERSION
export NODE_VERSION
export NODE_DOWNLOAD_URL
export NODE_BIN
export GO_DIR
export GO_BIN
export GO_VERSION_AMD64_FILE
export GO_TAR_URL
export UPS_CONF
export UPSD_CONF
export UPSD_USERS_CONF
export UPSMON_CONF
export MCP_SOURCE_DIR
export MCP_SERVER_DIR
export MCP_LOCAL_DIR
