#!/bin/bash
# android_debug.sh - Android Platform Debugging Script
# Usage: ./scripts/android_debug.sh [command] [options]

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_MODULE=":app"
BUILD_TYPE="Debug"
APPLICATION_ID="com.escodro.alkaa"

# Functions: Print colored messages
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function: Check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed, please install it first"
        exit 1
    fi
}

# Function: List available Android emulators
list_emulators() {
    print_info "Available Android emulators:"
    emulator -list-avds | while read avd; do
        echo "  - $avd"
    done
}

# Function: Start emulator
start_emulator() {
    local avd_name=$1
    if [ -z "$avd_name" ]; then
        print_warning "No emulator name specified, listing available emulators:"
        list_emulators
        read -p "Enter emulator name to start: " avd_name
    fi
    
    print_info "Starting Android emulator: $avd_name"
    
    # Check if emulator is already running
    if adb devices | grep -q "emulator"; then
        print_warning "Emulator is already running"
        read -p "Continue? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
    
    # Start emulator (background)
    emulator -avd "$avd_name" -netdelay none -netspeed full > /dev/null 2>&1 &
    EMULATOR_PID=$!
    
    print_info "Waiting for emulator to start (PID: $EMULATOR_PID)..."
    adb wait-for-device
    
    # Wait for system to fully boot
    print_info "Waiting for system to fully boot..."
    sleep 10
    
    # Check if device is online
    if adb devices | grep -q "device$"; then
        print_success "Emulator started and connected"
    else
        print_error "Failed to start emulator"
        exit 1
    fi
}

# Function: Check device connection
check_device() {
    local devices=$(adb devices | grep -v "List" | grep "device$" | wc -l)
    if [ "$devices" -eq 0 ]; then
        print_error "No connected device detected"
        print_info "Please ensure:"
        echo "  1. USB debugging is enabled"
        echo "  2. Device is connected or emulator is started"
        echo "  3. Computer is authorized for debugging"
        exit 1
    elif [ "$devices" -gt 1 ]; then
        print_warning "Multiple devices detected, using first device"
        adb devices
    else
        print_success "Device detected"
        adb devices
    fi
}

# Function: Install app to device
install_app() {
    local device_id=$1
    
    print_info "Building and installing app..."
    
    if [ -n "$device_id" ]; then
        ./gradlew ${APP_MODULE}:installDebug -Pandroid.injected.build.devices=$device_id
    else
        ./gradlew ${APP_MODULE}:installDebug
    fi
    
    print_success "App installed"
}

# Function: Launch app
launch_app() {
    print_info "Launching app..."
    adb shell am start -n ${APPLICATION_ID}/com.escodro.alkaa.MainActivity
    print_success "App launched"
}

# Function: View logs
view_logs() {
    print_info "Viewing app logs (Press Ctrl+C to exit)..."
    adb logcat -c  # Clear logs
    adb logcat | grep -E "(${APPLICATION_ID}|Alkaa|WordFlow)"
}

# Function: Setup wireless debugging
setup_wireless_debug() {
    print_info "Setting up wireless debugging..."
    print_info "On your phone:"
    echo "  1. Open Settings → System → Developer options"
    echo "  2. Enable Wireless debugging"
    echo "  3. Tap Wireless debugging → Pair device with pairing code"
    echo ""
    read -p "Enter pairing IP and port (e.g., 192.168.1.100:40407): " pair_address
    read -p "Enter pairing code: " pair_code
    
    adb pair $pair_address
    read -p "Enter connection IP and port (e.g., 192.168.1.100:40407): " connect_address
    adb connect $connect_address
    
    print_success "Wireless debugging connected"
}

# Main function
main() {
    print_info "🚀 Android Debugging Tool"
    echo ""
    
    # Check required commands
    check_command adb
    check_command emulator
    
    # Parse arguments
    case "${1:-}" in
        list)
            list_emulators
            exit 0
            ;;
        emulator)
            start_emulator "$2"
            install_app
            launch_app
            ;;
        device)
            check_device
            install_app
            launch_app
            ;;
        install)
            check_device
            install_app "$2"
            ;;
        launch)
            launch_app
            ;;
        logs)
            view_logs
            ;;
        wireless)
            setup_wireless_debug
            ;;
        *)
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  list              - List available emulators"
            echo "  emulator [name]   - Start emulator and install app"
            echo "  device            - Install app on connected device"
            echo "  install [device]  - Install app only"
            echo "  launch            - Launch app only"
            echo "  logs              - View app logs"
            echo "  wireless          - Setup wireless debugging"
            echo ""
            echo "Examples:"
            echo "  $0 list"
            echo "  $0 emulator Pixel_6_API_34"
            echo "  $0 device"
            echo "  $0 logs"
            exit 1
            ;;
    esac
}

main "$@"
