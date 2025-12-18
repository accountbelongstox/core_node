#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For Bash scripts: Use absolute paths resolved from script location. Declare all variables at beginning.
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Desktop Entry Manager for Core Node Scripts
# This script scans ./scripts directory and creates desktop entries
# with temporary launch scripts that support sudo execution

# Variable Declarations
SCRIPT_PATH="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_PATH/../../../../.." && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"
LAUNCH_DIR="/var/_core_node/scripts_launch_dir"

# Determine correct user home directory
# Priority: 1) SUDO_USER 2) Current USER 3) Intelligent detection
detect_desktop_user() {
    local detected_user=""
    local detected_home=""
    
    # List of system/service users to exclude
    local excluded_users=(
        "git" "nginx" "www-data" "mysql" "postgres" "redis" "mongodb"
        "docker" "systemd-network" "systemd-resolve" "systemd-timesync"
        "_apt" "backup" "bin" "daemon" "games" "gnats" "irc" "list"
        "lp" "mail" "man" "news" "proxy" "sync" "sys" "uucp"
        "sshd" "postfix" "ftp" "nobody" "nogroup"
    )
    
    # Check if user is excluded
    is_excluded_user() {
        local check_user="$1"
        for excluded in "${excluded_users[@]}"; do
            if [[ "$check_user" == "$excluded" ]]; then
                return 0
            fi
        done
        return 1
    }
    
    # Check if user directory looks like a real desktop user
    # Returns score: higher is better (0-100)
    get_user_desktop_score() {
        local user_home="$1"
        local score=0
        
        # Check for common user directories
        [[ -d "$user_home/Documents" ]] && score=$((score + 15))
        [[ -d "$user_home/Downloads" ]] && score=$((score + 15))
        [[ -d "$user_home/Pictures" ]] && score=$((score + 10))
        [[ -d "$user_home/Music" ]] && score=$((score + 10))
        [[ -d "$user_home/Videos" ]] && score=$((score + 10))
        [[ -d "$user_home/Desktop" ]] && score=$((score + 15))
        
        # Check for desktop environment configs
        [[ -d "$user_home/.config" ]] && score=$((score + 5))
        [[ -d "$user_home/.local/share/applications" ]] && score=$((score + 10))
        [[ -d "$user_home/.config/autostart" ]] && score=$((score + 5))
        
        # Check if directory is accessible (can read)
        if [[ -r "$user_home" ]]; then
            score=$((score + 5))
        else
            # Penalize if not readable even with root
            score=$((score - 20))
        fi
        
        echo "$score"
    }
    
    # Try SUDO_USER first (if not root and not excluded)
    if [[ -n "${SUDO_USER:-}" ]] && [[ "$SUDO_USER" != "root" ]]; then
        if ! is_excluded_user "$SUDO_USER"; then
            detected_user="$SUDO_USER"
            detected_home="$(getent passwd "$detected_user" 2>/dev/null | cut -d: -f6)"
            if [[ -n "$detected_home" ]] && [[ -d "$detected_home" ]]; then
                echo "$detected_user:$detected_home"
                return 0
            fi
        fi
    fi
    
    # Try current USER if not root and not excluded
    if [[ "$USER" != "root" ]] && ! is_excluded_user "$USER"; then
        detected_user="$USER"
        detected_home="$(getent passwd "$detected_user" 2>/dev/null | cut -d: -f6)"
        if [[ -n "$detected_home" ]] && [[ -d "$detected_home" ]]; then
            echo "$detected_user:$detected_home"
            return 0
        fi
    fi
    
    # Intelligent detection: find real desktop user
    # Priority: ubuntu > users with desktop session > users with UID >= 1000
    local preferred_users=("ubuntu")
    
    # Check preferred users first
    for pref_user in "${preferred_users[@]}"; do
        if [[ -d "/home/$pref_user" ]] && ! is_excluded_user "$pref_user"; then
            echo "$pref_user:/home/$pref_user"
            return 0
        fi
    done
    
    # Find users with active desktop session (X11 or Wayland)
    for user_home in /home/*; do
        if [[ -d "$user_home" ]]; then
            detected_user="$(basename "$user_home")"
            
            # Skip excluded users
            if is_excluded_user "$detected_user"; then
                continue
            fi
            
            # Check for desktop session indicators
            if [[ -n "$(pgrep -u "$detected_user" -x gnome-shell 2>/dev/null)" ]] || \
               [[ -n "$(pgrep -u "$detected_user" -x plasma 2>/dev/null)" ]] || \
               [[ -n "$(pgrep -u "$detected_user" -x xfce4-session 2>/dev/null)" ]] || \
               [[ -d "$user_home/.config/autostart" ]] || \
               [[ -d "$user_home/.local/share/applications" ]]; then
                echo "$detected_user:$user_home"
                return 0
            fi
        fi
    done
    
    # Find best normal user (UID >= 1000 and < 60000, not excluded)
    # Use scoring system to find the most "desktop-like" user
    local best_user=""
    local best_home=""
    local best_score=0
    
    for user_home in /home/*; do
        if [[ -d "$user_home" ]]; then
            detected_user="$(basename "$user_home")"
            
            # Skip excluded users
            if is_excluded_user "$detected_user"; then
                continue
            fi
            
            local user_uid="$(id -u "$detected_user" 2>/dev/null || echo 0)"
            if [[ $user_uid -ge 1000 ]] && [[ $user_uid -lt 60000 ]]; then
                local score=$(get_user_desktop_score "$user_home")
                
                if [[ $score -gt $best_score ]]; then
                    best_score=$score
                    best_user="$detected_user"
                    best_home="$user_home"
                fi
            fi
        fi
    done
    
    if [[ -n "$best_user" ]] && [[ $best_score -gt 0 ]]; then
        echo "$best_user:$best_home"
        return 0
    fi
    
    # Fallback to any non-excluded /home user
    for user_home in /home/*; do
        if [[ -d "$user_home" ]]; then
            detected_user="$(basename "$user_home")"
            if ! is_excluded_user "$detected_user"; then
                detected_home="$user_home"
                echo "$detected_user:$detected_home"
                return 0
            fi
        fi
    done
    
    # Last resort: current user
    echo "$USER:$HOME"
}

DESKTOP_USER_INFO="$(detect_desktop_user)"
DESKTOP_USER="${DESKTOP_USER_INFO%%:*}"
DESKTOP_USER_HOME="${DESKTOP_USER_INFO##*:}"
DESKTOP_DIR="$DESKTOP_USER_HOME/.local/share/applications"
DESKTOP_FALLBACK="$DESKTOP_USER_HOME/Desktop"
CONFIG_FILE="$ROOT_DIR/.desktop_entries_config"

# Debug: Show detected user (only in verbose mode or when DESKTOP_ENTRY_DEBUG is set)
if [[ "${DESKTOP_ENTRY_DEBUG:-}" == "1" ]]; then
    echo -e "${COLOR_GRAY}[DEBUG] Detected desktop user: $DESKTOP_USER ($DESKTOP_USER_HOME)${COLOR_RESET}" >&2
    
    # Show all users and their scores
    echo -e "${COLOR_GRAY}[DEBUG] User detection scores:${COLOR_RESET}" >&2
    for user_home in /home/*; do
        if [[ -d "$user_home" ]]; then
            local debug_user="$(basename "$user_home")"
            local debug_score=$(detect_desktop_user | grep -q "$debug_user" && echo "selected" || \
                              (source /dev/stdin <<< "$(declare -f get_user_desktop_score); get_user_desktop_score '$user_home'"))
            echo -e "${COLOR_GRAY}  - $debug_user: score=$debug_score${COLOR_RESET}" >&2
        fi
    done
fi

# Script types to scan
SCRIPT_EXTENSIONS=("sh" "py" "js")
SCRIPT_PATTERNS=("*.sh" "*.py" "*.js" "*.bash")

# Color codes for output
COLOR_RESET="\033[0m"
COLOR_RED="\033[31m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"
COLOR_CYAN="\033[36m"
COLOR_GRAY="\033[90m"

# Display banner
display_banner() {
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}Desktop Entry Manager${COLOR_RESET}"
    echo -e "${COLOR_CYAN}Core Node Script Launcher${COLOR_RESET}"
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo ""
}

# Check if running with appropriate permissions
check_permissions() {
    echo -e "${COLOR_GRAY}[INFO] Checking permissions...${COLOR_RESET}"

    # Use sudo only if not root
    local USE_SUDO=""
    if [[ "$EUID" -ne 0 ]]; then
        USE_SUDO="sudo"
    fi

    if [ ! -d "$LAUNCH_DIR" ]; then
        echo -e "${COLOR_YELLOW}Launch directory does not exist: $LAUNCH_DIR${COLOR_RESET}"
        echo -e "${COLOR_YELLOW}Creating launch directory...${COLOR_RESET}"
        $USE_SUDO mkdir -p "$LAUNCH_DIR" || {
            echo -e "${COLOR_RED}[ERROR] Failed to create launch directory${COLOR_RESET}"
            exit 1
        }
        $USE_SUDO chmod 755 "$LAUNCH_DIR"
    fi

    if [ ! -w "$LAUNCH_DIR" ] && [[ "$EUID" -ne 0 ]]; then
        echo -e "${COLOR_YELLOW}Launch directory not writable, setting permissions...${COLOR_RESET}"
        $USE_SUDO chmod 755 "$LAUNCH_DIR"
        $USE_SUDO chown -R "$USER:$USER" "$LAUNCH_DIR"
    fi

    if [ ! -d "$DESKTOP_DIR" ]; then
        echo -e "${COLOR_GRAY}Creating applications directory: $DESKTOP_DIR${COLOR_RESET}"
        mkdir -p "$DESKTOP_DIR"
        # If running as root, set ownership to desktop user
        if [[ "$EUID" -eq 0 ]] && [[ -n "$DESKTOP_USER" ]] && [[ "$DESKTOP_USER" != "root" ]]; then
            chown -R "$DESKTOP_USER:$DESKTOP_USER" "$DESKTOP_DIR"
        fi
    fi

    echo -e "${COLOR_GREEN}[OK] Permissions verified${COLOR_RESET}"
    echo ""
}

# Extract script metadata from comments
extract_metadata() {
    local script_file="$1"
    local metadata_type="$2"

    case "$metadata_type" in
        "name")
            # Look for # NAME: or # @name: in first 20 lines
            grep -m 1 -iE "^#.*(@name|NAME):" "$script_file" | sed -E 's/^#.*(@name|NAME):\s*//' | xargs
            ;;
        "description")
            # Look for # DESCRIPTION: or # @desc: in first 20 lines
            grep -m 1 -iE "^#.*(@desc|DESCRIPTION):" "$script_file" | sed -E 's/^#.*(@desc|DESCRIPTION):\s*//' | xargs
            ;;
        "icon")
            # Look for # ICON: or # @icon: in first 20 lines
            grep -m 1 -iE "^#.*(@icon|ICON):" "$script_file" | sed -E 's/^#.*(@icon|ICON):\s*//' | xargs
            ;;
        "category")
            # Look for # CATEGORY: or # @category: in first 20 lines
            grep -m 1 -iE "^#.*(@category|CATEGORY):" "$script_file" | sed -E 's/^#.*(@category|CATEGORY):\s*//' | xargs
            ;;
        "sudo")
            # Check if script requires sudo
            grep -m 1 -iE "^#.*(@sudo|SUDO):\s*true" "$script_file" > /dev/null && echo "true" || echo "false"
            ;;
    esac
}

