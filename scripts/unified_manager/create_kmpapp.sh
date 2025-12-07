#!/bin/bash
# Create New Kotlin KMP APP Script
# This script creates a new KMP app by cloning the alkaa template repository

# Get the root directory (2 levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
POLY_APPS="$ROOT_DIR/poly_apps"

# Get next available index for kmpapp directory
get_next_kmpapp_index() {
    local poly_apps_path="$POLY_APPS"
    
    if [ ! -d "$poly_apps_path" ]; then
        echo "1"
        return
    fi
    
    local max_index=0
    local existing_dirs
    
    # Find all kmpapp_* directories
    while IFS= read -r dir; do
        if [[ "$dir" =~ ^kmpapp_([0-9]+)$ ]]; then
            local index="${BASH_REMATCH[1]}"
            if [ "$index" -gt "$max_index" ]; then
                max_index=$index
            fi
        fi
    done < <(find "$poly_apps_path" -maxdepth 1 -type d -name "kmpapp_*" -printf "%f\n" 2>/dev/null || ls -1 "$poly_apps_path" | grep "^kmpapp_[0-9]\+$" 2>/dev/null)
    
    echo $((max_index + 1))
}

# Create new Kotlin KMP APP from alkaa template
create_new_kmpapp() {
    echo ""
    echo -e "\033[36m=== Create New Kotlin KMP APP ===\033[0m"
    echo ""
    
    local alkaa_repo_url="https://github.com/igorescodro/alkaa.git"
    local poly_apps_path="$POLY_APPS"
    
    # Ensure poly_apps directory exists
    if [ ! -d "$poly_apps_path" ]; then
        echo -e "\033[33mCreating poly_apps directory...\033[0m"
        echo "Command: mkdir -p \"$poly_apps_path\"" | sed 's/^/  /'
        mkdir -p "$poly_apps_path"
    fi
    
    # Get next available index
    local next_index=$(get_next_kmpapp_index)
    local default_app_name="kmpapp_$next_index"

    # Prompt user for custom app name
    echo -e "\033[32mDefault app name: $default_app_name\033[0m"
    echo ""
    echo -ne "\033[36mEnter custom app name (or press Enter to use default): \033[0m"
    read custom_name

    # Use custom name if provided, otherwise use default
    if [ -z "$custom_name" ]; then
        local new_app_name="$default_app_name"
        echo -e "\033[33mUsing default name: $new_app_name\033[0m"
    else
        # Sanitize the custom name (remove invalid characters)
        local new_app_name=$(echo "$custom_name" | tr -d '<>:"/\|?*')
        if [ "$new_app_name" != "$custom_name" ]; then
            echo -e "\033[33mName sanitized to: $new_app_name\033[0m"
        else
            echo -e "\033[33mUsing custom name: $new_app_name\033[0m"
        fi
    fi

    local new_app_path="$poly_apps_path/$new_app_name"
    echo ""

    # Check if directory already exists
    if [ -d "$new_app_path" ]; then
        echo -e "\033[31mERROR: Directory already exists: $new_app_path\033[0m"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "\033[32mApp name: $new_app_name\033[0m"
    echo -e "\033[32mTarget path: $new_app_path\033[0m"
    echo ""
    echo -e "\033[36mCloning alkaa repository from: $alkaa_repo_url\033[0m"
    echo ""
    
    # Confirm before proceeding
    read -p "Press any key to continue, or 'n' to cancel..." -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo -e "\033[33mOperation cancelled\033[0m"
        sleep 1
        return
    fi
    
    # Change to poly_apps directory
    local original_location=$(pwd)
    cd "$poly_apps_path" || return
    
    echo -e "\033[36mChanged to directory: $poly_apps_path\033[0m"
    echo "Command: cd \"$poly_apps_path\"" | sed 's/^/  /'
    echo ""
    
    # Clone the repository
    echo -e "\033[36mCloning repository...\033[0m"
    echo "Command: git clone $alkaa_repo_url $new_app_name" | sed 's/^/  /'
    echo ""

    # Run git clone and display all output directly
    git clone "$alkaa_repo_url" "$new_app_name" 2>&1
    echo ""

    # Check if directory was actually created (don't rely on exit code)
    if [ -d "$new_app_path" ]; then
        echo -e "\033[32mNew KMP APP created at: $new_app_path\033[0m"
        echo ""

        # Remove .git and .github directories
        echo -e "\033[36mRemoving .git and .github directories from cloned repository...\033[0m"

        local git_dir="$new_app_path/.git"
        local github_dir="$new_app_path/.github"

        # Remove .git directory
        if [ -d "$git_dir" ]; then
            rm -rf "$git_dir" 2>/dev/null
            if [ ! -d "$git_dir" ]; then
                echo -e "\033[32mSuccessfully removed .git directory\033[0m"
            else
                echo -e "\033[33mWarning: .git directory could not be removed\033[0m"
            fi
        else
            echo -e "\033[90m.git directory not found\033[0m"
        fi

        # Remove .github directory
        if [ -d "$github_dir" ]; then
            rm -rf "$github_dir" 2>/dev/null
            if [ ! -d "$github_dir" ]; then
                echo -e "\033[32mSuccessfully removed .github directory\033[0m"
            else
                echo -e "\033[33mWarning: .github directory could not be removed\033[0m"
            fi
        else
            echo -e "\033[90m.github directory not found\033[0m"
        fi
        echo ""

        echo -e "\033[32mKMP APP created successfully!\033[0m"
        echo -e "\033[36mLocation: $new_app_path\033[0m"
    else
        echo -e "\033[31mERROR: Directory was not created at: $new_app_path\033[0m"
        echo -e "\033[31mClone operation did not succeed.\033[0m"
    fi
    
    # Restore original location
    cd "$original_location" || return
    echo -e "\033[36mRestored to original directory: $original_location\033[0m"
    
    echo ""
    read -p "Press Enter to continue..."
}

# Run the script
create_new_kmpapp
