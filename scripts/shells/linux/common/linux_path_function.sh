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

# =============================================================================
# Linux Path Function - Environment Variable Management
# =============================================================================
# Similar to WindowsPathFunction.ps1 for Linux systems
# Manages files and directories in environment variables

# =============================================================================
# Variable Declarations
# =============================================================================

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"
LINUXENVS_DIR="$SCRIPTS_DIR/linuxenvs"

# Colors for output
COLOR_RESET='\033[0m'
COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[0;33m'
COLOR_BLUE='\033[0;34m'
COLOR_CYAN='\033[0;36m'

# =============================================================================
# Logging Functions
# =============================================================================

log_info() {
    echo -e "${COLOR_CYAN}[INFO]${COLOR_RESET} $1"
}

log_success() {
    echo -e "${COLOR_GREEN}[SUCCESS]${COLOR_RESET} $1"
}

log_warning() {
    echo -e "${COLOR_YELLOW}[WARNING]${COLOR_RESET} $1"
}

log_error() {
    echo -e "${COLOR_RED}[ERROR]${COLOR_RESET} $1"
}

log_debug() {
    echo -e "${COLOR_BLUE}[DEBUG]${COLOR_RESET} $1"
}

# =============================================================================
# Directory Management Functions
# =============================================================================

ensure_linuxenvs_dir() {
    if [ ! -d "$LINUXENVS_DIR" ]; then
        mkdir -p "$LINUXENVS_DIR"
        log_info "Created linuxenvs directory: $LINUXENVS_DIR"
    fi
}

# =============================================================================
# Environment Variable Functions
# =============================================================================

add_dir_to_path() {
    local dir_path="$1"
    local bashrc_file="$HOME/.bashrc"

    if [ ! -d "$dir_path" ]; then
        log_error "Directory does not exist: $dir_path"
        return 1
    fi

    # Check if already in PATH
    if echo "$PATH" | grep -q "$dir_path"; then
        log_info "Directory already in PATH: $dir_path"
        return 0
    fi

    # Add to ~/.bashrc
    if ! grep -q "export PATH=.*$dir_path" "$bashrc_file" 2>/dev/null; then
        echo "" >> "$bashrc_file"
        echo "# Added by linux_path_function.sh" >> "$bashrc_file"
        echo "export PATH=\"$dir_path:\$PATH\"" >> "$bashrc_file"
        log_success "Added to ~/.bashrc: $dir_path"
    fi

    # Add to current session
    export PATH="$dir_path:$PATH"
    log_success "Added to current PATH: $dir_path"

    return 0
}

add_env_variable() {
    local var_name="$1"
    local var_value="$2"
    local bashrc_file="$HOME/.bashrc"

    if [ -z "$var_name" ] || [ -z "$var_value" ]; then
        log_error "Variable name and value are required"
        return 1
    fi

    # Check if already exists
    if grep -q "export $var_name=" "$bashrc_file" 2>/dev/null; then
        # Update existing
        sed -i "s|export $var_name=.*|export $var_name=\"$var_value\"|" "$bashrc_file"
        log_success "Updated environment variable: $var_name"
    else
        # Add new
        echo "" >> "$bashrc_file"
        echo "# Added by linux_path_function.sh" >> "$bashrc_file"
        echo "export $var_name=\"$var_value\"" >> "$bashrc_file"
        log_success "Added environment variable: $var_name"
    fi

    # Set in current session
    export "$var_name=$var_value"

    return 0
}

# =============================================================================
# File Management Functions
# =============================================================================

add_file_to_linuxenvs() {
    local file_path="$1"

    ensure_linuxenvs_dir

    if [ ! -f "$file_path" ]; then
        log_error "File not found: $file_path"
        return 1
    fi

    local filename="$(basename "$file_path")"
    local target_path="$LINUXENVS_DIR/$filename"

    # Copy file to linuxenvs
    cp "$file_path" "$target_path"
    chmod +x "$target_path"
    log_success "Copied to linuxenvs: $filename"

    # Create symlink in /usr/local/bin
    local link_path="/usr/local/bin/$filename"

    if [ -L "$link_path" ] || [ -f "$link_path" ]; then
        sudo rm -f "$link_path"
        log_warning "Removed existing file: $link_path"
    fi

    sudo ln -sf "$target_path" "$link_path"
    log_success "Created symlink: $link_path -> $target_path"

    return 0
}

add_script_content_to_linuxenvs() {
    local content="$1"
    local filename="$2"

    ensure_linuxenvs_dir

    if [ -z "$content" ]; then
        log_error "Content cannot be empty"
        return 1
    fi

    if [ -z "$filename" ]; then
        log_error "Filename cannot be empty"
        return 1
    fi

    # Ensure .sh extension
    if [[ ! "$filename" =~ \.(sh|bash)$ ]]; then
        filename="${filename}.sh"
    fi

    local target_path="$LINUXENVS_DIR/$filename"

    log_debug "Target directory: $LINUXENVS_DIR"
    log_debug "Target file path: $target_path"
    log_debug "File name: $filename"
    log_debug "Content length: ${#content} characters"

    # Write content to file
    echo "$content" > "$target_path"
    chmod +x "$target_path"

    if [ -f "$target_path" ]; then
        local file_size=$(stat -f%z "$target_path" 2>/dev/null || stat -c%s "$target_path")
        log_debug "File verification SUCCESS - Size: $file_size bytes"
        log_success "Script written to linuxenvs: $filename -> $target_path"
    else
        log_error "File verification FAILED - File not found"
        return 1
    fi

    # Create symlink in /usr/local/bin
    local basename_without_ext="${filename%.sh}"
    basename_without_ext="${basename_without_ext%.bash}"
    local link_path="/usr/local/bin/$basename_without_ext"

    if [ -L "$link_path" ] || [ -f "$link_path" ]; then
        sudo rm -f "$link_path"
    fi

    sudo ln -sf "$target_path" "$link_path"
    log_success "Created global command: $basename_without_ext"

    # Add linuxenvs to PATH if not already
    add_dir_to_path "$LINUXENVS_DIR"

    return 0
}

remove_script_from_linuxenvs() {
    local filename="$1"

    if [ -z "$filename" ]; then
        log_error "Filename is required"
        return 1
    fi

    local target_path="$LINUXENVS_DIR/$filename"

    if [ ! -f "$target_path" ]; then
        log_error "File not found in linuxenvs: $filename"
        return 1
    fi

    # Remove file from linuxenvs
    rm -f "$target_path"
    log_success "Removed from linuxenvs: $filename"

    # Remove symlink
    local basename_without_ext="${filename%.sh}"
    basename_without_ext="${basename_without_ext%.bash}"
    local link_path="/usr/local/bin/$basename_without_ext"

    if [ -L "$link_path" ] || [ -f "$link_path" ]; then
        sudo rm -f "$link_path"
        log_success "Removed symlink: $link_path"
    fi

    return 0
}

list_linuxenvs_scripts() {
    ensure_linuxenvs_dir

    log_info "Scripts in linuxenvs directory:"
    echo "=================================="

    if [ "$(ls -A "$LINUXENVS_DIR" 2>/dev/null)" ]; then
        local counter=1
        for file in "$LINUXENVS_DIR"/*; do
            if [ -f "$file" ]; then
                local filename="$(basename "$file")"
                echo "  $counter. $filename"
                counter=$((counter + 1))
            fi
        done
    else
        echo "  No scripts found"
    fi

    echo "=================================="
}

# =============================================================================
# Main Entry Point
# =============================================================================

main() {
    local action="$1"
    shift

    case "$action" in
        addfile)
            add_file_to_linuxenvs "$@"
            ;;
        addscript)
            add_script_content_to_linuxenvs "$@"
            ;;
        remove)
            remove_script_from_linuxenvs "$@"
            ;;
        list)
            list_linuxenvs_scripts
            ;;
        addpath)
            add_dir_to_path "$@"
            ;;
        addenv)
            add_env_variable "$@"
            ;;
        *)
            echo "Usage: $0 {addfile|addscript|remove|list|addpath|addenv} [args...]"
            echo ""
            echo "Commands:"
            echo "  addfile <file_path>              - Add file to linuxenvs"
            echo "  addscript <content> <filename>   - Create script in linuxenvs"
            echo "  remove <filename>                - Remove script from linuxenvs"
            echo "  list                             - List all scripts in linuxenvs"
            echo "  addpath <dir_path>               - Add directory to PATH"
            echo "  addenv <name> <value>            - Add environment variable"
            return 1
            ;;
    esac
}

# Run main if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
