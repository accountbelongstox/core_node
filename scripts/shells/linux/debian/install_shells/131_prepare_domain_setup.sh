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
SCRIPT_INDEX="131"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Variable declarations
laravel_dir=""
www_root=""
nginx_config_dir=""
ssl_dir=""
php_version="8.4"
DNSPOD_EMAIL=""
DNSPOD_API_TOKEN=""
DOMAINS_LISTS_CONTENT=""
SELECTED_PREFIXES=""
SETUP_STATE_DIR="$HOME/.domain_setup_state"

echo "[$SCRIPT_INDEX] Domain Setup - Preparation Script"
echo "[$SCRIPT_INDEX] This script prepares the environment for domain setup"

# USE_SUDO is already defined in gvar_common.sh
echo "[$SCRIPT_INDEX] Using sudo configuration from gvar_common.sh: ${USE_SUDO:-'(none)'}"

# Function to save state
save_state() {
    local key="$1"
    local value="$2"

    mkdir -p "$SETUP_STATE_DIR"
    echo "$value" > "$SETUP_STATE_DIR/$key"
    echo "[$SCRIPT_INDEX] Saved state: $key"
}

# Function to load state
load_state() {
    local key="$1"

    if [ -f "$SETUP_STATE_DIR/$key" ]; then
        cat "$SETUP_STATE_DIR/$key"
    fi
}

# Function to clear all state (does not affect database)
clear_state() {
    echo "[$SCRIPT_INDEX] Clearing previous setup state..."
    echo "[$SCRIPT_INDEX] Note: This only clears setup state files, database will not be affected"
    rm -rf "$SETUP_STATE_DIR"
    mkdir -p "$SETUP_STATE_DIR"
    echo "[$SCRIPT_INDEX] State cleared"
}

# Function to select domain prefixes for WSL/Desktop environments
select_domain_prefixes() {
    # Only prompt for prefixes on non-production environments
    if [ "$IS_PRODUCTION" = true ]; then
        # Production: use all default prefixes
        SELECTED_PREFIXES="local,si,sz,sh,api"
        echo "[$SCRIPT_INDEX] Production environment: Using all default prefixes (local,si,sz,sh,api)"
        return 0
    fi

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] DOMAIN PREFIX SELECTION"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] Current platform: $([ "$IS_WSL" = true ] && echo 'WSL' || echo 'Desktop')"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Select domain prefixes for local development:"
    echo "[$SCRIPT_INDEX] This determines which subdomains will be created for each domain."
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Default prefixes available:"
    echo "[$SCRIPT_INDEX]   - local: For local development (local.domain.com, local.api.domain.com)"
    echo "[$SCRIPT_INDEX]   - si:    For si region (si.domain.com, si.api.domain.com)"
    echo "[$SCRIPT_INDEX]   - sz:    For sz region (sz.domain.com, sz.api.domain.com)"
    echo "[$SCRIPT_INDEX]   - sh:    For sh region (sh.domain.com, sh.api.domain.com)"
    echo "[$SCRIPT_INDEX]   - api:   For API endpoints (api.domain.com)"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Enter prefixes (comma-separated), or press Enter for default (local,si,sz,sh,api):"
    echo -n "[$SCRIPT_INDEX] Prefixes: " >&2

    read -r user_input

    if [ -z "$user_input" ]; then
        SELECTED_PREFIXES="local,si,sz,sh,api"
        echo "[$SCRIPT_INDEX] Using default prefixes: local,si,sz,sh,api"
    else
        # Trim whitespace and validate input
        SELECTED_PREFIXES=$(echo "$user_input" | tr -d ' ')
        echo "[$SCRIPT_INDEX] Selected prefixes: $SELECTED_PREFIXES"
    fi

    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Domains will be created with these patterns:"

    # Parse selected prefixes and show what will be created
    IFS=',' read -ra PREFIX_ARRAY <<< "$SELECTED_PREFIXES"
    for prefix in "${PREFIX_ARRAY[@]}"; do
        if [ "$prefix" = "api" ]; then
            echo "[$SCRIPT_INDEX]   - api.domain.com (API endpoint)"
        else
            echo "[$SCRIPT_INDEX]   - $prefix.domain.com (static HTML)"
            echo "[$SCRIPT_INDEX]   - $prefix.api.domain.com (API endpoint)"
            echo "[$SCRIPT_INDEX]   - *.$prefix.domain.com (wildcard)"
            echo "[$SCRIPT_INDEX]   - *.$prefix.api.domain.com (wildcard)"
        fi
    done

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX]"

    return 0
}

