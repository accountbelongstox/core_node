#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="26"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Variables
INSTALL_MODE=$(get_var "INSTALL_MODE")

echo "[$SCRIPT_INDEX] Certbot SSL Certificate Installation Script"
echo "[$SCRIPT_INDEX] INSTALL_MODE: $INSTALL_MODE"

# Function to check if Nginx is actually installed
check_nginx_installed() {
    # Check common nginx installation paths
    local nginx_paths=(
        "/usr/sbin/nginx"
        "/usr/bin/nginx"
        "/sbin/nginx"
        "/usr/local/sbin/nginx"
        "/usr/local/bin/nginx"
    )

    for path in "${nginx_paths[@]}"; do
        if [ -x "$path" ]; then
            return 0
        fi
    done

    # Fallback to command -v (checks PATH)
    if command -v nginx >/dev/null 2>&1; then
        return 0
    fi

    return 1
}

# Check if Nginx is installed (Certbot depends on Nginx)
if ! check_nginx_installed; then
    echo "[$SCRIPT_INDEX] Skipping Certbot installation - Nginx is not installed"
    echo "[$SCRIPT_INDEX] Certbot requires Nginx to be installed"
    exit 0
fi

echo "[$SCRIPT_INDEX] Nginx is installed, proceeding with Certbot installation"

check_and_install_sudo

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if Certbot is already installed
check_certbot() {
    if command_exists certbot; then
        return 0
    fi
    return 1
}

# Function to install Certbot
install_certbot() {
    echo "[$SCRIPT_INDEX] Installing Certbot..."

    # Update package list
    $USE_SUDO apt update

    # Install Certbot and Nginx plugin
    $USE_SUDO apt install -y certbot python3-certbot-nginx

    # Install DNS plugins for supported providers
    $USE_SUDO apt install -y python3-certbot-dns-cloudflare python3-certbot-dns-route53 || true

    echo "[$SCRIPT_INDEX] Certbot installed successfully"
}

# Function to fix urllib3 compatibility with certbot
fix_urllib3_compatibility() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] URLLIB3 COMPATIBILITY CHECK"
    echo "[$SCRIPT_INDEX] =================================="

    # IDEMPOTENCY: Always check current state first
    local current_version=$($USE_SUDO python3 -c "import urllib3; print(urllib3.__version__)" 2>/dev/null || echo "not found")
    echo "[$SCRIPT_INDEX] [CHECK] Current urllib3 version: $current_version"

    # Test DEFAULT_CIPHERS availability (required by certbot 2.1.0)
    echo "[$SCRIPT_INDEX] [CHECK] Testing DEFAULT_CIPHERS availability..."
    if $USE_SUDO python3 -c "from urllib3.util.ssl_ import DEFAULT_CIPHERS" >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [OK] DEFAULT_CIPHERS available"
        local has_default_ciphers=true
    else
        echo "[$SCRIPT_INDEX] [WARN] DEFAULT_CIPHERS not available"
        local has_default_ciphers=false
    fi

    # Test if certbot works
    echo "[$SCRIPT_INDEX] [CHECK] Testing certbot plugins command..."
    if $USE_SUDO certbot plugins >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [OK] Certbot works correctly"
        if [ "$has_default_ciphers" = true ]; then
            echo "[$SCRIPT_INDEX] [SKIP] urllib3 is compatible, no fix needed"
            return 0
        fi
    fi

    # Need to fix urllib3
    echo "[$SCRIPT_INDEX] [FIX] urllib3 incompatible with certbot, applying fix..."

    # IDEMPOTENCY: Clean ALL urllib3 installations (system and user directories)
    echo "[$SCRIPT_INDEX] [CLEANUP] Removing all urllib3 installations..."

    # Remove from system directories
    $USE_SUDO rm -rf /usr/local/lib/python3.*/dist-packages/urllib3* 2>/dev/null || true
    $USE_SUDO rm -rf /usr/lib/python3/dist-packages/urllib3* 2>/dev/null || true

    # Remove from user temporary directories
    $USE_SUDO rm -rf /var/_core_node/Users/*/\.local/lib/python3.*/site-packages/urllib3* 2>/dev/null || true
    $USE_SUDO rm -rf /root/.local/lib/python3.*/site-packages/urllib3* 2>/dev/null || true
    $USE_SUDO rm -rf /home/*/.local/lib/python3.*/site-packages/urllib3* 2>/dev/null || true

    # Uninstall via pip (both system and user)
    $USE_SUDO pip3 uninstall -y urllib3 2>/dev/null || true
    pip3 uninstall -y urllib3 2>/dev/null || true

    echo "[$SCRIPT_INDEX] [INSTALL] Installing urllib3==1.26.18 to system location..."
    # Force system-level installation (not user directory)
    # Note: urllib3 1.26.18 is the last version compatible with certbot 2.1.0
    # urllib3 2.x removed DEFAULT_CIPHERS constant that certbot depends on
    $USE_SUDO pip3 install --break-system-packages --no-user urllib3==1.26.18 2>&1 | grep -E "Successfully|ERROR|Installing" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    # Verify the fix with system Python
    local new_version=$($USE_SUDO python3 -c "import urllib3; print(urllib3.__version__)" 2>/dev/null || echo "not found")
    echo "[$SCRIPT_INDEX] New urllib3 version: $new_version"

    # Check urllib3 location
    local urllib3_location=$($USE_SUDO python3 -c "import urllib3; print(urllib3.__file__)" 2>/dev/null || echo "not found")
    echo "[$SCRIPT_INDEX] urllib3 location: $urllib3_location"

    # Test DEFAULT_CIPHERS availability (required by certbot)
    echo "[$SCRIPT_INDEX] [TEST] Checking DEFAULT_CIPHERS availability..."
    if $USE_SUDO python3 -c "from urllib3.util.ssl_ import DEFAULT_CIPHERS; print('OK')" >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [OK] DEFAULT_CIPHERS is available"
    else
        echo "[$SCRIPT_INDEX] [ERROR] DEFAULT_CIPHERS not found - certbot will fail"
        echo "[$SCRIPT_INDEX] [ERROR] This should not happen with urllib3 1.26.18"
        return 1
    fi

    # Test certbot plugins command
    echo "[$SCRIPT_INDEX] [TEST] Testing certbot plugins command..."
    if $USE_SUDO certbot plugins >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [OK] Certbot compatibility fixed successfully"

        # Show available plugins
        echo "[$SCRIPT_INDEX] [INFO] Available certbot plugins:"
        $USE_SUDO certbot plugins 2>&1 | grep -E "^\* " | while IFS= read -r line; do
            echo "[$SCRIPT_INDEX]   $line"
        done
        return 0
    else
        echo "[$SCRIPT_INDEX] [ERROR] Certbot still has issues after fix"
        echo "[$SCRIPT_INDEX] [DEBUG] Testing with verbose output..."
        $USE_SUDO certbot plugins 2>&1 | head -20 | while IFS= read -r line; do
            echo "[$SCRIPT_INDEX]   $line"
        done
        return 1
    fi
}

