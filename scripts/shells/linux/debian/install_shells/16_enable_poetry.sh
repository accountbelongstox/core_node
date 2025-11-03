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

# Source shared Python setup function
source "$PARENT_DIR_LEVEL_1/debian_com/shared_python_setup.sh"

# Declare all variables at the beginning
POETRY_HOME="/usr/local/poetry"
POETRY_BINARY="$POETRY_HOME/bin/poetry"
POETRY_LINK="/usr/local/bin/poetry"

echo "POETRY_HOME: $POETRY_HOME"
echo "POETRY_BINARY: $POETRY_BINARY"
echo "POETRY_LINK: $POETRY_LINK"

# Function to check if poetry is installed and working
check_poetry() {
    if command -v poetry >/dev/null 2>&1; then
        echo "Poetry is installed: $(poetry --version 2>/dev/null || echo 'version unknown')"
        return 0
    elif [ -x "$POETRY_BINARY" ]; then
        echo "Poetry binary found at $POETRY_BINARY"
        return 0
    fi
    echo "Poetry not found"
    return 1
}

# Function to install poetry using pipx (preferred method for Python 3.12+)
install_poetry_via_pipx() {
    echo "Installing Poetry using pipx (recommended for Python 3.12+)..."

    # Check if pipx is available
    if ! command -v pipx >/dev/null 2>&1; then
        echo "pipx not found, installing pipx first..."
        if ! python3 -m pip install --user pipx 2>&1 | tail -20; then
            echo "Failed to install pipx via pip"
            return 1
        fi

        # Ensure pipx is in PATH
        python3 -m pipx ensurepath 2>/dev/null || true
        export PATH="$HOME/.local/bin:$PATH"

        # Verify pipx installation
        if ! command -v pipx >/dev/null 2>&1; then
            echo "pipx installed but not in PATH, trying direct python module invocation..."
            if ! python3 -m pipx --version >/dev/null 2>&1; then
                echo "Failed to verify pipx installation"
                return 1
            fi
            # Use python3 -m pipx instead of pipx command
            alias pipx='python3 -m pipx'
        fi
    fi

    echo "Installing Poetry via pipx..."
    if command -v pipx >/dev/null 2>&1; then
        $USE_SUDO PIPX_HOME="$POETRY_HOME" PIPX_BIN_DIR="$POETRY_HOME/bin" pipx install poetry 2>&1 | tail -20
    else
        $USE_SUDO PIPX_HOME="$POETRY_HOME" PIPX_BIN_DIR="$POETRY_HOME/bin" python3 -m pipx install poetry 2>&1 | tail -20
    fi

    if [ $? -eq 0 ]; then
        echo "Poetry installed successfully via pipx"
        return 0
    else
        echo "Failed to install Poetry via pipx"
        return 1
    fi
}

# Function to install poetry using pip (fallback method)
install_poetry_via_pip() {
    echo "Installing Poetry using pip (fallback method)..."

    # Upgrade pip first to ensure compatibility with Python 3.12
    echo "Upgrading pip to latest version..."
    python3 -m pip install --upgrade pip 2>&1 | tail -10 || echo "pip upgrade completed with warnings"

    # Install poetry using pip
    echo "Installing Poetry..."
    if $USE_SUDO python3 -m pip install --target="$POETRY_HOME" poetry 2>&1 | tail -20; then
        echo "Poetry installed successfully via pip"

        # Create wrapper script
        $USE_SUDO mkdir -p "$POETRY_HOME/bin"
        $USE_SUDO tee "$POETRY_BINARY" > /dev/null << 'EOF'
#!/bin/bash
export PYTHONPATH="/usr/local/poetry:$PYTHONPATH"
exec python3 -m poetry "$@"
EOF
        $USE_SUDO chmod +x "$POETRY_BINARY"
        return 0
    else
        echo "Failed to install Poetry via pip"
        return 1
    fi
}