# Function to initialize secrets with password prompt
initialize_secrets() {
    # Check if secret_get_key function exists
    if ! type secret_get_key >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] WARNING: secret_get_key function not found, using get_secret_content" >&2
        DNSPOD_EMAIL=$(get_secret_content "DNS_DNSPOD_EMAILS")
        DNSPOD_API_TOKEN=$(get_secret_content "DNS_DNSPOD_API_TOKENS")
        DOMAINS_LISTS_CONTENT=$(get_secret_content "DOMAINS_LISTS")
        return 0
    fi

    # In non-production environment (WSL/Desktop), try to use cached secrets
    if [ "$IS_PRODUCTION" != true ]; then
        echo "[$SCRIPT_INDEX] Desktop/WSL environment detected - checking for cached secrets"

        # Try to load from cache (will prompt once if cache doesn't exist)
        DNSPOD_EMAIL=$(secret_get_key "DNS_DNSPOD_EMAILS" "")
        if [ $? -ne 0 ] || [ -z "$DNSPOD_EMAIL" ]; then
            echo "[$SCRIPT_INDEX] ERROR: Failed to load DNS_DNSPOD_EMAILS" >&2
            return 1
        fi

        DNSPOD_API_TOKEN=$(secret_get_key "DNS_DNSPOD_API_TOKENS" "")
        if [ $? -ne 0 ] || [ -z "$DNSPOD_API_TOKEN" ]; then
            echo "[$SCRIPT_INDEX] ERROR: Failed to load DNS_DNSPOD_API_TOKENS" >&2
            return 1
        fi

        DOMAINS_LISTS_CONTENT=$(secret_get_key "DOMAINS_LISTS" "")
        if [ $? -ne 0 ] || [ -z "$DOMAINS_LISTS_CONTENT" ]; then
            echo "[$SCRIPT_INDEX] ERROR: Failed to load DOMAINS_LISTS" >&2
            return 1
        fi

        echo "[$SCRIPT_INDEX] [OK]All secrets loaded from cache" >&2
        return 0
    fi

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] SERVER ENVIRONMENT DETECTED"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] For security, encrypted secrets require password authentication."
    echo "[$SCRIPT_INDEX]"

    local password=""
    if type _secret_read_password >/dev/null 2>&1; then
        password=$(_secret_read_password "[$SCRIPT_INDEX] Enter decryption password: " "asterisk")
    else
        echo -n "[$SCRIPT_INDEX] Enter decryption password: " >&2
        read -s password
        echo "" >&2
    fi

    if [ -z "$password" ]; then
        echo "[$SCRIPT_INDEX] ERROR: Password cannot be empty" >&2
        return 1
    fi

    # Decrypt secrets
    echo "[$SCRIPT_INDEX] Decrypting required secrets..." >&2

    DNSPOD_EMAIL=$(secret_get_key "DNS_DNSPOD_EMAILS" "$password")
    if [ $? -ne 0 ] || [ -z "$DNSPOD_EMAIL" ]; then
        echo "[$SCRIPT_INDEX] ERROR: Failed to decrypt DNS_DNSPOD_EMAILS" >&2
        return 1
    fi

    DNSPOD_API_TOKEN=$(secret_get_key "DNS_DNSPOD_API_TOKENS" "$password")
    if [ $? -ne 0 ] || [ -z "$DNSPOD_API_TOKEN" ]; then
        echo "[$SCRIPT_INDEX] ERROR: Failed to decrypt DNS_DNSPOD_API_TOKENS" >&2
        return 1
    fi

    DOMAINS_LISTS_CONTENT=$(secret_get_key "DOMAINS_LISTS" "$password")
    if [ $? -ne 0 ] || [ -z "$DOMAINS_LISTS_CONTENT" ]; then
        echo "[$SCRIPT_INDEX] ERROR: Failed to decrypt DOMAINS_LISTS" >&2
        return 1
    fi

    echo "[$SCRIPT_INDEX] [OK]All secrets decrypted successfully" >&2
    echo "[$SCRIPT_INDEX] =================================="

    return 0
}

