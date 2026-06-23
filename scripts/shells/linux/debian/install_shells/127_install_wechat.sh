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

#==============================================================================
# WeChat for Linux Installation Script
#==============================================================================
# This script installs WeChat for Linux via AppImage
# - Only installs on desktop systems (skips on servers)
# - Downloads from official source or uses Downloads directory
# - Creates desktop icons, launchers, and symlinks
# - Supports re-running to fix/repair installation
#==============================================================================

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="127"

# Source common files
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/get_real_user.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_shortcut_manager.sh"

# Declare variables
APP_NAME="WeChat"
EXEC_NAME="wechat"
DOWNLOAD_URL="https://dldir1v6.qq.com/weixin/Universal/Linux/WeChatLinux_x86_64.AppImage"
APPIMAGE_DIR=$(map_web_path "compile_dir" "applications/appimages")
INSTALL_DIR="$APPIMAGE_DIR/$EXEC_NAME"
APPIMAGE_FILE="$INSTALL_DIR/${EXEC_NAME}.AppImage"
EXTRACTED_DIR="$INSTALL_DIR/extracted"
APPRUN_PATH="$EXTRACTED_DIR/squashfs-root/AppRun"
USER_BIN_DIR="$REAL_USER_HOME/.local/bin"
USER_SYMLINK="$USER_BIN_DIR/$EXEC_NAME"
USER_APPLICATIONS_DIR="$REAL_USER_HOME/.local/share/applications"
DESKTOP_FILE="$USER_APPLICATIONS_DIR/${EXEC_NAME}.desktop"

# Version tracking
APP_VERSIONS_DIR="$GLOBAL_VAR_DIR/app_versions"
VERSION_FILE="$APP_VERSIONS_DIR/wechat.version"

# Real user detection
REAL_USER=$(get_real_user)
REAL_USER_HOME=$(get_real_user_home)
REAL_USER_GROUP=$(id -gn "$REAL_USER" 2>/dev/null || echo "$REAL_USER")

# Desktop entry configuration
DESKTOP_NAME="WeChat"
DESKTOP_COMMENT="WeChat for Linux"
DESKTOP_CATEGORIES="Network;InstantMessaging;"
STARTUP_WM_CLASS="WeChat"

echo "=========================================="
echo "[$SCRIPT_INDEX] WeChat Installation"
echo "=========================================="
echo ""

# Check if desktop environment exists
if [ "$HAS_DESKTOP_ENVIRONMENT" = false ]; then
    print_info_from_common_functions "Non-desktop system detected - skipping WeChat installation"
    print_info_from_common_functions "WeChat is designed for desktop systems with GUI"
    echo ""
    print_success_from_common_functions "Skipping installation automatically"
    exit 0
fi

print_info_from_common_functions "Desktop system detected - proceeding with WeChat installation"
echo ""

# Function to get installed version
get_installed_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat "$VERSION_FILE" 2>/dev/null
    fi
}

# Function to get version from filename
# Example: "WeChatLinux_x86_64.AppImage" -> "WeChatLinux_x86_64"
get_version_from_file() {
    local filename="$1"
    local basename_file=$(basename "$filename")
    local version_string="${basename_file%.*}"

    if [ -n "$version_string" ]; then
        echo "$version_string"
        return 0
    fi
    return 1
}

# Function to save installed version
save_installed_version() {
    local version="$1"
    mkdir -p "$APP_VERSIONS_DIR"
    echo "$version" > "$VERSION_FILE"
    print_info_from_common_functions "Version saved: $version"
}

# Function to check if WeChat is installed
check_wechat_installed() {
    # Check if AppImage or AppRun exists and is executable
    if [ -f "$APPIMAGE_FILE" ] && [ -x "$APPIMAGE_FILE" ]; then
        print_info_from_common_functions "WeChat is already installed"
        return 0
    fi
    if [ -f "$APPRUN_PATH" ] && [ -x "$APPRUN_PATH" ]; then
        print_info_from_common_functions "WeChat is already installed"
        return 0
    fi
    return 1
}

