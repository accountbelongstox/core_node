#!/bin/bash

# Get the current script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

select_install_type() {
    # Get all subdirectories in the current script directory
    mapfile -t options < <(find "$SCRIPT_DIR" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)
    
    # Display options once
    echo "Available installation types:"
    for i in "${!options[@]}"; do
        echo "$((i+1))) ${options[i]}"
    done
    echo "0) cancel"
    
    while true; do
        PS3="Select install type (0-${#options[@]}): "
        read -p "$PS3" choice
        
        if [ "$choice" = "0" ]; then
            echo "Installation canceled."
            return
        fi
        
        if [ "$choice" -gt 0 ] && [ "$choice" -le "${#options[@]}" ] 2>/dev/null; then
            install_type="${options[$((choice-1))]}"
            INSTALL_SCRIPT="$SCRIPT_DIR/$install_type/install.sh"
            
            if [[ -f "$INSTALL_SCRIPT" ]]; then
                echo "Selected install type: $install_type"
                echo "Script to be executed: $INSTALL_SCRIPT"
                
                read -p "Do you want to proceed with this installation? (y/N): " confirm
                if [[ $confirm =~ ^[Yy]$ ]]; then
                    echo "Running install script: $INSTALL_SCRIPT"
                    bash "$INSTALL_SCRIPT"
                else
                    echo "Installation cancelled. Returning to menu..."
                    continue
                fi
            else
                echo "Error: Install script not found for $install_type: $INSTALL_SCRIPT"
                echo "Please ensure the script exists at the specified path."
                echo "Press Enter to return to menu..."
                read
                continue
            fi
            return
        else
            echo "Invalid option. Please select a number between 0 and ${#options[@]}."
        fi
    done
}

# Execute the function
select_install_type
