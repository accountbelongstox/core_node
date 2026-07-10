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
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Source gvar_common.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

INSTALL_GO=$(get_var "INSTALL_GO")
INSTALL_MODE=$(get_var "INSTALL_MODE")

if [ "$INSTALL_GO" = "false" ]; then
    echo "Skipping Go installation,INSTALL_GO: $INSTALL_GO,INSTALL_MODE: $INSTALL_MODE" 
    exit 0
fi


# Get region information
SELECTED_REGION=$(get_var "SELECTED_REGION")
# Use global temporary directory structure
SCRIPT_TEMP_DIR=$(create_script_temp_dir "55_install_golang22")

echo "Checking for existing Go installation in /usr/local/bin..."
if [ ! -x "$GO_BIN" ]; then
    echo "Go not found. Starting installation process..."

    mkdir -p "$SCRIPT_TEMP_DIR"

    echo "Cleaning up previous downloads..."
    $USE_SUDO rm -f "$SCRIPT_TEMP_DIR/$GO_VERSION_AMD64_FILE.tar.gz"

    echo "Downloading Go $GO_VERSION_AMD64_FILE..."
    $USE_SUDO wget -O "$SCRIPT_TEMP_DIR/$GO_VERSION_AMD64_FILE.tar.gz" "$GO_TAR_URL"

    if [ ! -f "$SCRIPT_TEMP_DIR/$GO_VERSION_AMD64_FILE.tar.gz" ]; then
        echo "Error: Download failed."
        exit 1
    fi
else
    echo "Go is already installed."
fi

echo "Ensuring required directories exist..."
if [ ! -d "$COMPILE_DIR" ]; then
    echo "Creating directory $COMPILE_DIR..."
    $USE_SUDO mkdir -p "$COMPILE_DIR"
fi

if [ ! -d "$GO_DIR" ]; then
    echo "Creating directory $GO_DIR..."
    $USE_SUDO mkdir -p "$GO_DIR"
fi

if [ ! -e "$GO_BIN" ]; then
    if [ ! -f "$SCRIPT_TEMP_DIR/$GO_VERSION_AMD64_FILE.tar.gz" ]; then
        echo "Go tarball missing (download was skipped because a non-$GO_DIR go is on PATH); downloading now..."
        $USE_SUDO wget -O "$SCRIPT_TEMP_DIR/$GO_VERSION_AMD64_FILE.tar.gz" "$GO_TAR_URL"
    fi
    echo "GoBin: $GO_BIN.."
    echo "Extracting Go tarball to $COMPILE_DIR.."
    $USE_SUDO tar -C "$COMPILE_DIR" -xzf "$SCRIPT_TEMP_DIR/$GO_VERSION_AMD64_FILE.tar.gz"
else
    echo "Go directory already exists, skipping extraction."
fi

if [ ! -d "$GO_DIR/bin" ]; then
    echo "Error: Extraction failed or directory not found."
    echo "Target directory: $GO_DIR"
    echo "Extraction command: $USE_SUDO tar -C $COMPILE_DIR -xzf $SCRIPT_TEMP_DIR/$GO_VERSION_AMD64_FILE.tar.gz"
    exit 1
fi

# Configure GOPROXY based on selected region
echo "Configuring Go proxy settings based on region: $SELECTED_REGION"

if [ "$SELECTED_REGION" = "Global" ]; then
    echo "Region is Global - using default Go proxy settings"
    echo "GOPROXY will use Go's default proxy (proxy.golang.org)"

    # Check current GOPROXY
    CURRENT_GOPROXY=$("$GO_DIR/bin/go" env GOPROXY 2>/dev/null)

    # If it's set to China proxy, reset to default
    if [[ "$CURRENT_GOPROXY" == *"goproxy.cn"* ]]; then
        echo "Removing China proxy configuration..."
        $USE_SUDO "$GO_DIR/bin/go" env -w GOPROXY=https://proxy.golang.org,direct
        echo "Reset GOPROXY to default: https://proxy.golang.org,direct"
    else
        echo "GOPROXY is already set to: $CURRENT_GOPROXY"
    fi
else
    # China or other regions - use China proxy
    PROXY_URL="https://goproxy.cn,direct"
    CURRENT_GOPROXY=$("$GO_DIR/bin/go" env GOPROXY 2>/dev/null)

    if [[ "$CURRENT_GOPROXY" != *"goproxy.cn"* ]]; then
        echo "Setting Go proxy for China region..."
        echo "Configuring GOPROXY to $PROXY_URL"
        $USE_SUDO "$GO_DIR/bin/go" env -w GO111MODULE=on
        $USE_SUDO "$GO_DIR/bin/go" env -w GOPROXY=$PROXY_URL
        echo "GOPROXY configured to: $PROXY_URL"
    else
        echo "GOPROXY is already set to: $CURRENT_GOPROXY"
    fi
fi

# Always ensure symlinks are correctly set (fix if broken or outdated)
echo "Ensuring Go symlinks are correctly set in /usr/local/bin..."

# Remove old symlinks if they exist
[ -L /usr/local/bin/go ] && $USE_SUDO rm -f /usr/local/bin/go
[ -L /usr/local/bin/gofmt ] && $USE_SUDO rm -f /usr/local/bin/gofmt

# Create fresh symlinks
$USE_SUDO ln -sf "$GO_DIR/bin/go" /usr/local/bin/go
$USE_SUDO ln -sf "$GO_DIR/bin/gofmt" /usr/local/bin/gofmt

echo "Symlinks created:"
echo "  /usr/local/bin/go -> $GO_DIR/bin/go"
echo "  /usr/local/bin/gofmt -> $GO_DIR/bin/gofmt"

$USE_SUDO "$GO_DIR/bin/go" version
echo "GOPROXY setting:"
$USE_SUDO "$GO_DIR/bin/go" env | grep GOPROXY

if ! command -v go &>/dev/null; then
    echo "Go installation failed."
    echo "GO_DIR: $GO_DIR"
    echo "COMPILE_DIR: $COMPILE_DIR"
    echo "GO_VERSION_AMD64_FILE: $GO_VERSION_AMD64_FILE"
    exit 1
fi
