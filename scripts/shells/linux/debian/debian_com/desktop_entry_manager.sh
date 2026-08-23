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
GET_REAL_USER_SCRIPT="$ROOT_DIR/scripts/shells/linux/common/get_real_user.sh"
DESKTOP_APPLICATION_ENTRY_MODULE="$SCRIPT_PATH/desktop_application_entry.sh"

source "$GET_REAL_USER_SCRIPT"
source "$DESKTOP_APPLICATION_ENTRY_MODULE"


DESKTOP_USER="$(get_real_user)"
DESKTOP_USER_HOME="$(get_real_user_home)"
DESKTOP_DIR="$DESKTOP_USER_HOME/.local/share/applications"
DESKTOP_FALLBACK="$DESKTOP_USER_HOME/Desktop"
CONFIG_FILE="$ROOT_DIR/.desktop_entries_config"

# Debug: Show the canonical detected user.
if [[ "${DESKTOP_ENTRY_DEBUG:-}" == "1" ]]; then
    echo -e "${COLOR_GRAY}[DEBUG] Detected desktop user: $DESKTOP_USER ($DESKTOP_USER_HOME)${COLOR_RESET}" >&2
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

    echo -e "${COLOR_GREEN}  Created: $display_name${COLOR_RESET}"
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

    echo -e "${COLOR_GREEN}Desktop manager shortcut created${COLOR_RESET}"
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
