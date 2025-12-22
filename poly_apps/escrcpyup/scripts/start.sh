#!/bin/bash

# ============================================
# 星灿传媒 测试版 - Start Script (Bash)
# ============================================

set -e

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project root directory
cd "$PROJECT_ROOT"

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Output functions
print_success() {
    echo -e "${GREEN}[OK] $1${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

print_info() {
    echo -e "${CYAN}[INFO] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

print_color() {
    echo -e "${2}$1${NC}"
}

# Display Banner
show_banner() {
    clear
    print_color "================================================" "$CYAN"
    print_color "" "$CYAN"
    print_color "        星灿传媒 测试版" "$CYAN"
    print_color "        Android Screen Mirroring Tool" "$CYAN"
    print_color "        Powered by Scrcpy & Electron" "$CYAN"
    print_color "" "$CYAN"
    print_color "================================================" "$CYAN"
    echo ""
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Node.js is installed
check_node() {
    if command_exists node; then
        local node_version=$(node --version)
        print_success "Node.js installed: $node_version"
        return 0
    else
        print_error "Node.js not installed"
        return 1
    fi
}

# Check if pnpm is installed
check_pnpm() {
    if command_exists pnpm; then
        local pnpm_version=$(pnpm --version)
        print_success "pnpm installed: v$pnpm_version"
        return 0
    else
        print_warning "pnpm not installed"
        return 1
    fi
}

# Install pnpm
install_pnpm() {
    print_info "Installing pnpm..."
    if npm install -g pnpm; then
        print_success "pnpm installed successfully"
        return 0
    else
        print_error "Failed to install pnpm"
        return 1
    fi
}

# Check and install dependencies
install_dependencies() {
    print_info "Restoring binary files from .py backups..."
    echo ""

    # Restore binaries (adb, scrcpy, etc.) from .py files
    bash "$SCRIPT_DIR/prepare-binaries.sh" restore

    echo ""
    print_info "Cleaning old dependencies..."
    echo ""

    # Remove node_modules to avoid hoisting conflicts
    if [ -d "node_modules" ]; then
        rm -rf node_modules
    fi

    print_info "Installing all dependencies with pnpm..."
    echo ""

    # Clean install with streaming output
    pnpm install --reporter=append-only

    echo ""
    print_info "Running postinstall for Electron..."
    pnpm run postinstall

    echo ""
    print_info "Fixing Electron installation..."
    pnpm run electron-fix

    echo ""
    print_success "All dependencies ready"
    return 0
}

# Auto-initialize environment
initialize_environment() {
    show_banner
    print_color "=== Environment Initialization ===" "$YELLOW"
    echo ""

    # Check Node.js
    if ! check_node; then
        print_error "Please install Node.js first: https://nodejs.org/"
        echo ""
        read -p "Press Enter to return to main menu..."
        return 1
    fi

    # Check and install pnpm
    if ! check_pnpm; then
        read -p "Install pnpm? (Y/n): " install_choice
        if [[ ! "$install_choice" =~ ^[nN]$ ]]; then
            if ! install_pnpm; then
                read -p "Press Enter to return to main menu..."
                return 1
            fi
        else
            print_warning "Skipped pnpm installation"
            read -p "Press Enter to return to main menu..."
            return 1
        fi
    fi

    # Install project dependencies
    if ! install_dependencies; then
        read -p "Press Enter to return to main menu..."
        return 1
    fi

    echo ""
    print_success "Environment initialization completed!"
    echo ""
    read -p "Press Enter to return to main menu..."
    return 0
}

# Verify Electron version
verify_electron_version() {
    print_info "Verifying Electron installation..."

    local electron_version=$(pnpm exec electron --version 2>/dev/null || true)
    if [ -n "$electron_version" ]; then
        print_success "Local Electron version: $electron_version"
    else
        print_warning "Cannot detect Electron version"
    fi

    return 0
}

# Start development server
start_dev_server() {
    show_banner
    print_color "=== Start Development Server ===" "$YELLOW"
    echo ""

    print_info "Preparing environment..."
    echo ""
    install_dependencies
    echo ""

    verify_electron_version
    echo ""

    print_info "Starting Vite + Electron development server..."
    print_info "Server address: http://localhost:1535"
    echo ""
    print_warning "Press Ctrl+C to stop server"
    echo ""
    print_color "========================================" "$CYAN"
    echo ""

    pnpm run dev

    echo ""
    print_color "========================================" "$CYAN"
    echo ""
    print_info "Development server stopped"
    echo ""
    read -p "Press Enter to return to main menu..."
}

# Launch application directly
start_application() {
    show_banner
    print_color "=== Launch Application ===" "$YELLOW"
    echo ""

    print_info "Preparing environment..."
    echo ""
    install_dependencies
    echo ""

    verify_electron_version
    echo ""

    print_info "Launching 星灿传媒 测试版..."
    echo ""
    print_color "========================================" "$CYAN"
    echo ""

    # Build first if needed
    if [ ! -d "dist" ] || [ ! -d "dist-electron" ]; then
        print_info "First launch, building application..."
        pnpm run build
        echo ""
    fi

    # Start electron directly
    pnpm exec electron .

    echo ""
    print_color "========================================" "$CYAN"
    echo ""
    print_info "Application closed"
    echo ""
    read -p "Press Enter to return to main menu..."
}

# Build project
build_project() {
    local platform=$1

    show_banner
    print_color "=== Build Project ===" "$YELLOW"
    echo ""

    print_info "Preparing environment..."
    echo ""
    install_dependencies
    echo ""

    local build_command=""
    case $platform in
        "Windows")
            build_command="build:win"
            ;;
        "macOS")
            build_command="build:mac"
            ;;
        "Linux")
            build_command="build:linux"
            ;;
        "All")
            build_command="build"
            ;;
        *)
            build_command="build"
            ;;
    esac

    print_info "Build platform: $platform"
    print_info "Execute command: pnpm run $build_command"
    echo ""
    print_color "========================================" "$CYAN"
    echo ""

    local start_time=$(date +%s)
    pnpm run "$build_command"
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    print_color "========================================" "$CYAN"
    echo ""
    print_info "Build completed! Time: ${duration}s"
    print_info "Output directory: dist, dist-electron"
    echo ""
    read -p "Press Enter to return to main menu..."
}

