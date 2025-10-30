#!/bin/bash
# Desktop Applications Installation Script
#
# Usage:
#   ./120_install_desktop_applications.sh                    # Normal installation using config flags
#   ./120_install_desktop_applications.sh DEV               # Test install DEV package group (UPPERCASE = group)
#   ./120_install_desktop_applications.sh code              # Test install apps containing "code" in name (lowercase = app)
#   ./120_install_desktop_applications.sh DEV firefox       # Test install "firefox" apps from DEV group
#   ./120_install_desktop_applications.sh --cleanup code    # Force cleanup "code" from all package managers
#
# Parameter Rules:
#   Single parameter: UPPERCASE = group match, lowercase = app name match
#   Two parameters: first = group, second = app name within that group
#   All matching is case-insensitive internally
#   Any parameters will show rules and wait for confirmation
#
# Test mode ignores installation flag files and installs matching packages directly
# Cleanup mode removes packages from snap, apt, flatpak and cleans up binaries
#
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

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

# Script identification and path setup
SCRIPT_INDEX="120"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/linux_applications_list.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/installation_library.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/super_launch_helper.sh"

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
SCRIPT_TEMP_DIR=$(create_script_temp_dir "120_install_desktop_applications")
LOG_FILE="$SCRIPT_TEMP_DIR/desktop_apps_install_$(date +%Y%m%d_%H%M%S).log"

# Track installation results globally
declare -A INSTALLATION_RESULTS  # app_name -> status (success/failed/skipped/unavailable)
SKIPPED_APPS=()                   # Apps not installed due to missing packages
FAILED_APPS=()                    # Apps that failed installation
UNAVAILABLE_APPS=()               # Apps with package_id not found in registry

# Determine environment type and get packages to install
if [ "$HAS_DESKTOP_ENVIRONMENT" = true ]; then
    ENVIRONMENT_TYPE="desktop"
elif [ "$IS_WSL" = true ]; then
    ENVIRONMENT_TYPE="wsl"
elif [ "$IS_PRODUCTION" = true ]; then
    ENVIRONMENT_TYPE="server"
else
    ENVIRONMENT_TYPE="desktop"
fi

