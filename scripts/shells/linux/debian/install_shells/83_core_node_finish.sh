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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Git repository URL for core_node project (modify this as needed)
CORE_NODE_GIT_URL="https://github.com/your-username/core_node.git"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Function to check package manager availability
check_package_manager() {
    if command -v yarn >/dev/null 2>&1; then
        echo "yarn is available: $(yarn --version)"
        echo "Will use yarn for installation"
        return 0
    elif command -v npm >/dev/null 2>&1; then
        echo "yarn not found, npm is available: $(npm --version)"
        echo "Will use npm for installation"
        return 1
    else
        echo "Error: Neither yarn nor npm is installed. Please install a package manager first." >&2
        return 2
    fi
}

# Function to clone core_node project
clone_core_node_project() {
    local base_dir="$(dirname "$CORE_NODE_DIR")"
    local project_name="$(basename "$CORE_NODE_DIR")"

    echo "Cloning core_node project to $CORE_NODE_DIR"
    echo "Base directory: $base_dir"
    echo "Project name: $project_name"

    # Create base directory if it doesn't exist
    if [ ! -d "$base_dir" ]; then
        echo "Creating base directory: $base_dir"
        $USE_SUDO mkdir -p "$base_dir"
    fi

    # Change to base directory
    cd "$base_dir" || {
        echo "Error: Failed to change directory to $base_dir" >&2
        return 1
    }

    # Clone the project
    echo "Cloning core_node project from: $CORE_NODE_GIT_URL"
    if $USE_SUDO git clone "$CORE_NODE_GIT_URL" "$project_name"; then
        echo "Successfully cloned core_node project"
        return 0
    else
        echo "Error: Failed to clone core_node project from $CORE_NODE_GIT_URL" >&2
        return 1
    fi
}

# Function to install dependencies
install_dependencies() {
    local current_dir=$(pwd)
    local use_yarn=$1

    echo "Changing directory to $CORE_NODE_DIR"
    cd "$CORE_NODE_DIR" || {
        echo "Error: Failed to change directory to $CORE_NODE_DIR" >&2
        return 1
    }

    if [ "$use_yarn" = true ]; then
        echo "Installing dependencies with yarn (PUPPETEER_SKIP_DOWNLOAD=true)..."
        $USE_SUDO PUPPETEER_SKIP_DOWNLOAD=true yarn install
    else
        echo "Installing dependencies with npm (PUPPETEER_SKIP_DOWNLOAD=true)..."
        $USE_SUDO PUPPETEER_SKIP_DOWNLOAD=true npm install
    fi
    local install_status=$?

    echo "Changing back to original directory: $current_dir"
    cd "$current_dir"

    return $install_status
}

# Main execution
echo "Core Node Setup Finalization Script"

# Check if CORE_NODE_DIR is set
if [ -z "$CORE_NODE_DIR" ]; then
    echo "Error: CORE_NODE_DIR environment variable is not set" >&2
    exit 1
fi

echo "Checking Core Node directory: $CORE_NODE_DIR"

# Check if directory exists, if not, clone the project
if [ ! -d "$CORE_NODE_DIR" ]; then
    echo "Core Node directory ($CORE_NODE_DIR) does not exist"
    echo "Attempting to clone the project..."

    if ! clone_core_node_project; then
        echo "Error: Failed to clone core_node project" >&2
        exit 1
    fi

    echo "Successfully cloned core_node project to $CORE_NODE_DIR"
fi

# Check for node_modules
if [ -d "$CORE_NODE_DIR/node_modules" ]; then
    echo "Found existing node_modules directory"
    echo "Location: $CORE_NODE_DIR/node_modules"
    echo "Size: $(du -sh "$CORE_NODE_DIR/node_modules" 2>/dev/null | cut -f1)"
    echo "Last modified: $(stat -c %y "$CORE_NODE_DIR/node_modules" 2>/dev/null)"
else
    echo "node_modules directory not found in $CORE_NODE_DIR"
    echo "Will proceed with dependency installation"
fi

# Check package manager availability
check_package_manager
package_manager_status=$?

if [ $package_manager_status -eq 2 ]; then
    exit 1
fi

# Install dependencies if needed
if [ ! -d "$CORE_NODE_DIR/node_modules" ]; then
    echo "Installing project dependencies..."
    if ! install_dependencies $([[ $package_manager_status -eq 0 ]] && echo true || echo false); then
        echo "Error: Failed to install dependencies" >&2
        exit 1
    fi
    echo "Dependencies installed successfully"
    echo "node_modules created at: $CORE_NODE_DIR/node_modules"
    echo "Size: $(du -sh "$CORE_NODE_DIR/node_modules" 2>/dev/null | cut -f1)"
else
    echo "Using existing node_modules directory"
fi

echo "Core Node setup finalization completed successfully!"