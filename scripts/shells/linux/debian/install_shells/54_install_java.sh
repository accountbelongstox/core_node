#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Source gvar_common.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Declare all variables at the beginning
INSTALL_JAVA=$(get_var "INSTALL_JAVA")
INSTALL_MODE=$(get_var "INSTALL_MODE")
SELECTED_REGION=${SELECTED_REGION:-$(get_var "SELECTED_REGION")}
JAVA_VERSION="21.0.1"
JAVA_SHORT_VERSION="21"
JAVA_INSTALL_DIR="$COMPILE_DIR/java"
JAVA_TAR_FILE="openjdk-${JAVA_VERSION}_linux-x64_bin.tar.gz"
JAVA_EXTRACT_DIR="jdk-${JAVA_VERSION}"

# Download URLs based on region
if [ "$SELECTED_REGION" = "China" ]; then
    JAVA_DOWNLOAD_URLS=(
        "https://mirrors.tuna.tsinghua.edu.cn/Adoptium/21/jdk/x64/linux/OpenJDK21U-jdk_x64_linux_hotspot_21.0.1_12.tar.gz"
        "https://mirrors.aliyun.com/Adoptium/21/jdk/x64/linux/OpenJDK21U-jdk_x64_linux_hotspot_21.0.1_12.tar.gz"
        "https://repo.huaweicloud.com/Adoptium/21/jdk/x64/linux/OpenJDK21U-jdk_x64_linux_hotspot_21.0.1_12.tar.gz"
        "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.1%2B12/OpenJDK21U-jdk_x64_linux_hotspot_21.0.1_12.tar.gz"
    )
else
    JAVA_DOWNLOAD_URLS=(
        "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.1%2B12/OpenJDK21U-jdk_x64_linux_hotspot_21.0.1_12.tar.gz"
        "https://mirrors.tuna.tsinghua.edu.cn/Adoptium/21/jdk/x64/linux/OpenJDK21U-jdk_x64_linux_hotspot_21.0.1_12.tar.gz"
    )
fi

# Use global temporary directory structure
SCRIPT_TEMP_DIR=$(create_script_temp_dir "54_install_java")
TAR_FILE="$SCRIPT_TEMP_DIR/$JAVA_TAR_FILE"
EXTRACT_DIR="$SCRIPT_TEMP_DIR/$JAVA_EXTRACT_DIR"
JAVA_BIN_DIR="$JAVA_INSTALL_DIR/jdk-${JAVA_VERSION}/bin"

if [ "$INSTALL_JAVA" = "false" ]; then
    echo "Skipping Java installation, INSTALL_JAVA: $INSTALL_JAVA, INSTALL_MODE: $INSTALL_MODE"
    exit 0
fi

echo "COMPILE_DIR: $COMPILE_DIR"
echo "SELECTED_REGION: $SELECTED_REGION"
echo "JAVA_VERSION: $JAVA_VERSION"
echo "JAVA_INSTALL_DIR: $JAVA_INSTALL_DIR"

# Function to check if Java is already installed and properly linked
check_java_installation() {
    echo "Checking for existing Java installation..."
    
    # Check if java binary exists in /usr/local/bin (our target location)
    if [ -L /usr/local/bin/java ] && [ -e /usr/local/bin/java ]; then
        local java_version_output
        java_version_output=$(/usr/local/bin/java -version 2>&1)
        if echo "$java_version_output" | grep -q "version \"$JAVA_SHORT_VERSION"; then
            echo "Java $JAVA_SHORT_VERSION is already installed and properly linked in /usr/local/bin"
            return 0
        else
            echo "Java found in /usr/local/bin but version mismatch"
            return 1
        fi
    fi
    
    # Check if Java exists in our target installation directory
    if [ -f "$JAVA_BIN_DIR/java" ]; then
        local java_version_output
        java_version_output=$("$JAVA_BIN_DIR/java" -version 2>&1)
        if echo "$java_version_output" | grep -q "version \"$JAVA_SHORT_VERSION"; then
            echo "Java $JAVA_SHORT_VERSION found in installation directory but not linked"
            return 2
        else
            echo "Java found in installation directory but version mismatch"
            return 1
        fi
    fi
    
    # Check for system Java installation
    local system_java=$(which java 2>/dev/null)
    if [ -n "$system_java" ]; then
        local java_version_output
        java_version_output=$("$system_java" -version 2>&1)
        if echo "$java_version_output" | grep -q "version \"$JAVA_SHORT_VERSION"; then
            echo "System Java $JAVA_SHORT_VERSION found at: $system_java"
            return 3
        else
            echo "System Java found but version mismatch"
            return 1
        fi
    fi
    
    echo "No suitable Java installation found"
    return 1
}

