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
# Required for certificate renewal and nginx reload
if [ "$EUID" -ne 0 ] && [ -z "$SUDO_USER" ]; then
    echo "Error: This script must be run as root or with sudo"
    echo "Usage: sudo $0"
    exit 1
fi

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="135"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] Certificate Renewal - Batch Update"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] This script will:"
echo "[$SCRIPT_INDEX]   1. Check all existing certificates"
echo "[$SCRIPT_INDEX]   2. Renew certificates expiring within 30 days"
echo "[$SCRIPT_INDEX]   3. Reload nginx to apply changes"
echo "[$SCRIPT_INDEX]"

# Get Laravel directory
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

laravel_dir=$(get_laravel_dir)
if [ -z "$laravel_dir" ]; then
    echo "[$SCRIPT_INDEX] ERROR: Failed to get Laravel directory"
    exit 1
fi

# Show current certificate status
echo "[$SCRIPT_INDEX] Current Certificate Status:"
echo "[$SCRIPT_INDEX] =================================="
cd "$laravel_dir"
$USE_SUDO php artisan servermanager:certificate summary 2>&1 | while IFS= read -r line; do
    echo "[$SCRIPT_INDEX]   $line"
done
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX]"

# Ask for confirmation
read -p "[$SCRIPT_INDEX] Proceed with certificate renewal? (Y/n): " confirm

if [ -z "$confirm" ] || [[ "$confirm" =~ ^[Yy]$ ]]; then
    echo "[$SCRIPT_INDEX] Starting certificate renewal..."
else
    echo "[$SCRIPT_INDEX] Certificate renewal cancelled by user"
    exit 0
fi

# Get Let's Encrypt directory
letsencrypt_dir="/www/letsencrypt"
if [ ! -d "$letsencrypt_dir" ]; then
    echo "[$SCRIPT_INDEX] ERROR: Let's Encrypt directory not found: $letsencrypt_dir"
    echo "[$SCRIPT_INDEX] No certificates to renew"
    exit 1
fi

echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] RENEWING CERTIFICATES"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] Using certbot renew command..."
echo "[$SCRIPT_INDEX] Let's Encrypt directory: $letsencrypt_dir"
echo "[$SCRIPT_INDEX]"

# Run certbot renew with custom directories
$USE_SUDO certbot renew \
    --config-dir "$letsencrypt_dir" \
    --work-dir "$letsencrypt_dir/work" \
    --logs-dir "$letsencrypt_dir/logs" \
    --quiet \
    --no-random-sleep-on-renew

renew_result=$?

echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] =================================="
if [ $renew_result -eq 0 ]; then
    echo "[$SCRIPT_INDEX] [OK] Certificate renewal completed"
    echo "[$SCRIPT_INDEX] =================================="

    # Reload nginx to apply new certificates
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Reloading nginx..."
    if $USE_SUDO systemctl reload nginx 2>/dev/null; then
        echo "[$SCRIPT_INDEX] [OK] Nginx reloaded successfully"
    else
        echo "[$SCRIPT_INDEX] [WARN] Failed to reload nginx"
        echo "[$SCRIPT_INDEX] Please reload nginx manually: sudo systemctl reload nginx"
    fi

    # Show updated certificate status
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] UPDATED CERTIFICATE STATUS"
    echo "[$SCRIPT_INDEX] =================================="
    cd "$laravel_dir"
    $USE_SUDO php artisan servermanager:certificate summary 2>&1 | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done
    echo "[$SCRIPT_INDEX] =================================="

    exit 0
else
    echo "[$SCRIPT_INDEX] [WARN] Certificate renewal completed with warnings"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Common reasons for warnings:"
    echo "[$SCRIPT_INDEX]   - No certificates need renewal (all valid for >30 days)"
    echo "[$SCRIPT_INDEX]   - Some certificates failed to renew (check logs)"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Certificate logs: $letsencrypt_dir/logs/"
    exit 0
fi
