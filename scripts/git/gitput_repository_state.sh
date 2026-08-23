#!/bin/bash

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

# Function to detect platform and distribution
get_platform_info() {
    local platform=""
    local distro=""

    # Detect OS type
    if [ -f /etc/os-release ]; then
        # Linux
        platform="linux"
        # Get distribution name
        distro=$(grep "^ID=" /etc/os-release | cut -d= -f2 | tr -d '"' | tr '[:upper:]' '[:lower:]')
        # Handle common distributions
        case "$distro" in
            ubuntu|debian|centos|fedora|arch|manjaro|opensuse|alpine|rhel|rocky|alma)
                # Use as-is
                ;;
            *)
                # Default to "linux" if unknown
                distro="linux"
                ;;
        esac
    elif [ -d "/mnt/c/Windows" ] || [ -d "/mnt/c/WINDOWS" ]; then
        # WSL (Windows Subsystem for Linux)
        platform="wsl"
        distro=$(grep "^ID=" /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"' | tr '[:upper:]' '[:lower:]')
        [ -z "$distro" ] && distro="ubuntu"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        platform="macos"
        distro=$(sw_vers -productVersion 2>/dev/null | cut -d. -f1-2)
        [ -z "$distro" ] && distro="macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
        # Windows (Git Bash / MSYS / Cygwin)
        platform="windows"
        # Try to get Windows version
        if command -v wmic >/dev/null 2>&1; then
            distro=$(wmic os get Caption 2>/dev/null | grep -i windows | head -n1 | sed 's/Microsoft Windows //' | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
        fi
        [ -z "$distro" ] && distro="10"
    else
        # Unknown platform
        platform="unknown"
        distro="unknown"
    fi

    echo "${platform}-${distro}"
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

    # Default message: tool + OS + timestamp + pre-pull local-only (commit before pull).
    local platform_info=$(get_platform_info)
    local default_message="[gitput_unified] ${platform_info} @ ${TIMESTAMP} | pre-pull local-only"

    # Ask user for input (first time only). Auto-continue with the default
    # message after COMMIT_MESSAGE_TIMEOUT_SECONDS of no typing (idle), so an
    # unattended push does not block here. Each keystroke resets the idle timer
    # (active typing is never cut off); Enter submits.
    local user_input=""
    local read_char=""
    local timed_out=false
    write_color_text "Enter commit message (${COMMIT_MESSAGE_TIMEOUT_SECONDS}s timeout -> default: $default_message): " "Yellow" >&2
    # Ensure the prompt is fully displayed before accepting input
    sleep 0.1
    if [ -t 0 ]; then
        timed_out=true
        # Read one char at a time with a per-keystroke timeout = idle timeout.
        while IFS= read -rsn1 -t "$COMMIT_MESSAGE_TIMEOUT_SECONDS" read_char; do
            if [ -z "$read_char" ]; then
                # Enter pressed (newline delimiter) -> submit.
                timed_out=false
                break
            elif [ "$read_char" = $'\177' ] || [ "$read_char" = $'\b' ]; then
                if [ -n "$user_input" ]; then
                    user_input="${user_input%?}"
                    printf '\b \b' >&2
                fi
            else
                user_input="${user_input}${read_char}"
                printf '%s' "$read_char" >&2
            fi
        done
        printf '\n' >&2
    else
        # Non-interactive stdin: fall back to a single timed line read.
        if read -t "$COMMIT_MESSAGE_TIMEOUT_SECONDS" -r user_input; then
            timed_out=false
        else
            timed_out=true
            user_input=""
        fi
    fi

    if [ "$timed_out" = true ] && [ -z "$user_input" ]; then
        COMMIT_MESSAGE="$default_message"
        write_color_text "No input for ${COMMIT_MESSAGE_TIMEOUT_SECONDS}s; using default commit message: $default_message" "Cyan" >&2
    elif [ -z "$user_input" ]; then
        COMMIT_MESSAGE="$default_message"
        write_color_text "Using default commit message: $default_message" "Cyan" >&2
    else
        COMMIT_MESSAGE="$user_input"
        write_color_text "Using custom commit message: $user_input" "Green" >&2
    fi

    # Store the commit message in a file
    echo "$COMMIT_MESSAGE" > "$commit_file"

    echo "$COMMIT_MESSAGE"
}

# Default remote: GitHub first (used for execution order and restore)
get_default_remote() {
    local project_name="$1"
    echo "git@github.com:accountbelongstox/$project_name.git"
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
DESKTOP_ENV_DETECTED=true
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