# Function to install certbot-dns-dnspod plugin
install_certbot_dnspod() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] INSTALLING CERTBOT-DNS-DNSPOD PLUGIN"
    echo "[$SCRIPT_INDEX] =================================="

    # IDEMPOTENCY: Always check and fix certbot installation
    echo "[$SCRIPT_INDEX] [CHECK] Verifying certbot availability..."
    if ! command -v certbot >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [INSTALL] certbot not found, installing base certbot..."
        $USE_SUDO apt-get update >/dev/null 2>&1
        $USE_SUDO apt-get install -y certbot >/dev/null 2>&1 || {
            echo "[$SCRIPT_INDEX] [FAIL] Failed to install certbot"
            return 1
        }
        echo "[$SCRIPT_INDEX] [OK] certbot installed"
    else
        echo "[$SCRIPT_INDEX] [OK] certbot is available"
    fi

    # IDEMPOTENCY: Always check and fix pip3 installation
    echo "[$SCRIPT_INDEX] [CHECK] Verifying pip3 availability..."
    if ! command -v pip3 >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [INSTALL] pip3 not found, installing python3-pip..."
        $USE_SUDO apt-get update >/dev/null 2>&1
        $USE_SUDO apt-get install -y python3-pip >/dev/null 2>&1 || {
            echo "[$SCRIPT_INDEX] [FAIL] Failed to install python3-pip"
            return 1
        }
        echo "[$SCRIPT_INDEX] [OK] python3-pip installed"
    else
        echo "[$SCRIPT_INDEX] [OK] pip3 is available"
    fi

    # IDEMPOTENCY: Always check and fix zope.interface module
    echo "[$SCRIPT_INDEX] [CHECK] Verifying zope.interface module..."
    if python3 -c "import zope.interface" 2>/dev/null; then
        echo "[$SCRIPT_INDEX] [OK] zope.interface is available"
    else
        echo "[$SCRIPT_INDEX] [INSTALL] zope.interface not found, installing..."
        if $USE_SUDO apt-get install -y python3-zope.interface >/dev/null 2>&1; then
            echo "[$SCRIPT_INDEX] [OK] zope.interface installed via apt-get"
        elif $USE_SUDO pip3 install --break-system-packages --no-user zope.interface 2>/dev/null; then
            echo "[$SCRIPT_INDEX] [OK] zope.interface installed via pip3"
        else
            echo "[$SCRIPT_INDEX] [WARN] Failed to install zope.interface"
        fi
    fi

    # IDEMPOTENCY: Always verify certbot-dns-dnspod installation
    echo "[$SCRIPT_INDEX] [CHECK] Verifying certbot-dns-dnspod installation..."
    if pip3 list 2>/dev/null | grep -qi "certbot-dns-dnspod"; then
        local version=$(pip3 show certbot-dns-dnspod 2>/dev/null | grep "Version:" | cut -d' ' -f2)
        echo "[$SCRIPT_INDEX] [OK] certbot-dns-dnspod already installed (version: ${version:-unknown})"
        # IDEMPOTENCY: Even if installed, verify it's in the correct location
        echo "[$SCRIPT_INDEX] [VERIFY] Checking installation location..."
        local install_location=$(pip3 show certbot-dns-dnspod 2>/dev/null | grep "Location:" | cut -d' ' -f2)
        echo "[$SCRIPT_INDEX] [INFO] Installed at: ${install_location:-unknown}"
    else
        # Install certbot-dns-dnspod to system location
        echo "[$SCRIPT_INDEX] [INSTALL] Installing certbot-dns-dnspod to system location..."
        $USE_SUDO pip3 install --break-system-packages --no-user certbot-dns-dnspod 2>&1 | while IFS= read -r line; do
            echo "[$SCRIPT_INDEX]   $line"
        done

        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            echo "[$SCRIPT_INDEX] [OK] certbot-dns-dnspod installed successfully"
        else
            echo "[$SCRIPT_INDEX] [WARN] certbot-dns-dnspod installation had issues"
            return 1
        fi
    fi

    return 0
}


