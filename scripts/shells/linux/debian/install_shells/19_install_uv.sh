#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Use ASCII characters only - no emojis or non-ASCII symbols
# 6. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Declare all variables at the beginning
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
SCRIPT_INDEX="19"
SCRIPT_VERSION="1.0"
UV_INSTALL_DIR=""
UV_BINARY=""
UV_DEFAULT_VENV_DIR=""

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

echo "[$SCRIPT_INDEX] UV Package Manager Installation Script v$SCRIPT_VERSION"
echo "[$SCRIPT_INDEX] Features: Fast Python package management, Cross-platform compatibility"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source shared Python setup function
source "$PARENT_DIR_LEVEL_1/debian_com/shared_python_setup.sh"

# Set UV installation directories from COMPILE_DIR
UV_INSTALL_DIR="$COMPILE_DIR/uv_bin"
UV_BINARY="$UV_INSTALL_DIR/uv"
UV_DEFAULT_VENV_DIR="$COMPILE_DIR/uv_default_venv"

echo "[$SCRIPT_INDEX] COMPILE_DIR: $COMPILE_DIR"
echo "[$SCRIPT_INDEX] UV_INSTALL_DIR: $UV_INSTALL_DIR"
echo "[$SCRIPT_INDEX] UV_BINARY: $UV_BINARY"
echo "[$SCRIPT_INDEX] UV_DEFAULT_VENV_DIR: $UV_DEFAULT_VENV_DIR"
echo "[$SCRIPT_INDEX] UV Package Manager Installation Script"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if uv is properly installed
check_uv_installed() {
    # Check if UV binary exists in our install directory
    if [ -f "$UV_BINARY" ] && [ -x "$UV_BINARY" ]; then
        echo "[$SCRIPT_INDEX] Found UV binary at: $UV_BINARY"
        # Test if it actually works
        if timeout 10 "$UV_BINARY" --version >/dev/null 2>&1; then
            echo "[$SCRIPT_INDEX] UV binary is functional"
            return 0
        else
            echo "[$SCRIPT_INDEX] UV binary exists but not functional"
            return 1
        fi
    else
        echo "[$SCRIPT_INDEX] UV binary not found at: $UV_BINARY"
        return 1
    fi
}

check_and_install_sudo

# Function to install uv
install_uv() {
    echo "[$SCRIPT_INDEX] Installing UV package manager to shared location..."
    echo "[$SCRIPT_INDEX] Description: UV is a fast Python package manager and project manager written in Rust"

    # Check Python availability (UV doesn't need full Python environment setup)
    if ! command -v python3 >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Installing Python3..."
        if timeout 300 $USE_SUDO apt update && timeout 600 $USE_SUDO apt install -y python3; then
            echo "[$SCRIPT_INDEX] Python3 installed successfully"
        else
            echo "[$SCRIPT_INDEX] [WARNING] Python3 installation failed, but UV might still work"
        fi
    else
        echo "[$SCRIPT_INDEX] Python3 is available: $(python3 --version 2>/dev/null || echo 'Unknown version')"
    fi

    # Check if uv is already installed in shared location
    if check_uv_installed; then
        echo "[$SCRIPT_INDEX] [OK] UV is already installed at: $UV_BINARY"
        echo "[$SCRIPT_INDEX] Version: $("$UV_BINARY" --version 2>/dev/null || echo 'Unknown')"

        # Ensure symlinks and environment are still properly set up
        add_uv_to_path
        return 0
    fi

    echo "[$SCRIPT_INDEX] UV not found in shared location, installing..."

    # Ensure UV_INSTALL_DIR exists
    if [ ! -d "$UV_INSTALL_DIR" ]; then
        echo "[$SCRIPT_INDEX] Creating UV install directory: $UV_INSTALL_DIR"
        $USE_SUDO mkdir -p "$UV_INSTALL_DIR"
        $USE_SUDO chmod 755 "$UV_INSTALL_DIR"
    fi

    # Create temporary directory for installation
    local temp_install_dir=$(mktemp -d)
    echo "[$SCRIPT_INDEX] Using temporary directory: $temp_install_dir"

    # Install uv to temporary location first
    echo "[$SCRIPT_INDEX] Downloading and installing UV from official source..."
    if CARGO_HOME="$temp_install_dir" timeout 300 curl -LsSf https://astral.sh/uv/install.sh | timeout 300 sh -s -- --no-modify-path; then
        echo "[$SCRIPT_INDEX] [OK] UV downloaded successfully"

        # Find the UV binary in temp location
        local temp_uv=""
        if [ -f "$temp_install_dir/bin/uv" ]; then
            temp_uv="$temp_install_dir/bin/uv"
        elif [ -f "$HOME/.local/bin/uv" ]; then
            temp_uv="$HOME/.local/bin/uv"
        elif [ -f "$HOME/.cargo/bin/uv" ]; then
            temp_uv="$HOME/.cargo/bin/uv"
        fi

        if [ -n "$temp_uv" ] && [ -f "$temp_uv" ]; then
            # Move UV binary to shared location
            echo "[$SCRIPT_INDEX] Moving UV binary to shared location: $UV_BINARY"
            $USE_SUDO cp "$temp_uv" "$UV_BINARY"
            $USE_SUDO chmod 755 "$UV_BINARY"

            # Clean up temp directory
            rm -rf "$temp_install_dir"

            # Verify installation
            if check_uv_installed; then
                echo "[$SCRIPT_INDEX] [OK] UV installation verified"
                echo "[$SCRIPT_INDEX] UV version: $("$UV_BINARY" --version)"
                # Add to shell profile for persistent PATH and create symlinks
                add_uv_to_path
                return 0
            else
                echo "[$SCRIPT_INDEX] [ERROR] UV installation verification failed"
                return 1
            fi
        else
            echo "[$SCRIPT_INDEX] [ERROR] Could not find UV binary after installation"
            rm -rf "$temp_install_dir"
            return 1
        fi
    else
        echo "[$SCRIPT_INDEX] [ERROR] Failed to install UV"
        rm -rf "$temp_install_dir"
        return 1
    fi
}

