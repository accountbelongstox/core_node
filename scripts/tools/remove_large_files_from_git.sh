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

# Remove Large Files from Git History
# This script removes large files from Git history to reduce repository size

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FILES_TO_REMOVE=(
    "poly_apps/react_native_new_kotlin/java_pid21176.hprof"
    "poly_apps/react_native_new_kotlin/java_pid44660.hprof"
)

echo "================================================================"
echo "Remove Large Files from Git History"
echo "================================================================"
echo ""

cd "$PROJECT_ROOT"

if [ ! -d ".git" ]; then
    echo -e "${RED}Error: Not a Git repository${NC}"
    exit 1
fi

echo -e "${YELLOW}WARNING: This will rewrite Git history!${NC}"
echo -e "${YELLOW}All commit hashes will change.${NC}"
echo ""
echo "Files to remove:"
for file in "${FILES_TO_REMOVE[@]}"; do
    echo -e "  ${RED}${file}${NC}"
done
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled"
    exit 0
fi

echo ""
echo -e "${BLUE}Step 1: Creating backup branch...${NC}"
git branch backup-before-cleanup 2>/dev/null
echo -e "${GREEN}Backup branch created: backup-before-cleanup${NC}"

echo ""
echo -e "${BLUE}Step 2: Adding files to .gitignore...${NC}"
if [ ! -f ".gitignore" ]; then
    touch .gitignore
fi

for file in "${FILES_TO_REMOVE[@]}"; do
    if ! grep -q "$file" .gitignore 2>/dev/null; then
        echo "$file" >> .gitignore
    fi
done

if ! grep -q "*.hprof" .gitignore 2>/dev/null; then
    echo "*.hprof" >> .gitignore
fi

echo -e "${GREEN}.gitignore updated${NC}"

echo ""
echo -e "${BLUE}Step 3: Removing files from Git history...${NC}"
echo "This may take several minutes..."
echo ""

for file in "${FILES_TO_REMOVE[@]}"; do
    echo -e "Removing: ${file}"
    git filter-branch --force --index-filter \
        "git rm --cached --ignore-unmatch '$file'" \
        --prune-empty --tag-name-filter cat -- --all
done

echo ""
echo -e "${BLUE}Step 4: Cleaning up references...${NC}"
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo -e "${BLUE}Step 5: Checking repository size...${NC}"
du -sh .git

echo ""
echo "================================================================"
echo -e "${GREEN}Cleanup completed!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git log --oneline | head -20"
echo "  2. Force push to remote: git push origin main --force"
echo ""
echo -e "${YELLOW}WARNING: Force push will overwrite remote history!${NC}"
echo -e "${YELLOW}Coordinate with team members before force pushing.${NC}"
echo ""
echo "If something goes wrong, restore from backup:"
echo "  git reset --hard backup-before-cleanup"
echo ""