# Logging function
log_message() {
    local message="$1"
    echo "[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

# Get AI tools installation flag
INSTALL_AI_TOOLS=$(get_var "INSTALL_AI_TOOLS" "false")

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install package via snap
install_via_snap() {
    local package_id="$1"
    local app_name="$2"
    local confinement="${3:-}"

    if ! command_exists snap; then
        log_message "Snap is not installed. Installing snapd..."
        log_message "Updating package lists with timeout..."
        if timeout 300 $USE_SUDO apt update; then
            log_message "Package lists updated successfully"
        else
            log_message "Warning: Package update timed out or failed, continuing anyway"
        fi

        log_message "Installing snapd..."
        if timeout 600 $USE_SUDO apt install -y snapd; then
            log_message "snapd installed successfully"
        else
            log_message "Error: Failed to install snapd"
            return 1
        fi

        # Enable snap services
        log_message "Enabling snap services..."
        $USE_SUDO systemctl enable --now snapd.socket || {
            log_message "Warning: Failed to enable snapd.socket"
        }
        $USE_SUDO ln -sf /var/lib/snapd/snap /snap 2>/dev/null || true
    fi

    # Build snap install command with confinement option if specified
    local snap_install_cmd="$USE_SUDO snap install"
    if [ -n "$confinement" ] && [ "$confinement" = "classic" ]; then
        snap_install_cmd="$snap_install_cmd --classic"
        log_message "Installing $app_name via snap (classic confinement): $package_id"
    else
        log_message "Installing $app_name via snap: $package_id"
    fi

    if $snap_install_cmd $package_id; then
        log_message "Successfully installed $app_name via snap"
        return 0
    else
        log_message "Failed to install $app_name via snap"
        return 1
    fi
}

# Function to install package via apt
install_via_apt() {
    local package_id="$1"
    local app_name="$2"
    
    log_message "Installing $app_name via apt: $package_id"
    log_message "Updating package lists with timeout..."
    if timeout 300 $USE_SUDO apt update; then
        log_message "Package lists updated successfully"
    else
        log_message "Warning: Package update timed out or failed, continuing anyway"
    fi
    
    log_message "Installing package with timeout..."
    if timeout 600 $USE_SUDO apt install -y "$package_id"; then
        log_message "Successfully installed $app_name via apt"
        return 0
    else
        log_message "Failed to install $app_name via apt"
        return 1
    fi
}

# Function to install package via flatpak
install_via_flatpak() {
    local package_id="$1"
    local app_name="$2"
    
    if ! command_exists flatpak; then
        log_message "Flatpak is not installed. Installing flatpak..."
        log_message "Updating package lists with timeout..."
        if timeout 300 $USE_SUDO apt update; then
            log_message "Package lists updated successfully"
        else
            log_message "Warning: Package update timed out or failed, continuing anyway"
        fi
        
        log_message "Installing flatpak..."
        if timeout 600 $USE_SUDO apt install -y flatpak; then
            log_message "flatpak installed successfully"
        else
            log_message "Error: Failed to install flatpak"
            return 1
        fi
        
        # Add flathub repository
        log_message "Adding flathub repository..."
        if timeout 120 flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo; then
            log_message "Flathub repository added successfully"
        else
            log_message "Warning: Failed to add flathub repository"
        fi
    fi
    
    log_message "Installing $app_name via flatpak: $package_id"
    if flatpak install -y flathub "$package_id"; then
        log_message "Successfully installed $app_name via flatpak"
        return 0
    else
        log_message "Failed to install $app_name via flatpak"
        return 1
    fi
}

# Function to install AppImage
install_via_appimage() {
    local download_url="$1"
    local app_name="$2"
    local exec_name="$3"
    local app_id="${4:-${exec_name}}"

    local appimage_dir=$(map_web_path "compile_dir" "applications/appimages")
    local install_dir="$appimage_dir/$exec_name"
    local appimage_file="$install_dir/${exec_name}.AppImage"
    local extracted_dir="$install_dir/extracted"
    local apprun_path="$extracted_dir/squashfs-root/AppRun"

    log_message "Installing $app_name via AppImage from: $download_url"

    # Install libfuse2 dependency (required for AppImage)
    if ! dpkg -l | grep -q "^ii.*libfuse2"; then
        log_message "Installing libfuse2 (required for AppImage)..."
        $USE_SUDO apt-get update -qq
        $USE_SUDO apt-get install -y libfuse2 2>&1 | tee -a "$LOG_FILE" || log_message "Warning: Failed to install libfuse2"
    fi

    # Create AppImage directory structure
    $USE_SUDO mkdir -p "$install_dir"
    $USE_SUDO mkdir -p "$extracted_dir"

    # Download AppImage
    if $USE_SUDO wget --progress=bar:force -O "$appimage_file" "$download_url" 2>&1 | tee -a "$LOG_FILE"; then
        log_message "AppImage downloaded successfully"
    else
        log_message "Failed to download $app_name AppImage"
        return 1
    fi

    # Make executable
    $USE_SUDO chmod +x "$appimage_file"

    # Extract AppImage to get icon, desktop file and AppRun
    log_message "Extracting AppImage..."
    cd "$extracted_dir"
    if $USE_SUDO "$appimage_file" --appimage-extract >/dev/null 2>&1; then
        log_message "AppImage extracted successfully"
    else
        log_message "Warning: AppImage extraction failed, will use AppImage directly"
        # Fall back to using AppImage directly if extraction fails
        apprun_path="$appimage_file"
    fi
    cd - >/dev/null

    # Fix chrome-sandbox permissions if it exists (critical for Electron apps)
    if [ -d "$extracted_dir/squashfs-root" ]; then
        local chrome_sandbox_paths=(
            "$extracted_dir/squashfs-root/chrome-sandbox"
            "$extracted_dir/squashfs-root/usr/lib/chrome-sandbox"
        )

        for sandbox_pattern in "$extracted_dir/squashfs-root/opt/"*"/chrome-sandbox"; do
            chrome_sandbox_paths+=("$sandbox_pattern")
        done

        for sandbox_path in "${chrome_sandbox_paths[@]}"; do
            if [ -f "$sandbox_path" ]; then
                log_message "Fixing chrome-sandbox permissions: $sandbox_path"
                $USE_SUDO chown root:root "$sandbox_path" 2>/dev/null || true
                $USE_SUDO chmod 4755 "$sandbox_path" 2>/dev/null || true
            fi
        done
    fi

    # Get app configuration from linux_applications_list.sh
    local desktop_name="${app_id}_desktop_name"
    local desktop_comment="${app_id}_desktop_comment"
    local desktop_categories="${app_id}_desktop_categories"
    local startup_wm_class="${app_id}_startup_wm_class"
    local need_super="${app_id}_super"

    # Create wrapper script
    local wrapper_script="/usr/local/super_scripts/${exec_name}.sh"
    log_message "Creating wrapper script: $wrapper_script"

    $USE_SUDO mkdir -p "/usr/local/super_scripts"

    # Determine which executable to use (AppRun or AppImage)
    local exec_target=""
    if [ -f "$apprun_path" ] && [ "$apprun_path" != "$appimage_file" ]; then
        exec_target="$apprun_path"
        log_message "Using extracted AppRun: $exec_target"
    else
        exec_target="$appimage_file"
        log_message "Using AppImage directly: $exec_target"
    fi

    if [[ "${!need_super}" == "true" ]]; then
        # Create wrapper with --no-sandbox flag (for apps needing root or sandbox bypass)
        cat << WRAPPER_EOF | $USE_SUDO tee "$wrapper_script" > /dev/null
#!/bin/bash
# ${app_name} Launcher Script (AppImage Installation)
# This script launches the app with --no-sandbox flag

EXEC_PATH="$exec_target"

if [[ ! -f "\$EXEC_PATH" ]]; then
    echo "Error: Executable not found at \$EXEC_PATH"
    echo "Please reinstall ${app_name}"
    exit 1
fi

# Launch with --no-sandbox (required for certain execution contexts)
exec "\$EXEC_PATH" --no-sandbox "\$@"
WRAPPER_EOF
    else
        # Create simple wrapper without --no-sandbox
        cat << WRAPPER_EOF | $USE_SUDO tee "$wrapper_script" > /dev/null
#!/bin/bash
# ${app_name} Launcher Script (AppImage Installation)

EXEC_PATH="$exec_target"

if [[ ! -f "\$EXEC_PATH" ]]; then
    echo "Error: Executable not found at \$EXEC_PATH"
    echo "Please reinstall ${app_name}"
    exit 1
fi

# Launch application
exec "\$EXEC_PATH" "\$@"
WRAPPER_EOF
    fi

    $USE_SUDO chmod +x "$wrapper_script"

    # Create symlink in /usr/local/bin
    $USE_SUDO ln -sf "$wrapper_script" "/usr/local/bin/$exec_name"

    # Find icon
    local icon_path="$exec_name"
    if [ -d "$extracted_dir/squashfs-root" ]; then
        # Try to find icon in multiple common locations
        local found_icon=$(find "$extracted_dir/squashfs-root" \( -name "${exec_name}.png" -o -name "${exec_name}.svg" -o -name "icon.png" -o -name "*.png" \) -type f 2>/dev/null | head -1)
        if [ -n "$found_icon" ]; then
            icon_path="$found_icon"
            log_message "Using icon: $icon_path"
        fi
    fi

    # Create desktop entry
    local desktop_file="/usr/share/applications/${exec_name}.desktop"
    log_message "Creating desktop entry: $desktop_file"

    # For desktop launcher, use direct AppImage path instead of wrapper script
    # This avoids issues with sudo in desktop environment (no terminal for password)
    local desktop_exec_path="$exec_target"

    local desktop_entry="[Desktop Entry]
Name=${!desktop_name:-$app_name}
Comment=${!desktop_comment:-$app_name}
GenericName=${!desktop_name:-$app_name}
Exec=$desktop_exec_path
Icon=$icon_path
Type=Application
Terminal=false
Categories=${!desktop_categories:-Utility;}
StartupNotify=false
StartupWMClass=${!startup_wm_class:-$app_name}
Keywords=${exec_name};
"

    echo "$desktop_entry" | $USE_SUDO tee "$desktop_file" > /dev/null
    $USE_SUDO chmod 644 "$desktop_file"

    # Update desktop database
    if command -v update-desktop-database >/dev/null 2>&1; then
        $USE_SUDO update-desktop-database /usr/share/applications/ 2>/dev/null || true
    fi

    log_message "Successfully installed $app_name"
    log_message "Launcher: /usr/local/super_scripts/${exec_name}.sh"
    log_message "Command: $exec_name"

    return 0
}

# Function to install via web download (deb packages)
install_via_web() {
    local download_url="$1"
    local app_name="$2"
    local temp_file="$SCRIPT_TEMP_DIR/$(basename "$download_url")"
    
    log_message "Installing $app_name via web download from: $download_url"
    
    # Download package
    if wget -O "$temp_file" "$download_url"; then
        # Install deb package
        if $USE_SUDO dpkg -i "$temp_file"; then
            log_message "Successfully installed $app_name from web"
            # Fix any dependency issues
            $USE_SUDO apt-get install -f -y 2>/dev/null || true
            return 0
        else
            log_message "Failed to install $app_name deb package"
            # Try to fix dependencies and retry
            $USE_SUDO apt-get install -f -y
            if $USE_SUDO dpkg -i "$temp_file"; then
                log_message "Successfully installed $app_name after fixing dependencies"
                return 0
            else
                log_message "Failed to install $app_name even after fixing dependencies"
                return 1
            fi
        fi
    else
        log_message "Failed to download $app_name package"
        return 1
    fi
}



# Function to fix npm global binary permissions
fix_npm_permissions() {
    log_message "Fixing npm global binary permissions..."
    
    # Get npm global bin directory
    local npm_global_bin
    npm_global_bin=$(npm config get prefix 2>/dev/null)
    
    if [ -n "$npm_global_bin" ] && [ -d "$npm_global_bin/bin" ]; then
        # Set executable permissions for all binaries in npm global bin directory
        $USE_SUDO find "$npm_global_bin/bin" -type f -name "*" -exec chmod +x {} \; 2>/dev/null || true
        log_message "Fixed executable permissions for all binaries in: $npm_global_bin/bin"
        
        # Count how many binaries were fixed
        local binary_count=$(find "$npm_global_bin/bin" -type f -name "*" 2>/dev/null | wc -l)
        log_message "Fixed permissions for $binary_count npm global binaries"
        
        return 0
    else
        log_message "Warning: Could not determine npm global bin directory"
        return 1
    fi
}

# Function to install via npm
install_via_npm() {
    local package_id="$1"
    local app_name="$2"
    
    if ! command_exists npm; then
        log_message "npm is not installed. Cannot install $app_name"
        return 1
    fi
    
    log_message "Installing $app_name via npm: $package_id"
    if timeout 300 npm install -g "$package_id"; then
        log_message "Successfully installed $app_name via npm"
        
        # Fix permissions for npm global binaries
        fix_npm_permissions
        
        return 0
    else
        log_message "Failed to install $app_name via npm"
        return 1
    fi
}

# Function to install via uv tool
install_via_uv_tool() {
    local package_id="$1"
    local app_name="$2"

    if ! command_exists uv; then
        log_message "uv is not installed. Cannot install $app_name"
        return 1
    fi

    log_message "Installing $app_name via uv tool: $package_id"
    if timeout 300 uv tool install "$package_id"; then
        log_message "Successfully installed $app_name via uv tool"
        return 0
    else
        log_message "Failed to install $app_name via uv tool"
        return 1
    fi
}

# Function to install via pipx
install_via_pipx() {
    local package_id="$1"
    local app_name="$2"

    if ! command_exists pipx; then
        log_message "pipx is not installed. Cannot install $app_name"
        return 1
    fi

    log_message "Installing $app_name via pipx: $package_id"
    if timeout 300 pipx install "$package_id"; then
        log_message "Successfully installed $app_name via pipx"
        return 0
    else
        log_message "Failed to install $app_name via pipx"
        return 1
    fi
}

# Function to install via curl (download and install)
install_via_curl() {
    local download_url="$1"
    local app_name="$2"
    local exec_name="$3"

    if ! command_exists curl; then
        log_message "curl is not installed. Installing curl..."
        if ! $USE_SUDO apt update && $USE_SUDO apt install -y curl; then
            log_message "Failed to install curl. Cannot install $app_name"
            return 1
        fi
    fi

    log_message "Installing $app_name via curl from: $download_url"

    # Create temporary file
    local temp_file="$SCRIPT_TEMP_DIR/${exec_name}_install_$(date +%s)"

    # Download the installation script or binary
    if curl -fsSL "$download_url" -o "$temp_file"; then
        # Make executable if it's a script
        chmod +x "$temp_file"

        # If it's an installation script, run it
        if head -n 1 "$temp_file" | grep -q "^#!"; then
            log_message "Executing installation script for $app_name"
            if bash "$temp_file"; then
                log_message "Successfully installed $app_name via curl script"
                return 0
            else
                log_message "Failed to execute installation script for $app_name"
                return 1
            fi
        else
            # If it's a binary, install it directly
            local install_path="/usr/local/bin/$exec_name"
            log_message "Installing $app_name binary to $install_path"
            if $USE_SUDO cp "$temp_file" "$install_path" && $USE_SUDO chmod +x "$install_path"; then
                log_message "Successfully installed $app_name binary via curl"
                return 0
            else
                log_message "Failed to install $app_name binary"
                return 1
            fi
        fi
    else
        log_message "Failed to download $app_name from: $download_url"
        return 1
    fi
}

# Function to create symlink to /usr/local/bin
create_symlink_usr_local_bin() {
    local exec_name="$1"
    local app_name="${2:-$exec_name}"

    # Find the binary in common locations
    local binary_path=""
    local search_paths=(
        "/usr/bin/$exec_name"
        "/usr/local/bin/$exec_name"
        "$HOME/.local/bin/$exec_name"
        "$HOME/.cargo/bin/$exec_name"
        "/opt/*/bin/$exec_name"
        "/snap/bin/$exec_name"
    )

    for path in "${search_paths[@]}"; do
        # Handle wildcard expansion for /opt/*/bin/
        if [[ "$path" == *"*"* ]]; then
            for expanded_path in $path; do
                if [ -f "$expanded_path" ] && [ -x "$expanded_path" ]; then
                    binary_path="$expanded_path"
                    break 2
                fi
            done
        elif [ -f "$path" ] && [ -x "$path" ]; then
            binary_path="$path"
            break
        fi
    done

    if [ -z "$binary_path" ]; then
        log_message "Binary for $app_name not found in common locations"
        return 1
    fi

    # Create symlink if target doesn't already exist or points elsewhere
    local target_link="/usr/local/bin/$exec_name"
    if [ -L "$target_link" ]; then
        local current_target=$(readlink "$target_link")
        if [ "$current_target" = "$binary_path" ]; then
            log_message "Symlink already exists and is correct: $target_link -> $binary_path"
            return 0
        else
            log_message "Updating existing symlink: $target_link -> $binary_path"
        fi
    fi

    log_message "Creating symlink: $target_link -> $binary_path"
    if $USE_SUDO ln -sf "$binary_path" "$target_link"; then
        log_message "Successfully created symlink for $app_name"
        return 0
    else
        log_message "Failed to create symlink for $app_name"
        return 1
    fi
}

# Function to verify application installation
verify_installation() {
    local exec_name="$1"
    local app_name="$2"
    
    if command_exists "$exec_name"; then
        log_message "$app_name is installed and available in PATH"
        return 0
    else
        log_message "$app_name is not available in PATH"
        return 1
    fi
}

# Function to install single application
install_application() {
    local app_name="$1"
    local package_group="$2"
    local display_name=""
    local exec_name=""
    local install_method=""
    local package_id=""
    local launch_command=""
    local super_command=""
    local snap_confinement=""

    # Handle MCP apps (remove mcp_ prefix for property lookup)
    local lookup_app="$app_name"
    if [[ "$app_name" == mcp_* ]]; then
        lookup_app="${app_name#mcp_}"
    fi

    # Get application properties using the unified structure
    display_name=$(get_app_property "$lookup_app" "name")
    exec_name=$(get_app_property "$lookup_app" "exec")
    install_method=$(get_install_method "$lookup_app")
    package_id=$(get_package_id "$lookup_app")
    launch_command=$(get_launch_command "$lookup_app")
    super_command=$(get_app_property "$lookup_app" "super")
    snap_confinement=$(get_snap_confinement "$lookup_app")

    # Skip if no package ID or install method
    if [ -z "$package_id" ] || [ -z "$install_method" ]; then
        log_message "Skipping $app_name - no package ID or install method"
        return 0
    fi

    log_message "Installing $display_name..."
    log_message "  Method: $install_method"
    log_message "  Package ID: $package_id"
    log_message "  Executable: $exec_name"

    # Determine if super launch should be used
    local should_use_super=false
    if [ "$package_group" = "DEV" ]; then
        # DEV_PACKAGES with _super="true" use auto-generated command
        if [ "$super_command" = "true" ]; then
            # Auto-generate: sudo $exec_name
            super_command="sudo $exec_name"
            should_use_super=true
        elif [ -n "$super_command" ] && [ "$super_command" != "" ]; then
            # If super_command has a specific value, use it
            should_use_super=true
        fi
    else
        # Other groups only use super if explicitly set (non-empty, non-null)
        if [ -n "$super_command" ] && [ "$super_command" != "" ] && [ "$super_command" != "null" ]; then
            should_use_super=true
        fi
    fi

    # Check if already installed
    if verify_installation "$exec_name" "$display_name"; then
        log_message "$display_name is already installed, skipping"

        # Setup super launch if applicable
        if [ "$should_use_super" = true ]; then
            log_message "Setting up super launch for $exec_name"
            setup_super_launch "$exec_name" "$super_command" "log_message"
        fi

        return 0
    fi

    # Handle snap packages with special confinement requirements
    if [ "$install_method" = "snap" ] && [ -n "$snap_confinement" ]; then
        log_message "  Snap Confinement: $snap_confinement"
        # Pass snap_confinement to snap installer via direct call
        if install_via_snap "$package_id" "$display_name" "$snap_confinement"; then
            local install_result=0
        else
            local install_result=$?
        fi
    # Handle AppImage packages with custom installation
    elif [ "$install_method" = "appimage" ]; then
        log_message "  Installing AppImage from: $package_id"
        # Get app configuration for desktop entry creation
        local app_id="${lookup_app}"
        if install_via_appimage "$package_id" "$display_name" "$exec_name" "$app_id"; then
            local install_result=0
            # AppImage creates its own wrapper, skip setup_super_launch
            should_use_super=false
        else
            local install_result=$?
        fi
    else
        # Use universal install function from installation library
        universal_install "$install_method" "$package_id" "$display_name" "$exec_name"
        local install_result=$?
    fi

    # Handle return codes:
    # 0 = success
    # 1 = installation failed (transient error)
    # 2 = package not found (skip permanently)
    if [ $install_result -eq 2 ]; then
        log_message "Skipping $display_name - package not found in registry"
        return 0
    fi

    # Create launch script if installation was successful and launch command exists
    if [ $install_result -eq 0 ] && [ -n "$launch_command" ]; then
        log_message "Creating launch script for $display_name"
        create_launch_script "$lookup_app"
    fi

    # Setup super launch if applicable
    if [ $install_result -eq 0 ] && [ "$should_use_super" = true ]; then
        log_message "Setting up super launch for $exec_name"
        setup_super_launch "$exec_name" "$super_command" "log_message"
    fi

    # Verify installation
    if [ $install_result -eq 0 ]; then
        if verify_installation "$exec_name" "$display_name"; then
            log_message "Successfully installed and verified $display_name"
            return 0
        else
            log_message "Installation completed but verification failed for $display_name"
            return 1
        fi
    else
        log_message "Installation failed for $display_name"
        return 1
    fi
}

# Function to install applications by package group
install_applications_by_package_group() {
    local package_group="$1"
    local apps_to_install

    log_message "Installing applications for package group: $package_group"

    # Get applications for the target package group
    mapfile -t apps_to_install < <(get_apps_by_package_group "$package_group")

    if [ ${#apps_to_install[@]} -eq 0 ]; then
        log_message "No applications found for package group: $package_group"
        return 0
    fi

    log_message "Found ${#apps_to_install[@]} applications for package group $package_group"

    local installed_count=0
    local failed_count=0
    local skipped_count=0

    for app in "${apps_to_install[@]}"; do
        local lookup_app="$app"
        if [[ "$app" == mcp_* ]]; then
            lookup_app="${app#mcp_}"
        fi
        local display_name=$(get_app_property "$lookup_app" "name")
        
        # Ensure display_name is valid for array subscript
        if [[ -z "$display_name" ]]; then
            display_name="$lookup_app"
        fi
        # Remove any problematic characters for array subscript
        display_name=$(echo "$display_name" | sed 's/[^a-zA-Z0-9_-]/_/g')

        if install_application "$app" "$package_group"; then
            ((installed_count++))
            INSTALLATION_RESULTS["$display_name"]="success"
        else
            # Check if it was skipped (package not found) or failed
            if command -v "$lookup_app" >/dev/null 2>&1; then
                ((failed_count++))
                INSTALLATION_RESULTS["$display_name"]="failed"
                FAILED_APPS+=("$display_name")
            else
                # If command doesn't exist and install returned false, it was likely a unavailable package
                ((skipped_count++))
                INSTALLATION_RESULTS["$display_name"]="skipped"
                SKIPPED_APPS+=("$display_name")
            fi
        fi
    done

    log_message "Package group $package_group installation complete: $installed_count successful, $failed_count failed, $skipped_count skipped"
}

# Function to install applications by group (legacy compatibility)
install_applications_by_group() {
    local target_group="$1"
    local apps_to_install

    log_message "Installing applications for group: $target_group"

    # Get applications for the target group
    mapfile -t apps_to_install < <(get_apps_by_group "$target_group")

    if [ ${#apps_to_install[@]} -eq 0 ]; then
        log_message "No applications found for group: $target_group"
        return 0
    fi

    log_message "Found ${#apps_to_install[@]} applications for group $target_group"

    local installed_count=0
    local failed_count=0

    for app in "${apps_to_install[@]}"; do
        if install_application "$app"; then
            ((installed_count++))
        else
            ((failed_count++))
        fi
    done

    log_message "Group $target_group installation complete: $installed_count successful, $failed_count failed"
}

# Function to install all applications
install_all_applications() {
    log_message "Installing all available applications..."

    install_applications_by_package_group "BASE"
    install_applications_by_package_group "DEV"
    install_applications_by_package_group "APP"
    install_applications_by_package_group "AI"
}




# Function to print installation statistics and super launch report
print_installation_report() {
    local total_apps=0
    local installed_apps=0
    local skipped_apps=()
    local super_enabled_apps=()

    log_message ""
    log_message "=========================================="
    log_message "INSTALLATION SUMMARY REPORT"
    log_message "=========================================="

    # Iterate through all package groups to collect statistics
    for group in "BASE" "DEV" "APP" "AI" "MCP"; do
        local apps_in_group
        mapfile -t apps_in_group < <(get_apps_by_package_group "$group")

        for app in "${apps_in_group[@]}"; do
            local lookup_app="$app"
            if [[ "$app" == mcp_* ]]; then
                lookup_app="${app#mcp_}"
            fi

            local exec_name=$(get_app_property "$lookup_app" "exec")
            local app_name=$(get_app_property "$lookup_app" "name")
            local super_cmd=$(get_app_property "$lookup_app" "super")

            ((total_apps++))

            # Check if app is installed
            if command -v "$exec_name" >/dev/null 2>&1; then
                ((installed_apps++))
            else
                skipped_apps+=("$app_name ($exec_name)")
            fi

            # Check if super is enabled for DEV group
            if [ "$group" = "DEV" ] && [ -n "$super_cmd" ] && [ "$super_cmd" != "" ]; then
                super_enabled_apps+=("$app_name ($exec_name)")
            fi
        done
    done

    # Print statistics
    log_message "Total Applications: $total_apps"
    log_message "Installed: $installed_apps"
    log_message "Skipped/Not Installed: $((total_apps - installed_apps))"

    # Print skipped applications
    if [ ${#skipped_apps[@]} -gt 0 ]; then
        log_message ""
        log_message "Skipped Applications (Not Installed):"
        for app in "${skipped_apps[@]}"; do
            log_message "  - $app"
        done
    fi

    # Print failed applications (attempted but installation failed)
    if [ ${#FAILED_APPS[@]} -gt 0 ]; then
        log_message ""
        log_message "Failed Installations (Error Occurred):"
        for app in "${FAILED_APPS[@]}"; do
            log_message "  - $app"
        done
    fi

    # Print unavailable packages (not found in registry)
    if [ ${#SKIPPED_APPS[@]} -gt 0 ]; then
        log_message ""
        log_message "Unavailable Packages (Not Found in Registry):"
        for app in "${SKIPPED_APPS[@]}"; do
            log_message "  - $app"
        done
    fi

    # Print DEV applications with super launch enabled
    log_message ""
    log_message "DEV Applications with Super Launch Support:"
    log_message "  Total with super: ${#super_enabled_apps[@]}"
    for app in "${super_enabled_apps[@]}"; do
        log_message "  - $app"
    done

    # Print actual super launch implementations
    log_message ""
    log_message "Actual Super Launch Implementations:"

    if [ -d "/usr/local/super_bin" ]; then
        local super_bin_files=($(ls -1 /usr/local/super_bin 2>/dev/null || echo ""))
        if [ ${#super_bin_files[@]} -gt 0 ]; then
            log_message "  Files in /usr/local/super_bin (${#super_bin_files[@]}):"
            for file in "${super_bin_files[@]}"; do
                log_message "    - $file"
            done
        else
            log_message "  /usr/local/super_bin is empty"
        fi
    else
        log_message "  /usr/local/super_bin does not exist"
    fi

    log_message ""
    if [ -d "/usr/local/super_scripts" ]; then
        local super_script_files=($(ls -1 /usr/local/super_scripts 2>/dev/null || echo ""))
        if [ ${#super_script_files[@]} -gt 0 ]; then
            log_message "  Scripts in /usr/local/super_scripts (${#super_script_files[@]}):"
            for file in "${super_script_files[@]}"; do
                log_message "    - $file"
            done
        else
            log_message "  /usr/local/super_scripts is empty"
        fi
    else
        log_message "  /usr/local/super_scripts does not exist"
    fi

    log_message ""
    log_message "=========================================="
    
    # Refresh environment variables and shell configuration
    log_message "Refreshing environment variables..."
    refresh_environment
}

# Function to refresh environment variables and shell configuration
refresh_environment() {
    log_message ""
    log_message "=========================================="
    log_message "REFRESHING NPM BINARIES AND LAUNCH SCRIPTS"
    log_message "=========================================="
    
    # Create super_scripts directory if it doesn't exist
    if [ ! -d "/usr/local/super_scripts" ]; then
        log_message "Creating /usr/local/super_scripts directory..."
        $USE_SUDO mkdir -p "/usr/local/super_scripts"
        $USE_SUDO chmod 755 "/usr/local/super_scripts"
    fi
    
    # Get npm global bin directory
    local npm_global_bin=$(npm config get prefix 2>/dev/null)
    if [ -z "$npm_global_bin" ] || [ ! -d "$npm_global_bin/bin" ]; then
        log_message "Warning: Could not determine npm global bin directory"
        return 1
    fi
    
    log_message "NPM global bin directory: $npm_global_bin/bin"
    
    # Process all AI packages that use npm installation method
    local npm_packages=("gemini" "claude" "codex" "auggie")
    
    for package in "${npm_packages[@]}"; do
        local exec_name=$(get_app_property "$package" "exec")
        local launch_command=$(get_app_property "$package" "launch_command")
        local package_id=$(get_app_property "$package" "package_id")
        
        if [ -n "$exec_name" ] && [ -n "$launch_command" ]; then
            log_message ""
            log_message "Processing $package ($exec_name)..."
            
            # Check if the binary exists in npm global bin
            local binary_path="$npm_global_bin/bin/$exec_name"
            if [ -f "$binary_path" ]; then
                log_message "Found binary: $binary_path"
                
                # Create launch script in super_scripts
                local script_path="/usr/local/super_scripts/$exec_name"
                log_message "Creating launch script: $script_path"
                
                # Extract the actual command from launch_command (remove "which exec && $USE_SUDO")
                local actual_command=$(echo "$launch_command" | sed 's/which [^&]* && \$USE_SUDO //')

                # For npm packages, replace relative paths with absolute paths
                local processed_command="$actual_command"
                if [[ "$launch_command" =~ node[[:space:]]+[^[:space:]]+ ]]; then
                    # Extract the executable name after "node"
                    local node_exec=$(echo "$actual_command" | sed -n 's/.*node[[:space:]]\+\([^[:space:]]\+\).*/\1/p')
                    if [ -n "$node_exec" ]; then
                        # Use absolute path to the npm binary
                        processed_command="node $binary_path \"\$@\""
                    fi
                fi

                # Create the script content
                cat > "/tmp/$exec_name" << EOF
#!/bin/bash
# Launch script for $package
# Generated by 120_install_desktop_applications.sh
# Package: $package_id

# Add npm global bin to PATH
export PATH="\$PATH:$npm_global_bin/bin"

# Execute the launch command
$processed_command "\$@"
EOF
                
                # Move script to super_scripts and make executable
                $USE_SUDO mv "/tmp/$exec_name" "$script_path"
                $USE_SUDO chmod +x "$script_path"
                log_message "Created script: $script_path"
                
                # Create symbolic link in /usr/local/bin
                local link_path="/usr/local/bin/$exec_name"
                
                # Remove existing link if it exists
                if [ -L "$link_path" ] || [ -f "$link_path" ]; then
                    $USE_SUDO rm -f "$link_path"
                    log_message "Removed existing link: $link_path"
                fi
                
                # Create new symbolic link
                $USE_SUDO ln -s "$script_path" "$link_path"
                log_message "Created symbolic link: $link_path -> $script_path"
                
            else
                log_message "Binary not found: $binary_path"
            fi
        else
            log_message "Skipping $package: missing exec_name or launch_command"
        fi
    done
    
    log_message ""
    log_message "NPM binaries refresh completed!"
    log_message "=========================================="
}

# Function to test specific package group
test_package_group() {
    local search_term="$1"
    local found_group=""

    # Convert search term to uppercase for comparison
    local search_upper=$(echo "$search_term" | tr '[:lower:]' '[:upper:]')

    # Check which package group matches
    case "$search_upper" in
        *BASE*|*BASE_PACKAGES*)
            found_group="BASE"
            ;;
        *DEV*|*DEV_PACKAGES*|*DEVELOPMENT*)
            found_group="DEV"
            ;;
        *APP*|*APP_PACKAGES*|*APPLICATION*)
            found_group="APP"
            ;;
        *AI*|*AI_PACKAGES*)
            found_group="AI"
            ;;
        *MCP*|*MCP_PACKAGES*)
            found_group="MCP"
            ;;
        *)
            log_message "No package group found matching: $search_term"
            return 1
            ;;
    esac

    log_message "=========================================="
    log_message "Testing Package Group: $found_group"
    log_message "Search Term: $search_term"
    log_message "=========================================="

    install_applications_by_package_group "$found_group"
}

# Function to test specific applications by name
test_applications_by_name() {
    local search_term="$1"
    local group_filter="$2"  # Optional group filter
    local search_lower=$(echo "$search_term" | tr '[:upper:]' '[:lower:]')
    local found_apps=()

    log_message "=========================================="
    if [ -n "$group_filter" ]; then
        log_message "Testing Applications by Name: $search_term in Group: $group_filter"
    else
        log_message "Testing Applications by Name: $search_term"
    fi
    log_message "=========================================="

    # Determine which groups to search
    local search_groups=()
    if [ -n "$group_filter" ]; then
        # Search only in specified group
        local group_upper=$(echo "$group_filter" | tr '[:lower:]' '[:upper:]')
        case "$group_upper" in
            *BASE*|*BASE_PACKAGES*)
                search_groups=("BASE")
                ;;
            *DEV*|*DEV_PACKAGES*|*DEVELOPMENT*)
                search_groups=("DEV")
                ;;
            *APP*|*APP_PACKAGES*|*APPLICATION*)
                search_groups=("APP")
                ;;
            *AI*|*AI_PACKAGES*)
                search_groups=("AI")
                ;;
            *MCP*|*MCP_PACKAGES*)
                search_groups=("MCP")
                ;;
            *)
                log_message "Unknown group filter: $group_filter, searching all groups"
                search_groups=("BASE" "DEV" "APP" "AI" "MCP")
                ;;
        esac
    else
        # Search in all package groups
        search_groups=("BASE" "DEV" "APP" "AI" "MCP")
    fi

    for group in "${search_groups[@]}"; do
        local apps_in_group
        mapfile -t apps_in_group < <(get_apps_by_package_group "$group")

        for app in "${apps_in_group[@]}"; do
            # Handle MCP apps (remove mcp_ prefix for name lookup)
            local lookup_app="$app"
            if [[ "$app" == mcp_* ]]; then
                lookup_app="${app#mcp_}"
            fi

            local app_name=$(get_app_property "$lookup_app" "name")
            local app_name_lower=$(echo "$app_name" | tr '[:upper:]' '[:lower:]')

            # Check if search term is contained in app name (case insensitive)
            if [[ "$app_name_lower" == *"$search_lower"* ]]; then
                found_apps+=("$app")
                log_message "Found matching app: $app_name ($app) in group $group"
            fi
        done
    done

    if [ ${#found_apps[@]} -eq 0 ]; then
        if [ -n "$group_filter" ]; then
            log_message "No applications found matching: $search_term in group: $group_filter"
        else
            log_message "No applications found matching: $search_term"
        fi
        return 1
    fi

    log_message "Installing ${#found_apps[@]} matching applications..."

    local installed_count=0
    local failed_count=0

    # Need to track which app belongs to which group for proper super launch handling
    for app in "${found_apps[@]}"; do
        local app_group=""
        # Find which group this app belongs to
        for group in "${search_groups[@]}"; do
            local group_apps
            mapfile -t group_apps < <(get_apps_by_package_group "$group")
            for g_app in "${group_apps[@]}"; do
                if [ "$g_app" = "$app" ]; then
                    app_group="$group"
                    break 2
                fi
            done
        done

        if install_application "$app" "$app_group"; then
            ((installed_count++))
        else
            ((failed_count++))
        fi
    done

    log_message "Test installation complete: $installed_count successful, $failed_count failed"
}

# Function to show help
show_help() {
    echo "Desktop Applications Installation Script"
    echo ""
    echo "Usage:"
    echo "  $0                        # Normal installation using config flags"
    echo "  $0 DEV                   # Test install DEV package group (UPPERCASE = group)"
    echo "  $0 code                  # Test install apps containing 'code' in name (lowercase = app)"
    echo "  $0 DEV firefox           # Test install 'firefox' apps from DEV group"
    echo "  $0 --cleanup <name>      # Force cleanup package by executable name"
    echo "  $0 --help                # Show this help message"
    echo ""
    echo "Parameter Rules:"
    echo "  Single parameter:"
    echo "    - UPPERCASE: Match package group (e.g., DEV, BASE, APP)"
    echo "    - lowercase: Match application name (e.g., code, firefox)"
    echo "  Two parameters:"
    echo "    - First: Package group name"
    echo "    - Second: Application name within that group"
    echo "  All matching is case-insensitive internally"
    echo ""
    echo "Package Groups:"
    echo "  BASE - Essential base applications"
    echo "  DEV  - Development tools and IDEs"
    echo "  APP  - Desktop applications and productivity tools"
    echo "  AI   - AI development tools and assistants"
    echo "  MCP  - MCP service packages"
    echo ""
    echo "Test mode ignores installation flag files and installs matching packages directly"
    echo "Cleanup mode removes package from all package managers (snap, apt, flatpak)"
}

# Function to show parameter rules and wait for confirmation
show_parameter_rules_and_confirm() {
    local param1="$1"
    local param2="$2"

    echo ""
    echo "=========================================="
    echo "PARAMETER MATCHING RULES"
    echo "=========================================="
    echo "Single parameter:"
    echo "  - UPPERCASE: Match package group (e.g., DEV, BASE, APP)"
    echo "  - lowercase: Match application name (e.g., code, firefox)"
    echo "Two parameters:"
    echo "  - First: Package group name"
    echo "  - Second: Application name within that group"
    echo "All matching is case-insensitive internally"
    echo ""

    if [ -n "$param2" ]; then
        echo "Your input: Group='$param1', App='$param2'"
        echo "Will search for applications containing '$param2' in group '$param1'"
    else
        if [[ "$param1" =~ ^[A-Z]+$ ]]; then
            echo "Your input: '$param1' (UPPERCASE detected)"
            echo "Will search for package group matching '$param1'"
        else
            echo "Your input: '$param1' (lowercase detected)"
            echo "Will search for applications containing '$param1' in name"
        fi
    fi

    echo ""
    echo "Press 'y' or any key to continue, 'n' to cancel:"
    read -r -n 1 response
    echo ""

    case "$response" in
        [nN])
            echo "Operation cancelled by user."
            return 1
            ;;
        *)
            echo "Continuing with installation..."
            return 0
            ;;
    esac
}

# Function to handle cleanup command
handle_cleanup() {
    local exec_name="$1"

    if [ -z "$exec_name" ]; then
        log_message "Error: No executable name provided for cleanup"
        echo "Usage: $0 --cleanup <executable_name>"
        return 1
    fi

    log_message "=========================================="
    log_message "Force Cleanup Mode: $exec_name"
    log_message "=========================================="

    force_cleanup_package "$exec_name" "$exec_name"

    log_message "Cleanup completed for: $exec_name"
    return 0
}

# Main installation logic
main() {
    local param1="$1"
    local param2="$2"

    # Always fix npm permissions first (regardless of what the script does)
    log_message "=========================================="
    log_message "Checking and fixing npm global binary permissions..."
    log_message "=========================================="
    fix_npm_permissions

    # Check for help request
    if [ "$param1" = "--help" ] || [ "$param1" = "-h" ]; then
        show_help
        return 0
    fi

    # Check for cleanup request
    if [ "$param1" = "--cleanup" ]; then
        handle_cleanup "$param2"
        return $?
    fi

    log_message "=========================================="
    log_message "Starting Linux Desktop Applications Installation"
    log_message "Install Mode: $INSTALL_MODE"

    # Check if we're in test mode (any parameters provided)
    if [ -n "$param1" ]; then
        # Test mode: use parameters to control flow
        log_message "Test Mode: Using parameters to control installation"
        log_message "Parameter: $param1 $param2"
        log_message "=========================================="

        # Determine which package group to install based on param1
        local target_group=""
        local param_upper=$(echo "$param1" | tr '[:lower:]' '[:upper:]')

        case "$param_upper" in
            *BASE*)
                target_group="BASE"
                ;;
            *DEV*)
                target_group="DEV"
                ;;
            *APP*)
                target_group="APP"
                ;;
            *AI*)
                target_group="AI"
                ;;
            *MCP*)
                target_group="MCP"
                ;;
            *)
                log_message "Error: Unknown package group parameter: $param1"
                log_message "Valid parameters: BASE, DEV, APP, AI, MCP"
                return 1
                ;;
        esac

        log_message "Matched package group: $target_group"
        log_message "=========================================="

        # Ensure system is up to date
        log_message "Updating package lists with timeout..."
        if timeout 300 $USE_SUDO apt update; then
            log_message "Package lists updated successfully"
        else
            log_message "Warning: Package update timed out or failed, continuing anyway"
        fi

        # Install essential packages first
        log_message "Installing essential system packages with timeout..."
        if timeout 600 $USE_SUDO apt install -y curl wget software-properties-common apt-transport-https ca-certificates gnupg lsb-release; then
            log_message "Essential packages installed successfully"
        else
            log_message "Warning: Some essential packages failed to install, continuing anyway"
        fi

        log_message ""
        log_message "Installing $target_group package group..."
        log_message "=========================================="
        install_applications_by_package_group "$target_group"

        log_message ""
        log_message "=========================================="
        log_message "$target_group Package Group Installation Complete"
        log_message "Log file: $LOG_FILE"
        log_message "=========================================="

        # Print detailed installation report
        print_installation_report
        return 0
    fi

    log_message "=========================================="

    # Ensure system is up to date
    log_message "Updating package lists with timeout..."
    if timeout 300 $USE_SUDO apt update; then
        log_message "Package lists updated successfully"
    else
        log_message "Warning: Package update timed out or failed, continuing anyway"
    fi

    # Install essential packages first
    log_message "Installing essential system packages with timeout..."
    if timeout 600 $USE_SUDO apt install -y curl wget software-properties-common apt-transport-https ca-certificates gnupg lsb-release; then
        log_message "Essential packages installed successfully"
    else
        log_message "Warning: Some essential packages failed to install, continuing anyway"
    fi

    # Determine which package groups to install based on environment type
    log_message "=========================================="
    log_message "Environment Detection Results:"
    log_message "  Environment Type: $ENVIRONMENT_TYPE"
    log_message "  IS_WSL: $IS_WSL"
    log_message "  IS_PRODUCTION: $IS_PRODUCTION"
    log_message "  HAS_DESKTOP_ENVIRONMENT: $HAS_DESKTOP_ENVIRONMENT"
    log_message "=========================================="
    log_message ""

    # Determine which package groups to install
    local packages_to_install=()
    case "$ENVIRONMENT_TYPE" in
        desktop)
            log_message "Detected: Desktop Environment"
            log_message "Will install: BASE, DEV, APP, AI, and MCP packages"
            packages_to_install=("BASE" "DEV" "APP" "AI" "MCP")
            ;;
        wsl)
            log_message "Detected: WSL Environment"
            log_message "Will install: BASE, DEV, AI, and MCP packages (skipping APP)"
            packages_to_install=("BASE" "DEV" "AI" "MCP")
            ;;
        server)
            log_message "Detected: Server Environment"
            log_message "Will install: BASE packages only"
            packages_to_install=("BASE")
            ;;
    esac

    log_message ""
    log_message "Installation Plan:"
    printf '  - %s\n' "${packages_to_install[@]}"
    log_message ""
    log_message "Press Enter to continue with installation..."
    read -r
    log_message "Starting package installation..."
    log_message "=========================================="
    log_message ""

    # Install each package group
    for package_group in "${packages_to_install[@]}"; do
        log_message ""
        log_message "=========================================="
        log_message "Installing $package_group packages..."
        log_message "=========================================="
        install_applications_by_package_group "$package_group"
    done

    log_message "=========================================="
    log_message "Desktop Applications Installation Complete"
    log_message "Log file: $LOG_FILE"
    log_message "=========================================="

    # Fix npm permissions after all installations
    log_message ""
    log_message "=========================================="
    log_message "Fixing npm global binary permissions..."
    log_message "=========================================="
    fix_npm_permissions

    # Print detailed installation report
    print_installation_report
}

# Check if running as root (not recommended for desktop applications)
if [ "$(id -u)" -eq 0 ]; then
    log_message "Warning: Running as root. Some desktop applications may not work correctly."
    log_message "Consider running this script as a regular user with sudo access."
fi

# Execute main function
main "$1" "$2"
