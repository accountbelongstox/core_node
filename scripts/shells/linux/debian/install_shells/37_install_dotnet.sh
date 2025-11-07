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
    
    # Add Microsoft package signing key
    log_message "Adding Microsoft package signing key..."
    if wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg; then
        $USE_SUDO install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
        $USE_SUDO sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/microsoft-debian-bullseye-prod bullseye main" > /etc/apt/sources.list.d/microsoft-prod.list'
        rm packages.microsoft.gpg
        log_message "Microsoft repository added successfully"
    else
        log_message "Failed to add Microsoft repository"
        return 1
    fi
    
    # Update package lists with new repository
    log_message "Updating package lists with Microsoft repository..."
    if timeout 300 $USE_SUDO apt update; then
        log_message "Package lists updated successfully"
    else
        log_message "Warning: Package update failed"
    fi
    
    # Install .NET SDK
    log_message "Installing .NET SDK $DOTNET_VERSION..."
    if timeout 600 $USE_SUDO apt install -y "dotnet-sdk-$DOTNET_VERSION"; then
        log_message "Successfully installed .NET SDK via Microsoft repository"
        
        # Verify installation
        if command_exists dotnet; then
            dotnet --version | head -1 | tee -a "$LOG_FILE"
            dotnet --list-sdks | tee -a "$LOG_FILE"
        fi
        
        return 0
    else
        log_message "Failed to install .NET SDK via Microsoft repository"
        return 1
    fi
}

# Function to install .NET via snap
install_dotnet_snap() {
    log_message "Installing .NET via snap as fallback..."
    
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
    log_message "Starting .NET Development Platform Installation"
    log_message "Install Mode: $INSTALL_MODE"
    log_message "=========================================="
    
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
}

# Execute main function
main "$@"
