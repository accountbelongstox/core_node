#!/bin/bash
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
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

# Variables (declare first)
SCRIPT_INDEX="39"
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
INSTALL_MODE=""
INSTALL_ANDROID_STUDIO=""
SCRIPT_TEMP_DIR=""
LOG_FILE=""
ANDROID_STUDIO_VERSION=""
ANDROID_STUDIO_URL=""
ANDROID_STUDIO_INSTALL_DIR=""
ANDROID_STUDIO_DESKTOP_FILE=""

# Paths setup
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source globals
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Init globals
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
INSTALL_ANDROID_STUDIO=$(get_var "INSTALL_ANDROID_STUDIO" "auto")
SCRIPT_TEMP_DIR=$(create_script_temp_dir "39_install_android_studio")
LOG_FILE="$SCRIPT_TEMP_DIR/android_studio_install_$(date +%Y%m%d_%H%M%S).log"

# Android Studio configuration
ANDROID_STUDIO_VERSION="2025.2.2.2"
ANDROID_STUDIO_URL="https://redirector.gvt1.com/edgedl/android/studio/ide-zips/${ANDROID_STUDIO_VERSION}/android-studio-${ANDROID_STUDIO_VERSION}-linux.tar.gz"
ANDROID_STUDIO_INSTALL_DIR=$(map_web_path "compile_dir" "applications/android-studio")
ANDROID_STUDIO_DESKTOP_FILE="/usr/share/applications/android-studio.desktop"