# Function to create Laravel ServerManager compatible SSL configuration
create_laravel_ssl_config() {
    echo "[$SCRIPT_INDEX] Creating Laravel ServerManager compatible SSL configuration..."

    # Use path mapping from gvar_common.sh to support WSL Windows directories
    local ssl_config_dir=$(map_web_path "shared-data" "ssl")
    local ssl_config_file="$ssl_config_dir/ssl_config.json"

    # Also create the legacy location for backward compatibility
    local www_root=$(map_web_path "wwwroot")
    # Use CORE_NODE_DIR from gvar_common.sh for dynamic path resolution
    local legacy_ssl_config_dir="$CORE_NODE_DIR/.secret_keys/.secret_ignore"
    local legacy_ssl_config_file="$legacy_ssl_config_dir/SSL_CONFIG_JSON"

    # Create directory if it doesn't exist
    if [ ! -d "$ssl_config_dir" ]; then
        $USE_SUDO mkdir -p "$ssl_config_dir"
        $USE_SUDO chmod 700 "$ssl_config_dir"
    fi

    # Get mapped paths for JSON configuration
    local json_www_root=$(map_web_path "wwwroot")
    local json_nginx_config=$(map_web_path "nginxconfig" "sites-available")
    local json_nginx_enabled=$(map_web_path "nginxconfig" "sites-enabled")
    local json_backup_path=$(map_web_path "backup" "nginx-configs")

    # Create SSL configuration for Laravel ServerManager with dynamic paths
    $USE_SUDO tee "$ssl_config_file" > /dev/null << EOF
{
    "ssl_config": {
        "default_provider": "letsencrypt",
        "default_email": "admin@example.com",
        "staging": false,
        "providers": {
            "letsencrypt": {
                "enabled": true,
                "challenge_type": "http-01",
                "description": "Let's Encrypt HTTP Challenge"
            },
            "letsencrypt-dns": {
                "enabled": true,
                "challenge_type": "dns-01",
                "description": "Let's Encrypt DNS Challenge"
            },
            "cloudflare": {
                "enabled": false,
                "challenge_type": "dns-01",
                "api_token": "",
                "description": "Cloudflare DNS Challenge"
            },
            "dnspod": {
                "enabled": false,
                "challenge_type": "dns-01",
                "api_id": "",
                "api_token": "",
                "description": "DNSPod DNS Challenge"
            }
        }
    },
    "deployment_config": {
        "default_php_version": "8.4",
        "default_web_root": "$json_www_root",
        "auto_ssl": true,
        "auto_backup": true,
        "nginx_config_path": "$json_nginx_config",
        "nginx_enabled_path": "$json_nginx_enabled",
        "backup_path": "$json_backup_path"
    },
    "security_config": {
        "max_deployments_per_hour": 10,
        "require_confirmation": false,
        "allowed_domains": [],
        "blocked_domains": []
    }
}
EOF

    # Set proper permissions
    $USE_SUDO chmod 640 "$ssl_config_file"
    $USE_SUDO chown root:root "$ssl_config_file"

    # Create legacy configuration for backward compatibility
    if [ ! -d "$legacy_ssl_config_dir" ]; then
        $USE_SUDO mkdir -p "$legacy_ssl_config_dir"
        $USE_SUDO chmod 700 "$legacy_ssl_config_dir"
    fi

    # Create symlink to new location
    $USE_SUDO ln -sf "$ssl_config_file" "$legacy_ssl_config_file"

    echo "[$SCRIPT_INDEX] Laravel ServerManager SSL configuration created at $ssl_config_file"
    echo "[$SCRIPT_INDEX] Legacy configuration symlink created at $legacy_ssl_config_file"
    echo "[$SCRIPT_INDEX] You can update the configuration with your actual API keys and email"
}

