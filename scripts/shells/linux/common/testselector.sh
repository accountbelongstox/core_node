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

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
source "$SCRIPT_DIR/gvar_common.sh"
source "$SCRIPT_DIR/arrow_menu.sh"

# Test Scripts Selector

# Get install_shells directory path
get_install_shells_dir() {
    local script_dir="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
    local shells_dir="$(dirname "$script_dir")"
    echo "$shells_dir/debian/install_shells"
}

# Get sorted list of install_shells scripts
get_install_scripts() {
    local install_shells_dir=$(get_install_shells_dir)
    local scripts=()
    
    if [ -d "$install_shells_dir" ]; then
        while IFS= read -r -d $'\0' file; do
            local filename=$(basename "$file")
            # Extract the leading number (1_ or 100_ format)
            if [[ $filename =~ ^([0-9]+)_ ]]; then
                local prefix=${BASH_REMATCH[1]}
                scripts+=("$prefix:$file")
            fi
        done < <(find "$install_shells_dir" -maxdepth 1 -name "*.sh" -print0)

        # Sort scripts by numeric prefix
        IFS=$'\n' sorted=($(sort -t: -k1,1n -k2,2 <<<"${scripts[*]}"))
        unset IFS

        # Extract just the file paths
        local result=()
        for item in "${sorted[@]}"; do
            result+=("${item#*:}")
        done
        printf '%s\n' "${result[@]}"
    fi
}

show_test_scripts_context() {
    echo "GLOBAL_VAR_DIR: ${GLOBAL_VAR_DIR}"
}

# Execute selected test script
execute_test_script() {
    local script_path="$1"
    local script_name=$(basename "$script_path")
    
    clear
    echo "  Executing: $script_name"
    echo ""
    
    if [ ! -f "$script_path" ]; then
        echo "Error: Script not found: $script_path"
        echo "Press any key to continue..."
        read -n 1
        return 1
    fi
    
    if [ ! -x "$script_path" ]; then
        echo "Making script executable..."
        chmod +x "$script_path"
    fi
    
    echo "Starting execution of $script_name..."
    
    # Execute the script
    "$script_path"
    local exit_code=$?
    
    echo ""
    echo "Script execution completed with exit code: $exit_code"
    echo "Press any key to return to test scripts menu..."
    read -n 1
    
    return $exit_code
}

# Main test scripts menu loop
test_scripts_main() {
    local scripts=($(get_install_scripts))
    local script_count=${#scripts[@]}
    local script_index
    local script_path
    local selected_index
    local -a menu_items=()
    
    if [ $script_count -eq 0 ]; then
        clear
        echo "  Test Scripts Menu"
        echo ""
        echo "No installation scripts found in install_shells directory."
        echo "Press any key to exit..."
        read -n 1
        exit 0
    fi
    
    for script_index in "${!scripts[@]}"; do
        menu_items+=("$(basename "${scripts[$script_index]}")")
    done
    menu_items+=("Back to Install and Test Environment")

    while true; do
        arrow_menu_select "Test Installation Scripts" menu_items 0 "$script_count" show_test_scripts_context
        selected_index=$ARROW_MENU_SELECTED_INDEX
        if [ "$selected_index" -eq "$script_count" ]; then
            return 0
        fi

        script_path="${scripts[$selected_index]}"
        execute_test_script "$script_path"
    done
}

# Main Program Entry Point

test_scripts_main