# Select build platform
select_build_platform() {
    show_banner
    print_color "=== Select Build Platform ===" "$YELLOW"
    echo ""

    echo "  1. Windows"
    echo "  2. macOS"
    echo "  3. Linux"
    echo "  4. All Platforms"
    echo "  0. Back to Main Menu"
    echo ""

    read -p "Please select (0-4): " choice

    case $choice in
        1)
            build_project "Windows"
            ;;
        2)
            build_project "macOS"
            ;;
        3)
            build_project "Linux"
            ;;
        4)
            build_project "All"
            ;;
        0)
            return
            ;;
        *)
            print_warning "Invalid selection"
            sleep 1
            select_build_platform
            ;;
    esac
}

# Run code linting
run_lint() {
    show_banner
    print_color "=== Code Linting ===" "$YELLOW"
    echo ""

    print_info "Running ESLint..."
    echo ""
    print_color "========================================" "$CYAN"
    echo ""

    pnpm run lint

    echo ""
    print_color "========================================" "$CYAN"
    echo ""
    read -p "Press Enter to return to main menu..."
}

# Fix code issues
fix_lint() {
    show_banner
    print_color "=== Fix Code Issues ===" "$YELLOW"
    echo ""

    print_info "Auto-fixing code issues..."
    echo ""
    print_color "========================================" "$CYAN"
    echo ""

    pnpm run lint:fix

    echo ""
    print_color "========================================" "$CYAN"
    echo ""
    read -p "Press Enter to return to main menu..."
}

# Clean project
clear_project() {
    show_banner
    print_color "=== Clean Project ===" "$YELLOW"
    echo ""

    read -p "Confirm delete node_modules and dist directories? (y/N): " confirm
    if [[ "$confirm" =~ ^[yY]$ ]]; then
        print_info "Cleaning..."

        if [ -d "node_modules" ]; then
            rm -rf node_modules
            print_success "Deleted node_modules"
        fi

        if [ -d "dist" ]; then
            rm -rf dist
            print_success "Deleted dist"
        fi

        if [ -d "dist-electron" ]; then
            rm -rf dist-electron
            print_success "Deleted dist-electron"
        fi

        echo ""
        print_success "Clean completed!"
    else
        print_info "Cancelled"
    fi

    echo ""
    read -p "Press Enter to return to main menu..."
}

# Display project information
show_project_info() {
    show_banner
    print_color "=== Project Information ===" "$YELLOW"
    echo ""

    # Read package.json
    if [ -f "package.json" ]; then
        local name=$(node -p "require('./package.json').name")
        local version=$(node -p "require('./package.json').version")
        local description=$(node -p "require('./package.json').description")
        local author=$(node -p "require('./package.json').author")

        echo -n "Project Name: "
        print_color "$name" "$GREEN"

        echo -n "Version     : "
        print_color "$version" "$GREEN"

        echo -n "Description : "
        print_color "$description" "$GREEN"

        echo -n "Author      : "
        print_color "$author" "$GREEN"
    fi

    echo ""
    print_info "Project Path: $PROJECT_ROOT"

    # Node version
    if command_exists node; then
        local node_version=$(node --version)
        print_info "Node.js: $node_version"
    fi

    # pnpm version
    if command_exists pnpm; then
        local pnpm_version=$(pnpm --version)
        print_info "pnpm   : v$pnpm_version"
    else
        print_warning "pnpm not installed"
    fi

    echo ""
    read -p "Press Enter to return to main menu..."
}

# Main menu
show_main_menu() {
    while true; do
        show_banner
        print_color "=== Main Menu ===" "$YELLOW"
        echo ""
        echo "  1. Start Development Server"
        echo "  2. Build Project"
        echo "  3. Initialize Environment"
        echo "  4. Code Linting"
        echo "  5. Fix Code Issues"
        echo "  6. Clean Project"
        echo "  7. Project Information"
        echo "  8. Launch Application"
        echo "  0. Exit"
        echo ""

        read -p "Please select (0-8): " choice

        case $choice in
            1)
                start_dev_server
                ;;
            2)
                select_build_platform
                ;;
            3)
                initialize_environment
                # Ask to launch after initialization
                echo ""
                read -p "Environment initialized. Launch application now? (Y/n): " launch
                if [ "$launch" != "n" ] && [ "$launch" != "N" ]; then
                    start_application
                fi
                ;;
            4)
                run_lint
                ;;
            5)
                fix_lint
                ;;
            6)
                clear_project
                ;;
            7)
                show_project_info
                ;;
            8)
                start_application
                ;;
            0)
                echo ""
                print_color "Thank you for using 星灿传媒 测试版!" "$CYAN"
                echo ""
                exit 0
                ;;
            *)
                print_warning "Invalid selection, please try again"
                sleep 1
                ;;
        esac
    done
}

# Start main menu
show_main_menu
