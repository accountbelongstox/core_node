#!/bin/bash
# ios_debug.sh - iOS Platform Debugging Script
# Usage: ./scripts/ios_debug.sh [command] [options]

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IOS_APP_DIR="ios-app"
SCHEME="alkaa"
CONFIGURATION="Debug"
SIMULATOR_NAME="iPhone 15 Pro"

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

# Function: List available iOS simulators
list_simulators() {
    print_info "Available iOS simulators:"
    xcrun simctl list devices available | grep -E "iPhone|iPad" | sed 's/^[[:space:]]*/  - /'
}

# Function: Start simulator
start_simulator() {
    local simulator_name=$1
    if [ -z "$simulator_name" ]; then
        simulator_name="$SIMULATOR_NAME"
    fi
    
    print_info "Starting iOS simulator: $simulator_name"
    
    # Check if simulator is already running
    local booted=$(xcrun simctl list devices | grep "$simulator_name" | grep -c "Booted" || true)
    if [ "$booted" -gt 0 ]; then
        print_warning "Simulator $simulator_name is already running"
    else
        # Start simulator
        xcrun simctl boot "$simulator_name" 2>/dev/null || {
            print_error "Failed to start simulator: $simulator_name"
            print_info "Please check if simulator name is correct"
            list_simulators
            exit 1
        }
        print_success "Simulator started"
    fi
    
    # Open Simulator app
    open -a Simulator
}

# Function: Build shared module
build_shared_module() {
    print_info "Building KMP shared module..."
    ./gradlew :shared:packForXcode
    print_success "Shared module built"
}

# Function: Open Xcode project
open_xcode() {
    local workspace_file="${IOS_APP_DIR}/alkaa.xcworkspace"
    local project_file="${IOS_APP_DIR}/alkaa.xcodeproj"
    
    if [ -f "$workspace_file" ]; then
        print_info "Opening Xcode Workspace..."
        open "$workspace_file"
    elif [ -f "$project_file" ]; then
        print_info "Opening Xcode Project..."
        open "$project_file"
    else
        print_error "Xcode project file not found"
        exit 1
    fi
}

# Function: Build and run using xcodebuild
build_and_run() {
    local simulator_name=$1
    if [ -z "$simulator_name" ]; then
        simulator_name="$SIMULATOR_NAME"
    fi
    
    print_info "Building and running with xcodebuild..."
    
    # Get simulator UDID
    local udid=$(xcrun simctl list devices | grep "$simulator_name" | grep -oE '[A-F0-9-]{36}' | head -1)
    
    if [ -z "$udid" ]; then
        print_error "Simulator not found: $simulator_name"
        list_simulators
        exit 1
    fi
    
    print_info "Target simulator UDID: $udid"
    
    # Build shared module
    build_shared_module
    
    # Build app
    print_info "Building iOS app..."
    xcodebuild \
        -workspace "${IOS_APP_DIR}/alkaa.xcworkspace" \
        -scheme "$SCHEME" \
        -configuration "$CONFIGURATION" \
        -destination "id=$udid" \
        clean build
    
    # Install to simulator
    print_info "Installing app to simulator..."
    xcrun simctl install "$udid" "${IOS_APP_DIR}/build/Build/Products/${CONFIGURATION}-iphonesimulator/${SCHEME}.app" 2>/dev/null || {
        print_warning "Installation failed, try running with Xcode"
    }
    
    # Launch app
    print_info "Launching app..."
    xcrun simctl launch "$udid" "com.escodro.alkaa"
    
    print_success "App launched"
}

# Function: View logs
view_logs() {
    print_info "Viewing simulator logs (Press Ctrl+C to exit)..."
    local booted_udid=$(xcrun simctl list devices | grep "Booted" | grep -oE '[A-F0-9-]{36}' | head -1)
    
    if [ -z "$booted_udid" ]; then
        print_error "No running simulator found"
        exit 1
    fi
    
    tail -f ~/Library/Logs/CoreSimulator/$booted_udid/system.log
}

# Function: Record simulator screen
record_screen() {
    local output_file=${1:-"screen_recording.mp4"}
    local booted_udid=$(xcrun simctl list devices | grep "Booted" | grep -oE '[A-F0-9-]{36}' | head -1)
    
    if [ -z "$booted_udid" ]; then
        print_error "No running simulator found"
        exit 1
    fi
    
    print_info "Starting screen recording to: $output_file"
    print_info "Press Ctrl+C to stop recording"
    
    xcrun simctl io booted recordVideo "$output_file"
    print_success "Recording saved to: $output_file"
}

# Function: Set simulator language
set_simulator_language() {
    local simulator_name=$1
    local language=${2:-"zh"}
    local locale=${3:-"zh_CN"}
    
    if [ -z "$simulator_name" ]; then
        simulator_name="$SIMULATOR_NAME"
    fi
    
    print_info "Setting simulator language: $language, locale: $locale"
    xcrun simctl boot "$simulator_name" --language "$language" --locale "$locale"
    print_success "Language set"
}

# Main function
main() {
    print_info "🍎 iOS Debugging Tool"
    echo ""
    
    # Check required commands
    check_command xcrun
    check_command xcodebuild
    
    # Check if on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        print_error "iOS debugging requires macOS"
        exit 1
    fi
    
    # Parse arguments
    case "${1:-}" in
        list)
            list_simulators
            exit 0
            ;;
        simulator)
            start_simulator "$2"
            ;;
        build)
            build_shared_module
            ;;
        open)
            build_shared_module
            open_xcode
            print_info "In Xcode:"
            echo "  1. Select simulator: ${2:-$SIMULATOR_NAME}"
            echo "  2. Select Scheme: $SCHEME"
            echo "  3. Click Run button (⌘ + R)"
            ;;
        run)
            start_simulator "$2"
            build_and_run "$2"
            ;;
        logs)
            view_logs
            ;;
        record)
            record_screen "$2"
            ;;
        language)
            set_simulator_language "$2" "$3" "$4"
            ;;
        *)
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  list                    - List available simulators"
            echo "  simulator [name]        - Start simulator"
            echo "  build                   - Build shared module"
            echo "  open [simulator]        - Build and open Xcode"
            echo "  run [simulator]         - Build and run to simulator"
            echo "  logs                     - View simulator logs"
            echo "  record [filename]       - Record simulator screen"
            echo "  language [name] [lang] [locale] - Set simulator language"
            echo ""
            echo "Examples:"
            echo "  $0 list"
            echo "  $0 simulator \"iPhone 15 Pro\""
            echo "  $0 open"
            echo "  $0 run \"iPhone 15 Pro\""
            echo "  $0 logs"
            echo "  $0 record demo.mp4"
            echo "  $0 language \"iPhone 15 Pro\" zh zh_CN"
            exit 1
            ;;
    esac
}

main "$@"