# Function to detect and fix previous installation issues
detect_and_fix_previous_issues() {
    echo "Detecting and fixing previous installation issues..."
    
    # 1. Fix broken environment variables from previous runs
    echo "Checking /etc/environment for broken entries..."
    if [ -f /etc/environment ]; then
        # Remove invalid JAVA-V* entries
        if grep -q "JAVA-V.*_HOME=" /etc/environment; then
            echo "Found broken JAVA-V*_HOME entries, removing..."
            sudo sed -i '/JAVA-V.*_HOME=/d' /etc/environment
        fi
        
        # Remove duplicate JAVA_HOME entries
        if [ $(grep -c "^JAVA_HOME=" /etc/environment) -gt 1 ]; then
            echo "Found duplicate JAVA_HOME entries, removing duplicates..."
            sudo sed -i '/^JAVA_HOME=/d' /etc/environment
        fi
    fi
    
    # 2. Fix broken symlinks
    echo "Checking for broken symlinks in /usr/local/bin..."
    for binary in java javac javadoc jar jps jstat jmap jstack; do
        local link_path="/usr/local/bin/$binary"
        if [ -L "$link_path" ] && [ ! -e "$link_path" ]; then
            echo "Found broken symlink: $link_path, removing..."
            sudo rm -f "$link_path"
        fi
    done
    
    # 3. Clean up old Java installations in wrong locations
    echo "Checking for Java installations in wrong locations..."
    local wrong_locations=(
        "/usr/local/java"
        "/opt/java"
        "/var/java"
        "$COMPILE_DIR/jdk"
    )
    
    for wrong_location in "${wrong_locations[@]}"; do
        if [ -d "$wrong_location" ] && [ "$wrong_location" != "$JAVA_INSTALL_DIR" ]; then
            echo "Found old Java installation in wrong location: $wrong_location"
            read -p "Remove old installation at $wrong_location? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                sudo rm -rf "$wrong_location"
                echo "Removed: $wrong_location"
            fi
        fi
    done
    
    echo "Previous issues detection and fixing completed."
    return 0
}

check_existing_download() {
    if [ -f "$TAR_FILE" ]; then
        echo "Found existing download file: $TAR_FILE"
        # Check if file size is reasonable (> 50MB)
        local file_size=$(stat -c%s "$TAR_FILE" 2>/dev/null || echo "0")
        if [ "$file_size" -gt 52428800 ]; then
            echo "Existing file size looks good ($file_size bytes), skipping download"
            return 0
        else
            echo "Existing file size too small ($file_size bytes), will re-download"
            sudo rm -f "$TAR_FILE"
            return 1
        fi
    fi
    return 1
}

cleanup_previous() {
    echo "Cleaning up previous installation attempts..."
    sudo rm -rf "$EXTRACT_DIR" 2>/dev/null
}

download_with_fallback() {
    local downloaded=false
    
    for url in "${JAVA_DOWNLOAD_URLS[@]}"; do
        echo "Attempting to download from: $url"
        
        # Try with different wget options
        local wget_options=(
            "--timeout=30 --tries=3 --show-progress"
            "--timeout=60 --tries=2 --no-check-certificate"
            "--timeout=120 --tries=1 --no-dns-cache"
        )
        
        for options in "${wget_options[@]}"; do
            echo "Using wget options: $options"
            if eval "wget $options -O \"$TAR_FILE\" \"$url\""; then
                echo "Successfully downloaded from: $url"
                downloaded=true
                break 2
            else
                echo "Failed with options: $options"
                sudo rm -f "$TAR_FILE" 2>/dev/null
            fi
        done
        
        echo "All wget attempts failed for: $url"
    done
    
    if [ "$downloaded" = "false" ]; then
        echo "All download sources failed. Checking if curl is available..."
        if command -v curl >/dev/null 2>&1; then
            echo "Trying with curl as fallback..."
            for url in "${JAVA_DOWNLOAD_URLS[@]}"; do
                echo "Attempting curl download from: $url"
                if curl -L --connect-timeout 30 --max-time 300 -o "$TAR_FILE" "$url"; then
                    echo "Successfully downloaded with curl from: $url"
                    downloaded=true
                    break
                else
                    echo "Curl failed for: $url"
                    sudo rm -f "$TAR_FILE" 2>/dev/null
                fi
            done
        fi
    fi
    
    if [ "$downloaded" = "false" ]; then
        echo "ERROR: All download methods failed"
        echo "Please check your network connectivity or try manually downloading:"
        for url in "${JAVA_DOWNLOAD_URLS[@]}"; do
            echo "  $url"
        done
        return 1
    fi
    
    return 0
}