# Generate display name from filename
generate_display_name() {
    local filename="$1"
    local basename="${filename%%.*}"

    # Convert snake_case or kebab-case to Title Case
    echo "$basename" | sed -E 's/[_-]+/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1'
}

# Get default icon based on script type
get_default_icon() {
    local script_file="$1"

    case "$script_file" in
        *.sh|*.bash)
            echo "utilities-terminal"
            ;;
        *.py)
            echo "text-x-python"
            ;;
        *.js)
            echo "application-javascript"
            ;;
        *)
            echo "application-x-executable"
            ;;
    esac
}

# Create temporary launch script
create_launch_script() {
    local script_path="$1"
    local requires_sudo="$2"
    local script_name="$(basename "$script_path")"
    local clean_name="${script_name//[^a-zA-Z0-9._-]/_}"
    local launch_script="$LAUNCH_DIR/launch_${clean_name}"

    echo -e "${COLOR_GRAY}  Creating launch script: $launch_script${COLOR_RESET}" >&2

    # Use sudo only if not root
    local USE_SUDO=""
    if [[ "$EUID" -ne 0 ]]; then
        USE_SUDO="sudo"
    fi

    # Determine script interpreter
    local interpreter=""
    case "$script_path" in
        *.sh|*.bash)
            interpreter="bash"
            ;;
        *.py)
            interpreter="python3"
            ;;
        *.js)
            interpreter="node"
            ;;
        *)
            # Try to detect from shebang
            if [ -f "$script_path" ]; then
                local shebang="$(head -n 1 "$script_path")"
                if [[ "$shebang" =~ ^#! ]]; then
                    interpreter="$(echo "$shebang" | sed 's/^#!//' | awk '{print $1}')"
                else
                    interpreter="bash"
                fi
            fi
            ;;
    esac

    # Create launch script with sudo support
    if [ "$requires_sudo" = "true" ]; then
        $USE_SUDO tee "$launch_script" > /dev/null << EOF
#!/bin/bash
# Temporary launch script for: $script_name
# Created by Desktop Entry Manager

# Change to script directory
cd "$(dirname "$script_path")"

# Execute script with sudo
sudo $interpreter "$script_path" "\$@"

# Keep terminal open on error
if [ \$? -ne 0 ]; then
    echo ""
    echo "Script exited with error. Press Enter to close..."
    read
fi
EOF
    else
        $USE_SUDO tee "$launch_script" > /dev/null << EOF
#!/bin/bash
# Temporary launch script for: $script_name
# Created by Desktop Entry Manager

# Change to script directory
cd "$(dirname "$script_path")"

# Execute script
$interpreter "$script_path" "\$@"

# Keep terminal open if user wants to see output
echo ""
echo "Script completed. Press Enter to close..."
read
EOF
    fi

    # Make launch script executable
    $USE_SUDO chmod +x "$launch_script"

    echo "$launch_script"
}

# Create desktop entry
create_desktop_entry() {
    local script_path="$1"
    local launch_script="$2"
    local script_name="$(basename "$script_path")"

    # Extract metadata
    local display_name="$(extract_metadata "$script_path" "name")"
    local description="$(extract_metadata "$script_path" "description")"
    local icon="$(extract_metadata "$script_path" "icon")"
    local category="$(extract_metadata "$script_path" "category")"
    local requires_sudo="$(extract_metadata "$script_path" "sudo")"

    # Use defaults if metadata not found
    [ -z "$display_name" ] && display_name="$(generate_display_name "$script_name")"
    [ -z "$description" ] && description="Launch $script_name"
    [ -z "$icon" ] && icon="$(get_default_icon "$script_path")"
    [ -z "$category" ] && category="Development"

    # Note: Don't add (sudo) suffix to display name anymore
    # The desktop entry will use pkexec for elevation

    # Create clean desktop entry filename
    local clean_name="${script_name//[^a-zA-Z0-9._-]/_}"
    local desktop_file="$DESKTOP_DIR/core_node_${clean_name}.desktop"

    echo -e "${COLOR_GRAY}  Creating desktop entry: $desktop_file${COLOR_RESET}"

    # Determine execution command
    # For scripts with SUDO=true, they should handle pkexec themselves
    # Desktop entry will execute the script directly
    local exec_cmd="$script_path"
    local terminal_needed="false"
    
    # Scripts with SUDO=true should use pkexec internally
    # No need for terminal unless explicitly needed
    
    # Create desktop entry
    cat > "$desktop_file" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$display_name
Comment=$description
Exec=$exec_cmd
Path=$(dirname "$script_path")
Icon=$icon
Terminal=$terminal_needed
Categories=$category;CoreNode;
Keywords=corenode;script;$script_name;
StartupNotify=false
EOF

    # Make desktop entry executable
    chmod +x "$desktop_file"

    echo -e "${COLOR_GREEN}  ï¿?Created: $display_name${COLOR_RESET}"
}

# Scan scripts directory
scan_scripts() {
    echo -e "${COLOR_CYAN}Scanning scripts directory: $SCRIPTS_DIR${COLOR_RESET}"
    echo ""

    if [ ! -d "$SCRIPTS_DIR" ]; then
        echo -e "${COLOR_RED}[ERROR] Scripts directory not found: $SCRIPTS_DIR${COLOR_RESET}"
        exit 1
    fi

    local count=0

    # Find all executable scripts in scripts root directory only (not recursive)
    while IFS= read -r -d '' script_file; do
        # Skip non-executable files
        [ ! -x "$script_file" ] && continue

        # Skip hidden files and directories
        [[ "$(basename "$script_file")" =~ ^\. ]] && continue

        # Skip files in node_modules, .git, etc.
        [[ "$script_file" =~ (node_modules|\.git|__pycache__|\.venv|venv) ]] && continue

        local script_name="$(basename "$script_file")"
        local relative_path="${script_file#$SCRIPTS_DIR/}"

        # Only process scripts with NAME metadata (indicating they are launchers)
        local display_name="$(extract_metadata "$script_file" "name")"
        if [[ -z "$display_name" ]]; then
            echo -e "${COLOR_GRAY}Skipping $relative_path (no NAME metadata)${COLOR_RESET}" >&2
            continue
        fi

        echo -e "${COLOR_CYAN}Processing: $relative_path${COLOR_RESET}" >&2

        # Check if requires sudo
        local requires_sudo="$(extract_metadata "$script_file" "sudo")"

        # Create launch script
        local launch_script="$(create_launch_script "$script_file" "$requires_sudo")"

        # Create desktop entry
        create_desktop_entry "$script_file" "$launch_script"

        count=$((count + 1))
        echo "" >&2
    done < <(find "$SCRIPTS_DIR" -maxdepth 1 -type f \( -name "*.sh" -o -name "*.py" -o -name "*.js" -o -name "*.bash" \) -print0)

    echo -e "${COLOR_GREEN}========================================${COLOR_RESET}"
    echo -e "${COLOR_GREEN}Created $count desktop entries${COLOR_RESET}"
    echo -e "${COLOR_GREEN}========================================${COLOR_RESET}"
    echo ""
}

# Clean up old entries
cleanup_old_entries() {
    echo -e "${COLOR_YELLOW}Cleaning up old desktop entries...${COLOR_RESET}"

    # Use sudo only if not root
    local USE_SUDO=""
    if [[ "$EUID" -ne 0 ]]; then
        USE_SUDO="sudo"
    fi

    # Remove old desktop entries
    local removed=0
    for desktop_file in "$DESKTOP_DIR"/core_node_*.desktop; do
        [ ! -f "$desktop_file" ] && continue
        rm -f "$desktop_file"
        removed=$((removed + 1))
    done

    # Clean up launch scripts
    if [ -d "$LAUNCH_DIR" ]; then
        $USE_SUDO rm -rf "$LAUNCH_DIR"/*
    fi

    echo -e "${COLOR_GREEN}Removed $removed old entries${COLOR_RESET}"
    echo ""
}

# Create desktop shortcut for this manager
create_manager_shortcut() {
    echo -e "${COLOR_CYAN}Creating desktop entry manager shortcut...${COLOR_RESET}"

    local manager_desktop="$DESKTOP_DIR/core_node_desktop_manager.desktop"

    cat > "$manager_desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Core Node Desktop Manager
Comment=Manage Core Node script desktop entries
Exec=bash "$SCRIPT_PATH/desktop_entry_manager.sh"
Path=$SCRIPT_PATH
Icon=preferences-desktop
Terminal=true
Categories=Settings;System;
Keywords=desktop;launcher;manager;
StartupNotify=false
EOF

    chmod +x "$manager_desktop"

    echo -e "${COLOR_GREEN}ï¿?Desktop manager shortcut created${COLOR_RESET}"
    echo ""
}

# Create desktop entry for a specific script
create_entry_for_script() {
    local script_path="$1"
    
    if [[ ! -f "$script_path" ]]; then
        echo -e "${COLOR_RED}[ERROR] Script not found: $script_path${COLOR_RESET}" >&2
        return 1
    fi
    
    if [[ ! -x "$script_path" ]]; then
        echo -e "${COLOR_RED}[ERROR] Script is not executable: $script_path${COLOR_RESET}" >&2
        return 1
    fi
    
    local script_name="$(basename "$script_path")"
    local display_name="$(extract_metadata "$script_path" "name")"
    
    if [[ -z "$display_name" ]]; then
        echo -e "${COLOR_YELLOW}[WARNING] Script has no NAME metadata: $script_path${COLOR_RESET}" >&2
        echo -e "${COLOR_YELLOW}Add '# NAME: Your App Name' to the script to create a desktop entry${COLOR_RESET}" >&2
        return 1
    fi
    
    echo -e "${COLOR_CYAN}Creating desktop entry for: $script_name${COLOR_RESET}" >&2
    
    local requires_sudo="$(extract_metadata "$script_path" "sudo")"
    local launch_script="$(create_launch_script "$script_path" "$requires_sudo")"
    
    create_desktop_entry "$script_path" "$launch_script"
    
    echo -e "${COLOR_GREEN}Desktop entry created successfully${COLOR_RESET}" >&2
    return 0
}

# Intelligent icon finder - searches common locations for application icons
find_app_icon() {
    local app_name="$1"
    local app_display_name="$2"
    local provided_icon="$3"
    
    # If icon is provided and exists, use it
    if [[ -n "$provided_icon" ]] && [[ -f "$provided_icon" ]]; then
        echo "$provided_icon"
        return 0
    fi
    
    # If provided icon is just a name (no path), search for it
    if [[ -n "$provided_icon" ]] && [[ "$provided_icon" != *"/"* ]]; then
        # Search in common icon directories
        local icon_search_paths=(
            "/usr/share/pixmaps/${provided_icon}.png"
            "/usr/share/pixmaps/${provided_icon}.svg"
            "/usr/share/pixmaps/${provided_icon}"
            "/usr/share/icons/hicolor/*/apps/${provided_icon}.png"
            "/usr/share/icons/hicolor/*/apps/${provided_icon}.svg"
            "~/.local/share/icons/hicolor/*/apps/${provided_icon}.png"
            "~/.local/share/icons/hicolor/*/apps/${provided_icon}.svg"
        )
        
        for icon_pattern in "${icon_search_paths[@]}"; do
            # Expand wildcards
            for icon_path in $icon_pattern; do
                if [[ -f "$icon_path" ]]; then
                    echo "$icon_path"
                    return 0
                fi
            done
        done
    fi
    
    # Try searching by app_name
    local search_names=("$app_name" "${app_name,,}" "${app_name^^}")
    
    # Add common variants
    case "$app_name" in
        vscode|code)
            search_names+=("vscode" "code" "visual-studio-code" "com.visualstudio.code")
            ;;
        cursor)
            search_names+=("cursor" "cursor-editor")
            ;;
        wechat)
            search_names+=("wechat" "weixin" "com.tencent.wechat")
            ;;
    esac
    
    # Search in common icon directories
    local icon_dirs=(
        "/usr/share/pixmaps"
        "/usr/share/icons/hicolor/48x48/apps"
        "/usr/share/icons/hicolor/64x64/apps"
        "/usr/share/icons/hicolor/128x128/apps"
        "/usr/share/icons/hicolor/256x256/apps"
        "/usr/share/icons/hicolor/scalable/apps"
        "$HOME/.local/share/icons/hicolor/48x48/apps"
        "$HOME/.local/share/icons/hicolor/64x64/apps"
        "$HOME/.local/share/icons/hicolor/128x128/apps"
        "$HOME/.local/share/icons/hicolor/scalable/apps"
    )
    
    # Try each search name
    for search_name in "${search_names[@]}"; do
        for icon_dir in "${icon_dirs[@]}"; do
            if [[ ! -d "$icon_dir" ]]; then
                continue
            fi
            
            # Search for png, svg files
            for ext in png svg; do
                local icon_file="$icon_dir/${search_name}.$ext"
                if [[ -f "$icon_file" ]]; then
                    echo "$icon_file"
                    return 0
                fi
            done
        done
    done
    
    # Try finding icon in application-specific directories
    local app_specific_dirs=(
        "/opt/${app_name}"
        "/opt/${app_name,,}"
        "/usr/share/${app_name}"
        "/usr/share/${app_name,,}"
        "$HOME/.local/share/${app_name}"
    )
    
    for app_dir in "${app_specific_dirs[@]}"; do
        if [[ -d "$app_dir" ]]; then
            # Find any icon file in the directory
            local found_icon=$(find "$app_dir" -type f \( -name "*.png" -o -name "*.svg" \) 2>/dev/null | head -1)
            if [[ -n "$found_icon" ]]; then
                echo "$found_icon"
                return 0
            fi
        fi
    done
    
    # Last resort: use app_name as symbolic icon name (let desktop environment resolve it)
    echo "${app_name,,}"
    return 0
}