# Function to fix directory permissions for real user
fix_directory_permissions() {
    local target_dir="$1"

    if [ ! -d "$target_dir" ]; then
        return 0
    fi

    print_step_from_common_functions "Fixing permissions for: $target_dir"
    print_info_from_common_functions "Setting owner to: $REAL_USER:$REAL_USER_GROUP"

    # Change ownership to real user
    $USE_SUDO chown -R "$REAL_USER:$REAL_USER_GROUP" "$target_dir" 2>/dev/null || {
        print_warning_from_common_functions "Failed to change ownership, continuing..."
    }

    # Set permissions: 755 for directories, 644 for files
    $USE_SUDO find "$target_dir" -type d -exec chmod 755 {} \; 2>/dev/null || true
    $USE_SUDO find "$target_dir" -type f -exec chmod 644 {} \; 2>/dev/null || true

    # Make AppImage and scripts executable
    if [ -f "$APPIMAGE_FILE" ]; then
        $USE_SUDO chmod 755 "$APPIMAGE_FILE"
    fi

    if [ -f "$APPRUN_PATH" ]; then
        $USE_SUDO chmod 755 "$APPRUN_PATH"
    fi

    print_success_from_common_functions "Permissions fixed"
}

# Function to install libfuse2 (required for AppImage)
install_libfuse2() {
    if ! dpkg -l | grep -q "^ii.*libfuse2"; then
        print_step_from_common_functions "Installing libfuse2 (required for AppImage)..."
        $USE_SUDO apt-get update -qq
        $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
            -o Dpkg::Options::="--force-confdef" \
            -o Dpkg::Options::="--force-confold" \
            libfuse2 || print_warning_from_common_functions "Failed to install libfuse2"
    fi
}

# Function to download WeChat AppImage
download_wechat_appimage() {
    print_step_from_common_functions "Downloading WeChat AppImage..."

    # Try to find in Downloads directory first
    local downloads_file=$(find_file_in_downloads_from_common_functions "WeChatLinux*.AppImage" "newest")

    if [[ -n "$downloads_file" ]] && [[ -f "$downloads_file" ]]; then
        print_success_from_common_functions "Found WeChat AppImage in Downloads: $downloads_file"
        $USE_SUDO cp "$downloads_file" "$APPIMAGE_FILE"
        return 0
    fi

    # Try automatic download
    print_info_from_common_functions "Attempting to download from: $DOWNLOAD_URL"
    if $USE_SUDO wget --progress=bar:force -O "$APPIMAGE_FILE" "$DOWNLOAD_URL" 2>&1; then
        print_success_from_common_functions "WeChat AppImage downloaded successfully"
        return 0
    else
        print_warning_from_common_functions "Automatic download failed"

        # Prompt user to download manually
        print_info_from_common_functions "Please download WeChat manually"

        local manual_file=$(prompt_and_wait_for_download_from_common_functions \
            "$DOWNLOAD_URL" \
            "WeChatLinux*.AppImage" \
            0)

        if [[ -z "$manual_file" ]]; then
            print_error_from_common_functions "Failed to obtain WeChat AppImage"
            return 1
        fi

        $USE_SUDO cp "$manual_file" "$APPIMAGE_FILE"
        print_success_from_common_functions "WeChat AppImage obtained from Downloads"
        return 0
    fi
}

# Function to extract AppImage
extract_appimage() {
    print_step_from_common_functions "Extracting WeChat AppImage..."

    $USE_SUDO mkdir -p "$EXTRACTED_DIR"

    # Idempotency: remove any prior extraction so --appimage-extract does not
    # merge a new WeChat version into a stale squashfs-root from a previous run.
    $USE_SUDO rm -rf "$EXTRACTED_DIR/squashfs-root"

    cd "$EXTRACTED_DIR" || return 1

    if $USE_SUDO "$APPIMAGE_FILE" --appimage-extract >/dev/null 2>&1; then
        print_success_from_common_functions "AppImage extracted successfully"
        cd - >/dev/null
        return 0
    else
        print_warning_from_common_functions "AppImage extraction failed, will use AppImage directly"
        cd - >/dev/null
        APPRUN_PATH="$APPIMAGE_FILE"
        return 0
    fi
}

