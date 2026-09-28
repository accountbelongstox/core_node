#!/bin/bash

# System detection variables (merged from gvar_common.sh)
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
        ;;
    "ubuntu")
        SYSTEM_NAME="ubuntu"
        SYSTEM_VERSION="$OS_VERSION_ID"
        ;;
    "debian")
        SYSTEM_NAME="debian"
        SYSTEM_VERSION="$OS_VERSION_ID"
        ;;
    "almalinux" | "rocky")
        SYSTEM_NAME="centos" # Treat AlmaLinux/Rocky as CentOS for compatibility
        SYSTEM_VERSION="$OS_VERSION_ID"
        ;;
    *)
        SYSTEM_NAME="$OS_ID"
        SYSTEM_VERSION="$OS_VERSION_ID"
        ;;
    esac
elif [ -f /etc/redhat-release ]; then
    # Older RedHat-based systems
    SYSTEM_NAME="centos"
    SYSTEM_VERSION=$(cat /etc/redhat-release | sed -e 's/.*release \([0-9]\+\).*/\1/')
elif [ -f /etc/lsb-release ]; then
    # Older Ubuntu systems
    . /etc/lsb-release
    SYSTEM_NAME="${DISTRIB_ID,,}"
    SYSTEM_VERSION="$DISTRIB_RELEASE"
else
    # Fallback to uname
    SYSTEM_NAME=$(uname -s | tr '[:upper:]' '[:lower:]')
    SYSTEM_VERSION=$(uname -r)
fi

SYS_DIR="_${SYSTEM_NAME}_$(echo "${SYSTEM_VERSION}" | cut -d. -f1)"

# Directory variables will be set after map_web_path function is defined

# Additional directory variables
# Only set if not already defined (to avoid overwriting dd.sh values)
if [ -z "${SHELLS_DIR:-}" ]; then
    SHELLS_DIR=""
fi
if [ -z "${SHELLS_SCRIPTS_DIR:-}" ]; then
    SHELLS_SCRIPTS_DIR=""
fi
if [ -z "${CORE_SCRIPTS_DIR:-}" ]; then
    CORE_SCRIPTS_DIR=""
fi

# Set directory variables based on script location only if not already set
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -z "${SHELLS_DIR:-}" ]; then
    LOCAL_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SHELLS_DIR="$(dirname "$LOCAL_SCRIPT_DIR")"
    SHELLS_SCRIPTS_DIR="$SHELLS_DIR/scripts"
    CORE_SCRIPTS_DIR="$(dirname "$SHELLS_DIR")"
fi

# Installation directories will be set after map_web_path function is defined

# Function to get system information (merged from gvar_common.sh)
get_system_info() {
    echo "${SYSTEM_NAME}_${SYSTEM_VERSION}"
}

# Export additional variables (merged from gvar_common.sh)
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

# CORE_NODE_DATA_DIR is defined once in runtime_environment.sh (sourced first by
# gvar_common.sh); here it is only consumed to derive the standardized subtrees.
PROGRAMING_USERS_DIR="$CORE_NODE_DATA_DIR/Users"
PI_COMMON_USER_DIR="$PROGRAMING_USERS_DIR/PiYolo"
PI_KIMI_USER_DIR="$PROGRAMING_USERS_DIR/PiKimi"
PI_CLAUDE_CODE_USER_DIR="$PROGRAMING_USERS_DIR/PiClaudeCode"
PI_CODEX_USER_DIR="$PROGRAMING_USERS_DIR/PiCodex"
PI_VOLC_AGENT_USER_DIR="$PROGRAMING_USERS_DIR/PiVolcAgent"
PI_VOLC_CODING_USER_DIR="$PROGRAMING_USERS_DIR/PiVolcCoding"
PI_COMMON_AGENT_DIR="$PI_COMMON_USER_DIR/.pi/agent"
PI_KIMI_AGENT_DIR="$PI_KIMI_USER_DIR/.pi/agent"
PI_CLAUDE_CODE_AGENT_DIR="$PI_CLAUDE_CODE_USER_DIR/.pi/agent"
PI_CODEX_AGENT_DIR="$PI_CODEX_USER_DIR/.pi/agent"
PI_VOLC_AGENT_AGENT_DIR="$PI_VOLC_AGENT_USER_DIR/.pi/agent"
PI_VOLC_CODING_AGENT_DIR="$PI_VOLC_CODING_USER_DIR/.pi/agent"
export PROGRAMING_USERS_DIR
export PI_COMMON_USER_DIR
export PI_KIMI_USER_DIR
export PI_CLAUDE_CODE_USER_DIR
export PI_CODEX_USER_DIR
export PI_VOLC_AGENT_USER_DIR
export PI_VOLC_CODING_USER_DIR
export PI_COMMON_AGENT_DIR
export PI_KIMI_AGENT_DIR
export PI_CLAUDE_CODE_AGENT_DIR
export PI_CODEX_AGENT_DIR
export PI_VOLC_AGENT_AGENT_DIR
export PI_VOLC_CODING_AGENT_DIR

GLOBAL_VAR_DIR="$CORE_NODE_DATA_DIR/global_var"
# Pre-relocation var center; readers (global_var_store.sh get_global_var,
# pycore core_node_dirs, PathMapper::readPersistedVar) fall back to it so
# persisted values survive the ~/.core_node -> <www>/core_node move.
LEGACY_GLOBAL_VAR_DIR="${LEGACY_CORE_NODE_DATA_DIR:-/var/_core_node}/global_var"
export LEGACY_GLOBAL_VAR_DIR

# Wire the ONE shared, all-users cache location (CORE_NODE_CACHE_DIR + HF_HOME /
# TORCH_HOME / PIP_CACHE_DIR / XDG_CACHE_HOME ...). Idempotent, set -u-safe, and it
# respects any value the caller already exported.
source "$(dirname "${BASH_SOURCE[0]}")/shared_cache_env.sh"

# Wire the ONE shared GPU/CUDA detector (gpu_present) from base_libs/lib_gpu.sh -- the
# canonical CUDADetector mirror -- so every install script selects GPU build + LARGE model
# vs CPU build + small model the SAME way. Defining-only (no side effects); safe under set -u.
source "$(dirname "${BASH_SOURCE[0]}")/base_libs/lib_gpu.sh"

# Global download directory for all installation scripts
CORE_NODE_SHARED_DOWNLOADS="$CORE_NODE_DATA_DIR/shared_downloads"