# Function to add uv to PATH and create symlinks
add_uv_to_path() {
    echo "[$SCRIPT_INDEX] Setting up UV environment..."

    # Use the UV_BINARY from compile_dir
    if [ ! -f "$UV_BINARY" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] UV binary not found at: $UV_BINARY"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Using UV binary at: $UV_BINARY"

    # Ensure UV binary is executable
    $USE_SUDO chmod 755 "$UV_BINARY"

    # Check if symlink exists and verify its correctness
    if [ -e "/usr/local/bin/uv" ]; then
        # Get the real path that the symlink points to
        local current_target=$(readlink -f "/usr/local/bin/uv" 2>/dev/null || echo "")
        local expected_target=$(readlink -f "$UV_BINARY" 2>/dev/null || echo "$UV_BINARY")

        if [ "$current_target" = "$expected_target" ]; then
            echo "[$SCRIPT_INDEX] Symlink /usr/local/bin/uv already points to correct location, skipping"
        else
            # Symlink exists but points to wrong location, update it
            echo "[$SCRIPT_INDEX] Symlink exists but incorrect, updating to: $UV_BINARY"
            $USE_SUDO rm -f "/usr/local/bin/uv"
            if $USE_SUDO ln -sf "$UV_BINARY" "/usr/local/bin/uv"; then
                echo "[$SCRIPT_INDEX] Updated symlink: /usr/local/bin/uv -> $UV_BINARY"
            else
                echo "[$SCRIPT_INDEX] [WARNING] Failed to update symlink to /usr/local/bin/uv"
            fi
        fi
    else
        # Symlink doesn't exist, create it
        if $USE_SUDO ln -sf "$UV_BINARY" "/usr/local/bin/uv"; then
            echo "[$SCRIPT_INDEX] Created symlink: /usr/local/bin/uv -> $UV_BINARY"
        else
            echo "[$SCRIPT_INDEX] [WARNING] Failed to create symlink to /usr/local/bin/uv"
        fi
    fi

    # Ensure symlink permissions
    $USE_SUDO chmod 755 "/usr/local/bin/uv" 2>/dev/null

    # Verify symlink is accessible
    if [ -x "/usr/local/bin/uv" ]; then
        echo "[$SCRIPT_INDEX] Symlink /usr/local/bin/uv is accessible to all users"
    else
        echo "[$SCRIPT_INDEX] [WARNING] Symlink may not be accessible, trying to fix permissions..."
        $USE_SUDO chmod +x "/usr/local/bin/uv"
    fi

    # Store UV information for other scripts
    set_var "UV_BIN_PATH" "$UV_BINARY"
    set_var "UV_HOME" "$UV_INSTALL_DIR"

    echo "[$SCRIPT_INDEX] UV environment setup completed (symlink-based access)"
    return 0
}

