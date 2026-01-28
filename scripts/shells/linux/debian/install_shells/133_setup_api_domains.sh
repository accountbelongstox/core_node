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

# IMPORTANT: This script must be run as ROOT user
# Required for API domain setup, nginx configuration, and Octane services
if [ "$EUID" -ne 0 ] && [ -z "$SUDO_USER" ]; then
    echo "Error: This script must be run as root or with sudo"
    echo "Usage: sudo $0"
    exit 1
fi

# ============================================================================
# ALL VARIABLE DECLARATIONS AND SOURCE STATEMENTS MUST BE AT THE TOP
# ============================================================================

# Script path variables (must be declared first)
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="133"

# Source global variables and common functions (must be sourced before using any functions)
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source unified Laravel service manager
LARAVEL_SERVICE_MANAGER="$CORE_NODE_DIR/scripts/unified_manager/modules/laravel_service_manager.sh"
if [ -f "$LARAVEL_SERVICE_MANAGER" ]; then
    source "$LARAVEL_SERVICE_MANAGER"
fi

# All variable declarations (must be at the top after sourcing)
laravel_dir=""
SELECTED_PREFIXES=""
DOMAINS_LISTS_CONTENT=""
PHP_VERSION="8.4"
success_count=0
total_count=0
website_count=0
SETUP_STATE_DIR="$HOME/.domain_setup_state"
LOCAL_DOMAINS_FILE="$SETUP_STATE_DIR/local_domains.txt"
HOSTS_MANAGER_SCRIPT="$PARENT_DIR_LEVEL_1/debian_com/hosts_manager.sh"

echo "[$SCRIPT_INDEX] Domain Setup - API Domains Configuration"

# Function to load state
load_state() {
    local key="$1"

    if [ -f "$SETUP_STATE_DIR/$key" ]; then
        cat "$SETUP_STATE_DIR/$key"
    fi
}

# Function to check if state exists
check_state() {
    if [ ! -d "$SETUP_STATE_DIR" ]; then
        echo "[$SCRIPT_INDEX] ERROR: Setup state not found"
        echo "[$SCRIPT_INDEX] Please run 131_prepare_domain_setup.sh first"
        return 1
    fi

    return 0
}

