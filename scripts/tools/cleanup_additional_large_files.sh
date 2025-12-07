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

# Cleanup Additional Large Files from Git History
# Removes large database, media, and build artifact files

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BFG_JAR="$SCRIPT_DIR/bfg.jar"
BFG_URL="https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FILES_TO_REMOVE=(
    "poly_apps/laravel_main/init_data/AppQyV1/VoiceStaticServer/sqlite/word_content.sqlitemate"
    "pyapps/scrcpy_web_test/recordings/R4RCHEKBRWFEEYB6_20251109_165815.mp4"
    "poly_apps/qtscrcpy_tc/SmartMatrix/third_party/ffmpeg/lib/libavcodec.a"
    "poly_apps/SmartMatrix/QtSmartMatrix/SmartMatrixCore/src/third_party/adb/mac/adb"
    "poly_apps/NewQtScrcpy/screenshot/mac-zh.png"
    "poly_apps/NewQtScrcpy/screenshot/mac-en.png"
    "poly_apps/flutter_bloom/assets/apps/app_bank/ui/login.jpg"
    "poly_apps/SmartMatrix/QtSmartMatrix/SmartMatrixCore/src/third_party/adb/linux/adb"
    "poly_apps/qtscrcpy_tc/SmartMatrix/third_party/adb/linux/adb"
    "poly_apps/qtscrcpy_tc/SmartMatrix/third_party/adb/mac/adb"
    "poly_apps/SmartMatrix/build_msvc_2022/QtScrcpy.dir/RelWithDebInfo/vc143.pdb"
)

echo "================================================================"
echo "Cleanup Additional Large Files from Git History"
echo "================================================================"
echo ""

cd "$PROJECT_ROOT"

if [ ! -d ".git" ]; then
    echo -e "${RED}Error: Not a Git repository${NC}"
    exit 1
fi

if ! command -v java &> /dev/null; then
    echo -e "${RED}Error: Java is not installed${NC}"
    echo "Install Java: sudo apt install default-jre"
    exit 1
fi

if [ ! -f "$BFG_JAR" ]; then
    echo -e "${BLUE}Downloading BFG Repo-Cleaner...${NC}"
    wget -O "$BFG_JAR" "$BFG_URL"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to download BFG${NC}"
        exit 1
    fi
    echo -e "${GREEN}BFG downloaded${NC}"
fi

echo -e "${YELLOW}WARNING: This will rewrite Git history!${NC}"
echo ""
echo "This will remove the following files from Git history:"
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
echo -e "${BLUE}Step 1: Creating backup...${NC}"
git branch backup-before-additional-cleanup 2>/dev/null
echo -e "${GREEN}Backup branch created: backup-before-additional-cleanup${NC}"

echo ""
echo -e "${BLUE}Step 2: Deleting files from current HEAD...${NC}"

for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        echo "Removing: $file"
        rm -f "$file"
    fi
done

git add .
git commit -m "Remove additional large files from HEAD" 2>/dev/null || true

echo ""
echo -e "${BLUE}Step 3: Creating BFG deletion list...${NC}"

DELETE_FILE=$(mktemp)
for file in "${FILES_TO_REMOVE[@]}"; do
    basename "$file" >> "$DELETE_FILE"
done

echo "Files to delete:"
cat "$DELETE_FILE"

echo ""
echo -e "${BLUE}Step 4: Running BFG to clean history...${NC}"
java -jar "$BFG_JAR" --delete-files "$(cat $DELETE_FILE | tr '\n' ',' | sed 's/,$//')" || {
    echo ""
    echo -e "${YELLOW}Running individual file cleanup...${NC}"
    for file in "${FILES_TO_REMOVE[@]}"; do
        filename=$(basename "$file")
        echo "Cleaning: $filename"
        java -jar "$BFG_JAR" --delete-files "$filename" 2>/dev/null || true
    done
}

rm -f "$DELETE_FILE"

echo ""
echo -e "${BLUE}Step 5: Cleaning up Git repository...${NC}"
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo -e "${BLUE}Step 6: Verifying cleanup...${NC}"
du -sh .git

echo ""
echo "================================================================"
echo -e "${GREEN}Cleanup completed!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review: git log --oneline | head -20"
echo "  2. Check size: bash scripts/tools/check_git_repo_size.sh"
echo "  3. Force push: git push origin main --force"
echo ""
echo -e "${YELLOW}IMPORTANT: Notify team before force pushing!${NC}"
echo ""
echo "If something goes wrong, restore from backup:"
echo "  git reset --hard backup-before-additional-cleanup"
echo ""
