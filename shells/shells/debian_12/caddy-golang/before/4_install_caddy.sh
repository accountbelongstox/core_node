#!/bin/bash

# Function to set global variable
set_var() {
    local key="$1"
    local val="$2"
    local var_dir="/usr/script_global_var"
    
    # Convert key to uppercase
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]')
    
    # Ensure directory exists
    if [ ! -d "$var_dir" ]; then
        sudo mkdir -p "$var_dir"
    fi
    
    # Write or update the value
    echo "$val" | sudo tee "$var_dir/$key" > /dev/null
    
    if [ $? -eq 0 ]; then
        echo "Global variable set: $key = $val"
    else
        echo "Error: Failed to set global variable $key"
        return 1
    fi
}

# Check if Caddy is already installed
check_caddy() {
    if command -v caddy &> /dev/null; then
        return 0
    fi
    return 1
}

install_caddy() {
    echo "Installing Caddy..."
    
    # Add Caddy official repository
    if [ ! -f "/usr/share/keyrings/caddy-stable-archive-keyring.gpg" ]; then
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    fi

    sudo apt update
    sudo apt install -y caddy

    # Create website root directory structure
    sudo mkdir -p /www/wwwroot
    sudo chown -R caddy:caddy /www/wwwroot
    sudo chmod -R 755 /www/wwwroot

    # Enable and start Caddy service
    sudo systemctl enable caddy
    sudo systemctl start caddy
}

# Store Caddy related information in global variables
store_caddy_info() {
    # Store binary path
    set_var "CADDY_BIN" "$(which caddy)"
    
    # Store version
    set_var "CADDY_VERSION" "$(caddy version)"
    
    # Store website root directory
    set_var "CADDY_WWW_ROOT" "/www/wwwroot"
    
    # Store config directories
    set_var "CADDY_CONFIG_DIR" "/etc/caddy"
    set_var "CADDY_SITES_DIR" "/etc/caddy/sites"
    
    # Store data directory
    set_var "CADDY_DATA_DIR" "/var/lib/caddy"
    
    # Store main config file
    set_var "CADDY_CONFIG_FILE" "/etc/caddy/Caddyfile"
    
    # Store service file
    set_var "CADDY_SERVICE_FILE" "/lib/systemd/system/caddy.service"
    
    # Store user and group
    set_var "CADDY_USER" "caddy"
    set_var "CADDY_GROUP" "caddy"
    
    # Store log directory
    set_var "CADDY_LOG_DIR" "/var/log/caddy"
    
    # Store service status
    set_var "CADDY_SERVICE_STATUS" "$(systemctl is-active caddy)"
    
    # Store SSL directory
    local ssl_dir="/var/lib/caddy/.local/share/caddy/certificates"
    if [ -d "$ssl_dir" ]; then
        set_var "CADDY_SSL_DIR" "$ssl_dir"
    fi
}

# Main installation logic
if check_caddy; then
    echo "Caddy is already installed: $(caddy version)"
else
    install_caddy
    if ! check_caddy; then
        echo "Error: Caddy installation failed"
        exit 1
    fi
    echo "Caddy installed successfully: $(caddy version)"
fi

# Create necessary directories
sudo mkdir -p /etc/caddy/sites
sudo mkdir -p /var/log/caddy
sudo mkdir -p /www/wwwroot

# Ensure proper permissions
sudo chown -R caddy:caddy /www/wwwroot
sudo chmod -R 755 /www/wwwroot

# Store all Caddy related information
store_caddy_info

# Verify installation and stored information
echo "
Caddy Installation Status:
-------------------------
Version: $(caddy version)
Service Status: $(systemctl is-active caddy)
Website Root: /www/wwwroot
Binary Path: $(which caddy)

Stored Global Variables:
----------------------"
for var in CADDY_*; do
    if [ -f "/usr/script_global_var/$var" ]; then
        echo "$var = $(cat "/usr/script_global_var/$var")"
    fi
done

KEY_FILE="/etc/caddy/jwtkey.pem"

if [ ! -f "$KEY_FILE" ]; then
    echo "Key file not found. Creating jwtkey.pem..."

    # Generate a new RSA private key
    openssl genrsa -out "$KEY_FILE" 2048

    # Set permissions to secure the key file
    chmod 600 "$KEY_FILE"

    echo "Key file created successfully."
else
    echo "Key file already exists. No action taken."
fi

# Restart the Caddy service
echo "Restarting Caddy..."
systemctl restart caddy

echo "Caddy restarted successfully."


# Check if service is running
if ! systemctl is-active --quiet caddy; then
    echo "
Warning: Caddy service is not running
You can start it with: sudo systemctl start caddy"
fi 