# Extract original binary from launcher script (prevent recursion)
extract_original_binary() {
    local binary_path="$1"

    # Check if this is a launcher script created by desktop_entry_manager
    if [[ ! -f "$binary_path" ]]; then
        echo "$binary_path"
        return 0
    fi

    # Check if it's a launcher script (signature comment check)
    if ! grep -q "# Created by Desktop Entry Manager" "$binary_path" 2>/dev/null; then
        # Not a launcher script, return as-is
        echo "$binary_path"
        return 0
    fi

    # It's a launcher script - extract the original binary
    # Look for the exec line with the actual binary path
    local original_binary=""

    # Pattern 1: pkexec mode - look for binary path on the last non-comment line with content
    # The launcher script has the binary path as the first argument after environment variables
    original_binary=$(grep -E '^\s+[^#]*\s+\S+\s+' "$binary_path" | tail -1 | awk '{print $1}')

    # Pattern 2: normal mode - look for exec line
    if [[ -z "$original_binary" ]]; then
        original_binary=$(grep -E '^exec\s+' "$binary_path" | head -1 | awk '{print $2}')
    fi

    # If extraction failed or is still pointing to launcher dir, return original
    if [[ -z "$original_binary" ]] || [[ "$original_binary" == *"$LAUNCH_DIR"* ]]; then
        echo "$binary_path"
        return 0
    fi

    # Verify the extracted binary exists and is executable
    if [[ -x "$original_binary" ]]; then
        echo -e "${COLOR_YELLOW}  [RECURSION PREVENTION] Detected launcher script, using original binary: $original_binary${COLOR_RESET}" >&2
        echo "$original_binary"
        return 0
    fi

    # Fallback to original if extraction didn't work
    echo "$binary_path"
    return 0
}

