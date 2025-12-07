#!/bin/bash
# parallel_debug.sh - Parallel Debugging for Android and iOS Platforms
# Usage: ./scripts/parallel_debug.sh

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
ANDROID_AVD="${ANDROID_AVD:-Pixel_6_API_34}"
IOS_SIMULATOR="${IOS_SIMULATOR:-iPhone 15 Pro}"
APP_MODULE=":app"
APPLICATION_ID="com.escodro.alkaa"

# Cleanup function
cleanup() {
    echo ""
    print_info "Cleaning up..."
    
    # Stop Android emulator
    if [ -n "$ANDROID_PID" ]; then
        print_info "Stopping Android emulator (PID: $ANDROID_PID)..."
        kill $ANDROID_PID 2>/dev/null || true
    fi
    
    # Shutdown iOS simulator
    if [ -n "$IOS_UDID" ]; then
        print_info "Shutting down iOS simulator..."
        xcrun simctl shutdown "$IOS_UDID" 2>/dev/null || true
    fi
    
    print_success "Cleanup complete"
    exit 0
}

# Set cleanup on exit
trap cleanup EXIT INT TERM

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

print_header() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function: Check command
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed"
        return 1
    fi
    return 0
}

# Function: Start Android emulator
start_android() {
    print_header "🤖 Starting Android Platform"
    
    if ! check_command adb || ! check_command emulator; then
        print_warning "Android tools not installed, skipping Android debugging"
        return 1
    fi
    
    # Check if device is already connected
    if adb devices | grep -q "device$"; then
        print_warning "Android device already connected"
        read -p "Use existing device? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_success "Using existing Android device"
            return 0
        fi
    fi
    
    # Check if emulator exists
    if ! emulator -list-avds | grep -q "$ANDROID_AVD"; then
        print_error "Emulator $ANDROID_AVD does not exist"
        print_info "Available emulators:"
        emulator -list-avds
        read -p "Enter emulator name to use: " ANDROID_AVD
    fi
    
    print_info "Starting Android emulator: $ANDROID_AVD"
    
    # Start emulator (background, no snapshot load for faster startup)
    emulator -avd "$ANDROID_AVD" -no-snapshot-load -no-audio > /tmp/android_emulator.log 2>&1 &
    ANDROID_PID=$!
    
    print_info "Waiting for Android emulator to start (PID: $ANDROID_PID)..."
    
    # Wait for device connection
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if adb devices | grep -q "device$"; then
            break
        fi
        sleep 1
        attempt=$((attempt + 1))
        if [ $((attempt % 10)) -eq 0 ]; then
            echo -n "."
        fi
    done
    echo ""
    
    if adb devices | grep -q "device$"; then
        print_success "Android emulator started and connected"
        
        # Wait for system to fully boot
        print_info "Waiting for system to fully boot..."
        sleep 10
        
        # Install app
        print_info "Installing Android app..."
        ./gradlew ${APP_MODULE}:installDebug > /tmp/android_build.log 2>&1 || {
            print_warning "Android app installation failed, check logs: /tmp/android_build.log"
        }
        
        # Launch app
        print_info "Launching Android app..."
        adb shell am start -n ${APPLICATION_ID}/com.escodro.alkaa.MainActivity || {
            print_warning "Android app launch failed"
        }
        
        return 0
    else
        print_error "Android emulator startup timeout"
        kill $ANDROID_PID 2>/dev/null || true
        return 1
    fi
}