# Function to get Laravel directory path
get_laravel_dir() {
    if [ -z "$CORE_NODE_DIR" ]; then
        local script_root="$(cd "$PARENT_DIR_LEVEL_2/../.." && pwd)"
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

# Function to get domains list
get_domains_list() {
    if [ -n "$DOMAINS_LISTS_CONTENT" ]; then
        echo "$DOMAINS_LISTS_CONTENT" | tr -d '\r' | sed '/^$/d'
    else
        echo ""
    fi
}

# Function to collect local domains from API domains
collect_local_domains() {
    local domains_content="$1"
    local prefixes="$2"
    
    # Clear previous local domains list
    > "$LOCAL_DOMAINS_FILE"
    
    # Parse prefixes
    IFS=',' read -ra PREFIX_ARRAY <<< "$prefixes"
    
    # Process each domain
    while read -r domain; do
        if [ -n "$domain" ]; then
            # Process each prefix to generate local API domains
            for prefix in "${PREFIX_ARRAY[@]}"; do
                if [ "$prefix" = "api" ]; then
                    # api.domain.com -> local.api.domain.com
                    echo "local.api.$domain" >> "$LOCAL_DOMAINS_FILE"
                else
                    # prefix.api.domain.com -> local.prefix.api.domain.com
                    echo "local.$prefix.api.$domain" >> "$LOCAL_DOMAINS_FILE"
                fi
            done
        fi
    done <<< "$domains_content"
    
    # Remove duplicates and sort
    if [ -f "$LOCAL_DOMAINS_FILE" ]; then
        sort -u "$LOCAL_DOMAINS_FILE" -o "$LOCAL_DOMAINS_FILE"
    fi
}

# Function to update hosts file with local domains using hosts_manager.sh
update_hosts_file() {
    if [ ! -f "$LOCAL_DOMAINS_FILE" ]; then
        echo "[$SCRIPT_INDEX] No local domains file found, skipping hosts update"
        return 0
    fi
    
    local domain_count=0
    if [ -s "$LOCAL_DOMAINS_FILE" ]; then
        domain_count=$(wc -l < "$LOCAL_DOMAINS_FILE" | tr -d ' ')
    fi
    
    if [ "$domain_count" -eq 0 ]; then
        echo "[$SCRIPT_INDEX] No local domains to add to hosts file"
        return 0
    fi
    
    # Check if hosts_manager.sh exists
    if [ ! -f "$HOSTS_MANAGER_SCRIPT" ]; then
        echo "[$SCRIPT_INDEX] WARNING: hosts_manager.sh not found at $HOSTS_MANAGER_SCRIPT"
        echo "[$SCRIPT_INDEX] Skipping hosts file update"
        return 1
    fi
    
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] UPDATING /etc/hosts FOR LOCAL TESTING"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] Found $domain_count local domain(s) to process"
    echo "[$SCRIPT_INDEX] Note: These are local test domains pointing to 127.0.0.1"
    echo "[$SCRIPT_INDEX]"
    
    # Collect all domains into a single string for batch operation
    local domains_list=""
    while IFS= read -r domain || [ -n "$domain" ]; do
        if [ -n "$domain" ]; then
            if [ -z "$domains_list" ]; then
                domains_list="$domain"
            else
                domains_list="$domains_list $domain"
            fi
        fi
    done < "$LOCAL_DOMAINS_FILE"
    
    # Use hosts_manager.sh to add domains in batch
    if [ -n "$domains_list" ]; then
        echo "[$SCRIPT_INDEX] Using hosts_manager.sh to update hosts file..."
        if bash "$HOSTS_MANAGER_SCRIPT" add-batch $domains_list 2>&1 | while IFS= read -r line; do
            echo "[$SCRIPT_INDEX]   $line"
        done; then
            echo "[$SCRIPT_INDEX] Hosts file updated successfully"
        else
            echo "[$SCRIPT_INDEX] WARNING: Some domains may not have been added to hosts file"
        fi
    fi
    
    echo "[$SCRIPT_INDEX] =================================="
    
    # Print Windows hosts file modification instructions
    if [ "$domain_count" -gt 0 ]; then
        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] WINDOWS HOSTS FILE MODIFICATION"
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] To test on Windows, add the following to C:\\Windows\\System32\\drivers\\etc\\hosts:"
        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] Steps:"
        echo "[$SCRIPT_INDEX]   1. Open Notepad as Administrator"
        echo "[$SCRIPT_INDEX]   2. Open file: C:\\Windows\\System32\\drivers\\etc\\hosts"
        echo "[$SCRIPT_INDEX]   3. Add the following lines at the end:"
        echo "[$SCRIPT_INDEX]"
        
        while IFS= read -r domain || [ -n "$domain" ]; do
            if [ -n "$domain" ]; then
                echo "[$SCRIPT_INDEX]      127.0.0.1    $domain"
            fi
        done < "$LOCAL_DOMAINS_FILE"
        
        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX]   4. Save the file"
        echo "[$SCRIPT_INDEX]   5. Flush DNS cache: ipconfig /flushdns"
        echo "[$SCRIPT_INDEX] =================================="
    fi
}

# Function to check SSL certificate status
check_ssl_status() {
    local domain="$1"

    cd "$laravel_dir" || return 1

    local cert_output
    cert_output=$($USE_SUDO php artisan servermanager:certificate find "$domain" 2>&1)

    if echo "$cert_output" | grep -q "Found certificate"; then
        local expires_line
        expires_line=$(echo "$cert_output" | grep "Expires:" || echo "Expires: unknown")
        echo "[EXISTS] $expires_line"
        return 0
    else
        echo "[NOT FOUND] No certificate found for domain"
        return 1
    fi
}

