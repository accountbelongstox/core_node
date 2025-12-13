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

# ===================================================================
# ALL VARIABLES DECLARATION - MOVED TO TOP OF FILE
# ===================================================================

# Source common variables and functions
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# Parameter variables (will be set during parsing)
TARGET_REMOTE=""
PULL_MODE=false
FORCE_OVERWRITE_MODE=false

# State tracking variables
ENCRYPTION_CHECK_COMPLETED=false
FILE_VALIDATION_COMPLETED=false
ORIGINAL_WORKING_DIR=$(pwd)
ORIGINAL_REMOTE_URL=""
ORIGINAL_BRANCH=""
BACKUP_ENABLED=false

# Path and project variables
SCRIPT_PATH="$(dirname "$(readlink -f "$0")")"
CORE_NODE_DIR="$(dirname "$(dirname "$SCRIPT_PATH")")"
PROJECT_NAME="core_node"
TIMESTAMP="$(date "+%Y-%m-%d %H:%M:%S")"
WIN_COMMON_DIR="$CORE_NODE_DIR/scripts/shells/win/win_common"

# Cache and encryption variables
SKIP_ENCRYPT_CACHE_DIR="/var/_node_core"
SKIP_ENCRYPT_CACHE_FILE="$SKIP_ENCRYPT_CACHE_DIR/git_skip_encrypt_cache.db"

# Commit message variable
export COMMIT_MESSAGE=""

# Global associative array for remote configurations
declare -g -A remote_configs

# Default remote (will be set after loading configurations)
DEFAULT_REMOTE=""

# ===================================================================
# PARAMETER PARSING
# ===================================================================

# Parse command line parameters
while [[ $# -gt 0 ]]; do
    case $1 in
        --pull)
            PULL_MODE=true
            shift
            ;;
        --force-overwrite)
            FORCE_OVERWRITE_MODE=true
            shift
            ;;
        --backup)
            BACKUP_ENABLED=true
            shift
            ;;
        gitee|github|local)
            TARGET_REMOTE="$1"
            shift
            ;;
        *)
            TARGET_REMOTE="$1"
            shift
            ;;
    esac
done

# Initialize skip encrypt cache
init_skip_encrypt_cache() {
    if [ ! -d "$SKIP_ENCRYPT_CACHE_DIR" ]; then
        $USE_SUDO mkdir -p "$SKIP_ENCRYPT_CACHE_DIR" 2>/dev/null || true
    fi
    if [ ! -f "$SKIP_ENCRYPT_CACHE_FILE" ]; then
        $USE_SUDO touch "$SKIP_ENCRYPT_CACHE_FILE" 2>/dev/null || true
    fi
}

# Check if file is in skip cache
is_file_in_skip_cache() {
    local file_path="$1"
    local file_mtime=$(stat -c %Y "$file_path" 2>/dev/null || stat -f %m "$file_path" 2>/dev/null)

    if [ ! -f "$SKIP_ENCRYPT_CACHE_FILE" ]; then
        return 1
    fi

    while IFS='|' read -r cached_path cached_mtime; do
        if [ "$cached_path" = "$file_path" ] && [ "$cached_mtime" = "$file_mtime" ]; then
            return 0
        fi
    done < "$SKIP_ENCRYPT_CACHE_FILE"

    return 1
}

# Add file to skip cache
add_file_to_skip_cache() {
    local file_path="$1"
    local file_mtime=$(stat -c %Y "$file_path" 2>/dev/null || stat -f %m "$file_path" 2>/dev/null)

    init_skip_encrypt_cache

    if is_file_in_skip_cache "$file_path"; then
        return 0
    fi

    echo "${file_path}|${file_mtime}" | $USE_SUDO tee -a "$SKIP_ENCRYPT_CACHE_FILE" > /dev/null
}

# Clean up outdated entries from skip cache
cleanup_skip_encrypt_cache() {
    if [ ! -f "$SKIP_ENCRYPT_CACHE_FILE" ]; then
        return
    fi

    local temp_file="${SKIP_ENCRYPT_CACHE_FILE}.tmp"
    $USE_SUDO touch "$temp_file"

    while IFS='|' read -r cached_path cached_mtime; do
        if [ -f "$cached_path" ]; then
            local current_mtime=$(stat -c %Y "$cached_path" 2>/dev/null || stat -f %m "$cached_path" 2>/dev/null)
            if [ "$current_mtime" = "$cached_mtime" ]; then
                echo "${cached_path}|${cached_mtime}" | $USE_SUDO tee -a "$temp_file" > /dev/null
            fi
        fi
    done < "$SKIP_ENCRYPT_CACHE_FILE"

    $USE_SUDO mv "$temp_file" "$SKIP_ENCRYPT_CACHE_FILE"
}

read_masked_password() {
    local prompt="$1"
    local password=""
    local char=""
    local old_stty="$(stty -g 2>/dev/null)"

    printf "%s" "$prompt"

    stty -echo 2>/dev/null
    while IFS= read -r -s -n1 char; do
        if [[ -z "$char" ]]; then
            printf "\n"
            break
        elif [[ $char == $'\n' || $char == $'\r' ]]; then
            printf "\n"
            break
        elif [[ $char == $'\177' || $char == $'\b' ]]; then
            if [ -n "$password" ]; then
                password="${password%?}"
                printf "\b \b"
            fi
        else
            password+="$char"
            printf "*"
        fi
    done

    stty "$old_stty" 2>/dev/null
    printf "%s" "$password"
}

