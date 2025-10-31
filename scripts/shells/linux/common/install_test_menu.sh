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
source "$SCRIPT_CURRENT_DIR/gvar_common.sh"

# Install and Test Menu Selector

# Menu options
declare -a MENU_OPTIONS=(
    "Install the server"
    "Test installation scripts"
    "Return to main menu"
)

# Install mode options
declare -a INSTALL_MODES=("base" "server" "full")

# Current selection index
current_selection=0

# Get current install mode index
get_current_mode_index() {
    local current_mode=$(get_var "INSTALL_MODE" 2>/dev/null || echo "base")
    for i in "${!INSTALL_MODES[@]}"; do
        if [ "${INSTALL_MODES[$i]}" = "$current_mode" ]; then
            echo "$i"
            return
        fi
    done
    echo "0"  # Default to base if not found
}

# Set install mode
set_install_mode() {
    local mode="$1"
    set_var "INSTALL_MODE" "$mode"
    set_var "INSTALL_TYPE" "$mode"  # Sync with INSTALL_TYPE
}

# Display the install/test menu
show_install_test_menu() {
    clear
    echo "  Install and Test Environment"
    echo "GLOBAL_VAR_DIR: ${GLOBAL_VAR_DIR}"
    
    # Get current install mode
    local current_mode=$(get_var "INSTALL_MODE" 2>/dev/null || echo "base")
    echo "Current Install Mode: $current_mode"
    echo ""
    echo "Please select an option:"
    echo "--------------------------------------"
    
    for i in "${!MENU_OPTIONS[@]}"; do
        local option_display="${MENU_OPTIONS[$i]}"
        
        # Add mode display for Install the server option
        if [ $i -eq 0 ]; then
            option_display="$option_display [$current_mode]"
        fi
        
        if [ $i -eq $current_selection ]; then
            printf "\033[34m> $option_display\033[0m\n"
        else
            echo "  $option_display"
        fi
    done
    
    echo ""
    echo "Navigation: Up/Down arrows to move, Left/Right arrows to change install mode, Enter to select"
    echo "Press Q to quit"
}

# Function to find and sort installation scripts
get_installation_scripts() {
    local install_shells_dir="$1"
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
        IFS=$'\n' sorted=($(sort -n -t: -k1 <<<"${scripts[*]}"))
        unset IFS

        # Extract just the file paths
        local result=()
        for item in "${sorted[@]}"; do
            result+=("${item#*:}")
        done
        echo "${result[@]}"
    else
        echo ""
    fi
}

# Function to execute installation scripts
execute_installation_scripts() {
    local install_shells_dir="$1"
    local scripts=($(get_installation_scripts "$install_shells_dir"))

    echo "INSTALL_SHELLS_DIR: $install_shells_dir"
    if [ ${#scripts[@]} -eq 0 ]; then
        echo "No installation scripts found in $install_shells_dir"
        return
    fi

    echo "The following installation scripts will be executed in order:"
    for script in "${scripts[@]}"; do
        echo "  - $(basename "$script")"
    done
    echo

    for script in "${scripts[@]}"; do
        echo
        echo "Executing: $(basename "$script")"
        if [ ! -x "$script" ]; then
            chmod +x "$script"
        fi
        "$script" 
    done
}

# Execute the selected option
execute_selection() {
    local selection=$1
    
    case $selection in
        0)  # Install the server
            echo "Core Node Installation Script"
            echo
            
            # Run selector to get configuration
            echo "Running configuration selector..."
            "${SCRIPT_DIR}/selector_common.sh"
            
            # Get the selected mode after selector runs
            local install_mode=$(get_var "INSTALL_MODE")
            echo "Selected options:"
            echo "  Installation mode: $install_mode"
            echo
            
            # Set installation variables for services (always install, START_* controls whether to start)
            echo "Setting up installation variables for services..."
            set_var "INSTALL_MYSQL" "true"
            set_var "INSTALL_REDIS" "true"
            set_var "INSTALL_POSTGRESQL" "true"
            set_var "INSTALL_DOCKER" "true"
            set_var "INSTALL_NGINX" "true"

            # Execute installation scripts
            local shells_dir="$(dirname "$SCRIPT_DIR")"
            local install_shells_dir="$shells_dir/debian/install_shells"

            execute_installation_scripts "$install_shells_dir"
            
            echo
            echo "Installation completed successfully!"
            echo "Press any key to return to menu..."
            read -n 1
            ;;
        1)  # Test installation scripts
            echo "Opening test scripts menu..."
            local test_script="${SCRIPT_DIR}/testselector.sh"
            
            if [ ! -f "$test_script" ]; then
                echo "Error: testselector.sh not found at $test_script"
                echo "Press any key to continue..."
                read -n 1
                return
            fi
            
            if [ ! -x "$test_script" ]; then
                echo "Making testselector.sh executable..."
                chmod +x "$test_script"
            fi
            
            bash "$test_script"
            ;;
        2)  # Return to main menu
            echo "Returning to main menu..."
            exit 0
            ;;
    esac
}

# Main Program Entry Point

# Main loop
while true; do
    show_install_test_menu
    
    # Read keyboard input
    read -rsn1 key
    case "$key" in
        $'\x1b')  # ESC sequence (arrow keys)
            read -rsn2 -t 0.1 key2
            case "$key2" in
                '[A')  # Up arrow
                    if [ $current_selection -gt 0 ]; then
                        ((current_selection--))
                    fi
                    ;;
                '[B')  # Down arrow
                    if [ $current_selection -lt $((${#MENU_OPTIONS[@]} - 1)) ]; then
                        ((current_selection++))
                    fi
                    ;;
                '[C')  # Right arrow - only for "Install the server" option
                    if [ $current_selection -eq 0 ]; then
                        current_mode_index=$(get_current_mode_index)
                        next_mode_index=$(( (current_mode_index + 1) % ${#INSTALL_MODES[@]} ))
                        set_install_mode "${INSTALL_MODES[$next_mode_index]}"
                    fi
                    ;;
                '[D')  # Left arrow - only for "Install the server" option
                    if [ $current_selection -eq 0 ]; then
                        current_mode_index=$(get_current_mode_index)
                        prev_mode_index=$(( (current_mode_index - 1 + ${#INSTALL_MODES[@]}) % ${#INSTALL_MODES[@]} ))
                        set_install_mode "${INSTALL_MODES[$prev_mode_index]}"
                    fi
                    ;;
            esac
            ;;
        "")  # Enter key
            execute_selection $current_selection
            ;;
        [qQ])  # Q key to quit
            echo ""
            echo "Exiting..."
            exit 0
            ;;
    esac
done