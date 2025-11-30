#!/bin/bash
# Central Installation Configuration
# This file contains centralized configuration for all installation scripts

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

# Script identification
INSTALL_CONFIG_VERSION="1.0.0"

# Declare global variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source centralized application registry
source "$SCRIPT_DIR/app_registry.sh"
NODE_MODULES_INSTALLER="$PROJECT_ROOT/scripts/shells/scripts/installer_node_modules/installer_node_modules.sh"
CORE_NODE_INIT_APP="$PROJECT_ROOT/apps/core_node_init/main.js"
MAIN_JS="$PROJECT_ROOT/main.js"

# Installation state tracking
NODE_MODULES_INSTALLED_FLAG="$PROJECT_ROOT/.install_state/node_modules_installed"
PNPM_INSTALLED_FLAG="$PROJECT_ROOT/.install_state/pnpm_installed"

# Download configuration
DOWNLOAD_TIMEOUT=300000  # 5 minutes in milliseconds
DOWNLOAD_POLL_INTERVAL=5  # 5 seconds
DOWNLOAD_MAX_WAIT=300     # 5 minutes in seconds

# Application configurations (using centralized registry)
declare -A APP_CONFIGS
# Populate from centralized registry
for app in $(get_registered_apps); do
    APP_CONFIGS[${app}_name]=$(get_app_config "$app" "name")
    APP_CONFIGS[${app}_pattern]=$(get_app_config "$app" "pattern")
    APP_CONFIGS[${app}_url]=$(get_app_config "$app" "url")
    APP_CONFIGS[${app}_keywords]=$(get_app_config "$app" "keywords")
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if node modules are already installed
is_node_modules_installed() {
    if [[ -f "$NODE_MODULES_INSTALLED_FLAG" ]]; then
        return 0  # Already installed
    fi
    
    if [[ -d "$PROJECT_ROOT/node_modules" ]] && [[ -n "$(ls -A "$PROJECT_ROOT/node_modules" 2>/dev/null)" ]]; then
        # Mark as installed
        mkdir -p "$(dirname "$NODE_MODULES_INSTALLED_FLAG")"
        touch "$NODE_MODULES_INSTALLED_FLAG"
        return 0  # Installed
    fi
    
    return 1  # Not installed
}

# Check if pnpm is installed
is_pnpm_installed() {
    if [[ -f "$PNPM_INSTALLED_FLAG" ]]; then
        return 0  # Already checked and installed
    fi

    if command -v pnpm >/dev/null 2>&1; then
        # Mark as installed
        mkdir -p "$(dirname "$PNPM_INSTALLED_FLAG")"
        touch "$PNPM_INSTALLED_FLAG"
        return 0  # Installed
    fi

    return 1  # Not installed
}

# Install node modules and pnpm if needed
ensure_node_modules() {
    local force_install=${1:-false}

    if [[ "$force_install" == "true" ]]; then
        log_info "Force install mode enabled"
        rm -f "$NODE_MODULES_INSTALLED_FLAG" "$PNPM_INSTALLED_FLAG"
    fi

    # Check if already installed
    if is_node_modules_installed && is_pnpm_installed; then
        log_success "Node modules and pnpm are already installed"
        return 0
    fi

    log_info "Installing node modules and pnpm..."
    
    # Check if installer script exists
    if [[ ! -f "$NODE_MODULES_INSTALLER" ]]; then
        log_error "Node modules installer script not found: $NODE_MODULES_INSTALLER"
        return 1
    fi
    
    # Make installer executable
    chmod +x "$NODE_MODULES_INSTALLER"
    
    # Run the installer
    if "$NODE_MODULES_INSTALLER"; then
        log_success "Node modules and pnpm installation completed"

        # Mark as installed
        mkdir -p "$(dirname "$NODE_MODULES_INSTALLED_FLAG")"
        touch "$NODE_MODULES_INSTALLED_FLAG"
        touch "$PNPM_INSTALLED_FLAG"

        return 0
    else
        log_error "Failed to install node modules and pnpm"
        return 1
    fi
}

# Check if core_node_init app is available
is_core_node_init_available() {
    if [[ ! -f "$MAIN_JS" ]]; then
        log_warning "Main.js not found: $MAIN_JS"
        return 1
    fi
    
    if [[ ! -f "$CORE_NODE_INIT_APP" ]]; then
        log_warning "Core node init app not found: $CORE_NODE_INIT_APP"
        return 1
    fi
    
    if ! command -v node >/dev/null 2>&1; then
        log_warning "Node.js not available"
        return 1
    fi
    
    return 0
}