install_java() {
    echo "Installing Java $JAVA_VERSION..."
    echo "Available download URLs:"
    for url in "${JAVA_DOWNLOAD_URLS[@]}"; do
        echo "  - $url"
    done
    
    cleanup_previous
    
    # Check if download already exists
    if ! check_existing_download; then
        echo "Downloading Java $JAVA_VERSION..."
        if ! download_with_fallback; then
            echo "Failed to download Java from any source"
            return 1
        fi
    fi
    
    echo "Extracting Java..."
    if ! sudo mkdir -p "$EXTRACT_DIR" || ! sudo tar -xf "$TAR_FILE" -C "$EXTRACT_DIR" --strip-components=1; then
        echo "Failed to extract Java"
        return 1
    fi
    
    echo "Installing Java to $JAVA_INSTALL_DIR..."
    sudo mkdir -p "$JAVA_INSTALL_DIR"
    if ! sudo mv "$EXTRACT_DIR" "$JAVA_INSTALL_DIR/jdk-${JAVA_VERSION}"; then
        echo "Failed to install Java"
        return 1
    fi
    
    # Set proper permissions
    sudo chown -R root:root "$JAVA_INSTALL_DIR/jdk-${JAVA_VERSION}"
    sudo chmod -R 755 "$JAVA_INSTALL_DIR/jdk-${JAVA_VERSION}"
    
    cleanup_previous
    return 0
}

create_symlinks() {
    echo "Creating and verifying symlinks..."
    
    local java_path="$JAVA_BIN_DIR/java"
    local javac_path="$JAVA_BIN_DIR/javac"
    local javadoc_path="$JAVA_BIN_DIR/javadoc"
    local jar_path="$JAVA_BIN_DIR/jar"
    local jps_path="$JAVA_BIN_DIR/jps"
    local jstat_path="$JAVA_BIN_DIR/jstat"
    local jmap_path="$JAVA_BIN_DIR/jmap"
    local jstack_path="$JAVA_BIN_DIR/jstack"
    
    # Check if binaries exist
    if [ ! -f "$java_path" ] || [ ! -f "$javac_path" ]; then
        echo "Error: Java binaries not found in $JAVA_BIN_DIR"
        
        # Try to find system installation and use it
        local system_java=$(which java 2>/dev/null)
        local system_javac=$(which javac 2>/dev/null)
        
        if [ -n "$system_java" ] && [ -n "$system_javac" ]; then
            echo "Using system Java installation for symlinks..."
            java_path="$system_java"
            javac_path="$system_javac"
            javadoc_path=$(which javadoc 2>/dev/null)
            jar_path=$(which jar 2>/dev/null)
            jps_path=$(which jps 2>/dev/null)
            jstat_path=$(which jstat 2>/dev/null)
            jmap_path=$(which jmap 2>/dev/null)
            jstack_path=$(which jstack 2>/dev/null)
        else
            return 1
        fi
    fi
    
    # Remove any existing broken symlinks first
    for binary in java javac javadoc jar jps jstat jmap jstack; do
        local link_path="/usr/local/bin/$binary"
        if [ -L "$link_path" ] && [ ! -e "$link_path" ]; then
            echo "Removing broken symlink: $link_path"
            sudo rm -f "$link_path"
        fi
    done
    
    # Create symlinks for Java binaries to /usr/local/bin
    local java_binaries=(
        "java:$java_path"
        "javac:$javac_path"
    )
    
    # Add optional binaries if they exist
    [ -f "$javadoc_path" ] && java_binaries+=("javadoc:$javadoc_path")
    [ -f "$jar_path" ] && java_binaries+=("jar:$jar_path")
    [ -f "$jps_path" ] && java_binaries+=("jps:$jps_path")
    [ -f "$jstat_path" ] && java_binaries+=("jstat:$jstat_path")
    [ -f "$jmap_path" ] && java_binaries+=("jmap:$jmap_path")
    [ -f "$jstack_path" ] && java_binaries+=("jstack:$jstack_path")
    
    for binary_info in "${java_binaries[@]}"; do
        local binary_name="${binary_info%%:*}"
        local binary_path="${binary_info##*:}"
        
        if [ -f "$binary_path" ]; then
            if sudo ln -sf "$binary_path" "/usr/local/bin/$binary_name"; then
                echo "Created symlink: /usr/local/bin/$binary_name -> $binary_path"
            else
                echo "Failed to create symlink for $binary_name"
                return 1
            fi
        fi
    done
    
    # Verify symlinks work
    echo "Verifying symlinks..."
    if /usr/local/bin/java -version >/dev/null 2>&1; then
        echo "?Java symlink working: $(/usr/local/bin/java -version 2>&1 | head -n1)"
    else
        echo "?Java symlink not working"
    fi
    
    if /usr/local/bin/javac -version >/dev/null 2>&1; then
        echo "?javac symlink working: $(/usr/local/bin/javac -version 2>&1)"
    else
        echo "?javac symlink not working"
    fi
    
    echo "Symlinks created successfully:"
    ls -l /usr/local/bin/java /usr/local/bin/javac 2>/dev/null
    return 0
}