# Function to setup Nginx directories for Laravel ServerManager
setup_nginx_directories() {
    echo "[$SCRIPT_INDEX] Setting up Nginx directories for Laravel ServerManager..."

    # Use path mapping from gvar_common.sh to support WSL Windows directories
    local mapped_dirs=(
        "$(map_web_path 'nginxconfig' 'sites-available')"
        "$(map_web_path 'nginxconfig' 'sites-enabled')"
        "$(map_web_path 'nginxconfig' 'ssl')"
        "$(map_web_path 'backup' 'nginx-configs')"
        "/var/log/nginx"
        "$(map_web_path 'wwwroot')"
        "$(map_web_path 'shared-data' 'ssl')"
        "$(map_web_path 'shared-data' 'domains')"
        "$(map_web_path 'shared-data' 'dns-providers')"
        "$(map_web_path 'shared-data' 'certificates')"
    )

    for dir in "${mapped_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            $USE_SUDO mkdir -p "$dir"
            echo "[$SCRIPT_INDEX] Created directory: $dir"
        fi
    done

    # Set proper permissions (skip chown in WSL as Windows filesystem doesn't support it)
    local www_root=$(map_web_path "wwwroot")
    if [ "$IS_WSL" = false ]; then
        $USE_SUDO chown -R root:root "$www_root"
    fi
    $USE_SUDO chmod 755 "$www_root" 2>/dev/null || true

    # Check if nginx script has already created a comprehensive default page
    local nginx_default_site=$(get_global_var "NGINX_DEFAULT_SITE" "$DEFAULT_SITE_DIR")

    if [ -f "$nginx_default_site/index.html" ]; then
        echo "[$SCRIPT_INDEX] Using existing comprehensive nginx default page from nginx installation"
        # Create symlink to use nginx's comprehensive page as the main default
        local www_root_index="$www_root/index.html"
        if [ ! -f "$www_root_index" ]; then
            $USE_SUDO ln -sf "$nginx_default_site/index.html" "$www_root_index"
            echo "[$SCRIPT_INDEX] Created symlink to nginx default page"
        fi
    else
        # Create enhanced default index.html for Let's Encrypt challenges with nginx info
        echo "[$SCRIPT_INDEX] Creating enhanced default page with certbot and nginx information"
        $USE_SUDO tee "$www_root/index.html" > /dev/null << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Server Ready - Nginx & SSL Available</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .status { background: #d4edda; padding: 10px; border-left: 4px solid #28a745; margin: 10px 0; }
        .info-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .info-table th, .info-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .info-table th { background-color: #f8f9fa; font-weight: bold; }
        ul { margin: 10px 0; padding-left: 20px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>[Server] Successfully Configured</h1>

        <div class="status">
            <strong>[OK] Status:</strong> Nginx web server is running with SSL support ready
        </div>

        <h2>[Config] Server Information</h2>
        <table class="info-table">
            <tr><th>Component</th><th>Status</th><th>Details</th></tr>
            <tr><td>Web Server</td><td>[OK] Active</td><td>Nginx (Port 80)</td></tr>
            <tr><td>SSL Support</td><td>[OK] Available</td><td>Certbot installed for Let's Encrypt</td></tr>
            <tr><td>WWW Root</td><td>[Ready] Ready</td><td>/usr/wwwroot</td></tr>
            <tr><td>Config Directory</td><td>[Ready] Ready</td><td>/www/nginxconfig</td></tr>
            <tr><td>PHP Support</td><td>[Check] Check required</td><td>Run PHP installation if needed</td></tr>
        </table>

        <h2>[Network] Server Access</h2>
        <p>Your server is accessible at:</p>
        <ul>
            <li>HTTP: <code>http://your-server-ip</code></li>
            <li>HTTPS: <code>https://your-domain</code> (after SSL certificate setup)</li>
        </ul>

        <h2>[SSL] Certificate Setup</h2>
        <p>To enable HTTPS for your domain:</p>
        <ul>
            <li>Configure your domain in Certbot settings</li>
            <li>Run: <code>sudo certbot --nginx -d your-domain.com</code></li>
            <li>Certificates will auto-renew every 90 days</li>
        </ul>

        <h2>[Next] Next Steps</h2>
        <ul>
            <li>Upload your website files to <code>/usr/wwwroot</code></li>
            <li>Configure your domain's DNS to point to this server</li>
            <li>Set up SSL certificates using Certbot</li>
            <li>Configure additional sites in <code>/www/nginxconfig/sites-available</code></li>
        </ul>

        <div class="footer">
            <p><strong>Page generated:</strong> $(date)</p>
            <p><strong>Let's Encrypt Challenge Ready:</strong> This page supports SSL certificate verification</p>
            <p><em>Replace this file at /usr/wwwroot/index.html with your own content</em></p>
        </div>
    </div>
</body>
</html>
EOF
        $USE_SUDO chown root:root /usr/wwwroot/index.html
        echo "[$SCRIPT_INDEX] Enhanced default page created with nginx and certbot information"
    fi

    echo "[$SCRIPT_INDEX] Nginx directories setup completed"
}





# Function to prompt for configuration update
prompt_config_update() {
    if [ -f "$CERTBOT_CONFIG_FILE" ]; then
        echo "[$SCRIPT_INDEX] Existing Certbot configuration found"
        echo "[$SCRIPT_INDEX] Current configuration:"
        echo "[$SCRIPT_INDEX]   Domain: $(get_config_value "domain")"
        echo "[$SCRIPT_INDEX]   Email: $(get_config_value "email")"
        echo "[$SCRIPT_INDEX]   DNS Provider: $(get_config_value "dns_provider")"
        echo "[$SCRIPT_INDEX]   Created: $(get_config_value "created_at")"
        echo "[$SCRIPT_INDEX]   Updated: $(get_config_value "updated_at")"
        echo ""
        echo "[$SCRIPT_INDEX] Do you want to update the configuration? (y/N)"
        echo "[$SCRIPT_INDEX] You have 10 seconds to decide (default: No)..."
        
        local response=""
        if read -t 10 -r response; then
            if [[ "$response" =~ ^[Yy]$ ]]; then
                return 0  # Update configuration
            fi
        fi
        
        echo "[$SCRIPT_INDEX] Keeping existing configuration"
        return 1  # Keep existing configuration
    else
        return 0  # Create new configuration
    fi
}

# Function to ask if user wants to configure Certbot
show_certificate_config() {
    echo "[$SCRIPT_INDEX] SSL certificates are configured by Laravel ServerManager"
    echo "[$SCRIPT_INDEX] Configuration paths:"
    echo "[$SCRIPT_INDEX]   - SSL Config: /www/shared-data/ssl/ssl_config.json"
    echo "[$SCRIPT_INDEX]   - Certificate Storage: /www/nginxconfig/ssl/"
    echo "[$SCRIPT_INDEX]   - Laravel Commands: php artisan servermanager:certificate"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Manual configuration commands:"
    echo "[$SCRIPT_INDEX]   # Install DNSPod plugin:"
    echo "[$SCRIPT_INDEX]   sudo python3 -m pip install certbot-dnspod"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX]   # Configure DNSPod credentials:"
    echo "[$SCRIPT_INDEX]   sudo mkdir -p /www/nginxconfig/ssl/credentials"
    echo "[$SCRIPT_INDEX]   sudo tee /www/nginxconfig/ssl/credentials/dnspod.ini > /dev/null << 'EOF'"
    echo "[$SCRIPT_INDEX]   certbot_dnspod_token_id = your_token_id"
    echo "[$SCRIPT_INDEX]   certbot_dnspod_token = your_token"
    echo "[$SCRIPT_INDEX]   EOF"
    echo "[$SCRIPT_INDEX]   sudo chmod 600 /www/nginxconfig/ssl/credentials/dnspod.ini"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX]   # Generate certificate with Laravel:"
    echo "[$SCRIPT_INDEX]   cd $CORE_NODE_DIR/poly_apps/laravel_main"
    echo "[$SCRIPT_INDEX]   php artisan servermanager:certificate add example.com --provider=dnspod"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX]   # Deploy website with SSL:"
    echo "[$SCRIPT_INDEX]   php artisan servermanager:website add example.com --type=html --ssl=auto"
}

