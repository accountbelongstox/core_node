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
# Required for domain setup, SSL configuration, and system service management
if [ "$EUID" -ne 0 ] && [ -z "$SUDO_USER" ]; then
    echo "Error: This script must be run as root or with sudo"
    echo "Usage: sudo $0"
    exit 1
fi

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="131"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source Laravel deploy script for reusable functions
source "$CORE_NODE_DIR/poly_apps/laravel_main/scripts/deploy.sh"

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

# ============================================================================
# DIFFERENTIAL FUNCTIONS - Specific to domain setup
# ============================================================================

# Function to initialize secrets by reading from .secret_ignore files
initialize_secrets() {
    local secret_dir="$CORE_NODE_DIR/.secret_keys/.secret_ignore"

    echo "[$SCRIPT_INDEX] Reading secrets from: $secret_dir" >&2

    # Check if secret directory exists
    if [ ! -d "$secret_dir" ]; then
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] ERROR: Secret directory not found"
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] Directory: $secret_dir"
        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] Please run 'dd.sh' to decrypt secrets first:"
        echo "[$SCRIPT_INDEX]   cd $CORE_NODE_DIR"
        echo "[$SCRIPT_INDEX]   dd.sh"
        echo "[$SCRIPT_INDEX] =================================="
        return 1
    fi

    # Read DNS_DNSPOD_EMAILS
    if [ -f "$secret_dir/DNS_DNSPOD_EMAILS" ]; then
        DNSPOD_EMAIL=$(cat "$secret_dir/DNS_DNSPOD_EMAILS" 2>/dev/null | tr -d '\0' | sed '/^\s*$/d')
        if [ -z "$DNSPOD_EMAIL" ]; then
            echo "[$SCRIPT_INDEX] ERROR: DNS_DNSPOD_EMAILS file is empty" >&2
            echo "[$SCRIPT_INDEX] Please run 'dd.sh' to decrypt secrets" >&2
            return 1
        fi
        echo "[$SCRIPT_INDEX] [OK] Loaded DNS_DNSPOD_EMAILS" >&2
        echo "[$SCRIPT_INDEX] [DEBUG] DNS_DNSPOD_EMAILS content: $DNSPOD_EMAIL" >&2
    else
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] ERROR: DNS_DNSPOD_EMAILS not found"
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] File: $secret_dir/DNS_DNSPOD_EMAILS"
        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] Please run 'dd.sh' to decrypt secrets first:"
        echo "[$SCRIPT_INDEX]   cd $CORE_NODE_DIR"
        echo "[$SCRIPT_INDEX]   dd.sh"
        echo "[$SCRIPT_INDEX] =================================="
        return 1
    fi

    # Read DNS_DNSPOD_API_TOKENS
    if [ -f "$secret_dir/DNS_DNSPOD_API_TOKENS" ]; then
        DNSPOD_API_TOKEN=$(cat "$secret_dir/DNS_DNSPOD_API_TOKENS" 2>/dev/null | tr -d '\0' | sed '/^\s*$/d')
        if [ -z "$DNSPOD_API_TOKEN" ]; then
            echo "[$SCRIPT_INDEX] ERROR: DNS_DNSPOD_API_TOKENS file is empty" >&2
            echo "[$SCRIPT_INDEX] Please run 'dd.sh' to decrypt secrets" >&2
            return 1
        fi
        echo "[$SCRIPT_INDEX] [OK] Loaded DNS_DNSPOD_API_TOKENS" >&2
        echo "[$SCRIPT_INDEX] [DEBUG] DNS_DNSPOD_API_TOKENS length: ${#DNSPOD_API_TOKEN} characters" >&2
    else
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] ERROR: DNS_DNSPOD_API_TOKENS not found"
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] File: $secret_dir/DNS_DNSPOD_API_TOKENS"
        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] Please run 'dd.sh' to decrypt secrets first:"
        echo "[$SCRIPT_INDEX]   cd $CORE_NODE_DIR"
        echo "[$SCRIPT_INDEX]   dd.sh"
        echo "[$SCRIPT_INDEX] =================================="
        return 1
    fi

    # Read DOMAINS_LISTS
    if [ -f "$secret_dir/DOMAINS_LISTS" ]; then
        DOMAINS_LISTS_CONTENT=$(cat "$secret_dir/DOMAINS_LISTS" 2>/dev/null | tr -d '\0' | sed '/^\s*$/d')
        if [ -z "$DOMAINS_LISTS_CONTENT" ]; then
            echo "[$SCRIPT_INDEX] ERROR: DOMAINS_LISTS file is empty" >&2
            echo "[$SCRIPT_INDEX] Please run 'dd.sh' to decrypt secrets" >&2
            return 1
        fi
        echo "[$SCRIPT_INDEX] [OK] Loaded DOMAINS_LISTS" >&2
        echo "[$SCRIPT_INDEX] [DEBUG] DOMAINS_LISTS content:" >&2
        echo "$DOMAINS_LISTS_CONTENT" | while IFS= read -r line; do
            echo "[$SCRIPT_INDEX] [DEBUG]   - $line" >&2
        done
    else
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] ERROR: DOMAINS_LISTS not found"
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] File: $secret_dir/DOMAINS_LISTS"
        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] Please run 'dd.sh' to decrypt secrets first:"
        echo "[$SCRIPT_INDEX]   cd $CORE_NODE_DIR"
        echo "[$SCRIPT_INDEX]   dd.sh"
        echo "[$SCRIPT_INDEX] =================================="
        return 1
    fi

    echo "[$SCRIPT_INDEX] [OK] All secrets loaded successfully" >&2
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