# Function to add API website
add_api_website() {
    local api_domain="$1"

    echo "[$SCRIPT_INDEX]   Processing API website: $api_domain"
    echo "[$SCRIPT_INDEX]   Type: poly (Laravel main project)"
    echo "[$SCRIPT_INDEX]   PHP Mode: swoole (Octane)"

    # IDEMPOTENCY CHECK: Check SSL certificate status before adding domain
    echo "[$SCRIPT_INDEX]   [SSL CHECK] Verifying certificate status..."
    local ssl_status
    ssl_status=$(check_ssl_status "$api_domain")
    echo "[$SCRIPT_INDEX]   [SSL STATUS] $ssl_status"

    # Add or update domain (Laravel handles idempotency automatically)
    # If domain exists: Laravel will update configuration (e.g., switch from FPM to Swoole)
    # If domain doesn't exist: Laravel will create new configuration
    # SSL certificates are reused if valid (not regenerated)
    
    # Use unified Laravel service manager if available
    if [ -f "$LARAVEL_SERVICE_MANAGER" ] && command -v add_laravel_website >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX]   Using unified Laravel service manager (poly app method)"
        echo "[$SCRIPT_INDEX]   Executing: add_laravel_website \"$api_domain\" \"auto\""
        
        local output
        output=$(add_laravel_website "$api_domain" "auto" 2>&1)
        local result=$?
    else
        echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO php artisan servermanager:website add \"$api_domain\" --type=poly --ssl=auto --php-mode=swoole"
        
        local output
        output=$($USE_SUDO php artisan servermanager:website add "$api_domain" --type=poly --ssl=auto --php-mode=swoole 2>&1)
        local result=$?
    fi

    echo "[$SCRIPT_INDEX]   Result:"
    echo "$output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]     $line"
    done

    # POST-VERIFICATION: Check SSL certificate status after domain addition
    echo "[$SCRIPT_INDEX]   [SSL VERIFY] Post-addition certificate status..."
    ssl_status=$(check_ssl_status "$api_domain")
    echo "[$SCRIPT_INDEX]   [SSL FINAL] $ssl_status"

    return $result
}

# Function to setup API domains for a domain
setup_api_domains() {
    local domain="$1"
    local prefixes="$2"

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] Setting up API domains for: $domain"
    echo "[$SCRIPT_INDEX] Prefixes: $prefixes"
    echo "[$SCRIPT_INDEX] =================================="

    # Change to Laravel directory
    cd "$laravel_dir" || {
        echo "[$SCRIPT_INDEX] Error: Failed to change to Laravel directory"
        return 1
    }

    # Parse selected prefixes
    IFS=',' read -ra PREFIX_ARRAY <<< "$prefixes"

    local domain_success=true
    local websites_added=0

    # Process each prefix
    for prefix in "${PREFIX_ARRAY[@]}"; do
        if [ "$prefix" = "api" ]; then
            # Create api.domain.com (Poly - API endpoint)
            echo "[$SCRIPT_INDEX]"
            echo "[$SCRIPT_INDEX] [API] api.$domain"

            if add_api_website "api.$domain"; then
                websites_added=$((websites_added + 1))
                echo "[$SCRIPT_INDEX]   [OK] Successfully added: api.$domain"
            else
                echo "[$SCRIPT_INDEX]   [FAIL] Failed to add: api.$domain"
                domain_success=false
            fi
        else
            # Create prefix.api.domain.com (Poly - API endpoint for this prefix)
            echo "[$SCRIPT_INDEX]"
            echo "[$SCRIPT_INDEX] [API] $prefix.api.$domain"

            if add_api_website "$prefix.api.$domain"; then
                websites_added=$((websites_added + 1))
                echo "[$SCRIPT_INDEX]   [OK] Successfully added: $prefix.api.$domain"
            else
                echo "[$SCRIPT_INDEX]   [FAIL] Failed to add: $prefix.api.$domain"
                domain_success=false
            fi
        fi
    done

    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Summary for $domain:"
    echo "[$SCRIPT_INDEX]   API websites added: $websites_added"

    if [ "$domain_success" = true ]; then
        return 0
    else
        return 1
    fi
}

# Main execution
echo "[$SCRIPT_INDEX] Starting API domains setup..."

# Check if preparation was run
if ! check_state; then
    exit 1
fi

