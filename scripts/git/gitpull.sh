#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Git pull script for core_node project
# This script pulls the latest changes from the remote repository with region support

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMMON_DIR="$SCRIPT_DIR/../shells/linux/common"

# Source common functions if available
if [ -f "$COMMON_DIR/gvar_common.sh" ]; then
    source "$COMMON_DIR/gvar_common.sh"
fi

# Get region setting
get_region() {
    local region=""
    if command -v get_var >/dev/null 2>&1; then
        region=$(get_var "SELECTED_REGION" 2>/dev/null || echo "")
    fi
    
    # Default to gitee if region is China or empty
    if [ -z "$region" ] || [ "$region" = "China" ]; then
        echo "gitee"
    else
        echo "github"
    fi
}

# Set remote URL based on region
set_remote_url() {
    local region=$(get_region)
    local current_url=$(git remote get-url origin 2>/dev/null || echo "")
    
    echo "Current region: $region"
    echo "Current remote URL: $current_url"
    
    # Base URLs using HTTPS (not SSH)
    local gitee_url="https://gitee.com/accountbelongstox/core_node.git"
    local github_url="https://github.com/accountbelongstox/core_node.git"
    
    if [ "$region" = "gitee" ]; then
        if [[ "$current_url" != *"gitee.com"* ]]; then
            echo "Switching to Gitee remote..."
            git remote set-url origin "$gitee_url" 2>/dev/null || {
                echo "Warning: Could not set Gitee URL. Using current remote."
            }
        fi
    else
        if [[ "$current_url" != *"github.com"* ]]; then
            echo "Switching to GitHub remote..."
            git remote set-url origin "$github_url" 2>/dev/null || {
                echo "Warning: Could not set GitHub URL. Using current remote."
            }
        fi
    fi
}

# Function to configure git safe directory and pull settings
configure_git_safe_directory() {
    local repo_path="$1"
    
    echo "Configuring git safe.directory and pull settings..."
    
    # Add current repository to safe directory list
    if [ -n "$repo_path" ] && [ -d "$repo_path" ]; then
        echo "Adding $repo_path to git safe.directory"
        
        # Try with regular git first
        if git config --global --add safe.directory "$repo_path" 2>/dev/null; then
            echo "Success: Git safe directory configured (regular git)"
        else
            # If regular git fails, try with sudo
            echo "Trying with sudo..."
            if sudo git config --global --add safe.directory "$repo_path" 2>/dev/null; then
                echo "Success: Git safe directory configured (sudo git)"
            else
                echo "Warning: Could not configure git safe.directory"
            fi
        fi
        
        # Configure git pull rebase setting
        echo "Configuring git pull.rebase false..."
        if git config --global pull.rebase false 2>/dev/null; then
            echo "Success: Git pull.rebase configured (regular git)"
        else
            # If regular git fails, try with sudo
            echo "Trying with sudo..."
            if sudo git config --global pull.rebase false 2>/dev/null; then
                echo "Success: Git pull.rebase configured (sudo git)"
            else
                echo "Warning: Could not configure git pull.rebase"
            fi
        fi
    else
        echo "Warning: Invalid repository path for safe.directory configuration"
    fi
}

# Git update function with double confirmation
update_git_version() {
    echo "=== Git Version Update ==="
    echo "This will perform the following operations:"
    echo "  - Configure git safe.directory"
    echo "  - git stash (save current changes)"
    echo "  - git fetch --all (fetch all remote changes)"
    echo "  - git reset --hard origin/main (reset to remote main branch)"
    echo "  - git pull --force (force pull latest changes)"
    echo ""
    echo "WARNING: This will overwrite all local changes!"
    echo ""
    
    # First confirmation
    echo -n "Are you sure you want to continue? (yes/no): "
    read -r first_confirm
    if [ "$first_confirm" != "yes" ]; then
        echo "Operation cancelled."
        return 1
    fi
    
    # Second confirmation
    echo -n "This action cannot be undone. Type 'yes' again to confirm: "
    read -r second_confirm
    if [ "$second_confirm" != "yes" ]; then
        echo "Operation cancelled."
        return 1
    fi
    
    echo ""
    echo "Proceeding with git update..."
    
    # Change to workspace directory
    cd "$WORKSPACE_DIR" || {
        echo "Error: Cannot change to workspace directory: $WORKSPACE_DIR"
        return 1
    }
    
    # Check if git repository exists
    if [ ! -d ".git" ]; then
        echo "Error: Not a git repository"
        return 1
    fi
    
    # Configure git safe directory first
    configure_git_safe_directory "$WORKSPACE_DIR"
    
    # Set remote URL based on region
    set_remote_url
    
    # Execute git commands with sudo
    echo "Executing: sudo git stash"
    if sudo git stash; then
        echo "Success: Git stash completed"
    else
        echo "Error: Git stash failed"
        return 1
    fi
    
    echo "Executing: sudo git fetch --all"
    if sudo git fetch --all; then
        echo "Success: Git fetch completed"
    else
        echo "Error: Git fetch failed"
        return 1
    fi
    
    echo "Executing: sudo git reset --hard origin/main"
    if sudo git reset --hard origin/main; then
        echo "Success: Git reset completed"
    else
        echo "Error: Git reset failed"
        return 1
    fi
    
    echo "Executing: sudo git pull --force"
    if sudo git pull --force; then
        echo "Success: Git pull completed"
    else
        echo "Error: Git pull failed"
        return 1
    fi
    
    echo ""
    echo "Success: Git update completed successfully!"
    echo "Current git status:"
    sudo git log --oneline -5
    
    return 0
}

# Simple git pull function
simple_git_pull() {
    echo "=== Git Pull Script ==="
    echo "Workspace: $WORKSPACE_DIR"

    # Change to workspace directory
    cd "$WORKSPACE_DIR" || {
        echo "Error: Cannot change to workspace directory: $WORKSPACE_DIR"
        exit 1
    }

    # Check if git repository exists
    if [ ! -d ".git" ]; then
        echo "Error: Not a git repository"
        exit 1
    fi

    # Configure git safe directory first
    configure_git_safe_directory "$WORKSPACE_DIR"

    # Set remote URL based on region
    set_remote_url

    # Confirmation before pull
    echo ""
    echo -n "Are you ready to pull the latest changes? (yes/no): "
    read -r confirm
    if [ "$confirm" != "yes" ]; then
        echo "Git pull cancelled."
        return 1
    fi
    
    # Force pull latest changes with remote priority
    echo "Fetching latest changes from remote..."
    git fetch --all
    
    echo "Backing up local changes..."
    git add . || true
    git stash push -m "Auto-backup before force pull $(date)" || true
    
    echo "Applying remote changes with remote priority..."
    # Reset to remote state, prioritizing remote changes
    git reset --hard origin/main
    
    echo "Restoring local-only files (that don't exist remotely)..."
    # Apply stashed changes but keep remote files on conflict
    if git stash list | grep -q "Auto-backup before force pull"; then
        # Try to apply stash, but don't fail if there are conflicts
        git stash pop --index || {
            echo "Conflicts detected, keeping remote version..."
            # Reset conflicted files to remote version
            git reset --hard HEAD
            # Drop the stash since we're keeping remote versions
            git stash drop || true
        }
    fi

    echo "Git pull with remote priority completed"
}

# Main execution
if [ "$1" = "--force-update" ]; then
    update_git_version
else
    simple_git_pull
fi