# Check if state exists
if [ -d "$SETUP_STATE_DIR" ] && [ "$(ls -A $SETUP_STATE_DIR 2>/dev/null)" ]; then
    echo ""
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] EXISTING SETUP STATE DETECTED"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] Previous setup state found at: $SETUP_STATE_DIR"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Options:"
    echo "[$SCRIPT_INDEX]   [Y] Keep existing state (continue from previous setup)"
    echo "[$SCRIPT_INDEX]   [n] Clear state and start fresh"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Note: Database and existing domains will NOT be affected"
    echo ""
    read -p "[$SCRIPT_INDEX] Keep existing state? (Y/n): " keep_state

    # Default to keep if empty or Enter pressed (idempotent behavior)
    if [ -n "$keep_state" ] && [[ "$keep_state" =~ ^[Nn]$ ]]; then
        clear_state
        echo "[$SCRIPT_INDEX] [IDEMPOTENT] Starting fresh setup"
    else
        echo "[$SCRIPT_INDEX] [IDEMPOTENT] Continuing from existing state"
    fi
else
    echo "[$SCRIPT_INDEX] No previous state found - starting fresh setup"
    mkdir -p "$SETUP_STATE_DIR"
fi

# Note: deploy.sh (sourced above) already runs check_initialization and run_all_ups
# Only run differential functions below

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

# Verify chokidar installation (always run to ensure proper setup)
echo ""
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] VERIFYING OCTANE DEPENDENCIES"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] Checking chokidar for hot-reload support..."
echo "[$SCRIPT_INDEX] Note: This step always runs to ensure proper installation"

laravel_dir=$(get_laravel_dir)
if [ -d "$laravel_dir" ]; then
    cd "$laravel_dir"

    # Trust that pnpm is available via global variables (信任式编程)
    pnpm_cmd="${PNPM_BIN:-$NODE_BIN_DIR/pnpm}"
    echo "[$SCRIPT_INDEX] Using pnpm at: $pnpm_cmd"

    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        node_ver=$(node --version)
        pnpm_ver=$("$pnpm_cmd" --version)
        echo "[$SCRIPT_INDEX] [OK] Node.js: $node_ver"
        echo "[$SCRIPT_INDEX] [OK] pnpm: $pnpm_ver"

        echo "[$SCRIPT_INDEX] Installing/Verifying chokidar..."
        if [ -d "node_modules/chokidar" ]; then
            echo "[$SCRIPT_INDEX] chokidar exists, verifying..."
            "$pnpm_cmd" install --save-dev chokidar >/dev/null 2>&1
        else
            echo "[$SCRIPT_INDEX] Installing chokidar..."
            "$pnpm_cmd" install --save-dev chokidar >/dev/null 2>&1
        fi

        if [ -d "node_modules/chokidar" ]; then
            chokidar_ver=$("$pnpm_cmd" list chokidar 2>/dev/null | grep chokidar | head -1 | awk '{print $2}' || echo "installed")
            echo "[$SCRIPT_INDEX] [OK] chokidar: $chokidar_ver"

            if node -e "require('chokidar'); console.log('OK')" 2>/dev/null | grep -q "OK"; then
                echo "[$SCRIPT_INDEX] [OK] chokidar test passed - hot-reload ready"
            else
                echo "[$SCRIPT_INDEX] [WARN] chokidar test failed but module exists"
            fi
        else
            echo "[$SCRIPT_INDEX] [ERROR] chokidar installation failed"
        fi
    else
        echo "[$SCRIPT_INDEX] [WARN] Node.js not found - hot-reload unavailable"
        echo "[$SCRIPT_INDEX] Install Node.js to enable Octane --watch mode"
    fi

    cd - >/dev/null
else
    echo "[$SCRIPT_INDEX] [ERROR] Laravel directory not found"
fi

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
