#!/bin/bash
# Script to fix non-ASCII characters in all script files

echo "Fixing non-ASCII characters in all script files..."

# Find all script files
find "D:/programing/core_node/scripts" -name "*.sh" -o -name "*.ps1" -o -name "*.bat" | while read -r file; do
    echo "Processing: $file"

    # Check if file contains non-ASCII characters
    if LC_ALL=C grep -q '[^\x00-\x7F]' "$file" 2>/dev/null; then
        echo "  Found non-ASCII characters, fixing..."

        # Create backup
        cp "$file" "$file.backup"

        # Fix common non-ASCII characters
        sed -i "s/'/'/g; s/'/'/g; s/"/\"/g; s/"/\"/g; s/-/-/g; s/-/-/g" "$file" 2>/dev/null || true

        # Additional cleanup for any remaining non-ASCII
        LC_ALL=C sed -i 's/[^\x00-\x7F]/?/g' "$file" 2>/dev/null || true

        echo "  Fixed: $file"
    else
        echo "  Clean: $file"
    fi
done

echo "Non-ASCII character fixing completed!"