# Function to configure Certbot interactively
configure_certbot() {
    echo "[$SCRIPT_INDEX] Configuring Certbot..."
    
    # Domain configuration
    local current_domain=$(get_config_value "domain")
    echo "[$SCRIPT_INDEX] Enter domain name (current: $current_domain) [20s timeout]:"
    local domain=""
    if read -t 20 -r domain; then
        if [ -n "$domain" ]; then
            set_config_value "domain" "$domain"
        elif [ -z "$current_domain" ]; then
            echo "[$SCRIPT_INDEX] No domain provided, skipping SSL configuration"
            return 1
        fi
    else
        echo "[$SCRIPT_INDEX] Timeout reached, using current domain: $current_domain"
        if [ -z "$current_domain" ]; then
            echo "[$SCRIPT_INDEX] No domain configured, skipping SSL configuration"
            return 1
        fi
    fi
    
    # Email configuration
    local current_email=$(get_config_value "email")
    echo "[$SCRIPT_INDEX] Enter email address (current: $current_email) [20s timeout]:"
    local email=""
    if read -t 20 -r email; then
        if [ -n "$email" ]; then
            set_config_value "email" "$email"
        elif [ -z "$current_email" ]; then
            echo "[$SCRIPT_INDEX] No email provided, skipping SSL configuration"
            return 1
        fi
    else
        echo "[$SCRIPT_INDEX] Timeout reached, using current email: $current_email"
        if [ -z "$current_email" ]; then
            echo "[$SCRIPT_INDEX] No email configured, skipping SSL configuration"
            return 1
        fi
    fi
    
    # DNS provider configuration
    echo "[$SCRIPT_INDEX] Select DNS provider for domain validation:"
    echo "[$SCRIPT_INDEX] 1) DNSPod"
    echo "[$SCRIPT_INDEX] 2) Alibaba Cloud"
    echo "[$SCRIPT_INDEX] 3) None (skip DNS validation)"
    echo "[$SCRIPT_INDEX] Enter choice (1-3) [20s timeout, default: 3]:"
    local dns_choice=""
    if read -t 20 -r dns_choice; then
        if [ -z "$dns_choice" ]; then
            dns_choice="3"
        fi
    else
        echo "[$SCRIPT_INDEX] Timeout reached, defaulting to: None (skip DNS validation)"
        dns_choice="3"
    fi
    
    case "$dns_choice" in
        1)
            set_config_value "dns_provider" "dnspod"
            echo "[$SCRIPT_INDEX] Enter DNSPod API token [20s timeout]:"
            local dnspod_token=""
            if read -t 20 -r dnspod_token; then
                if [ -n "$dnspod_token" ]; then
                    set_config_value "dnspod_token" "$dnspod_token"
                else
                    echo "[$SCRIPT_INDEX] No token provided, DNS validation will be skipped"
                fi
            else
                echo "[$SCRIPT_INDEX] Timeout reached, DNS validation will be skipped"
            fi
            ;;
        2)
            set_config_value "dns_provider" "alibaba"
            echo "[$SCRIPT_INDEX] Enter Alibaba Cloud Access Key [20s timeout]:"
            local alibaba_key=""
            if read -t 20 -r alibaba_key; then
                if [ -n "$alibaba_key" ]; then
                    set_config_value "alibaba_access_key" "$alibaba_key"
                fi
            else
                echo "[$SCRIPT_INDEX] Timeout reached for Access Key"
            fi
            
            echo "[$SCRIPT_INDEX] Enter Alibaba Cloud Secret Key [20s timeout]:"
            local alibaba_secret=""
            if read -t 20 -r alibaba_secret; then
                if [ -n "$alibaba_secret" ]; then
                    set_config_value "alibaba_secret_key" "$alibaba_secret"
                fi
            else
                echo "[$SCRIPT_INDEX] Timeout reached for Secret Key"
            fi
            ;;
        3)
            set_config_value "dns_provider" ""
            echo "[$SCRIPT_INDEX] DNS validation disabled"
            ;;
        *)
            echo "[$SCRIPT_INDEX] Invalid choice, skipping DNS configuration"
            set_config_value "dns_provider" ""
            ;;
    esac
    
    echo "[$SCRIPT_INDEX] Configuration completed"
}

