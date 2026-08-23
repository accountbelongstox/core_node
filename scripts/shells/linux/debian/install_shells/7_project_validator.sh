#!/bin/bash
# Index8 Script - Core Node Project Root Detection and Validation
# This script checks if the current project exists at CORE_NODE_PROJECT_ROOT
# and validates the project structure relative to gvar_common.sh

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

set -e

# Script index for logging
SCRIPT_INDEX="8"

# Repository URLs
GITHUB_REPO_URL="https://github.com/accountbelongstox/core_node.git"
GITEE_REPO_URL="https://gitee.com/accountbelongstox/core_node.git"

# Color codes
YELLOW='\033[33m'
RED='\033[31m'
GREEN='\033[32m'
NC='\033[0m'

# Simple output functions
log() {
    echo -e "${GREEN}[$SCRIPT_INDEX] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$SCRIPT_INDEX] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$SCRIPT_INDEX] ERROR: $1${NC}"
}

# Get script directory and calculate paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
PERMISSION_HELPER="$PARENT_DIR_LEVEL_2/common/fs_perm_helpers.sh"

# Source gvar_common.sh to get necessary variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
# shellcheck source=/dev/null
source "$PERMISSION_HELPER"

# Print comprehensive environment information
log "=========================================="
log "Environment Detection Summary"
log "=========================================="
log "System Environment:"
log "  - IS_WSL: $IS_WSL"
log "  - IS_PRODUCTION: $IS_PRODUCTION"
log "  - IS_DESKTOP_WITH_WINDOWS: $IS_DESKTOP_WITH_WINDOWS"
log "  - HAS_DESKTOP_ENVIRONMENT: $HAS_DESKTOP_ENVIRONMENT"

if [ "$HAS_DESKTOP_ENVIRONMENT" = true ]; then
    log "  - DESKTOP_ENVIRONMENT: $DESKTOP_ENVIRONMENT"
fi

log ""
log "Storage Detection:"
base_dir=$(get_base_data_directory)
log "  - Base Data Directory: $base_dir"

# Show NTFS detection (has_ntfs_disk returns 0/1, no output)
if has_ntfs_disk; then
    log "  - NTFS Disk: Detected"
else
    log "  - NTFS Disk: Not found"
fi

# Show data disk detection
data_device=$($USE_SUDO blkid | grep -iE "TYPE=\"(ext4|xfs|btrfs)\"" | head -n 1 | cut -d: -f1)
if [ -n "$data_device" ]; then
    mount_point=$(findmnt -n -o TARGET "$data_device" 2>/dev/null || echo "")
    if [ "$mount_point" != "/" ] && [ "$mount_point" != "/boot" ]; then
        log "  - Data Disk: $data_device"
    fi
fi

log ""
log "Project Configuration:"
log "  - CORE_NODE_PROJECT_ROOT: $CORE_NODE_PROJECT_ROOT"
log "  - Project Type: $(if [ "$IS_WSL" = true ] || [ "$HAS_DESKTOP_ENVIRONMENT" = true ] || has_ntfs_disk 2>/dev/null; then echo "Development (programing)"; else echo "Production (wwwroot)"; fi)"
log "=========================================="
log ""

# Function to install git if not available
install_git() {
    if command -v git >/dev/null 2>&1; then
        log "Git is already installed"
        return 0
    fi

    log "Git is not installed. Installing git..."

    # Detect package manager and install git
    if command -v apt-get >/dev/null 2>&1; then
        $USE_SUDO apt-get update
        $USE_SUDO apt-get install -y git
    elif command -v yum >/dev/null 2>&1; then
        $USE_SUDO yum install -y git
    elif command -v dnf >/dev/null 2>&1; then
        $USE_SUDO dnf install -y git
    elif command -v pacman >/dev/null 2>&1; then
        $USE_SUDO pacman -S --noconfirm git
    elif command -v zypper >/dev/null 2>&1; then
        $USE_SUDO zypper install -y git
    else
        error "Cannot install git: no supported package manager found"
        return 1
    fi

    if command -v git >/dev/null 2>&1; then
        log "Git installed successfully"
        return 0
    else
        error "Failed to install git"
        return 1
    fi
}

