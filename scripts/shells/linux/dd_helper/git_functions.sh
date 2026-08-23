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
# Git Functions - Python-based with File Variables
# =============================================================================

# Source constants (backup copy)
source "$DD_HELPER_DIR/constants.sh"

# Build full path from constants
GITPUT_UNIFIED_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$GITPUT_UNIFIED_SCRIPT_RELATIVE"
GIT_MANAGEMENT_PY="$CORE_NODE_ROOT_DIR/scripts/git/git_management.py"

# File variables directory (must match scripts/git/git_management_vars.py cache path)
if [ -w "/var/_core_node" ] || [ -d "/var/_core_node/.build_global_vars" ]; then
    GIT_VARS_DIR="/var/_core_node/.build_global_vars"
else
    GIT_VARS_DIR="$HOME/.core_node/.build_global_vars"
fi

# Helper functions for file variables
read_git_var() {
    local key="$1"
    local default="$2"
    local var_file="$GIT_VARS_DIR/$key"

    if [ -f "$var_file" ]; then
        cat "$var_file"
    else
        echo "$default"
    fi
}

write_git_var() {
    local key="$1"
    local value="$2"

    mkdir -p "$GIT_VARS_DIR" 2>/dev/null
    echo "$value" > "$GIT_VARS_DIR/$key"
}

delete_git_var() {
    local key="$1"
    rm -f "$GIT_VARS_DIR/$key" 2>/dev/null
}

clear_git_vars() {
    rm -f "$GIT_VARS_DIR"/git_* 2>/dev/null
}

# Git Management Submenu - Python-based
show_git_management_menu() {
    while true; do
        # Clear previous variables
        clear_git_vars

        # Call Python to show menu and handle user input
        python3 "$GIT_MANAGEMENT_PY"

        # Read operation status from file variable
        local operation_status=$(read_git_var "git_operation_status" "cancelled")
        local operation_type=$(read_git_var "git_operation_type" "")
        local menu_back=$(read_git_var "git_menu_back" "false")

        # Check if user wants to go back to main menu
        if [ "$menu_back" = "true" ]; then
            clear_git_vars
            return
        fi

        # Check operation status
        if [ "$operation_status" = "cancelled" ]; then
            echo ""
            echo -e "\033[33mOperation cancelled.\033[0m"
            read -p "Press Enter to return to Git Management menu..."
            continue
        fi

        if [ "$operation_status" = "failed" ]; then
            local error_msg=$(read_git_var "git_operation_message" "Unknown error")
            echo ""
            echo -e "\033[31mOperation failed: $error_msg\033[0m"
            read -p "Press Enter to return to Git Management menu..."
            continue
        fi

        # Execute the shell command if operation is pending
        if [ "$operation_status" = "pending" ]; then
            local shell_script=$(read_git_var "git_shell_script" "")

            if [ -n "$shell_script" ]; then
                echo ""
                echo -e "\033[36m------------------------------------------------------------\033[0m"
                echo -e "\033[36mExecuting Git operation...\033[0m"
                echo -e "\033[36m------------------------------------------------------------\033[0m"
                echo ""

                # Execute the shell command
                cd "$CORE_NODE_ROOT_DIR"
                eval "$shell_script"
                write_git_var "git_operation_status" "success"
                echo ""
                echo -e "\033[32mOperation completed.\033[0m"

                if [ "$operation_type" = "safe_pull" ] || [ "$operation_type" = "force_overwrite" ]; then
                    make_sh_executable
                fi

                if [ "$operation_type" = "force_overwrite" ]; then
                    local backup_branch=$(read_git_var "git_backup_branch" "")
                    if [ -n "$backup_branch" ]; then
                        echo ""
                        echo -e "\033[36mYour local changes have been backed up to: $backup_branch\033[0m"
                    fi
                fi

                echo ""
                echo -e "\033[36m------------------------------------------------------------\033[0m"
            else
                echo ""
                echo -e "\033[31mError: No shell command generated.\033[0m"
                write_git_var "git_operation_status" "failed"
            fi
        fi

        # Pause before returning to menu
        echo ""
        read -p "Press Enter to return to Git Management menu..."
    done
}
