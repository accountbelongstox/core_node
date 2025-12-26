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
# Required for SSL certificate installation and nginx configuration
if [ "$EUID" -ne 0 ] && [ -z "$SUDO_USER" ]; then
    echo "Error: This script must be run as root or with sudo"
    echo "Usage: sudo $0"
    exit 1
fi

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="132"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Variable declarations
laravel_dir=""
SELECTED_PREFIXES=""
DOMAINS_LISTS_CONTENT=""
DNSPOD_EMAIL=""
DNSPOD_API_TOKEN=""
success_count=0
total_count=0
SETUP_STATE_DIR="$HOME/.domain_setup_state"

echo "[$SCRIPT_INDEX] Domain Setup - SSL Certificate Configuration"

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

# Function to setup SSL certificate for domain
setup_ssl_certificate() {
    local domain="$1"
    local cert_prefixes="$2"

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] Setting up SSL certificate for: $domain"
    echo "[$SCRIPT_INDEX] Prefixes: $cert_prefixes"
    echo "[$SCRIPT_INDEX] =================================="

    # Change to Laravel directory
    cd "$laravel_dir" || {
        echo "[$SCRIPT_INDEX] Error: Failed to change to Laravel directory"
        return 1
    }

    # PRE-CHECK: Check existing certificate status (IDEMPOTENCY)
    echo "[$SCRIPT_INDEX] [IDEMPOTENT] Checking existing certificate status..."
    local pre_cert_output
    pre_cert_output=$($USE_SUDO php artisan servermanager:certificate find "$domain" 2>&1)

    if echo "$pre_cert_output" | grep -q "Found certificate"; then
        echo "[$SCRIPT_INDEX] [CERTIFICATE EXISTS] Certificate already exists for: $domain"
        echo "[$SCRIPT_INDEX] Certificate details:"
        echo "$pre_cert_output" | while IFS= read -r line; do
            echo "[$SCRIPT_INDEX]   $line"
        done

        # Check expiry status
        if echo "$pre_cert_output" | grep -q "Expires:"; then
            local expires_info
            expires_info=$(echo "$pre_cert_output" | grep "Expires:")
            echo "[$SCRIPT_INDEX] [EXPIRY CHECK] $expires_info"
        fi
    else
        echo "[$SCRIPT_INDEX] [NEW CERTIFICATE] No existing certificate found for: $domain"
    fi

    # Add/Update SSL certificate with selected prefixes
    # Laravel's certificate command handles:
    # - Duplicate detection (won't recreate if already exists and valid)
    # - Automatic certificate renewal (updates expiring/expired certificates)
    # - Idempotent behavior (safe to run multiple times)
    # Certificates naturally expire and are auto-renewed when needed

    # Debug: Show environment variables before executing
    echo "[$SCRIPT_INDEX] [DEBUG] Environment check before certificate command:"
    echo "[$SCRIPT_INDEX] [DEBUG]   DNSPOD_EMAIL in env: ${DNSPOD_EMAIL:-NOT SET}"
    echo "[$SCRIPT_INDEX] [DEBUG]   DNSPOD_API_TOKEN in env: ${DNSPOD_API_TOKEN:+SET (${#DNSPOD_API_TOKEN} chars)}"

    echo "[$SCRIPT_INDEX] Executing: $USE_SUDO php artisan servermanager:certificate add \"$domain\" --prefixes=$cert_prefixes --provider=dnspod"

    local ssl_output
    ssl_output=$($USE_SUDO php artisan servermanager:certificate add "$domain" --prefixes="$cert_prefixes" --provider=dnspod 2>&1)
    local ssl_result=$?

    echo "[$SCRIPT_INDEX] SSL certificate result:"
    echo "$ssl_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    # POST-VERIFICATION: Check certificate status after operation
    echo "[$SCRIPT_INDEX] [POST-VERIFY] Verifying certificate status after operation..."
    local post_cert_output
    post_cert_output=$($USE_SUDO php artisan servermanager:certificate find "$domain" 2>&1)

    if echo "$post_cert_output" | grep -q "Found certificate"; then
        echo "[$SCRIPT_INDEX] [VERIFICATION OK] Certificate verified for: $domain"
        if echo "$post_cert_output" | grep -q "Expires:"; then
            local final_expires
            final_expires=$(echo "$post_cert_output" | grep "Expires:")
            echo "[$SCRIPT_INDEX] [FINAL STATUS] $final_expires"
        fi
    else
        echo "[$SCRIPT_INDEX] [VERIFICATION FAILED] Certificate not found after operation"
    fi

    if [ $ssl_result -eq 0 ]; then
        echo "[$SCRIPT_INDEX] [OK] SSL certificate processed successfully for: $domain"
        return 0
    else
        echo "[$SCRIPT_INDEX] [WARN] SSL certificate setup failed for: $domain"
        echo "[$SCRIPT_INDEX] Continuing anyway (websites can be added without SSL)"
        return 0  # Don't fail completely, allow HTTP-only setup
    fi
}

