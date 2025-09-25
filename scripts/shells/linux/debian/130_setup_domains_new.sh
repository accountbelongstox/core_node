#!/bin/bash

# Script to setup domains with SSL certificates and nginx websites
# This script separates SSL certificate management from website creation

SCRIPT_INDEX=130

# Source common functions
source "$(dirname "$0")/../../../common/gvar_common.sh"

# Function to get core_node directory
get_core_node_dir() {
    local current_dir="$(pwd)"
    
    # Try to find core_node directory by walking up
    while [ "$current_dir" != "/" ] && [ "$current_dir" != "." ]; do
        if [ -d "$current_dir/.secret_keys" ]; then
            echo "$current_dir"
            return 0
        fi
        current_dir="$(dirname "$current_dir")"
    done
    
    # Fallback to common paths
    for path in "/mnt/d/programing/core_node" "/opt/core_node" "/var/www/core_node"; do
        if [ -d "$path/.secret_keys" ]; then
            echo "$path"
            return 0
        fi
    done
    
    return 1
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Laravel environment
check_laravel_environment() {
    local laravel_dir="$1"

    echo "[$SCRIPT_INDEX] Checking Laravel environment..."

    # Check PHP
    if ! command_exists php; then
        echo "[$SCRIPT_INDEX] Error: PHP is not installed"
        return 1
    fi

    local php_version=$(php -v | head -n1 | cut -d' ' -f2 | cut -d'.' -f1,2)
    echo "[$SCRIPT_INDEX] PHP version: $php_version"

    # Check Composer
    if ! command_exists composer; then
        echo "[$SCRIPT_INDEX] Error: Composer is not installed"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Composer version: $(composer --version --no-ansi | head -n1)"

    # Check Laravel directory
    if [ ! -d "$laravel_dir" ]; then
        echo "[$SCRIPT_INDEX] Error: Laravel directory not found: $laravel_dir"
        return 1
    fi

    # Check composer.json
    if [ ! -f "$laravel_dir/composer.json" ]; then
        echo "[$SCRIPT_INDEX] Error: composer.json not found in Laravel directory"
        return 1
    fi

    # Check vendor directory
    cd "$laravel_dir"
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

    # Check artisan
    if [ ! -f "$laravel_dir/artisan" ]; then
        echo "[$SCRIPT_INDEX] Error: artisan file not found"
        return 1
    fi

    # Test artisan command
    cd "$laravel_dir"
    if ! php artisan --version >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Error: artisan command failed"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Laravel environment check passed"
    return 0
}

# Function to get Laravel directory
get_laravel_dir() {
    local core_node_dir=$(get_core_node_dir)
    if [ -z "$core_node_dir" ]; then
        return 1
    fi

    local laravel_dir="$core_node_dir/poly_apps/laravel_main"
    if [ -d "$laravel_dir" ]; then
        echo "$laravel_dir"
        return 0
    fi

    return 1
}

# Function to read domains from secret storage
read_domains() {
    local core_node_dir=$(get_core_node_dir)
    if [ -z "$core_node_dir" ]; then
        echo "Error: Could not find core_node directory" >&2
        return 1
    fi
    
    local domains_file="$core_node_dir/.secret_keys/.secret_ignore/domains_list"
    if [ -f "$domains_file" ]; then
        cat "$domains_file" | grep -v '^#' | grep -v '^$'
    else
        echo "Error: Domains file not found: $domains_file" >&2
        return 1
    fi
}

# Function to setup SSL certificate for domain
setup_ssl_certificate() {
    local domain="$1"
    local subdomain_prefixes="${2:-si,sz,local,api}"
    
    if [ -z "$domain" ]; then
        echo "[$SCRIPT_INDEX] Error: Domain parameter is required"
        return 1
    fi
    
    echo "[$SCRIPT_INDEX] Setting up SSL certificate for: $domain"
    echo "[$SCRIPT_INDEX] Subdomain prefixes: $subdomain_prefixes"
    
    # Get Laravel directory
    local laravel_dir=$(get_laravel_dir)
    if [ -z "$laravel_dir" ]; then
        echo "[$SCRIPT_INDEX] Error: Could not find Laravel directory"
        return 1
    fi

    # Change to Laravel directory
    cd "$laravel_dir"

    # Call Laravel SSL certificate management command
    local ssl_output
    ssl_output=$(php artisan servermanager:certificate add "$domain" --prefixes="$subdomain_prefixes" --provider=dnspod 2>&1)
    local ssl_result=$?
    
    echo "[$SCRIPT_INDEX] SSL certificate setup result:"
    echo "$ssl_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done
    
    return $ssl_result
}

# Function to setup nginx website
setup_nginx_website() {
    local domain="$1"
    local use_ssl="${2:-auto}"
    
    if [ -z "$domain" ]; then
        echo "[$SCRIPT_INDEX] Error: Domain parameter is required"
        return 1
    fi
    
    echo "[$SCRIPT_INDEX] Setting up nginx website for: $domain"
    echo "[$SCRIPT_INDEX] SSL mode: $use_ssl"
    
    # Get Laravel directory
    local laravel_dir=$(get_laravel_dir)
    if [ -z "$laravel_dir" ]; then
        echo "[$SCRIPT_INDEX] Error: Could not find Laravel directory"
        return 1
    fi

    # Change to Laravel directory
    cd "$laravel_dir"

    # Ensure /www/wwwroot directory exists
    echo "[$SCRIPT_INDEX] Ensuring /www/wwwroot directory exists..."
    if [ ! -d "/www/wwwroot" ]; then
        echo "[$SCRIPT_INDEX] Creating /www/wwwroot directory..."
        sudo mkdir -p /www/wwwroot
        sudo chown -R www-data:www-data /www/wwwroot
        sudo chmod -R 755 /www/wwwroot
    fi
    
    # Process domain to handle www prefix
    local base_domain="$domain"
    local www_domain="$domain"
    if [[ "$domain" == www.* ]]; then
        base_domain="${domain#www.}"
    else
        www_domain="www.$domain"
    fi
    
    echo "[$SCRIPT_INDEX] Base domain: $base_domain"
    echo "[$SCRIPT_INDEX] WWW domain: $www_domain"
    
    # Create domain-specific directory
    local domain_dir="/www/wwwroot/$base_domain"
    if [ ! -d "$domain_dir" ]; then
        echo "[$SCRIPT_INDEX] Creating domain directory: $domain_dir"
        sudo mkdir -p "$domain_dir"
        sudo chown -R www-data:www-data "$domain_dir"
        sudo chmod -R 755 "$domain_dir"
    fi

    # Call Laravel website management command
    local website_output
    website_output=$(php artisan servermanager:website add "$base_domain" --type=laravel --ssl="$use_ssl" 2>&1)

    # Also add www domain if different
    if [ "$www_domain" != "$base_domain" ]; then
        local www_output
        www_output=$(php artisan servermanager:website add "$www_domain" --type=laravel --ssl="$use_ssl" 2>&1)
        website_output="$website_output"$'\n'"WWW Domain:"$'\n'"$www_output"
    fi
    local website_result=$?
    
    echo "[$SCRIPT_INDEX] Website setup result:"
    echo "$website_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done
    
    return $website_result
}

# Function to setup a single domain (main function)
setup_domain() {
    local domain="$1"
    
    if [ -z "$domain" ]; then
        echo "[$SCRIPT_INDEX] Error: Domain parameter is required"
        return 1
    fi
    
    echo "[$SCRIPT_INDEX] Setting up domain: $domain"
    
    # Step 1: Setup SSL certificate with expanded domains
    echo "[$SCRIPT_INDEX] Step 1: Setting up SSL certificate..."
    setup_ssl_certificate "$domain" "si,sz,local,api"
    local ssl_result=$?
    
    # Step 2: Setup nginx website (auto-detect SSL)
    echo "[$SCRIPT_INDEX] Step 2: Setting up nginx website..."
    setup_nginx_website "$domain" "auto"
    local website_result=$?
    
    # Also setup www version if not already www
    if [[ "$domain" != www.* ]]; then
        echo "[$SCRIPT_INDEX] Step 3: Setting up www version..."
        setup_nginx_website "www.$domain" "auto"
    fi
    
    if [ $ssl_result -eq 0 ] && [ $website_result -eq 0 ]; then
        echo "[$SCRIPT_INDEX] ????Successfully configured: $domain"
        return 0
    else
        echo "[$SCRIPT_INDEX] ????Failed to configure: $domain"
        return 1
    fi
}

# Function to show Laravel management commands
show_laravel_commands() {
    local laravel_dir=$(get_laravel_dir)
    if [ -z "$laravel_dir" ]; then
        echo "[$SCRIPT_INDEX] Error: Could not find Laravel directory"
        return 1
    fi

    cd "$laravel_dir"

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] LARAVEL MANAGEMENT COMMANDS"
    echo "[$SCRIPT_INDEX] =================================="

    # Show certificate management
    echo "[$SCRIPT_INDEX] Certificate Management:"
    php artisan servermanager:certificate summary 2>&1 | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    # Show website management
    echo "[$SCRIPT_INDEX] Website Management:"
    php artisan servermanager:website summary 2>&1 | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    echo "[$SCRIPT_INDEX] =================================="
}

