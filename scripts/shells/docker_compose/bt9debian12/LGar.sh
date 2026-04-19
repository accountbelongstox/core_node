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
CORE_NODE_DIR="$(dirname "$CORE_SCRIPTS_DIR")"
CORE_NODE_JRPJECT_NAME="core_node"
GLOBAL_VAR_DIR="/usr/core_node/global_var"
USE_SUDO=""

check_and_install_sudo() {
    if command -v sudo >/dev/null 2>&1; then
        USE_SUDO="sudo"
    else
        USE_SUDO=""
    fi
}

# System detection
if [ -f /etc/os-release ]; then
    # Modern systems with os-release
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

COMPILE_DIR="/usr/.dev_$SYSTEM_VERSION"
get_system_info() {
    echo "${SYSTEM_NAME}_${SYSTEM_VERSION}"
}
SYSTEM_SHELLS_DIR="$SHELLS_DIR/${SYSTEM_NAME}"
POETRY_HOME="/usr/local/poetry"
POETRY_LINK="/usr/local/bin/poetry"
POETRY_BINARY="$POETRY_HOME/venv/bin/poetry"
NODE_INSTALL_DIR="/usr/local/node"
NODE_BIN="/usr/local/bin/node"

NODE_SHORT_VERSION="22"
NODE_VERSION="v22.15.0"
NODE_DOWNLOAD_URL="https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz"

GO_DIR="$COMPILE_DIR/go"
GO_BIN="$GO_DIR/bin/go"
GO_VERSION_AMD64_FILE="go1.22.5.linux-amd64"
GO_TAR_URL="https://dl.google.com/go/$GO_VERSION_AMD64_FILE.tar.gz"

UPS_CONF="/etc/nut/ups.conf"
UPSD_CONF="/etc/nut/upsd.conf"
UPSD_USERS_CONF="/etc/nut/upsd.users"
UPSMON_CONF="/etc/nut/upsmon.conf"

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

# Export system information
SYSTEM_FULL_NAME="${SYSTEM_NAME}_${SYSTEM_VERSION}"

# Additional useful exports