# Function to initialize system directories
initialize_system_directories() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] INITIALIZING SYSTEM DIRECTORIES"
    echo "[$SCRIPT_INDEX] =================================="

    # Get mapped paths from gvar_common.sh
    www_root=$(map_web_path "wwwroot")
    nginx_config_dir=$(map_web_path "nginxconfig")
    ssl_dir=$(map_web_path "nginxconfig")/ssl
    local shared_data=$(map_web_path "shared-data")
    local backup_dir=$(map_web_path "backup")

    # Build system directories list using mapped paths
    local laravel_main="$www_root/laravel_main"
    local laravel_db="$laravel_main/laravel_db"

    # Check if database files exist (do not recreate if database exists)
    local db_exists=false
    if [ -d "$laravel_db" ]; then
        # Check for common database files
        if find "$laravel_db" -maxdepth 1 -type f \( -name "*.db" -o -name "*.sqlite" -o -name "*.sqlite3" \) 2>/dev/null | grep -q .; then
            db_exists=true
            echo "[$SCRIPT_INDEX] Database files detected in $laravel_db - will preserve existing database"
        fi
    fi

    local system_dirs=(
        "$nginx_config_dir"
        "$ssl_dir"
        "$nginx_config_dir/sites-available"
        "$nginx_config_dir/sites-enabled"
        "$www_root"
        "$laravel_main"
        "$laravel_db"
        "$laravel_db/tmp"
        "$laravel_db/sessions"
        "$shared_data"
        "$backup_dir"
    )

    echo "[$SCRIPT_INDEX] Using mapped paths from gvar_common.sh:"
    echo "[$SCRIPT_INDEX]   wwwroot: $www_root"
    echo "[$SCRIPT_INDEX]   nginxconfig: $nginx_config_dir"
    echo "[$SCRIPT_INDEX]   ssl: $ssl_dir"
    echo "[$SCRIPT_INDEX]   shared-data: $shared_data"
    echo "[$SCRIPT_INDEX]   backup: $backup_dir"

    for dir in "${system_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            echo "[$SCRIPT_INDEX]   Creating: $dir"
            echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO mkdir -p \"$dir\""
            $USE_SUDO mkdir -p "$dir" 2>/dev/null || {
                echo "[$SCRIPT_INDEX]   [FAIL] Failed to create $dir"
                return 1
            }
            echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chmod 755 \"$dir\""
            $USE_SUDO chmod 755 "$dir" 2>/dev/null || true
            echo "[$SCRIPT_INDEX]   [OK]Created: $dir"
        else
            echo "[$SCRIPT_INDEX]   [OK]Exists: $dir"
        fi
    done

    # Set ownership and permissions
    echo "[$SCRIPT_INDEX] Setting ownership and permissions..."
    for dir in "${system_dirs[@]}"; do
        if [ -d "$dir" ]; then
            # Special handling for database directory - preserve database files
            if [ "$dir" = "$laravel_db" ] && [ "$db_exists" = true ]; then
                echo "[$SCRIPT_INDEX]   Preserving database files in $dir"
                # Only set permissions on directory, not recursively to avoid affecting database files
                if [ "$IS_WSL" = true ]; then
                    echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chmod 777 \"$dir\""
                    $USE_SUDO chmod 777 "$dir" 2>/dev/null || true
                else
                    echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chown $USER:www-data \"$dir\""
                    $USE_SUDO chown $USER:www-data "$dir" 2>/dev/null || {
                        echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chmod 777 \"$dir\""
                        $USE_SUDO chmod 777 "$dir" 2>/dev/null || true
                    }
                    echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chmod 775 \"$dir\""
                    $USE_SUDO chmod 775 "$dir" 2>/dev/null || true
                fi
                echo "[$SCRIPT_INDEX]   [OK]Database directory permissions updated (database files preserved)"
            else
                # Normal directory handling
                if [ "$IS_WSL" = true ]; then
                    echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chmod -R 777 \"$dir\""
                    $USE_SUDO chmod -R 777 "$dir" 2>/dev/null || true
                    echo "[$SCRIPT_INDEX]   [OK]Set WSL permissions: $dir"
                else
                    echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chown -R $USER:www-data \"$dir\""
                    $USE_SUDO chown -R $USER:www-data "$dir" 2>/dev/null || {
                        echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chmod -R 777 \"$dir\""
                        $USE_SUDO chmod -R 777 "$dir" 2>/dev/null || true
                    }
                    echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chmod -R 775 \"$dir\""
                    $USE_SUDO chmod -R 775 "$dir" 2>/dev/null || true
                    echo "[$SCRIPT_INDEX]   [OK]Set ownership: $dir"
                fi
            fi
        fi
    done

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] [OK]System directories initialized"
    echo "[$SCRIPT_INDEX] =================================="
    return 0
}


