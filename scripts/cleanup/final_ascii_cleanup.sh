#!/bin/bash
# Final ASCII cleanup script for all scripts

echo "Performing final ASCII cleanup on all scripts..."

# List of all script directories to check
script_dirs=(
    "D:/programing/core_node/scripts"
    "D:/programing/core_node/poly_apps"
    "D:/programing/core_node/ncore"
)

# Find and fix all script files
for dir in "${script_dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "Processing directory: $dir"

        # Find all script files
        find "$dir" -type f \( -name "*.sh" -o -name "*.ps1" -o -name "*.bat" \) | while read -r file; do
            if LC_ALL=C grep -q '[^\x00-\x7F]' "$file" 2>/dev/null; then
                echo "  Fixing: $file"

                # Convert line endings first
                dos2unix "$file" 2>/dev/null || true

                # Create backup
                cp "$file" "$file.bak" 2>/dev/null || true

                # Fix specific problematic characters and symbols
                sed -i 's/????/[INFO]/g' "$file" 2>/dev/null || true
                sed -i 's/[ERROR]/[ERROR]/g' "$file" 2>/dev/null || true
                sed -i 's/[OK]/[OK]/g' "$file" 2>/dev/null || true
                sed -i 's/[WARN]/[WARN]/g' "$file" 2>/dev/null || true
                sed -i 's/????/[ALERT]/g' "$file" 2>/dev/null || true
                sed -i 's/????/[CONFIG]/g' "$file" 2>/dev/null || true
                sed -i 's/????/[HOT]/g' "$file" 2>/dev/null || true
                sed -i 's/????/[LAUNCH]/g' "$file" 2>/dev/null || true
                sed -i 's/????/[INFO]/g' "$file" 2>/dev/null || true
                sed -i 's/????/[NOTE]/g' "$file" 2>/dev/null || true
                sed -i 's/????/[TARGET]/g' "$file" 2>/dev/null || true
                sed -i 's/????/[SEARCH]/g' "$file" 2>/dev/null || true
                sed -i 's/[FAST]/[FAST]/g' "$file" 2>/dev/null || true
                sed -i 's/???????/[TOOL]/g' "$file" 2>/dev/null || true
                sed -i 's/????/[SUCCESS]/g' "$file" 2>/dev/null || true

                # Replace smart quotes and dashes
                sed -i "s/'/'/g" "$file" 2>/dev/null || true
                sed -i "s/'/'/g" "$file" 2>/dev/null || true
                sed -i 's/"/"/g' "$file" 2>/dev/null || true
                sed -i 's/"/"/g' "$file" 2>/dev/null || true
                sed -i 's/-/-/g' "$file" 2>/dev/null || true
                sed -i 's/-/-/g' "$file" 2>/dev/null || true

                # Replace any remaining non-ASCII with placeholder
                LC_ALL=C sed -i 's/[^\x00-\x7F]/?/g' "$file" 2>/dev/null || true

                echo "    Fixed: $file"
            fi
        done
    fi
done

echo "Final ASCII cleanup completed!"
echo "All script files should now contain only ASCII characters."