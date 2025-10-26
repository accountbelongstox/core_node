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
SCRIPT_INDEX="130"

# Source global variables
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

echo "[$SCRIPT_INDEX] Domain Setup Script - Adding domains to nginx and certbot"

check_and_install_sudo

# Function to get Laravel directory path using centralized CORE_NODE_DIR
get_laravel_dir() {
    # Use CORE_NODE_DIR from gvar_common.sh
    local laravel_dir="$CORE_NODE_DIR/poly_apps/laravel_main"
    echo "$laravel_dir"
}

# Function to check if Laravel is available
check_laravel_available() {
    local laravel_dir=$(get_laravel_dir)

    if [ ! -d "$laravel_dir" ]; then
        echo "[$SCRIPT_INDEX] Laravel directory not found: $laravel_dir"
        return 1
    fi

    if [ ! -f "$laravel_dir/artisan" ]; then
        echo "[$SCRIPT_INDEX] Laravel artisan not found: $laravel_dir/artisan"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Laravel directory found: $laravel_dir"

    # Check Laravel environment
    echo "[$SCRIPT_INDEX] Checking Laravel environment..."
    cd "$laravel_dir"

    # Check vendor directory
    if [ ! -d "vendor" ]; then
        echo "[$SCRIPT_INDEX] Warning: vendor directory not found, running composer install..."
        echo "[$SCRIPT_INDEX] Executing: composer install --optimize-autoloader"

        composer install --optimize-autoloader
        if [ $? -ne 0 ]; then
            echo "[$SCRIPT_INDEX] Error: Failed to install composer dependencies"
            return 1
        fi
        echo "[$SCRIPT_INDEX] Composer dependencies installed successfully"
    else
        echo "[$SCRIPT_INDEX] Vendor directory exists, skipping composer install"
    fi

    # Test artisan command
    if ! php artisan --version >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Error: artisan command failed"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Laravel is ready for use"
    return 0
}

# Function to read domains from secret storage
read_domains() {
    echo "[$SCRIPT_INDEX] Reading domains from secret storage..."

    local domains_content=$(get_secret_content "domains_list")
    if [ -z "$domains_content" ]; then
        echo "[$SCRIPT_INDEX] No domains found in secret storage"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Found domains:"
    echo "$domains_content" | while read -r domain; do
        if [ -n "$domain" ]; then
            echo "[$SCRIPT_INDEX]   - $domain"
        fi
    done

    return 0
}

# Function to get domains list (without debug output)
get_domains_list() {
    get_secret_content "domains_list" | tr -d '\r' | sed '/^$/d'
}

# Function to read DNSPod configuration
read_dnspod_config() {
    echo "[$SCRIPT_INDEX] Reading DNSPod configuration..."

    local email=$(get_secret_content "dns_dnspod_email")
    local api_token=$(get_secret_content "dns_dnspod_api_token")

    if [ -z "$email" ] || [ -z "$api_token" ]; then
        echo "[$SCRIPT_INDEX] DNSPod configuration not found or incomplete"
        echo "[$SCRIPT_INDEX]   Email: ${email:-'NOT FOUND'}"
        echo "[$SCRIPT_INDEX]   API Token: ${api_token:+FOUND}"
        return 1
    fi

    echo "[$SCRIPT_INDEX] DNSPod configuration loaded:"
    echo "[$SCRIPT_INDEX]   Email: $email"
    echo "[$SCRIPT_INDEX]   API Token: $api_token"

    return 0
}