# Function to check if directory is empty
is_directory_empty() {
    local dir_path="$1"
    if [ ! -d "$dir_path" ]; then
        return 0  # Directory doesn't exist, consider it empty
    fi

    # Check if directory has any files or subdirectories (excluding hidden files)
    if [ -z "$(ls -A "$dir_path" 2>/dev/null)" ]; then
        return 0  # Directory is empty
    else
        return 1  # Directory has content
    fi
}

# Function to clean directory
clean_directory() {
    local dir_path="$1"

    if [ -d "$dir_path" ]; then
        # SAFETY: never wipe a populated core_node tree without the triple-confirm
        # guard (it also refuses git working trees + non-interactive runs). See
        # development-guides/CORE_NODE_DELETION_SAFETY.md.
        if [ -n "$(ls -A "$dir_path" 2>/dev/null)" ]; then
            if ! confirm_core_node_deletion "$dir_path"; then
                error "Refusing to delete $dir_path; aborting restore."
                return 1
            fi
        fi
        log "Cleaning directory: $dir_path"
        $USE_SUDO rm -rf "$dir_path"
    fi

    # Create parent directory if needed
    local parent_dir="$(dirname "$dir_path")"
    if [ ! -d "$parent_dir" ]; then
        log "Creating parent directory: $parent_dir"
        $USE_SUDO mkdir -p "$parent_dir"
    fi
}

# Function to clone project from repository
clone_project() {
    local project_root="$1"
    local repo_url="$2"

    log "Cloning project from: $repo_url"
    log "Target directory: $project_root"

    # Ensure parent directory exists
    local parent_dir="$(dirname "$project_root")"
    if [ ! -d "$parent_dir" ]; then
        $USE_SUDO mkdir -p "$parent_dir"
    fi

    # Clone the repository
    if $USE_SUDO git clone "$repo_url" "$project_root" 2>&1; then
        log "Successfully cloned from $repo_url"
        return 0
    else
        error "Failed to clone from $repo_url"
        return 1
    fi
}

# Function to restore project
restore_project() {
    local project_root="$1"

    log "Starting project restoration process..."

    # Check if git is available
    if ! install_git; then
        error "Cannot proceed without git"
        return 1
    fi

    # Check if project directory exists and is empty
    if is_directory_empty "$project_root"; then
        warning "Project directory is empty or doesn't exist: $project_root"

        # Ask user for confirmation
        echo -e "${YELLOW}Do you want to restore the project from the repository? (y/n): ${NC}"
        read -r response

        if [[ "$response" =~ ^[Yy]$ ]]; then
            log "User confirmed project restoration"

            # Clean the directory if it exists
            clean_directory "$project_root"

            # Try GitHub first, then Gitee as fallback
            if clone_project "$project_root" "$GITHUB_REPO_URL"; then
                log "Project restored from GitHub successfully"
            elif clone_project "$project_root" "$GITEE_REPO_URL"; then
                log "Project restored from Gitee successfully"
            else
                error "Failed to restore project from both repositories"
                return 1
            fi

            repair_owned_tree_777 "$project_root"

            log "Project restoration completed successfully"
            return 0
        else
            warning "User declined project restoration"
            return 1
        fi
    else
        log "Project directory exists and has content: $project_root"
        return 0
    fi
}

# Main execution
# Adopt an existing project as authoritative: a git working tree OR a tree with
# package.json is real work -> never restore/re-clone over it (broader than the old
# package.json+main.js gate, so a transiently-incomplete checkout is not wiped).
if [ -d "$CORE_NODE_PROJECT_ROOT" ] && { [ -e "$CORE_NODE_PROJECT_ROOT/.git" ] || [ -f "$CORE_NODE_PROJECT_ROOT/package.json" ]; }; then
    log "Project correctly positioned at: $CORE_NODE_PROJECT_ROOT (adopting; no restore)"
    if [ "${SKIP_PROJECT_PERMISSION_REPAIR:-false}" != "true" ]; then
        repair_owned_tree_777 "$CORE_NODE_PROJECT_ROOT"
    fi
    exit 0
fi

# Project needs to be restored
restore_project "$CORE_NODE_PROJECT_ROOT"
exit $?
