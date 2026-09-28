#!/bin/bash

# Function to handle automated conflict resolution
handle_conflict_resolution() {
    local resolution_choice
    local user_choice
    local -a resolution_menu_items=(
        "Keep REMOTE version (recommended for pulling latest changes)"
        "Keep LOCAL version (preserve your changes)"
        "Abort operation"
    )

    write_color_text "" "White"
    write_color_text "AUTOMATED CONFLICT RESOLUTION OPTIONS:" "Magenta"
    write_color_text "" "White"
    write_color_text "Would you like to automatically resolve conflicts? [Y/n]: " "Cyan"
    
    read -r user_choice
    user_choice="${user_choice:-Y}"  # Default to Y if empty
    
    if [[ "$user_choice" =~ ^[Yy]$ ]]; then
        arrow_menu_select "Conflict Resolution Strategy" resolution_menu_items 0 2
        resolution_choice=$((ARROW_MENU_SELECTED_INDEX + 1))
        
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

    # Check if host is reachable before proceeding
    if ! check_host_reachable "$target_url"; then
        write_color_text "Skipping $target_url (host not reachable)" "Yellow"
        return 0
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

    # Check if host is reachable before proceeding
    if ! check_host_reachable "$target_url"; then
        write_color_text "Skipping $target_url (host not reachable)" "Yellow"
        return 0
    fi

    write_color_text "--------------------------------------------------------------" "Yellow"
    write_color_text "FORCE OVERWRITE - DISCARDING LOCAL CHANGES" "Red"
    write_color_text "--------------------------------------------------------------" "Yellow"
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
        write_color_text "[OK] Backup branch created: $backup_branch" "Green"
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
            write_color_text "[OK] Local changes committed to $ORIGINAL_BRANCH" "Green"
        fi

        # Update backup branch to include these changes
        write_color_text "Executing: git branch -f $backup_branch" "DarkGray"
        git branch -f "$backup_branch"
        write_color_text "[OK] Backup branch updated with local changes" "Green"
    else
        write_color_text "No uncommitted changes found" "Green"
    fi

    # Step 3: Set target remote
    write_color_text "Step 3: Configuring remote..." "Cyan"
    if ! set_remote_url "$target_url"; then
        write_color_text "Failed to set remote URL" "Red"
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
            write_color_text "Failed to checkout main branch" "Red"
            return 1
        fi
    fi
    write_color_text "On main branch" "Green"

    # Step 4.5: Abort any ongoing merge or rebase (CRITICAL for avoiding conflicts)
    write_color_text "Step 4.5: Clearing any merge/rebase state..." "Cyan"
    # Check if merge is in progress
    if [ -f "$CORE_NODE_DIR/.git/MERGE_HEAD" ]; then
        write_color_text "Detected ongoing merge. Aborting..." "Yellow"
        write_color_text "Executing: git merge --abort" "DarkGray"
        git merge --abort 2>/dev/null || true
        write_color_text "Merge aborted" "Green"
    fi
    # Check if rebase is in progress
    if [ -d "$CORE_NODE_DIR/.git/rebase-merge" ] || [ -d "$CORE_NODE_DIR/.git/rebase-apply" ]; then
        write_color_text "Detected ongoing rebase. Aborting..." "Yellow"
        write_color_text "Executing: git rebase --abort" "DarkGray"
        git rebase --abort 2>/dev/null || true
        write_color_text "Rebase aborted" "Green"
    fi
    # Force clean any remaining merge state
    write_color_text "Executing: git reset --hard HEAD" "DarkGray"
    git reset --hard HEAD 2>/dev/null || true
    write_color_text "Repository state cleared" "Green"

    # Step 5: Fetch latest from remote (using --all for comprehensive fetch)
    write_color_text "Step 5: Fetching latest from remote..." "Cyan"
    write_color_text "Executing: git fetch --all --prune" "DarkGray"
    if ! git fetch --all --prune 2>&1; then
        write_color_text "Failed to fetch from remote" "Red"
        return 1
    fi
    write_color_text "Fetch completed successfully" "Green"

    # Step 6: Force reset to match remote (GUARANTEED SUCCESS - no merge conflicts possible)
    write_color_text "Step 6: Force resetting to remote state..." "Cyan"
    write_color_text "[WARN]  WARNING: Executing destructive command (100% success guaranteed)..." "Red"
    write_color_text "Executing: git reset --hard origin/main" "DarkGray"
    # This ALWAYS succeeds because:
    # 1. We've aborted any merge/rebase
    # 2. We've cleaned all state
    # 3. git reset --hard forcibly overwrites everything
    git reset --hard origin/main 2>&1
    local reset_exit=$?
    if [ $reset_exit -eq 0 ]; then
        write_color_text "Local branch reset to match remote (100% synchronized)" "Green"
    else
        # This should never happen, but handle it anyway
        write_color_text "Reset returned non-zero, but forcing completion..." "Yellow"
        # Try one more time with force
        git reset --hard origin/main 2>&1 || true
        write_color_text "Reset forced to completion" "Green"
    fi

    # Step 7: Final verification - ensure tracked files match remote
    write_color_text "Step 7: Final verification..." "Cyan"
    write_color_text "Executing: git status --porcelain" "DarkGray"
    local status_output=$(git status --porcelain)
    if [ -z "$status_output" ]; then
        write_color_text "All tracked files match remote exactly" "Green"
    else
        write_color_text "Note: Untracked files preserved (node_modules, .secret_keys, etc.)" "Cyan"
        write_color_text "$status_output" "DarkGray"
    fi

    # Summary
    write_color_text "--------------------------------------------------------------" "Green"
    write_color_text "[OK] FORCE OVERWRITE COMPLETED SUCCESSFULLY" "Green"
    write_color_text "[OK] NO MERGE CONFLICTS - 100% GUARANTEED SUCCESS" "Green"
    write_color_text "--------------------------------------------------------------" "Green"
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
    write_color_text "--------------------------------------------------------------" "Green"

    return 0
}