# Function to fix chrome-sandbox permissions (critical for Electron apps)
fix_chrome_sandbox_permissions() {
    if [ ! -d "$EXTRACTED_DIR/squashfs-root" ]; then
        return 0
    fi

    print_step_from_common_functions "Fixing chrome-sandbox permissions..."

    local chrome_sandbox_paths=(
        "$EXTRACTED_DIR/squashfs-root/chrome-sandbox"
        "$EXTRACTED_DIR/squashfs-root/usr/lib/chrome-sandbox"
    )

    # Find chrome-sandbox in opt directories
    for sandbox_pattern in "$EXTRACTED_DIR/squashfs-root/opt/"*"/chrome-sandbox"; do
        if [ -f "$sandbox_pattern" ]; then
            chrome_sandbox_paths+=("$sandbox_pattern")
        fi
    done

    local fixed_count=0
    for sandbox_path in "${chrome_sandbox_paths[@]}"; do
        if [ -f "$sandbox_path" ]; then
            print_info_from_common_functions "Fixing: $sandbox_path"
            $USE_SUDO chown root:root "$sandbox_path" 2>/dev/null || true
            $USE_SUDO chmod 4755 "$sandbox_path" 2>/dev/null || true
            ((fixed_count++))
        fi
    done

    if [ $fixed_count -gt 0 ]; then
        print_success_from_common_functions "Fixed $fixed_count chrome-sandbox file(s)"
    fi
}

# Function to create user-level symlink (optional, for terminal access)
create_user_symlink() {
    print_step_from_common_functions "Creating user-level symlink..."

    # Ensure REAL_USER_HOME is set
    if [ -z "$REAL_USER_HOME" ] || [ ! -d "$REAL_USER_HOME" ]; then
        print_warning_from_common_functions "Real user home not found, skipping user symlink"
        return 0
    fi

    # Create user bin directory if it doesn't exist
    if [ ! -d "$USER_BIN_DIR" ]; then
        mkdir -p "$USER_BIN_DIR" 2>/dev/null || {
            print_warning_from_common_functions "Failed to create $USER_BIN_DIR, skipping user symlink"
            return 0
        }
        # Set ownership to real user
        chown "$REAL_USER:$REAL_USER_GROUP" "$USER_BIN_DIR" 2>/dev/null || true
    fi

    # Determine target executable
    local exec_target=""
    if [ -f "$APPRUN_PATH" ] && [ "$APPRUN_PATH" != "$APPIMAGE_FILE" ]; then
        exec_target="$APPRUN_PATH"
    else
        exec_target="$APPIMAGE_FILE"
    fi

    # Create symlink
    ln -sf "$exec_target" "$USER_SYMLINK" 2>/dev/null || {
        print_warning_from_common_functions "Failed to create user symlink, but installation can continue"
        return 0
    }

    # Set ownership to real user
    chown -h "$REAL_USER:$REAL_USER_GROUP" "$USER_SYMLINK" 2>/dev/null || true

    print_success_from_common_functions "User symlink created: $USER_SYMLINK"
    print_info_from_common_functions "You can run 'wechat' from terminal (after adding ~/.local/bin to PATH)"
}

# Function to find icon
find_icon() {
    local icon_path="$EXEC_NAME"

    if [ -d "$EXTRACTED_DIR/squashfs-root" ]; then
        # Try to find icon in multiple common locations
        local found_icon=$(find "$EXTRACTED_DIR/squashfs-root" \
            \( -name "${EXEC_NAME}.png" -o -name "${EXEC_NAME}.svg" -o -name "icon.png" -o -name "wechat.png" -o -name "*.png" \) \
            -type f 2>/dev/null | head -1)

        if [ -n "$found_icon" ]; then
            icon_path="$found_icon"
            print_info_from_common_functions "Using icon: $icon_path"
        fi
    fi

    echo "$icon_path"
}