# Function to configure uv
configure_uv() {
    echo "[$SCRIPT_INDEX] Configuring UV..."

    # Set up uv configuration directory
    local uv_config_dir="$HOME/.config/uv"
    if [ ! -d "$uv_config_dir" ]; then
        mkdir -p "$uv_config_dir"
        echo "[$SCRIPT_INDEX] Created UV config directory: $uv_config_dir"
    fi

    # Create basic uv configuration
    local uv_config_file="$uv_config_dir/uv.toml"
    if [ ! -f "$uv_config_file" ]; then
        cat > "$uv_config_file" << 'EOF'
# UV configuration
index-url = "https://pypi.org/simple"

# Cache configuration
cache-dir = "~/.cache/uv"
EOF
        echo "[$SCRIPT_INDEX] Created UV configuration file: $uv_config_file"
    else
        echo "[$SCRIPT_INDEX] UV configuration file already exists: $uv_config_file"
    fi
}

# Function to create default UV venv
create_uv_default_venv() {
    echo "[$SCRIPT_INDEX] Setting up default UV virtual environment..."

    # Check if uv is available
    if ! command_exists uv; then
        echo "[$SCRIPT_INDEX] [ERROR] UV not found, cannot create default venv"
        return 1
    fi

    # Ensure COMPILE_DIR exists
    if [ ! -d "$COMPILE_DIR" ]; then
        echo "[$SCRIPT_INDEX] Creating compile directory: $COMPILE_DIR"
        $USE_SUDO mkdir -p "$COMPILE_DIR"
        $USE_SUDO chmod 755 "$COMPILE_DIR"
    fi

    # Create venv if it doesn't exist
    if [ ! -d "$UV_DEFAULT_VENV_DIR" ]; then
        echo "[$SCRIPT_INDEX] Creating default UV venv: $UV_DEFAULT_VENV_DIR"
        if uv venv "$UV_DEFAULT_VENV_DIR"; then
            echo "[$SCRIPT_INDEX] Default UV venv created successfully"
        else
            echo "[$SCRIPT_INDEX] [ERROR] Failed to create default UV venv"
            return 1
        fi
    else
        echo "[$SCRIPT_INDEX] Default UV venv already exists: $UV_DEFAULT_VENV_DIR"
    fi

    # Set UV_PROJECT_ENVIRONMENT to point to default venv
    set_env_and_var "UV_PROJECT_ENVIRONMENT" "$UV_DEFAULT_VENV_DIR"
    export UV_PROJECT_ENVIRONMENT="$UV_DEFAULT_VENV_DIR"

    # Store in global variables for other scripts
    set_var "UV_DEFAULT_VENV" "$UV_DEFAULT_VENV_DIR"

    echo "[$SCRIPT_INDEX] Default UV venv configured"
    echo "[$SCRIPT_INDEX]   Location: $UV_DEFAULT_VENV_DIR"
    echo "[$SCRIPT_INDEX]   UV_PROJECT_ENVIRONMENT set to: $UV_DEFAULT_VENV_DIR"
    echo "[$SCRIPT_INDEX]   You can now run 'uv pip install <package>' without activating a venv"
    return 0
}

# Function to test uv installation
test_uv_installation() {
    echo "[$SCRIPT_INDEX] Testing UV installation..."

    if [ ! -f "$UV_BINARY" ] || [ ! -x "$UV_BINARY" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] UV binary not found or not executable at: $UV_BINARY"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Testing UV binary: $UV_BINARY"

    if timeout 10 "$UV_BINARY" --version >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [OK] UV version check passed"
    else
        echo "[$SCRIPT_INDEX] [ERROR] UV version check failed"
        return 1
    fi

    # Test uv tool functionality (use simpler command for testing)
    if timeout 10 "$UV_BINARY" --help >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [OK] UV help command test passed"
    else
        echo "[$SCRIPT_INDEX] [ERROR] UV help command test failed"
        return 1
    fi

    # Try tool list command (may fail if no tools installed yet, but that's OK)
    if timeout 10 "$UV_BINARY" tool list >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [OK] UV tool functionality test passed"
    else
        echo "[$SCRIPT_INDEX] [INFO] UV tool list returned error (normal if no tools installed yet)"
    fi

    echo "[$SCRIPT_INDEX] [OK] UV installation test completed successfully"
    return 0
}

