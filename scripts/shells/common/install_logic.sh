#!/bin/bash
# Central Installation Logic
# This file contains centralized installation logic for all applications

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

# Source the configuration and registry
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/app_registry.sh"
source "$SCRIPT_DIR/install_config.sh"

# Declare variables
INSTALL_LOGIC_VERSION="1.0.0"

# Kill processes by name
kill_processes_by_name() {
    local process_name="$1"
    local force_kill="${2:-false}"
    
    log_info "Checking for running $process_name processes..."
    
    # Find processes
    local pids=$(pgrep -f "$process_name" 2>/dev/null)
    
    if [[ -z "$pids" ]]; then
        log_info "No $process_name processes found"
        return 0
    fi
    
    log_warning "Found $process_name processes: $pids"
    
    if [[ "$force_kill" == "true" ]]; then
        log_info "Force killing $process_name processes..."
        echo "$pids" | xargs -r kill -9 2>/dev/null
    else
        log_info "Gracefully terminating $process_name processes..."
        echo "$pids" | xargs -r kill -TERM 2>/dev/null
        
        # Wait a bit for graceful shutdown
        sleep 3
        
        # Check if any processes are still running
        local remaining_pids=$(pgrep -f "$process_name" 2>/dev/null)
        if [[ -n "$remaining_pids" ]]; then
            log_warning "Some processes still running, force killing..."
            echo "$remaining_pids" | xargs -r kill -9 2>/dev/null
        fi
    fi
    
    # Final check
    sleep 1
    local final_pids=$(pgrep -f "$process_name" 2>/dev/null)
    if [[ -z "$final_pids" ]]; then
        log_success "All $process_name processes terminated"
        return 0
    else
        log_error "Failed to terminate some $process_name processes: $final_pids"
        return 1
    fi
}

# Generic download and install workflow
download_and_install_app() {
    local app_name="$1"
    local force_download="${2:-false}"
    
    log_info "Starting download and install workflow for: $app_name"
    
    # Get app configuration
    local pattern_key="${app_name}_pattern"
    local name_key="${app_name}_name"
    local url_key="${app_name}_url"
    
    local file_pattern="${APP_CONFIGS[$pattern_key]}"
    local display_name="${APP_CONFIGS[$name_key]}"
    local download_url="${APP_CONFIGS[$url_key]}"
    
    if [[ -z "$file_pattern" ]] || [[ -z "$display_name" ]]; then
        log_error "Unknown application: $app_name"
        return 1
    fi
    
    log_info "Looking for $display_name files..."
    
    # Step 1: Ensure node modules are installed
    log_info "Step 1: Ensuring node modules and yarn are installed..."
    if ! ensure_node_modules; then
        log_error "Failed to install node modules and yarn"
        return 1
    fi
    
    # Step 2: Check for existing files in Downloads directories
    log_info "Step 2: Checking Downloads directories for existing files..."
    local downloads_dirs=($(find_all_downloads_dirs))
    log_info "Searching in: ${downloads_dirs[*]}"
    
    local existing_file=""
    if [[ "$force_download" != "true" ]]; then
        existing_file=$(find_files_by_pattern "$file_pattern")
        if [[ $? -eq 0 ]] && [[ -n "$existing_file" ]]; then
            log_success "Found existing $display_name file: $(basename "$existing_file")"
            echo "$existing_file"
            return 0
        fi
    fi
    
    # Step 3: Attempt automated download
    log_info "Step 3: No existing file found, attempting automated download..."
    if automated_download "$app_name"; then
        # Wait for file to appear
        local downloaded_file=$(wait_for_file_by_pattern "$file_pattern" 60)
        if [[ $? -eq 0 ]] && [[ -n "$downloaded_file" ]]; then
            log_success "Automated download completed: $(basename "$downloaded_file")"
            echo "$downloaded_file"
            return 0
        else
            log_warning "Automated download completed but file not found"
        fi
    else
        log_warning "Automated download failed"
    fi
    
    # Step 4: Fallback to manual download
    log_info "Step 4: Falling back to manual download..."
    return manual_download_fallback "$app_name" "$display_name" "$download_url" "$file_pattern"
}

