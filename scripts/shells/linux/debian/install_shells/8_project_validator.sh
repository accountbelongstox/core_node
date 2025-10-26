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

# Simple output functions
log() {
    echo "[$SCRIPT_INDEX] $1"
}

warning() {
    echo "[$SCRIPT_INDEX] WARNING: $1"
}

error() {
    echo "[$SCRIPT_INDEX] ERROR: $1"
}

# Get script directory and calculate paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source gvar_common.sh to get CORE_NODE_PROJECT_ROOT
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Calculate relative position of gvar_common.sh to D:\programing\core_node
GVAR_COMMON_PATH="$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
EXPECTED_PROJECT_ROOT="/mnt/d/programing/core_node"

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
            
            # Set proper permissions
            $USE_SUDO chown -R $(whoami):$(whoami) "$project_root" 2>/dev/null || true
            $USE_SUDO chmod -R 755 "$project_root" 2>/dev/null || true
            
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
# Check if project root exists and has content
if [ -d "$CORE_NODE_PROJECT_ROOT" ] && [ -f "$CORE_NODE_PROJECT_ROOT/package.json" ] && [ -f "$CORE_NODE_PROJECT_ROOT/main.js" ]; then
    # Project is correctly positioned
    log "Project correctly positioned at: $CORE_NODE_PROJECT_ROOT"
    exit 0
fi

# Project needs to be restored
warning "Project directory is empty or missing: $CORE_NODE_PROJECT_ROOT"
echo "Do you want to restore the project from repository? (y/n):"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    # Install git if needed
    if ! command -v git >/dev/null 2>&1; then
        log "Installing git..."
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update && sudo apt-get install -y git
        elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y git
        else
            error "Cannot install git automatically"
            exit 1
        fi
    fi
    
    # Clean directory if it exists
    if [ -d "$CORE_NODE_PROJECT_ROOT" ]; then
        sudo rm -rf "$CORE_NODE_PROJECT_ROOT"
    fi
    
    # Try GitHub first, then Gitee as fallback
    log "Cloning project from repository..."
    echo "Executing: git clone $GITHUB_REPO_URL $CORE_NODE_PROJECT_ROOT"
    if sudo git clone "$GITHUB_REPO_URL" "$CORE_NODE_PROJECT_ROOT" 2>/dev/null; then
        log "Project restored from GitHub successfully"
    else
        echo "Executing: git clone $GITEE_REPO_URL $CORE_NODE_PROJECT_ROOT"
        if sudo git clone "$GITEE_REPO_URL" "$CORE_NODE_PROJECT_ROOT" 2>/dev/null; then
            log "Project restored from Gitee successfully"
        else
            error "Failed to restore project from both repositories"
            exit 1
        fi
    fi
    
    # Set proper permissions
    sudo chown -R $(whoami):$(whoami) "$CORE_NODE_PROJECT_ROOT" 2>/dev/null || true
    sudo chmod -R 755 "$CORE_NODE_PROJECT_ROOT" 2>/dev/null || true
    
    log "Project restoration completed successfully"
else
    warning "User declined project restoration"
    exit 1
fi
