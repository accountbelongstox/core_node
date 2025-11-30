#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
SCRIPT_INDEX="40"
ITTOOLS_BIN_DIR=""
USR_LOCAL_BIN="/usr/local/bin"
INSTALL_ITTOOLS_BINARIES=""
INSTALL_MODE=""

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

INSTALL_ITTOOLS_BINARIES=$(get_var "INSTALL_ITTOOLS_BINARIES" "true")
INSTALL_MODE=$(get_var "INSTALL_MODE" "auto")

ITTOOLS_BIN_DIR=$(map_web_path "compile_dir")

echo "[$SCRIPT_INDEX] ITTools Binary Dependencies Installation"
echo "[$SCRIPT_INDEX] INSTALL_ITTOOLS_BINARIES: $INSTALL_ITTOOLS_BINARIES"
echo "[$SCRIPT_INDEX] INSTALL_MODE: $INSTALL_MODE"
echo "[$SCRIPT_INDEX] Target directory: $ITTOOLS_BIN_DIR"

if [ "$INSTALL_ITTOOLS_BINARIES" != "true" ]; then
    echo "[$SCRIPT_INDEX] Skipping ITTools binary installation (INSTALL_ITTOOLS_BINARIES != true)"
    exit 0
fi

print_header_from_common_functions "ITTools Binary Dependencies Setup"

create_ittools_bin_directory() {
    echo "[$SCRIPT_INDEX] Creating ITTools binary directories in: $ITTOOLS_BIN_DIR"
    
    local tool_dirs=(
        "poppler"
        "ghostscript"
        "pdftk"
        "qpdf"
        "libreoffice"
        "imagemagick"
        "graphicsmagick"
        "ffmpeg"
        "network-tools"
        "compression-tools"
        "barcode-tools"
    )
    
    for dir in "${tool_dirs[@]}"; do
        $USE_SUDO mkdir -p "$ITTOOLS_BIN_DIR/$dir"
        $USE_SUDO chmod 755 "$ITTOOLS_BIN_DIR/$dir"
    done
    
    if [ ! -d "$ITTOOLS_BIN_DIR" ]; then
        echo "[$SCRIPT_INDEX] ERROR: Failed to create directory: $ITTOOLS_BIN_DIR"
        return 1
    fi
    
    echo "[$SCRIPT_INDEX] Directories created successfully"
    return 0
}

update_package_list() {
    print_step_from_common_functions "Updating package list"
    $USE_SUDO apt-get update -qq || {
        echo "[$SCRIPT_INDEX] WARNING: apt-get update failed, continuing anyway"
    }
}

install_pdf_tools() {
    print_step_from_common_functions "Installing PDF processing tools"
    
    local pdf_packages=(
        "poppler-utils"
        "ghostscript"
        "pdftk"
        "qpdf"
        "imagemagick"
    )
    
    for pkg in "${pdf_packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $pkg "; then
            echo "[$SCRIPT_INDEX] Installing $pkg..."
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$pkg" || {
                echo "[$SCRIPT_INDEX] WARNING: Failed to install $pkg"
            }
        else
            echo "[$SCRIPT_INDEX] $pkg already installed"
        fi
    done
    
    create_symlinks_for_pdf_tools
}

create_symlinks_for_pdf_tools() {
    local pdf_bins=(
        "pdfinfo"
        "pdftotext"
        "pdftoppm"
        "pdfunite"
        "pdfseparate"
        "gs"
        "pdftk"
        "qpdf"
    )
    
    for bin in "${pdf_bins[@]}"; do
        local bin_path=$(command -v "$bin" 2>/dev/null)
        if [ -n "$bin_path" ] && [ -x "$bin_path" ]; then
            $USE_SUDO ln -sf "$bin_path" "$USR_LOCAL_BIN/$bin" 2>/dev/null || true
            echo "[$SCRIPT_INDEX] Linked: $bin -> $bin_path"
        fi
    done
}

install_document_tools() {
    print_step_from_common_functions "Installing document processing tools"
    
    local doc_packages=(
        "libreoffice-writer"
        "libreoffice-calc"
        "unoconv"
        "antiword"
        "catdoc"
        "pandoc"
    )
    
    for pkg in "${doc_packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $pkg "; then
            echo "[$SCRIPT_INDEX] Installing $pkg..."
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$pkg" || {
                echo "[$SCRIPT_INDEX] WARNING: Failed to install $pkg"
            }
        else
            echo "[$SCRIPT_INDEX] $pkg already installed"
        fi
    done
    
    create_symlinks_for_doc_tools
}

create_symlinks_for_doc_tools() {
    local doc_bins=(
        "libreoffice"
        "unoconv"
        "antiword"
        "catdoc"
        "pandoc"
    )
    
    for bin in "${doc_bins[@]}"; do
        local bin_path=$(command -v "$bin" 2>/dev/null)
        if [ -n "$bin_path" ] && [ -x "$bin_path" ]; then
            $USE_SUDO ln -sf "$bin_path" "$USR_LOCAL_BIN/$bin" 2>/dev/null || true
            echo "[$SCRIPT_INDEX] Linked: $bin -> $bin_path"
        fi
    done
}

