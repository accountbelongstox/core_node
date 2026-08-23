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

# Auto-continue with the default commit message after this many idle seconds
COMMIT_MESSAGE_TIMEOUT_SECONDS=3

# State tracking variables
ENCRYPTION_CHECK_COMPLETED=false
FILE_VALIDATION_COMPLETED=false
PULL_COMPLETED=false
SSH_KEYS_CHECK_COMPLETED=false
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
ARROW_MENU_SCRIPT="$CORE_NODE_DIR/scripts/shells/linux/common/arrow_menu.sh"
GITHUB_HOST_REFRESH_SH="$SCRIPT_PATH/github_host_refresh.sh"
GITEE_HOST_REFRESH_SH="$SCRIPT_PATH/gitee_host_refresh.sh"
GITPUT_SECURITY_COMMON="$SCRIPT_PATH/gitput_security_common.sh"
GITPUT_REPOSITORY_STATE="$SCRIPT_PATH/gitput_repository_state.sh"
GITPUT_SYNC_COMMON="$SCRIPT_PATH/gitput_sync_common.sh"

# SSH key variables
SSH_DIR="$HOME/.ssh"
SSH_KEY_NAME="id_ed25519"
SSH_PUB_NAME="id_ed25519.pub"
LOCAL_SSH_PUB_JS="$CORE_NODE_DIR/scripts/git/git.ssh.id.ed.pub.js"
LOCAL_SSH_KEY_JS="$CORE_NODE_DIR/scripts/git/git.ssh.id.ed.js"
SSH_INSTALL_SCRIPT="$CORE_NODE_DIR/scripts/shells/linux/debian/install_shells/24_install_git_ssh.sh"

# Cache and encryption variables
SKIP_ENCRYPT_CACHE_DIR="/var/_node_core"
SKIP_ENCRYPT_CACHE_FILE="$SKIP_ENCRYPT_CACHE_DIR/git_skip_encrypt_cache.db"

# Commit message variable
COMMIT_MESSAGE=""

# Global associative array for remote configurations
declare -g -A remote_configs

# Default remote (will be set after loading configurations)
DEFAULT_REMOTE=""

# Push target interaction state
CURRENT_BRANCH_PREVIEW=""
FORCE_PUSH_CHOICE=""
GITHUB_FORCE_PUSH_MODE="no"
GITEE_FORCE_PUSH_CHOICE=""
GITEE_FORCE_PUSH_MODE="yes"
GITEE_PREFER_LOCAL_MERGE=false
GITEE_PUSH_CHOICE=""
GITEE_PUSH_ENABLED=false
HAS_GITEE_TARGET=false
HAS_PRIMARY_PUSH_TARGET=false
PREFER_LOCAL_MERGE_ON_FAILURE=false
PUSH_RC=0
TARGET_FORCE_PUSH_MODE="no"

# Push target messages
GITEE_BACKUP_NOTICE="Gitee is configured as a backup remote only."
GITEE_PUSH_PROMPT="Push this branch to the Gitee backup? [N/y]: "
GITEE_FORCE_PUSH_PROMPT="Force push to Gitee as a backup? [Y/n]: "

source "$ARROW_MENU_SCRIPT"
source "$GITHUB_HOST_REFRESH_SH"
source "$GITEE_HOST_REFRESH_SH"
source "$GITPUT_SECURITY_COMMON"
source "$GITPUT_REPOSITORY_STATE"
source "$GITPUT_SYNC_COMMON"

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


