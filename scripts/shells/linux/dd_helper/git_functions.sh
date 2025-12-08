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

# =============================================================================
# Git Functions
# =============================================================================

# Source constants (backup copy)
source "$DD_HELPER_DIR/constants.sh"

# Build full path from constants
GITPUT_UNIFIED_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$GITPUT_UNIFIED_SCRIPT_RELATIVE"
BFG_CLEANUP_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/scripts/git/cleanup_repo_with_bfg.sh"
GIT_TIME_TRAVEL_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/scripts/git/git_time_travel.sh"

# Git Management Submenu
show_git_management_menu() {
    while true; do
        clear
        echo ""
        echo -e "\033[36m==================== Git Management ====================\033[0m"
        echo "  1. Get the latest git version (backup + commit + pull)"
        echo "  2. Cleanup Git repository with BFG (remove large files)"
        echo "  3. Git time travel"
        echo "  4. Back to main menu"
        echo -e "\033[36m========================================================\033[0m"
        read -p "Select an option (1-4): " choice

        case "$choice" in
            1)
                get_git
                read -p "Press Enter to return to Git Management menu..."
                ;;
            2)
                echo "Launching BFG Repo-Cleaner..."
                if [ -f "$BFG_CLEANUP_SCRIPT_PATH" ]; then
                    bash "$BFG_CLEANUP_SCRIPT_PATH"
                else
                    echo -e "\033[31mError: BFG cleanup script not found at $BFG_CLEANUP_SCRIPT_PATH\033[0m"
                    read -p "Press Enter to continue..."
                fi
                ;;
            3)
                echo "Launching Git Time Travel..."
                if [ -f "$GIT_TIME_TRAVEL_SCRIPT_PATH" ]; then
                    bash "$GIT_TIME_TRAVEL_SCRIPT_PATH"
                else
                    echo -e "\033[33mWarning: Git time travel script not found at $GIT_TIME_TRAVEL_SCRIPT_PATH\033[0m"
                fi
                read -p "Press Enter to return to Git Management menu..."
                ;;
            4)
                return 0
                ;;
            *)
                echo -e "\033[31mInvalid option. Please try again.\033[0m"
                sleep 1
                ;;
        esac
    done
}

# Git Functions
get_git() {
    echo "Starting SAFE git pull operation..."
    echo "Using unified git script for safe pull: $GITPUT_UNIFIED_SCRIPT_PATH"

    # Determine target remote based on region setting
    local selected_region=$(get_global_var "SELECTED_REGION")
    local target_remote="gitee"  # default
    if [ "$selected_region" = "Global" ]; then
        target_remote="github"
    fi

    echo "Target remote: $target_remote (based on region: $selected_region)"

    # Execute safe pull using unified script
    cd "$CORE_NODE_ROOT_DIR"
    bash "$GITPUT_UNIFIED_SCRIPT_PATH" --pull "$target_remote"

    if [ $? -eq 0 ]; then
        echo "Safe git pull operation completed successfully!"
        make_sh_executable
    else
        echo "Safe git pull operation failed. Please check the output above for resolution options."
    fi
}
