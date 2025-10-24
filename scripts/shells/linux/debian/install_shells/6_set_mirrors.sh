#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

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

# Source LGar.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
if [ -f /etc/environment ]; then
    set -a
    source /etc/environment
    set +a
fi

# Check if running as root or with sudo
if [ "$(id -u)" -ne 0 ]; then
    echo "Warning: This script requires root privileges for apt operations."
    echo "Please run with sudo or as root user."
fi

# Get region information
SELECTED_REGION=$(get_var "SELECTED_REGION")
CLOUD_PROVIDER=${CLOUD_PROVIDER:-$(get_var "CLOUD_PROVIDER")}
SELECTED_REGION=${SELECTED_REGION:-$(get_var "SELECTED_REGION")}
# Path to the sources.list file
TARGET_SOURCES_LIST="/etc/apt/sources.list"

# Determine if a custom mirror will be set based on region
SET_MIRROR=false
if [ "$SELECTED_REGION" = "China" ]; then
    SET_MIRROR=true
fi

# Print current environment variables
echo "CLOUD_PROVIDER: $CLOUD_PROVIDER"
echo "SELECTED_REGION: $SELECTED_REGION"
echo "SET_MIRROR: $SET_MIRROR"


# Only remove sources.list.d files if a custom mirror was set
if [ "$SET_MIRROR" = true ]; then
    echo "Region is set to China, configuring China mirrors..."
    sudo apt-get install -y apt-transport-https ca-certificates
    # Remove specific source files if they exist
    [ -f /etc/apt/sources.list.d/debian.sources ] && sudo rm -f /etc/apt/sources.list.d/debian.sources
    [ -f /etc/apt/sources.list.d/debian-security.sources ] && sudo rm -f /etc/apt/sources.list.d/debian-security.sources
    [ -f /etc/apt/sources.list.d/debian-backports.sources ] && sudo rm -f /etc/apt/sources.list.d/debian-backports.sources
    echo "Removed additional sources files."
    
    # TODO: Add actual China mirror configuration here
    # For example: Configure Aliyun, Tencent, or other China mirrors
    echo "China mirror configuration not yet implemented."
else
    echo "Region is not set to China (current: $SELECTED_REGION), keeping original mirrors."
    echo "Skipping mirror configuration."
fi

# Function to clean apt cache and update/upgrade
apt_clean_update_upgrade() {
    echo "Cleaning apt cache and updating/upgrading packages..."
    sudo apt clean && sudo apt update && sudo apt upgrade -y
}

# Only run apt operations if mirrors were changed or if explicitly requested
if [ "$SET_MIRROR" = true ]; then
    echo "Mirror configuration completed, updating package lists..."
    apt_clean_update_upgrade
else
    echo "No mirror changes made, skipping apt update/upgrade."
    echo "Run 'sudo apt update && sudo apt upgrade -y' manually if needed."
fi
