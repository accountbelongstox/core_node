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

ensure_git_filter_repo() {
    if ! command -v git-filter-repo &> /dev/null; then
        echo ""
        echo -e "${YELLOW}git-filter-repo not found. Installing...${NC}"

        if command -v pip3 &> /dev/null; then
            echo -e "${CYAN}Attempting pip3 install with --break-system-packages...${NC}"
            pip3 install --user --break-system-packages git-filter-repo 2>&1

            local filter_repo_path=$(python3 -c "import site,glob; paths=glob.glob(site.USER_BASE + '/bin/git-filter-repo'); print(paths[0] if paths else '')" 2>/dev/null)

            echo -e "${CYAN}Searching in: $(python3 -c "import site; print(site.USER_BASE)")/bin/git-filter-repo${NC}"

            if [ -n "$filter_repo_path" ] && [ -f "$filter_repo_path" ]; then
                echo -e "${BLUE}Found at: $filter_repo_path${NC}"
                echo -e "${BLUE}Copying git-filter-repo to /usr/local/bin...${NC}"
                if command -v sudo &> /dev/null; then
                    if sudo cp "$filter_repo_path" /usr/local/bin/git-filter-repo 2>/dev/null; then
                        sudo chmod +x /usr/local/bin/git-filter-repo
                        echo -e "${GREEN}�?Installed to /usr/local/bin/git-filter-repo${NC}"
                    else
                        echo -e "${YELLOW}�?No permission for /usr/local/bin, using ~/.local/bin${NC}"
                        mkdir -p ~/.local/bin
                        cp "$filter_repo_path" ~/.local/bin/git-filter-repo
                        chmod +x ~/.local/bin/git-filter-repo
                        export PATH="$HOME/.local/bin:$PATH"
                        echo -e "${GREEN}�?Installed to ~/.local/bin/git-filter-repo${NC}"
                    fi
                else
                    cp "$filter_repo_path" /usr/local/bin/git-filter-repo 2>/dev/null || {
                        echo -e "${YELLOW}�?No permission for /usr/local/bin, using ~/.local/bin${NC}"
                        mkdir -p ~/.local/bin
                        cp "$filter_repo_path" ~/.local/bin/git-filter-repo
                        chmod +x ~/.local/bin/git-filter-repo
                        export PATH="$HOME/.local/bin:$PATH"
                        echo -e "${GREEN}�?Installed to ~/.local/bin/git-filter-repo${NC}"
                    }
                fi
            fi

            if command -v git-filter-repo &> /dev/null; then
                echo -e "${GREEN}�?git-filter-repo installed successfully${NC}"
                git filter-repo --help > /dev/null 2>&1
                if [ $? -eq 0 ]; then
                    echo -e "${GREEN}�?git-filter-repo is working${NC}"
                fi
                return 0
            else
                echo -e "${RED}�?Failed to install git-filter-repo${NC}"
                echo ""
                echo -e "${YELLOW}Please install manually:${NC}"
                echo -e "  ${CYAN}pip3 install --user --break-system-packages git-filter-repo${NC}"
                echo -e "  ${CYAN}or${NC}"
                echo -e "  ${CYAN}sudo apt install git-filter-repo${NC}"
                echo ""
                read -p "Press Enter to continue..."
                return 1
            fi
        else
            echo -e "${RED}Error: pip3 is not installed${NC}"
            echo "Please install pip3 to install git-filter-repo:"
            echo "  Ubuntu/Debian: sudo apt install python3-pip"
            echo "  CentOS/RHEL:   sudo yum install python3-pip"
            echo ""
            read -p "Press Enter to continue..."
            return 1
        fi
    else
        echo -e "${GREEN}git-filter-repo already installed${NC}"
        return 0
    fi
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

save_remote_url() {
    local remote_url=$(git remote get-url origin 2>/dev/null)
    if [ -n "$remote_url" ]; then
        echo "$remote_url" > .git/SAVED_REMOTE_URL
        echo -e "${GREEN}Saved remote URL: $remote_url${NC}"
        return 0
    else
        echo -e "${YELLOW}Warning: No remote URL found to save${NC}"
        return 1
    fi
}

restore_remote_url() {
    local saved_url_file=".git/SAVED_REMOTE_URL"

    if [ ! -f "$saved_url_file" ]; then
        echo -e "${YELLOW}No saved remote URL found${NC}"
        return 1
    fi

    local saved_url=$(cat "$saved_url_file")
    if [ -n "$saved_url" ]; then
        echo ""
        echo -e "${BLUE}Restoring remote URL...${NC}"

        if git remote get-url origin &> /dev/null; then
            git remote set-url origin "$saved_url"
        else
            git remote add origin "$saved_url"
        fi

        echo -e "${GREEN}Remote URL restored: $saved_url${NC}"
        rm -f "$saved_url_file"
        return 0
    else
        echo -e "${RED}Saved remote URL is empty${NC}"
        return 1
    fi
}

remove_directory() {
    echo ""
    echo -e "${CYAN}Enter directory path to remove (e.g., .venv, node_modules, dist):${NC}"
    echo -e "${CYAN}You can enter multiple directories separated by spaces${NC}"
    read -p "Directory path(s): " dir_paths

    if [ -z "$dir_paths" ]; then
        echo -e "${RED}No directory path provided${NC}"
        echo ""
        read -p "Press Enter to continue..."
        return 1
    fi

    local cleaned_dirs=""
    for dir in $dir_paths; do
        dir_clean="${dir%/}"
        cleaned_dirs="$cleaned_dirs $dir_clean"
    done
    dir_paths="$cleaned_dirs"

    echo ""
    echo -e "${YELLOW}This will remove the following directories from Git history:${NC}"
    for dir_path in $dir_paths; do
        echo -e "  - ${YELLOW}${dir_path}${NC}"
    done

    echo ""
    echo -e "${RED}WARNING: This operation will:${NC}"
    echo -e "${RED}  1. Rewrite Git history${NC}"
    echo -e "${RED}  2. Automatically remove all remotes (git-filter-repo behavior)${NC}"
    echo -e "${RED}  3. Require force push to update remote repository${NC}"

    echo ""
    read -p "${CYAN}Continue? (yes/no): ${NC}" confirm

    if [ "$confirm" != "yes" ]; then
        echo -e "${GREEN}Operation cancelled${NC}"
        echo ""
        read -p "Press Enter to continue..."
        return 0
    fi

    if ! ensure_git_filter_repo; then
        echo -e "${RED}Cannot proceed without git-filter-repo${NC}"
        return 1
    fi

    local backup_branch="backup-before-filter-repo-$(date +%Y%m%d-%H%M%S)"
    echo ""
    echo -e "${BLUE}Creating backup branch: ${backup_branch}${NC}"
    git branch "$backup_branch" 2>/dev/null

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}�?Backup branch created successfully${NC}"
    else
        echo -e "${RED}Failed to create backup branch${NC}"
        return 1
    fi

    save_remote_url

    echo ""
    echo -e "${BLUE}Removing directories from current HEAD...${NC}"
    for dir_path in $dir_paths; do
        if [ -d "$dir_path" ]; then
            rm -rf "$dir_path"
            echo -e "${GREEN}�?Removed from HEAD: $dir_path${NC}"
        else
            echo -e "${YELLOW}�?Directory not found in current HEAD: $dir_path${NC}"
        fi
    done

    echo ""
    echo -e "${BLUE}Staging changes...${NC}"
    git add .

    echo -e "${BLUE}Committing changes...${NC}"
    if git commit -m "Remove large files from HEAD before BFG cleanup" 2>/dev/null; then
        echo -e "${GREEN}�?Changes committed${NC}"
    else
        echo -e "${YELLOW}�?No changes to commit (already clean)${NC}"
    fi

    echo ""
    echo -e "${BLUE}Running git-filter-repo to clean history...${NC}"

    local filter_args=""
    for dir_path in $dir_paths; do
        filter_args="$filter_args --path ${dir_path} --invert-paths"
    done

    echo -e "${CYAN}Command: git filter-repo $filter_args --force${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""

    git filter-repo $filter_args --force
    local exit_code=$?

    echo ""
    echo -e "${CYAN}�?Waiting 5 seconds for cleanup to settle...${NC}"
    sleep 5
    echo ""

    if [ $exit_code -eq 0 ]; then
        echo ""
        echo -e "${GREEN}�?Directories successfully removed from Git history${NC}"

        echo ""
        echo -e "${BLUE}Restoring remote URL to default...${NC}"
        restore_remote_url

        echo ""
        echo -e "${CYAN}Repository size after cleanup:${NC}"
        du -sh .git

        echo ""
        echo -e "${CYAN}📦 Backup branch created: $backup_branch${NC}"
        echo -e "${YELLOW}To recover old changes:${NC}"
        echo -e "  ${CYAN}git checkout $backup_branch${NC}"

        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANT: Local changes have been cleaned.${NC}"
        echo -e "${YELLOW}⚠️  DO NOT push to remote unless you want to update it.${NC}"
        echo -e "${YELLOW}⚠️  If you want to push:${NC}"
        echo -e "  ${CYAN}git push origin --force --all${NC}"
        echo -e "  ${CYAN}git push origin --force --tags${NC}"

        echo ""
        echo -e "${CYAN}============================================================${NC}"
        return 0
    else
        echo ""
        echo -e "${RED}�?git-filter-repo failed${NC}"
        echo ""
        echo -e "${BLUE}Attempting to restore remote URL...${NC}"
        restore_remote_url
        echo ""
        echo -e "${CYAN}============================================================${NC}"
        return 1
    fi
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
        read -p "Select an option (1-7): " choice

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
                remove_directory
                echo ""
                read -p "Press Enter to continue..."
                ;;
            7)
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