# Function to create DNS credentials file
create_dns_credentials() {
    local dns_provider=$(get_config_value "dns_provider")
    
    if [ -z "$dns_provider" ]; then
        echo "[$SCRIPT_INDEX] No DNS provider configured, skipping credentials file"
        return 0
    fi
    
    local credentials_dir="/etc/letsencrypt/credentials"
    $USE_SUDO mkdir -p "$credentials_dir"
    
    case "$dns_provider" in
        "dnspod")
            local dnspod_token=$(get_config_value "dnspod_token")
            if [ -n "$dnspod_token" ]; then
                local creds_file="$credentials_dir/dnspod.ini"
                $USE_SUDO tee "$creds_file" > /dev/null << EOF
# DNSPod API credentials
dns_dnspod_token = $dnspod_token
EOF
                $USE_SUDO chmod 600 "$creds_file"
                echo "[$SCRIPT_INDEX] DNSPod credentials file created: $creds_file"
            fi
            ;;
        "alibaba")
            local alibaba_key=$(get_config_value "alibaba_access_key")
            local alibaba_secret=$(get_config_value "alibaba_secret_key")
            if [ -n "$alibaba_key" ] && [ -n "$alibaba_secret" ]; then
                local creds_file="$credentials_dir/alibaba.ini"
                $USE_SUDO tee "$creds_file" > /dev/null << EOF
# Alibaba Cloud DNS API credentials
dns_alibaba_access_key = $alibaba_key
dns_alibaba_secret_key = $alibaba_secret
EOF
                $USE_SUDO chmod 600 "$creds_file"
                echo "[$SCRIPT_INDEX] Alibaba Cloud credentials file created: $creds_file"
            fi
            ;;
    esac
}

