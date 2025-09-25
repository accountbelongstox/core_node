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

# Get script directory and parent directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHELLS_DIR="$SCRIPT_DIR"
COMMON_SHELLS_DIR="$SHELLS_DIR/common"
SHELLS_SCRIPTS_DIR="$SHELLS_DIR/scripts"
CORE_SCRIPTS_DIR="$(dirname "$SHELLS_DIR")"
# Set CORE_NODE_DIR with priority: /mnt/d/programing/core_node > /www/wwwroot/core_node
if [ -d "/mnt/d/programing/core_node" ]; then
    CORE_NODE_DIR="/mnt/d/programing/core_node"
elif [ -d "/www/wwwroot/core_node" ]; then
    CORE_NODE_DIR="/www/wwwroot/core_node"
else
    # Fallback to calculated path
    CORE_NODE_DIR="$(dirname "$CORE_SCRIPTS_DIR")"
fi
USE_SUDO=""

check_and_install_sudo() {
    if command -v sudo >/dev/null 2>&1; then
        USE_SUDO="sudo"
    else
        USE_SUDO=""
    fi
}
PRE_COMPILE_DIR=".dev"
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

# Determine base directory for COMPILE_DIR
if [ -d "/mnt/d" ]; then
    BASE_DIR="/mnt/d"
else
    BASE_DIR="/usr"
fi
WIS_PROGRAMING_DIR="$BASE_DIR/programing"
SERVER_ROOT_DIR="/www/wwwroot/"
if [ -d "$WIS_PROGRAMING_DIR/core_node" ]; then
    CORE_NODE_ROOT_DIR="$WIS_PROGRAMING_DIR/core_node"
else
    CORE_NODE_ROOT_DIR="${SERVER_ROOT_DIR}core_node"
fi
COMPILE_DIR="${BASE_DIR}/${SYS_DIR}"

get_system_info() {
    echo "${SYSTEM_NAME}_${SYSTEM_VERSION}"
}

# Update all installation directories to use COMPILE_DIR
POETRY_HOME="$COMPILE_DIR/poetry"
POETRY_LINK="$COMPILE_DIR/bin/poetry"
NODE_INSTALL_DIR="$COMPILE_DIR/node"
NODE_BIN="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin/node"

NODE_SHORT_VERSION="22"
NODE_VERSION="v22.19.0"
NODE_DOWNLOAD_URL="https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz"

GO_DIR="$COMPILE_DIR/go"
GO_BIN="$GO_DIR/bin/go"
GO_VERSION_AMD64_FILE="go1.22.5.linux-amd64"
GO_TAR_URL="https://dl.google.com/go/$GO_VERSION_AMD64_FILE.tar.gz"

UPS_CONF="/etc/nut/ups.conf"
UPSD_CONF="/etc/nut/upsd.conf"
UPSD_USERS_CONF="/etc/nut/upsd.users"
UPSMON_CONF="/etc/nut/upsmon.conf"

# MCP Services Configuration
MCP_SOURCE_DIR="$CORE_SCRIPTS_DIR/mcp"
MCP_SERVER_DIR="$COMPILE_DIR/mcp_server"
MCP_LOCAL_DIR="scripts/mcp"

if [ ! -d "$COMPILE_DIR" ]; then
    echo "Compile directory($COMPILE_DIR) does not exist, creating it"
    mkdir -p "$COMPILE_DIR"
fi

echo "=== System Information ==="
echo "Script Directory: $SCRIPT_DIR"
echo "Shells Directory: $SHELLS_DIR"
echo "Core Scripts Directory: $CORE_SCRIPTS_DIR"
echo "Core Node Directory: $CORE_NODE_DIR"
# Export directory variables
export SCRIPT_DIR
export SHELLS_DIR
export CORE_SCRIPTS_DIR
export CORE_NODE_DIR

# Export system information
export SYSTEM_NAME
export SYSTEM_VERSION
export SYSTEM_FULL_NAME="${SYSTEM_NAME}_${SYSTEM_VERSION}"

# Additional useful exports
export OS_ID
export OS_VERSION_ID
export OS_NAME
export POETRY_HOME
export POETRY_LINK
export NODE_INSTALL_DIR
export COMMON_SHELLS_DIR
export NODE_VERSION
export NODE_DOWNLOAD_URL
export NODE_SHORT_VERSION
export SHELLS_SCRIPTS_DIR
export NODE_BIN
export COMPILE_DIR
export GO_DIR
export GO_BIN
export GO_VERSION_AMD64_FILE
export GO_TAR_URL
export UPS_CONF
export UPSD_CONF
export UPSD_USERS_CONF
export UPSMON_CONF
export USE_SUDO
export MCP_SOURCE_DIR
export MCP_SERVER_DIR
export MCP_LOCAL_DIR
