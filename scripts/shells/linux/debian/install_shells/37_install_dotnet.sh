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

# Script identification and path setup
SCRIPT_INDEX="37"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
START_DOTNET=$(get_var "START_DOTNET" "false")
SCRIPT_TEMP_DIR=$(create_script_temp_dir "127_install_dotnet")
LOG_FILE="$SCRIPT_TEMP_DIR/dotnet_install_$(date +%Y%m%d_%H%M%S).log"
DOTNET_VERSION="8.0"

# Logging function
log_message() {
    local message="$1"
    echo "[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

log_message "Starting .NET development platform installation..."
log_message "Install mode: $INSTALL_MODE"
log_message "Target .NET version: $DOTNET_VERSION"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if .NET is already installed
check_dotnet_installed() {
    if command_exists dotnet; then
        return 0  # true, is installed
    fi
    return 1  # false, is not installed
}

# Function to disable/uninstall .NET
disable_dotnet() {
    log_message "Disabling/uninstalling .NET..."

    if ! check_dotnet_installed; then
        log_message ".NET is not installed"
        return 0
    fi

    log_message ".NET is installed, proceeding to remove..."

    # Check if installed via snap
    if command_exists snap && snap list 2>/dev/null | grep -q "^dotnet-sdk "; then
        log_message "Removing .NET SDK installed via snap..."
        $USE_SUDO snap remove dotnet-sdk 2>/dev/null || true
    fi

    # Remove symlinks
    log_message "Removing .NET symlinks..."
    $USE_SUDO rm -f /usr/bin/dotnet 2>/dev/null || true
    $USE_SUDO rm -f /usr/local/bin/dotnet 2>/dev/null || true

    # Remove installation directory
    if [ -d "/usr/share/dotnet" ]; then
        log_message "Removing /usr/share/dotnet directory..."
        $USE_SUDO rm -rf /usr/share/dotnet
    fi

    # Remove from PATH in /etc/environment
    if [ -f /etc/environment ]; then
        if grep -q "/usr/share/dotnet" /etc/environment 2>/dev/null; then
            log_message "Removing .NET from /etc/environment PATH..."
            $USE_SUDO sed -i '/\/usr\/share\/dotnet/d' /etc/environment
        fi
    fi

    # Remove .NET tools from user profiles
    local shell_profiles=(
        "$HOME/.bashrc"
        "$HOME/.zshrc"
        "$HOME/.profile"
    )

    for profile in "${shell_profiles[@]}"; do
        if [ -f "$profile" ]; then
            if grep -q "\.dotnet/tools" "$profile"; then
                log_message "Removing .NET tools from PATH in $profile"
                sed -i '/\.dotnet\/tools/d' "$profile"
                sed -i '/# \.NET tools path/d' "$profile"
            fi
        fi
    done

    # Remove .NET user directory
    if [ -d "$HOME/.dotnet" ]; then
        log_message "Removing $HOME/.dotnet directory..."
        rm -rf "$HOME/.dotnet"
    fi

    # Verify removal
    if check_dotnet_installed; then
        log_message "Warning: Failed to completely remove .NET"
    else
        log_message ".NET has been successfully removed"
    fi
}

# Function to get OS information
get_os_info() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID $VERSION_ID"
    else
        echo "unknown"
    fi
}

