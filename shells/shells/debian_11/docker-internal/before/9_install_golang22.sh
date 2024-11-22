#!/bin/bash

GO_DIR_BASE="/usr/lang_compiler"
GO_DIR="$GO_DIR_BASE/go"
GO_BIN="$GO_DIR/bin/go"
GO_VERSION="go1.22.5.linux-amd64"
GO_TAR_URL="https://dl.google.com/go/$GO_VERSION.tar.gz"
TEMP_DIR="/tmp/go_temp"

echo "Checking for existing Go installation in /usr/local/bin..."
if ! command -v go &> /dev/null; then
    echo "Go not found. Starting installation process..."

    mkdir -p "$TEMP_DIR"

    echo "Cleaning up previous downloads..."
    sudo rm -f "$TEMP_DIR/$GO_VERSION.tar.gz"

    echo "Downloading Go $GO_VERSION..."
    sudo wget -O "$TEMP_DIR/$GO_VERSION.tar.gz" "$GO_TAR_URL"

    if [ ! -f "$TEMP_DIR/$GO_VERSION.tar.gz" ]; then
        echo "Error: Download failed."
        exit 1
    fi
else
    echo "Go is already installed."
fi

echo "Ensuring required directories exist..."
if [ ! -d "$GO_DIR_BASE" ]; then
    echo "Creating directory $GO_DIR_BASE..."
    sudo mkdir -p "$GO_DIR_BASE"
fi

if [ ! -d "$GO_DIR" ]; then
    echo "Creating directory $GO_DIR..."
    sudo mkdir -p "$GO_DIR"
fi

if [ ! -e "$GO_BIN" ]; then
    echo "GoBin: $GO_BIN.."
    echo "Extracting Go tarball to $GO_DIR_BASE.."
    sudo tar -C "$GO_DIR_BASE" -xzf "$TEMP_DIR/$GO_VERSION.tar.gz"
else
    echo "Go directory already exists, skipping extraction."
fi

if [ ! -d "$GO_DIR/bin" ]; then
    echo "Error: Extraction failed or directory not found."
    echo "Target directory: $GO_DIR"
    echo "Extraction command: sudo tar -C $GO_DIR_BASE -xzf $TEMP_DIR/$GO_VERSION.tar.gz"
    exit 1
fi

PROXY_URL="https://goproxy.cn,direct"
GOPROXY=$(go env GOPROXY 2>/dev/null)
if [[ $? -ne 0 || $GOPROXY != *"goproxy.cn"* ]]; then
    echo "Setting Go proxy settings..."
    echo "Configuring GOPROXY to $PROXY_URL"
    sudo "$GO_DIR/bin/go" env -w GO111MODULE=on
    sudo "$GO_DIR/bin/go" env -w GOPROXY=$PROXY_URL
else
    echo "GOPROXY is already set to a $PROXY_URL proxy."
fi

if [ ! -f /usr/local/bin/go ]; then
    echo "Creating symlinks for Go binaries in /usr/local/bin..."
    [ -f /usr/local/bin/go ] && sudo rm -f /usr/local/bin/go
    [ -f /usr/local/bin/gofmt ] && sudo rm -f /usr/local/bin/gofmt
    sudo ln -sf "$GO_DIR/bin/go" /usr/local/bin/go
    sudo ln -sf "$GO_DIR/bin/gofmt" /usr/local/bin/gofmt
fi

sudo "$GO_DIR/bin/go" version
echo "GOPROXY setting:"
sudo "$GO_DIR/bin/go" env | grep GOPROXY

if ! command -v go &> /dev/null; then
    echo "Go installation failed."
    echo "GO_DIR: $GO_DIR"
    echo "GO_DIR_BASE: $GO_DIR_BASE"
    echo "GO_VERSION: $GO_VERSION"
    exit 1
fi
