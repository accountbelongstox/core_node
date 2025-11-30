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

# Hosts File Manager
# A powerful utility for managing /etc/hosts file entries
# Supports multiple detection methods, regex matching, comment handling, and batch operations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOSTS_FILE="${HOSTS_FILE:-/etc/hosts}"
HOSTS_BACKUP_DIR="${HOSTS_BACKUP_DIR:-/tmp/hosts_backups}"
DEFAULT_IP="127.0.0.1"
LOCAL_PREFIX="local."

# Ensure backup directory exists
mkdir -p "$HOSTS_BACKUP_DIR"

# Function to create backup of hosts file
create_backup() {
    if [ ! -f "$HOSTS_FILE" ]; then
        return 1
    fi
    
    local backup_file="${HOSTS_BACKUP_DIR}/hosts.backup.$(date +%Y%m%d_%H%M%S)"
    if cp "$HOSTS_FILE" "$backup_file" 2>/dev/null; then
        echo "$backup_file"
        return 0
    else
        # Try with sudo if needed
        if command -v sudo >/dev/null 2>&1; then
            if sudo cp "$HOSTS_FILE" "$backup_file" 2>/dev/null; then
                echo "$backup_file"
                return 0
            fi
        fi
        return 1
    fi
}

# Function to check if hosts file is writable
is_hosts_writable() {
    if [ -w "$HOSTS_FILE" ]; then
        return 0
    fi
    return 1
}

# Function to get sudo command if needed
get_sudo_cmd() {
    if is_hosts_writable; then
        echo ""
    else
        if command -v sudo >/dev/null 2>&1; then
            echo "sudo"
        else
            echo ""
        fi
    fi
}

# Function to normalize domain name
normalize_domain() {
    local domain="$1"
    # Remove leading/trailing whitespace
    domain=$(echo "$domain" | xargs)
    # Convert to lowercase
    domain=$(echo "$domain" | tr '[:upper:]' '[:lower:]')
    echo "$domain"
}

# Function to validate IP address
is_valid_ip() {
    local ip="$1"
    # IPv4 validation
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        IFS='.' read -ra ADDR <<< "$ip"
        for i in "${ADDR[@]}"; do
            if [ "$i" -gt 255 ]; then
                return 1
            fi
        done
        return 0
    fi
    # IPv6 validation (basic)
    if [[ $ip =~ ^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$ ]] || [[ $ip == "::1" ]]; then
        return 0
    fi
    return 1
}

# Function to validate domain name
is_valid_domain() {
    local domain="$1"
    # Basic domain validation
    if [[ $domain =~ ^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$ ]] || [[ $domain =~ ^localhost$ ]]; then
        return 0
    fi
    return 1
}

# Function to check if entry exists (with regex support)
# Returns: 0 if exists, 1 if not exists, 2 if exists but commented
entry_exists() {
    local ip="$1"
    local domain="$2"
    local check_commented="${3:-false}"
    
    if [ ! -f "$HOSTS_FILE" ]; then
        return 1
    fi
    
    # Escape special regex characters in domain
    local escaped_domain=$(echo "$domain" | sed 's/\./\\./g' | sed 's/\*/\\*/g')
    
    # Check for exact match (IP and domain)
    if grep -qiE "^[[:space:]]*${ip}[[:space:]]+${escaped_domain}[[:space:]]*$" "$HOSTS_FILE" 2>/dev/null; then
        return 0
    fi
    
    # Check for domain match with any IP
    if grep -qiE "^[[:space:]]*[0-9a-fA-F:\.]+[[:space:]]+${escaped_domain}[[:space:]]*$" "$HOSTS_FILE" 2>/dev/null; then
        return 0
    fi
    
    # Check for commented entry if requested
    if [ "$check_commented" = "true" ]; then
        if grep -qiE "^[[:space:]]*#[[:space:]]*[0-9a-fA-F:\.]+[[:space:]]+${escaped_domain}[[:space:]]*$" "$HOSTS_FILE" 2>/dev/null; then
            return 2
        fi
    fi
    
    return 1
}