# Function to setup domain in nginx and certbot
setup_domain() {
    local domain="$1"
    local laravel_dir=$(get_laravel_dir)

    echo "[$SCRIPT_INDEX] Setting up domain: $domain"

    # Change to Laravel directory
    cd "$laravel_dir"

    # Domain validation will be handled by Laravel commands directly

    # Ensure /www/wwwroot directory exists using path mapping
    local www_root=$(map_web_path "/www/wwwroot")
    echo "[$SCRIPT_INDEX] Ensuring $www_root directory exists..."
    if [ ! -d "$www_root" ]; then
        echo "[$SCRIPT_INDEX] Creating $www_root directory..."
        sudo mkdir -p "$www_root"
        # Skip chown in WSL as Windows filesystem doesn't support it
        if [ "$IS_WSL" = false ]; then
            sudo chown -R www-data:www-data "$www_root"
        fi
        sudo chmod -R 755 "$www_root" 2>/dev/null || true
    fi

    # Create domain-specific directory
    local domain_dir="$www_root/$domain"
    if [ ! -d "$domain_dir" ]; then
        echo "[$SCRIPT_INDEX] Creating domain directory: $domain_dir"
        sudo mkdir -p "$domain_dir"
        if [ "$IS_WSL" = false ]; then
            sudo chown -R www-data:www-data "$domain_dir"
        fi
        sudo chmod -R 755 "$domain_dir" 2>/dev/null || true
    fi

    # Use new Laravel commands instead of deploy
    echo "[$SCRIPT_INDEX] Setting up SSL certificate and website for: $domain"

    # Step 1: Add SSL certificate
    echo "[$SCRIPT_INDEX] Adding SSL certificate..."
    echo "[$SCRIPT_INDEX] Executing: php artisan servermanager:certificate add \"$domain\" --prefixes=si,sz,local,api --provider=dnspod"
    local ssl_output
    ssl_output=$(php artisan servermanager:certificate add "$domain" --prefixes=si,sz,local,api --provider=dnspod 2>&1)
    local ssl_result=$?

    echo "[$SCRIPT_INDEX] SSL certificate result:"
    echo "$ssl_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    # Step 2: Add local website (HTML)
    echo "[$SCRIPT_INDEX] Adding local website..."
    echo "[$SCRIPT_INDEX] Executing: php artisan servermanager:website add \"local.$domain\" --type=html --ssl=auto"
    local local_website_output
    local_website_output=$(php artisan servermanager:website add "local.$domain" --type=html --ssl=auto 2>&1)
    local local_result=$?

    echo "[$SCRIPT_INDEX] Local website setup result:"
    echo "$local_website_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    # Step 3: Add API website (Poly - bind to Laravel main)
    echo "[$SCRIPT_INDEX] Adding API website..."
    echo "[$SCRIPT_INDEX] Executing: php artisan servermanager:website add \"api.$domain\" --type=poly --ssl=auto"
    local api_website_output
    api_website_output=$(php artisan servermanager:website add "api.$domain" --type=poly --ssl=auto 2>&1)
    local api_result=$?

    echo "[$SCRIPT_INDEX] API website setup result:"
    echo "$api_website_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    # Combine results
    local website_output="Local Website:\n$local_website_output\n\nAPI Website:\n$api_website_output"
    # Use combined result as deploy result
    local deploy_result=0
    if [ $ssl_result -ne 0 ] || [ $local_result -ne 0 ] || [ $api_result -ne 0 ]; then
        deploy_result=1
    fi

    local deploy_output="SSL: $ssl_output\nWebsites: $website_output"

    echo "[$SCRIPT_INDEX] Deploy command output:"
    echo "$deploy_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    if [ $deploy_result -eq 0 ]; then
        echo "[$SCRIPT_INDEX] Successfully deployed $domain"

        # Domain configuration is now handled by the Laravel website commands above
        echo "[$SCRIPT_INDEX] Domain configuration completed through Laravel commands"
    else
        echo "[$SCRIPT_INDEX] Failed to deploy $domain (exit code: $deploy_result)"
        return $deploy_result
    fi

    # SSL certificate generation and domain linking is now handled by the Laravel commands above
    # All deployment activities are managed through the Laravel command system

    echo "[$SCRIPT_INDEX] Domain setup completed for: $domain"
    return $deploy_result
}

# Function to get all possible IP addresses
get_possible_ips() {
    local ips=""

    # Get all network interface IPs (exclude loopback)
    local interface_ips=$(ip addr show | grep 'inet ' | grep -v '127.0.0.1' | grep -v 'scope host lo' | awk '{print $2}' | cut -d'/' -f1 2>/dev/null)

    # Add interface IPs
    if [ -n "$interface_ips" ]; then
        ips="$ips $interface_ips"
    fi

    # Always include localhost as fallback
    ips="127.0.0.1 $ips"

    # Remove duplicates and empty entries
    echo "$ips" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' '
}