# Create desktop entry for an installed application (called by install scripts)
create_entry_for_app() {
    local app_name="$1"
    local app_display_name="$2"
    local app_binary="$3"
    local app_icon="$4"
    local app_category="${5:-Development}"
    local app_description="${6:-Launch $app_display_name}"
    local app_wm_class="${7:-}"
    local app_userdata_dir="${8:-}"
    local use_root_mode="${9:-true}"  # Default to root mode for backward compatibility

    if [[ -z "$app_name" ]] || [[ -z "$app_display_name" ]] || [[ -z "$app_binary" ]]; then
        echo -e "${COLOR_RED}[ERROR] Missing required parameters${COLOR_RESET}" >&2
        echo "Usage: --create-app <name> <display_name> <binary> <icon> [category] [description] [wm_class] [userdata_dir] [use_root_mode]" >&2
        return 1
    fi

    if [[ ! -x "$app_binary" ]]; then
        echo -e "${COLOR_RED}[ERROR] Binary not found or not executable: $app_binary${COLOR_RESET}" >&2
        return 1
    fi

    # RECURSION PREVENTION: Extract original binary if app_binary is already a launcher
    app_binary=$(extract_original_binary "$app_binary")
    
    # Intelligent icon finding
    echo -e "${COLOR_GRAY}  Searching for icon...${COLOR_RESET}" >&2
    app_icon=$(find_app_icon "$app_name" "$app_display_name" "$app_icon")
    echo -e "${COLOR_GRAY}  Using icon: $app_icon${COLOR_RESET}" >&2
    
    echo -e "${COLOR_CYAN}Creating desktop entry for: $app_display_name${COLOR_RESET}" >&2
    
    # Create launcher script
    local launcher_name="${app_name}_launcher.sh"
    local launch_script="$LAUNCH_DIR/$launcher_name"
    
    echo -e "${COLOR_GRAY}  Creating launch script: $launch_script${COLOR_RESET}" >&2

    # Build launch command arguments
    local app_args="--no-sandbox"
    if [[ -n "$app_userdata_dir" ]]; then
        echo -e "${COLOR_GRAY}  Using user data directory: $app_userdata_dir${COLOR_RESET}" >&2
        app_args="$app_args --user-data-dir=\"$app_userdata_dir\""
    fi

    # Use sudo only if not root
    local USE_SUDO=""
    if [[ "$EUID" -ne 0 ]]; then
        USE_SUDO="sudo"
    fi

    # Generate launcher based on root mode
    if [[ "$use_root_mode" == "true" ]]; then
        # Root mode: Use pkexec with preserved environment
        $USE_SUDO tee "$launch_script" > /dev/null << 'EOF'
#!/bin/bash
# Launcher for: $app_display_name
# Created by Desktop Entry Manager
# Mode: Root (pkexec)

# Preserve current user's environment
SAVED_USER="${SUDO_USER:-$USER}"
SAVED_HOME="$(getent passwd "$SAVED_USER" 2>/dev/null | cut -d: -f6)"
[[ -z "$SAVED_HOME" ]] && SAVED_HOME="$HOME"

# Preserve display environment for GUI
SAVED_DISPLAY="${DISPLAY:-:0}"
SAVED_XAUTHORITY="${XAUTHORITY:-$SAVED_HOME/.Xauthority}"
SAVED_XDG_RUNTIME_DIR="/run/user/$(id -u $SAVED_USER)"

# Launch with pkexec (root privileges) and preserve necessary environment
exec pkexec env \
    DISPLAY="$SAVED_DISPLAY" \
    XAUTHORITY="$SAVED_XAUTHORITY" \
    XDG_RUNTIME_DIR="$SAVED_XDG_RUNTIME_DIR" \
EOF

        # Append the actual command
        $USE_SUDO bash -c "cat >> '$launch_script'" << EOF
    $app_binary $app_args "\$@"
EOF
    else
        # Normal mode: Direct execution without pkexec
        $USE_SUDO tee "$launch_script" > /dev/null << 'EOF'
#!/bin/bash
# Launcher for: $app_display_name
# Created by Desktop Entry Manager
# Mode: Normal (no root)

# Launch application directly
EOF

        # Append the actual command
        $USE_SUDO bash -c "cat >> '$launch_script'" << EOF
exec $app_binary $app_args "\$@"
EOF
    fi

    $USE_SUDO chmod +x "$launch_script"
    
    # Create desktop entry
    local desktop_file="$DESKTOP_DIR/core_node_${app_name}.desktop"
    
    echo -e "${COLOR_GRAY}  Creating desktop entry: $desktop_file${COLOR_RESET}" >&2
    
    # Determine WM_CLASS if not provided
    if [[ -z "$app_wm_class" ]]; then
        case "$app_name" in
            vscode|code)
                app_wm_class="Code"
                ;;
            cursor)
                app_wm_class="Cursor"
                ;;
            *)
                # Capitalize first letter of app_name as fallback
                app_wm_class="$(echo "$app_name" | sed 's/^./\U&/')"
                ;;
        esac
    fi
    
    cat > "$desktop_file" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$app_display_name