# Function to check if entry is commented
is_entry_commented() {
    local domain="$1"
    
    if [ ! -f "$HOSTS_FILE" ]; then
        return 1
    fi
    
    local escaped_domain=$(echo "$domain" | sed 's/\./\\./g' | sed 's/\*/\\*/g')
    
    # Check if entry starts with #
    if grep -qiE "^[[:space:]]*#[[:space:]]*[0-9a-fA-F:\.]+[[:space:]]+${escaped_domain}[[:space:]]*$" "$HOSTS_FILE" 2>/dev/null; then
        return 0
    fi
    
    return 1
}

# Function to uncomment entry
uncomment_entry() {
    local domain="$1"
    
    if [ ! -f "$HOSTS_FILE" ]; then
        return 1
    fi
    
    local escaped_domain=$(echo "$domain" | sed 's/\./\\./g' | sed 's/\*/\\*/g')
    local sudo_cmd=$(get_sudo_cmd)
    
    # Uncomment the entry
    if [ -n "$sudo_cmd" ]; then
        $sudo_cmd sed -i "s/^[[:space:]]*#[[:space:]]*\([0-9a-fA-F:\.]\+[[:space:]]\+${escaped_domain}\)/\1/" "$HOSTS_FILE" 2>/dev/null
    else
        sed -i "s/^[[:space:]]*#[[:space:]]*\([0-9a-fA-F:\.]\+[[:space:]]\+${escaped_domain}\)/\1/" "$HOSTS_FILE" 2>/dev/null
    fi
    
    return $?
}

# Function to remove entry (by domain regex)
remove_entry() {
    local domain="$1"
    
    if [ ! -f "$HOSTS_FILE" ]; then
        return 1
    fi
    
    local escaped_domain=$(echo "$domain" | sed 's/\./\\./g' | sed 's/\*/\\*/g')
    local sudo_cmd=$(get_sudo_cmd)
    
    # Remove entry (commented or not)
    if [ -n "$sudo_cmd" ]; then
        $sudo_cmd sed -i "/^[[:space:]]*#\{0,1\}[[:space:]]*[0-9a-fA-F:\.]\+[[:space:]]\+${escaped_domain}[[:space:]]*$/d" "$HOSTS_FILE" 2>/dev/null
    else
        sed -i "/^[[:space:]]*#\{0,1\}[[:space:]]*[0-9a-fA-F:\.]\+[[:space:]]*${escaped_domain}[[:space:]]*$/d" "$HOSTS_FILE" 2>/dev/null
    fi
    
    return $?
}

# Function to add entry to hosts file
add_entry() {
    local ip="$1"
    local domain="$2"
    local force="${3:-false}"
    
    # Normalize domain
    domain=$(normalize_domain "$domain")
    
    # Validate inputs
    if ! is_valid_ip "$ip"; then
        echo "Error: Invalid IP address: $ip" >&2
        return 1
    fi
    
    if ! is_valid_domain "$domain"; then
        echo "Error: Invalid domain name: $domain" >&2
        return 1
    fi
    
    # Check if entry exists
    local exists_result
    entry_exists "$ip" "$domain" "true"
    exists_result=$?
    
    if [ $exists_result -eq 0 ]; then
        if [ "$force" != "true" ]; then
            echo "Entry already exists: $ip $domain"
            return 0
        else
            # Remove existing entry
            remove_entry "$domain"
        fi
    elif [ $exists_result -eq 2 ]; then
        # Entry exists but is commented, uncomment it
        if uncomment_entry "$domain"; then
            echo "Uncommented existing entry: $ip $domain"
            return 0
        else
            # If uncomment failed, remove and add new
            remove_entry "$domain"
        fi
    fi
    
    # Create backup before modification
    create_backup > /dev/null
    
    # Add new entry
    local sudo_cmd=$(get_sudo_cmd)
    local entry="${ip}    ${domain}"
    
    if [ -n "$sudo_cmd" ]; then
        if echo "$entry" | $sudo_cmd tee -a "$HOSTS_FILE" > /dev/null 2>&1; then
            echo "Added: $ip $domain"
            return 0
        else
            echo "Error: Failed to add entry: $ip $domain" >&2
            return 1
        fi
    else
        if echo "$entry" >> "$HOSTS_FILE" 2>/dev/null; then
            echo "Added: $ip $domain"
            return 0
        else
            echo "Error: Failed to add entry: $ip $domain" >&2
            return 1
        fi
    fi
}