# Load state from previous scripts
SELECTED_PREFIXES=$(load_state "SELECTED_PREFIXES")
DOMAINS_LISTS_CONTENT=$(load_state "DOMAINS_LISTS_CONTENT")
PHP_VERSION=$(load_state "PHP_VERSION")

if [ -z "$SELECTED_PREFIXES" ]; then
    echo "[$SCRIPT_INDEX] ERROR: SELECTED_PREFIXES not found in state"
    echo "[$SCRIPT_INDEX] Please run 131_prepare_domain_setup.sh first"
    exit 1
fi

if [ -z "$DOMAINS_LISTS_CONTENT" ]; then
    echo "[$SCRIPT_INDEX] ERROR: DOMAINS_LISTS_CONTENT not found in state"
    echo "[$SCRIPT_INDEX] Please run 131_prepare_domain_setup.sh first"
    exit 1
fi

if [ -z "$PHP_VERSION" ]; then
    PHP_VERSION="8.4"
    echo "[$SCRIPT_INDEX] WARNING: PHP_VERSION not found in state, using default: $PHP_VERSION"
fi

# Get Laravel directory
laravel_dir=$(get_laravel_dir)
if [ -z "$laravel_dir" ]; then
    echo "[$SCRIPT_INDEX] ERROR: Failed to get Laravel directory"
    exit 1
fi

echo "[$SCRIPT_INDEX] Configuration:"
echo "[$SCRIPT_INDEX]   Laravel directory: $laravel_dir"
echo "[$SCRIPT_INDEX]   Selected prefixes: $SELECTED_PREFIXES"
echo "[$SCRIPT_INDEX]   PHP version: $PHP_VERSION"
echo "[$SCRIPT_INDEX]   Website type: poly (Laravel main project)"
echo "[$SCRIPT_INDEX]"

# Calculate how many API websites will be created
IFS=',' read -ra PREFIX_ARRAY <<< "$SELECTED_PREFIXES"
api_count=0
for prefix in "${PREFIX_ARRAY[@]}"; do
    if [ "$prefix" = "api" ]; then
        api_count=$((api_count + 1))  # api.domain.com
    else
        api_count=$((api_count + 1))  # prefix.api.domain.com
    fi
done

# Get domains list
domains_content=$(get_domains_list)
if [ -z "$domains_content" ]; then
    echo "[$SCRIPT_INDEX] No domains to configure. Exiting."
    exit 1
fi

domain_count=$(echo "$domains_content" | grep -c .)
total_api_websites=$((domain_count * api_count))

echo "[$SCRIPT_INDEX] Domains to process:"
echo "$domains_content" | while read -r domain; do
    if [ -n "$domain" ]; then
        echo "[$SCRIPT_INDEX]   - $domain"
    fi
done
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] API websites to create: $total_api_websites ($api_count per domain x $domain_count domains)"
echo "[$SCRIPT_INDEX]"

# Ask user for confirmation
echo "[$SCRIPT_INDEX] This will add all API domains (poly type) for Laravel main project"
echo "[$SCRIPT_INDEX] Document root: $laravel_dir/public"
echo ""
read -p "[$SCRIPT_INDEX] Continue with API domains setup? (Y/n): " confirm

# Default to yes if empty or Enter pressed
if [ -z "$confirm" ] || [[ "$confirm" =~ ^[Yy]$ ]]; then
    # Continue with API domains setup
    :
else
    echo "[$SCRIPT_INDEX] API domains setup cancelled by user"
    exit 0
fi

# Process each domain
echo ""
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] PROCESSING DOMAINS"
echo "[$SCRIPT_INDEX] =================================="

# Collect local domains before processing
collect_local_domains "$domains_content" "$SELECTED_PREFIXES"

while read -r domain; do
    if [ -n "$domain" ]; then
        total_count=$((total_count + 1))

        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] [$total_count/$domain_count] Processing: $domain"

        if setup_api_domains "$domain" "$SELECTED_PREFIXES"; then
            success_count=$((success_count + 1))
            echo "[$SCRIPT_INDEX] [OK] Successfully configured: $domain"
        else
            echo "[$SCRIPT_INDEX] [WARN] Failed to configure: $domain"
        fi

        echo "[$SCRIPT_INDEX] ---"
    fi