setup_environment() {
    echo "Setting up Java environment variables..."
    
    # Clean up any previous broken environment variables first
    if [ -f /etc/environment ]; then
        echo "Cleaning up previous broken environment variables..."
        sudo sed -i '/JAVA-V.*_HOME=/d' /etc/environment
        sudo sed -i '/^JAVA_HOME=/d' /etc/environment
    fi
    
    # Determine the actual Java installation path
    local actual_java_home=""
    
    if [ -f "$JAVA_BIN_DIR/java" ]; then
        # Use our installed version
        actual_java_home="$JAVA_INSTALL_DIR/jdk-${JAVA_VERSION}"
    else
        # Try to find system installation
        local system_java=$(which java 2>/dev/null)
        if [ -n "$system_java" ]; then
            # Get the actual installation directory from the binary path
            actual_java_home=$(dirname $(dirname "$system_java"))
            echo "Using system Java installation at: $actual_java_home"
        else
            echo "Warning: No Java installation found, using target directory"
            actual_java_home="$JAVA_INSTALL_DIR/jdk-${JAVA_VERSION}"
        fi
    fi
    
    # Set environment variables using the proper function from gvar_common.sh
    set_env_and_var "JAVA_HOME" "$actual_java_home"
    
    # Update PATH to include Java bin directory
    local current_path=$(grep "^PATH=" /etc/environment 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "$PATH")
    local java_bin="$actual_java_home/bin"
    
    # Add Java bin to PATH if not already there
    if [[ "$current_path" != *"$java_bin"* ]]; then
        set_env_and_var "PATH" "$java_bin:$current_path"
        echo "Added Java bin directory to PATH"
    else
        echo "Java bin directory already in PATH"
    fi
    
    echo "Environment variables configured:"
    echo "  JAVA_HOME: $actual_java_home"
    echo "  Updated PATH with: $java_bin"
    
    return 0
}

verify_installation() {
    echo "Verifying installation..."
    
    # Check binaries in install directory
    local java_bin="$JAVA_BIN_DIR/java"
    local javac_bin="$JAVA_BIN_DIR/javac"
    
    if [ ! -f "$java_bin" ] || [ ! -f "$javac_bin" ]; then
        echo "Error: Java binaries not found in installation directory"
        return 1
    fi
    
    # Check symlinks
    if [ ! -L /usr/local/bin/java ] || [ ! -L /usr/local/bin/javac ]; then
        echo "Error: Symlinks verification failed"
        return 1
    fi
    
    echo "Java version: $($java_bin -version 2>&1 | head -n1)"
    echo "javac version: $($javac_bin -version 2>&1)"
    
    return 0
}

# Main execution
echo "Java Installation Script"
echo "Target version: $JAVA_VERSION"
echo "Installation directory: $JAVA_INSTALL_DIR"

# First, detect and fix any previous installation issues
detect_and_fix_previous_issues

# Check installation status
installation_status=$(check_java_installation)
installation_result=$?

case $installation_result in
    0)
        echo "Java $JAVA_VERSION is already installed and properly linked."
        ;;
    2)
        echo "Java $JAVA_VERSION found in installation directory but not linked."
        echo "Will create symlinks and environment configuration."
        ;;
    3)
        echo "Found compatible system Java installation."
        echo "Will configure symlinks and environment for existing installation."
        ;;
    1)
        echo "Installing Java $JAVA_VERSION..."
        if ! install_java; then
            echo "Java installation failed"
            exit 1
        fi
        ;;
esac

if ! create_symlinks; then
    echo "Failed to create symlinks"
    exit 1
fi

if ! setup_environment; then
    echo "Failed to setup environment"
    exit 1
fi

if ! verify_installation; then
    echo "Installation verification failed"
    exit 1
fi

echo "Java installation completed successfully!"
echo "COMPILE_DIR: $COMPILE_DIR"
echo "Java installed in: $JAVA_INSTALL_DIR/jdk-${JAVA_VERSION}"
echo "Java binaries linked to: /usr/local/bin/"
echo "To use updated environment variables, restart your shell or run 'source /etc/environment'"