# Function to clean up old desktop entries (both root and non-root directories)
cleanup_old_desktop_entries() {
    print_step_from_common_functions "Cleaning up old WeChat desktop entries..."

    local desktop_files_removed=0
    local search_paths=(
        "/usr/share/applications"
        "/usr/local/share/applications"
    )

    # Add user directories (both current user and real user)
    if [ -n "$REAL_USER_HOME" ] && [ -d "$REAL_USER_HOME" ]; then
        search_paths+=("$REAL_USER_HOME/.local/share/applications")
    fi

    if [ -n "$HOME" ] && [ "$HOME" != "$REAL_USER_HOME" ]; then
        search_paths+=("$HOME/.local/share/applications")
    fi

    # Add root's home directory
    if [ -d "/root/.local/share/applications" ]; then
        search_paths+=("/root/.local/share/applications")
    fi

    # Find and remove all WeChat desktop files
    for search_path in "${search_paths[@]}"; do
        if [ ! -d "$search_path" ]; then
            continue
        fi

        # Find all wechat desktop files (including core_node_ prefixed ones)
        local desktop_files=()
        while IFS= read -r -d '' desktop_file; do
            desktop_files+=("$desktop_file")
        done < <(find "$search_path" -maxdepth 1 \( -name "*wechat*.desktop" -o -name "*WeChat*.desktop" \) -type f -print0 2>/dev/null)

        # Remove each desktop file
        for desktop_file in "${desktop_files[@]}"; do
            print_info_from_common_functions "Removing old desktop entry: $desktop_file"
            if [ -w "$desktop_file" ]; then
                rm -f "$desktop_file" 2>/dev/null && ((desktop_files_removed++))
            else
                $USE_SUDO rm -f "$desktop_file" 2>/dev/null && ((desktop_files_removed++))
            fi
        done
    done

    if [ $desktop_files_removed -gt 0 ]; then
        print_success_from_common_functions "Removed $desktop_files_removed old desktop entry/entries"
    else
        print_info_from_common_functions "No old desktop entries found"
    fi

    # Update desktop database
    if command -v update-desktop-database >/dev/null 2>&1; then
        for search_path in "${search_paths[@]}"; do
            if [ -d "$search_path" ]; then
                if [ -w "$search_path" ]; then
                    update-desktop-database "$search_path" 2>/dev/null || true
                else
                    $USE_SUDO update-desktop-database "$search_path" 2>/dev/null || true
                fi
            fi
        done
        print_info_from_common_functions "Desktop database updated"
    fi
}

# Function to create desktop entry
create_desktop_entry() {
    # Clean up old desktop entries first
    cleanup_old_desktop_entries

    print_step_from_common_functions "Creating desktop entry via desktop_shortcut_manager..."

    local icon_path=$(find_icon)

    # Determine exec target
    local exec_target=""
    if [ -f "$APPRUN_PATH" ] && [ "$APPRUN_PATH" != "$APPIMAGE_FILE" ]; then
        exec_target="$APPRUN_PATH"
    else
        exec_target="$APPIMAGE_FILE"
    fi

    # Write a single system-wide menu entry (/usr/share/applications -> all users,
    # all desktop environments) plus an executable+trusted icon on every desktop.
    create_desktop_shortcut_from_desktop_shortcut_manager \
        --id "$EXEC_NAME" \
        --name "$DESKTOP_NAME" \
        --exec "$exec_target" \
        --icon "$icon_path" \
        --comment "$DESKTOP_COMMENT" \
        --generic "$DESKTOP_NAME" \
        --categories "$DESKTOP_CATEGORIES" \
        --keywords "wechat;weixin;chat;messaging;" \
        --startup-wmclass "$STARTUP_WM_CLASS" \
        --extra "StartupNotify=true" \
        --desktop all

    print_success_from_common_functions "Desktop entry created via desktop_shortcut_manager"
}

# Function to repair installation (fix icons, links, etc.)
repair_installation() {
    print_step_from_common_functions "Repairing WeChat installation..."

    # Recreate user symlink if missing or broken
    if [ ! -L "$USER_SYMLINK" ] || [ ! -e "$USER_SYMLINK" ]; then
        create_user_symlink
    fi

    # Recreate/update desktop entry
    create_desktop_entry

    # Fix permissions
    fix_chrome_sandbox_permissions

    print_success_from_common_functions "Installation repaired successfully"
}