# Function to install .NET via Microsoft repository
install_dotnet_microsoft_repo() {
    log_message "Installing .NET via Microsoft repository..."
    
    if command_exists dotnet; then
        log_message ".NET is already installed"
        dotnet --version | head -1 | tee -a "$LOG_FILE"
        return 0
    fi
    
    local os_info=$(get_os_info)
    log_message "Detected OS: $os_info"
    
    # Update package lists
    log_message "Updating package lists with timeout..."
    if timeout 300 $USE_SUDO apt update; then
        log_message "Package lists updated successfully"
    else
        log_message "Warning: Package update timed out or failed, continuing anyway"
    fi
    
    # Install prerequisites
    log_message "Installing prerequisites..."
    if timeout 300 $USE_SUDO apt install -y wget apt-transport-https software-properties-common; then
        log_message "Prerequisites installed successfully"
    else
        log_message "Warning: Some prerequisites failed to install"
    fi

    # Use Microsoft's official installation script instead of adding repository
    log_message "Downloading Microsoft .NET installation script..."
    local install_script="/tmp/dotnet-install.sh"

    if wget -q -O "$install_script" "https://dot.net/v1/dotnet-install.sh"; then
        chmod +x "$install_script"
        log_message ".NET installation script downloaded successfully"

        # Install .NET SDK using the official script
        log_message "Installing .NET SDK $DOTNET_VERSION using official Microsoft script..."
        if bash "$install_script" --version "$DOTNET_VERSION" --install-dir /usr/share/dotnet; then
            log_message "Successfully installed .NET SDK"

            # Create symlinks
            $USE_SUDO ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet 2>/dev/null || true
            $USE_SUDO ln -sf /usr/share/dotnet/dotnet /usr/local/bin/dotnet 2>/dev/null || true

            # Add to PATH
            if ! grep -q "/usr/share/dotnet" /etc/environment 2>/dev/null; then
                echo 'PATH="/usr/share/dotnet:$PATH"' | $USE_SUDO tee -a /etc/environment > /dev/null
            fi

            # Clean up
            rm -f "$install_script"

            # Verify installation
            if command_exists dotnet; then
                dotnet --version | head -1 | tee -a "$LOG_FILE"
                dotnet --list-sdks | tee -a "$LOG_FILE"
            fi

            return 0
        else
            log_message "Failed to install .NET SDK using installation script"
            rm -f "$install_script"
            return 1
        fi
    else
        log_message "Failed to download .NET installation script"
        log_message "Please download manually from: https://dotnet.microsoft.com/download"
        log_message "Or install via snap: sudo snap install dotnet-sdk --classic"
        return 1
    fi
}

# Function to install .NET via snap
install_dotnet_snap() {
    log_message "Installing .NET via snap as fallback..."

    # The dotnet-sdk snap is classic confinement (pulls core20/core24/snapd). On a
    # headless server prefer the Microsoft apt repo (tried first) and skip the snap
    # fallback. Force with ALLOW_SNAP_ON_SERVER=1.
    if [ "${HAS_DESKTOP_ENVIRONMENT:-false}" != "true" ] && [ "${ALLOW_SNAP_ON_SERVER:-0}" != "1" ]; then
        log_message "No desktop environment: skipping dotnet-sdk snap (avoids core20/24/snapd). Set ALLOW_SNAP_ON_SERVER=1 to force."
        return 1
    fi

    if ! command_exists snap; then
        log_message "Snap is not installed. Installing snapd..."
        if timeout 600 $USE_SUDO apt install -y snapd; then
            log_message "snapd installed successfully"
            $USE_SUDO systemctl enable --now snapd.socket || true
            $USE_SUDO ln -sf /var/lib/snapd/snap /snap 2>/dev/null || true
        else
            log_message "Failed to install snapd"
            return 1
        fi
    fi
    
    log_message "Installing .NET SDK via snap..."
    if $USE_SUDO snap install dotnet-sdk --classic; then
        log_message "Successfully installed .NET SDK via snap"
        
        # Create symlink for system-wide access
        $USE_SUDO ln -sf /snap/dotnet-sdk/current/dotnet /usr/local/bin/dotnet 2>/dev/null || true
        
        # Verify installation
        if command_exists dotnet; then
            dotnet --version | head -1 | tee -a "$LOG_FILE"
        fi
        
        return 0
    else
        log_message "Failed to install .NET SDK via snap"
        return 1
    fi
}

