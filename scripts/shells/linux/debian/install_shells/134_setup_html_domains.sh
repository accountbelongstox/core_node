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
# Required for HTML domain setup and nginx configuration
if [ "$EUID" -ne 0 ] && [ -z "$SUDO_USER" ]; then
    echo "Error: This script must be run as root or with sudo"
    echo "Usage: sudo $0"
    exit 1
fi

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="134"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Variable declarations
laravel_dir=""
SELECTED_PREFIXES=""
DOMAINS_LISTS_CONTENT=""
PHP_VERSION="8.4"
success_count=0
total_count=0
website_count=0
SETUP_STATE_DIR="$HOME/.domain_setup_state"
LOCAL_DOMAINS_FILE="$SETUP_STATE_DIR/local_html_domains.txt"
HOSTS_MANAGER_SCRIPT="$PARENT_DIR_LEVEL_1/debian_com/hosts_manager.sh"

echo "[$SCRIPT_INDEX] Domain Setup - HTML Domains Configuration"

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

# Function to collect local HTML domains
collect_local_html_domains() {
    local domains_content="$1"
    local prefixes="$2"
    
    # Clear previous local domains list
    > "$LOCAL_DOMAINS_FILE"
    
    # Parse prefixes
    IFS=',' read -ra PREFIX_ARRAY <<< "$prefixes"
    
    # Process each domain
    while read -r domain; do
        if [ -n "$domain" ]; then
            # Process each prefix (skip 'api' as it's handled by 133_setup_api_domains.sh)
            for prefix in "${PREFIX_ARRAY[@]}"; do
                if [ "$prefix" != "api" ]; then
                    # prefix.domain.com -> local.prefix.domain.com
                    echo "local.$prefix.$domain" >> "$LOCAL_DOMAINS_FILE"
                fi
            done
        fi
    done <<< "$domains_content"
    
    # Remove duplicates and sort
    if [ -f "$LOCAL_DOMAINS_FILE" ]; then
        sort -u "$LOCAL_DOMAINS_FILE" -o "$LOCAL_DOMAINS_FILE"
    fi
}

# Function to update hosts file with local HTML domains using hosts_manager.sh
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
    echo "[$SCRIPT_INDEX] Found $domain_count local HTML domain(s) to process"
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

# Function to check if domain exists
check_domain_exists() {
    local domain="$1"

    cd "$laravel_dir" || return 1

    local check_output
    check_output=$($USE_SUDO php artisan servermanager:website list 2>&1)

    if echo "$check_output" | grep -q "Website: $domain"; then
        return 0
    else
        return 1
    fi
}

# Function to add HTML website
add_html_website() {
    local html_domain="$1"

    echo "[$SCRIPT_INDEX]   Processing HTML website: $html_domain"
    echo "[$SCRIPT_INDEX]   Type: html (static content)"

    if check_domain_exists "$html_domain"; then
        echo "[$SCRIPT_INDEX]   [EXISTS] Domain already configured: $html_domain"
        echo "[$SCRIPT_INDEX]   [IDEMPOTENT] Skipping addition (configuration preserved)"
        return 0
    fi

    echo "[$SCRIPT_INDEX]   Executing: $USE_SUDO php artisan servermanager:website add \"$html_domain\" --type=html --ssl=auto --php-version=$PHP_VERSION"

    local output
    output=$($USE_SUDO php artisan servermanager:website add "$html_domain" --type=html --ssl=auto --php-version=$PHP_VERSION 2>&1)
    local result=$?

    echo "[$SCRIPT_INDEX]   Result:"
    echo "$output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]     $line"
    done

    return $result
}

# Function to setup HTML domains for a domain
setup_html_domains() {
    local domain="$1"
    local prefixes="$2"

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] Setting up HTML domains for: $domain"
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

    # Process each prefix (skip 'api' as it's handled by 133_setup_api_domains.sh)
    for prefix in "${PREFIX_ARRAY[@]}"; do
        if [ "$prefix" = "api" ]; then
            # Skip api prefix - it's handled by 133_setup_api_domains.sh
            echo "[$SCRIPT_INDEX]"
            echo "[$SCRIPT_INDEX] [SKIP] api.$domain (handled by 133_setup_api_domains.sh)"
            continue
        fi

        # Create prefix.domain.com (HTML - static content)
        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] [HTML] $prefix.$domain"

        if add_html_website "$prefix.$domain"; then
            websites_added=$((websites_added + 1))
            echo "[$SCRIPT_INDEX]   [OK] Successfully added: $prefix.$domain"
        else
            echo "[$SCRIPT_INDEX]   [FAIL] Failed to add: $prefix.$domain"
            domain_success=false
        fi
    done

    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Summary for $domain:"
    echo "[$SCRIPT_INDEX]   HTML websites added: $websites_added"

    if [ "$domain_success" = true ]; then
        return 0
    else
        return 1
    fi
}