# Function to display UV information
display_uv_info() {
    echo "[$SCRIPT_INDEX] === UV Information ==="

    if [ -f "$UV_BINARY" ]; then
        echo "[$SCRIPT_INDEX] Version: $("$UV_BINARY" --version 2>/dev/null || echo 'Unknown')"
        echo "[$SCRIPT_INDEX] Binary location: $UV_BINARY"
        echo "[$SCRIPT_INDEX] Symlink: /usr/local/bin/uv -> $UV_BINARY"
        echo "[$SCRIPT_INDEX] Config: $HOME/.config/uv/uv.toml"

        # Display default venv info
        if [ -d "$UV_DEFAULT_VENV_DIR" ]; then
            echo "[$SCRIPT_INDEX] Default venv: $UV_DEFAULT_VENV_DIR"
            echo "[$SCRIPT_INDEX] UV_PROJECT_ENVIRONMENT: $UV_DEFAULT_VENV_DIR"
        fi

        echo "[$SCRIPT_INDEX] "
        echo "[$SCRIPT_INDEX] === IMPORTANT: Reload Environment ==="
        echo "[$SCRIPT_INDEX] To use UV without errors, you need to reload the environment:"
        echo "[$SCRIPT_INDEX]   Option 1: Logout and login again (recommended)"
        echo "[$SCRIPT_INDEX]   Option 2: Run: source /etc/environment && export UV_PROJECT_ENVIRONMENT=$UV_DEFAULT_VENV_DIR"
        echo "[$SCRIPT_INDEX]   Option 3: For current session only: export UV_PROJECT_ENVIRONMENT=$UV_DEFAULT_VENV_DIR"
        echo "[$SCRIPT_INDEX] "
        echo "[$SCRIPT_INDEX] === After Reloading ==="
        echo "[$SCRIPT_INDEX] UV is now accessible to all users (ubuntu, root, etc.)"
        echo "[$SCRIPT_INDEX] Usage:"
        echo "[$SCRIPT_INDEX]   - Install packages: uv pip install <package>"
        echo "[$SCRIPT_INDEX]   - Install tools: uv tool install <package>"
        echo "[$SCRIPT_INDEX]   - Create projects: uv init"
        echo "[$SCRIPT_INDEX] "
        echo "[$SCRIPT_INDEX] Verify UV is accessible: uv --version"
        echo "[$SCRIPT_INDEX] Check environment: echo \$UV_PROJECT_ENVIRONMENT"

        # Set global variable for other scripts
        set_var "UV_AVAILABLE" "true"
        set_var "UV_VERSION" "$("$UV_BINARY" --version 2>/dev/null | cut -d' ' -f2 || echo 'unknown')"
    else
        echo "[$SCRIPT_INDEX] [ERROR] UV binary not found for information display"
        set_var "UV_AVAILABLE" "false"
    fi
}

# Main execution
echo "[$SCRIPT_INDEX] === UV Package Manager Installation ==="

# Install UV
if install_uv; then
    echo "[$SCRIPT_INDEX] [OK] UV installation completed"

    # Configure UV
    configure_uv

    # Create default UV venv
    if ! create_uv_default_venv; then
        echo "[$SCRIPT_INDEX] [WARNING] Failed to create default UV venv"
        echo "[$SCRIPT_INDEX] [WARNING] You will need to run 'uv venv' before using 'uv pip install'"
    fi

    # Test installation
    if test_uv_installation; then
        echo "[$SCRIPT_INDEX] [OK] UV is ready for use"

        # Display UV information
        display_uv_info

    else
        echo "[$SCRIPT_INDEX] [ERROR] UV installed but tests failed"
        set_var "UV_AVAILABLE" "false"
    fi
else
    echo "[$SCRIPT_INDEX] [ERROR] UV installation failed"
    set_var "UV_AVAILABLE" "false"
fi

echo "[$SCRIPT_INDEX] "
echo "[$SCRIPT_INDEX] ============================================"
echo "[$SCRIPT_INDEX] UV Package Manager Installation Script completed"
echo "[$SCRIPT_INDEX] ============================================"
echo "[$SCRIPT_INDEX] "
echo "[$SCRIPT_INDEX] NEXT STEPS:"
echo "[$SCRIPT_INDEX] 1. Reload environment variables (logout/login or source /etc/environment)"
echo "[$SCRIPT_INDEX] 2. Verify UV is accessible: uv --version"
echo "[$SCRIPT_INDEX] 3. Check environment variable: echo \$UV_PROJECT_ENVIRONMENT"
echo "[$SCRIPT_INDEX] 4. Test installation: uv pip install fastmcp"
echo "[$SCRIPT_INDEX] ============================================"
