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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="18"

# Script version and description
SCRIPT_VERSION="1.0"
echo "[$SCRIPT_INDEX] UV Package Manager Installation Script v$SCRIPT_VERSION"
echo "[$SCRIPT_INDEX] Features: Fast Python package management, Cross-platform compatibility"

# Source global variables
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source shared Python setup function
source "$PARENT_DIR_LEVEL_1/debian_com/shared_python_setup.sh"

# UV is a default tool installation - no conditional check needed

echo "[$SCRIPT_INDEX] UV Package Manager Installation Script"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if uv is properly installed
check_uv_installed() {
    local uv_binary=""

    # Check common installation paths (including ~/.local/bin where UV actually installs)
    if [ -f "$HOME/.local/bin/uv" ]; then
        uv_binary="$HOME/.local/bin/uv"
    elif [ -f "$HOME/.cargo/bin/uv" ]; then
        uv_binary="$HOME/.cargo/bin/uv"
    elif [ -f "/usr/local/bin/uv" ]; then
        uv_binary="/usr/local/bin/uv"
    elif [ -f "/usr/bin/uv" ]; then
        uv_binary="/usr/bin/uv"
    elif command -v uv >/dev/null 2>&1; then
        uv_binary=$(which uv)
    fi

    # Check if binary exists and is executable
    if [ -n "$uv_binary" ] && [ -x "$uv_binary" ]; then
        echo "[$SCRIPT_INDEX] Found UV binary at: $uv_binary"
        # Test if it actually works
        if timeout 10 "$uv_binary" --version >/dev/null 2>&1; then
            echo "[$SCRIPT_INDEX] UV binary is functional"
            return 0
        else
            echo "[$SCRIPT_INDEX] UV binary exists but not functional"
            return 1
        fi
    else
        echo "[$SCRIPT_INDEX] UV binary not found in common locations"
        return 1
    fi
}

check_and_install_sudo

# Function to install uv
install_uv() {
    echo "[$SCRIPT_INDEX] Installing UV package manager..."
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
    
    # Check if uv is already installed
    if check_uv_installed; then
        echo "[$SCRIPT_INDEX] [OK] UV is already installed"
        local uv_path=""
        if [ -f "$HOME/.local/bin/uv" ]; then
            uv_path="$HOME/.local/bin/uv"
        elif [ -f "$HOME/.cargo/bin/uv" ]; then
            uv_path="$HOME/.cargo/bin/uv"
        elif [ -f "/usr/local/bin/uv" ]; then
            uv_path="/usr/local/bin/uv"
        elif [ -f "/usr/bin/uv" ]; then
            uv_path="/usr/bin/uv"
        elif command -v uv >/dev/null 2>&1; then
            uv_path=$(which uv)
        fi
        echo "[$SCRIPT_INDEX] Version: $($uv_path --version 2>/dev/null || echo 'Unknown')"
        echo "[$SCRIPT_INDEX] Location: $uv_path"

        # Ensure symlinks and environment are still properly set up
        add_uv_to_path
        return 0
    fi
    
    echo "[$SCRIPT_INDEX] UV not found, installing..."
    
    # Install uv using the official installer with timeout
    echo "[$SCRIPT_INDEX] Downloading and installing UV from official source..."
    if timeout 300 curl -LsSf https://astral.sh/uv/install.sh | timeout 300 sh; then
        echo "[$SCRIPT_INDEX] [OK] UV installed successfully"

        # Add uv to PATH for current session (check both possible locations)
        export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

        # Verify installation using binary check
        if check_uv_installed; then
            echo "[$SCRIPT_INDEX] [OK] UV installation verified"
            local uv_path=""
            if [ -f "$HOME/.local/bin/uv" ]; then
                uv_path="$HOME/.local/bin/uv"
            elif [ -f "$HOME/.cargo/bin/uv" ]; then
                uv_path="$HOME/.cargo/bin/uv"
            fi
            if [ -n "$uv_path" ]; then
                echo "[$SCRIPT_INDEX] UV version: $($uv_path --version)"
                # Add to shell profile for persistent PATH and create symlinks
                add_uv_to_path
                return 0
            fi
        else
            echo "[$SCRIPT_INDEX] [ERROR] UV installation verification failed"
            return 1
        fi
    else
        echo "[$SCRIPT_INDEX] [ERROR] Failed to install UV"
        return 1
    fi
}

