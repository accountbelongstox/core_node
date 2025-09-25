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
# Source global variables from parent directory
source "$PARENT_DIR_LEVEL_2$PARENT_DIR_LEVEL_2/linux/LGar.sh"
# Set Poetry installation directory to /usr/local/poetry

echo "POETRY_HOME: $POETRY_HOME"
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
    
    # Create POETRY_HOME directory if it doesn't exist
    ${USE_SUDO} mkdir -p "$POETRY_HOME"
    
    # Ensure proper ownership of POETRY_HOME
    ${USE_SUDO} chown -R root:root "$POETRY_HOME"
    
    # Download and install poetry
    curl -sSL https://install.python-poetry.org | ${USE_SUDO} POETRY_HOME="$POETRY_HOME" python3 -
    
    # Check if installation was successful
    if [ $? -ne 0 ]; then
        echo "Failed to install Poetry"
        return 1
    fi
    
    echo "Poetry installed successfully"
    return 0
}

# Function to create symlink
create_symlink() {
    echo "Creating symlink to Poetry binary..."
    
    # Remove existing symlink or file if it exists
    if [ -L "$POETRY_LINK" ] || [ -f "$POETRY_LINK" ]; then
        echo "Removing existing Poetry symlink/file..."
        ${USE_SUDO} rm -f "$POETRY_LINK"
    fi
    
    # Create new symlink
    ${USE_SUDO} ln -s "$POETRY_BINARY" "$POETRY_LINK"
    
    # Make sure the binary is executable
    ${USE_SUDO} chmod +x "$POETRY_BINARY"
    ${USE_SUDO} chmod +x "$POETRY_LINK"
    
    echo "Symlink created: $POETRY_LINK -> $POETRY_BINARY"
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