# Function to get Laravel directory path
get_laravel_dir() {
    if [ -z "$CORE_NODE_DIR" ]; then
        local script_root="$(cd "$PARENT_DIR_LEVEL_2/../.." && pwd)"
        echo "[$SCRIPT_INDEX] Warning: CORE_NODE_DIR not set, using fallback: $script_root"
        local laravel_dir="$script_root/poly_apps/laravel_main"
    else
        local laravel_dir="$CORE_NODE_DIR/poly_apps/laravel_main"
    fi

    if [ ! -d "$laravel_dir" ]; then
        echo "[$SCRIPT_INDEX] Error: Laravel directory does not exist: $laravel_dir"
        return 1
    fi

    echo "$laravel_dir"
}

# Function to check if Laravel is available
check_laravel_available() {
    laravel_dir=$(get_laravel_dir)

    if [ ! -d "$laravel_dir" ]; then
        echo "[$SCRIPT_INDEX] Laravel directory not found: $laravel_dir"
        return 1
    fi

    if [ ! -f "$laravel_dir/artisan" ]; then
        echo "[$SCRIPT_INDEX] Laravel artisan not found: $laravel_dir/artisan"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Laravel directory found: $laravel_dir"

    # Check vendor directory
    if [ ! -d "$laravel_dir/vendor" ]; then
        echo "[$SCRIPT_INDEX] Warning: vendor directory not found, running composer install..."
        cd "$laravel_dir"
        echo "[$SCRIPT_INDEX] Executing: $USE_SUDO composer install --optimize-autoloader"
        $USE_SUDO composer install --optimize-autoloader
        if [ $? -ne 0 ]; then
            echo "[$SCRIPT_INDEX] Error: Failed to install composer dependencies"
            return 1
        fi
    fi

    # Test artisan command
    cd "$laravel_dir"
    echo "[$SCRIPT_INDEX] Executing: $USE_SUDO php artisan --version"
    if ! $USE_SUDO php artisan --version >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Error: artisan command failed"
        return 1
    fi

    echo "[$SCRIPT_INDEX] [OK]Laravel is ready for use"
    return 0
}

# Function to initialize Laravel-specific directories
initialize_laravel_directories() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] INITIALIZING LARAVEL DIRECTORIES"
    echo "[$SCRIPT_INDEX] =================================="

    laravel_dir=$(get_laravel_dir)
    if [ -z "$laravel_dir" ]; then
        echo "[$SCRIPT_INDEX] ERROR: Failed to get Laravel directory"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Laravel directory: $laravel_dir"

    # Create Laravel storage directories
    local laravel_dirs=(
        "$laravel_dir/storage/framework/sessions"
        "$laravel_dir/storage/framework/cache"
        "$laravel_dir/storage/framework/views"
        "$laravel_dir/storage/logs"
        "$laravel_dir/storage/app/public"
        "$laravel_dir/bootstrap/cache"
    )

    for dir in "${laravel_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            echo "[$SCRIPT_INDEX]   Creating: $dir"
            echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO mkdir -p \"$dir\""
            $USE_SUDO mkdir -p "$dir" 2>/dev/null || {
                echo "[$SCRIPT_INDEX]   [FAIL] Failed to create $dir"
                return 1
            }
            echo "[$SCRIPT_INDEX]   [OK]Created: $dir"
        else
            echo "[$SCRIPT_INDEX]   [OK]Exists: $dir"
        fi
    done

    # Set permissions on storage directories
    echo "[$SCRIPT_INDEX] Setting permissions on Laravel storage directories..."
    for dir in "${laravel_dirs[@]}"; do
        if [ -d "$dir" ]; then
            if [ "$IS_WSL" = true ]; then
                echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chmod -R 777 \"$dir\""
                $USE_SUDO chmod -R 777 "$dir" 2>/dev/null || true
                echo "[$SCRIPT_INDEX]   [OK]Set WSL permissions: $dir"
            else
                echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chown -R $USER:www-data \"$dir\""
                $USE_SUDO chown -R $USER:www-data "$dir" 2>/dev/null || {
                    echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chmod -R 777 \"$dir\""
                    $USE_SUDO chmod -R 777 "$dir" 2>/dev/null || true
                }
                echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO chmod -R 775 \"$dir\""
                $USE_SUDO chmod -R 775 "$dir" 2>/dev/null || true
                echo "[$SCRIPT_INDEX]   [OK]Set ownership: $dir"
            fi
        fi
    done

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] [OK]Laravel directories initialized"
    echo "[$SCRIPT_INDEX] =================================="
    return 0
}

