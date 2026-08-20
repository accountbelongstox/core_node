#!/bin/bash

# ============================================
# xing canchuan mei ce shi ban - Binary Downloader
# Auto Download ADB and SCRCPY Binaries
# ============================================
# This script automatically downloads the latest ADB and SCRCPY binaries

PLATFORM="${1:-auto}"  # "win", "mac-x64", "mac-arm64", "linux-x64", "linux-arm64", "auto"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Color definitions
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${CYAN}[INFO] $1${NC}"
}

print_success() {
    echo -e "${GREEN}[OK] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# Detect platform
get_target_platform() {
    if [ "$PLATFORM" != "auto" ]; then
        echo "$PLATFORM"
        return
    fi

    case "$(uname -s)" in
        Linux*)     echo "linux-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')" ;;
        Darwin*)    echo "mac-$(uname -m | sed 's/x86_64/x64/')" ;;
        MINGW*|MSYS*|CYGWIN*) echo "win" ;;
        *)          echo "auto" ;;
    esac
}

# Download URLs
SCRCPY_RELEASES_URL="https://api.github.com/repos/Genymobile/scrcpy/releases/latest"
ADB_WINDOWS_URL="https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
ADB_MAC_URL="https://dl.google.com/android/repository/platform-tools-latest-darwin.zip"
ADB_LINUX_URL="https://dl.google.com/android/repository/platform-tools-latest-linux.zip"

# Temp directory
TEMP_DIR="${TMPDIR:-/tmp}/escrcpy-downloads"
mkdir -p "$TEMP_DIR"

print_info "Temporary download directory: $TEMP_DIR"

# Download file with progress
download_file() {
    local url="$1"
    local destination="$2"

    print_info "Downloading from: $url"
    print_info "Saving to: $destination"

    if command -v curl &> /dev/null; then
        # curl with progress bar
        if curl -L --progress-bar -o "$destination" "$url" 2>&1 | \
           while IFS= read -r line; do
               # Show progress bar from curl
               echo -ne "\r[INFO] $line"
           done; then
            echo "" # New line after progress
            print_success "Downloaded successfully"
            return 0
        fi
    elif command -v wget &> /dev/null; then
        # wget with progress bar (wget shows progress by default)
        if wget --show-progress --progress=bar:force:noscroll -O "$destination" "$url"; then
            print_success "Downloaded successfully"
            return 0
        fi
    else
        print_error "Neither curl nor wget is available"
        print_info "Please install curl or wget to download files"
        return 1
    fi

    print_error "Download failed"
    return 1
}

# Extract ZIP file
extract_zip() {
    local zip_path="$1"
    local dest_path="$2"

    print_info "Extracting: $zip_path"
    print_info "To: $dest_path"

    mkdir -p "$dest_path"

    if command -v unzip &> /dev/null; then
        if unzip -q -o "$zip_path" -d "$dest_path"; then
            print_success "Extracted successfully"
            return 0
        fi
    else
        print_error "unzip command not found"
        return 1
    fi

    print_error "Extraction failed"
    return 1
}

