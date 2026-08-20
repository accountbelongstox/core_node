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

# DNS Resolution Fix Script
# Fixes DNS resolution issues on production servers

set -e

# Script identification
SCRIPT_INDEX="10"

# Get script directory and source global variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Source common functions
COMMON_DIR="$PARENT_DIR_LEVEL_2/common"
source "$COMMON_DIR/common_functions.sh"

# Get region from global variable
SELECTED_REGION=${SELECTED_REGION:-$(get_var "SELECTED_REGION")}
if [ -z "$SELECTED_REGION" ]; then
    SELECTED_REGION="Global"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Log functions
log_info() {
    echo -e "${GREEN}[$SCRIPT_INDEX][INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$SCRIPT_INDEX][WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[$SCRIPT_INDEX][ERROR]${NC} $1"
}

# Function to test DNS resolution
test_dns() {
    local test_domain="$1"
    if ping -c 1 -W 2 "$test_domain" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to check if internet is working (region-aware)
check_internet_working() {
    log_info "Checking if internet is already working..."
    log_info "Region: $SELECTED_REGION"

    local test_domain=""
    if [ "$SELECTED_REGION" = "China" ]; then
        test_domain="baidu.com"
        log_info "Testing China-specific domain: $test_domain"
    else
        test_domain="google.com"
        log_info "Testing Global domain: $test_domain"
    fi

    # Test DNS resolution
    if test_dns "$test_domain"; then
        log_info "Successfully resolved $test_domain"

        # Test actual HTTP connection
        if command -v curl >/dev/null 2>&1; then
            if curl -s --max-time 5 --head "https://$test_domain" >/dev/null 2>&1; then
                log_info "Successfully connected to $test_domain via HTTPS"
                return 0
            fi
        elif command -v wget >/dev/null 2>&1; then
            if wget --timeout=5 --tries=1 --spider "https://$test_domain" >/dev/null 2>&1; then
                log_info "Successfully connected to $test_domain via HTTPS"
                return 0
            fi
        fi

        log_warning "DNS works but HTTP connection failed"
        return 1
    else
        log_warning "Failed to resolve $test_domain"
        return 1
    fi
}

# Function to test DNS server directly
test_dns_server() {
    local dns_server="$1"
    local test_domain="archive.ubuntu.com"

    if command -v nslookup >/dev/null 2>&1; then
        if nslookup "$test_domain" "$dns_server" >/dev/null 2>&1; then
            return 0
        fi
    elif command -v dig >/dev/null 2>&1; then
        if dig "@$dns_server" "$test_domain" +short >/dev/null 2>&1; then
            return 0
        fi
    elif command -v host >/dev/null 2>&1; then
        if host "$test_domain" "$dns_server" >/dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Function to backup resolv.conf
backup_resolv_conf() {
    if [ -f "/etc/resolv.conf" ]; then
        log_info "Backing up /etc/resolv.conf"
        $USE_SUDO cp /etc/resolv.conf "/etc/resolv.conf.backup.$(date +%Y%m%d_%H%M%S)"
    fi
}

# Function to check if configuration line exists in resolved.conf
check_resolved_conf_line() {
    local key="$1"
    local config_file="/etc/systemd/resolved.conf"

    if [ ! -f "$config_file" ]; then
        return 1
    fi

    if grep -q "^${key}=" "$config_file" 2>/dev/null; then
        return 0
    elif grep -q "^#${key}=" "$config_file" 2>/dev/null; then
        return 2
    else
        return 1
    fi
}

# Function to add or update line in resolved.conf
update_resolved_conf_line() {
    local key="$1"
    local value="$2"
    local config_file="/etc/systemd/resolved.conf"

    check_resolved_conf_line "$key"
    local status=$?

    if [ $status -eq 0 ]; then
        log_info "  $key already configured, skipping"
        return 0
    elif [ $status -eq 2 ]; then
        log_info "  Uncommenting and updating $key"
        $USE_SUDO sed -i "s/^#${key}=.*/${key}=${value}/" "$config_file"
        return 0
    else
        log_info "  Adding $key to configuration"
        if grep -q "^\[Resolve\]" "$config_file" 2>/dev/null; then
            $USE_SUDO sed -i "/^\[Resolve\]/a ${key}=${value}" "$config_file"
        else
            echo "[Resolve]" | $USE_SUDO tee -a "$config_file" > /dev/null
            echo "${key}=${value}" | $USE_SUDO tee -a "$config_file" > /dev/null
        fi
        return 0
    fi
}

# Function to fix systemd-resolved
fix_systemd_resolved() {
    log_info "Checking systemd-resolved service..."

    # Check if systemd-resolved exists
    if ! systemctl list-unit-files | grep -q "systemd-resolved"; then
        log_warning "systemd-resolved not found, skipping"
        return 1
    fi

    # Check if systemd-resolved is running
    if systemctl is-active --quiet systemd-resolved; then
        log_info "systemd-resolved is running"
    else
        log_warning "systemd-resolved is not running, trying to start it..."
        if ! $USE_SUDO systemctl start systemd-resolved; then
            log_warning "Failed to start systemd-resolved, will use static /etc/resolv.conf"
            return 1
        fi
        log_info "systemd-resolved started successfully"
    fi

    # Configure systemd-resolved to use public DNS based on region
    log_info "Configuring /etc/systemd/resolved.conf with DNS servers..."
    log_info "Region: $SELECTED_REGION"

    local config_file="/etc/systemd/resolved.conf"

    # Backup original configuration
    if [ -f "$config_file" ]; then
        log_info "Backing up $config_file"
        $USE_SUDO cp "$config_file" "${config_file}.backup.$(date +%Y%m%d_%H%M%S)"
    else
        log_info "Creating new $config_file"
        $USE_SUDO touch "$config_file"
    fi

    # Ensure [Resolve] section exists
    if ! grep -q "^\[Resolve\]" "$config_file" 2>/dev/null; then
        log_info "Adding [Resolve] section to $config_file"
        echo "[Resolve]" | $USE_SUDO tee -a "$config_file" > /dev/null
    fi

    # Update or add DNS configurations based on region
    log_info "Updating DNS configuration entries:"
    if [ "$SELECTED_REGION" = "China" ]; then
        log_info "Using Alibaba Cloud DNS for China region"
        update_resolved_conf_line "DNS" "223.5.5.5 223.6.6.6"
        update_resolved_conf_line "FallbackDNS" "114.114.114.114 119.29.29.29"
    else
        log_info "Using Google DNS for Global region"
        update_resolved_conf_line "DNS" "8.8.8.8 8.8.4.4"
        update_resolved_conf_line "FallbackDNS" "1.1.1.1 1.0.0.1"
    fi
    update_resolved_conf_line "DNSSEC" "no"
    update_resolved_conf_line "DNSOverTLS" "no"

    # Restart systemd-resolved
    log_info "Restarting systemd-resolved to apply changes..."
    if $USE_SUDO systemctl restart systemd-resolved; then
        log_info "systemd-resolved restarted successfully"
        sleep 2
        return 0
    else
        log_error "Failed to restart systemd-resolved"
        return 1
    fi
}

# Function to create static resolv.conf
create_static_resolv_conf() {
    log_info "Creating static /etc/resolv.conf with public DNS servers..."
    log_info "Region: $SELECTED_REGION"

    backup_resolv_conf

    # Remove symlink if exists
    if [ -L "/etc/resolv.conf" ]; then
        log_info "Removing systemd-resolved symlink"
        $USE_SUDO rm -f /etc/resolv.conf
    fi

    # Re-run safety: clear immutable bit set by a prior run so 'tee' can rewrite the file
    if [ -f "/etc/resolv.conf" ]; then
        $USE_SUDO chattr -i /etc/resolv.conf 2>/dev/null || true
    fi

    # Create static resolv.conf based on region
    if [ "$SELECTED_REGION" = "China" ]; then
        log_info "Using Alibaba Cloud DNS for China region"
        $USE_SUDO tee /etc/resolv.conf > /dev/null << 'EOF'
# Static DNS configuration - created by fix_dns.sh
# Alibaba Cloud DNS (China optimized)
nameserver 223.5.5.5
nameserver 223.6.6.6
nameserver 114.114.114.114
nameserver 119.29.29.29
options timeout:2 attempts:3 rotate
EOF
    else
        log_info "Using Google DNS for Global region"
        $USE_SUDO tee /etc/resolv.conf > /dev/null << 'EOF'
# Static DNS configuration - created by fix_dns.sh
# Google & Cloudflare DNS (Global optimized)
nameserver 8.8.8.8
nameserver 8.8.4.4
nameserver 1.1.1.1
nameserver 1.0.0.1
options timeout:2 attempts:3 rotate
EOF
    fi

    # Make it immutable to prevent systemd from overwriting
    $USE_SUDO chattr +i /etc/resolv.conf 2>/dev/null || log_warning "Could not make resolv.conf immutable"

    log_info "Static /etc/resolv.conf created"
}

# Function to test multiple DNS servers and find working ones
test_dns_servers() {
    log_info "Testing DNS servers..."

    local dns_servers=(
        "8.8.8.8"           # Google
        "1.1.1.1"           # Cloudflare
        "8.8.4.4"           # Google Secondary
        "1.0.0.1"           # Cloudflare Secondary
        "223.5.5.5"         # Alibaba Cloud (China)
        "223.6.6.6"         # Alibaba Cloud (China)
        "114.114.114.114"   # China Telecom
        "119.29.29.29"      # DNSPod (China)
    )

    local working_servers=()

    for dns in "${dns_servers[@]}"; do
        log_info "Testing DNS server: $dns"
        if test_dns_server "$dns"; then
            log_info "  DNS server $dns is working"
            working_servers+=("$dns")
        else
            log_warning "  DNS server $dns is not responding"
        fi
    done

    if [ ${#working_servers[@]} -gt 0 ]; then
        log_info "Found ${#working_servers[@]} working DNS servers"
        return 0
    else
        log_error "No working DNS servers found"
        return 1
    fi
}

# Function to test actual network download
test_network_download() {
    log_info "Testing actual network connectivity with file downloads..."

    local temp_dir="${CORE_NODE_DATA_DIR}/tmp"
    $USE_SUDO mkdir -p "$temp_dir" 2>/dev/null || temp_dir="/tmp"
    $USE_SUDO chmod 777 "$temp_dir" 2>/dev/null || true

    local test_files=(
        "https://registry.npmjs.org/express/latest|npm-registry-test.json"
        "https://www.google.com/robots.txt|google-robots.txt"
        "https://raw.githubusercontent.com/nodejs/node/main/README.md|nodejs-readme.md"
    )

    local download_success=0
    local download_fail=0

    for test_item in "${test_files[@]}"; do
        local url="${test_item%%|*}"
        local filename="${test_item##*|}"
        local temp_file="${temp_dir}/${filename}"

        log_info "Testing download from: $url"

        if command -v wget >/dev/null 2>&1; then
            if wget --timeout=10 --tries=2 -q -O "$temp_file" "$url" 2>/dev/null; then
                if [ -f "$temp_file" ] && [ -s "$temp_file" ]; then
                    local file_size=$(stat -c%s "$temp_file" 2>/dev/null || stat -f%z "$temp_file" 2>/dev/null || echo "0")
                    log_info "  Download successful (${file_size} bytes)"
                    download_success=$((download_success + 1))
                    rm -f "$temp_file" 2>/dev/null
                else
                    log_warning "  Download failed (empty file)"
                    download_fail=$((download_fail + 1))
                fi
            else
                log_warning "  Download failed (wget error)"
                download_fail=$((download_fail + 1))
            fi
        elif command -v curl >/dev/null 2>&1; then
            if curl --max-time 10 --retry 2 -sS -o "$temp_file" "$url" 2>/dev/null; then
                if [ -f "$temp_file" ] && [ -s "$temp_file" ]; then
                    local file_size=$(stat -c%s "$temp_file" 2>/dev/null || stat -f%z "$temp_file" 2>/dev/null || echo "0")
                    log_info "  Download successful (${file_size} bytes)"
                    download_success=$((download_success + 1))
                    rm -f "$temp_file" 2>/dev/null
                else
                    log_warning "  Download failed (empty file)"
                    download_fail=$((download_fail + 1))
                fi
            else
                log_warning "  Download failed (curl error)"
                download_fail=$((download_fail + 1))
            fi
        else
            log_warning "Neither wget nor curl available, skipping download test"
            return 1
        fi
    done

    if [ $download_success -eq ${#test_files[@]} ]; then
        log_info "Network download test: ALL PASSED ($download_success/${#test_files[@]})"
        return 0
    elif [ $download_success -gt 0 ]; then
        log_warning "Network download test: PARTIALLY PASSED ($download_success/${#test_files[@]})"
        return 0
    else
        log_error "Network download test: ALL FAILED ($download_success/${#test_files[@]})"
        return 1
    fi
}

# Function to verify DNS resolution
verify_dns() {
    log_info "Verifying DNS resolution..."

    local test_domains=(
        "archive.ubuntu.com"
        "security.ubuntu.com"
        "registry.npmjs.org"
        "google.com"
        "cloudflare.com"
        "github.com"
    )

    local success_count=0
    local fail_count=0

    for domain in "${test_domains[@]}"; do
        log_info "Testing resolution of $domain..."
        if test_dns "$domain"; then
            log_info "  Successfully resolved $domain"
            success_count=$((success_count + 1))
        else
            log_warning "  Failed to resolve $domain"
            fail_count=$((fail_count + 1))
        fi
    done

    if [ $success_count -eq ${#test_domains[@]} ]; then
        log_info "DNS resolution is working perfectly ($success_count/${#test_domains[@]})"
        return 0
    elif [ $success_count -gt 0 ]; then
        log_warning "DNS resolution partially working ($success_count/${#test_domains[@]})"
        return 0
    else
        log_error "DNS resolution completely broken ($success_count/${#test_domains[@]})"
        return 1
    fi
}

# Function to fix network configuration
fix_network_config() {
    log_info "Checking network configuration..."

    # Check if networking service is running
    if systemctl is-active --quiet networking 2>/dev/null; then
        log_info "Networking service is active"
    else
        log_warning "Networking service is not active, trying to start..."
        $USE_SUDO systemctl restart networking 2>/dev/null || log_warning "Failed to restart networking"
    fi

    # Check if network interfaces are up
    local active_interfaces=$(ip link show | grep -E "^[0-9]+: " | grep -v "lo:" | grep "state UP" | wc -l)
    if [ $active_interfaces -gt 0 ]; then
        log_info "Found $active_interfaces active network interfaces"
    else
        log_warning "No active network interfaces found (excluding loopback)"
    fi
}

# Main execution
main() {
    print_header_from_common_functions "DNS Resolution Fix"

    log_info "Starting DNS resolution diagnostic and fix..."
    log_info "Selected Region: $SELECTED_REGION"
    echo ""

    # Step 0: Check if internet is already working
    log_info "Step 0: Pre-check - Testing if internet is already working..."
    if check_internet_working; then
        log_info "====================================================="
        log_info "Internet is already working properly!"
        log_info "====================================================="
        log_info "No DNS fix needed. System can access:"
        if [ "$SELECTED_REGION" = "China" ]; then
            log_info "  baidu.com (China test site)"
        else
            log_info "  google.com (Global test site)"
        fi
        log_info ""
        log_info "Skipping DNS modifications to avoid breaking working configuration."
        return 0
    else
        log_warning "Internet connectivity check failed"
        log_warning "Will proceed with DNS fixes..."
    fi
    echo ""

    # Step 1: Test current DNS resolution
    log_info "Step 1: Testing current DNS resolution..."
    if verify_dns; then
        log_info "DNS resolution is working!"
        log_info "No fixes needed"
        return 0
    else
        log_warning "DNS resolution has issues, proceeding with fixes..."
    fi
    echo ""

    # Step 2: Check network configuration
    log_info "Step 2: Checking network configuration..."
    fix_network_config
    echo ""

    # Step 3: Test DNS servers
    log_info "Step 3: Testing available DNS servers..."
    test_dns_servers
    echo ""

    # Step 4: Try fixing systemd-resolved first
    log_info "Step 4: Attempting to fix systemd-resolved..."
    if fix_systemd_resolved; then
        log_info "systemd-resolved configured successfully"

        # Test DNS again
        sleep 3
        if verify_dns; then
            log_info "DNS resolution fixed using systemd-resolved!"
            return 0
        else
            log_warning "systemd-resolved configured but DNS still not working"
            log_warning "Falling back to static /etc/resolv.conf..."
        fi
    else
        log_warning "systemd-resolved fix failed or not available"
        log_warning "Falling back to static /etc/resolv.conf..."
    fi
    echo ""

    # Step 5: Create static resolv.conf as fallback
    log_info "Step 5: Creating static /etc/resolv.conf..."
    create_static_resolv_conf
    echo ""

    # Step 6: Final DNS verification
    log_info "Step 6: Final DNS verification..."
    sleep 2
    if verify_dns; then
        log_info "DNS resolution fixed successfully!"
        echo ""

        # Step 7: Test actual network with real downloads
        log_info "Step 7: Testing actual network connectivity with downloads..."
        if test_network_download; then
            log_info "Network connectivity verified with actual downloads!"
            echo ""
            log_info "=== Fix Complete ==="
            log_info "Summary:"
            log_info "  - Region: $SELECTED_REGION"
            if [ "$SELECTED_REGION" = "China" ]; then
                log_info "  - DNS servers: Alibaba Cloud (223.5.5.5, 223.6.6.6)"
            else
                log_info "  - DNS servers: Google (8.8.8.8, 8.8.4.4)"
            fi
            log_info "  - DNS resolution: Working"
            log_info "  - Network download: Working"
            echo ""
            log_info "Your system can now:"
            log_info "  Resolve domain names"
            log_info "  Download files from npm registry"
            log_info "  Access Ubuntu package repositories"
            log_info "  Connect to external services"
            return 0
        else
            log_warning "DNS works but actual downloads failed"
            log_warning "This might be a firewall or proxy issue"
            echo ""
            log_info "DNS resolution is working, but file downloads failed"
            log_info "This suggests:"
            log_info "  - DNS: OK"
            log_info "  - HTTPS/HTTP: May be blocked"
            log_info "Check firewall rules and proxy settings"
            return 0
        fi
    else
        log_error "DNS resolution still not working after all fixes"
        echo ""
        log_error "Possible causes:"
        log_error "  1. Network connectivity is completely broken"
        log_error "  2. Firewall blocking DNS queries (port 53)"
        log_error "  3. Network interface is down"
        log_error "  4. ISP/network blocking DNS traffic"
        echo ""
        log_info "Manual troubleshooting steps:"
        log_info "  1. Check network interface: ip addr show"
        log_info "  2. Check network route: ip route show"
        log_info "  3. Check firewall: iptables -L -n"
        log_info "  4. Test network: ping 8.8.8.8"
        log_info "  5. Check DNS manually: nslookup google.com 8.8.8.8"
        return 1
    fi
}

# Run main function
main "$@"