# Function to get domains list
get_domains_list() {
    if [ -n "$DOMAINS_LISTS_CONTENT" ]; then
        echo "$DOMAINS_LISTS_CONTENT" | tr -d '\r' | sed '/^$/d'
    else
        echo ""
    fi
}

# Main execution
echo "[$SCRIPT_INDEX] Starting domain setup preparation..."

# Ask user if they want to start fresh
echo ""
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] SETUP MODE SELECTION"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] Do you want to start fresh (clear previous setup state)?"
echo "[$SCRIPT_INDEX] Choose 'y' to clear previous state and start over"
echo "[$SCRIPT_INDEX] Choose 'n' to continue from previous state (if any)"
echo "[$SCRIPT_INDEX] Note: This only clears setup state files, database will not be affected"
echo ""
read -p "[$SCRIPT_INDEX] Start fresh? (Y/n): " fresh_start

# Default to yes if empty or Enter pressed
if [ -z "$fresh_start" ] || [[ "$fresh_start" =~ ^[Yy]$ ]]; then
    clear_state
fi

# Initialize system directories
echo ""
initialize_system_directories || {
    echo "[$SCRIPT_INDEX] Failed to initialize system directories"
    exit 1
}


# Check Laravel availability
echo ""
if ! check_laravel_available; then
    echo "[$SCRIPT_INDEX] Laravel is not available. Please install Laravel first."
    exit 1
fi

# Initialize Laravel directories
echo ""
if ! initialize_laravel_directories; then
    echo "[$SCRIPT_INDEX] Failed to initialize Laravel directories. Cannot continue."
    exit 1
fi

# Initialize secrets
echo ""
if ! initialize_secrets; then
    echo "[$SCRIPT_INDEX] Failed to initialize secrets. Cannot continue."
    exit 1
fi

# Save secrets to state
save_state "DNSPOD_EMAIL" "$DNSPOD_EMAIL"
save_state "DNSPOD_API_TOKEN" "$DNSPOD_API_TOKEN"
save_state "DOMAINS_LISTS_CONTENT" "$DOMAINS_LISTS_CONTENT"

# Select domain prefixes
echo ""
if ! select_domain_prefixes; then
    echo "[$SCRIPT_INDEX] Failed to select domain prefixes. Cannot continue."
    exit 1
fi

# Save prefixes to state
save_state "SELECTED_PREFIXES" "$SELECTED_PREFIXES"
save_state "PHP_VERSION" "$php_version"

# Display summary
echo ""
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] PREPARATION COMPLETE"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] Configuration Summary:"
echo "[$SCRIPT_INDEX]   PHP Version: $php_version"
echo "[$SCRIPT_INDEX]   Selected Prefixes: $SELECTED_PREFIXES"
echo "[$SCRIPT_INDEX]   State Directory: $SETUP_STATE_DIR"
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] Domain List:"
domains_content=$(get_domains_list)
if [ -n "$domains_content" ]; then
    echo "$domains_content" | while read -r domain; do
        if [ -n "$domain" ]; then
            echo "[$SCRIPT_INDEX]   - $domain"
        fi
    done
else
    echo "[$SCRIPT_INDEX]   No domains found"
fi
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] Next Steps:"
echo "[$SCRIPT_INDEX]   1. Run 132_setup_domain_ssl.sh to add SSL certificates"
echo "[$SCRIPT_INDEX]   2. Run 133_setup_api_domains.sh to setup API domains"
echo "[$SCRIPT_INDEX]   3. Run 134_setup_html_domains.sh to setup HTML domains"
echo "[$SCRIPT_INDEX] =================================="

exit 0
