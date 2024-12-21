#!/bin/bash

# Get the current script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

select_install_type() {
    while true; do
        PS3="Select install type (1: local, 2: caddy-golang): "
        options=("local" "caddy-golang")
        select install_type in "${options[@]}"; do
            case "$install_type" in
                "local"|"caddy-golang")
                    echo "Selected install type: $install_type"
                    INSTALL_SCRIPT="$SCRIPT_DIR/$install_type/install.sh"
                    
                    if [[ -f "$INSTALL_SCRIPT" ]]; then
                        echo "Running install script: $INSTALL_SCRIPT"
                        bash "$INSTALL_SCRIPT"
                    else
                        echo "Error: Install script not found for $install_type: $INSTALL_SCRIPT."
                    fi
                    return
                    ;;
                "pve")
                    echo "Selected install type: $install_type"
                    INSTALL_SCRIPT="$SCRIPT_DIR/pve/install.sh"
                    
                    if [[ -f "$INSTALL_SCRIPT" ]]; then
                        echo "Running install script: $INSTALL_SCRIPT"
                        bash "$INSTALL_SCRIPT"
                    else
                        echo "Error: Install script not found for pve: $INSTALL_SCRIPT."
                    fi
                    return
                    ;;
                "cancel")
                    echo "Installation canceled."
                    return
                    ;;
                *)
                    echo "Invalid option. Please select a number between 0 and ${#options[@]}-1."
                    ;;
            esac
        done
    done
}

select_install_type
