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

# Source LGar.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2$PARENT_DIR_LEVEL_2/linux/LGar.sh"
source "$PARENT_DIR_LEVEL_5/linux/common/gvar_common.sh"

# Default credentials
DEFAULT_BT_USERNAME="btadmin"
DEFAULT_BT_PASSWORD="btpass@2024"
BT_CREDENTIALS_FILE="/www/.bt_credentials"
BT_INIT_FLAG="/usr/.bt_initialized"
BT_EXECUTABLE="/usr/bin/bt"
if [ -n "$ENV_LOCAL" ]; then
    ENV_LOCAL="$ENV_LOCAL"
else
    ENV_LOCAL=$(get_var "ENV_LOCAL")
    if [ -z "$ENV_LOCAL" ]; then
        ENV_LOCAL="cn"
    fi
fi
# Function to check if bt is installed
check_bt_installed() {
    [ -f "$BT_EXECUTABLE" ]
}

# Function to ensure /www directory exists
ensure_www_dir() {
    if [ ! -d "/www" ]; then
        mkdir -p /www
        chmod 755 /www
        echo "Created /www directory"
    fi
}

# Function to automatically answer yes to prompts
auto_answer_yes() {
    DEBIAN_FRONTEND=noninteractive
}

# Function to save credentials
save_credentials() {
    local username="$1"
    local password="$2"
    
    # Save credentials if they don't exist
    if [ ! -f "$BT_CREDENTIALS_FILE" ]; then
        cat > "$BT_CREDENTIALS_FILE" <<EOF
Username: $username
Password: $password
EOF
        chmod 600 "$BT_CREDENTIALS_FILE"
        echo "Credentials saved to $BT_CREDENTIALS_FILE"
    fi
}


# Main installation logic
main() {
    # Check if bt is already installed
    if check_bt_installed; then
        echo "BT Panel is already installed"
        return 0
    fi

    # Ensure /www directory exists
    ensure_www_dir

    # Set up automatic yes answers
    auto_answer_yes

    # Install BT Panel based on ENV_LOCAL
    if [ "$ENV_LOCAL" = "cn" ]; then
        echo "Installing Chinese version of BT Panel..."
        wget -O install_panel.sh https://download.bt.cn/install/install_panel.sh
        echo y | bash install_panel.sh ed8484bec
    else
        echo "Installing English version of BT Panel (aaPanel)..."
        URL="https://www.aapanel.com/script/install_7.0_en.sh"
        if [ -f /usr/bin/curl ]; then
            curl -ksSO "$URL"
        else
            wget --no-check-certificate -O install_7.0_en.sh "$URL"
        fi
        echo y | bash install_7.0_en.sh aapanel
    fi

    # Check installation result
    if check_bt_installed; then
        echo "BT Panel installation completed successfully"
        return 0
    else
        echo "BT Panel installation failed"
        return 1
    fi
}

# Execute main function
main 