# Function to add entry with auto IP detection
add_entry_auto() {
    local input="$1"
    local force="${2:-false}"
    
    # Parse input: IP:domain or domain
    local ip=""
    local domain=""
    
    if [[ $input =~ ^([0-9a-fA-F:\.]+):(.+)$ ]]; then
        # Format: IP:domain
        ip="${BASH_REMATCH[1]}"
        domain="${BASH_REMATCH[2]}"
    elif [[ $input =~ ^([0-9a-fA-F:\.]+)[[:space:]]+(.+)$ ]]; then
        # Format: IP domain (space separated)
        ip="${BASH_REMATCH[1]}"
        domain="${BASH_REMATCH[2]}"
    else
        # Just domain, use default IP and add local prefix if needed
        domain="$input"
        if [[ ! $domain =~ ^local\. ]]; then
            domain="${LOCAL_PREFIX}${domain}"
        fi
        ip="$DEFAULT_IP"
    fi
    
    # Normalize
    domain=$(normalize_domain "$domain")
    
    add_entry "$ip" "$domain" "$force"
}

# Function to add multiple entries (batch mode)
add_entries_batch() {
    local entries="$1"
    local force="${2:-false}"
    local added=0
    local skipped=0
    local failed=0
    
    # Create backup once for batch operation
    local backup_file
    backup_file=$(create_backup)
    if [ -n "$backup_file" ]; then
        echo "Backup created: $backup_file"
    fi
    
    # Process entries (can be space-separated, comma-separated, or newline-separated)
    local processed_entries
    processed_entries=$(echo "$entries" | tr ',' '\n' | tr ' ' '\n' | grep -v '^$' | sort -u)
    
    while IFS= read -r entry || [ -n "$entry" ]; do
        if [ -z "$entry" ]; then
            continue
        fi
        
        if add_entry_auto "$entry" "$force"; then
            added=$((added + 1))
        else
            failed=$((failed + 1))
        fi
    done <<< "$processed_entries"
    
    echo "Batch operation completed: Added=$added, Failed=$failed"
    return $failed
}

# Function to list entries matching pattern
list_entries() {
    local pattern="${1:-.*}"
    
    if [ ! -f "$HOSTS_FILE" ]; then
        echo "Hosts file not found: $HOSTS_FILE" >&2
        return 1
    fi
    
    local escaped_pattern=$(echo "$pattern" | sed 's/\./\\./g' | sed 's/\*/\\*/g')
    
    grep -iE "^[[:space:]]*#?[[:space:]]*[0-9a-fA-F:\.]+[[:space:]]+.*${escaped_pattern}" "$HOSTS_FILE" 2>/dev/null | while IFS= read -r line; do
        echo "$line"
    done
}