# Get latest SCRCPY release info
get_scrcpy_release_info() {
    print_info "Fetching latest SCRCPY release information..."

    local response
    if command -v curl &> /dev/null; then
        response=$(curl -s "$SCRCPY_RELEASES_URL")
    elif command -v wget &> /dev/null; then
        response=$(wget -q -O - "$SCRCPY_RELEASES_URL")
    else
        print_error "Neither curl nor wget is available"
        return 1
    fi

    if [ -z "$response" ]; then
        print_error "Failed to fetch SCRCPY release info"
        return 1
    fi

    # Parse JSON (basic parsing, works without jq)
    local version=$(echo "$response" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/')

    print_success "Latest SCRCPY version: $version"

    # Extract download URLs
    declare -gA SCRCPY_ASSETS

    # Windows
    SCRCPY_ASSETS["win"]=$(echo "$response" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*win64[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/')

    # macOS
    SCRCPY_ASSETS["mac-x64"]=$(echo "$response" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*macos[^"]*x86_64[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
    SCRCPY_ASSETS["mac-arm64"]=$(echo "$response" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*macos[^"]*arm64[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/')

    # Linux
    SCRCPY_ASSETS["linux-x64"]=$(echo "$response" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*linux[^"]*x86_64[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
    SCRCPY_ASSETS["linux-arm64"]=$(echo "$response" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*linux[^"]*aarch64[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/')

    return 0
}

# Install ADB for Windows
install_adb_windows() {
    local dest_dir="$PROJECT_ROOT/electron/resources/extra/win/scrcpy"
    local zip_file="$TEMP_DIR/platform-tools-windows.zip"

    print_info "Downloading Android Platform Tools for Windows..."

    download_file "$ADB_WINDOWS_URL" "$zip_file" || return 1

    local extract_dir="$TEMP_DIR/platform-tools-win"
    extract_zip "$zip_file" "$extract_dir" || return 1

    # Copy ADB binaries
    local platform_tools_dir="$extract_dir/platform-tools"
    if [ -d "$platform_tools_dir" ]; then
        mkdir -p "$dest_dir"

        cp "$platform_tools_dir/adb.exe" "$dest_dir/" 2>/dev/null
        cp "$platform_tools_dir/AdbWinApi.dll" "$dest_dir/" 2>/dev/null
        cp "$platform_tools_dir/AdbWinUsbApi.dll" "$dest_dir/" 2>/dev/null

        print_success "ADB installed for Windows"
        return 0
    fi

    print_error "Platform tools directory not found"
    return 1
}

# Install SCRCPY for Windows
install_scrcpy_windows() {
    local url="${SCRCPY_ASSETS[win]}"
    if [ -z "$url" ]; then
        print_warning "Windows SCRCPY download URL not found"
        return 1
    fi

    local dest_dir="$PROJECT_ROOT/electron/resources/extra/win/scrcpy"
    local zip_file="$TEMP_DIR/scrcpy-windows.zip"

    print_info "Downloading SCRCPY for Windows..."

    download_file "$url" "$zip_file" || return 1

    local extract_dir="$TEMP_DIR/scrcpy-win"
    extract_zip "$zip_file" "$extract_dir" || return 1

    # Find scrcpy directory
    local scrcpy_dir=$(find "$extract_dir" -maxdepth 1 -type d -name "scrcpy-*" | head -1)
    if [ -d "$scrcpy_dir" ]; then
        mkdir -p "$dest_dir"
        cp -r "$scrcpy_dir"/* "$dest_dir/"

        print_success "SCRCPY installed for Windows"
        return 0
    fi

    print_error "SCRCPY directory not found in extracted files"
    return 1
}

# Install ADB for macOS
install_adb_mac() {
    local arch="$1"
    local dest_dir="$PROJECT_ROOT/electron/resources/extra/mac-$arch/scrcpy"
    local zip_file="$TEMP_DIR/platform-tools-mac.zip"

    print_info "Downloading Android Platform Tools for macOS ($arch)..."

    download_file "$ADB_MAC_URL" "$zip_file" || return 1

    local extract_dir="$TEMP_DIR/platform-tools-mac-$arch"
    extract_zip "$zip_file" "$extract_dir" || return 1

    # Copy ADB binary
    local platform_tools_dir="$extract_dir/platform-tools"
    if [ -d "$platform_tools_dir" ]; then
        mkdir -p "$dest_dir"
        cp "$platform_tools_dir/adb" "$dest_dir/"
        chmod +x "$dest_dir/adb"

        print_success "ADB installed for macOS ($arch)"
        return 0
    fi

    print_error "Platform tools directory not found"
    return 1
}

# Install SCRCPY for macOS
install_scrcpy_mac() {
    local arch="$1"
    local url="${SCRCPY_ASSETS[mac-$arch]}"

    if [ -z "$url" ]; then
        print_warning "macOS $arch SCRCPY download URL not found"
        return 1
    fi

    local dest_dir="$PROJECT_ROOT/electron/resources/extra/mac-$arch/scrcpy"
    local zip_file="$TEMP_DIR/scrcpy-mac-$arch.zip"

    print_info "Downloading SCRCPY for macOS ($arch)..."

    download_file "$url" "$zip_file" || return 1

    local extract_dir="$TEMP_DIR/scrcpy-mac-$arch"
    extract_zip "$zip_file" "$extract_dir" || return 1

    # Find scrcpy directory
    local scrcpy_dir=$(find "$extract_dir" -maxdepth 1 -type d -name "scrcpy-*" | head -1)
    if [ -d "$scrcpy_dir" ]; then
        mkdir -p "$dest_dir"
        cp -r "$scrcpy_dir"/* "$dest_dir/"
        chmod +x "$dest_dir/scrcpy" 2>/dev/null

        print_success "SCRCPY installed for macOS ($arch)"
        return 0
    fi

    print_error "SCRCPY directory not found in extracted files"
    return 1
}

# Install ADB for Linux
install_adb_linux() {
    local arch="$1"
    local dest_dir="$PROJECT_ROOT/electron/resources/extra/linux-$arch/scrcpy"
    local zip_file="$TEMP_DIR/platform-tools-linux.zip"

    print_info "Downloading Android Platform Tools for Linux ($arch)..."

    download_file "$ADB_LINUX_URL" "$zip_file" || return 1

    local extract_dir="$TEMP_DIR/platform-tools-linux-$arch"
    extract_zip "$zip_file" "$extract_dir" || return 1

    # Copy ADB binary
    local platform_tools_dir="$extract_dir/platform-tools"
    if [ -d "$platform_tools_dir" ]; then
        mkdir -p "$dest_dir"
        cp "$platform_tools_dir/adb" "$dest_dir/"
        chmod +x "$dest_dir/adb"

        print_success "ADB installed for Linux ($arch)"
        return 0
    fi

    print_error "Platform tools directory not found"
    return 1
}

# Install SCRCPY for Linux
install_scrcpy_linux() {
    local arch="$1"
    local url="${SCRCPY_ASSETS[linux-$arch]}"

    if [ -z "$url" ]; then
        print_warning "Linux $arch SCRCPY download URL not found"
        return 1
    fi

    local dest_dir="$PROJECT_ROOT/electron/resources/extra/linux-$arch/scrcpy"
    local zip_file="$TEMP_DIR/scrcpy-linux-$arch.zip"

    print_info "Downloading SCRCPY for Linux ($arch)..."

    download_file "$url" "$zip_file" || return 1

    local extract_dir="$TEMP_DIR/scrcpy-linux-$arch"
    extract_zip "$zip_file" "$extract_dir" || return 1

    # Find scrcpy directory
    local scrcpy_dir=$(find "$extract_dir" -maxdepth 1 -type d -name "scrcpy-*" | head -1)
    if [ -d "$scrcpy_dir" ]; then
        mkdir -p "$dest_dir"
        cp -r "$scrcpy_dir"/* "$dest_dir/"
        chmod +x "$dest_dir/scrcpy" 2>/dev/null

        print_success "SCRCPY installed for Linux ($arch)"
        return 0
    fi

    print_error "SCRCPY directory not found in extracted files"
    return 1
}

# Main execution
echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  xing canchuan mei ce shi ban - Binary Downloader${NC}"
echo -e "${CYAN}  Auto Download ADB and SCRCPY Binaries${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Get SCRCPY release info
if ! get_scrcpy_release_info; then
    print_error "Failed to get SCRCPY release information"
    exit 1
fi

TARGET_PLATFORM=$(get_target_platform)
print_info "Target platform: $TARGET_PLATFORM"
echo ""

# Download binaries based on platform
case "$TARGET_PLATFORM" in
    win)
        echo -e "${YELLOW}--- Installing for Windows ---${NC}"
        install_adb_windows
        install_scrcpy_windows
        echo ""
        ;;
    mac-x64)
        echo -e "${YELLOW}--- Installing for macOS (x64) ---${NC}"
        install_adb_mac "x64"
        install_scrcpy_mac "x64"
        echo ""
        ;;
    mac-arm64)
        echo -e "${YELLOW}--- Installing for macOS (arm64) ---${NC}"
        install_adb_mac "arm64"
        install_scrcpy_mac "arm64"
        echo ""
        ;;
    linux-x64)
        echo -e "${YELLOW}--- Installing for Linux (x64) ---${NC}"
        install_adb_linux "x64"
        install_scrcpy_linux "x64"
        echo ""
        ;;
    linux-arm64)
        echo -e "${YELLOW}--- Installing for Linux (arm64) ---${NC}"
        install_adb_linux "arm64"
        install_scrcpy_linux "arm64"
        echo ""
        ;;
    auto)
        echo -e "${YELLOW}--- Installing for Windows ---${NC}"
        install_adb_windows
        install_scrcpy_windows
        echo ""

        echo -e "${YELLOW}--- Installing for macOS (x64) ---${NC}"
        install_adb_mac "x64"
        install_scrcpy_mac "x64"
        echo ""

        echo -e "${YELLOW}--- Installing for macOS (arm64) ---${NC}"
        install_adb_mac "arm64"
        install_scrcpy_mac "arm64"
        echo ""

        echo -e "${YELLOW}--- Installing for Linux (x64) ---${NC}"
        install_adb_linux "x64"
        install_scrcpy_linux "x64"
        echo ""

        echo -e "${YELLOW}--- Installing for Linux (arm64) ---${NC}"
        install_adb_linux "arm64"
        install_scrcpy_linux "arm64"
        echo ""
        ;;
esac

echo -e "${CYAN}============================================${NC}"
print_success "All binaries downloaded successfully!"
echo -e "${CYAN}============================================${NC}"
echo ""
print_info "Next steps:"
print_info "1. Run ./scripts/prepare-binaries.sh backup to create .py backups"
print_info "2. Commit the .py files to git"
echo ""