# Main execution
echo "[$SCRIPT_INDEX] Starting HTML domains setup..."

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
echo "[$SCRIPT_INDEX]   Website type: html (static content)"
echo "[$SCRIPT_INDEX]"

# Calculate how many HTML websites will be created
IFS=',' read -ra PREFIX_ARRAY <<< "$SELECTED_PREFIXES"
html_count=0
for prefix in "${PREFIX_ARRAY[@]}"; do
    if [ "$prefix" != "api" ]; then
        html_count=$((html_count + 1))  # prefix.domain.com
    fi
done

# Get domains list
domains_content=$(get_domains_list)
if [ -z "$domains_content" ]; then
    echo "[$SCRIPT_INDEX] No domains to configure. Exiting."
    exit 1
fi

domain_count=$(echo "$domains_content" | grep -c .)
total_html_websites=$((domain_count * html_count))

echo "[$SCRIPT_INDEX] Domains to process:"
echo "$domains_content" | while read -r domain; do
    if [ -n "$domain" ]; then
        echo "[$SCRIPT_INDEX]   - $domain"
    fi
done
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] HTML websites to create: $total_html_websites ($html_count per domain × $domain_count domains)"
echo "[$SCRIPT_INDEX]"

# Show what will be created
echo "[$SCRIPT_INDEX] Website structure per domain:"
for prefix in "${PREFIX_ARRAY[@]}"; do
    if [ "$prefix" != "api" ]; then
        echo "[$SCRIPT_INDEX]   - $prefix.domain.com (HTML, static content)"
    fi
done
echo "[$SCRIPT_INDEX]"

# Ask user for confirmation
echo "[$SCRIPT_INDEX] This will add all HTML domains (html type) for static content"
echo "[$SCRIPT_INDEX] Each domain will have its own directory under /www/wwwroot/"
echo ""
read -p "[$SCRIPT_INDEX] Continue with HTML domains setup? (Y/n): " confirm

# Default to yes if empty or Enter pressed
if [ -z "$confirm" ] || [[ "$confirm" =~ ^[Yy]$ ]]; then
    # Continue with HTML domains setup
    :
else
    echo "[$SCRIPT_INDEX] HTML domains setup cancelled by user"
    exit 0
fi

# Collect local HTML domains before processing
collect_local_html_domains "$domains_content" "$SELECTED_PREFIXES"

# Process each domain
echo ""
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] PROCESSING DOMAINS"
echo "[$SCRIPT_INDEX] =================================="

while read -r domain; do
    if [ -n "$domain" ]; then
        total_count=$((total_count + 1))

        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] [$total_count/$domain_count] Processing: $domain"

        if setup_html_domains "$domain" "$SELECTED_PREFIXES"; then
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
echo "[$SCRIPT_INDEX] HTML DOMAINS SETUP SUMMARY"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] Successfully configured: $success_count/$total_count domains"
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] Complete Websites Summary:"
cd "$laravel_dir"
echo "[$SCRIPT_INDEX] Executing: $USE_SUDO php artisan servermanager:website summary"
$USE_SUDO php artisan servermanager:website summary 2>/dev/null | while IFS= read -r line; do
    echo "[$SCRIPT_INDEX]   $line"
done
echo "[$SCRIPT_INDEX] =================================="

# Update hosts file for local HTML domains
update_hosts_file

echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] IMPORTANT NEXT STEPS:"
echo "[$SCRIPT_INDEX]   1. Test nginx configuration: sudo nginx -t"
echo "[$SCRIPT_INDEX]   2. Restart nginx to apply changes: sudo systemctl restart nginx"
echo "[$SCRIPT_INDEX]   3. Check nginx status: sudo systemctl status nginx"
echo "[$SCRIPT_INDEX]   4. View all websites: php artisan servermanager:website list"
echo "[$SCRIPT_INDEX]   5. Test local domains using the hosts file entries above"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] To access your websites:"
echo "[$SCRIPT_INDEX]   - Local domains have been added to /etc/hosts for testing"
echo "[$SCRIPT_INDEX]   - Configure DNS records to point to your server for production"
echo "[$SCRIPT_INDEX] =================================="

if [ $success_count -eq $total_count ] && [ $total_count -gt 0 ]; then
    echo "[$SCRIPT_INDEX] All HTML domains configured successfully!"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Domain setup is complete!"
    echo "[$SCRIPT_INDEX] All websites (API + HTML) have been configured."
    exit 0
else
    echo "[$SCRIPT_INDEX] Some HTML domains failed to configure. Check the logs above."
    exit 1
fi
