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

# Declare all variables at the beginning
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
CORE_NODE_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
ORIGINAL_LOCATION=$(pwd)
MAX_COMMITS=50
COMMIT_HISTORY=()
CURRENT_INDEX=0
ORIGINAL_BRANCH=""
COMMIT_CREATED=false
DETACHED_HEAD=false

# Function to display colored text
write_color_text() {
    local text="$1"
    local color="$2"

    case "$color" in
        "Green")
            echo -e "\033[32m$text\033[0m"
            ;;
        "Yellow")
            echo -e "\033[33m$text\033[0m"
            ;;
        "Red")
            echo -e "\033[31m$text\033[0m"
            ;;
        "Cyan")
            echo -e "\033[36m$text\033[0m"
            ;;
        "Magenta")
            echo -e "\033[35m$text\033[0m"
            ;;
        "DarkGray")
            echo -e "\033[90m$text\033[0m"
            ;;
        "White")
            echo -e "\033[97m$text\033[0m"
            ;;
        *)
            echo "$text"
            ;;
    esac
}

# Function to get current branch
get_current_branch() {
    local branch
    branch=$(git branch --show-current 2>/dev/null)
    if [ -z "$branch" ]; then
        branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    fi
    if [ -z "$branch" ] || [ "$branch" = "HEAD" ]; then
        echo ""
    else
        echo "$branch"
    fi
}

# Function to commit current changes
save_local_changes() {
    write_color_text "" "White"
    write_color_text "=== Saving Local Changes ===" "Cyan"

    # Check for uncommitted changes
    local status
    status=$(git status --porcelain 2>/dev/null)
    if [ -n "$status" ]; then
        write_color_text "Found uncommitted changes. Committing to local repository..." "Yellow"

        # Stage all changes
        write_color_text "Staging all changes..." "Cyan"
        git add .

        # Get commit message
        local timestamp
        timestamp=$(date "+%Y-%m-%d %H:%M:%S")
        echo -n "Enter commit message (press Enter to use timestamp): "
        read -r commit_message

        if [ -z "$commit_message" ]; then
            commit_message="$timestamp"
            write_color_text "Using timestamp as commit message: $timestamp" "Cyan"
        else
            write_color_text "Using custom commit message: $commit_message" "Green"
        fi

        # Commit changes
        git commit -m "$commit_message"

        if [ $? -eq 0 ]; then
            write_color_text "Local changes committed successfully!" "Green"
            COMMIT_CREATED=true
        else
            write_color_text "Warning: Failed to commit changes" "Red"
            echo -n "Continue anyway? (Y/N): "
            read -r response
            if [ "$response" != "Y" ] && [ "$response" != "y" ]; then
                write_color_text "Operation cancelled by user" "Red"
                exit 1
            fi
        fi
    else
        write_color_text "No uncommitted changes found." "Green"
    fi
}

# Function to load commit history
load_commit_history() {
    write_color_text "" "White"
    write_color_text "=== Loading Commit History ===" "Cyan"

    # Get commit history with format: hash|short_hash|date|author|subject
    local git_log
    git_log=$(git log --oneline --format="%H|%h|%ci|%an|%s" -n "$MAX_COMMITS" 2>/dev/null)

    if [ -z "$git_log" ]; then
        write_color_text "Failed to load commit history" "Red"
        exit 1
    fi

    # Parse commit history into array
    COMMIT_HISTORY=()
    while IFS='|' read -r full_hash short_hash date author subject; do
        COMMIT_HISTORY+=("$full_hash|$short_hash|$date|$author|$subject")
    done <<< "$git_log"

    write_color_text "Loaded ${#COMMIT_HISTORY[@]} commits" "Green"
}