# Manual download fallback
manual_download_fallback() {
    local app_name="$1"
    local display_name="$2"
    local download_url="$3"
    local file_pattern="$4"
    
    log_warning "No $display_name file found in Downloads directories"
    log_info "Opening $display_name download page..."
    
    # Try to open the download page
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$download_url" >/dev/null 2>&1 &
    elif command -v firefox >/dev/null 2>&1; then
        firefox "$download_url" >/dev/null 2>&1 &
    elif command -v google-chrome >/dev/null 2>&1; then
        google-chrome "$download_url" >/dev/null 2>&1 &
    else
        log_warning "Could not open browser automatically"
        log_info "Please manually open: $download_url"
    fi
    
    log_info "Please download the $display_name file to any Downloads directory"
    log_info "Waiting for download to complete..."
    
    # Wait for file to appear
    local downloaded_file=$(wait_for_file_by_pattern "$file_pattern")
    if [[ $? -eq 0 ]] && [[ -n "$downloaded_file" ]]; then
        log_success "Found $display_name file: $(basename "$downloaded_file")"
        echo "$downloaded_file"
        return 0
    else
        log_error "Timeout waiting for $display_name file download"
        return 1
    fi
}

# Robust directory removal
robust_remove_directory() {
    local dir_path="$1"
    local max_attempts="${2:-3}"
    
    if [[ ! -d "$dir_path" ]]; then
        log_info "Directory does not exist: $dir_path"
        return 0
    fi
    
    log_info "Removing directory: $dir_path"
    
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        log_info "Removal attempt $attempt/$max_attempts"
        
        # Try normal removal first
        if rm -rf "$dir_path" 2>/dev/null; then
            log_success "Directory removed successfully"
            return 0
        fi
        
        # If that fails, try with sudo
        if command -v sudo >/dev/null 2>&1; then
            log_info "Trying with sudo..."
            if sudo rm -rf "$dir_path" 2>/dev/null; then
                log_success "Directory removed successfully with sudo"
                return 0
            fi
        fi
        
        # If still fails, try to change permissions and retry
        log_warning "Removal failed, attempting to fix permissions..."
        if command -v sudo >/dev/null 2>&1; then
            sudo chmod -R 755 "$dir_path" 2>/dev/null
            sudo chown -R "$(whoami)" "$dir_path" 2>/dev/null
        else
            chmod -R 755 "$dir_path" 2>/dev/null
        fi
        
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "Failed to remove directory after $max_attempts attempts: $dir_path"
    return 1
}

# Generic cleanup function
cleanup_application() {
    local app_name="$1"
    local install_dir="$2"
    local process_names=("${@:3}")
    
    log_info "Cleaning up $app_name installation..."
    
    # Kill processes
    for process_name in "${process_names[@]}"; do
        kill_processes_by_name "$process_name" true
    done
    
    # Remove installation directory
    if [[ -n "$install_dir" ]] && [[ -d "$install_dir" ]]; then
        robust_remove_directory "$install_dir"
    fi
    
    log_success "$app_name cleanup completed"
}

# Check if application is installed
is_application_installed() {
    local app_name="$1"
    local command_name="$2"
    local install_flag="$3"
    
    # Check command availability
    if command -v "$command_name" >/dev/null 2>&1; then
        return 0  # Installed
    fi
    
    # Check install flag
    if [[ -n "$install_flag" ]] && [[ -f "$install_flag" ]]; then
        return 0  # Installed
    fi
    
    return 1  # Not installed
}

# Interactive cleanup prompt
prompt_cleanup_reinstall() {
    local app_name="$1"
    local command_name="$2"
    local install_flag="$3"
    local cleanup_function="$4"
    
    if is_application_installed "$app_name" "$command_name" "$install_flag"; then
        log_warning "$app_name is already installed"
        echo -n "Do you want to clean up and reinstall? (y/N): "
        read -r response
        case "$response" in
            [yY]|[yY][eE][sS])
                log_info "Cleaning up existing installation..."
                if [[ -n "$cleanup_function" ]] && command -v "$cleanup_function" >/dev/null 2>&1; then
                    "$cleanup_function"
                fi
                return 0  # Proceed with installation
                ;;
            *)
                log_info "Keeping existing installation"
                return 1  # Skip installation
                ;;
        esac
    fi
    return 0  # No existing installation, proceed
}

# Create installation flag
create_install_flag() {
    local flag_path="$1"
    local app_name="$2"
    
    log_info "Creating installation flag..."
    mkdir -p "$(dirname "$flag_path")"
    echo "$(date): $app_name installed successfully" > "$flag_path"
}

# Export functions for use in other scripts
export -f kill_processes_by_name download_and_install_app manual_download_fallback
export -f robust_remove_directory cleanup_application is_application_installed
export -f prompt_cleanup_reinstall create_install_flag