# Function to add uv to PATH and create symlinks
add_uv_to_path() {
    echo "[$SCRIPT_INDEX] Setting up UV environment..."

    # Find uv binary path
    local uv_bin_path=""

    if [ -f "$HOME/.local/bin/uv" ]; then
        uv_bin_path="$HOME/.local/bin/uv"
    elif [ -f "$HOME/.cargo/bin/uv" ]; then
        uv_bin_path="$HOME/.cargo/bin/uv"
    elif command_exists uv; then
        uv_bin_path=$(which uv)
    fi

    if [ -n "$uv_bin_path" ] && [ -f "$uv_bin_path" ]; then
        echo "[$SCRIPT_INDEX] Found UV binary at: $uv_bin_path"

        # Create symlink in /usr/local/bin for system-wide access (without PATH modification)
        if [ ! -f "/usr/local/bin/uv" ] || [ ! -x "/usr/local/bin/uv" ]; then
            if $USE_SUDO ln -sf "$uv_bin_path" "/usr/local/bin/uv"; then
                echo "[$SCRIPT_INDEX] Created symlink: /usr/local/bin/uv -> $uv_bin_path"
            else
                echo "[$SCRIPT_INDEX] [WARNING] Failed to create symlink to /usr/local/bin/uv"
            fi
        else
            # Verify existing symlink points to correct location
            local existing_target=$(readlink "/usr/local/bin/uv" 2>/dev/null || echo "")
            if [ "$existing_target" != "$uv_bin_path" ]; then
                echo "[$SCRIPT_INDEX] Updating existing symlink to correct location"
                if $USE_SUDO ln -sf "$uv_bin_path" "/usr/local/bin/uv"; then
                    echo "[$SCRIPT_INDEX] Updated symlink: /usr/local/bin/uv -> $uv_bin_path"
                fi
            else
                echo "[$SCRIPT_INDEX] Symlink /usr/local/bin/uv already exists and is correct"
            fi
        fi

        # Store UV information for other scripts (no global PATH modification)
        set_var "UV_BIN_PATH" "$uv_bin_path"
        set_var "UV_HOME" "$(dirname "$uv_bin_path")"

        echo "[$SCRIPT_INDEX] UV environment setup completed (symlink-based access)"
        return 0
    else
        echo "[$SCRIPT_INDEX] [ERROR] UV binary not found for environment setup"
        return 1
    fi
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

# Function to test uv installation
test_uv_installation() {
    echo "[$SCRIPT_INDEX] Testing UV installation..."

    # Test basic uv commands using binary check
    local uv_path=""
    if [ -f "$HOME/.local/bin/uv" ]; then
        uv_path="$HOME/.local/bin/uv"
    elif [ -f "$HOME/.cargo/bin/uv" ]; then
        uv_path="$HOME/.cargo/bin/uv"
    elif [ -f "/usr/local/bin/uv" ]; then
        uv_path="/usr/local/bin/uv"
    elif [ -f "/usr/bin/uv" ]; then
        uv_path="/usr/bin/uv"
    elif command -v uv >/dev/null 2>&1; then
        uv_path=$(which uv)
    fi

    if [ -n "$uv_path" ] && [ -x "$uv_path" ]; then
        echo "[$SCRIPT_INDEX] Testing UV binary: $uv_path"

        if timeout 10 "$uv_path" --version >/dev/null 2>&1; then
            echo "[$SCRIPT_INDEX] [OK] UV version check passed"
        else
            echo "[$SCRIPT_INDEX] [ERROR] UV version check failed"
            return 1
        fi

        # Test uv tool functionality (use simpler command for testing)
        if timeout 10 "$uv_path" --help >/dev/null 2>&1; then
            echo "[$SCRIPT_INDEX] [OK] UV help command test passed"
        else
            echo "[$SCRIPT_INDEX] [ERROR] UV help command test failed"
            return 1
        fi

        # Try tool list command (may fail if no tools installed yet, but that's OK)
        if timeout 10 "$uv_path" tool list >/dev/null 2>&1; then
            echo "[$SCRIPT_INDEX] [OK] UV tool functionality test passed"
        else
            echo "[$SCRIPT_INDEX] [INFO] UV tool list returned error (normal if no tools installed yet)"
        fi
    else
        echo "[$SCRIPT_INDEX] [ERROR] UV binary not found for testing"
        return 1
    fi

    echo "[$SCRIPT_INDEX] [OK] UV installation test completed successfully"
    return 0
}

# Main execution
echo "[$SCRIPT_INDEX] === UV Package Manager Installation ==="

# Install UV
if install_uv; then
    echo "[$SCRIPT_INDEX] [OK] UV installation completed"

    # Configure UV
    configure_uv

    # Test installation
    if test_uv_installation; then
        echo "[$SCRIPT_INDEX] [OK] UV is ready for use"
        
        # Display UV information
        echo "[$SCRIPT_INDEX] === UV Information ==="
        local uv_path=""
        if [ -f "$HOME/.local/bin/uv" ]; then
            uv_path="$HOME/.local/bin/uv"
        elif [ -f "$HOME/.cargo/bin/uv" ]; then
            uv_path="$HOME/.cargo/bin/uv"
        elif [ -f "/usr/local/bin/uv" ]; then
            uv_path="/usr/local/bin/uv"
        elif [ -f "/usr/bin/uv" ]; then
            uv_path="/usr/bin/uv"
        elif command -v uv >/dev/null 2>&1; then
            uv_path=$(which uv)
        fi
        
        if [ -n "$uv_path" ]; then
            echo "[$SCRIPT_INDEX] Version: $($uv_path --version 2>/dev/null || echo 'Unknown')"
            echo "[$SCRIPT_INDEX] Location: $uv_path"
            echo "[$SCRIPT_INDEX] Config: $HOME/.config/uv/uv.toml"
            echo "[$SCRIPT_INDEX] Tools: Use 'uv tool install <package>' to install Python tools"
            echo "[$SCRIPT_INDEX] Projects: Use 'uv init' to create new Python projects"
            
            # Set global variable for other scripts
            set_var "UV_AVAILABLE" "true"
            set_var "UV_VERSION" "$($uv_path --version 2>/dev/null | cut -d' ' -f2 || echo 'unknown')"
        else
            echo "[$SCRIPT_INDEX] [ERROR] UV binary not found for information display"
            set_var "UV_AVAILABLE" "false"
        fi
        
    else
        echo "[$SCRIPT_INDEX] [ERROR] UV installed but tests failed"
        set_var "UV_AVAILABLE" "false"
    fi
else
    echo "[$SCRIPT_INDEX] [ERROR] UV installation failed"
    set_var "UV_AVAILABLE" "false"
fi

echo "[$SCRIPT_INDEX] UV Package Manager Installation Script completed"