# Main execution
echo "[$SCRIPT_INDEX] Starting SSL certificate setup..."

# Check if preparation was run
if ! check_state; then
    exit 1
fi

# Load state from previous script
SELECTED_PREFIXES=$(load_state "SELECTED_PREFIXES")
DOMAINS_LISTS_CONTENT=$(load_state "DOMAINS_LISTS_CONTENT")
DNSPOD_EMAIL=$(load_state "DNSPOD_EMAIL")
DNSPOD_API_TOKEN=$(load_state "DNSPOD_API_TOKEN")

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

# Debug: Print DNSPod credentials status
echo "[$SCRIPT_INDEX] [DEBUG] DNSPod Credentials Status:"
if [ -n "$DNSPOD_EMAIL" ]; then
    echo "[$SCRIPT_INDEX] [DEBUG]   DNSPOD_EMAIL: $DNSPOD_EMAIL"
else
    echo "[$SCRIPT_INDEX] [DEBUG]   DNSPOD_EMAIL: NOT LOADED"
fi

if [ -n "$DNSPOD_API_TOKEN" ]; then
    echo "[$SCRIPT_INDEX] [DEBUG]   DNSPOD_API_TOKEN: ${DNSPOD_API_TOKEN:0:20}... (length: ${#DNSPOD_API_TOKEN} chars)"
else
    echo "[$SCRIPT_INDEX] [DEBUG]   DNSPOD_API_TOKEN: NOT LOADED"
fi

# Export DNSPod credentials as environment variables for Laravel
if [ -n "$DNSPOD_EMAIL" ]; then
    export DNSPOD_EMAIL
    echo "[$SCRIPT_INDEX] [DEBUG] Exported DNSPOD_EMAIL to environment"
fi

if [ -n "$DNSPOD_API_TOKEN" ]; then
    export DNSPOD_API_TOKEN
    echo "[$SCRIPT_INDEX] [DEBUG] Exported DNSPOD_API_TOKEN to environment"
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
echo "[$SCRIPT_INDEX]   Certificate management: Automatic renewal for expired/expiring certs"
echo "[$SCRIPT_INDEX]"

# Get domains list
domains_content=$(get_domains_list)
if [ -z "$domains_content" ]; then
    echo "[$SCRIPT_INDEX] No domains to configure. Exiting."
    exit 1
fi

echo "[$SCRIPT_INDEX] Domains to process:"
echo "$domains_content" | while read -r domain; do
    if [ -n "$domain" ]; then
        echo "[$SCRIPT_INDEX]   - $domain"
    fi
done
echo "[$SCRIPT_INDEX]"

# Ask user for confirmation
echo "[$SCRIPT_INDEX] This will add SSL certificates for all domains listed above"
echo "[$SCRIPT_INDEX] Using DNS provider: DNSPod"
echo "[$SCRIPT_INDEX] Using prefixes: $SELECTED_PREFIXES"
echo ""
read -p "[$SCRIPT_INDEX] Continue with SSL certificate setup? (Y/n): " confirm

# Default to yes if empty or Enter pressed
if [ -z "$confirm" ] || [[ "$confirm" =~ ^[Yy]$ ]]; then
    # Continue with SSL setup
    :
else
    echo "[$SCRIPT_INDEX] SSL setup cancelled by user"
    exit 0
fi

# Process each domain
echo ""
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] PROCESSING DOMAINS"
echo "[$SCRIPT_INDEX] =================================="

while read -r domain; do
    if [ -n "$domain" ]; then
        total_count=$((total_count + 1))

        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] [$total_count] Processing: $domain"

        if setup_ssl_certificate "$domain" "$SELECTED_PREFIXES"; then
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
echo "[$SCRIPT_INDEX] SSL SETUP SUMMARY"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] Successfully configured: $success_count/$total_count domains"
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] Certificate Summary:"
cd "$laravel_dir"
echo "[$SCRIPT_INDEX] Executing: $USE_SUDO php artisan servermanager:certificate summary"
$USE_SUDO php artisan servermanager:certificate summary 2>/dev/null | while IFS= read -r line; do
    echo "[$SCRIPT_INDEX]   $line"
done
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] Next Steps:"
echo "[$SCRIPT_INDEX]   1. Run 133_setup_api_domains.sh to setup API domains"
echo "[$SCRIPT_INDEX]   2. Run 134_setup_html_domains.sh to setup HTML domains"
echo "[$SCRIPT_INDEX] =================================="

if [ $success_count -eq $total_count ] && [ $total_count -gt 0 ]; then
    echo "[$SCRIPT_INDEX] All SSL certificates configured successfully!"
    exit 0
else
    echo "[$SCRIPT_INDEX] Some SSL certificates failed to configure"
    echo "[$SCRIPT_INDEX] You can still proceed with HTTP-only websites"
    exit 0
fi
