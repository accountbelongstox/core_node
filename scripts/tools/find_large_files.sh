#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Find Large Files Script
# Scans both current working directory and Git history for large files

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SIZE_THRESHOLD_MB=10
SIZE_THRESHOLD_BYTES=$((SIZE_THRESHOLD_MB * 1024 * 1024))

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

format_size() {
    local bytes=$1
    if [ $bytes -lt 1024 ]; then
        echo "${bytes}B"
    elif [ $bytes -lt $((1024 * 1024)) ]; then
        echo "$((bytes / 1024))KB"
    elif [ $bytes -lt $((1024 * 1024 * 1024)) ]; then
        echo "$((bytes / 1024 / 1024))MB"
    else
        echo "$((bytes / 1024 / 1024 / 1024))GB"
    fi
}

echo "================================================================"
echo "Large Files Scanner"
echo "================================================================"
echo "Project Root: $PROJECT_ROOT"
echo "Size Threshold: ${SIZE_THRESHOLD_MB}MB"
echo ""

cd "$PROJECT_ROOT"

echo -e "${BLUE}[1/3] Scanning current working directory for large files...${NC}"
echo "================================================================"
echo ""

find . -type f -size +${SIZE_THRESHOLD_MB}M 2>/dev/null | while read -r file; do
    size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
    size_human=$(format_size $size)

    if [ $size -gt 100000000 ]; then
        echo -e "${RED}${size_human}\t${file}${NC}"
    elif [ $size -gt 50000000 ]; then
        echo -e "${YELLOW}${size_human}\t${file}${NC}"
    else
        echo -e "${size_human}\t${file}"
    fi
done | sort -rh

echo ""
echo -e "${BLUE}[2/3] Scanning Git history for large files...${NC}"
echo "================================================================"
echo ""

if [ -d ".git" ]; then
    git rev-list --objects --all | \
    git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
    awk '/^blob/ {print substr($0,6)}' | \
    sort --numeric-sort --key=2 --reverse | \
    head -20 | \
    while read -r sha size path; do
        if [ -n "$size" ] && [ $size -gt $SIZE_THRESHOLD_BYTES ]; then
            size_human=$(format_size $size)

            if [ $size -gt 100000000 ]; then
                echo -e "${RED}${size_human}\t${sha:0:12}\t${path}${NC}"
            elif [ $size -gt 50000000 ]; then
                echo -e "${YELLOW}${size_human}\t${sha:0:12}\t${path}${NC}"
            else
                echo -e "${size_human}\t${sha:0:12}\t${path}"
            fi
        fi
    done
else
    echo "Not a Git repository"
fi

echo ""
echo -e "${BLUE}[3/3] Directory size summary...${NC}"
echo "================================================================"
echo ""

du -sh */ 2>/dev/null | sort -rh | head -20

echo ""
echo "================================================================"
echo -e "${GREEN}Scan completed${NC}"
echo ""
echo "Legend:"
echo -e "  ${RED}RED${NC}    - Files > 100MB (Critical)"
echo -e "  ${YELLOW}YELLOW${NC} - Files > 50MB (Warning)"
echo -e "  Normal - Files > ${SIZE_THRESHOLD_MB}MB"
echo ""
echo "To remove large files from Git history, use:"
echo "  git filter-branch --force --index-filter \\"
echo "    'git rm --cached --ignore-unmatch <FILE_PATH>' \\"
echo "    --prune-empty --tag-name-filter cat -- --all"
echo ""
echo "Or use BFG Repo-Cleaner (faster):"
echo "  java -jar bfg.jar --strip-blobs-bigger-than 100M"
echo ""
