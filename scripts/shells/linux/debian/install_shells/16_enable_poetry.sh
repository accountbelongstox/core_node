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

# Declare all variables at the beginning
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
POETRY_VENV_DIR=""
POETRY_BIN=""

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source shared Python setup function
source "$PARENT_DIR_LEVEL_1/debian_com/shared_python_setup.sh"

# Set poetry venv directory from COMPILE_DIR
POETRY_VENV_DIR="$COMPILE_DIR/poetry_venv"
POETRY_BIN="$POETRY_VENV_DIR/bin/poetry"

echo "COMPILE_DIR: $COMPILE_DIR"
echo "POETRY_VENV_DIR: $POETRY_VENV_DIR"
echo "POETRY_BIN: $POETRY_BIN"

# Function to check if poetry is installed and working
check_poetry() {
    if [ -f "$POETRY_BIN" ] && [ -x "$POETRY_BIN" ]; then
        echo "Poetry binary found at: $POETRY_BIN"
        echo "Poetry version: $("$POETRY_BIN" --version 2>/dev/null || echo 'version unknown')"
        return 0
    fi
    echo "Poetry not found"
    return 1
}

# Function to install poetry in uv venv
install_poetry_in_uv_venv() {
    echo "Installing Poetry in uv virtual environment..."

    # Check if uv is available
    if ! command -v uv >/dev/null 2>&1; then
        echo "Error: uv not found. Please install uv first (script 18_install_uv.sh)"
        return 1
    fi

    # Ensure COMPILE_DIR exists
    if [ ! -d "$COMPILE_DIR" ]; then
        echo "Creating compile directory: $COMPILE_DIR"
        $USE_SUDO mkdir -p "$COMPILE_DIR"
        $USE_SUDO chmod 755 "$COMPILE_DIR"
    fi

    # Create venv if it doesn't exist
    if [ ! -d "$POETRY_VENV_DIR" ]; then
        echo "Creating poetry virtual environment using uv: $POETRY_VENV_DIR"
        if uv venv "$POETRY_VENV_DIR"; then
            echo "Virtual environment created successfully"
        else
            echo "Failed to create virtual environment"
            return 1
        fi
    else
        echo "Virtual environment already exists at: $POETRY_VENV_DIR"
    fi

    # Install poetry in the venv using uv
    echo "Installing poetry using uv..."
    if uv pip install --python "$POETRY_VENV_DIR/bin/python3" poetry; then
        echo "Poetry installed successfully in venv"
    else
        echo "Failed to install poetry in venv"
        return 1
    fi

    # Verify poetry binary exists
    if [ ! -f "$POETRY_BIN" ]; then
        echo "Error: poetry binary not found at: $POETRY_BIN"
        return 1
    fi

    echo "Poetry installed successfully in uv venv"
    return 0
}

# Function to setup poetry symlink with correctness detection
setup_poetry_symlink() {
    echo "Setting up Poetry symlink..."

    if [ ! -f "$POETRY_BIN" ]; then
        echo "Error: poetry binary not found at: $POETRY_BIN"
        return 1
    fi

    # Check if symlink exists and verify its correctness
    if [ -e "/usr/local/bin/poetry" ]; then
        local current_target=$(readlink -f "/usr/local/bin/poetry" 2>/dev/null || echo "")
        local expected_target=$(readlink -f "$POETRY_BIN" 2>/dev/null || echo "$POETRY_BIN")

        if [ "$current_target" = "$expected_target" ]; then
            echo "Symlink /usr/local/bin/poetry already points to correct location, skipping"
        else
            echo "Symlink exists but incorrect, updating to: $POETRY_BIN"
            $USE_SUDO rm -f "/usr/local/bin/poetry"
            $USE_SUDO ln -sf "$POETRY_BIN" "/usr/local/bin/poetry"
            echo "Updated symlink: /usr/local/bin/poetry -> $POETRY_BIN"
        fi
    else
        $USE_SUDO ln -sf "$POETRY_BIN" "/usr/local/bin/poetry"
        echo "Created symlink: /usr/local/bin/poetry -> $POETRY_BIN"
    fi

    # Make binary executable
    $USE_SUDO chmod +x "$POETRY_BIN"

    echo "Poetry symlink setup completed"
    return 0
}

# Main execution
echo "Poetry Installation and Configuration Script"
echo ""

# Check if poetry is already installed in venv
if check_poetry; then
    echo "Poetry is already installed"
else
    echo "Installing poetry in uv venv..."
    if ! install_poetry_in_uv_venv; then
        echo ""
        echo "=========================================="
        echo "Poetry installation failed"
        echo "This is not critical for system operation"
        echo "You can install Poetry manually later if needed"
        echo "=========================================="
        exit 1
    fi
fi

# Setup symlink
echo ""
if ! setup_poetry_symlink; then
    echo "Error: Failed to setup poetry symlink"
    exit 1
fi

# Verify installation
echo ""
echo "Verifying Poetry installation..."
if command -v poetry >/dev/null 2>&1; then
    echo "=========================================="
    echo "Poetry setup completed successfully"
    echo "Version: $(poetry --version 2>/dev/null || echo 'unknown')"
    echo "Location: $(which poetry)"
    echo "Venv: $POETRY_VENV_DIR"
    echo "=========================================="
    exit 0
else
    echo "=========================================="
    echo "Poetry installed but command not found in PATH"
    echo "Binary location: $POETRY_BIN"
    echo "Symlink should be at: /usr/local/bin/poetry"
    echo "=========================================="
    exit 0
fi