done <<< "$domains_content"

# Print summary
echo ""
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] API DOMAINS SETUP SUMMARY"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] Successfully configured: $success_count/$total_count domains"
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] Websites Summary:"
cd "$laravel_dir"
echo "[$SCRIPT_INDEX] Executing: $USE_SUDO php artisan servermanager:website summary"
$USE_SUDO php artisan servermanager:website summary 2>/dev/null | while IFS= read -r line; do
    echo "[$SCRIPT_INDEX]   $line"
done
echo "[$SCRIPT_INDEX] =================================="

# Update hosts file for local domains
update_hosts_file

# Offer to install Laravel Octane File Watcher Daemon
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] OCTANE FILE WATCHER DAEMON"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] The Octane File Watcher automatically restarts Octane services"
echo "[$SCRIPT_INDEX] when Laravel files change. This is useful for active development."
echo "[$SCRIPT_INDEX]"

# Detect environment type
is_wsl=false
is_desktop=false

if grep -qi microsoft /proc/version 2>/dev/null; then
    is_wsl=true
    echo "[$SCRIPT_INDEX] Environment detected: WSL (Windows Subsystem for Linux)"
elif [ -n "$DESKTOP_SESSION" ] || [ -n "$XDG_CURRENT_DESKTOP" ]; then
    is_desktop=true
    echo "[$SCRIPT_INDEX] Environment detected: Desktop Linux"
else
    echo "[$SCRIPT_INDEX] Environment detected: Server Linux"
fi

echo "[$SCRIPT_INDEX]"

# Default answer based on environment
if [ "$is_wsl" = true ] || [ "$is_desktop" = true ]; then
    default_install="Y"
    prompt_text="[$SCRIPT_INDEX] Install Octane File Watcher Daemon? (Y/n): "
else
    default_install="N"
    prompt_text="[$SCRIPT_INDEX] Install Octane File Watcher Daemon? (y/N): "
fi

read -p "$prompt_text" install_watcher

# Normalize answer
if [ -z "$install_watcher" ]; then
    install_watcher="$default_install"
fi

if [[ "$install_watcher" =~ ^[Yy]$ ]]; then
    echo "[$SCRIPT_INDEX] Installing Laravel Octane File Watcher..."
    echo "[$SCRIPT_INDEX]"

    watcher_install_script="$INSTALL_SHELLS_DIR/151_install_octane_watcher_daemon.sh"

    if [ -f "$watcher_install_script" ]; then
        bash "$watcher_install_script"

        if [ $? -eq 0 ]; then
            echo "[$SCRIPT_INDEX]"
            echo "[$SCRIPT_INDEX] ??Octane File Watcher installed successfully"
        else
            echo "[$SCRIPT_INDEX]"
            echo "[$SCRIPT_INDEX] ??Octane File Watcher installation failed"
        fi
    else
        echo "[$SCRIPT_INDEX] Error: Watcher installation script not found"
        echo "[$SCRIPT_INDEX]   Expected: $watcher_install_script"
    fi
else
    echo "[$SCRIPT_INDEX] Skipping Octane File Watcher installation"
    echo "[$SCRIPT_INDEX] You can install it later by running:"
    echo "[$SCRIPT_INDEX]   bash $INSTALL_SHELLS_DIR/151_install_octane_watcher_daemon.sh"
fi

echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] Next Steps:"
echo "[$SCRIPT_INDEX]   1. Run 134_setup_html_domains.sh to setup HTML domains"
echo "[$SCRIPT_INDEX]   2. Restart nginx to apply changes: sudo systemctl restart nginx"
echo "[$SCRIPT_INDEX]   3. Check nginx status: sudo systemctl status nginx"
echo "[$SCRIPT_INDEX]   4. Test local domains using the hosts file entries above"
echo "[$SCRIPT_INDEX] =================================="

if [ $success_count -eq $total_count ] && [ $total_count -gt 0 ]; then
    echo "[$SCRIPT_INDEX] All API domains configured successfully!"
    exit 0
else
    echo "[$SCRIPT_INDEX] Some API domains failed to configure. Check the logs above."
    exit 1
fi