# Function: Start iOS simulator
start_ios() {
    print_header "🍎 Starting iOS Platform"
    
    # Check if on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        print_warning "iOS debugging requires macOS, skipping iOS debugging"
        return 1
    fi
    
    if ! check_command xcrun || ! check_command xcodebuild; then
        print_warning "iOS tools not installed, skipping iOS debugging"
        return 1
    fi
    
    # Check if simulator exists
    local simulator_exists=$(xcrun simctl list devices | grep "$IOS_SIMULATOR" | wc -l)
    if [ "$simulator_exists" -eq 0 ]; then
        print_error "Simulator $IOS_SIMULATOR does not exist"
        print_info "Available simulators:"
        xcrun simctl list devices available | grep -E "iPhone|iPad" | head -5
        read -p "Enter simulator name to use: " IOS_SIMULATOR
    fi
    
    print_info "Starting iOS simulator: $IOS_SIMULATOR"
    
    # Get simulator UDID
    IOS_UDID=$(xcrun simctl list devices | grep "$IOS_SIMULATOR" | grep -oE '[A-F0-9-]{36}' | head -1)
    
    if [ -z "$IOS_UDID" ]; then
        print_error "Simulator not found: $IOS_SIMULATOR"
        return 1
    fi
    
    # Check if already running
    local is_booted=$(xcrun simctl list devices | grep "$IOS_SIMULATOR" | grep -c "Booted" || true)
    if [ "$is_booted" -eq 0 ]; then
        # Start simulator
        xcrun simctl boot "$IOS_UDID" 2>/dev/null || {
            print_error "Failed to start iOS simulator"
            return 1
        }
        print_success "iOS simulator started"
    else
        print_warning "iOS simulator already running"
    fi
    
    # Open Simulator app
    open -a Simulator
    
    # Build shared module
    print_info "Building KMP shared module..."
    ./gradlew :shared:packForXcode > /tmp/ios_build.log 2>&1 || {
        print_warning "Shared module build failed, check logs: /tmp/ios_build.log"
    }
    
    # Open Xcode
    print_info "Opening Xcode project..."
    if [ -f "ios-app/alkaa.xcworkspace" ]; then
        open ios-app/alkaa.xcworkspace
    elif [ -f "ios-app/alkaa.xcodeproj" ]; then
        open ios-app/alkaa.xcodeproj
    else
        print_warning "Xcode project file not found"
    fi
    
    print_info "In Xcode:"
    echo "  1. Select simulator: $IOS_SIMULATOR"
    echo "  2. Select Scheme: alkaa"
    echo "  3. Click Run button (⌘ + R)"
    
    return 0
}

# Function: Show debug info
show_debug_info() {
    print_header "📝 Debug Information"
    
    echo ""
    echo "Android Platform:"
    if [ -n "$ANDROID_PID" ]; then
        echo "  - Emulator: $ANDROID_AVD (PID: $ANDROID_PID)"
        echo "  - Logs: adb logcat -s 'Alkaa' 'WordFlow'"
        echo "  - View logs: tail -f /tmp/android_emulator.log"
    else
        echo "  - Not started"
    fi
    
    echo ""
    echo "iOS Platform:"
    if [ -n "$IOS_UDID" ]; then
        echo "  - Simulator: $IOS_SIMULATOR (UDID: $IOS_UDID)"
        echo "  - Logs: tail -f ~/Library/Logs/CoreSimulator/$IOS_UDID/system.log"
        echo "  - View build logs: tail -f /tmp/ios_build.log"
    else
        echo "  - Not started"
    fi
    
    echo ""
    echo "Common Commands:"
    echo "  - Android logs: adb logcat | grep -E '(Alkaa|WordFlow)'"
    echo "  - iOS logs: tail -f ~/Library/Logs/CoreSimulator/*/system.log"
    echo "  - Stop debugging: Press Ctrl+C"
    echo ""
}

# Main function
main() {
    print_header "🚀 Kotlin Multiplatform Parallel Debugging"
    echo ""
    
    # Start Android
    ANDROID_STARTED=false
    if start_android; then
        ANDROID_STARTED=true
    fi
    
    echo ""
    
    # Start iOS
    IOS_STARTED=false
    if start_ios; then
        IOS_STARTED=true
    fi
    
    echo ""
    
    # Show debug info
    show_debug_info
    
    if [ "$ANDROID_STARTED" = false ] && [ "$IOS_STARTED" = false ]; then
        print_error "Failed to start any platform"
        exit 1
    fi
    
    print_success "Debugging environment ready!"
    echo ""
    print_info "Press Ctrl+C to stop debugging..."
    
    # Keep script running
    while true; do
        sleep 1
    done
}

main "$@"