# Function to setup auto-renewal
setup_auto_renewal() {
    echo "[$SCRIPT_INDEX] [CHECK] Checking automatic certificate renewal setup..."

    # IDEMPOTENCY: Always check and create/update renewal script
    local renewal_script="/usr/local/bin/certbot-renewal.sh"
    echo "[$SCRIPT_INDEX] [VERIFY] Checking renewal script at $renewal_script..."

    if [ -f "$renewal_script" ]; then
        echo "[$SCRIPT_INDEX] [OK] Renewal script exists"
    else
        echo "[$SCRIPT_INDEX] [CREATE] Creating renewal script..."
    fi

    # Always recreate script to ensure it's up to date
    $USE_SUDO tee "$renewal_script" > /dev/null << 'EOF'
#!/bin/bash
# Certbot automatic renewal script

# Renew certificates
/usr/bin/certbot renew --quiet

# Reload Nginx if certificates were renewed
if [ $? -eq 0 ]; then
    systemctl reload nginx
fi
EOF

    $USE_SUDO chmod +x "$renewal_script"
    echo "[$SCRIPT_INDEX] [OK] Renewal script created/updated"

    # IDEMPOTENCY: Always check and add cron job
    local cron_job="0 */12 * * * root $renewal_script"
    echo "[$SCRIPT_INDEX] [CHECK] Verifying cron job for auto-renewal..."

    if $USE_SUDO crontab -l 2>/dev/null | grep -q "certbot-renewal"; then
        echo "[$SCRIPT_INDEX] [OK] Auto-renewal cron job already exists"
    else
        echo "[$SCRIPT_INDEX] [CREATE] Adding auto-renewal cron job..."
        (
            $USE_SUDO crontab -l 2>/dev/null || true
            echo "$cron_job"
        ) | $USE_SUDO crontab -
        echo "[$SCRIPT_INDEX] [OK] Auto-renewal cron job added"
    fi
}

# Function to store Certbot information in global variables
store_certbot_info() {
    echo "[$SCRIPT_INDEX] [CHECK] Storing/updating Certbot information in global variables..."

    # IDEMPOTENCY: Always check and create/update symlink
    local certbot_path=$(which certbot 2>/dev/null)
    if [ -n "$certbot_path" ]; then
        echo "[$SCRIPT_INDEX] [VERIFY] Certbot binary found at: $certbot_path"

        # Always ensure symlink exists and points to correct location
        if [ -L "/usr/local/bin/certbot" ]; then
            local current_target=$(readlink -f /usr/local/bin/certbot)
            if [ "$current_target" != "$certbot_path" ]; then
                echo "[$SCRIPT_INDEX] [UPDATE] Updating certbot symlink..."
                $USE_SUDO ln -sf "$certbot_path" /usr/local/bin/certbot
                echo "[$SCRIPT_INDEX] [OK] Symlink updated: /usr/local/bin/certbot -> $certbot_path"
            else
                echo "[$SCRIPT_INDEX] [OK] Symlink correct: /usr/local/bin/certbot -> $certbot_path"
            fi
        else
            echo "[$SCRIPT_INDEX] [CREATE] Creating certbot symlink..."
            $USE_SUDO ln -sf "$certbot_path" /usr/local/bin/certbot
            echo "[$SCRIPT_INDEX] [OK] Created symlink: /usr/local/bin/certbot -> $certbot_path"
        fi
    else
        echo "[$SCRIPT_INDEX] [WARN] Certbot binary not found in PATH"
    fi

    # IDEMPOTENCY: Always store/update global variables
    echo "[$SCRIPT_INDEX] [UPDATE] Storing global variables..."
    set_var "CERTBOT_BIN" "$certbot_path"
    set_var "CERTBOT_VERSION" "$(certbot --version 2>&1 | cut -d' ' -f2)"
    set_var "CERTBOT_MANAGED_BY" "laravel_servermanager"
    set_var "CERTBOT_CONFIG_DIR" "/etc/letsencrypt"
    set_var "CERTBOT_WORK_DIR" "/var/lib/letsencrypt"
    set_var "CERTBOT_LOG_DIR" "/var/log/letsencrypt"

    echo "[$SCRIPT_INDEX] [OK] Certbot information stored successfully"
}

# Function to verify Certbot installation
verify_certbot_installation() {
    echo "[$SCRIPT_INDEX] Verifying Certbot installation..."
    
    local verification_passed=true
    
    # Check 1: Certbot binary exists
    if ! command_exists certbot; then
        echo "[$SCRIPT_INDEX] ?Certbot binary not found"
        verification_passed=false
    else
        echo "[$SCRIPT_INDEX] ?Certbot binary found: $(which certbot)"
    fi
    
    # Check 2: Configuration management
    echo "[$SCRIPT_INDEX] ?Configuration will be managed by Laravel ServerManager"
    
    # Check 3: Required directories exist
    local required_dirs=("/etc/letsencrypt" "/var/lib/letsencrypt" "/var/log/letsencrypt")
    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            echo "[$SCRIPT_INDEX] ?Directory exists: $dir"
        else
            echo "[$SCRIPT_INDEX] ?Directory missing: $dir"
            verification_passed=false
        fi
    done
    
    if [ "$verification_passed" = true ]; then
        echo "[$SCRIPT_INDEX] ?Certbot installation verified successfully"
        return 0
    else
        echo "[$SCRIPT_INDEX] ?Certbot installation verification failed"
        return 1
    fi
}

# Main installation logic - IDEMPOTENT: Always check and fix all steps
echo "[$SCRIPT_INDEX] ================================="
echo "[$SCRIPT_INDEX] CERTBOT INSTALLATION & CONFIGURATION"
echo "[$SCRIPT_INDEX] IDEMPOTENT: Checking and fixing all steps"
echo "[$SCRIPT_INDEX] ================================="
echo ""

