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
DESKTOP_DIR="$HOME/.local/share/applications"
DESKTOP_FALLBACK="$HOME/Desktop"
CONFIG_FILE="$ROOT_DIR/.desktop_entries_config"

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

    if [ ! -d "$LAUNCH_DIR" ]; then
        echo -e "${COLOR_YELLOW}Launch directory does not exist: $LAUNCH_DIR${COLOR_RESET}"
        echo -e "${COLOR_YELLOW}Creating launch directory (requires sudo)...${COLOR_RESET}"
        sudo mkdir -p "$LAUNCH_DIR" || {
            echo -e "${COLOR_RED}[ERROR] Failed to create launch directory${COLOR_RESET}"
            exit 1
        }
        sudo chmod 755 "$LAUNCH_DIR"
    fi

    if [ ! -w "$LAUNCH_DIR" ]; then
        echo -e "${COLOR_YELLOW}Launch directory not writable, setting permissions...${COLOR_RESET}"
        sudo chmod 755 "$LAUNCH_DIR"
        sudo chown -R "$USER:$USER" "$LAUNCH_DIR"
    fi

    if [ ! -d "$DESKTOP_DIR" ]; then
        echo -e "${COLOR_GRAY}Creating applications directory: $DESKTOP_DIR${COLOR_RESET}"
        mkdir -p "$DESKTOP_DIR"
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

    echo -e "${COLOR_GRAY}  Creating launch script: $launch_script${COLOR_RESET}"

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
        sudo tee "$launch_script" > /dev/null << EOF
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
        sudo tee "$launch_script" > /dev/null << EOF
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
    sudo chmod +x "$launch_script"

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

    # Add sudo indicator to display name if needed
    if [ "$requires_sudo" = "true" ]; then
        display_name="$display_name (sudo)"
    fi

    # Create clean desktop entry filename
    local clean_name="${script_name//[^a-zA-Z0-9._-]/_}"
    local desktop_file="$DESKTOP_DIR/core_node_${clean_name}.desktop"

    echo -e "${COLOR_GRAY}  Creating desktop entry: $desktop_file${COLOR_RESET}"

    # Create desktop entry
    cat > "$desktop_file" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$display_name
Comment=$description
Exec=$launch_script
Path=$(dirname "$script_path")
Icon=$icon
Terminal=true
Categories=$category;CoreNode;
Keywords=corenode;script;$script_name;
StartupNotify=false
EOF

    # Make desktop entry executable
    chmod +x "$desktop_file"

    echo -e "${COLOR_GREEN}  âœ?Created: $display_name${COLOR_RESET}"
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

    # Find all executable scripts
    while IFS= read -r -d '' script_file; do
        # Skip non-executable files
        [ ! -x "$script_file" ] && continue

        # Skip hidden files and directories
        [[ "$(basename "$script_file")" =~ ^\. ]] && continue

        # Skip files in node_modules, .git, etc.
        [[ "$script_file" =~ (node_modules|\.git|__pycache__|\.venv|venv) ]] && continue

        local script_name="$(basename "$script_file")"
        local relative_path="${script_file#$SCRIPTS_DIR/}"

        echo -e "${COLOR_CYAN}Processing: $relative_path${COLOR_RESET}"

        # Check if requires sudo
        local requires_sudo="$(extract_metadata "$script_file" "sudo")"

        # Create launch script
        local launch_script="$(create_launch_script "$script_file" "$requires_sudo")"

        # Create desktop entry
        create_desktop_entry "$script_file" "$launch_script"

        count=$((count + 1))
        echo ""
    done < <(find "$SCRIPTS_DIR" -type f \( -name "*.sh" -o -name "*.py" -o -name "*.js" -o -name "*.bash" \) -print0)

    echo -e "${COLOR_GREEN}========================================${COLOR_RESET}"
    echo -e "${COLOR_GREEN}Created $count desktop entries${COLOR_RESET}"
    echo -e "${COLOR_GREEN}========================================${COLOR_RESET}"
    echo ""
}

# Clean up old entries
cleanup_old_entries() {
    echo -e "${COLOR_YELLOW}Cleaning up old desktop entries...${COLOR_RESET}"

    # Remove old desktop entries
    local removed=0
    for desktop_file in "$DESKTOP_DIR"/core_node_*.desktop; do
        [ ! -f "$desktop_file" ] && continue
        rm -f "$desktop_file"
        removed=$((removed + 1))
    done

    # Clean up launch scripts
    if [ -d "$LAUNCH_DIR" ]; then
        sudo rm -rf "$LAUNCH_DIR"/*
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

    echo -e "${COLOR_GREEN}âœ?Desktop manager shortcut created${COLOR_RESET}"
    echo ""
}

# Show usage information
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --scan          Scan scripts and create desktop entries (default)"
    echo "  --clean         Remove all Core Node desktop entries"
    echo "  --refresh       Clean and rescan"
    echo "  --manager       Create shortcut for this manager"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0              # Scan and create entries"
    echo "  $0 --refresh    # Clean old entries and create new ones"
    echo "  $0 --clean      # Remove all entries"
    echo ""
}

# Main execution
main() {
    local action="${1:-scan}"

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
