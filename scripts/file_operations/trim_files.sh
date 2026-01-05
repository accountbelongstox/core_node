#!/bin/bash

#############################################
# Script: Trim files to last N lines
# Description: Finds files by pattern and keeps only the last N lines
# Usage: trim_files.sh [directory] [pattern] [lines]
# Example: trim_files.sh ./test "cursor_*" 500
# Author: Auto-generated
# Date: 2026-01-05
#############################################

# Configuration with defaults
TARGET_DIR="${1:-./test}"
FILE_PATTERN="${2:-cursor_*}"
KEEP_LINES="${3:-500}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo "Usage: $0 [directory] [pattern] [lines]"
    echo ""
    echo "Arguments:"
    echo "  directory   Target directory (default: ./test)"
    echo "  pattern     File pattern to match (default: cursor_*)"
    echo "  lines       Number of lines to keep from end (default: 500)"
    echo ""
    echo "Examples:"
    echo "  $0                              # Use all defaults"
    echo "  $0 ./logs                       # Process files in ./logs"
    echo "  $0 ./test 'cursor_*' 1000       # Keep 1000 lines"
    echo "  $0 ./data '*.log' 100           # Process *.log files"
    exit 1
}

# Check if help is requested
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    show_usage
fi

# Resolve absolute path
TARGET_DIR=$(cd "$TARGET_DIR" 2>/dev/null && pwd)

# Validate inputs
if [[ ! -d "$TARGET_DIR" ]]; then
    echo -e "${RED}Error: Directory '$TARGET_DIR' does not exist${NC}"
    exit 1
fi

if ! [[ "$KEEP_LINES" =~ ^[0-9]+$ ]] || [[ "$KEEP_LINES" -lt 1 ]]; then
    echo -e "${RED}Error: Lines must be a positive integer${NC}"
    exit 1
fi

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Trim files to last ${KEEP_LINES} lines${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "${YELLOW}Directory: ${TARGET_DIR}${NC}"
echo -e "${YELLOW}Pattern:   ${FILE_PATTERN}${NC}"
echo -e "${YELLOW}Keep:      ${KEEP_LINES} lines${NC}"
echo ""

# Counter
total_files=0
processed_files=0
skipped_files=0
error_files=0
total_removed=0

# Find all matching files
while IFS= read -r -d '' file; do
    ((total_files++))

    filename=$(basename "$file")

    # Check if file exists and is readable
    if [[ ! -f "$file" ]] || [[ ! -r "$file" ]]; then
        echo -e "${RED}✗ Skipped: $filename (not readable)${NC}"
        ((skipped_files++))
        continue
    fi

    # Get current line count
    line_count=$(wc -l < "$file" 2>/dev/null)

    echo -e "${BLUE}Processing: $filename${NC}"
    echo -e "  Current lines: $line_count"

    # If file has less than or equal to KEEP_LINES, skip it
    if [[ $line_count -le $KEEP_LINES ]]; then
        echo -e "  ${YELLOW}→ Skipped (already ≤ ${KEEP_LINES} lines)${NC}"
        ((skipped_files++))
        echo ""
        continue
    fi

    # Create a temporary file
    temp_file="${file}.tmp.$$"

    # Get the last KEEP_LINES lines and write to temp file
    if tail -n "$KEEP_LINES" "$file" > "$temp_file" 2>/dev/null; then
        # Verify temp file was created and is not empty
        if [[ -f "$temp_file" ]] && [[ -s "$temp_file" ]]; then
            # Get new line count
            new_line_count=$(wc -l < "$temp_file")

            # Get file permissions and ownership
            file_perms=$(stat -c '%a' "$file" 2>/dev/null || stat -f '%p' "$file" 2>/dev/null | tail -c 4)
            file_owner=$(stat -c '%u:%g' "$file" 2>/dev/null || echo "")

            # Replace original file with temp file
            if mv "$temp_file" "$file" 2>/dev/null; then
                # Restore permissions if possible
                if [[ -n "$file_perms" ]]; then
                    chmod "$file_perms" "$file" 2>/dev/null || true
                fi

                removed_lines=$((line_count - new_line_count))
                total_removed=$((total_removed + removed_lines))

                # Get file sizes
                old_size=$(du -h "$file" 2>/dev/null | cut -f1)

                echo -e "  ${GREEN}✓ Trimmed: $line_count → $new_line_count lines (removed $removed_lines)${NC}"
                echo -e "  ${GREEN}  New size: $old_size${NC}"
                ((processed_files++))
            else
                echo -e "  ${RED}✗ Error: Failed to replace file${NC}"
                rm -f "$temp_file" 2>/dev/null
                ((error_files++))
            fi
        else
            echo -e "  ${RED}✗ Error: Temp file is empty or not created${NC}"
            rm -f "$temp_file" 2>/dev/null
            ((error_files++))
        fi
    else
        echo -e "  ${RED}✗ Error: Failed to extract last ${KEEP_LINES} lines${NC}"
        rm -f "$temp_file" 2>/dev/null
        ((error_files++))
    fi

    echo ""
done < <(find "$TARGET_DIR" -maxdepth 1 -type f -name "$FILE_PATTERN" -print0)

# Check if no files found
if [[ $total_files -eq 0 ]]; then
    echo -e "${YELLOW}No files matching pattern '${FILE_PATTERN}' found in ${TARGET_DIR}${NC}"
    echo ""
fi

# Summary
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "Total files found:    ${BLUE}${total_files}${NC}"
echo -e "Successfully trimmed: ${GREEN}${processed_files}${NC}"
echo -e "Skipped:              ${YELLOW}${skipped_files}${NC}"
echo -e "Errors:               ${RED}${error_files}${NC}"
echo -e "Total lines removed:  ${BLUE}${total_removed}${NC}"
echo -e "${BLUE}======================================${NC}"

# Exit with appropriate code
if [[ $error_files -gt 0 ]]; then
    exit 1
elif [[ $processed_files -gt 0 ]]; then
    exit 0
else
    exit 0
fi