# Main execution
main() {
    echo "[$SCRIPT_INDEX] Domain Setup Script - Simplified SSL and Website Management"
    echo "[$SCRIPT_INDEX] Starting domain setup process..."

    # Check Laravel availability
    local laravel_dir=$(get_laravel_dir)
    if [ -z "$laravel_dir" ]; then
        echo "[$SCRIPT_INDEX] Error: Laravel directory not found"
        exit 1
    fi

    echo "[$SCRIPT_INDEX] Laravel directory found: $laravel_dir"

    # Check Laravel environment
    if ! check_laravel_environment "$laravel_dir"; then
        echo "[$SCRIPT_INDEX] Error: Laravel environment check failed"
        exit 1
    fi

    echo "[$SCRIPT_INDEX] Laravel is ready for use"

    # Read domains from secret storage
    echo "[$SCRIPT_INDEX] Reading domains from secret storage..."
    local domains_content
    domains_content=$(read_domains)

    if [ $? -ne 0 ] || [ -z "$domains_content" ]; then
        echo "[$SCRIPT_INDEX] Error: Could not read domains from secret storage"
        exit 1
    fi

    echo "[$SCRIPT_INDEX] Found domains:"
    echo "$domains_content" | while IFS= read -r domain; do
        if [ -n "$domain" ]; then
            echo "[$SCRIPT_INDEX]   - $domain"
        fi
    done

    # Process each domain
    local success_count=0
    local total_count=0

    echo "$domains_content" | while IFS= read -r domain; do
        if [ -n "$domain" ]; then
            total_count=$((total_count + 1))
            echo "[$SCRIPT_INDEX] Processing domain: $domain"

            if setup_domain "$domain"; then
                success_count=$((success_count + 1))
            fi

            echo "[$SCRIPT_INDEX] ---"
        fi
    done

    # Show Laravel management information
    show_laravel_commands

    echo "[$SCRIPT_INDEX] Domain setup process completed"
}

# Execute main function
main "$@"