install_image_tools() {
    print_step_from_common_functions "Installing image processing tools"
    
    local image_packages=(
        "imagemagick"
        "graphicsmagick"
        "optipng"
        "jpegoptim"
        "pngquant"
        "webp"
        "libvips-tools"
    )
    
    for pkg in "${image_packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $pkg "; then
            echo "[$SCRIPT_INDEX] Installing $pkg..."
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$pkg" || {
                echo "[$SCRIPT_INDEX] WARNING: Failed to install $pkg"
            }
        else
            echo "[$SCRIPT_INDEX] $pkg already installed"
        fi
    done
    
    create_symlinks_for_image_tools
}

create_symlinks_for_image_tools() {
    local image_bins=(
        "convert"
        "identify"
        "mogrify"
        "composite"
        "gm"
        "optipng"
        "jpegoptim"
        "pngquant"
        "cwebp"
        "dwebp"
        "vips"
        "vipsthumbnail"
    )
    
    for bin in "${image_bins[@]}"; do
        local bin_path=$(command -v "$bin" 2>/dev/null)
        if [ -n "$bin_path" ] && [ -x "$bin_path" ]; then
            $USE_SUDO ln -sf "$bin_path" "$USR_LOCAL_BIN/$bin" 2>/dev/null || true
            echo "[$SCRIPT_INDEX] Linked: $bin -> $bin_path"
        fi
    done
}

install_ffmpeg() {
    print_step_from_common_functions "Installing FFmpeg for audio/video processing"
    
    local ffmpeg_packages=(
        "ffmpeg"
        "libavcodec-extra"
    )
    
    for pkg in "${ffmpeg_packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $pkg "; then
            echo "[$SCRIPT_INDEX] Installing $pkg..."
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$pkg" || {
                echo "[$SCRIPT_INDEX] WARNING: Failed to install $pkg"
            }
        else
            echo "[$SCRIPT_INDEX] $pkg already installed"
        fi
    done
    
    create_symlinks_for_ffmpeg
}

create_symlinks_for_ffmpeg() {
    local ffmpeg_bins=(
        "ffmpeg"
        "ffprobe"
        "ffplay"
    )
    
    for bin in "${ffmpeg_bins[@]}"; do
        local bin_path=$(command -v "$bin" 2>/dev/null)
        if [ -n "$bin_path" ] && [ -x "$bin_path" ]; then
            $USE_SUDO ln -sf "$bin_path" "$USR_LOCAL_BIN/$bin" 2>/dev/null || true
            echo "[$SCRIPT_INDEX] Linked: $bin -> $bin_path"
        fi
    done
}

install_network_tools() {
    print_step_from_common_functions "Installing network diagnostic tools"
    
    local net_packages=(
        "iputils-ping"
        "net-tools"
        "dnsutils"
        "curl"
        "wget"
        "netcat-openbsd"
        "traceroute"
    )
    
    for pkg in "${net_packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $pkg "; then
            echo "[$SCRIPT_INDEX] Installing $pkg..."
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$pkg" || {
                echo "[$SCRIPT_INDEX] WARNING: Failed to install $pkg"
            }
        else
            echo "[$SCRIPT_INDEX] $pkg already installed"
        fi
    done
    
    create_symlinks_for_network_tools
}

create_symlinks_for_network_tools() {
    local net_bins=(
        "ping"
        "traceroute"
        "nslookup"
        "dig"
        "curl"
        "wget"
        "nc"
        "netstat"
        "ifconfig"
    )
    
    for bin in "${net_bins[@]}"; do
        local bin_path=$(command -v "$bin" 2>/dev/null)
        if [ -n "$bin_path" ] && [ -x "$bin_path" ]; then
            $USE_SUDO ln -sf "$bin_path" "$USR_LOCAL_BIN/$bin" 2>/dev/null || true
            echo "[$SCRIPT_INDEX] Linked: $bin -> $bin_path"
        fi
    done
}

install_compression_tools() {
    print_step_from_common_functions "Installing compression/archive tools"
    
    local compress_packages=(
        "zip"
        "unzip"
        "tar"
        "gzip"
        "bzip2"
        "xz-utils"
        "p7zip-full"
        "rar"
        "unrar"
    )
    
    for pkg in "${compress_packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $pkg "; then
            echo "[$SCRIPT_INDEX] Installing $pkg..."
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$pkg" || {
                echo "[$SCRIPT_INDEX] WARNING: Failed to install $pkg"
            }
        else
            echo "[$SCRIPT_INDEX] $pkg already installed"
        fi
    done
    
    create_symlinks_for_compression_tools
}