# Function to show usage
show_usage() {
    cat << EOF
Hosts File Manager - Powerful utility for managing /etc/hosts entries

Usage:
    $0 add <entry> [--force]
    $0 add-batch <entry1> [entry2] ... [--force]
    $0 remove <domain>
    $0 list [pattern]
    $0 check <domain>
    $0 uncomment <domain>

Entry formats:
    <domain>                    - Add domain with default IP (127.0.0.1) and local. prefix
    <IP>:<domain>              - Add domain with specific IP
    <IP> <domain>              - Add domain with specific IP (space separated)

Examples:
    $0 add example.com
    $0 add 192.168.1.100:api.example.com
    $0 add 192.168.1.100 api.example.com
    $0 add-batch example.com api.example.com test.example.com
    $0 add-batch "192.168.1.100:api.example.com 192.168.1.101:db.example.com"
    $0 remove example.com
    $0 list "local\."
    $0 check api.example.com
    $0 uncomment example.com

Options:
    --force                    - Force add even if entry exists (removes old entry first)
    --ip <IP>                  - Override default IP (default: 127.0.0.1)
    --no-local-prefix          - Don't add local. prefix automatically
    --hosts-file <path>        - Use custom hosts file path

Environment variables:
    HOSTS_FILE                 - Path to hosts file (default: /etc/hosts)
    HOSTS_BACKUP_DIR           - Backup directory (default: /tmp/hosts_backups)
    DEFAULT_IP                 - Default IP for domains (default: 127.0.0.1)
    LOCAL_PREFIX               - Prefix for local domains (default: local.)

Features:
    - Multiple detection methods (exact match, regex, commented entries)
    - Automatic backup before modifications
    - Batch operations support
    - Comment/uncomment handling
    - Duplicate detection and skipping
    - IPv4 and IPv6 support
EOF
}

# Main execution
main() {
    local action="${1:-}"
    local force=false
    local custom_ip=""
    local no_local_prefix=false
    
    # Parse options
    shift || true
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                force=true
                shift
                ;;
            --ip)
                custom_ip="$2"
                shift 2
                ;;
            --no-local-prefix)
                no_local_prefix=true
                shift
                ;;
            --hosts-file)
                HOSTS_FILE="$2"
                shift 2
                ;;
            *)
                break
                ;;
        esac
    done
    
    # Override default IP if provided
    if [ -n "$custom_ip" ]; then
        DEFAULT_IP="$custom_ip"
    fi
    
    # Override local prefix if disabled
    if [ "$no_local_prefix" = "true" ]; then
        LOCAL_PREFIX=""
    fi
    
    case "$action" in
        add)
            if [ $# -eq 0 ]; then
                echo "Error: Entry required for 'add' action" >&2
                show_usage
                exit 1
            fi
            add_entry_auto "$1" "$force"
            ;;
        add-batch)
            if [ $# -eq 0 ]; then
                echo "Error: At least one entry required for 'add-batch' action" >&2
                show_usage
                exit 1
            fi
            # Combine all remaining arguments
            local entries="$*"
            add_entries_batch "$entries" "$force"
            ;;
        remove)
            if [ $# -eq 0 ]; then
                echo "Error: Domain required for 'remove' action" >&2
                show_usage
                exit 1
            fi
            local domain=$(normalize_domain "$1")
            if remove_entry "$domain"; then
                echo "Removed: $domain"
            else
                echo "Error: Failed to remove entry: $domain" >&2
                exit 1
            fi
            ;;
        list)
            list_entries "${1:-.*}"
            ;;
        check)
            if [ $# -eq 0 ]; then
                echo "Error: Domain required for 'check' action" >&2
                show_usage
                exit 1
            fi
            local domain=$(normalize_domain "$1")
            entry_exists "" "$domain" "true"
            local result=$?
            case $result in
                0)
                    echo "Entry exists: $domain"
                    ;;
                2)
                    echo "Entry exists but is commented: $domain"
                    ;;
                *)
                    echo "Entry not found: $domain"
                    ;;
            esac
            ;;
        uncomment)
            if [ $# -eq 0 ]; then
                echo "Error: Domain required for 'uncomment' action" >&2
                show_usage
                exit 1
            fi
            local domain=$(normalize_domain "$1")
            if uncomment_entry "$domain"; then
                echo "Uncommented: $domain"
            else
                echo "Error: Failed to uncomment entry: $domain" >&2
                exit 1
            fi
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            if [ -z "$action" ]; then
                echo "Error: Action required" >&2
            else
                echo "Error: Unknown action: $action" >&2
            fi
            show_usage
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi

