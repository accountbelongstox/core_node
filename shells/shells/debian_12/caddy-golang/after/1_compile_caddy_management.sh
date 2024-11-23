#!/bin/bash

# Read global variables
SCRIPT_ROOT_DIR=$(cat "/usr/script_global_var/SCRIPT_ROOT_DIR")
CADDY_APP_DIR="$SCRIPT_ROOT_DIR/apps/CaddyProxyManager"
FRONTEND_DIR="$CADDY_APP_DIR/frontend"
BACKEND_DIR="$CADDY_APP_DIR/backend"
ASSETS_DIR="$BACKEND_DIR/embed/assets"
BUILD_DIR="$FRONTEND_DIR/build"

# Check if CaddyProxyManager directory exists
if [ ! -d "$CADDY_APP_DIR" ]; then
    echo -e "\033[0;31mError: CaddyProxyManager directory not found at: $CADDY_APP_DIR\033[0m"
    exit 1
fi

# Function to check if frontend build files are already in assets
check_assets() {
    if [ -d "$ASSETS_DIR" ] && [ "$(ls -A "$ASSETS_DIR")" ]; then
        echo -e "\033[0;34mAssets directory already contains files, skipping frontend build...\033[0m"
        return 0
    fi
    return 1
}

# Function to build frontend
build_frontend() {
    echo -e "\033[0;34mBuilding frontend...\033[0m"
    
    # Check if frontend directory exists
    if [ ! -d "$FRONTEND_DIR" ]; then
        echo -e "\033[0;31mError: Frontend directory not found at: $FRONTEND_DIR\033[0m"
        exit 1
    fi

    # Navigate to frontend directory
    cd "$FRONTEND_DIR" || exit 1

    # Install dependencies
    echo -e "\033[0;34mInstalling frontend dependencies...\033[0m"
    yarn install || {
        echo -e "\033[0;31mError: Failed to install frontend dependencies\033[0m"
        exit 1
    }

    # Build frontend
    echo -e "\033[0;34mBuilding frontend production build...\033[0m"
    yarn build || {
        echo -e "\033[0;31mError: Failed to build frontend\033[0m"
        exit 1
    }
}

# Function to copy build files to assets
copy_to_assets() {
    echo -e "\033[0;34mCopying build files to assets directory...\033[0m"
    
    # Create assets directory if it doesn't exist
    mkdir -p "$ASSETS_DIR" || {
        echo -e "\033[0;31mError: Failed to create assets directory\033[0m"
        exit 1
    }

    # Copy build files to assets
    cp -r "$BUILD_DIR/"* "$ASSETS_DIR/" || {
        echo -e "\033[0;31mError: Failed to copy build files to assets\033[0m"
        exit 1
    }
}

# Function to build backend
build_backend() {
    echo -e "\033[0;34mBuilding backend...\033[0m"
    
    # Check if backend directory exists
    if [ ! -d "$BACKEND_DIR" ]; then
        echo -e "\033[0;31mError: Backend directory not found at: $BACKEND_DIR\033[0m"
        exit 1
    fi

    # Navigate to backend directory
    cd "$BACKEND_DIR" || exit 1

    # Build backend
    echo -e "\033[0;34mCompiling Go backend...\033[0m"
    go build cmd/main.go || {
        echo -e "\033[0;31mError: Failed to compile backend\033[0m"
        exit 1
    }
}

# Main process
main() {
    echo -e "\033[0;34mStarting Caddy Management compilation process...\033[0m"

    # Only build frontend and copy assets if they don't exist
    if ! check_assets; then
        build_frontend
        copy_to_assets
    fi

    # Build backend
    build_backend

    echo -e "\033[0;32mCaddy Management compilation completed successfully!\033[0m"
}

# Run main process
main