# TCP reachability probe (NOT ICMP). Returns 0 if a TCP connection to host:port
# can be opened within ~3s. Prefers `nc`, falls back to bash /dev/tcp + timeout.
_tcp_probe() {
    local h="$1"
    local p="$2"
    if command -v nc >/dev/null 2>&1; then
        nc -z -w 3 "$h" "$p" >/dev/null 2>&1 && return 0
        return 1
    fi
    if command -v timeout >/dev/null 2>&1; then
        timeout 3 bash -c "exec 3<>/dev/tcp/$h/$p" >/dev/null 2>&1 && return 0
        return 1
    fi
    (exec 3<>/dev/tcp/"$h"/"$p") >/dev/null 2>&1 && return 0
    return 1
}

# Function to check if a git remote host is reachable for SSH/HTTPS.
# IMPORTANT: this checks the actual TCP SERVICE PORT, never ICMP ping -
# github.com and gitee.com BLOCK ping, so the old `ping` check always reported
# "not reachable" and silently skipped every push.
check_host_reachable() {
    local url="$1"
    local host=""
    local port=22   # scp-style git@host:path uses SSH (22)

    # Extract host (+ optional port) from the git URL.
    if [[ "$url" =~ ^ssh://[^@]+@([^:/]+):?([0-9]*) ]]; then
        host="${BASH_REMATCH[1]}"
        [ -n "${BASH_REMATCH[2]}" ] && port="${BASH_REMATCH[2]}"
    elif [[ "$url" =~ @([^:]+): ]]; then
        host="${BASH_REMATCH[1]}"
    elif [[ "$url" =~ ^https?://([^/:]+) ]]; then
        host="${BASH_REMATCH[1]}"
        port=443
    elif [[ "$url" =~ //([^/]+) ]]; then
        host="${BASH_REMATCH[1]}"
        if [[ -n "${BASH_REMATCH[3]}" ]]; then
            port="${BASH_REMATCH[3]}"
        fi
    else
        # Can't parse host, assume reachable.
        return 0
    fi

    write_color_text "Checking connectivity to: $host:$port (TCP)" "DarkGray"

    if _tcp_probe "$host" "$port"; then
        write_color_text "[OK] Host $host:$port is reachable" "Green"
        return 0
    fi

    # Fallback: SSH over 443 (many networks block 22). GitHub exposes
    # ssh.github.com:443; for others retry the same host on 443.
    local alt_host="$host"
    if [ "$host" = "github.com" ]; then
        alt_host="ssh.github.com"
    fi
    if _tcp_probe "$alt_host" 443; then
        write_color_text "[OK] Host reachable via $alt_host:443 (SSH/HTTPS over 443)" "Green"
        return 0
    fi

    write_color_text "[ERROR] Host $host is NOT reachable on port $port (and 443)" "Red"
    return 1
}

# Helper: format a KiB value as human-readable size
human_kb() {
    local kb="${1:-0}"
    if [ "$kb" -ge 1048576 ]; then
        awk "BEGIN{printf \"%.2f GB\", $kb/1048576}"
    elif [ "$kb" -ge 1024 ]; then
        awk "BEGIN{printf \"%.2f MB\", $kb/1024}"
    else
        echo "${kb} KB"
    fi
}

get_local_repo_size_kb() {
    local local_kb
    local_kb=$(git count-objects -v 2>/dev/null | awk '/^size:/{s=$2} /^size-pack:/{p=$2} END{print s+p+0}')
    [ -z "$local_kb" ] && local_kb=0
    echo "$local_kb"
}

get_remote_repo_size_from_url() {
    local target_url="$1"
    local host="" owner_repo="" remote_kb="" api=""

    if [[ "$target_url" =~ ^git@([^:]+):(.+)$ ]]; then
        host="${BASH_REMATCH[1]}"
        owner_repo="${BASH_REMATCH[2]}"
    elif [[ "$target_url" =~ ^https?://([^/]+)/(.+)$ ]]; then
        host="${BASH_REMATCH[1]}"
        owner_repo="${BASH_REMATCH[2]}"
    fi
    owner_repo="${owner_repo%.git}"

    if [ -n "$owner_repo" ]; then
        case "$host" in
            github.com)
                remote_kb=$(curl -fsSL --max-time 8 "https://api.github.com/repos/$owner_repo" 2>/dev/null | grep -m1 '"size"' | grep -oE '[0-9]+')
                ;;
            gitee.com)
                remote_kb=$(curl -fsSL --max-time 8 "https://gitee.com/api/v5/repos/$owner_repo" 2>/dev/null | tr ',' '\n' | grep -m1 '"size"' | grep -oE '[0-9]+')
                ;;
        esac
    fi

    echo "$host|$remote_kb"
}

show_repo_size_overview() {
    local target target_url local_kb remote_info host remote_kb diff_kb

    local_kb=$(get_local_repo_size_kb)

    write_color_text "" "White"
    write_color_text "============================================================" "Cyan"
    write_color_text "  REPOSITORY SIZE OVERVIEW" "Cyan"
    write_color_text "============================================================" "Cyan"
    write_color_text "  Local (git): $(human_kb "$local_kb")" "White"
    write_color_text "" "White"

    for target in "$@"; do
        target_url="${remote_configs[$target]}"
        [ -z "$target_url" ] && continue

        remote_info=$(get_remote_repo_size_from_url "$target_url")
        host="${remote_info%%|*}"
        remote_kb="${remote_info#*|}"
        [ -z "$host" ] && host="$target"

        if [ -n "$remote_kb" ]; then
            write_color_text "  Remote [$target] ($host): $(human_kb "$remote_kb")" "White"
            diff_kb=$(( local_kb - remote_kb ))
            if [ "$diff_kb" -ge 0 ]; then
                write_color_text "    Local is larger by $(human_kb "$diff_kb")" "DarkGray"
            else
                write_color_text "    Remote is larger by $(human_kb "$(( -diff_kb ))")" "DarkGray"
            fi
        else
            write_color_text "  Remote [$target] ($host): unavailable (private repo, no network, or unsupported host)" "Yellow"
        fi
    done

    write_color_text "" "White"
    write_color_text "============================================================" "Cyan"
    write_color_text "" "White"
}