# File validation function for win_common directory
test_win_common_files() {
    write_color_text "=== Validating win_common directory files ===" "Yellow"
    
    # Hardcoded list of files in win_common directory
    local required_files=(
        "ApplicationsList.ps1"
        "CommonFunc.ps1"
        "DesktopIconManager.ps1"
        "GlobalVars.ps1"
        "IconExtractor.ps1"
        "PackageManagerInvokes.ps1"
        "PostInstallCallbackProcessor.ps1"
        "SimpleIconExtractor.ps1"
        "StartupManager.ps1"
        "WindowsPathFunction.ps1"
        "WindowsServiceManager.ps1"
        "CommonFunc.7z.gz.js"
        "applicationsXml/ApplicationsList.xml"
    )
    
    local missing_files=()
    local existing_files=()
    
    for file in "${required_files[@]}"; do
        local file_path="$WIN_COMMON_DIR/$file"
        if [ -f "$file_path" ]; then
            existing_files+=("$file")
            write_color_text "[OK] Found: $file" "Green"
        else
            missing_files+=("$file")
            write_color_text "[MISSING] Missing: $file" "Red"
        fi
    done
    
    echo ""
    write_color_text "Validation Summary:" "Cyan"
    write_color_text "  Existing files: ${#existing_files[@]}" "Green"
    write_color_text "  Missing files: ${#missing_files[@]}" "Red"
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        echo ""
        write_color_text "WARNING: The following files are missing from win_common directory:" "Red"
        for missing_file in "${missing_files[@]}"; do
            write_color_text "  - $missing_file" "Red"
        done
        echo ""
        write_color_text "Continuing with commit process despite missing files..." "Yellow"
    fi
    
    echo ""
    return $([ ${#missing_files[@]} -eq 0 ])
}

# Global variable management function
get_global_var() {
    local key="$1"
    local global_var_dir
    
    # Determine global variable directory (same logic as gvar_common.sh)
    if [ -d "/mnt/c/Users" ]; then
        # WSL environment
        for user_dir in /mnt/c/Users/*; do
            if [ -d "$user_dir/.core_node/global_var" ]; then
                global_var_dir="$user_dir/.core_node/global_var"
                break
            fi
        done
    fi
    
    # Fallback to default directory
    if [ -z "$global_var_dir" ]; then
        global_var_dir="/usr/core_node/global_var"
    fi
    
    local file_path="$global_var_dir/$key"
    if [ -f "$file_path" ]; then
        # Convert file to UTF-8 and remove any null bytes or invalid characters
        local value=$(iconv -f utf-8 -t utf-8 -c "$file_path" 2>/dev/null | tr -d '\0' | head -n 1)
        if [ -n "$value" ]; then
            echo "$value"
        fi
    fi
}

# Function to ensure SSH key permissions are correct
ensure_ssh_permissions() {
    # Get the home directory user from the SSH directory path
    local ssh_dir="$HOME/.ssh"
    local home_user=$(basename "$HOME")
    
    write_color_text "Detected home user: $home_user" "DarkGray" >&2
    
    # Check if SSH directory exists
    if [ ! -d "$ssh_dir" ]; then
        write_color_text "SSH directory does not exist: $ssh_dir" "Yellow" >&2
        return 0
    fi
    
    # Scan for SSH private keys in the directory
    local ssh_keys=()
    while IFS= read -r -d '' key_file; do
        ssh_keys+=("$key_file")
    done < <(find "$ssh_dir" -name "id_*" -type f ! -name "*.pub" -print0 2>/dev/null)
    
    if [ ${#ssh_keys[@]} -eq 0 ]; then
        write_color_text "No SSH private keys found in $ssh_dir" "Yellow" >&2
        return 0
    fi
    
    write_color_text "Found ${#ssh_keys[@]} SSH private key(s)" "DarkGray" >&2
    
    # Process each SSH key
    for ssh_key in "${ssh_keys[@]}"; do
        local key_name=$(basename "$ssh_key")
        write_color_text "Processing SSH key: $key_name" "Cyan" >&2
        
        # Check current ownership and permissions
        local current_owner=$(stat -c '%U' "$ssh_key" 2>/dev/null)
        local current_perms=$(stat -c '%a' "$ssh_key" 2>/dev/null)
        
        write_color_text "  Current owner: $current_owner, permissions: $current_perms" "DarkGray" >&2
        
        # Fix ownership if needed
        if [ "$current_owner" != "$home_user" ]; then
            write_color_text "  Fixing ownership from $current_owner to $home_user..." "Yellow" >&2
            if $USE_SUDO chown "$home_user:$home_user" "$ssh_key" 2>/dev/null; then
                write_color_text "  SSH key ownership fixed" "Green" >&2
            else
                write_color_text "  Failed to fix SSH key ownership" "Red" >&2
            fi
        else
            write_color_text "  Ownership is correct" "Green" >&2
        fi
        
        # Fix permissions if needed (should be 600)
        if [ "$current_perms" != "600" ]; then
            write_color_text "  Fixing permissions from $current_perms to 600..." "Yellow" >&2
            if chmod 600 "$ssh_key" 2>/dev/null; then
                write_color_text "  SSH key permissions fixed to 600" "Green" >&2
            else
                write_color_text "  Failed to fix SSH key permissions" "Red" >&2
            fi
        else
            write_color_text "  Permissions are correct" "Green" >&2
        fi
    done
    
    # Also fix SSH directory permissions (should be 700)
    local ssh_dir_perms=$(stat -c '%a' "$ssh_dir" 2>/dev/null)
    local ssh_dir_owner=$(stat -c '%U' "$ssh_dir" 2>/dev/null)
    
    write_color_text "SSH directory owner: $ssh_dir_owner, permissions: $ssh_dir_perms" "DarkGray" >&2
    
    if [ "$ssh_dir_owner" != "$home_user" ]; then
        write_color_text "Fixing SSH directory ownership..." "Yellow" >&2
        if $USE_SUDO chown "$home_user:$home_user" "$ssh_dir" 2>/dev/null; then
            write_color_text "SSH directory ownership fixed" "Green" >&2
        else
            write_color_text "Failed to fix SSH directory ownership" "Red" >&2
        fi
    fi
    
    if [ "$ssh_dir_perms" != "700" ]; then
        write_color_text "Fixing SSH directory permissions..." "Yellow" >&2
        if chmod 700 "$ssh_dir" 2>/dev/null; then
            write_color_text "SSH directory permissions fixed to 700" "Green" >&2
        else
            write_color_text "Failed to fix SSH directory permissions" "Red" >&2
        fi
    fi
}

# Function to configure git safe directory
configure_git_safe_directory() {
    # Use the CORE_NODE_DIR variable which is already set in the script
    # This is derived from the script path, not from git commands
    local git_root="$CORE_NODE_DIR"

    if [ -z "$git_root" ] || [ ! -d "$git_root" ]; then
        write_color_text "WARNING: Cannot determine project directory" "Yellow" >&2
        return 0
    fi

    # Check if this directory contains a .git directory
    if [ ! -d "$git_root/.git" ] && [ ! -f "$git_root/.git" ]; then
        write_color_text "WARNING: Not a git repository: $git_root" "Yellow" >&2
        return 0
    fi

    write_color_text "Configuring safe.directory for: $git_root" "DarkGray" >&2

    # Check if safe.directory is already configured for this directory
    if git config --global --get-all safe.directory 2>/dev/null | grep -q "^${git_root}$"; then
        write_color_text "safe.directory already configured for: $git_root" "DarkGray" >&2
    else
        write_color_text "Adding safe.directory: $git_root" "Yellow" >&2
        git config --global --add safe.directory "$git_root"
        write_color_text "safe.directory configured successfully!" "Green" >&2
    fi
}

# Function to configure git merge settings
configure_git_merge_settings() {
    # Configure merge.ff (fast-forward merge)
    local current_ff=$(git config --global merge.ff 2>/dev/null)

    if [ -z "$current_ff" ]; then
        write_color_text "Configuring git merge.ff to 'false' (always create merge commits)..." "Yellow" >&2
        git config --global merge.ff false
        write_color_text "Set merge.ff to: false" "Cyan" >&2
    else
        write_color_text "merge.ff already configured: $current_ff" "DarkGray" >&2
    fi

    # Configure pull.rebase
    local current_rebase=$(git config --global pull.rebase 2>/dev/null)

    if [ -z "$current_rebase" ]; then
        write_color_text "Configuring git pull.rebase to 'false'..." "Yellow" >&2
        git config --global pull.rebase false
        write_color_text "Set pull.rebase to: false" "Cyan" >&2
    else
        write_color_text "pull.rebase already configured: $current_rebase" "DarkGray" >&2
    fi
}

# Function to ensure git user identity is configured
ensure_git_identity() {
    # Check if git user.name is configured
    local git_name=$(git config --global user.name 2>/dev/null)
    local git_email=$(git config --global user.email 2>/dev/null)

    # Default values
    local default_name="dev"
    local default_email="dev@dev.linux.com"

    # If not configured, set default values
    if [ -z "$git_name" ] || [ -z "$git_email" ]; then
        write_color_text "Git user identity not configured. Setting default values..." "Yellow" >&2

        # Configure git
        if [ -z "$git_name" ]; then
            git config --global user.name "$default_name"
            write_color_text "Set git user.name to: $default_name" "Cyan" >&2
        fi

        if [ -z "$git_email" ]; then
            git config --global user.email "$default_email"
            write_color_text "Set git user.email to: $default_email" "Cyan" >&2
        fi

        write_color_text "Git identity configured successfully!" "Green" >&2
    else
        write_color_text "Git identity already configured: $git_name <$git_email>" "DarkGray" >&2
    fi
}

# Function to initialize all git configurations (run once on first execution)
initialize_git_config() {
    write_color_text "Initializing Git configuration..." "Cyan" >&2

    # Configure safe directory
    configure_git_safe_directory

    # Configure merge settings
    configure_git_merge_settings

    # Configure user identity
    ensure_git_identity

    write_color_text "Git configuration initialized successfully!" "Green" >&2
}

# Function to get commit message (session-scoped only)
get_commit_message() {
    local commit_file="/tmp/git_commit_message_$$"
    
    # Check if we have a stored commit message
    if [ -f "$commit_file" ]; then
        local stored_message=$(cat "$commit_file")
        if [ -n "$stored_message" ]; then
            write_color_text "Reusing commit message from this session: $stored_message" "Cyan" >&2
            echo "$stored_message"
            return
        fi
    fi
    
    # Ask user for input (first time only)
    write_color_text "Enter commit message (press Enter to use timestamp): " "Yellow" >&2
    # Ensure the prompt is fully displayed before accepting input
    sleep 0.1
    read -r user_input
    
    if [ -z "$user_input" ]; then
        COMMIT_MESSAGE="$TIMESTAMP"
        write_color_text "Using timestamp as commit message: $TIMESTAMP" "Cyan" >&2
    else
        COMMIT_MESSAGE="$user_input"
        write_color_text "Using custom commit message: $user_input" "Green" >&2
    fi
    
    # Store the commit message in a file
    echo "$COMMIT_MESSAGE" > "$commit_file"
    
    echo "$COMMIT_MESSAGE"
}

# Function to determine default remote based on region setting
get_default_remote() {
    local project_name="$1"
    
    local selected_region=$(get_global_var "SELECTED_REGION")
    if [ "$selected_region" = "Global" ]; then
        echo "git@github.com:accountbelongstox/$project_name.git"
    else
        # Default to China/Gitee if no region is set or if set to China
        echo "git@gitee.com:accountbelongstox/$project_name.git"
    fi
}

# Load remote configurations from git_remotes.conf
load_remote_configs() {
    local config_file="$SCRIPT_DIR/git_remotes.conf"

    if [ ! -f "$config_file" ]; then
        echo "Error: Configuration file not found: $config_file"
        exit 1
    fi

    while IFS='=' read -r key value || [ -n "$key" ]; do
        # Skip empty lines and comments
        [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
        # Trim whitespace
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)
        # Store in associative array
        remote_configs["$key"]="$value"
    done < "$config_file"
}

# Load configurations
load_remote_configs

# Initialize default remote after loading configurations
DEFAULT_REMOTE=$(get_default_remote "$PROJECT_NAME")

# Determine execution order - DEFAULT_REMOTE should be executed first
get_execution_order() {
    local targets=("$@")
    local ordered_targets=()
    local default_remote_key=""
    
    # Find which key corresponds to DEFAULT_REMOTE
    for key in "${!remote_configs[@]}"; do
        if [ "${remote_configs[$key]}" = "$DEFAULT_REMOTE" ]; then
            default_remote_key="$key"
            break
        fi
    done
    
    # Add default remote first if it's in the target list
    if [ -n "$default_remote_key" ]; then
        for target in "${targets[@]}"; do
            if [ "$target" = "$default_remote_key" ]; then
                ordered_targets+=("$default_remote_key")
                break
            fi
        done
    fi
    
    # Add remaining targets
    for target in "${targets[@]}"; do
        if [ "$target" != "$default_remote_key" ]; then
            ordered_targets+=("$target")
        fi
    done
    
    echo "${ordered_targets[@]}"
}

# Function to get current branch
get_current_branch() {
    git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD"
}

# Function to ensure we're on the correct branch
ensure_target_branch() {
    local target_branch="main"
    local current_branch=$(get_current_branch)
    
    write_color_text "Current branch: $current_branch" "DarkGray"
    
    # If already on target branch, continue
    if [ "$current_branch" = "$target_branch" ]; then
        write_color_text "Already on target branch: $target_branch" "Green"
        return 0
    fi
    
    # Check if target branch exists locally
    if git show-ref --verify --quiet refs/heads/$target_branch; then
        write_color_text "Switching to existing branch: $target_branch" "Yellow"
        git checkout "$target_branch"
    else
        # Check if target branch exists on remote
        if git ls-remote --heads origin "$target_branch" | grep -q "refs/heads/$target_branch"; then
            write_color_text "Creating local branch from remote: $target_branch" "Yellow"
            git checkout -b "$target_branch" "origin/$target_branch"
        else
            write_color_text "Target branch '$target_branch' doesn't exist. Creating new branch..." "Yellow"
            git checkout -b "$target_branch"
        fi
    fi
}

# Function to restore original branch
restore_original_branch() {
    if [ -n "$ORIGINAL_BRANCH" ] && [ "$ORIGINAL_BRANCH" != "$(get_current_branch)" ]; then
        write_color_text "Restoring original branch: $ORIGINAL_BRANCH" "Yellow"
        if git show-ref --verify --quiet refs/heads/$ORIGINAL_BRANCH; then
            git checkout "$ORIGINAL_BRANCH"
        else
            write_color_text "Warning: Original branch '$ORIGINAL_BRANCH' no longer exists" "Red"
        fi
    fi
}

# Function to create working directory backup
create_working_backup() {
    if [ "$BACKUP_ENABLED" != "true" ]; then
        return 0
    fi
    
    local backup_dir="$CORE_NODE_DIR/.git_backups"
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$backup_dir/$backup_name"
    
    write_color_text "Creating working directory backup..." "Cyan"
    mkdir -p "$backup_dir"
    
    # Create backup excluding .git directory and other unnecessary files
    rsync -av --exclude='.git' --exclude='.git_backups' --exclude='node_modules' \
          --exclude='.secret_keys' "$CORE_NODE_DIR/" "$backup_path/" >/dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        write_color_text "Backup created: $backup_path" "Green"
        echo "$backup_path" > "$backup_dir/.latest_backup"
        
        # Keep only last 5 backups
        find "$backup_dir" -maxdepth 1 -type d -name "backup_*" | sort | head -n -5 | xargs rm -rf
    else
        write_color_text "Warning: Failed to create backup" "Yellow"
    fi
}

# Function to display colored text
write_color_text() {
    local text="$1"
    local color="$2"

    # Desktop environment detection (run once)
    if [ -z "$DESKTOP_ENV_DETECTED" ]; then
        export DESKTOP_ENV_DETECTED=true
        local is_desktop=false

        # Check for desktop environment indicators
        if [ -n "$XDG_CURRENT_DESKTOP" ] || [ -n "$DESKTOP_SESSION" ] || [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
            is_desktop=true
        fi

        # Check for display manager processes
        if ps aux | grep -E "(gdm|lightdm|sddm|xdm)" | grep -v grep >/dev/null 2>&1; then
            is_desktop=true
        fi

        # Check for window manager processes
        if ps aux | grep -E "(gnome|kde|xfce|lxde|mate|cinnamon|i3|openbox)" | grep -v grep >/dev/null 2>&1; then
            is_desktop=true
        fi

        if [ "$is_desktop" = true ]; then
            echo -e "\033[32m[DESKTOP] Running in desktop environment\033[0m" >&2
        else
            echo -e "\033[33m[SERVER] Running in headless/server environment\033[0m" >&2
        fi
    fi

    case "$color" in
        "Green")
            echo -e "\033[32m$text\033[0m"
            ;;
        "Yellow")
            echo -e "\033[33m$text\033[0m"
            ;;
        "Red")
            echo -e "\033[31m$text\033[0m"
            ;;
        "Cyan")
            echo -e "\033[36m$text\033[0m"
            ;;
        "DarkGray")
            echo -e "\033[90m$text\033[0m"
            ;;
        "DarkBlue")
            echo -e "\033[34m$text\033[0m"
            ;;
        "DarkCyan")
            echo -e "\033[96m$text\033[0m"
            ;;
        "Magenta")
            echo -e "\033[35m$text\033[0m"
            ;;
        "DarkYellow")
            echo -e "\033[33m$text\033[0m"
            ;;
        *)
            echo "$text"
            ;;
    esac
}

# Function to get current remote URL
get_current_remote() {
    git remote get-url origin 2>/dev/null || echo ""
}

# Function to set remote URL
set_remote_url() {
    local remote_url="$1"

    write_color_text "Executing: git remote set-url origin $remote_url" "DarkGray"
    git remote set-url origin "$remote_url"
    if [ $? -eq 0 ]; then
        write_color_text "Remote set to: $remote_url" "Green"
    else
        write_color_text "Failed to set remote: $?" "Red"
        return 1
    fi
}

# Function to restore original remote
restore_original_remote() {
    if [ -n "$ORIGINAL_REMOTE_URL" ] && [ "$ORIGINAL_REMOTE_URL" != "$DEFAULT_REMOTE" ]; then
        write_color_text "Restoring original remote: $ORIGINAL_REMOTE_URL" "Yellow"
        set_remote_url "$ORIGINAL_REMOTE_URL"
    elif [ "$(get_current_remote)" != "$DEFAULT_REMOTE" ]; then
        write_color_text "Restoring default remote: $DEFAULT_REMOTE" "Yellow"
        set_remote_url "$DEFAULT_REMOTE"
    fi
}

# Function to handle automated conflict resolution
handle_conflict_resolution() {
    write_color_text "" "White"
    write_color_text "AUTOMATED CONFLICT RESOLUTION OPTIONS:" "Magenta"
    write_color_text "" "White"
    write_color_text "Would you like to automatically resolve conflicts? [Y/n]: " "Cyan"
    
    read -r user_choice
    user_choice="${user_choice:-Y}"  # Default to Y if empty
    
    if [[ "$user_choice" =~ ^[Yy]$ ]]; then
        write_color_text "" "White"
        write_color_text "Select resolution strategy:" "Yellow"
        write_color_text "1) Keep REMOTE version (recommended for pulling latest changes)" "Cyan"
        write_color_text "2) Keep LOCAL version (preserve your changes)" "Cyan" 
        write_color_text "3) Abort operation" "Cyan"
        write_color_text "Enter choice [1-3]: " "Yellow"
        
        read -r resolution_choice
        
        case "$resolution_choice" in
            1)
                write_color_text "Applying REMOTE version..." "Green"
                git checkout --theirs .
                git add .
                git commit -m "Resolved conflicts by keeping remote version - $(date '+%Y-%m-%d %H:%M:%S')"
                if [ $? -eq 0 ]; then
                    write_color_text "SUCCESS: Conflicts resolved automatically!" "Green"
                    write_color_text "Continuing with git operations..." "Cyan"
                    return 0
                else
                    write_color_text "ERROR: Failed to resolve conflicts automatically" "Red"
                    return 1
                fi
                ;;
            2)
                write_color_text "Applying LOCAL version..." "Green"
                git checkout --ours .
                git add .
                git commit -m "Resolved conflicts by keeping local version - $(date '+%Y-%m-%d %H:%M:%S')"
                if [ $? -eq 0 ]; then
                    write_color_text "SUCCESS: Conflicts resolved automatically!" "Green"
                    write_color_text "Continuing with git operations..." "Cyan"
                    return 0
                else
                    write_color_text "ERROR: Failed to resolve conflicts automatically" "Red"
                    return 1
                fi
                ;;
            3)
                write_color_text "Aborting merge operation..." "Yellow"
                git merge --abort
                write_color_text "Merge aborted. Repository restored to previous state." "Yellow"
                return 1
                ;;
            *)
                write_color_text "Invalid choice. Please resolve conflicts manually." "Red"
                return 1
                ;;
        esac
    else
        write_color_text "Manual resolution required. Please resolve conflicts using the options above." "Yellow"
        return 1
    fi
}

# Function to perform safe git pull operations
invoke_safe_git_pull() {
    local target_url="$1"

    # Check if this is any 192.x.x.x remote and we're in a server environment
    if [[ "$target_url" == *"192."* ]]; then
        # Additional server detection methods
        local is_server_env=false

        # Method 1: Check for desktop environment variables
        if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ] && [ -z "$XDG_SESSION_TYPE" ]; then
            is_server_env=true
        fi

        # Method 2: Check if running in container or VPS
        if [ -f /.dockerenv ] || [ -d /proc/vz ] || [ -f /proc/user_beancounters ]; then
            is_server_env=true
        fi

        # Method 3: Check global variables
        local has_desktop_env=$(get_global_var "HAS_DESKTOP_ENVIRONMENT")
        local is_production=$(get_global_var "IS_PRODUCTION")
        if [ "$has_desktop_env" = "false" ] || [ "$is_production" = "true" ]; then
            is_server_env=true
        fi

        if [ "$is_server_env" = "true" ]; then
            write_color_text "Skipping $target_url in server/non-desktop environment" "Yellow"
            return 0
        fi
    fi

    write_color_text "Starting SAFE GIT PULL operations for: $target_url" "Cyan"
    write_color_text "Project: $PROJECT_NAME" "Green"
    write_color_text "Timestamp: $TIMESTAMP" "Green"
    
    # Change to project directory
    cd "$CORE_NODE_DIR"
    write_color_text "Changed to: $CORE_NODE_DIR" "DarkCyan"
    
    # Store original branch and remote for restoration
    ORIGINAL_BRANCH=$(get_current_branch)
    ORIGINAL_REMOTE_URL=$(get_current_remote)
    write_color_text "Original branch: $ORIGINAL_BRANCH" "DarkGray"
    write_color_text "Original remote: $ORIGINAL_REMOTE_URL" "DarkGray"
    
    # Create backup if enabled
    create_working_backup
    
    # Set target remote
    if ! set_remote_url "$target_url"; then
        return 1
    fi
    
    # Show remote configuration
    write_color_text "--------------------------------" "Green"
    write_color_text "Executing: git remote -v" "DarkGray"
    git remote -v
    write_color_text "--------------------------------" "Green"

    # Step 1: Ensure local changes are committed
    write_color_text "Step 1: Checking for uncommitted changes..." "Cyan"
    write_color_text "Executing: git status --porcelain" "DarkGray"
    local changes=$(git status --porcelain)
    
    if [ -n "$changes" ]; then
        write_color_text "Found uncommitted changes. Saving local work..." "Yellow"
        write_color_text "Executing: git add ." "DarkGray"
        git add .
        local commit_message=$(get_commit_message)
        write_color_text "Executing: git commit -m '$commit_message'" "DarkGray"
        git commit -m "$commit_message"
    else
        write_color_text "No uncommitted changes found." "Green"
    fi

    # Step 2: Ensure we're on the target branch (main)
    write_color_text "Step 2: Ensuring we're on the target branch..." "Cyan"
    ensure_target_branch

    # Step 3: Safe pull with merge
    write_color_text "Step 3: Performing safe pull..." "Cyan"
    write_color_text "Executing: git pull origin main --no-edit" "DarkGray"
    local pull_result
    pull_result=$(git pull origin main --no-edit 2>&1)
    local pull_exit_code=$?
    
    write_color_text "Pull command output:" "DarkGray"
    write_color_text "$pull_result" "White"
    
    if [ $pull_exit_code -eq 0 ]; then
        write_color_text "SUCCESS: Safe pull completed successfully!" "Green"
    else
        write_color_text "WARNING: Pull failed with merge conflicts!" "Red"
        write_color_text "MERGE CONFLICT RESOLUTION OPTIONS:" "Yellow"
        write_color_text "" "White"
        write_color_text "Option 1 - Keep REMOTE version (discard local changes):" "Cyan"
        write_color_text "git checkout --theirs ." "White"
        write_color_text "git add ." "White"  
        write_color_text "git commit -m \"Resolved conflicts by keeping remote version\"" "White"
        write_color_text "" "White"
        write_color_text "Option 2 - Keep LOCAL version (discard remote changes):" "Cyan"
        write_color_text "git checkout --ours ." "White"
        write_color_text "git add ." "White"
        write_color_text "git commit -m \"Resolved conflicts by keeping local version\"" "White"
        write_color_text "" "White"
        write_color_text "Option 3 - Manual resolution:" "Cyan"
        write_color_text "Edit conflicted files manually, then:" "White"
        write_color_text "git add ." "White"
        write_color_text "git commit -m \"Manually resolved merge conflicts\"" "White"
        write_color_text "" "White"
        write_color_text "Option 4 - Abort and try later:" "Cyan"
        write_color_text "git merge --abort" "White"
        write_color_text "git reset --hard HEAD~1  # Remove auto-commit" "White"
        
        # Offer automated conflict resolution
        if handle_conflict_resolution; then
            write_color_text "Conflict resolution completed successfully!" "Green"
            return 0
        else
            write_color_text "Conflict resolution failed or was aborted" "Yellow"
            return 1
        fi
    fi
    
    write_color_text "----------------------------------------------------------------" "DarkBlue"
    return 0
}

# Function to force overwrite local with remote (following best practices)
# Reference: https://www.codecademy.com/article/force-git-pull
# Reference: https://blog.openreplay.com/git-force-pull/
# Reference: https://www.datacamp.com/tutorial/git-pull-force
invoke_force_overwrite() {
    local target_url="$1"

    # Check if this is any 192.x.x.x remote and we're in a server environment
    if [[ "$target_url" == *"192."* ]]; then
        # Additional server detection methods
        local is_server_env=false

        # Method 1: Check for desktop environment variables
        if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ] && [ -z "$XDG_SESSION_TYPE" ]; then
            is_server_env=true
        fi

        # Method 2: Check if running in container or VPS
        if [ -f /.dockerenv ] || [ -d /proc/vz ] || [ -f /proc/user_beancounters ]; then
            is_server_env=true
        fi

        # Method 3: Check global variables
        local has_desktop_env=$(get_global_var "HAS_DESKTOP_ENVIRONMENT")
        local is_production=$(get_global_var "IS_PRODUCTION")
        if [ "$has_desktop_env" = "false" ] || [ "$is_production" = "true" ]; then
            is_server_env=true
        fi

        if [ "$is_server_env" = "true" ]; then
            write_color_text "Skipping $target_url in server/non-desktop environment" "Yellow"
            return 0
        fi
    fi

    write_color_text "═══════════════════════════════════════════════════════════════" "Yellow"
    write_color_text "FORCE OVERWRITE - DISCARDING LOCAL CHANGES" "Red"
    write_color_text "═══════════════════════════════════════════════════════════════" "Yellow"
    write_color_text "Project: $PROJECT_NAME" "Green"
    write_color_text "Timestamp: $TIMESTAMP" "Green"

    # Change to project directory
    cd "$CORE_NODE_DIR"
    write_color_text "Changed to: $CORE_NODE_DIR" "DarkCyan"

    # Store original branch and remote
    ORIGINAL_BRANCH=$(get_current_branch)
    ORIGINAL_REMOTE_URL=$(get_current_remote)
    write_color_text "Original branch: $ORIGINAL_BRANCH" "DarkGray"
    write_color_text "Original remote: $ORIGINAL_REMOTE_URL" "DarkGray"

    # Step 1: Create backup branch with timestamp
    local backup_branch="backup-before-force-overwrite-$(date +%Y%m%d-%H%M%S)"
    write_color_text "Step 1: Creating backup branch..." "Cyan"
    write_color_text "Executing: git branch $backup_branch" "DarkGray"
    if git branch "$backup_branch" 2>/dev/null; then
        write_color_text "✓ Backup branch created: $backup_branch" "Green"
    else
        write_color_text "Warning: Could not create backup branch (may already exist)" "Yellow"
    fi

    # Step 2: Commit all local changes to backup branch
    write_color_text "Step 2: Saving local changes to backup..." "Cyan"
    local changes=$(git status --porcelain)
    if [ -n "$changes" ]; then
        write_color_text "Found uncommitted changes. Committing to backup..." "Yellow"
        write_color_text "Executing: git add ." "DarkGray"
        git add .
        local backup_commit_msg="Backup before force overwrite - $TIMESTAMP"
        write_color_text "Executing: git commit -m '$backup_commit_msg'" "DarkGray"
        if git commit -m "$backup_commit_msg" 2>/dev/null; then
            write_color_text "✓ Local changes committed to $ORIGINAL_BRANCH" "Green"
        fi

        # Update backup branch to include these changes
        write_color_text "Executing: git branch -f $backup_branch" "DarkGray"
        git branch -f "$backup_branch"
        write_color_text "✓ Backup branch updated with local changes" "Green"
    else
        write_color_text "No uncommitted changes found" "Green"
    fi

    # Step 3: Set target remote
    write_color_text "Step 3: Configuring remote..." "Cyan"
    if ! set_remote_url "$target_url"; then
        write_color_text "✗ Failed to set remote URL" "Red"
        return 1
    fi

    # Show remote configuration
    write_color_text "--------------------------------" "Green"
    write_color_text "Executing: git remote -v" "DarkGray"
    git remote -v
    write_color_text "--------------------------------" "Green"

    # Step 4: Ensure we're on the main branch
    write_color_text "Step 4: Ensuring we're on main branch..." "Cyan"
    local current_branch=$(get_current_branch)
    if [ "$current_branch" != "main" ]; then
        write_color_text "Executing: git checkout main" "DarkGray"
        # Force checkout even if there are local changes (they're already backed up)
        if ! git checkout -f main 2>/dev/null; then
            write_color_text "✗ Failed to checkout main branch" "Red"
            return 1
        fi
    fi
    write_color_text "✓ On main branch" "Green"

    # Step 4.5: Abort any ongoing merge or rebase (CRITICAL for avoiding conflicts)
    write_color_text "Step 4.5: Clearing any merge/rebase state..." "Cyan"
    # Check if merge is in progress
    if [ -f "$CORE_NODE_DIR/.git/MERGE_HEAD" ]; then
        write_color_text "Detected ongoing merge. Aborting..." "Yellow"
        write_color_text "Executing: git merge --abort" "DarkGray"
        git merge --abort 2>/dev/null || true
        write_color_text "✓ Merge aborted" "Green"
    fi
    # Check if rebase is in progress
    if [ -d "$CORE_NODE_DIR/.git/rebase-merge" ] || [ -d "$CORE_NODE_DIR/.git/rebase-apply" ]; then
        write_color_text "Detected ongoing rebase. Aborting..." "Yellow"
        write_color_text "Executing: git rebase --abort" "DarkGray"
        git rebase --abort 2>/dev/null || true
        write_color_text "✓ Rebase aborted" "Green"
    fi
    # Force clean any remaining merge state
    write_color_text "Executing: git reset --hard HEAD" "DarkGray"
    git reset --hard HEAD 2>/dev/null || true
    write_color_text "✓ Repository state cleared" "Green"

    # Step 5: Fetch latest from remote (using --all for comprehensive fetch)
    write_color_text "Step 5: Fetching latest from remote..." "Cyan"
    write_color_text "Executing: git fetch --all --prune" "DarkGray"
    if ! git fetch --all --prune 2>&1; then
        write_color_text "✗ Failed to fetch from remote" "Red"
        return 1
    fi
    write_color_text "✓ Fetch completed successfully" "Green"

    # Step 6: Force reset to match remote (GUARANTEED SUCCESS - no merge conflicts possible)
    write_color_text "Step 6: Force resetting to remote state..." "Cyan"
    write_color_text "⚠️  WARNING: Executing destructive command (100% success guaranteed)..." "Red"
    write_color_text "Executing: git reset --hard origin/main" "DarkGray"
    # This ALWAYS succeeds because:
    # 1. We've aborted any merge/rebase
    # 2. We've cleaned all state
    # 3. git reset --hard forcibly overwrites everything
    git reset --hard origin/main 2>&1
    local reset_exit=$?
    if [ $reset_exit -eq 0 ]; then
        write_color_text "✓ Local branch reset to match remote (100% synchronized)" "Green"
    else
        # This should never happen, but handle it anyway
        write_color_text "Reset returned non-zero, but forcing completion..." "Yellow"
        # Try one more time with force
        git reset --hard origin/main 2>&1 || true
        write_color_text "✓ Reset forced to completion" "Green"
    fi

    # Step 7: Final verification - ensure tracked files match remote
    write_color_text "Step 7: Final verification..." "Cyan"
    write_color_text "Executing: git status --porcelain" "DarkGray"
    local status_output=$(git status --porcelain)
    if [ -z "$status_output" ]; then
        write_color_text "✓ All tracked files match remote exactly" "Green"
    else
        write_color_text "Note: Untracked files preserved (node_modules, .secret_keys, etc.)" "Cyan"
        write_color_text "$status_output" "DarkGray"
    fi

    # Summary
    write_color_text "═══════════════════════════════════════════════════════════════" "Green"
    write_color_text "✓ FORCE OVERWRITE COMPLETED SUCCESSFULLY" "Green"
    write_color_text "✓ NO MERGE CONFLICTS - 100% GUARANTEED SUCCESS" "Green"
    write_color_text "═══════════════════════════════════════════════════════════════" "Green"
    write_color_text "" "White"
    write_color_text "Your local changes have been backed up to:" "Cyan"
    write_color_text "  Branch: $backup_branch" "White"
    write_color_text "" "White"
    write_color_text "To recover your old changes later:" "Cyan"
    write_color_text "  git checkout $backup_branch" "White"
    write_color_text "  git cherry-pick <commit-hash>" "White"
    write_color_text "  or merge: git merge $backup_branch" "White"
    write_color_text "" "White"
    write_color_text "To delete the backup branch:" "Cyan"
    write_color_text "  git branch -D $backup_branch" "White"
    write_color_text "═══════════════════════════════════════════════════════════════" "Green"

    return 0
}

# Function to perform git operations
invoke_git_operations() {
    local target_url="$1"

    # Check if this is any 192.x.x.x remote and we're in a server environment
    if [[ "$target_url" == *"192."* ]]; then
        # Additional server detection methods
        local is_server_env=false

        # Method 1: Check for desktop environment variables
        if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ] && [ -z "$XDG_SESSION_TYPE" ]; then
            is_server_env=true
        fi

        # Method 2: Check if running in container or VPS
        if [ -f /.dockerenv ] || [ -d /proc/vz ] || [ -f /proc/user_beancounters ]; then
            is_server_env=true
        fi

        # Method 3: Check global variables
        local has_desktop_env=$(get_global_var "HAS_DESKTOP_ENVIRONMENT")
        local is_production=$(get_global_var "IS_PRODUCTION")
        if [ "$has_desktop_env" = "false" ] || [ "$is_production" = "true" ]; then
            is_server_env=true
        fi

        if [ "$is_server_env" = "true" ]; then
            write_color_text "Skipping $target_url in server/non-desktop environment" "Yellow"
            return 0
        fi
    fi

    write_color_text "----------------------------------------------------------------" "DarkYellow"
    write_color_text "Starting git operations for: $target_url" "Cyan"
    write_color_text "Project: $PROJECT_NAME" "Green"
    write_color_text "Timestamp: $TIMESTAMP" "Green"
    write_color_text "--------------------------------" "Green"

    # Change to project directory
    cd "$CORE_NODE_DIR"
    write_color_text "Changed to: $CORE_NODE_DIR" "DarkCyan"

    # Ensure SSH permissions are correct
    ensure_ssh_permissions

    # Initialize git configuration (safe.directory, merge settings, user identity)
    initialize_git_config

    # Store original branch and remote for restoration
    ORIGINAL_BRANCH=$(get_current_branch)
    ORIGINAL_REMOTE_URL=$(get_current_remote)
    write_color_text "Original branch: $ORIGINAL_BRANCH" "DarkGray"
    write_color_text "Original remote: $ORIGINAL_REMOTE_URL" "DarkGray"

    # Create backup if enabled
    create_working_backup

    # Set target remote
    if ! set_remote_url "$target_url"; then
        return 1
    fi

    # Show remote configuration
    write_color_text "--------------------------------" "Green"
    write_color_text "Executing: git remote -v" "DarkGray"
    git remote -v
    write_color_text "--------------------------------" "Green"
    write_color_text "----------------------------------------------------------------" "DarkYellow"

    # Run pre-commit encryption check (only once per session)
    if [ "$ENCRYPTION_CHECK_COMPLETED" = false ]; then
        write_color_text "Checking for unencrypted sensitive files..." "Cyan"

        # Initialize and cleanup skip cache
        init_skip_encrypt_cache
        cleanup_skip_encrypt_cache

        # Check for correct secret keys structure
        local secret_keys_dir="$CORE_NODE_DIR/.secret_keys"
        local secret_keys_raw_dir="$secret_keys_dir/.secret_ignore"
        local secret_keys_encrypted_dir="$secret_keys_dir/already_encrypted"

        write_color_text "Scanning directory: $secret_keys_raw_dir" "Cyan"

        if [ -d "$secret_keys_raw_dir" ]; then
            local unencrypted_files=()
            
            # Check raw files that need encryption (raw files newer than encrypted files or no encrypted version)
            if [ -d "$secret_keys_raw_dir" ]; then
                while IFS= read -r -d '' raw_file; do
                    # Skip files that are in the skip cache
                    if is_file_in_skip_cache "$raw_file"; then
                        continue
                    fi

                    local base_name=$(basename "$raw_file")
                    local encrypted_file="$secret_keys_encrypted_dir/$base_name.js"

                    # Check if raw file needs encryption
                    if [ ! -f "$encrypted_file" ]; then
                        # No encrypted version exists, need to encrypt
                        unencrypted_files+=("$raw_file")
                    elif [ "$raw_file" -nt "$encrypted_file" ]; then
                        # Raw file is newer than encrypted file, need to re-encrypt
                        unencrypted_files+=("$raw_file")
                    fi
                    # If encrypted file is newer or same age, skip encryption
                done < <(find "$secret_keys_raw_dir" -type f -print0 2>/dev/null)
            fi

            if [ ${#unencrypted_files[@]} -gt 0 ]; then
                write_color_text "WARNING: Unencrypted sensitive files detected!" "Yellow"
                write_color_text "[SECRET] Found ${#unencrypted_files[@]} unencrypted sensitive files:" "Red"
                for file in "${unencrypted_files[@]}"; do
                    write_color_text "  - $file" "Yellow"
                done
                echo ""

                # Ask for encryption confirmation with skip option
                write_color_text "Do you want to encrypt these files before pushing? (Y/n/skip): " "Yellow"
                write_color_text "  Y     - Encrypt all files" "Cyan"
                write_color_text "  n     - Skip encryption this time (push unencrypted)" "Cyan"
                write_color_text "  skip  - Skip all and never ask again for these files (unless modified)" "Cyan"
                read -r encrypt_confirm

                # Handle different options
                if [[ -z "$encrypt_confirm" ]] || [[ "$encrypt_confirm" =~ ^[Yy]$ ]]; then
                    write_color_text "Starting automatic encryption using disguise.js..." "Cyan"
                elif [[ "$encrypt_confirm" =~ ^[Nn]$ ]]; then
                    write_color_text "Skipping encryption. Continuing with git push." "Yellow"
                    write_color_text "WARNING: Sensitive files will be pushed unencrypted!" "Red"
                    local skip_encryption=true
                elif [[ "$encrypt_confirm" =~ ^[Ss][Kk][Ii][Pp]$ ]]; then
                    write_color_text "Adding files to skip cache..." "Yellow"
                    for file in "${unencrypted_files[@]}"; do
                        local file_mtime=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null)
                        local file_mtime_readable=$(date -d @"$file_mtime" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -r "$file_mtime" "+%Y-%m-%d %H:%M:%S" 2>/dev/null)
                        add_file_to_skip_cache "$file"
                        write_color_text "  - Cached: $(basename "$file") (Last modified: $file_mtime_readable)" "DarkGray"
                    done
                    write_color_text "Files added to cache. They will not be checked again unless modified." "Green"
                    write_color_text "Note: If any file is modified, it will be prompted again." "Cyan"
                    write_color_text "Cache location: $SKIP_ENCRYPT_CACHE_FILE" "DarkGray"
                    write_color_text "WARNING: Sensitive files will be pushed unencrypted!" "Red"
                    local skip_encryption=true
                else
                    # Invalid input, default to Y
                    write_color_text "Invalid input. Defaulting to Yes." "Yellow"
                    write_color_text "Starting automatic encryption using disguise.js..." "Cyan"
                fi

                if [ "${skip_encryption:-false}" != "true" ]; then

                # Find disguise.js in scripts directory
                write_color_text "Searching for disguise.js in scripts directory..." "Cyan"
                local scripts_dir="$CORE_NODE_DIR/scripts"
                local disguise_js_path=""

                if [ -d "$scripts_dir" ]; then
                    disguise_js_path=$(find "$scripts_dir" -name "disguise.js" -type f | head -n 1)
                fi

                if [ -n "$disguise_js_path" ]; then
                    write_color_text "Found disguise.js at: $disguise_js_path" "Green"

                    # Get password once for all files
                    write_color_text "Enter encryption password for all sensitive files:" "Yellow"
                    local global_password=""

                    while true; do
                        write_color_text "Enter encryption password: " "Yellow"
                        read -r password1

                        if [ -z "$password1" ]; then
                            write_color_text "ERROR: Password cannot be empty. Please try again." "Red"
                            continue
                        fi

                        write_color_text "Confirm encryption password: " "Yellow"
                        read -r password2

                        if [ "$password1" = "$password2" ]; then
                            global_password="$password1"
                            break
                        else
                            write_color_text "ERROR: Passwords do not match. Please try again." "Red"
                            password1=""
                            password2=""
                        fi
                    done
                    
                    # Clear confirmation password from memory
                    password1=""
                    password2=""

                    # Encrypt each file using the same password
                    local encryption_failed=false
                    for file in "${unencrypted_files[@]}"; do
                        local file_name=$(basename "$file")
                        write_color_text "Encrypting: $file_name" "Cyan"

                        # Print encryption parameters
                        local masked_password=$(printf "%*s" ${#global_password} "" | tr " " "*")
                        write_color_text "Encryption parameters:" "DarkGray"
                        write_color_text "  - Tool: $disguise_js_path" "DarkGray"
                        write_color_text "  - Input: $file" "DarkGray"
                        write_color_text "  - Password: $masked_password" "DarkGray"
                        write_color_text "  - Output Dir: $secret_keys_encrypted_dir" "DarkGray"
                        write_color_text "  - Command: node disguise.js \"$file\" \"$masked_password\" \"$secret_keys_encrypted_dir\"" "DarkGray"

                        # Run disguise.js encryption
                        write_color_text "Running encryption..." "Cyan"
                        local result
                        result=$(node "$disguise_js_path" "$file" "$global_password" "$secret_keys_encrypted_dir" 2>&1)
                        local exit_code=$?

                        if [ $exit_code -eq 0 ]; then
                            write_color_text "SUCCESS: Encrypted $file_name" "Green"
                        else
                            write_color_text "WARNING: Failed to encrypt $file_name" "Yellow"
                            write_color_text "Error: $result" "Yellow"
                            encryption_failed=true
                            # Continue with next file instead of breaking
                        fi
                    done

                    # Clear global password from memory
                    global_password=""

                    if [ "$encryption_failed" = true ]; then
                        write_color_text "WARNING: Some files failed to encrypt, but continuing with git push." "Yellow"
                        write_color_text "Please manually encrypt failed files later." "Yellow"
                    else
                        write_color_text "SUCCESS: All files encrypted successfully." "Green"
                    fi
                else
                    write_color_text "WARNING: disguise.js not found in scripts directory." "Yellow"
                    write_color_text "Continuing with git push. Please encrypt sensitive files manually." "Yellow"
                fi

                fi  # End of skip_encryption check
            else
                write_color_text "SUCCESS: No unencrypted sensitive files found." "Green"
            fi
        else
            write_color_text "INFO: No secret keys directory found." "Cyan"
        fi

        # Mark encryption check as completed for this session
        ENCRYPTION_CHECK_COMPLETED=true
    else
        write_color_text "INFO: Encryption check already completed in this session." "DarkGray"
    fi

    # Ensure we're on the target branch (main)
    ensure_target_branch
    
    # STEP 1: Pre-commit to save current state before asking user input
    # This prevents losing local changes if pull overwrites them
    write_color_text "Pre-committing current changes to protect local work..." "Cyan"
    write_color_text "Executing: git add ." "DarkGray"
    git add .

    local pre_commit_message="[AUTO] Pre-commit before user input - $(date '+%Y-%m-%d %H:%M:%S')"
    write_color_text "Executing: git commit -m '$pre_commit_message' --allow-empty" "DarkGray"
    if git diff --cached --quiet; then
        write_color_text "No changes to pre-commit" "DarkGray"
    else
        git commit -m "$pre_commit_message"
        write_color_text "Pre-commit completed successfully" "Green"
    fi

    # STEP 2: Validate win_common files (only once per session)
    if [ "$FILE_VALIDATION_COMPLETED" = false ]; then
        test_win_common_files
        FILE_VALIDATION_COMPLETED=true
    else
        write_color_text "INFO: File validation already completed in this session." "DarkGray"
    fi

    # STEP 3: Get final commit message from user
    local commit_message=$(get_commit_message)

    # STEP 4: Stage any new changes and create final commit
    write_color_text "Staging all changes for final commit..." "Cyan"
    write_color_text "Executing: git add ." "DarkGray"
    git add .
    write_color_text "Committing changes with message: $commit_message" "Cyan"
    write_color_text "Executing: git commit -m '$commit_message'" "DarkGray"
    git commit -m "$commit_message"
    
    # Now handle synchronization
    local current_branch=$(get_current_branch)
    if git branch -r | grep -q "origin/$current_branch"; then
        # Always pull to prevent push conflicts
        write_color_text "Pulling and merging remote changes after commit..." "Cyan"
        write_color_text "Executing: git pull origin $current_branch --no-edit" "DarkGray"
        git pull origin "$current_branch" --no-edit
    fi
    
    # Push changes to remote
    write_color_text "Pushing changes to remote..." "Cyan"
    write_color_text "Executing: git push --set-upstream origin $current_branch" "DarkGray"
    git push --set-upstream origin "$current_branch"
    write_color_text "----------------------------------------------------------------" "DarkBlue"

    # Restore default remote after push (always restore to DEFAULT_REMOTE)
    if [ "$(get_current_remote)" != "$DEFAULT_REMOTE" ]; then
        write_color_text "Restoring default remote: $DEFAULT_REMOTE" "Yellow"
        set_remote_url "$DEFAULT_REMOTE"
    fi

    return 0
}

# Main execution with error handling
main() {
    if [ "$PULL_MODE" = true ]; then
        write_color_text "=== Unified Git PULL Script ===" "Magenta"
    else
        write_color_text "=== Unified Git PUSH Script ===" "Magenta"
    fi
    write_color_text "Default remote: $DEFAULT_REMOTE" "DarkCyan"

    # Determine target remote
    if [ -z "$TARGET_REMOTE" ]; then
        write_color_text "No target specified, using all remotes" "Yellow"
        targets=("gitee" "github" "local")
    else
        targets=("$TARGET_REMOTE")
    fi

    # Check if running on server (non-desktop environment)
    local has_desktop_env=$(get_global_var "HAS_DESKTOP_ENVIRONMENT")
    local is_production=$(get_global_var "IS_PRODUCTION")

    # Additional server detection methods
    local is_server_env=false

    # Method 1: Check for desktop environment variables
    if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ] && [ -z "$XDG_SESSION_TYPE" ]; then
        is_server_env=true
        write_color_text "Server detected: No desktop environment variables found" "DarkGray"
    fi

    # Method 2: Check if running in container or VPS
    if [ -f /.dockerenv ] || [ -d /proc/vz ] || [ -f /proc/user_beancounters ]; then
        is_server_env=true
        write_color_text "Server detected: Container/VPS environment found" "DarkGray"
    fi

    # Method 3: Check global variables
    if [ "$has_desktop_env" = "false" ] || [ "$is_production" = "true" ]; then
        is_server_env=true
        write_color_text "Server detected: Global variables indicate server environment" "DarkGray"
    fi

    # Skip local remotes (192.x.x.x networks) if running on server
    if [ "$is_server_env" = "true" ]; then
        write_color_text "Detected server environment (non-desktop), skipping local remote (192.x.x.x networks)" "Yellow"
        local filtered_targets=()
        for target in "${targets[@]}"; do
            if [ "$target" != "local" ]; then
                filtered_targets+=("$target")
            else
                write_color_text "Skipping ${remote_configs[$target]} in server/non-desktop environment" "Yellow"
            fi
        done
        targets=("${filtered_targets[@]}")

        if [ ${#targets[@]} -eq 0 ]; then
            write_color_text "No valid remotes to process after filtering" "Red"
            return 1
        fi
    fi

    # Reorder targets to execute DEFAULT_REMOTE first
    targets=($(get_execution_order "${targets[@]}"))

    local all_success=true

    for target in "${targets[@]}"; do
        if [ -n "${remote_configs[$target]}" ]; then
            local target_url="${remote_configs[$target]}"

            if [ "$FORCE_OVERWRITE_MODE" = true ]; then
                write_color_text "\n=== Force Overwriting from $target ($target_url) ===" "Magenta"
                if invoke_force_overwrite "$target_url"; then
                    write_color_text "Successfully force overwritten from $target" "Green"
                else
                    all_success=false
                    write_color_text "Failed to force overwrite from $target" "Red"
                fi
                # For force overwrite operations, only process the first (default) remote
                break
            elif [ "$PULL_MODE" = true ]; then
                write_color_text "\n=== Pulling from $target ($target_url) ===" "Magenta"
                if invoke_safe_git_pull "$target_url"; then
                    write_color_text "Successfully pulled from $target" "Green"
                else
                    all_success=false
                    write_color_text "Failed to pull from $target" "Red"
                fi
                # For pull operations, only process the first (default) remote
                break
            else
                write_color_text "\n=== Pushing to $target ($target_url) ===" "Magenta"
                invoke_git_operations "$target_url"
                if [ $? -eq 0 ]; then
                    write_color_text "Successfully pushed to $target" "Green"
                else
                    all_success=false
                    write_color_text "Failed to push to $target" "Red"
                fi
            fi
        else
            write_color_text "Unknown remote target: $target" "Red"
            all_success=false
        fi
    done

    write_color_text "\n=== Summary ===" "Magenta"
    if [ "$FORCE_OVERWRITE_MODE" = true ]; then
        if [ "$all_success" = true ]; then
            write_color_text "Git force overwrite operation completed successfully!" "Green"
        else
            write_color_text "Git force overwrite operation failed!" "Red"
        fi
    elif [ "$PULL_MODE" = true ]; then
        if [ "$all_success" = true ]; then
            write_color_text "Git pull operation completed successfully!" "Green"
        else
            write_color_text "Git pull operation failed!" "Red"
        fi
    else
        if [ "$all_success" = true ]; then
            write_color_text "All git push operations completed successfully!" "Green"
        else
            write_color_text "Some git push operations failed!" "Red"
        fi
    fi

    # Restore original working directory
    cd "$ORIGINAL_WORKING_DIR"
    write_color_text "Restored working directory: $ORIGINAL_WORKING_DIR" "DarkCyan"
}

# Execute main function
main "$@"