# Main installation logic
main() {
    print_step_from_common_functions "Starting WeChat installation process..."
    echo ""

    print_info_from_common_functions "Real user detected: $REAL_USER"
    print_info_from_common_functions "Real user home: $REAL_USER_HOME"
    echo ""

    # Check if already installed and get version
    local is_installed=false
    local installed_version=""

    if check_wechat_installed; then
        is_installed=true
        installed_version=$(get_installed_version)

        if [ -n "$installed_version" ]; then
            print_info_from_common_functions "WeChat is already installed"
            print_info_from_common_functions "Installed version: $installed_version"
        else
            print_info_from_common_functions "WeChat is already installed (version unknown)"
        fi

        # Ask user if they want to update
        echo ""
        print_step_from_common_functions "Do you want to update/repair WeChat installation? (Y/n)"
        read -r -p "Update? [Y/n]: " response
        response=${response:-Y}

        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            print_info_from_common_functions "Skipping update/repair"

            # Still fix permissions
            print_step_from_common_functions "Fixing permissions for existing installation..."
            fix_directory_permissions "$INSTALL_DIR"

            echo ""
            print_success_from_common_functions "WeChat installation verified"
            exit 0
        fi

        print_info_from_common_functions "Proceeding with update/repair..."
        echo ""
    fi

    # Install dependencies
    install_libfuse2

    # Create directory structure
    $USE_SUDO mkdir -p "$INSTALL_DIR"
    $USE_SUDO mkdir -p "$EXTRACTED_DIR"

    # Download or use existing AppImage
    if [ ! -f "$APPIMAGE_FILE" ] || [ ! -s "$APPIMAGE_FILE" ]; then
        if ! download_wechat_appimage; then
            print_error_from_common_functions "Failed to download WeChat AppImage"
            exit 1
        fi
    else
        print_info_from_common_functions "Using existing AppImage: $APPIMAGE_FILE"
    fi

    # Make executable
    $USE_SUDO chmod +x "$APPIMAGE_FILE"

    # Extract AppImage
    extract_appimage

    # Fix permissions
    fix_chrome_sandbox_permissions

    # Create user-level symlink (optional)
    create_user_symlink

    # Create desktop entry
    create_desktop_entry

    # Fix all permissions for real user
    print_step_from_common_functions "Fixing final permissions..."
    fix_directory_permissions "$INSTALL_DIR"

    # Save installed version
    local new_version=$(get_version_from_file "$APPIMAGE_FILE")
    if [ -n "$new_version" ]; then
        save_installed_version "$new_version"
    else
        # Fallback: use timestamp as version
        save_installed_version "$(date +%Y%m%d-%H%M%S)"
    fi

    echo ""
    print_success_from_common_functions "=========================================="
    print_success_from_common_functions "WeChat Installation Completed Successfully"
    print_success_from_common_functions "=========================================="
    echo ""
    print_info_from_common_functions "Installation Details:"
    print_info_from_common_functions "  AppImage: $APPIMAGE_FILE"
    if [ -f "$APPRUN_PATH" ] && [ "$APPRUN_PATH" != "$APPIMAGE_FILE" ]; then
        print_info_from_common_functions "  AppRun: $APPRUN_PATH"
    fi
    if [ -L "$USER_SYMLINK" ]; then
        print_info_from_common_functions "  User symlink: $USER_SYMLINK"
    fi
    print_info_from_common_functions "  Desktop entry: $DESKTOP_FILE"
    print_info_from_common_functions "  Owner: $REAL_USER:$REAL_USER_GROUP (non-root)"
    if [ -n "$new_version" ]; then
        print_info_from_common_functions "  Version: $new_version"
    fi
    echo ""
    print_info_from_common_functions "You can now launch WeChat from:"
    print_info_from_common_functions "  - Application menu"
    if [ -L "$USER_SYMLINK" ]; then
        print_info_from_common_functions "  - Terminal: wechat (if ~/.local/bin is in PATH)"
    fi
    echo ""
}

# Run main function
main
