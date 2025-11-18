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

# Source common variables and functions
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
USE_SUDO=""
fi
# Parameter validation
TARGET_REMOTE=""
PULL_MODE=false

# Parse parameters
while [[ $# -gt 0 ]]; do
    case $1 in
        --pull)
            PULL_MODE=true
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

# Declare all variables at the beginning
ENCRYPTION_CHECK_COMPLETED=false
PULL_COMPLETED=false
FILE_VALIDATION_COMPLETED=false
ORIGINAL_WORKING_DIR=$(pwd)
ORIGINAL_REMOTE_URL=""
ORIGINAL_BRANCH=""
BACKUP_ENABLED=false
SCRIPT_PATH="$(dirname "$(readlink -f "$0")")"
CORE_NODE_DIR="$(dirname "$(dirname "$SCRIPT_PATH")")"
PROJECT_NAME="core_node"  # Hardcoded project name
TIMESTAMP="$(date "+%Y-%m-%d %H:%M:%S")"
export COMMIT_MESSAGE=""
WIN_COMMON_DIR="$CORE_NODE_DIR/scripts/shells/win/win_common"

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

# Function to ensure git user identity is configured
ensure_git_identity() {
    # Check if git user.name is configured
    local git_name=$(git config --global user.name 2>/dev/null)
    local git_email=$(git config --global user.email 2>/dev/null)
    
    # If not configured, set default values
    if [ -z "$git_name" ] || [ -z "$git_email" ]; then
        write_color_text "Git user identity not configured. Setting default values..." "Yellow" >&2
        
        # Generate system-based name
        local system_name=$(whoami)
        local hostname=$(hostname)
        local default_name="${system_name}@${hostname}"
        
        # Set default email
        local default_email="${system_name}@dev.ai"
        
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

# Default remote (primary) - this will be restored after each operation
DEFAULT_REMOTE=$(get_default_remote "$PROJECT_NAME")

# Remote configurations
declare -A remote_configs
remote_configs["gitee"]="git@gitee.com:accountbelongstox/$PROJECT_NAME.git"
remote_configs["github"]="git@github.com:accountbelongstox/$PROJECT_NAME.git"
remote_configs["local"]="git@192.168.2.1:adminroot/core_node.git"

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

# Function to perform git operations
invoke_git_operations() {
    local target_url="$1"
    
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
    
    # Ensure git identity is configured
    ensure_git_identity
    
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

                # Ask for encryption confirmation with default Y
                write_color_text "Do you want to encrypt these files before pushing? (Y/n): " "Yellow"
                read -r encrypt_confirm

                # Default to Y if empty or Enter pressed
                if [[ -z "$encrypt_confirm" ]] || [[ "$encrypt_confirm" =~ ^[Yy]$ ]]; then
                    write_color_text "Starting automatic encryption using disguise.js..." "Cyan"
                elif [[ "$encrypt_confirm" =~ ^[Nn]$ ]]; then
                    write_color_text "Skipping encryption. Continuing with git push." "Yellow"
                    write_color_text "WARNING: Sensitive files will be pushed unencrypted!" "Red"
                    # Skip encryption by jumping to the end of this block
                    # We'll use a flag to control this
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
    
    # Stage all changes FIRST (before pull)
    write_color_text "Staging all changes..." "Cyan"
    write_color_text "Executing: git add ." "DarkGray"
    git add .
    
    # Validate win_common files before commit (only once per session)
    if [ "$FILE_VALIDATION_COMPLETED" = false ]; then
        test_win_common_files
        FILE_VALIDATION_COMPLETED=true
    else
        write_color_text "INFO: File validation already completed in this session." "DarkGray"
    fi
    
    # Commit changes BEFORE pulling
    local commit_message=$(get_commit_message)
    write_color_text "Committing changes with message: $commit_message" "Cyan"
    write_color_text "Executing: git commit -m '$commit_message'" "DarkGray"
    git commit -m "$commit_message"
    
    # Now handle synchronization
    local current_branch=$(get_current_branch)
    if git branch -r | grep -q "origin/$current_branch"; then
        # Only pull if this is the first remote (should be DEFAULT_REMOTE) and not yet completed
        if [ "$PULL_COMPLETED" = false ]; then
            write_color_text "Pulling and merging remote changes after commit..." "Cyan"
            write_color_text "Executing: git pull origin $current_branch --no-edit" "DarkGray"
            git pull origin "$current_branch" --no-edit
            PULL_COMPLETED=true
        else
            write_color_text "Skipping pull - already synchronized in this session" "Yellow"
        fi
    fi
    
    # Push changes to remote
    write_color_text "Pushing changes to remote..." "Cyan"
    write_color_text "Executing: git push --set-upstream origin $current_branch" "DarkGray"
    git push --set-upstream origin "$current_branch"
    write_color_text "----------------------------------------------------------------" "DarkBlue"
    
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
    
    # Reorder targets to execute DEFAULT_REMOTE first
    targets=($(get_execution_order "${targets[@]}"))
    
    local all_success=true
    
    for target in "${targets[@]}"; do
        if [ -n "${remote_configs[$target]}" ]; then
            local target_url="${remote_configs[$target]}"
            
            if [ "$PULL_MODE" = true ]; then
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
        
        # Always restore original branch and remote after each operation
        restore_original_branch
        restore_original_remote
    done
    
    write_color_text "\n=== Summary ===" "Magenta"
    if [ "$PULL_MODE" = true ]; then
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
