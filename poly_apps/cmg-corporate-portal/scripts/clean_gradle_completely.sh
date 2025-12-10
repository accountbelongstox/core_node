#!/usr/bin/env bash
# -*- coding: utf-8 -*-
#
# Complete Gradle cache cleanup script
# Use this when normal build fails due to corrupted cache

set +e  # Continue on errors

# Colors
COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_CYAN='\033[0;36m'
COLOR_GRAY='\033[0;37m'
COLOR_RESET='\033[0m'

print_color() {
    local color=$1
    shift
    echo -e "${color}$@${COLOR_RESET}"
}

print_section() {
    echo ""
    print_color "$COLOR_CYAN" "============================================================"
    print_color "$COLOR_CYAN" "$1"
    print_color "$COLOR_CYAN" "============================================================"
}

# Check if running with force flag
FORCE=0
if [ "$1" = "-f" ] || [ "$1" = "--force" ]; then
    FORCE=1
fi

print_section "Complete Gradle Cache Cleanup"

if [ $FORCE -eq 0 ]; then
    print_color "$COLOR_YELLOW" "This will:"
    print_color "$COLOR_GRAY" "  1. Stop all Gradle daemon processes"
    print_color "$COLOR_GRAY" "  2. Delete user Gradle cache (~/.gradle/caches)"
    print_color "$COLOR_GRAY" "  3. Delete project .gradle directories"
    print_color "$COLOR_GRAY" "  4. Clean project build directories"
    echo ""
    print_color "$COLOR_RED" "WARNING: This will affect ALL Gradle projects on this machine!"
    print_color "$COLOR_RED" "         All projects will need to re-download dependencies."
    echo ""

    read -p "Continue? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_color "$COLOR_YELLOW" "Cancelled by user"
        exit 0
    fi
fi

# Get paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ANDROID_PATH="$PROJECT_ROOT/android"

print_section "Step 1: Stop Gradle Daemons"

if [ -d "$ANDROID_PATH" ]; then
    cd "$ANDROID_PATH"

    print_color "$COLOR_CYAN" "[Gradle] Stopping all Gradle daemons..."
    ./gradlew --stop 2>/dev/null
    sleep 2
    print_color "$COLOR_GREEN" "[Success] Gradle daemons stopped"
fi

# Force kill any remaining Gradle processes
print_color "$COLOR_CYAN" "[System] Checking for running Gradle processes..."
GRADLE_PIDS=$(pgrep -f "gradle|GradleDaemon" 2>/dev/null || true)
if [ -n "$GRADLE_PIDS" ]; then
    PROCESS_COUNT=$(echo "$GRADLE_PIDS" | wc -l)
    print_color "$COLOR_YELLOW" "[System] Found $PROCESS_COUNT Gradle processes, terminating..."
    echo "$GRADLE_PIDS" | xargs kill -9 2>/dev/null || true
    sleep 2
    print_color "$COLOR_GREEN" "[Success] Processes terminated"
else
    print_color "$COLOR_GRAY" "[Info] No Gradle processes running"
fi

print_section "Step 2: Clean User Gradle Cache"

USER_GRADLE_DIR="$HOME/.gradle"
USER_CACHE_DIR="$USER_GRADLE_DIR/caches"

