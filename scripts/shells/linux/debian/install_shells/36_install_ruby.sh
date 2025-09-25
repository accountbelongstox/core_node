#!/bin/bash
n# Include common functions
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
SCRIPT_INDEX="36"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
SCRIPT_TEMP_DIR=$(create_script_temp_dir "126_install_ruby")
LOG_FILE="$SCRIPT_TEMP_DIR/ruby_install_$(date +%Y%m%d_%H%M%S).log"

# Logging function
log_message() {
    local message="$1"
    echo "[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

log_message "Starting Ruby programming language installation..."
log_message "Install mode: $INSTALL_MODE"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install Ruby via apt
install_ruby_apt() {
    log_message "Installing Ruby via apt..."
    
    if command_exists ruby; then
        log_message "Ruby is already installed"
        ruby --version | head -1 | tee -a "$LOG_FILE"
        return 0
    fi
    
    # Update package lists
    log_message "Updating package lists with timeout..."
    if timeout 300 $USE_SUDO apt update; then
        log_message "Package lists updated successfully"
    else
        log_message "Warning: Package update timed out or failed, continuing anyway"
    fi
    
    # Install Ruby and development dependencies
    log_message "Installing Ruby and development dependencies..."
    local ruby_packages=(
        "ruby-full"
        "ruby-dev"
        "build-essential"
        "zlib1g-dev"
        "liblzma-dev"
        "libssl-dev"
        "libreadline-dev"
        "libyaml-dev"
        "libxml2-dev"
        "libxslt1-dev"
        "libcurl4-openssl-dev"
        "libffi-dev"
    )
    
    if timeout 600 $USE_SUDO apt install -y "${ruby_packages[@]}"; then
        log_message "Successfully installed Ruby via apt"
        
        # Verify installation
        if command_exists ruby; then
            ruby --version | head -1 | tee -a "$LOG_FILE"
            gem --version | head -1 | tee -a "$LOG_FILE"
        fi
        
        return 0
    else
        log_message "Failed to install Ruby via apt"
        return 1
    fi
}

# Function to install rbenv (Ruby version manager)
install_rbenv() {
    log_message "Installing rbenv (Ruby version manager)..."
    
    if command_exists rbenv; then
        log_message "rbenv is already installed"
        return 0
    fi
    
    # Clone rbenv repository
    local rbenv_dir="$HOME/.rbenv"
    if [ -d "$rbenv_dir" ]; then
        log_message "rbenv directory already exists, updating..."
        cd "$rbenv_dir" && git pull
    else
        log_message "Cloning rbenv repository..."
        if git clone https://github.com/rbenv/rbenv.git "$rbenv_dir"; then
            log_message "rbenv cloned successfully"
        else
            log_message "Failed to clone rbenv"
            return 1
        fi
    fi
    
    # Clone ruby-build plugin
    local ruby_build_dir="$rbenv_dir/plugins/ruby-build"
    if [ -d "$ruby_build_dir" ]; then
        log_message "ruby-build plugin already exists, updating..."
        cd "$ruby_build_dir" && git pull
    else
        log_message "Cloning ruby-build plugin..."
        if git clone https://github.com/rbenv/ruby-build.git "$ruby_build_dir"; then
            log_message "ruby-build plugin cloned successfully"
        else
            log_message "Failed to clone ruby-build plugin"
            return 1
        fi
    fi
    
    # Add rbenv to PATH
    export PATH="$rbenv_dir/bin:$PATH"
    
    return 0
}

# Function to setup Ruby environment
setup_ruby_environment() {
    log_message "Setting up Ruby environment..."
    
    # Configure gem installation directory for user
    local gem_home="$HOME/.gem"
    local gem_bin="$gem_home/bin"
    
    # Create gem directories
    mkdir -p "$gem_home" "$gem_bin"
    
    # Add gem paths to shell profiles
    local shell_profiles=(
        "$HOME/.bashrc"
        "$HOME/.zshrc"
        "$HOME/.profile"
    )
    
    local gem_config_lines=(
        'export GEM_HOME="$HOME/.gem"'
        'export PATH="$HOME/.gem/bin:$PATH"'
    )
    
    for profile in "${shell_profiles[@]}"; do
        if [ -f "$profile" ]; then
            local needs_update=false
            for line in "${gem_config_lines[@]}"; do
                if ! grep -q "$(echo "$line" | cut -d'=' -f1)" "$profile"; then
                    needs_update=true
                    break
                fi
            done
            
            if [ "$needs_update" = true ]; then
                log_message "Adding Ruby gem configuration to $profile"
                echo "" >> "$profile"
                echo "# Ruby gem configuration" >> "$profile"
                for line in "${gem_config_lines[@]}"; do
                    echo "$line" >> "$profile"
                done
            else
                log_message "Ruby gem configuration already present in $profile"
            fi
        fi
    done
    
    # Set environment for current session
    export GEM_HOME="$HOME/.gem"
    export PATH="$HOME/.gem/bin:$PATH"
    
    # Install common Ruby gems
    log_message "Installing common Ruby gems..."
    
    local common_gems=(
        "bundler"         # Dependency manager
        "rake"            # Build tool
        "rubocop"         # Code linter
        "pry"             # Enhanced REPL
    )
    
    for gem_name in "${common_gems[@]}"; do
        log_message "Installing gem: $gem_name"
        if gem install "$gem_name" --user-install; then
            log_message "Successfully installed $gem_name"
        else
            log_message "Failed to install $gem_name"
        fi
    done
}

# Main installation logic
main() {
    log_message "=========================================="
    log_message "Starting Ruby Programming Language Installation"
    log_message "Install Mode: $INSTALL_MODE"
    log_message "=========================================="
    
    # Install Ruby via apt
    if install_ruby_apt; then
        log_message "Ruby installation successful"
        
        # Setup environment and common gems
        setup_ruby_environment
        
        # Optionally install rbenv for version management
        log_message "Installing rbenv for Ruby version management..."
        install_rbenv
        
        log_message "=========================================="
        log_message "Ruby Installation Complete"
        log_message "Log file: $LOG_FILE"
        log_message "=========================================="
        log_message "Note: You may need to restart your shell to use Ruby gems"
    else
        log_message "=========================================="
        log_message "Ruby Installation Failed"
        log_message "Log file: $LOG_FILE"
        log_message "=========================================="
        exit 1
    fi
}

# Execute main function
main "$@"
