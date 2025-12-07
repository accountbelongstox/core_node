#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Git Repository Size Checker
# Analyzes Git repository size including objects, packs, and working directory

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

format_size() {
    local bytes=$1
    if [ $bytes -lt 1024 ]; then
        echo "${bytes}B"
    elif [ $bytes -lt $((1024 * 1024)) ]; then
        printf "%.2fKB" $(echo "scale=2; $bytes / 1024" | bc)
    elif [ $bytes -lt $((1024 * 1024 * 1024)) ]; then
        printf "%.2fMB" $(echo "scale=2; $bytes / 1024 / 1024" | bc)
    else
        printf "%.2fGB" $(echo "scale=2; $bytes / 1024 / 1024 / 1024" | bc)
    fi
}

get_size_bytes() {
    local path=$1
    if [ -d "$path" ]; then
        du -sb "$path" 2>/dev/null | cut -f1
    elif [ -f "$path" ]; then
        stat -c%s "$path" 2>/dev/null || stat -f%z "$path" 2>/dev/null
    else
        echo "0"
    fi
}

echo "================================================================"
echo -e "${CYAN}Git Repository Size Analysis${NC}"
echo "================================================================"
echo "Project: $PROJECT_ROOT"
echo ""

cd "$PROJECT_ROOT"

if [ ! -d ".git" ]; then
    echo -e "${RED}Error: Not a Git repository${NC}"
    exit 1
fi

echo -e "${BLUE}[1/5] Overall Repository Size${NC}"
echo "================================================================"

GIT_DIR_SIZE=$(get_size_bytes ".git")
WORK_DIR_SIZE=$(get_size_bytes ".")
TOTAL_SIZE=$WORK_DIR_SIZE

echo -e "Git directory (.git/):     ${YELLOW}$(format_size $GIT_DIR_SIZE)${NC}"
echo -e "Total repository size:     ${YELLOW}$(format_size $TOTAL_SIZE)${NC}"
echo ""

echo -e "${BLUE}[2/5] Git Directory Breakdown${NC}"
echo "================================================================"

if [ -d ".git/objects" ]; then
    OBJECTS_SIZE=$(get_size_bytes ".git/objects")
    echo -e "Objects:                   $(format_size $OBJECTS_SIZE)"
fi

if [ -d ".git/objects/pack" ]; then
    PACK_SIZE=$(get_size_bytes ".git/objects/pack")
    echo -e "  - Pack files:            ${YELLOW}$(format_size $PACK_SIZE)${NC}"

    PACK_COUNT=$(find .git/objects/pack -name "*.pack" 2>/dev/null | wc -l)
    echo -e "  - Pack count:            $PACK_COUNT"

    echo ""
    echo "  Top 5 largest pack files:"
    find .git/objects/pack -name "*.pack" -type f 2>/dev/null | while read -r pack; do
        size=$(get_size_bytes "$pack")
        echo "    $(format_size $size)  $(basename "$pack")"
    done | sort -rh | head -5
fi

echo ""

if [ -d ".git/refs" ]; then
    REFS_SIZE=$(get_size_bytes ".git/refs")
    echo -e "References:                $(format_size $REFS_SIZE)"
fi

if [ -f ".git/index" ]; then
    INDEX_SIZE=$(get_size_bytes ".git/index")
    echo -e "Index:                     $(format_size $INDEX_SIZE)"
fi

if [ -d ".git/logs" ]; then
    LOGS_SIZE=$(get_size_bytes ".git/logs")
    echo -e "Logs (reflog):             $(format_size $LOGS_SIZE)"
fi

echo ""

echo -e "${BLUE}[3/5] Git Object Statistics${NC}"
echo "================================================================"

git count-objects -vH 2>/dev/null || git count-objects -v 2>/dev/null

echo ""

echo -e "${BLUE}[4/5] Top 20 Largest Objects in Git History${NC}"
echo "================================================================"

git rev-list --objects --all | \
git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
awk '/^blob/ {print substr($0,6)}' | \
sort --numeric-sort --key=2 --reverse | \
head -20 | \
while read -r sha size path; do
    if [ -n "$size" ]; then
        size_human=$(format_size $size)

        if [ $size -gt 104857600 ]; then
            echo -e "${RED}${size_human}\t${sha:0:12}\t${path}${NC}"
        elif [ $size -gt 52428800 ]; then
            echo -e "${YELLOW}${size_human}\t${sha:0:12}\t${path}${NC}"
        else
            echo -e "${size_human}\t${sha:0:12}\t${path}"
        fi
    fi
done

echo ""

echo -e "${BLUE}[5/5] Working Directory Analysis${NC}"
echo "================================================================"

echo "Top 10 largest directories:"
du -sh */ .??*/ 2>/dev/null | grep -v "^0" | sort -rh | head -10

echo ""

echo "Current large files (>10MB) in working directory:"
find . -type f -size +10M 2>/dev/null | while read -r file; do
    size=$(get_size_bytes "$file")
    size_human=$(format_size $size)

    if [ $size -gt 104857600 ]; then
        echo -e "${RED}${size_human}\t${file}${NC}"
    elif [ $size -gt 52428800 ]; then
        echo -e "${YELLOW}${size_human}\t${file}${NC}"
    else
        echo -e "${size_human}\t${file}"
    fi
done | sort -rh | head -20

echo ""

echo "================================================================"
echo -e "${GREEN}Analysis Complete${NC}"
echo ""
echo "Summary:"
echo -e "  Git repository size:   ${YELLOW}$(format_size $GIT_DIR_SIZE)${NC}"
echo -e "  Total checkout size:   ${YELLOW}$(format_size $TOTAL_SIZE)${NC}"

if [ $GIT_DIR_SIZE -gt 1073741824 ]; then
    echo ""
    echo -e "${RED}WARNING: Git repository exceeds 1GB${NC}"
    echo "Consider:"
    echo "  1. Running: git gc --aggressive --prune=now"
    echo "  2. Using BFG Repo-Cleaner to remove large files"
    echo "  3. Using Git LFS for large binary files"
elif [ $GIT_DIR_SIZE -gt 536870912 ]; then
    echo ""
    echo -e "${YELLOW}WARNING: Git repository exceeds 512MB${NC}"
    echo "Consider cleaning up large files from history"
fi

echo ""