create_symlinks_for_compression_tools() {
    local compress_bins=(
        "zip"
        "unzip"
        "tar"
        "gzip"
        "gunzip"
        "bzip2"
        "bunzip2"
        "xz"
        "unxz"
        "7z"
        "7za"
        "rar"
        "unrar"
    )
    
    for bin in "${compress_bins[@]}"; do
        local bin_path=$(command -v "$bin" 2>/dev/null)
        if [ -n "$bin_path" ] && [ -x "$bin_path" ]; then
            $USE_SUDO ln -sf "$bin_path" "$USR_LOCAL_BIN/$bin" 2>/dev/null || true
            echo "[$SCRIPT_INDEX] Linked: $bin -> $bin_path"
        fi
    done
}

install_barcode_qr_tools() {
    print_step_from_common_functions "Installing barcode/QR code tools"
    
    local barcode_packages=(
        "zbar-tools"
        "qrencode"
    )
    
    for pkg in "${barcode_packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $pkg "; then
            echo "[$SCRIPT_INDEX] Installing $pkg..."
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$pkg" || {
                echo "[$SCRIPT_INDEX] WARNING: Failed to install $pkg"
            }
        else
            echo "[$SCRIPT_INDEX] $pkg already installed"
        fi
    done
    
    create_symlinks_for_barcode_tools
}

create_symlinks_for_barcode_tools() {
    local barcode_bins=(
        "zbarimg"
        "zbarcam"
        "qrencode"
    )
    
    for bin in "${barcode_bins[@]}"; do
        local bin_path=$(command -v "$bin" 2>/dev/null)
        if [ -n "$bin_path" ] && [ -x "$bin_path" ]; then
            $USE_SUDO ln -sf "$bin_path" "$USR_LOCAL_BIN/$bin" 2>/dev/null || true
            echo "[$SCRIPT_INDEX] Linked: $bin -> $bin_path"
        fi
    done
}

verify_php_access() {
    print_step_from_common_functions "Verifying PHP can access binaries"
    
    local test_bins=(
        "convert"
        "ffmpeg"
        "pdfinfo"
        "ping"
        "zip"
    )
    
    for bin in "${test_bins[@]}"; do
        if command -v "$bin" >/dev/null 2>&1; then
            local bin_path=$(command -v "$bin")
            echo "[$SCRIPT_INDEX] âœ?$bin accessible at: $bin_path"
        else
            echo "[$SCRIPT_INDEX] âœ?$bin NOT accessible"
        fi
    done
}

configure_imagemagick_policy() {
    print_step_from_common_functions "Configuring ImageMagick security policy"
    
    local policy_file="/etc/ImageMagick-6/policy.xml"
    
    if [ ! -f "$policy_file" ]; then
        policy_file="/etc/ImageMagick/policy.xml"
    fi
    
    if [ -f "$policy_file" ]; then
        echo "[$SCRIPT_INDEX] Updating ImageMagick policy to allow PDF processing"
        
        $USE_SUDO sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/g' "$policy_file" 2>/dev/null || true
        $USE_SUDO sed -i 's/rights="none" pattern="XPS"/rights="read|write" pattern="XPS"/g' "$policy_file" 2>/dev/null || true
        
        echo "[$SCRIPT_INDEX] ImageMagick policy updated"
    else
        echo "[$SCRIPT_INDEX] ImageMagick policy file not found, skipping"
    fi
}

fix_and_reset_configuration() {
    print_step_from_common_functions "Fixing and resetting all configurations"
    
    echo "[$SCRIPT_INDEX] Ensuring /usr/local/bin exists"
    $USE_SUDO mkdir -p "$USR_LOCAL_BIN"
    $USE_SUDO chmod 755 "$USR_LOCAL_BIN"
    
    echo "[$SCRIPT_INDEX] Refreshing all symlinks"
    create_symlinks_for_pdf_tools
    create_symlinks_for_doc_tools
    create_symlinks_for_image_tools
    create_symlinks_for_ffmpeg
    create_symlinks_for_network_tools
    create_symlinks_for_compression_tools
    create_symlinks_for_barcode_tools
    
    echo "[$SCRIPT_INDEX] Configuration reset complete"
}

main() {
    create_ittools_bin_directory || exit 1
    
    update_package_list
    
    install_pdf_tools
    install_document_tools
    install_image_tools
    install_ffmpeg
    install_network_tools
    install_compression_tools
    install_barcode_qr_tools
    
    configure_imagemagick_policy
    fix_and_reset_configuration
    verify_php_access
    
    print_success_from_common_functions "ITTools binary dependencies installation complete"
    echo "[$SCRIPT_INDEX] All tools installed to: $ITTOOLS_BIN_DIR"
    echo "[$SCRIPT_INDEX] Symlinks created in: $USR_LOCAL_BIN"
    echo "[$SCRIPT_INDEX] PHP should now have access to all required binaries"
}

main "$@"