# STEP 1: Check and install/fix Certbot base
echo "[$SCRIPT_INDEX] [STEP 1/8] Checking Certbot base installation..."
if check_certbot; then
    echo "[$SCRIPT_INDEX] [OK] Certbot is already installed: $(certbot --version 2>&1)"
else
    echo "[$SCRIPT_INDEX] [INSTALL] Installing Certbot..."
    install_certbot
    if ! check_certbot; then
        echo "[$SCRIPT_INDEX] [ERROR] Certbot installation failed"
        exit 1
    fi
    echo "[$SCRIPT_INDEX] [OK] Certbot installed successfully: $(certbot --version 2>&1)"
fi
echo ""

# STEP 2: Check and install/fix certbot-dns-dnspod plugin (includes urllib3 fix)
echo "[$SCRIPT_INDEX] [STEP 2/8] Checking certbot-dns-dnspod plugin..."
install_certbot_dnspod || {
    echo "[$SCRIPT_INDEX] [WARN] certbot-dns-dnspod installation had issues, but continuing..."
}
echo ""

# STEP 3: Check and fix urllib3 compatibility (always run)
echo "[$SCRIPT_INDEX] [STEP 3/8] Verifying urllib3 compatibility..."
fix_urllib3_compatibility || {
    echo "[$SCRIPT_INDEX] [WARN] urllib3 compatibility check completed with warnings"
}
echo ""

# STEP 4: Setup Laravel ServerManager SSL configuration (always run)
echo "[$SCRIPT_INDEX] [STEP 4/8] Checking Laravel ServerManager SSL configuration..."
create_laravel_ssl_config
echo ""

# STEP 5: Setup Nginx directories (always run)
echo "[$SCRIPT_INDEX] [STEP 5/8] Checking Nginx directories..."
setup_nginx_directories
echo ""

# STEP 6: Show Laravel ServerManager certificate configuration (always run)
echo "[$SCRIPT_INDEX] [STEP 6/8] Displaying certificate configuration..."
show_certificate_config
echo ""

# STEP 7: Setup auto-renewal (always run)
echo "[$SCRIPT_INDEX] [STEP 7/8] Checking auto-renewal configuration..."
setup_auto_renewal
echo ""

# STEP 8: Store Certbot information (always run)
echo "[$SCRIPT_INDEX] [STEP 8/8] Storing Certbot information..."
store_certbot_info
echo ""

# FINAL VERIFICATION: Always verify installation status
echo "[$SCRIPT_INDEX] ================================="
echo "[$SCRIPT_INDEX] FINAL VERIFICATION"
echo "[$SCRIPT_INDEX] ================================="
if verify_certbot_installation; then
    echo ""
    echo "[$SCRIPT_INDEX] ================================="
    echo "[$SCRIPT_INDEX] CERTBOT SETUP COMPLETED"
    echo "[$SCRIPT_INDEX] ================================="
    echo "[$SCRIPT_INDEX] All checks passed, system is ready"
    echo "[$SCRIPT_INDEX] "
    echo "[$SCRIPT_INDEX] Installation Status:"
    echo "[$SCRIPT_INDEX] -------------------------"
    echo "[$SCRIPT_INDEX] Version: $(certbot --version 2>&1 | cut -d' ' -f2)"
    echo "[$SCRIPT_INDEX] Binary Path: $(which certbot)"
    echo "[$SCRIPT_INDEX] Configuration: Managed by Laravel ServerManager"
    echo "[$SCRIPT_INDEX] Domain Setup: Use Laravel artisan commands"
    echo "[$SCRIPT_INDEX] SSL Management: Integrated with Laravel application"
    echo "[$SCRIPT_INDEX] Auto-renewal: Enabled"
    echo "[$SCRIPT_INDEX] "
    echo "[$SCRIPT_INDEX] Laravel Poly App Integration:"
    echo "[$SCRIPT_INDEX] - SSL certificates managed by Laravel ServerManager commands"
    echo "[$SCRIPT_INDEX] - Nginx configurations handled by Laravel application"
    echo "[$SCRIPT_INDEX] - Domain deployment via Laravel artisan commands"
    echo "[$SCRIPT_INDEX] "
    echo "[$SCRIPT_INDEX] Next steps:"
    echo "[$SCRIPT_INDEX] 1. Setup Laravel ServerManager for SSL and domain management"
    echo "[$SCRIPT_INDEX] 2. Configure DNS provider credentials in Laravel application"
    echo "[$SCRIPT_INDEX] 3. Use Laravel commands for certificate and website management:"
    echo "[$SCRIPT_INDEX]    cd $CORE_NODE_DIR/poly_apps/laravel_main"
    echo "[$SCRIPT_INDEX]    php artisan servermanager:certificate add example.com --provider=dnspod"
    echo "[$SCRIPT_INDEX]    php artisan servermanager:website add example.com --type=html --ssl=auto"
    echo "[$SCRIPT_INDEX] ================================="
else
    echo "[$SCRIPT_INDEX] [ERROR] Certbot installation verification failed"
    echo "[$SCRIPT_INDEX] Some checks did not pass, please review output above"
    exit 1
fi