# Find all Downloads directories
find_all_downloads_dirs() {
    local downloads_dirs=()

    # Add common user Downloads directories
    for home_dir in /home/*; do
        if [[ -d "$home_dir/Downloads" ]]; then
            downloads_dirs+=("$home_dir/Downloads")
        fi
        if [[ -d "$home_dir/downloads" ]]; then
            downloads_dirs+=("$home_dir/downloads")
        fi
    done

    # Add root Downloads if exists
    if [[ -d "/root/Downloads" ]]; then
        downloads_dirs+=("/root/Downloads")
    fi
    
    # Add current user Downloads
    if [[ -d "$HOME/Downloads" ]]; then
        downloads_dirs+=("$HOME/Downloads")
    fi
    
    if [[ -d "$HOME/downloads" ]]; then
        downloads_dirs+=("$HOME/downloads")
    fi

    printf '%s\n' "${downloads_dirs[@]}"
}

# Find files matching pattern in Downloads directories
find_files_by_pattern() {
    local pattern="$1"

    # Redirect all log output to stderr to keep stdout clean
    {
        log_info "DEBUG: find_files_by_pattern called with pattern: '$pattern'"

        local downloads_dirs=($(find_all_downloads_dirs))
        log_info "DEBUG: Downloads directories: ${downloads_dirs[*]}"

        local matched_files=()

        for downloads_dir in "${downloads_dirs[@]}"; do
            if [[ -d "$downloads_dir" ]]; then
                log_info "DEBUG: Searching in directory: $downloads_dir"

                # List all files for debugging
                local all_files=$(find "$downloads_dir" -maxdepth 1 -type f 2>/dev/null | head -5)
                log_info "DEBUG: Sample files in $downloads_dir: $all_files"

                # Use find with -name pattern matching
                while IFS= read -r -d '' file; do
                    local filename=$(basename "$file")
                    log_info "DEBUG: Checking file: $filename"

                    # Skip backup files (containing numbers in parentheses like (1), (2), etc.)
                    if [[ ! "$file" =~ \([0-9]+\) ]]; then
                        # Check if filename matches the pattern using bash regex
                        if [[ "$filename" =~ $pattern ]]; then
                            log_info "DEBUG: File matches pattern: $filename"
                            matched_files+=("$file")
                        else
                            log_info "DEBUG: File does not match pattern: $filename"
                        fi
                    else
                        log_info "DEBUG: Skipping backup file: $filename"
                    fi
                done < <(find "$downloads_dir" -maxdepth 1 -type f -print0 2>/dev/null)
            else
                log_warning "DEBUG: Directory does not exist: $downloads_dir"
            fi
        done

        log_info "DEBUG: Total matched files: ${#matched_files[@]}"

        if [[ ${#matched_files[@]} -eq 0 ]]; then
            log_warning "DEBUG: No files found matching pattern: $pattern"
            return 1  # No files found
        fi

        # Return the most recent file
        local latest_file=""
        local latest_time=0

        for file in "${matched_files[@]}"; do
            local file_time=$(stat -c %Y "$file" 2>/dev/null || echo 0)
            log_info "DEBUG: File $file has timestamp: $file_time"
            if [[ $file_time -gt $latest_time ]]; then
                latest_time=$file_time
                latest_file="$file"
            fi
        done

        log_success "DEBUG: Selected latest file: $latest_file"

        # Return only the file path to stdout
        echo "$latest_file"
        return 0
    } >&2
}

# Automated download using core_node_init
automated_download() {
    local target="$1"

    log_info "DEBUG: automated_download called with target: '$target'"
    log_info "Attempting automated download for: $target"

    # Ensure node modules are installed first
    log_info "DEBUG: Checking if node modules are installed..."
    if ! ensure_node_modules; then
        log_error "Failed to ensure node modules are installed"
        return 1
    fi
    log_success "DEBUG: Node modules are ready"

    # Check if core_node_init is available
    log_info "DEBUG: Checking if core_node_init is available..."
    if ! is_core_node_init_available; then
        log_warning "Core node init app not available, cannot perform automated download"
        log_info "DEBUG: PROJECT_ROOT=$PROJECT_ROOT"
        log_info "DEBUG: MAIN_JS=$MAIN_JS"
        log_info "DEBUG: CORE_NODE_INIT_APP=$CORE_NODE_INIT_APP"
        return 1
    fi
    log_success "DEBUG: core_node_init is available"

    log_info "Running automated download: node main.js app=core_node_init download $target"
    log_info "DEBUG: Current directory: $(pwd)"
    log_info "DEBUG: Changing to project root: $PROJECT_ROOT"

    # Change to project root and run the download
    cd "$PROJECT_ROOT" || {
        log_error "Failed to change to project root: $PROJECT_ROOT"
        return 1
    }

    log_info "DEBUG: Now in directory: $(pwd)"
    log_info "DEBUG: About to run: node main.js app=core_node_init download $target --timeout $DOWNLOAD_TIMEOUT"

    # Run the automated download with real-time output
    if node main.js app=core_node_init download "$target" --timeout "$DOWNLOAD_TIMEOUT"; then
        log_success "Automated download completed successfully"
        return 0
    else
        local exit_code=$?
        log_warning "Automated download failed with exit code: $exit_code"
        return 1
    fi
}

# Wait for file to appear in downloads directory
wait_for_file_by_pattern() {
    local pattern="$1"
    local timeout="${2:-$DOWNLOAD_MAX_WAIT}"
    local poll_interval="${3:-$DOWNLOAD_POLL_INTERVAL}"
    
    log_info "Waiting for file matching pattern: $pattern (timeout: ${timeout}s)"
    
    local elapsed=0
    
    while [[ $elapsed -lt $timeout ]]; do
        local file=$(find_files_by_pattern "$pattern")
        if [[ $? -eq 0 ]] && [[ -n "$file" ]]; then
            log_success "Found file: $(basename "$file")"
            echo "$file"
            return 0
        fi
        
        sleep "$poll_interval"
        elapsed=$((elapsed + poll_interval))
        
        # Show progress every 30 seconds
        if [[ $((elapsed % 30)) -eq 0 ]]; then
            log_info "Still waiting... ($elapsed/${timeout}s)"
        fi
    done
    
    log_error "Timeout waiting for file matching pattern: $pattern"
    return 1
}

# Export functions for use in other scripts
export -f log_info log_success log_warning log_error
export -f is_node_modules_installed is_pnpm_installed ensure_node_modules
export -f is_core_node_init_available find_all_downloads_dirs find_files_by_pattern
export -f automated_download wait_for_file_by_pattern
