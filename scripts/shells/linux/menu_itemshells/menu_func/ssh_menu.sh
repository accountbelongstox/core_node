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
# SSH Connection Menu Module
# =============================================================================

get_ssh_config() {
    cat <<EOF
{
    "title": "SSH Connection Configuration",
    "description": "Set up SSH connection with password storage",
    "common": "ssh",
    "command_prefix": "ssh",
    "display_name": "SSH Connection",
    "variables": [
        {
            "name": "SSH_CONNECTION",
            "display_name": "SSH Connection String",
            "description": "SSH connection string (e.g., root@203.0.113.10)",
            "is_secret": false
        },
        {
            "name": "SSH_PASSWORD",
            "display_name": "SSH Password",
            "description": "SSH connection password (optional)",
            "is_secret": true
        }
    ]
}
EOF
}

show_ssh_submenu() {
    local selected_index=0
    local menu_items=(
        "Add SSH Connection Global Command"
        "View SSH Scripts"
        "Back to Main Menu"
    )

    while true; do
        clear
        echo -e "\033[1;36m=== SSH Connection Menu ===\033[0m"
        echo -e "\033[0;36mUse Up/Down arrows to navigate, Enter to select\033[0m"
        echo -e "\033[1;36m========================================\033[0m"
        echo ""

        for i in "${!menu_items[@]}"; do
            if [ $i -eq $selected_index ]; then
                echo -e "\033[1;33m> ${menu_items[$i]}\033[0m"
            else
                echo -e "  ${menu_items[$i]}"
            fi
        done

        read -rsn1 key
        case "$key" in
            $'\x1b')
                read -rsn2 key
                case "$key" in
                    '[A') # Up arrow
                        selected_index=$(( (selected_index - 1 + ${#menu_items[@]}) % ${#menu_items[@]} ))
                        ;;
                    '[B') # Down arrow
                        selected_index=$(( (selected_index + 1) % ${#menu_items[@]} ))
                        ;;
                esac
                ;;
            '')  # Enter key
                case $selected_index in
                    0)  # Add SSH Connection
                        add_ssh_command
                        ;;
                    1)  # View SSH Scripts
                        view_ssh_scripts
                        ;;
                    2)  # Back
                        return 0
                        ;;
                esac
                ;;
        esac
    done
}

add_ssh_command() {
    clear
    echo -e "\033[1;36m=== Add SSH Connection Command ===\033[0m"
    echo ""

    # Get SSH connection string
    echo -n "Enter SSH connection string (e.g., root@203.0.113.10): "
    read ssh_connection

    if [ -z "$ssh_connection" ]; then
        echo -e "\033[0;31m[ERROR] SSH connection string is required\033[0m"
        read -p "Press Enter to continue..."
        return 1
    fi

    # Get SSH password (optional)
    echo -n "Enter SSH password (optional, press Enter to skip): "
    read -s ssh_password
    echo ""

    # Get command name
    local default_name="ssh1"
    echo -n "Enter command name (default: $default_name): "
    read command_name

    if [ -z "$command_name" ]; then
        command_name="$default_name"
    fi

    # Generate script content
    local script_content="#!/bin/bash
# SSH Connection Script
# Generated on $(date '+%Y-%m-%d %H:%M:%S')

SSH_CONNECTION=\"$ssh_connection\""

    if [ -n "$ssh_password" ]; then
        script_content="$script_content
SSH_PASSWORD=\"$ssh_password\""
    fi

    script_content="$script_content

if [ -n \"\$SSH_PASSWORD\" ]; then
    sshpass -p \"\$SSH_PASSWORD\" ssh \"\$SSH_CONNECTION\" \"\$@\"
else
    ssh \"\$SSH_CONNECTION\" \"\$@\"
fi
"

    # Write script using linux_path_function.sh
    source "$LINUX_PATH_FUNCTION_SCRIPT"

    add_script_content_to_linuxenvs "$script_content" "$command_name"

    if [ $? -eq 0 ]; then
        echo ""
        echo -e "\033[0;32m[SUCCESS] SSH command created: $command_name\033[0m"
        echo -e "\033[0;36m[INFO] You can now use: $command_name\033[0m"
    else
        echo -e "\033[0;31m[ERROR] Failed to create SSH command\033[0m"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

view_ssh_scripts() {
    clear
    echo -e "\033[1;36m=== SSH Connection Scripts ===\033[0m"
    echo ""

    source "$LINUX_PATH_FUNCTION_SCRIPT"
    list_linuxenvs_scripts | grep -E "ssh[0-9]+" || echo "No SSH scripts found"

    echo ""
    read -p "Press Enter to continue..."
}