# Function to perform git operations
invoke_git_operations() {
    local target_url="$1"
    local force_push_mode="$2"  # "yes" or "no"
    local prefer_local_merge_on_failure="$3"

    # Check if host is reachable before proceeding. Return code 2 = SKIPPED
    # (NOT success) so the caller does not falsely report "Successfully pushed".
    if ! check_host_reachable "$target_url"; then
        write_color_text "Skipping $target_url (host not reachable; push NOT performed)" "Yellow"
        return 2
    fi

    write_color_text "----------------------------------------------------------------" "DarkYellow"
    write_color_text "Starting git operations for: $target_url" "Cyan"
    write_color_text "Project: $PROJECT_NAME" "Green"
    write_color_text "Timestamp: $TIMESTAMP" "Green"
    write_color_text "--------------------------------" "Green"

    # Change to project directory
    cd "$CORE_NODE_DIR"
    write_color_text "Changed to: $CORE_NODE_DIR" "DarkCyan"

    # Ensure SSH keys are installed (decrypt if missing, skip if already present)
    ensure_ssh_keys_installed

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
    
    # Validate win_common files (only once per session)
    if [ "$FILE_VALIDATION_COMPLETED" = false ]; then
        test_win_common_files
        FILE_VALIDATION_COMPLETED=true
    else
        write_color_text "INFO: File validation already completed in this session." "DarkGray"
    fi

    # Get the commit message from the user (auto-defaults after an idle timeout).
    local commit_message=$(get_commit_message)

    # Stage anything that changed while the prompt was open, then create the
    # single commit for this push. One push cycle produces exactly one commit
    # (no separate "[AUTO] Pre-commit" commit).
    write_color_text "Staging all changes for commit..." "Cyan"
    write_color_text "Executing: git add ." "DarkGray"
    git add .

    # Only commit when something is actually staged; a clean tree is not an error.
    if git diff --cached --quiet; then
        write_color_text "Nothing new to commit; working tree already clean." "DarkGray"
    else
        write_color_text "Committing changes with message: $commit_message" "Cyan"
        write_color_text "Executing: git commit -m '$commit_message'" "DarkGray"
        git commit -m "$commit_message"
    fi

    # Ensure local is fully committed before any pull/push (force or normal)
    if [ -n "$(git status --porcelain)" ]; then
        write_color_text "ERROR: Working tree not clean after commit; aborting to protect local work." "Red"
        git status --short
        return 1
    fi
    write_color_text "Local commit verified: working tree is clean." "Green"

    # Get current branch for push operations
    local current_branch=$(get_current_branch)

    # Use the force push mode passed from main function
    if [[ "$force_push_mode" == "yes" ]]; then
        # Force push mode - skip pull completely
        write_color_text "=== FORCE PUSH MODE ===" "Red"
        write_color_text "Skipping pull (will overwrite remote changes)" "Red"
        write_color_text "WARNING: Force pushing all changes..." "Red"
        write_color_text "Executing: git push --force --set-upstream origin $current_branch" "DarkGray"
        if ! git push --force --set-upstream origin "$current_branch"; then
            write_color_text "Push failed (e.g. SSH connection timeout), skipping this remote." "Yellow"
            return 1
        fi
    else
        # Normal push mode - pull only once per session (first remote)
        write_color_text "=== NORMAL PUSH MODE ===" "Green"
        if [ "$PULL_COMPLETED" != true ] || [ "$prefer_local_merge_on_failure" = true ]; then
            if [ "$prefer_local_merge_on_failure" = true ] || git branch -r | grep -q "origin/$current_branch"; then
                write_color_text "Pulling and merging remote changes after commit..." "Cyan"
                write_color_text "Executing: git pull origin $current_branch --no-edit" "DarkGray"
                if ! git pull origin "$current_branch" --no-edit; then
                    if [ "$prefer_local_merge_on_failure" = true ]; then
                        write_color_text "Merge failed. Retrying with local changes preferred for conflicts." "Yellow"
                        git merge --abort 2>/dev/null || true
                        write_color_text "Executing: git fetch origin $current_branch" "DarkGray"
                        if ! git fetch origin "$current_branch"; then
                            write_color_text "Fetch failed, skipping this remote." "Yellow"
                            return 1
                        fi
                        write_color_text "Executing: git merge origin/$current_branch -X ours --no-edit" "DarkGray"
                        if ! git merge "origin/$current_branch" -X ours --no-edit; then
                            write_color_text "Local-preferred merge failed, skipping this remote." "Yellow"
                            git merge --abort 2>/dev/null || true
                            return 1
                        fi
                    else
                        write_color_text "Pull failed (e.g. SSH connection timeout), skipping this remote." "Yellow"
                        return 1
                    fi
                fi
            fi
            PULL_COMPLETED=true
        else
            write_color_text "Skipping pull - already synchronized in this session" "Yellow"
        fi

        write_color_text "Pushing changes to remote..." "Cyan"
        write_color_text "Executing: git push --set-upstream origin $current_branch" "DarkGray"
        if ! git push --set-upstream origin "$current_branch"; then
            write_color_text "Push failed (e.g. SSH connection timeout), skipping this remote." "Yellow"
            return 1
        fi
    fi

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
    CURRENT_BRANCH_PREVIEW=$(cd "$CORE_NODE_DIR" && get_current_branch)
    GITHUB_FORCE_PUSH_MODE="no"
    GITEE_FORCE_PUSH_MODE="yes"
    GITEE_PREFER_LOCAL_MERGE=false
    GITEE_PUSH_ENABLED=false
    HAS_GITEE_TARGET=false
    HAS_PRIMARY_PUSH_TARGET=false

    if [ "$PULL_MODE" = true ]; then
        write_color_text "=== Unified Git PULL Script ===" "Magenta"
    elif [ "$FORCE_OVERWRITE_MODE" = true ]; then
        write_color_text "=== Unified Git FORCE OVERWRITE Script ===" "Magenta"
    else
        write_color_text "=== Unified Git PUSH Script ===" "Magenta"
    fi
    write_color_text "Default remote: $DEFAULT_REMOTE" "DarkCyan"

    # Determine target remote
    if [ -z "$TARGET_REMOTE" ]; then
        write_color_text "No target specified, using all remotes" "Yellow"
        # local temporarily disabled (not reachable or not in use); restore with: targets=("github" "gitee" "local")
        targets=("github" "gitee")
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

    # Don't filter targets here - check connectivity when actually pushing
    if [ ${#targets[@]} -eq 0 ]; then
        write_color_text "No valid remotes to process" "Red"
        return 1
    fi

    # Reorder targets to execute DEFAULT_REMOTE first
    targets=($(get_execution_order "${targets[@]}"))

    for target in "${targets[@]}"; do
        if [ "$target" = "gitee" ]; then
            HAS_GITEE_TARGET=true
        else
            HAS_PRIMARY_PUSH_TARGET=true
        fi
    done

    # Preview targets before executing
    write_color_text "" "White"
    write_color_text "============================================================" "Cyan"
    if [ "$PULL_MODE" = true ]; then
        write_color_text "  PULL TARGETS PREVIEW" "Cyan"
    elif [ "$FORCE_OVERWRITE_MODE" = true ]; then
        write_color_text "  FORCE OVERWRITE TARGETS PREVIEW" "Cyan"
    else
        write_color_text "  PUSH TARGETS PREVIEW" "Cyan"
    fi
    write_color_text "============================================================" "Cyan"
    write_color_text "Total targets: ${#targets[@]}" "Green"

    # Warning if only one target
    if [ ${#targets[@]} -eq 1 ]; then
        write_color_text "" "White"
        if [ "$PULL_MODE" = true ]; then
            write_color_text "[WARN]  WARNING: Pulling from ONE remote repository only." "Red"
        elif [ "$FORCE_OVERWRITE_MODE" = true ]; then
            write_color_text "[WARN]  WARNING: Force overwrite will run for ONE remote only." "Red"
        else
            write_color_text "[WARN]  WARNING: Only pushing to ONE remote repository!" "Red"
            write_color_text "    To push to all remotes, select 'all' in the menu" "Yellow"
        fi
    fi

    write_color_text "" "White"

    local target_index=1
    for target in "${targets[@]}"; do
        if [ -n "${remote_configs[$target]}" ]; then
            local target_url="${remote_configs[$target]}"
            write_color_text "  [$target_index] $target" "Yellow"
            write_color_text "      URL: $target_url" "DarkGray"
            if [ "$target" = "gitee" ]; then
                write_color_text "      Branch: $CURRENT_BRANCH_PREVIEW" "DarkGray"
            fi
        fi
        ((target_index++))
    done
    write_color_text "" "White"
    write_color_text "============================================================" "Cyan"
    write_color_text "" "White"

    # Keep the default force-push choice for the primary remote, then configure Gitee separately.
    if [ "$PULL_MODE" != true ] && [ "$FORCE_OVERWRITE_MODE" != true ]; then
        if [ "$HAS_PRIMARY_PUSH_TARGET" = true ]; then
            write_color_text "Do you want to force push? [y/N]: " "Yellow"
            read -r FORCE_PUSH_CHOICE
            if [[ "$FORCE_PUSH_CHOICE" =~ ^[Yy]$ ]]; then
                GITHUB_FORCE_PUSH_MODE="yes"
                write_color_text "[OK] Force push enabled for the primary remote" "Red"
            else
                write_color_text "[OK] Normal push mode (with pull) for the primary remote" "Green"
            fi
            write_color_text "" "White"
        fi

        if [ "$HAS_GITEE_TARGET" = true ]; then
            write_color_text "$GITEE_BACKUP_NOTICE" "Yellow"
            write_color_text "Branch: $CURRENT_BRANCH_PREVIEW" "Cyan"
            write_color_text "$GITEE_PUSH_PROMPT" "Yellow"
            read -r GITEE_PUSH_CHOICE
            if [[ "$GITEE_PUSH_CHOICE" =~ ^[Yy]$ ]]; then
                GITEE_PUSH_ENABLED=true
                write_color_text "$GITEE_FORCE_PUSH_PROMPT" "Yellow"
                read -r GITEE_FORCE_PUSH_CHOICE
                if [[ "$GITEE_FORCE_PUSH_CHOICE" =~ ^[Nn]$ ]]; then
                    GITEE_FORCE_PUSH_MODE="no"
                    GITEE_PREFER_LOCAL_MERGE=true
                    write_color_text "[OK] Normal Gitee backup push; merge conflicts will prefer local changes" "Green"
                else
                    write_color_text "[OK] Force push enabled for the Gitee backup" "Red"
                fi
            else
                write_color_text "[OK] Gitee backup push skipped" "Yellow"
            fi
            write_color_text "" "White"
        fi

        write_color_text "Refresh GitHub HOST (GitHub520)? [y/N]: " "Yellow"
        read -r refresh_host_choice
        if [[ "$refresh_host_choice" =~ ^[Yy]$ ]]; then
            if type invoke_github_host_refresh >/dev/null 2>&1; then
                invoke_github_host_refresh write_color_text
            fi
        fi
        write_color_text "" "White"

        write_color_text "Refresh Gitee HOST? [y/N]: " "Yellow"
        read -r refresh_gitee_choice
        if [[ "$refresh_gitee_choice" =~ ^[Yy]$ ]]; then
            if type invoke_gitee_host_refresh >/dev/null 2>&1; then
                invoke_gitee_host_refresh write_color_text
            fi
        fi
        write_color_text "" "White"

        show_repo_size_overview "${targets[@]}"
    fi

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
                if [ "$target" = "gitee" ] && [ "$GITEE_PUSH_ENABLED" != true ]; then
                    write_color_text "\n=== Skipping Gitee backup ($target_url) ===" "Yellow"
                    continue
                fi

                TARGET_FORCE_PUSH_MODE="$GITHUB_FORCE_PUSH_MODE"
                PREFER_LOCAL_MERGE_ON_FAILURE=false
                if [ "$target" = "gitee" ]; then
                    TARGET_FORCE_PUSH_MODE="$GITEE_FORCE_PUSH_MODE"
                    PREFER_LOCAL_MERGE_ON_FAILURE="$GITEE_PREFER_LOCAL_MERGE"
                fi

                write_color_text "\n=== Pushing to $target ($target_url) ===" "Magenta"
                invoke_git_operations "$target_url" "$TARGET_FORCE_PUSH_MODE" "$PREFER_LOCAL_MERGE_ON_FAILURE"
                PUSH_RC=$?
                if [ $PUSH_RC -eq 0 ]; then
                    write_color_text "Successfully pushed to $target" "Green"
                elif [ $PUSH_RC -eq 2 ]; then
                    # Skipped (host unreachable) - NOT a success and NOT counted as
                    # pushed; mark the run as not fully successful so the summary is honest.
                    all_success=false
                    write_color_text " Skipped $target (host not reachable - nothing pushed)" "Yellow"
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
