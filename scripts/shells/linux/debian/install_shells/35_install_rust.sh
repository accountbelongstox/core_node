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
SCRIPT_INDEX="35"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
SCRIPT_TEMP_DIR=$(create_script_temp_dir "125_install_rust")
LOG_FILE="$SCRIPT_TEMP_DIR/rust_install_$(date +%Y%m%d_%H%M%S).log"

# Logging function
log_message() {
    local message="$1"
    echo "[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

log_message "Starting Rust programming language installation..."
log_message "Install mode: $INSTALL_MODE"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install Rust via rustup
install_rust() {
    log_message "Installing Rust via rustup..."
    
    if command_exists rustc; then
        log_message "Rust is already installed"
        rustc --version | head -1 | tee -a "$LOG_FILE"
        return 0
    fi
    
    # Download and run rustup installer
    log_message "Downloading rustup installer..."
    if curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y; then
        # Source the cargo environment
        source "$HOME/.cargo/env" 2>/dev/null || true
        
        # Add to PATH for current session
        export PATH="$HOME/.cargo/bin:$PATH"
        
        log_message "Successfully installed Rust via rustup"
        
        # Verify installation
        if command_exists rustc; then
            rustc --version | head -1 | tee -a "$LOG_FILE"
            cargo --version | head -1 | tee -a "$LOG_FILE"
        else
            log_message "Warning: Rust installed but not found in PATH"
        fi
        
        return 0
    else
        log_message "Failed to install Rust via rustup"
        return 1
    fi
}

# Function to setup Rust environment
setup_rust_environment() {
    log_message "Setting up Rust environment..."
    
    # Add cargo bin to PATH in shell profiles
    local shell_profiles=(
        "$HOME/.bashrc"
        "$HOME/.zshrc"
        "$HOME/.profile"
    )
    
    local cargo_path_line='export PATH="$HOME/.cargo/bin:$PATH"'
    
    for profile in "${shell_profiles[@]}"; do
        if [ -f "$profile" ]; then
            if ! grep -q "\.cargo/bin" "$profile"; then
                log_message "Adding Rust to PATH in $profile"
                echo "" >> "$profile"
                echo "# Rust cargo bin path" >> "$profile"
                echo "$cargo_path_line" >> "$profile"
            else
                log_message "Rust PATH already configured in $profile"
            fi
        fi
    done
    
    # Install common Rust tools
    log_message "Installing common Rust tools..."
    
    # Source cargo environment
    source "$HOME/.cargo/env" 2>/dev/null || true
    export PATH="$HOME/.cargo/bin:$PATH"
    
    # Install Rust components via rustup
    log_message "Installing Rust components..."
    local rust_components=(
        "clippy"          # linter
        "rustfmt"         # code formatter
        "rust-src"        # source code for rust-analyzer
    )
    
    for component in "${rust_components[@]}"; do
        if ! rustup component list --installed | grep -q "$component"; then
            log_message "Installing Rust component: $component..."
            if rustup component add "$component"; then
                log_message "Successfully installed $component"
            else
                log_message "Failed to install $component"
            fi
        else
            log_message "$component is already installed"
        fi
    done
    
    # Install Cargo tools
    log_message "Installing Cargo tools..."
    local cargo_tools=(
        "cargo-edit"      # cargo add, cargo rm commands
        "cargo-watch"     # cargo watch for auto-rebuilding
        "cargo-tree"      # dependency tree visualization
    )
    
    for tool in "${cargo_tools[@]}"; do
        if ! command_exists "$tool"; then
            log_message "Installing $tool..."
            if cargo install "$tool"; then
                log_message "Successfully installed $tool"
            else
                log_message "Failed to install $tool"
            fi
        else
            log_message "$tool is already installed"
        fi
    done
}

# Main installation logic
main() {
    log_message "=========================================="
    log_message "Starting Rust Programming Language Installation"
    log_message "Install Mode: $INSTALL_MODE"
    log_message "=========================================="
    
    # Install Rust
    if install_rust; then
        log_message "Rust installation successful"
        
        # Setup environment and tools
        setup_rust_environment
        
        log_message "=========================================="
        log_message "Rust Installation Complete"
        log_message "Log file: $LOG_FILE"
        log_message "=========================================="
        log_message "Note: You may need to restart your shell or run 'source ~/.cargo/env' to use Rust"
    else
        log_message "=========================================="
        log_message "Rust Installation Failed"
        log_message "Log file: $LOG_FILE"
        log_message "=========================================="
        exit 1
    fi
}

# Execute main function
main "$@"