# Function to setup .NET environment
setup_dotnet_environment() {
    log_message "Setting up .NET environment..."
    
    # Add .NET tools to PATH
    local dotnet_tools_path="$HOME/.dotnet/tools"
    
    # Add to shell profiles
    local shell_profiles=(
        "$HOME/.bashrc"
        "$HOME/.zshrc"
        "$HOME/.profile"
    )
    
    local dotnet_path_line='export PATH="$PATH:$HOME/.dotnet/tools"'
    
    for profile in "${shell_profiles[@]}"; do
        if [ -f "$profile" ]; then
            if ! grep -q "\.dotnet/tools" "$profile"; then
                log_message "Adding .NET tools to PATH in $profile"
                echo "" >> "$profile"
                echo "# .NET tools path" >> "$profile"
                echo "$dotnet_path_line" >> "$profile"
            else
                log_message ".NET tools PATH already configured in $profile"
            fi
        fi
    done
    
    # Set environment for current session
    export PATH="$PATH:$HOME/.dotnet/tools"
    
    # Install common .NET global tools
    log_message "Installing common .NET global tools..."
    
    local dotnet_tools=(
        "dotnet-ef"                    # Entity Framework Core tools
        "dotnet-aspnet-codegenerator"  # ASP.NET Core scaffolding
        "dotnet-outdated-tool"         # Check for outdated packages
        "dotnet-format"                # Code formatter
    )
    
    for tool in "${dotnet_tools[@]}"; do
        if dotnet tool list --global 2>/dev/null | awk '{print $1}' | grep -qix "$tool"; then
            log_message ".NET tool already installed, skipping: $tool"
            continue
        fi
        log_message "Installing .NET tool: $tool"
        if dotnet tool install --global "$tool" 2>/dev/null; then
            log_message "Successfully installed $tool"
        else
            log_message "Failed to install $tool (may already be installed)"
        fi
    done
    
    # Configure NuGet sources
    log_message "Configuring NuGet package sources..."
    dotnet nuget list source | tee -a "$LOG_FILE"
}

# Main installation logic
main() {
    log_message "=========================================="
    log_message ".NET SDK Management Script"
    log_message "Install Mode: $INSTALL_MODE"
    log_message "START_DOTNET: $START_DOTNET"
    log_message "=========================================="

    # Check if .NET should be processed based on installation mode
    case "$INSTALL_MODE" in
        "base")
            log_message "Base mode - .NET installation skipped"
            exit 0
            ;;
        "server"|"full"|"desktop")
            log_message "Mode: $INSTALL_MODE - Processing .NET..."
            ;;
        *)
            log_message "Unknown mode: $INSTALL_MODE - Defaulting to base (skip)"
            exit 0
            ;;
    esac

    # Process based on START_DOTNET value
    if [ "$START_DOTNET" = "true" ]; then
        log_message "START_DOTNET is true - Installing .NET SDK..."

        # Try Microsoft repository first, then snap as fallback
        if install_dotnet_microsoft_repo; then
            log_message ".NET installation via Microsoft repository successful"
        elif install_dotnet_snap; then
            log_message ".NET installation via snap successful"
        else
            log_message "All .NET installation methods failed"
            log_message "=========================================="
            log_message ".NET Installation Failed"
            log_message "Log file: $LOG_FILE"
            log_message "=========================================="
            exit 1
        fi

        # Setup environment and tools
        setup_dotnet_environment

        log_message "=========================================="
        log_message ".NET Installation Complete"
        log_message "Log file: $LOG_FILE"
        log_message "=========================================="
        log_message "Note: You may need to restart your shell to use .NET global tools"
    else
        log_message "START_DOTNET is false - Skipping .NET installation"

        # If .NET is already installed, remove it
        if check_dotnet_installed; then
            log_message ".NET is already installed, proceeding to remove..."
            disable_dotnet

            log_message "=========================================="
            log_message ".NET has been removed"
            log_message "Log file: $LOG_FILE"
            log_message "=========================================="
        else
            log_message ".NET is not installed and will not be installed"

            log_message "=========================================="
            log_message ".NET skipped"
            log_message "Log file: $LOG_FILE"
            log_message "=========================================="
        fi
    fi
}

# Execute main function
main "$@"