if [ -d "$USER_CACHE_DIR" ]; then
    print_color "$COLOR_CYAN" "[Gradle] User cache directory: $USER_CACHE_DIR"

    # Get size before
    SIZE_BEFORE=$(du -sh "$USER_CACHE_DIR" 2>/dev/null | cut -f1 || echo "Unknown")
    print_color "$COLOR_GRAY" "[Info] Cache size: $SIZE_BEFORE"

    print_color "$COLOR_CYAN" "[Gradle] Deleting cache contents..."
    rm -rf "$USER_CACHE_DIR"/* 2>/dev/null || true

    print_color "$COLOR_GREEN" "[Success] User Gradle cache cleared"
else
    print_color "$COLOR_GRAY" "[Info] User cache directory not found"
fi

# Also clean daemon directory
DAEMON_DIR="$USER_GRADLE_DIR/daemon"
if [ -d "$DAEMON_DIR" ]; then
    print_color "$COLOR_CYAN" "[Gradle] Cleaning daemon directory..."
    rm -rf "$DAEMON_DIR"/* 2>/dev/null || true
    print_color "$COLOR_GREEN" "[Success] Daemon directory cleared"
fi

print_section "Step 3: Clean Project Gradle Directories"

if [ -d "$ANDROID_PATH" ]; then
    PROJECT_GRADLE_DIR="$ANDROID_PATH/.gradle"

    if [ -d "$PROJECT_GRADLE_DIR" ]; then
        print_color "$COLOR_CYAN" "[Gradle] Project .gradle directory: $PROJECT_GRADLE_DIR"
        rm -rf "$PROJECT_GRADLE_DIR" 2>/dev/null || true
        print_color "$COLOR_GREEN" "[Success] Project .gradle directory deleted"
    else
        print_color "$COLOR_GRAY" "[Info] Project .gradle directory not found"
    fi

    # Clean build directories
    BUILD_DIR="$ANDROID_PATH/build"
    APP_BUILD_DIR="$ANDROID_PATH/app/build"

    for dir in "$BUILD_DIR" "$APP_BUILD_DIR"; do
        if [ -d "$dir" ]; then
            print_color "$COLOR_CYAN" "[Gradle] Cleaning: $dir"
            rm -rf "$dir" 2>/dev/null || true
            print_color "$COLOR_GREEN" "[Success] Build directory cleaned"
        fi
    done
else
    print_color "$COLOR_YELLOW" "[Warning] Android project directory not found: $ANDROID_PATH"
fi

print_section "Step 4: Clean Gradle Wrapper Cache"

WRAPPER_CACHE="$USER_GRADLE_DIR/wrapper/dists"
if [ -d "$WRAPPER_CACHE" ]; then
    print_color "$COLOR_CYAN" "[Gradle] Wrapper cache: $WRAPPER_CACHE"
    print_color "$COLOR_YELLOW" "[Info] Keeping wrapper cache (will re-download Gradle if deleted)"
    print_color "$COLOR_GRAY" "[Info] To force re-download, manually delete: $WRAPPER_CACHE"
fi

print_section "Cleanup Complete"

print_color "$COLOR_GREEN" "✓ All Gradle caches cleared"
print_color "$COLOR_GREEN" "✓ All Gradle daemons stopped"
print_color "$COLOR_GREEN" "✓ Project build directories cleaned"

echo ""
print_color "$COLOR_CYAN" "Next Steps:"
print_color "$COLOR_RESET" "  1. Try building again:"
print_color "$COLOR_GRAY" "     cd scripts"
print_color "$COLOR_GRAY" "     ./start.sh"
print_color "$COLOR_GRAY" "     (Select 4 for Android build)"
echo ""
print_color "$COLOR_RESET" "  2. Or manually build:"
print_color "$COLOR_GRAY" "     cd android"
print_color "$COLOR_GRAY" "     ./gradlew clean assembleDebug"
echo ""
print_color "$COLOR_YELLOW" "Note: First build will be slower as dependencies are re-downloaded"

echo ""
print_section "Diagnostics"

print_color "$COLOR_CYAN" "Gradle Cache Status:"
if [ -d "$USER_CACHE_DIR" ]; then
    FILES_REMAINING=$(find "$USER_CACHE_DIR" -type f 2>/dev/null | wc -l || echo "0")
    print_color "$COLOR_GRAY" "  Files remaining in cache: $FILES_REMAINING"
else
    print_color "$COLOR_GREEN" "  Cache directory: Deleted"
fi

if [ -d "$ANDROID_PATH" ]; then
    PROJECT_GRADLE_DIR="$ANDROID_PATH/.gradle"
    if [ -d "$PROJECT_GRADLE_DIR" ]; then
        print_color "$COLOR_YELLOW" "  Project .gradle: Still exists (may be recreated)"
    else
        print_color "$COLOR_GREEN" "  Project .gradle: Deleted"
    fi
fi

print_color "$COLOR_CYAN" "\nGradle Processes:"
REMAINING=$(pgrep -f "gradle" 2>/dev/null | wc -l || echo "0")
if [ "$REMAINING" -gt 0 ]; then
    print_color "$COLOR_YELLOW" "  Running: $REMAINING processes"
else
    print_color "$COLOR_GREEN" "  Running: None"
fi

echo ""
print_color "$COLOR_GREEN" "Cleanup script completed!"
