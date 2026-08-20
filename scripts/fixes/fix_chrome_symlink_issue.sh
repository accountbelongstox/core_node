#!/bin/bash

# Chrome/Puppeteer Symbolic Link Loop Fix Script
# This script detects and fixes symbolic link loops that prevent Chrome from starting

set -e

echo " Chrome/Puppeteer Symbolic Link Loop Fix Script"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running with sufficient privileges
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        print_warning "This script may need sudo privileges to fix system symbolic links."
        print_warning "If you encounter permission errors, try running with sudo."
        echo ""
    fi
}

# Detect symbolic link loops
detect_symlink_loops() {
    print_status "Detecting symbolic link loops..."
    
    local problematic_paths=()
    local check_paths=(
        "/usr/bin/X11"
        "/usr/X11R6/bin"
        "/usr/bin"
        "/usr/local/bin"
    )
    
    for check_path in "${check_paths[@]}"; do
        if [[ ! -d "$check_path" ]]; then
            continue
        fi
        
        # Try to resolve the real path
        if realpath "$check_path" >/dev/null 2>&1; then
            print_success "$check_path - OK"
        else
            local error_output
            error_output=$(realpath "$check_path" 2>&1 || true)
            if [[ "$error_output" == *"Too many levels of symbolic links"* ]]; then
                print_error "$check_path - SYMBOLIC LINK LOOP DETECTED"
                problematic_paths+=("$check_path")
            else
                print_warning "$check_path - $error_output"
            fi
        fi
        
        # Check for specific FileCheck issues
        if [[ -d "$check_path" ]]; then
            while IFS= read -r -d '' file; do
                if [[ "$(basename "$file")" == *"FileCheck"* ]]; then
                    if ! realpath "$file" >/dev/null 2>&1; then
                        local file_error
                        file_error=$(realpath "$file" 2>&1 || true)
                        if [[ "$file_error" == *"Too many levels of symbolic links"* ]]; then
                            print_error "$file - SYMBOLIC LINK LOOP DETECTED"
                            problematic_paths+=("$file")
                        fi
                    fi
                fi
            done < <(find "$check_path" -maxdepth 2 -name "*FileCheck*" -print0 2>/dev/null || true)
        fi
    done
    
    # Return the problematic paths (using a global variable for simplicity)
    PROBLEMATIC_PATHS=("${problematic_paths[@]}")
}

# Fix symbolic link loops
fix_symlink_loops() {
    if [[ ${#PROBLEMATIC_PATHS[@]} -eq 0 ]]; then
        print_success "No symbolic link loops to fix."
        echo ""
        return 0
    fi
    
    print_status "Fixing ${#PROBLEMATIC_PATHS[@]} symbolic link loops..."
    
    local fixed=()
    local errors=()
    local backup_dir="/tmp/chrome_symlink_fix_backup"
    local backup_file="$backup_dir/backup_$(date +%s).txt"
    
    # Create backup directory
    mkdir -p "$backup_dir" 2>/dev/null || true
    
    for problematic_path in "${PROBLEMATIC_PATHS[@]}"; do
        print_status "Fixing: $problematic_path"
        
        if [[ -L "$problematic_path" ]]; then
            # Get link target for backup
            local link_target
            link_target=$(readlink "$problematic_path" 2>/dev/null || echo "unknown")
            
            # Create backup entry
            echo "$(date): $problematic_path -> $link_target" >> "$backup_file"
            
            # Remove the problematic link
            if rm "$problematic_path" 2>/dev/null; then
                print_success "Removed: $problematic_path -> $link_target"
                fixed+=("$problematic_path")
            else
                print_error "Failed to remove: $problematic_path"
                errors+=("$problematic_path")
            fi
        elif [[ -d "$problematic_path" ]]; then
            # If it's a directory with loops, we need to be more careful
            print_warning "Directory with symbolic link loops: $problematic_path"
            print_warning "Manual inspection may be required"
        fi
    done
    
    if [[ ${#fixed[@]} -gt 0 ]]; then
        print_success "Backup created: $backup_file"
    fi
    
    echo ""
    print_status "Fix Summary:"
    echo "   Fixed: ${#fixed[@]}"
    echo "   Errors: ${#errors[@]}"
    
    return $([[ ${#errors[@]} -eq 0 ]])
}

# Test Chrome launch after fix
test_chrome_after_fix() {
    print_status "Testing Chrome launch after fix..."
    
    # Try to find Chrome
    local chrome_paths=(
        "/usr/bin/google-chrome"
        "/usr/bin/google-chrome-stable"
        "/usr/bin/chromium"
        "/usr/bin/chromium-browser"
    )
    
    local chrome_path=""
    for path in "${chrome_paths[@]}"; do
        if [[ -x "$path" ]]; then
            chrome_path="$path"
            break
        fi
    done
    
    if [[ -z "$chrome_path" ]]; then
        print_warning "Chrome not found in standard locations. Install Chrome first."
        return 1
    fi
    
    print_status "Found Chrome: $chrome_path"
    print_status "Testing Chrome version check..."
    
    # Test Chrome launch with minimal arguments
    local test_output
    if test_output=$("$chrome_path" --version --no-sandbox --disable-dev-shm-usage 2>&1); then
        if [[ "$test_output" == *"Google Chrome"* ]] || [[ "$test_output" == *"Chromium"* ]]; then
            print_success "Chrome test successful: $test_output"
            return 0
        else
            print_error "Chrome test failed: unexpected output"
            echo "   Output: $test_output"
            return 1
        fi
    else
        print_error "Chrome test failed"
        echo "   Error: $test_output"
        return 1
    fi
}

# Provide recommendations
provide_recommendations() {
    echo ""
    print_status "Recommendations:"
    echo "   1. If Chrome still fails to start, try reinstalling Chrome:"
    echo "      sudo apt update && sudo apt install --reinstall google-chrome-stable"
    echo "   2. Check for system updates that might fix X11 issues:"
    echo "      sudo apt update && sudo apt upgrade"
    echo "   3. If using WSL, ensure X11 forwarding is properly configured"
    echo "   4. Consider using Chrome in headless mode for Puppeteer:"
    echo "      { headless: true, args: [\"--no-sandbox\", \"--disable-dev-shm-usage\"] }"
    echo "   5. Set CHROME_BIN environment variable to bypass path detection:"
    echo "      export CHROME_BIN=/usr/bin/google-chrome-stable"
}

# Main execution
main() {
    check_permissions
    
    # Global variable to store problematic paths
    declare -a PROBLEMATIC_PATHS
    
    detect_symlink_loops
    
    if fix_symlink_loops; then
        if test_chrome_after_fix; then
            echo ""
            print_success "Chrome/Puppeteer symbolic link issue has been resolved!"
            print_success "You can now try running your Puppeteer application again."
        else
            echo ""
            print_warning "Symbolic links were fixed, but Chrome test failed."
            print_warning "There may be other issues preventing Chrome from starting."
            provide_recommendations
        fi
    else
        echo ""
        print_error "Some symbolic link fixes failed."
        print_error "You may need to run this script with sudo or fix manually."
        provide_recommendations
    fi
}

# Run the script
main "$@"

echo ""
print_success "Fix script completed."