# Function to install poetry using official installer with Python 3.12 compatibility
install_poetry_via_installer() {
    echo "Installing Poetry using official installer (with Python 3.12 fix)..."

    # Ensure Python environment is set up first
    if ! ensure_python_environment; then
        echo "Failed to set up Python environment" >&2
        return 1
    fi

    # Create POETRY_HOME directory if it doesn't exist
    $USE_SUDO mkdir -p "$POETRY_HOME"
    $USE_SUDO chown -R root:root "$POETRY_HOME"

    # Create a temporary venv with compatible pip
    local temp_venv="/tmp/poetry-install-venv-$$"
    echo "Creating temporary venv with compatible pip..."

    if python3 -m venv "$temp_venv" 2>/dev/null; then
        # Upgrade pip in the venv
        "$temp_venv/bin/pip" install --upgrade pip setuptools wheel 2>&1 | tail -10

        # Use the venv python to install poetry
        echo "Installing Poetry with upgraded pip..."
        curl -sSL https://install.python-poetry.org | $USE_SUDO POETRY_HOME="$POETRY_HOME" "$temp_venv/bin/python3" - 2>&1 | tail -20

        local result=$?
        rm -rf "$temp_venv"

        if [ $result -eq 0 ]; then
            echo "Poetry installed successfully via official installer"
            return 0
        fi
    fi

    echo "Failed to install Poetry via official installer"
    return 1
}

# Function to install poetry with multiple fallback methods
install_poetry() {
    echo "Starting Poetry installation..."
    echo ""

    # Method 1: Try pipx (best for Python 3.12+)
    echo "=== Method 1: pipx (recommended) ==="
    if install_poetry_via_pipx; then
        echo "Poetry installed successfully via pipx"
        return 0
    fi
    echo "pipx installation failed, trying next method..."
    echo ""

    # Method 2: Try pip directly
    echo "=== Method 2: pip (fallback) ==="
    if install_poetry_via_pip; then
        echo "Poetry installed successfully via pip"
        return 0
    fi
    echo "pip installation failed, trying next method..."
    echo ""

    # Method 3: Try official installer with fixes
    echo "=== Method 3: Official installer (with fixes) ==="
    if install_poetry_via_installer; then
        echo "Poetry installed successfully via official installer"
        return 0
    fi
    echo "Official installer failed"
    echo ""

    echo "All installation methods failed"
    return 1
}

# Function to create symlink
create_symlink() {
    echo "Setting up Poetry symlinks..."

    # Find Poetry binary location
    local poetry_bin=""
    if [ -f "$POETRY_BINARY" ]; then
        poetry_bin="$POETRY_BINARY"
    elif [ -f "$POETRY_HOME/bin/poetry" ]; then
        poetry_bin="$POETRY_HOME/bin/poetry"
    elif command -v poetry >/dev/null 2>&1; then
        poetry_bin=$(command -v poetry)
        echo "Poetry found at: $poetry_bin"
        # Create symlink if not in standard location
        if [ "$poetry_bin" != "$POETRY_LINK" ]; then
            $USE_SUDO ln -sf "$poetry_bin" "$POETRY_LINK"
            echo "Created symlink: $POETRY_LINK -> $poetry_bin"
        fi
        return 0
    fi

    if [ -z "$poetry_bin" ]; then
        echo "Could not find Poetry binary"
        return 1
    fi

    # Make binary executable
    $USE_SUDO chmod +x "$poetry_bin"

    # Create symlink to /usr/local/bin
    if [ -L "$POETRY_LINK" ] || [ -f "$POETRY_LINK" ]; then
        $USE_SUDO rm -f "$POETRY_LINK"
    fi
    $USE_SUDO ln -sf "$poetry_bin" "$POETRY_LINK"
    echo "Created symlink: $POETRY_LINK -> $poetry_bin"

    # Add to PATH if needed
    if ! echo "$PATH" | grep -q "$POETRY_HOME/bin"; then
        export PATH="$POETRY_HOME/bin:$PATH"
        echo "Added $POETRY_HOME/bin to PATH"
    fi

    return 0
}

# Main execution
echo "Setting up Poetry..."
echo ""

# Check if poetry is already installed
if check_poetry; then
    echo "Poetry is already installed"
    poetry --version 2>/dev/null || echo "Poetry installed but version check failed"
else
    echo "Poetry not found. Installing..."
    if ! install_poetry; then
        echo ""
        echo "=========================================="
        echo "Poetry installation failed"
        echo "This is not critical for system operation"
        echo "You can install Poetry manually later if needed"
        echo "=========================================="
        exit 1
    fi
fi

# Create symlink regardless of whether we just installed or it was already there
echo ""
create_symlink

# Verify installation
echo ""
echo "Verifying Poetry installation..."
if command -v poetry >/dev/null 2>&1; then
    echo "=========================================="
    echo "Poetry setup completed successfully"
    poetry --version
    echo "=========================================="
    exit 0
else
    echo "=========================================="
    echo "Poetry setup completed but poetry command not found in PATH"
    echo "You may need to restart your shell or run:"
    echo "  export PATH=\"$POETRY_HOME/bin:\$PATH\""
    echo "=========================================="
    exit 0
fi