Comment=$app_description
Exec=$launch_script
Icon=$app_icon
Terminal=false
Categories=$app_category;CoreNode;
Keywords=corenode;$app_name;
StartupNotify=true
StartupWMClass=$app_wm_class
EOF

    chmod +x "$desktop_file"

    # If running as root, fix ownership of desktop file
    if [[ "$EUID" -eq 0 ]] && [[ -n "$DESKTOP_USER" ]] && [[ "$DESKTOP_USER" != "root" ]]; then
        chown "$DESKTOP_USER:$DESKTOP_USER" "$desktop_file"
        echo -e "${COLOR_GRAY}  Set ownership to: $DESKTOP_USER${COLOR_RESET}" >&2
    fi
    
    echo -e "${COLOR_GREEN}  ï¿?Created: $app_display_name${COLOR_RESET}" >&2
    echo -e "${COLOR_GREEN}Desktop entry created successfully${COLOR_RESET}" >&2
    return 0
}

# Show usage information
show_usage() {
    echo "Usage: $0 [OPTIONS] [ARGUMENTS]"
    echo ""
    echo "Options:"
    echo "  --scan                    Scan scripts and create desktop entries (default)"
    echo "  --clean                   Remove all Core Node desktop entries"
    echo "  --refresh                 Clean and rescan"
    echo "  --create <path>           Create desktop entry for specific script"
    echo "  --create-app <params>     Create desktop entry for installed application"
    echo "  --manager                 Create shortcut for this manager"
    echo "  --help                    Show this help message"
    echo ""
    echo "Create-app parameters:"
    echo "  --create-app <name> <display_name> <binary> <icon> [category] [description] [wm_class] [userdata_dir]"
    echo ""
    echo "Examples:"
    echo "  $0                                                    # Scan and create entries"
    echo "  $0 --refresh                                          # Clean old entries and create new ones"
    echo "  $0 --create /path/to/launcher.sh                      # Create entry for specific script"
    echo "  $0 --create-app vscode \"Visual Studio Code\" /usr/bin/code vscode Development \"Code editor\" Code"
    echo "  $0 --create-app cursor \"Cursor\" /usr/bin/cursor cursor Development \"AI Code Editor\" Cursor /home/ubuntu/.config/Cursor"
    echo "  $0 --clean                                            # Remove all entries"
    echo ""
}

