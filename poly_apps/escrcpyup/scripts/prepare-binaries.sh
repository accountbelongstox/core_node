#!/bin/bash

# ============================================
# Binary Files Preparation Script
# ============================================
# This script copies binary files with .py suffix for git compatibility
# and restores them before running the application

ACTION="${1:-restore}"  # "backup" or "restore"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Color definitions
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${CYAN}[INFO] $1${NC}"
}

print_success() {
    echo -e "${GREEN}[OK] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

# Binary file extensions to process
BINARY_EXTS=("exe" "dll" "so" "dylib")

# Directories containing binaries
BINARY_DIRS=(
    "electron/resources/extra/win/scrcpy"
    "electron/resources/extra/win/gnirehtet"
    "electron/resources/extra/mac-x64/scrcpy"
    "electron/resources/extra/mac-arm64/scrcpy"
    "electron/resources/extra/linux-x64/scrcpy"
    "electron/resources/extra/linux-arm64/scrcpy"
)

backup_binaries() {
    print_info "Creating .py copies of binary files for git..."
    local count=0

    for dir in "${BINARY_DIRS[@]}"; do
        local full_path="$PROJECT_ROOT/$dir"
        if [ ! -d "$full_path" ]; then
            continue
        fi

        # Process files with extensions
        for ext in "${BINARY_EXTS[@]}"; do
            while IFS= read -r -d '' file; do
                local source_path="$file"
                local dest_path="${file}.py"

                if [ -f "$source_path" ]; then
                    cp "$source_path" "$dest_path"
                    print_success "Backed up: $(basename "$source_path") -> $(basename "$dest_path")"
                    ((count++))
                fi
            done < <(find "$full_path" -maxdepth 1 -type f -name "*.$ext" -print0 2>/dev/null)
        done

        # Handle files without extensions (Linux/Mac binaries)
        if [[ "$dir" == *"mac"* || "$dir" == *"linux"* ]]; then
            while IFS= read -r file; do
                # Skip if already has .py extension or is a known text file
                if [[ "$file" == *.py ]] || [[ "$file" == *.txt ]] || [[ "$file" == *.md ]]; then
                    continue
                fi

                local source_path="$file"
                local dest_path="${file}.py"

                if [ -f "$source_path" ] && [ -x "$source_path" ]; then
                    cp "$source_path" "$dest_path"
                    print_success "Backed up: $(basename "$source_path") -> $(basename "$dest_path")"
                    ((count++))
                fi
            done < <(find "$full_path" -maxdepth 1 -type f ! -name "*.*" 2>/dev/null)
        fi
    done

    print_success "Total $count binary files backed up with .py extension"
}

restore_binaries() {
    print_info "Restoring binary files from .py copies..."
    local count=0

    for dir in "${BINARY_DIRS[@]}"; do
        local full_path="$PROJECT_ROOT/$dir"
        if [ ! -d "$full_path" ]; then
            continue
        fi

        # Restore files with .exe.py, .dll.py, etc.
        for ext in "${BINARY_EXTS[@]}"; do
            while IFS= read -r -d '' file; do
                local source_path="$file"
                local dest_path="${file%.py}"

                if [ -f "$source_path" ]; then
                    cp "$source_path" "$dest_path"
                    chmod +x "$dest_path" 2>/dev/null
                    print_success "Restored: $(basename "$source_path") -> $(basename "$dest_path")"
                    ((count++))
                fi
            done < <(find "$full_path" -maxdepth 1 -type f -name "*.$ext.py" -print0 2>/dev/null)
        done

        # Restore Linux/Mac binaries (files ending with .py but no extension before)
        if [[ "$dir" == *"mac"* || "$dir" == *"linux"* ]]; then
            while IFS= read -r -d '' file; do
                local filename=$(basename "$file")

                # Skip if it matches known binary extensions with .py
                local skip=false
                for ext in "${BINARY_EXTS[@]}"; do
                    if [[ "$filename" == *".$ext.py" ]]; then
                        skip=true
                        break
                    fi
                done

                if [ "$skip" = false ]; then
                    local source_path="$file"
                    local dest_path="${file%.py}"

                    if [ -f "$source_path" ]; then
                        cp "$source_path" "$dest_path"
                        chmod +x "$dest_path"
                        print_success "Restored: $(basename "$source_path") -> $(basename "$dest_path")"
                        ((count++))
                    fi
                fi
            done < <(find "$full_path" -maxdepth 1 -type f -name "*.py" -print0 2>/dev/null)
        fi
    done

    if [ $count -eq 0 ]; then
        print_warning "No .py backup files found to restore"
        print_info "This is normal if binaries are already in place"
    else
        print_success "Total $count binary files restored"
    fi
}

# Main execution
case "$ACTION" in
    backup)
        backup_binaries
        ;;
    restore)
        restore_binaries
        ;;
    *)
        echo "Usage: $0 [backup|restore]"
        echo ""
        echo "  backup  - Copy binary files to .py extension for git"
        echo "  restore - Copy .py files back to original extensions"
        exit 1
        ;;
esac