# Function to show Windows hosts file modification instructions
show_windows_hosts_info() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] LOCAL TESTING SETUP INSTRUCTIONS"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] For local testing, modify your Windows hosts file:"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Hosts file location:"
    echo "[$SCRIPT_INDEX]   C:\\Windows\\System32\\drivers\\etc\\hosts"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Add these lines to your hosts file:"
    echo "[$SCRIPT_INDEX] =================================="

    local possible_ips=$(get_possible_ips)

    local domains_content=$(get_domains_list)
    if [ -n "$domains_content" ]; then
        # Show entries for each IP address
        for ip in $possible_ips; do
            if [ -n "$ip" ]; then
                echo "# Using IP: $ip"
                echo "$domains_content" | while read -r domain; do
                    if [ -n "$domain" ]; then
                        echo "$ip    local.$domain"
                        echo "$ip    api.$domain"
                    fi
                done
                echo ""
            fi
        done
    fi

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Available IP addresses: $possible_ips"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Note: SSL certificates will work with DNS validation"
    echo "[$SCRIPT_INDEX] even when domains point to localhost for testing."
    echo "[$SCRIPT_INDEX]"
}

# Function to print detailed summary
print_summary() {
    local success_count="$1"
    local total_count="$2"

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] DOMAIN SETUP SUMMARY"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] Successfully configured: $success_count/$total_count domains"
    echo "[$SCRIPT_INDEX]"

    # Get detailed information from Laravel commands
    echo "[$SCRIPT_INDEX] Fetching detailed information..."
    echo "[$SCRIPT_INDEX]"

    # Show website summary
    echo "[$SCRIPT_INDEX] WEBSITE SUMMARY:"
    php artisan servermanager:website summary 2>/dev/null | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done
    echo "[$SCRIPT_INDEX]"

    # Show certificate summary
    echo "[$SCRIPT_INDEX] CERTIFICATE SUMMARY:"
    php artisan servermanager:certificate summary 2>/dev/null | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done
    echo "[$SCRIPT_INDEX]"

    echo "[$SCRIPT_INDEX] Services configured:"
    echo "[$SCRIPT_INDEX]   - Nginx virtual hosts with expanded domain coverage"
    echo "[$SCRIPT_INDEX]   - SSL certificates (DNSPod DNS validation)"
    echo "[$SCRIPT_INDEX]   - Wildcard and subdomain certificate coverage"
    echo "[$SCRIPT_INDEX]   - Automatic certificate renewal"
    echo "[$SCRIPT_INDEX]   - Index.html files created"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] You can now access your domains:"

    local domains_content=$(get_domains_list)
    if [ -n "$domains_content" ]; then
        echo "$domains_content" | while read -r domain; do
            if [ -n "$domain" ]; then
                echo "[$SCRIPT_INDEX]   - https://$domain (with wildcard coverage)"
                echo "[$SCRIPT_INDEX]   - https://si.$domain, https://sz.$domain, https://local.$domain"
                echo "[$SCRIPT_INDEX]   - https://api.$domain, https://api.si.$domain, etc."
            fi
        done
    fi

    echo "[$SCRIPT_INDEX] =================================="
}

# Main execution
echo "[$SCRIPT_INDEX] Starting domain setup process..."

# Check prerequisites
if ! check_laravel_available; then
    echo "[$SCRIPT_INDEX] Laravel is not available. Please install Laravel first."
    exit 1
fi

# Read configuration
if ! read_dnspod_config; then
    echo "[$SCRIPT_INDEX] DNSPod configuration is missing. Please check secret storage."
    exit 1
fi

# Read domains and show debug info
read_domains

domains_content=$(get_domains_list)
if [ -z "$domains_content" ]; then
    echo "[$SCRIPT_INDEX] No domains to configure. Exiting."
    exit 1
fi

# Setup each domain
success_count=0
total_count=0

echo "$domains_content" | while read -r domain; do
    if [ -n "$domain" ]; then
        total_count=$((total_count + 1))

        echo "[$SCRIPT_INDEX] Processing domain: $domain"

        if setup_domain "$domain"; then
            success_count=$((success_count + 1))
            echo "[$SCRIPT_INDEX] ?Successfully configured: $domain"
        else
            echo "[$SCRIPT_INDEX] ?Failed to configure: $domain"
        fi

        echo "[$SCRIPT_INDEX] ---"
    fi
done

# Show local testing instructions
show_windows_hosts_info

# Print summary
print_summary "$success_count" "$total_count"

echo "[$SCRIPT_INDEX] Domain setup script completed!"

if [ $success_count -eq $total_count ] && [ $total_count -gt 0 ]; then
    echo "[$SCRIPT_INDEX] All domains configured successfully!"
    exit 0
else
    echo "[$SCRIPT_INDEX] Some domains failed to configure. Check the logs above."
    exit 1
fi