# Function to display current commit info
show_current_commit() {
    clear

    # Parse current commit info
    local commit_line="${COMMIT_HISTORY[$CURRENT_INDEX]}"
    IFS='|' read -r full_hash short_hash date author subject <<< "$commit_line"

    local total_commits=${#COMMIT_HISTORY[@]}

    write_color_text "===============================================" "Cyan"
    write_color_text "        GIT TIME TRAVEL" "Magenta"
    write_color_text "===============================================" "Cyan"
    echo ""

    # Show position
    echo -n "Position: "
    write_color_text "$((CURRENT_INDEX + 1)) / $total_commits" "White"

    if [ $CURRENT_INDEX -eq 0 ]; then
        echo -n "Status: "
        write_color_text "LATEST COMMIT" "Green"
    else
        echo -n "Status: "
        write_color_text "HISTORICAL COMMIT ($CURRENT_INDEX commits back)" "Yellow"
    fi

    echo ""
    write_color_text "-----------------------------------------------" "DarkGray"
    echo -n "Commit: "
    write_color_text "$short_hash" "Cyan"
    echo -n "Date: "
    write_color_text "$date" "White"
    echo -n "Author: "
    write_color_text "$author" "White"
    echo -n "Message: "
    write_color_text "$subject" "White"
    write_color_text "-----------------------------------------------" "DarkGray"
    echo ""

    # Show controls
    write_color_text "Controls:" "Cyan"
    write_color_text "  [Left Arrow]  Previous commit (older)" "White"
    write_color_text "  [Right Arrow] Next commit (newer)" "White"
    write_color_text "  [h]           Jump to latest commit (Home)" "White"
    write_color_text "  [e]           Jump to oldest commit (End)" "White"
    write_color_text "  [d]           Show diff with previous commit" "White"
    write_color_text "  [l]           Show commit log details" "White"
    write_color_text "  [q]           Quit and restore branch" "White"
    echo ""
    write_color_text "===============================================" "Cyan"
}

# Function to checkout specific commit
switch_to_commit() {
    local index=$1
    local commit_line="${COMMIT_HISTORY[$index]}"
    IFS='|' read -r full_hash short_hash date author subject <<< "$commit_line"

    write_color_text "" "White"
    write_color_text "Switching to commit $short_hash..." "Cyan"

    git checkout "$full_hash" --quiet 2>/dev/null

    if [ $? -eq 0 ]; then
        DETACHED_HEAD=true
        write_color_text "Switched successfully!" "Green"
        sleep 0.5
    else
        write_color_text "Failed to switch commit" "Red"
        sleep 1
    fi
}

# Function to show diff
show_commit_diff() {
    local commit_line="${COMMIT_HISTORY[$CURRENT_INDEX]}"
    IFS='|' read -r full_hash short_hash date author subject <<< "$commit_line"

    clear
    write_color_text "=== Diff for commit $short_hash ===" "Cyan"
    echo ""

    git show --stat "$full_hash"

    echo ""
    echo -n "Press any key to continue..."
    read -n 1 -s -r
}

# Function to show commit log details
show_commit_log() {
    local commit_line="${COMMIT_HISTORY[$CURRENT_INDEX]}"
    IFS='|' read -r full_hash short_hash date author subject <<< "$commit_line"

    clear
    write_color_text "=== Details for commit $short_hash ===" "Cyan"
    echo ""

    git show --no-patch --format=fuller "$full_hash"

    echo ""
    echo -n "Press any key to continue..."
    read -n 1 -s -r
}

# Function to handle keyboard input
start_interactive_navigation() {
    show_current_commit

    local needs_update=false

    while true; do
        # Read one character at a time
        read -rsn1 key

        needs_update=false

        # Check for escape sequence (arrow keys)
        if [ "$key" = $'\x1b' ]; then
            read -rsn2 -t 0.1 key
            case "$key" in
                "[D")  # Left Arrow - Go to previous (older) commit
                    if [ $CURRENT_INDEX -lt $((${#COMMIT_HISTORY[@]} - 1)) ]; then
                        CURRENT_INDEX=$((CURRENT_INDEX + 1))
                        switch_to_commit $CURRENT_INDEX
                        needs_update=true
                    else
                        write_color_text "" "White"
                        write_color_text "Already at oldest commit!" "Yellow"
                        sleep 0.5
                        needs_update=true
                    fi
                    ;;
                "[C")  # Right Arrow - Go to next (newer) commit
                    if [ $CURRENT_INDEX -gt 0 ]; then
                        CURRENT_INDEX=$((CURRENT_INDEX - 1))
                        switch_to_commit $CURRENT_INDEX
                        needs_update=true
                    else
                        write_color_text "" "White"
                        write_color_text "Already at latest commit!" "Yellow"
                        sleep 0.5
                        needs_update=true
                    fi
                    ;;
            esac
        else
            # Handle regular key presses
            case "$key" in
                h|H)  # Home - Jump to latest commit
                    if [ $CURRENT_INDEX -ne 0 ]; then
                        CURRENT_INDEX=0
                        switch_to_commit $CURRENT_INDEX
                        needs_update=true
                    fi
                    ;;
                e|E)  # End - Jump to oldest commit
                    local last_index=$((${#COMMIT_HISTORY[@]} - 1))
                    if [ $CURRENT_INDEX -ne $last_index ]; then
                        CURRENT_INDEX=$last_index
                        switch_to_commit $CURRENT_INDEX
                        needs_update=true
                    fi
                    ;;
                d|D)  # Show diff
                    show_commit_diff
                    needs_update=true
                    ;;
                l|L)  # Show log
                    show_commit_log
                    needs_update=true
                    ;;
                q|Q)  # Quit
                    write_color_text "" "White"
                    write_color_text "Exiting Git Time Travel..." "Cyan"
                    return
                    ;;
            esac
        fi

        if [ "$needs_update" = true ]; then
            show_current_commit
        fi
    done
}

# Function to cleanup and restore original state
restore_original_state() {
    write_color_text "" "White"
    write_color_text "=== Restoring Original State ===" "Cyan"

    if [ "$DETACHED_HEAD" = true ] && [ -n "$ORIGINAL_BRANCH" ]; then
        write_color_text "Returning to branch: $ORIGINAL_BRANCH" "Yellow"
        git checkout "$ORIGINAL_BRANCH" --quiet 2>/dev/null

        if [ $? -eq 0 ]; then
            write_color_text "Branch restored successfully!" "Green"
        else
            write_color_text "Warning: Failed to restore branch" "Red"
        fi
    fi

    if [ "$COMMIT_CREATED" = true ]; then
        write_color_text "Local changes were committed before time travel." "Green"
        write_color_text "Commit is preserved in git history." "Green"
    fi
}

# Function to cleanup on exit
cleanup() {
    restore_original_state

    # Restore original location
    cd "$ORIGINAL_LOCATION" || exit
    write_color_text "" "White"
    write_color_text "Restored to: $ORIGINAL_LOCATION" "DarkGray"
    echo ""
}

# Trap exit signals
trap cleanup EXIT INT TERM

# Main execution
main() {
    write_color_text "===============================================" "Magenta"
    write_color_text "   Git Time Travel - Interactive Navigation" "Magenta"
    write_color_text "===============================================" "Magenta"
    echo ""
    write_color_text "Working Directory: $CORE_NODE_DIR" "Cyan"
    echo ""

    # Change to core_node directory
    cd "$CORE_NODE_DIR" || {
        write_color_text "Failed to change to $CORE_NODE_DIR" "Red"
        exit 1
    }
    write_color_text "Changed to: $CORE_NODE_DIR" "Green"

    # Check if in a git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        write_color_text "Not a git repository" "Red"
        exit 1
    fi

    # Store original branch
    ORIGINAL_BRANCH=$(get_current_branch)
    if [ -n "$ORIGINAL_BRANCH" ]; then
        write_color_text "Current branch: $ORIGINAL_BRANCH" "Green"
    else
        write_color_text "Warning: Already in detached HEAD state" "Yellow"
        echo -n "Continue? (Y/N): "
        read -r response
        if [ "$response" != "Y" ] && [ "$response" != "y" ]; then
            write_color_text "Operation cancelled by user" "Red"
            exit 1
        fi
    fi

    # IMPORTANT: Commit local changes first
    save_local_changes

    # Load commit history (after commit, so new commit is included)
    load_commit_history

    # Start interactive navigation
    start_interactive_navigation
}

# Run main function
main "$@"
