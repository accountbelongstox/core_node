#!/bin/bash

# Get the current script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

select_install_type() {
    while true; do
        PS3="Select install type (1: server, 2: pve, 3: local, 4: docker-internal, 5: cancel): "
        options=("server" "pve" "local" "docker-internal" "cancel")
        select install_type in "${options[@]}"; do
            case "$install_type" in
                "server"|"local"|"docker-internal")
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
                    echo "Invalid option. Please select a number between 1 and ${#options[@]}."
                    ;;
            esac
        done
    done
}

# Execute the function
select_install_type