# Main execution
main() {
    local action="${1:-scan}"
    local script_path="${2:-}"

    case "$action" in
        --scan|scan)
            display_banner
            check_permissions
            scan_scripts
            ;;
        --clean|clean)
            display_banner
            cleanup_old_entries
            ;;
        --refresh|refresh)
            display_banner
            check_permissions
            cleanup_old_entries
            scan_scripts
            ;;
        --create|create)
            if [[ -z "$script_path" ]]; then
                echo -e "${COLOR_RED}[ERROR] Script path required for --create${COLOR_RESET}"
                echo ""
                show_usage
                exit 1
            fi
            check_permissions
            create_entry_for_script "$script_path"
            ;;
        --create-app|create-app)
            local app_name="$2"
            local app_display_name="$3"
            local app_binary="$4"
            local app_icon="$5"
            local app_category="${6:-Development}"
            local app_description="${7:-Launch $app_display_name}"
            local app_wm_class="${8:-}"
            local app_userdata_dir="${9:-}"
            local use_root_mode="${10:-true}"

            check_permissions
            create_entry_for_app "$app_name" "$app_display_name" "$app_binary" "$app_icon" "$app_category" "$app_description" "$app_wm_class" "$app_userdata_dir" "$use_root_mode"
            ;;
        --manager|manager)
            display_banner
            create_manager_shortcut
            ;;
        --help|help|-h)
            display_banner
            show_usage
            ;;
        *)
            echo -e "${COLOR_RED}Unknown option: $action${COLOR_RESET}"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Execute main with all arguments
main "$@"
