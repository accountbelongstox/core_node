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
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source shared Python setup function
source "$PARENT_DIR_LEVEL_1/debian_com/shared_python_setup.sh"

# Declare all variables at the beginning
POETRY_HOME="/usr/local/poetry"
POETRY_BINARY="$POETRY_HOME/bin/poetry"
POETRY_LINK="/usr/local/bin/poetry"

# Poetry is a default tool installation - no conditional check needed

echo "POETRY_HOME: $POETRY_HOME"
echo "POETRY_BINARY: $POETRY_BINARY"
echo "POETRY_LINK: $POETRY_LINK"

# Function to check if poetry binary exists and is executable
check_poetry() {
    if [ -x "$POETRY_BINARY" ]; then
        echo "Poetry binary found at $POETRY_BINARY"
        return 0
    fi
    echo "Poetry binary not found or not executable"
    return 1
}

# Function to install poetry
install_poetry() {
    echo "Installing Poetry to $POETRY_HOME..."
    
    # Ensure Python environment is set up first
    if ! ensure_python_environment; then
        echo "Failed to set up Python environment" >&2
        return 1
    fi
    
    # Create POETRY_HOME directory if it doesn't exist
    $USE_SUDO mkdir -p "$POETRY_HOME"
    
    # Ensure proper ownership of POETRY_HOME
    $USE_SUDO chown -R root:root "$POETRY_HOME"
    
    # Download and install poetry
    curl -sSL https://install.python-poetry.org | $USE_SUDO POETRY_HOME="$POETRY_HOME" python3 -
    
    # Check if installation was successful
    if [ $? -ne 0 ]; then
        echo "Failed to install Poetry"
        return 1
    fi
    
    echo "Poetry installed successfully"
    return 0
}

# Function to create symlink using common function
create_symlink() {
    echo "Creating symlink using common function..."
    
    # Make sure the binary is executable
    sudo chmod +x "$POETRY_BINARY"
    
    # Use common function to set up environment and symlinks
    # Add Poetry installation directory to global path
    add_to_global_path_from_common_functions "$POETRY_HOME"
    
    # Add Poetry binary to global path and create symlinks
    add_to_global_path_from_common_functions "$POETRY_BINARY"
    
    echo "Symlink setup completed"
}

# Main execution
echo "Setting up Poetry..."

# Check if poetry is already installed
if ! check_poetry; then
    echo "Poetry not found. Installing..."
    if ! install_poetry; then
        echo "Failed to install Poetry"
        exit 1
    fi
fi

# Create symlink regardless of whether we just installed or it was already there
create_symlink

# Verify installation
if check_poetry; then
    echo "Poetry setup completed successfully"
    poetry --version
    exit 0
else
    echo "Poetry setup failed"
    exit 1
fi
