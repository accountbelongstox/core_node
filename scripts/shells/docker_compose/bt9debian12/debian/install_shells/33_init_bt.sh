#!/bin/bash

# Source LGar.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/linux/LGar.sh"
source "$PARENT_DIR_LEVEL_5/linux/common/gvar_common.sh"

# Constants
BT_EXECUTABLE="/usr/bin/bt"
DEFAULT_BT_USERNAME="btadmin"
DEFAULT_BT_PASSWORD="btpass@2024"
DEFAULT_BT_PORT="8888"
BT_CREDENTIALS_FILE="/www/.bt_credentials"
BT_INIT_FLAG="/usr/.bt_initialized"
if [ -n "$ENV_LOCAL" ]; then
    ENV_LOCAL="$ENV_LOCAL"
else
    ENV_LOCAL=$(get_var "ENV_LOCAL")
    if [ -z "$ENV_LOCAL" ]; then
        ENV_LOCAL="cn"
    fi
fi
# Function to install expect if not present
install_expect() {
    if ! command -v expect >/dev/null 2>&1; then
        echo "Installing expect..."
        apt-get update
        DEBIAN_FRONTEND=noninteractive apt-get install -y expect
    fi
}

# Function to check if bt is installed
check_bt_installed() {
    [ -f "$BT_EXECUTABLE" ]
}

# Function to save credentials
save_credentials() {
    local username="$1"
    local password="$2"
    local port="$3"
    
    # Save credentials if they don't exist
    if [ ! -f "$BT_CREDENTIALS_FILE" ]; then
        cat > "$BT_CREDENTIALS_FILE" <<EOF
Username: $username
Password: $password
Port: $port
EOF
        chmod 600 "$BT_CREDENTIALS_FILE"
        echo "Credentials saved to $BT_CREDENTIALS_FILE"
    fi
}

# Function to set BT Panel credentials using expect
set_bt_credentials() {
    local username="$1"
    local password="$2"
    local port="$3"
    
    echo "Setting BT Panel credentials..."
    
    if [ "$ENV_LOCAL" = "cn" ]; then
        # Chinese prompts
        cat > /tmp/bt_set_password.exp <<EOF
#!/usr/bin/expect -f
set timeout 10
spawn bt 5
expect "??????"
send "$password\r"
expect eof
EOF

        cat > /tmp/bt_set_username.exp <<EOF
#!/usr/bin/expect -f
set timeout 10
spawn bt 6
expect "?????????
send "$username\r"
expect eof
EOF

        cat > /tmp/bt_set_port.exp <<EOF
#!/usr/bin/expect -f
set timeout 10
spawn bt 8
expect "??????"
send "$port\r"
expect eof
EOF

    else
        # English prompts
        cat > /tmp/bt_set_password.exp <<EOF
#!/usr/bin/expect -f
set timeout 10
spawn bt 5
expect "password"
send "$password\r"
expect eof
EOF

        cat > /tmp/bt_set_username.exp <<EOF
#!/usr/bin/expect -f
set timeout 10
spawn bt 6
expect "username"
send "$username\r"
expect eof
EOF

        cat > /tmp/bt_set_port.exp <<EOF
#!/usr/bin/expect -f
set timeout 10
spawn bt 8
expect "port"
send "$port\r"
expect eof
EOF
    fi

    # Make expect scripts executable
    chmod +x /tmp/bt_set_password.exp
    chmod +x /tmp/bt_set_username.exp
    chmod +x /tmp/bt_set_port.exp

    # Run expect scripts
    /tmp/bt_set_password.exp
    sleep 2
    /tmp/bt_set_username.exp
    sleep 2
    /tmp/bt_set_port.exp

    # Clean up expect scripts
    rm -f /tmp/bt_set_password.exp
    rm -f /tmp/bt_set_username.exp
    rm -f /tmp/bt_set_port.exp
    
    # Create initialization flag
    touch "$BT_INIT_FLAG"
    echo "BT Panel credentials and port have been set"
}

# Function to ensure all services are running
ensure_services_running() {
    echo "Ensuring all services are running..."
    
    # Start MySQL (ignore errors)
    systemctl start mysql 2>/dev/null || true
    systemctl start mariadb 2>/dev/null || true
    service mysql start 2>/dev/null || true
    
    # Start Nginx (ignore errors)
    systemctl start nginx 2>/dev/null || true
    service nginx start 2>/dev/null || true
    
    # Start BT Panel (ignore errors)
    "$BT_EXECUTABLE" start 2>/dev/null || true
    
    # Wait for services to start
    sleep 5
    
    # Check services status
    echo "Checking services status..."
    
    # Check MySQL
    if pgrep -f "mysqld" > /dev/null; then
        echo "MySQL is running"
    else
        echo "Warning: MySQL may not be running"
    fi
    
    # Check Nginx
    if pgrep -f "nginx" > /dev/null; then
        echo "Nginx is running"
    else
        echo "Warning: Nginx may not be running"
    fi
    
    # Check BT Panel
    if pgrep -f "BT-Panel" > /dev/null; then
        echo "BT Panel is running"
    else
        echo "Warning: BT Panel may not be running"
    fi
}

# Function to initialize credentials if needed
initialize_credentials() {
    # Check if already initialized
    if [ -f "$BT_INIT_FLAG" ]; then
        echo "BT Panel credentials already initialized"
        return 0
    fi
    
    # Install expect if not present
    install_expect
    
    # Save credentials first
    save_credentials "$DEFAULT_BT_USERNAME" "$DEFAULT_BT_PASSWORD" "$DEFAULT_BT_PORT"
    
    # Set credentials in BT Panel
    set_bt_credentials "$DEFAULT_BT_USERNAME" "$DEFAULT_BT_PASSWORD" "$DEFAULT_BT_PORT"
}

# Main logic
main() {
    # Check if BT is installed
    if ! check_bt_installed; then
        echo "Error: BT Panel is not installed"
        return 1
    fi
    
    # Initialize credentials
    initialize_credentials
    
    # Ensure all services are running
    ensure_services_running
    
    echo "BT Panel initialization completed"
    return 0
}

# Execute main function
main
