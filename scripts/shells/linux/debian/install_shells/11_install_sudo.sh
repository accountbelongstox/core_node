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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Declare variables
CURRENT_USER=${USER:-$(whoami)}
DISTRO=$(lsb_release -is 2>/dev/null || echo "Unknown")

print_step_from_common_functions "Installing sudo for $DISTRO..."

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    print_error_from_common_functions "This script must be run as root to install sudo!"
    echo "Please run: su - root"
    echo "Then execute this script again."
    exit 1
fi

# Check if sudo is already installed
if command -v sudo >/dev/null 2>&1; then
    print_success_from_common_functions "sudo is already installed."
else
    print_step_from_common_functions "Installing sudo package..."
    $USE_SUDO apt-get update
    if $USE_SUDO apt-get install -y sudo; then
        print_success_from_common_functions "sudo installed successfully."
    else
        print_error_from_common_functions "Failed to install sudo package."
        exit 1
    fi
fi

# Ensure sudo group exists
if ! getent group sudo >/dev/null 2>&1; then
    print_step_from_common_functions "Creating sudo group..."
    $USE_SUDO groupadd sudo
fi

# Add user to sudo group if not already a member
if [ -n "$CURRENT_USER" ] && [ "$CURRENT_USER" != "root" ]; then
    if id -nG "$CURRENT_USER" | grep -qw "sudo"; then
        print_success_from_common_functions "User $CURRENT_USER is already in the sudo group."
    else
        print_step_from_common_functions "Adding user $CURRENT_USER to sudo group..."
        if $USE_SUDO usermod -aG sudo "$CURRENT_USER"; then
            print_success_from_common_functions "User $CURRENT_USER added to sudo group successfully."
            print_info_from_common_functions "Please log out and log back in for changes to take effect."
        else
            print_error_from_common_functions "Failed to add user $CURRENT_USER to sudo group."
            exit 1
        fi
    fi
else
    print_info_from_common_functions "Running as root user, no need to add to sudo group."
fi

print_success_from_common_functions "Sudo installation and configuration completed."
