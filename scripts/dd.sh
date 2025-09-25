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

# SSL Configuration Decryption Script
# This script decrypts the SSL configuration file for ServerManagerV1

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORKSPACE_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
SECRET_DIR="$WORKSPACE_DIR/.secret_keys"
CONFIG_FILE="$SECRET_DIR/.secret_ignore"
ENCRYPTED_FILE="$SECRET_DIR/.secret_ignore.enc"

echo "=== ServerManagerV1 SSL Configuration Decryption ==="
echo "Workspace: $WORKSPACE_DIR"
echo "Secret Directory: $SECRET_DIR"
echo ""

# Menu function
show_menu() {
    echo "=== Main Menu ==="
    echo "1. Decrypt SSL Configuration"
    echo "2. Get the latest git version"
    echo "3. Exit"
    echo ""
}

# Git update function - calls external gitpull.sh script
update_git_version() {
    local gitpull_script="$SCRIPT_DIR/git/gitpull.sh"
    
    if [ -f "$gitpull_script" ]; then
        echo "Calling git pull script with force update..."
        bash "$gitpull_script" --force-update
    else
        echo "Error: Git pull script not found at $gitpull_script"
        return 1
    fi
}

# SSL configuration function (original functionality)
process_ssl_config() {

    # Create secret directory if it doesn't exist
    if [ ! -d "$SECRET_DIR" ]; then
        echo "Creating secret directory: $SECRET_DIR"
        mkdir -p "$SECRET_DIR"
    fi

    # Check if encrypted file exists
    if [ -f "$ENCRYPTED_FILE" ]; then
    echo "Found encrypted configuration file: $ENCRYPTED_FILE"
    
    # Prompt for decryption password
    echo -n "Enter decryption password: "
    read -s PASSWORD
    echo
    
    # Decrypt the file using openssl
    if openssl enc -aes-256-cbc -d -in "$ENCRYPTED_FILE" -out "$CONFIG_FILE" -pass pass:"$PASSWORD" 2>/dev/null; then
        echo "???Configuration file decrypted successfully"
        echo "Configuration available at: $CONFIG_FILE"
        
        # Set proper permissions
        chmod 600 "$CONFIG_FILE"
        
        # Validate the decrypted JSON
        if python3 -m json.tool "$CONFIG_FILE" > /dev/null 2>&1; then
            echo "???Configuration file is valid JSON"
        else
            echo "???Warning: Configuration file is not valid JSON"
        fi
        
    else
        echo "???Failed to decrypt configuration file"
        echo "Please check your password and try again"
        exit 1
    fi
    
elif [ -f "$CONFIG_FILE" ]; then
    echo "Configuration file already exists and is decrypted: $CONFIG_FILE"
    
    # Validate existing configuration
    if python3 -m json.tool "$CONFIG_FILE" > /dev/null 2>&1; then
        echo "???Configuration file is valid JSON"
    else
        echo "???Warning: Configuration file is not valid JSON"
    fi
    
else
    echo "No encrypted configuration file found."
    echo "Creating example configuration file: $CONFIG_FILE"
    
    # Create example configuration
    cat > "$CONFIG_FILE" << 'EOF'
{
    "ssl_config": {
        "default_provider": "letsencrypt",
        "default_email": "admin@example.com",
        "staging": false,
        "providers": {
            "letsencrypt": {
                "challenge_type": "http-01",
                "email": "admin@example.com",
                "staging": false,
                "enabled": true,
                "description": "Let's Encrypt free SSL certificates"
            },
            "dnspod": {
                "challenge_type": "dns-01",
                "api_id": "your_dnspod_api_id_here",
                "api_token": "your_dnspod_api_token_here",
                "ttl": 600,
                "enabled": false,
                "description": "DNSPod DNS-01 challenge for wildcard certificates"
            },
            "cloudflare": {
                "challenge_type": "dns-01",
                "api_token": "your_cloudflare_api_token_here",
                "zone_id": "your_cloudflare_zone_id_here",
                "enabled": false,
                "description": "Cloudflare DNS-01 challenge"
            }
        }
    },
    "deployment_config": {
        "default_php_version": "8.2",
        "default_web_root": "/www/wwwroot",
        "nginx_config_path": "/etc/nginx/sites-available",
        "nginx_enabled_path": "/etc/nginx/sites-enabled",
        "backup_path": "/www/backup/nginx-configs",
        "auto_backup": true,
        "auto_ssl": true
    },
    "security_config": {
        "allowed_domains": [],
        "blocked_domains": [],
        "max_deployments_per_hour": 10,
        "require_confirmation": false
    }
}
EOF
    
    # Set proper permissions
    chmod 600 "$CONFIG_FILE"
    
    echo "???Example configuration created"
    echo "Please edit the configuration file and add your actual API keys:"
    echo "  nano $CONFIG_FILE"
    echo ""
    echo "To encrypt the configuration file:"
    echo "  openssl enc -aes-256-cbc -in $CONFIG_FILE -out $ENCRYPTED_FILE"
    echo "  rm $CONFIG_FILE"
fi

echo ""
echo "=== Configuration Status ==="
if [ -f "$CONFIG_FILE" ]; then
    echo "???Configuration file available"
    echo "You can now use ServerManagerV1 CLI commands:"
    echo "  php artisan servermanager:ssl config"
    echo "  php artisan servermanager:deploy example.com laravel"
else
    echo "???Configuration file not available"
fi

}

# Main program loop
main() {
    while true; do
        show_menu
        echo -n "Please select an option (1-3): "
        read -r choice
        echo ""
        
        case $choice in
            1)
                echo "=== Processing SSL Configuration ==="
                process_ssl_config
                echo ""
                echo "Press Enter to continue..."
                read -r
                ;;
            2)
                update_git_version
                echo ""
                echo "Press Enter to continue..."
                read -r
                ;;
            3)
                echo "Exiting..."
                exit 0
                ;;
            *)
                echo "Invalid option. Please select 1, 2, or 3."
                echo ""
                ;;
        esac
    done
}

# Run main program
main
