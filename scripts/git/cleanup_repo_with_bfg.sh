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

# Cleanup Git Repository with BFG Repo-Cleaner
# Universal script for cleaning large files from Git history
# BFG is 10-720x faster than git filter-branch

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$SCRIPTS_DIR")"

USER_HOME="${HOME}"
TOOLS_DIR="${USER_HOME}/.core_node/tools"
BFG_JAR="${TOOLS_DIR}/bfg.jar"
BFG_URL="https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

show_menu() {
    clear
    echo "================================================================"
    echo -e "${CYAN}BFG Repo-Cleaner - Git History Cleanup${NC}"
    echo "================================================================"
    echo ""
    echo "Options:"
    echo "  1. Remove files larger than 100MB"
    echo "  2. Remove files larger than 50MB"
    echo "  3. Remove files larger than 10MB"
    echo "  4. Remove specific file by name"
    echo "  5. Remove specific files by pattern (*.hprof, *.log, etc.)"
    echo "  6. Back to previous menu"
    echo ""
    echo -e "${YELLOW}WARNING: This will rewrite Git history!${NC}"
    echo "================================================================"
}

ensure_bfg_downloaded() {
    if [ ! -f "$BFG_JAR" ]; then
        echo ""
        echo -e "${BLUE}Downloading BFG Repo-Cleaner to ${TOOLS_DIR}...${NC}"

        mkdir -p "$TOOLS_DIR"

        if command -v wget &> /dev/null; then
            wget -O "$BFG_JAR" "$BFG_URL"
        elif command -v curl &> /dev/null; then
            curl -L -o "$BFG_JAR" "$BFG_URL"
        else
            echo -e "${RED}Error: Neither wget nor curl is available${NC}"
            echo "Please install wget or curl to download BFG"
            return 1
        fi

        if [ $? -ne 0 ]; then
            echo -e "${RED}Failed to download BFG${NC}"
            return 1
        fi

        echo -e "${GREEN}BFG downloaded successfully${NC}"
    else
        echo -e "${GREEN}BFG already exists at: ${BFG_JAR}${NC}"
    fi

    return 0
}

check_prerequisites() {
    if [ ! -d ".git" ]; then
        echo -e "${RED}Error: Not a Git repository${NC}"
        echo "Please run this script from a Git repository root directory"
        return 1
    fi

    if ! command -v java &> /dev/null; then
        echo -e "${RED}Error: Java is not installed${NC}"
        echo "Please install Java Runtime Environment (JRE):"
        echo "  Ubuntu/Debian: sudo apt install default-jre"
        echo "  CentOS/RHEL:   sudo yum install java-openjdk"
        return 1
    fi

    return 0
}

create_backup() {
    local backup_branch="backup-before-bfg-$(date +%Y%m%d-%H%M%S)"
    echo ""
    echo -e "${BLUE}Creating backup branch: ${backup_branch}${NC}"
    git branch "$backup_branch" 2>/dev/null

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Backup branch created successfully${NC}"
        echo -e "${CYAN}To restore: git reset --hard ${backup_branch}${NC}"
        return 0
    else
        echo -e "${RED}Failed to create backup branch${NC}"
        return 1
    fi
}

run_bfg_cleanup() {
    local bfg_args="$1"

    echo ""
    echo -e "${BLUE}Running BFG Repo-Cleaner...${NC}"
    echo "Command: java -jar \"$BFG_JAR\" $bfg_args"
    echo ""

    java -jar "$BFG_JAR" $bfg_args

    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${BLUE}Cleaning up Git repository...${NC}"
        git reflog expire --expire=now --all
        git gc --prune=now --aggressive

        echo ""
        echo -e "${GREEN}Repository size after cleanup:${NC}"
        du -sh .git

        return 0
    else
        echo -e "${RED}BFG cleanup failed${NC}"
        return 1
    fi
}

remove_large_files() {
    local size_limit="$1"

    echo ""
    echo -e "${YELLOW}This will remove all files larger than ${size_limit} from Git history${NC}"
    read -p "Continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Operation cancelled"
        return 0
    fi

    create_backup || return 1

    echo ""
    echo -e "${BLUE}Deleting large files from current HEAD...${NC}"
    git add .
    git commit -m "Remove large files from HEAD before BFG cleanup" 2>/dev/null || true

    run_bfg_cleanup "--strip-blobs-bigger-than ${size_limit}"
}

remove_specific_file() {
    echo ""
    echo -e "${CYAN}Enter the filename to remove (e.g., large-file.zip):${NC}"
    read -p "Filename: " filename

    if [ -z "$filename" ]; then
        echo -e "${RED}No filename provided${NC}"
        return 1
    fi

    echo ""
    echo -e "${YELLOW}This will remove all occurrences of '${filename}' from Git history${NC}"
    read -p "Continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Operation cancelled"
        return 0
    fi

    create_backup || return 1

    echo ""
    echo -e "${BLUE}Deleting '${filename}' from current HEAD...${NC}"
    find . -name "$filename" -type f -delete
    git add .
    git commit -m "Remove ${filename} from HEAD before BFG cleanup" 2>/dev/null || true

    run_bfg_cleanup "--delete-files '${filename}'"
}

remove_file_pattern() {
    echo ""
    echo -e "${CYAN}Enter the file pattern to remove (e.g., *.hprof, *.log):${NC}"
    read -p "Pattern: " pattern

    if [ -z "$pattern" ]; then
        echo -e "${RED}No pattern provided${NC}"
        return 1
    fi

    echo ""
    echo -e "${YELLOW}This will remove all files matching '${pattern}' from Git history${NC}"
    read -p "Continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Operation cancelled"
        return 0
    fi

    create_backup || return 1

    echo ""
    echo -e "${BLUE}Deleting files matching '${pattern}' from current HEAD...${NC}"
    find . -name "$pattern" -type f -delete
    git add .
    git commit -m "Remove ${pattern} files from HEAD before BFG cleanup" 2>/dev/null || true

    run_bfg_cleanup "--delete-files '${pattern}'"
}

main() {
    cd "$PROJECT_ROOT"

    if ! check_prerequisites; then
        read -p "Press Enter to exit..."
        exit 1
    fi

    if ! ensure_bfg_downloaded; then
        read -p "Press Enter to exit..."
        exit 1
    fi

    while true; do
        show_menu
        read -p "Select an option (1-6): " choice

        case "$choice" in
            1)
                remove_large_files "100M"
                echo ""
                read -p "Press Enter to continue..."
                ;;
            2)
                remove_large_files "50M"
                echo ""
                read -p "Press Enter to continue..."
                ;;
            3)
                remove_large_files "10M"
                echo ""
                read -p "Press Enter to continue..."
                ;;
            4)
                remove_specific_file
                echo ""
                read -p "Press Enter to continue..."
                ;;
            5)
                remove_file_pattern
                echo ""
                read -p "Press Enter to continue..."
                ;;
            6)
                echo "Returning to previous menu..."
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option. Please try again.${NC}"
                sleep 1
                ;;
        esac
    done
}

main