# Logging
log_message() {
    local message="$1"
    echo "[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

log_success() {
    local message="$1"
    echo -e "\033[32m[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $message\033[0m" | tee -a "$LOG_FILE"
}

log_error() {
    local message="$1"
    echo -e "\033[31m[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $message\033[0m" | tee -a "$LOG_FILE"
}

log_warning() {
    local message="$1"
    echo -e "\033[33m[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $message\033[0m" | tee -a "$LOG_FILE"
}

# Check if Android Studio is already installed
check_android_studio_installed() {
    if command -v android-studio >/dev/null 2>&1; then
        log_message "Android Studio is already installed and available in PATH"
        return 0
    fi
    
    if [ -f "$ANDROID_STUDIO_INSTALL_DIR/bin/studio.sh" ]; then
        log_message "Android Studio is already installed in $ANDROID_STUDIO_INSTALL_DIR"
        return 0
    fi
    
    return 1
}

# Install Android Studio via snap (preferred method)
install_android_studio_snap() {
    log_message "Installing Android Studio via snap..."
    
    if ! command -v snap >/dev/null 2>&1; then
        log_message "Installing snapd first..."
        $USE_SUDO apt update
        if $USE_SUDO apt install -y snapd; then
            log_success "snapd installed successfully"
            $USE_SUDO systemctl enable --now snapd.socket || log_warning "Failed to enable snapd.socket"
            $USE_SUDO ln -sf /var/lib/snapd/snap /snap 2>/dev/null || true
        else
            log_error "Failed to install snapd"
            return 1
        fi
    fi
    
    # Install Android Studio with classic confinement
    if $USE_SUDO snap install android-studio --classic; then
        log_success "Android Studio installed successfully via snap"
        return 0
    else
        log_error "Failed to install Android Studio via snap"
        return 1
    fi
}

# Install Android Studio via manual download
install_android_studio_manual() {
    log_message "Installing Android Studio via manual download..."
    
    # Create installation directory
    $USE_SUDO mkdir -p "$ANDROID_STUDIO_INSTALL_DIR"
    
    # Download Android Studio
    log_message "Downloading Android Studio from $ANDROID_STUDIO_URL..."
    if wget -O "$SCRIPT_TEMP_DIR/android-studio.tar.gz" "$ANDROID_STUDIO_URL"; then
        log_success "Android Studio downloaded successfully"
    else
        log_error "Failed to download Android Studio"
        return 1
    fi
    
    # Extract Android Studio
    log_message "Extracting Android Studio..."
    if tar -xzf "$SCRIPT_TEMP_DIR/android-studio.tar.gz" -C "$SCRIPT_TEMP_DIR"; then
        log_success "Android Studio extracted successfully"
    else
        log_error "Failed to extract Android Studio"
        return 1
    fi
    
    # Move to installation directory
    log_message "Installing Android Studio to $ANDROID_STUDIO_INSTALL_DIR..."
    if $USE_SUDO mv "$SCRIPT_TEMP_DIR/android-studio"/* "$ANDROID_STUDIO_INSTALL_DIR/"; then
        log_success "Android Studio moved to installation directory"
    else
        log_error "Failed to move Android Studio to installation directory"
        return 1
    fi
    
    # Set permissions
    $USE_SUDO chown -R root:root "$ANDROID_STUDIO_INSTALL_DIR"
    $USE_SUDO chmod -R 755 "$ANDROID_STUDIO_INSTALL_DIR"
    
    # Create desktop file
    create_desktop_file
    
    # Create symlink for command line access
    $USE_SUDO ln -sf "$ANDROID_STUDIO_INSTALL_DIR/bin/studio.sh" /usr/local/bin/android-studio
    
    log_success "Android Studio installed successfully via manual method"
    return 0
}

# Create desktop file for Android Studio
create_desktop_file() {
    log_message "Creating desktop file for Android Studio..."
    
    cat << EOF | $USE_SUDO tee "$ANDROID_STUDIO_DESKTOP_FILE" > /dev/null
[Desktop Entry]
Version=1.0
Type=Application
Name=Android Studio
Comment=Android Studio IDE
Exec=$ANDROID_STUDIO_INSTALL_DIR/bin/studio.sh
Icon=$ANDROID_STUDIO_INSTALL_DIR/bin/studio.png
Terminal=false
Categories=Development;IDE;
StartupWMClass=jetbrains-studio
EOF
    
    $USE_SUDO chmod 644 "$ANDROID_STUDIO_DESKTOP_FILE"
    log_success "Desktop file created successfully"
}

# Enable i386 architecture
enable_i386_architecture() {
    log_message "Checking i386 architecture support..."

    if dpkg --print-foreign-architectures | grep -q "i386"; then
        log_message "i386 architecture is already enabled"
        return 0
    fi

    log_message "Enabling i386 architecture..."
    if $USE_SUDO dpkg --add-architecture i386; then
        log_success "i386 architecture enabled successfully"

        log_message "Updating package lists for i386 architecture..."
        if $USE_SUDO apt update; then
            log_success "Package lists updated successfully"
            return 0
        else
            log_warning "Package list update failed, but continuing..."
            return 0
        fi
    else
        log_error "Failed to enable i386 architecture"
        return 1
    fi
}

# Install required dependencies
install_dependencies() {
    log_message "Installing required dependencies..."

    enable_i386_architecture

    local base_dependencies=(
        "openjdk-17-jdk"
        "unzip"
        "wget"
        "curl"
    )

    local i386_dependencies=(
        "libc6:i386"
        "libncurses5:i386"
        "libstdc++6:i386"
        "lib32z1"
        "libbz2-1.0:i386"
    )

    for dep in "${base_dependencies[@]}"; do
        log_message "Installing dependency: $dep"
        if ! $USE_SUDO apt install -y "$dep"; then
            log_warning "Failed to install $dep"
        fi
    done

    if dpkg --print-foreign-architectures | grep -q "i386"; then
        for dep in "${i386_dependencies[@]}"; do
            log_message "Installing dependency: $dep"
            if ! $USE_SUDO apt install -y "$dep"; then
                log_warning "Failed to install $dep"
            fi
        done
    else
        log_warning "i386 architecture not enabled, skipping i386 dependencies"
    fi

    log_success "Dependencies installation completed"
}

# Main installation function
install_android_studio() {
    log_message "Starting Android Studio installation..."
    
    # Check if already installed
    if check_android_studio_installed; then
        log_message "Android Studio is already installed, skipping installation"
        return 0
    fi
    
    # Install dependencies
    install_dependencies
    
    # Try snap installation first (preferred)
    if install_android_studio_snap; then
        return 0
    fi
    
    log_warning "Snap installation failed, trying manual installation..."
    
    # Fallback to manual installation
    if install_android_studio_manual; then
        return 0
    fi
    
    log_error "All installation methods failed"
    return 1
}

# Verify installation
verify_installation() {
    log_message "Verifying Android Studio installation..."
    
    if command -v android-studio >/dev/null 2>&1; then
        log_success "Android Studio command is available in PATH"
        return 0
    fi
    
    if [ -f "$ANDROID_STUDIO_INSTALL_DIR/bin/studio.sh" ]; then
        log_success "Android Studio installation verified"
        return 0
    fi
    
    log_error "Android Studio installation verification failed"
    return 1
}

# Main execution
main() {
    log_message "=========================================="
    log_message "Android Studio Installation Script"
    log_message "=========================================="
    log_message "INSTALL_MODE: $INSTALL_MODE"
    log_message "INSTALL_ANDROID_STUDIO: $INSTALL_ANDROID_STUDIO"
    log_message "HAS_DESKTOP_ENVIRONMENT: $HAS_DESKTOP_ENVIRONMENT"
    log_message "=========================================="
    
    # Check if we should install Android Studio
    if [ "$INSTALL_ANDROID_STUDIO" = "false" ]; then
        log_message "Android Studio installation is disabled, skipping..."
        return 0
    fi
    
    # Only install in desktop environments
    if [ "$HAS_DESKTOP_ENVIRONMENT" = false ]; then
        log_message "No desktop environment detected, skipping Android Studio installation"
        return 0
    fi
    
    log_message "Desktop environment detected, proceeding with Android Studio installation..."
    
    # Update package lists
    log_message "Updating package lists..."
    $USE_SUDO apt update || log_warning "Package list update failed"
    
    # Install Android Studio
    if install_android_studio; then
        log_success "Android Studio installation completed successfully"
        
        # Verify installation
        if verify_installation; then
            log_success "Android Studio installation verified successfully"
        else
            log_warning "Android Studio installation verification failed"
        fi
    else
        log_error "Android Studio installation failed"
        return 1
    fi
    
    log_message "=========================================="
    log_message "Android Studio Installation Script Completed"
    log_message "=========================================="
}

# Execute main function
main "$@"
