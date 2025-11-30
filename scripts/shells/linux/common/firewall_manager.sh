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

# Firewall Manager Library for Linux
# Provides unified interface for managing firewall rules across different firewall systems
# Supports: UFW, firewalld, iptables
# Does NOT install firewall if not present - only manages existing installations

# Variables declaration
FIREWALL_TYPE=""
FIREWALL_ACTIVE=false
FIREWALL_DETECTED=false
UFW_AVAILABLE=false
FIREWALLD_AVAILABLE=false
IPTABLES_AVAILABLE=false

# Check and set sudo
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# Function to detect available and active firewalls
detect_firewall() {
    local verbose="${1:-false}"

    FIREWALL_DETECTED=false
    FIREWALL_ACTIVE=false
    FIREWALL_TYPE=""

    # Check UFW (Uncomplicated Firewall - Ubuntu/Debian default)
    if command -v ufw >/dev/null 2>&1; then
        UFW_AVAILABLE=true
        if $USE_SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
            FIREWALL_DETECTED=true
            FIREWALL_ACTIVE=true
            FIREWALL_TYPE="ufw"
            [[ "$verbose" == "true" ]] && echo "[INFO] Active firewall detected: UFW"
            return 0
        else
            [[ "$verbose" == "true" ]] && echo "[INFO] UFW installed but inactive"
        fi
    fi

    # Check firewalld (CentOS/RHEL/Fedora)
    if command -v firewall-cmd >/dev/null 2>&1; then
        FIREWALLD_AVAILABLE=true
        if $USE_SUDO firewall-cmd --state 2>/dev/null | grep -q "running"; then
            FIREWALL_DETECTED=true
            FIREWALL_ACTIVE=true
            FIREWALL_TYPE="firewalld"
            [[ "$verbose" == "true" ]] && echo "[INFO] Active firewall detected: firewalld"
            return 0
        else
            [[ "$verbose" == "true" ]] && echo "[INFO] firewalld installed but not running"
        fi
    fi

    # Check iptables (generic Linux firewall)
    if command -v iptables >/dev/null 2>&1; then
        IPTABLES_AVAILABLE=true
        # Check if iptables has active rules (more than default 3 chains)
        local iptables_rules=$($USE_SUDO iptables -L -n 2>/dev/null | grep -c "Chain")
        if [[ $iptables_rules -gt 3 ]]; then
            FIREWALL_DETECTED=true
            FIREWALL_ACTIVE=true
            FIREWALL_TYPE="iptables"
            [[ "$verbose" == "true" ]] && echo "[INFO] Active firewall detected: iptables"
            return 0
        else
            [[ "$verbose" == "true" ]] && echo "[INFO] iptables installed but no active rules"
        fi
    fi

    if [[ "$FIREWALL_DETECTED" == false ]]; then
        [[ "$verbose" == "true" ]] && echo "[INFO] No active firewall detected"
        return 1
    fi

    return 0
}

# Function to allow single port
# Usage: firewall_allow_port <port> [protocol] [comment]
# Example: firewall_allow_port 80 tcp "HTTP"
firewall_allow_port() {
    local port="$1"
    local protocol="${2:-tcp}"
    local comment="${3:-Port $port}"

    if [[ -z "$port" ]]; then
        echo "[ERROR] Port number is required"
        return 1
    fi

    # Validate port number
    if ! [[ "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
        echo "[ERROR] Invalid port number: $port (must be 1-65535)"
        return 1
    fi

    # Validate protocol
    protocol=$(echo "$protocol" | tr '[:upper:]' '[:lower:]')
    if [[ "$protocol" != "tcp" ]] && [[ "$protocol" != "udp" ]] && [[ "$protocol" != "both" ]]; then
        echo "[ERROR] Invalid protocol: $protocol (must be tcp, udp, or both)"
        return 1
    fi

    # Detect firewall if not already detected
    if [[ "$FIREWALL_DETECTED" == false ]]; then
        detect_firewall false
    fi

    if [[ "$FIREWALL_ACTIVE" == false ]]; then
        echo "[INFO] No active firewall detected, port $port is already accessible"
        return 0
    fi

    case "$FIREWALL_TYPE" in
        ufw)
            _ufw_allow_port "$port" "$protocol" "$comment"
            ;;
        firewalld)
            _firewalld_allow_port "$port" "$protocol" "$comment"
            ;;
        iptables)
            _iptables_allow_port "$port" "$protocol" "$comment"
            ;;
        *)
            echo "[ERROR] Unknown firewall type: $FIREWALL_TYPE"
            return 1
            ;;
    esac

    return $?
}

# Function to allow port range
# Usage: firewall_allow_port_range <start_port> <end_port> [protocol] [comment]
# Example: firewall_allow_port_range 8000 8100 tcp "Web services"
firewall_allow_port_range() {
    local start_port="$1"
    local end_port="$2"
    local protocol="${3:-tcp}"
    local comment="${4:-Ports $start_port-$end_port}"

    if [[ -z "$start_port" ]] || [[ -z "$end_port" ]]; then
        echo "[ERROR] Start and end port numbers are required"
        return 1
    fi

    # Validate port numbers
    if ! [[ "$start_port" =~ ^[0-9]+$ ]] || [ "$start_port" -lt 1 ] || [ "$start_port" -gt 65535 ]; then
        echo "[ERROR] Invalid start port: $start_port"
        return 1
    fi

    if ! [[ "$end_port" =~ ^[0-9]+$ ]] || [ "$end_port" -lt 1 ] || [ "$end_port" -gt 65535 ]; then
        echo "[ERROR] Invalid end port: $end_port"
        return 1
    fi

    if [ "$start_port" -gt "$end_port" ]; then
        echo "[ERROR] Start port must be less than or equal to end port"
        return 1
    fi

    # Validate protocol
    protocol=$(echo "$protocol" | tr '[:upper:]' '[:lower:]')
    if [[ "$protocol" != "tcp" ]] && [[ "$protocol" != "udp" ]] && [[ "$protocol" != "both" ]]; then
        echo "[ERROR] Invalid protocol: $protocol (must be tcp, udp, or both)"
        return 1
    fi

    # Detect firewall if not already detected
    if [[ "$FIREWALL_DETECTED" == false ]]; then
        detect_firewall false
    fi

    if [[ "$FIREWALL_ACTIVE" == false ]]; then
        echo "[INFO] No active firewall detected, ports $start_port-$end_port are already accessible"
        return 0
    fi

    case "$FIREWALL_TYPE" in
        ufw)
            _ufw_allow_port_range "$start_port" "$end_port" "$protocol" "$comment"
            ;;
        firewalld)
            _firewalld_allow_port_range "$start_port" "$end_port" "$protocol" "$comment"
            ;;
        iptables)
            _iptables_allow_port_range "$start_port" "$end_port" "$protocol" "$comment"
            ;;
        *)
            echo "[ERROR] Unknown firewall type: $FIREWALL_TYPE"
            return 1
            ;;
    esac

    return $?
}

# Function to remove port rule
# Usage: firewall_remove_port <port> [protocol]
firewall_remove_port() {
    local port="$1"
    local protocol="${2:-tcp}"

    if [[ -z "$port" ]]; then
        echo "[ERROR] Port number is required"
        return 1
    fi

    # Detect firewall if not already detected
    if [[ "$FIREWALL_DETECTED" == false ]]; then
        detect_firewall false
    fi

    if [[ "$FIREWALL_ACTIVE" == false ]]; then
        echo "[INFO] No active firewall detected, nothing to remove"
        return 0
    fi

    case "$FIREWALL_TYPE" in
        ufw)
            _ufw_remove_port "$port" "$protocol"
            ;;
        firewalld)
            _firewalld_remove_port "$port" "$protocol"
            ;;
        iptables)
            _iptables_remove_port "$port" "$protocol"
            ;;
        *)
            echo "[ERROR] Unknown firewall type: $FIREWALL_TYPE"
            return 1
            ;;
    esac

    return $?
}

# Function to list all firewall rules
# Usage: firewall_list_rules
firewall_list_rules() {
    # Detect firewall if not already detected
    if [[ "$FIREWALL_DETECTED" == false ]]; then
        detect_firewall false
    fi

    if [[ "$FIREWALL_ACTIVE" == false ]]; then
        echo "[INFO] No active firewall detected"
        return 0
    fi

    echo "[INFO] Listing firewall rules ($FIREWALL_TYPE):"
    echo "----------------------------------------"

    case "$FIREWALL_TYPE" in
        ufw)
            $USE_SUDO ufw status numbered
            ;;
        firewalld)
            echo "Active zones:"
            $USE_SUDO firewall-cmd --get-active-zones
            echo ""
            echo "Allowed ports:"
            $USE_SUDO firewall-cmd --list-ports
            echo ""
            echo "Allowed services:"
            $USE_SUDO firewall-cmd --list-services
            ;;
        iptables)
            $USE_SUDO iptables -L -n -v --line-numbers
            ;;
        *)
            echo "[ERROR] Unknown firewall type: $FIREWALL_TYPE"
            return 1
            ;;
    esac

    return 0
}

# Function to get firewall status
# Usage: firewall_get_status
firewall_get_status() {
    detect_firewall true

    echo ""
    echo "Firewall Status Summary:"
    echo "----------------------------------------"
    echo "Detected: $FIREWALL_DETECTED"
    echo "Active: $FIREWALL_ACTIVE"
    echo "Type: ${FIREWALL_TYPE:-none}"
    echo ""
    echo "Available Firewall Systems:"
    echo "  UFW: $UFW_AVAILABLE"
    echo "  firewalld: $FIREWALLD_AVAILABLE"
    echo "  iptables: $IPTABLES_AVAILABLE"
    echo "----------------------------------------"

    return 0
}

# ========== UFW Implementation ==========

_ufw_allow_port() {
    local port="$1"
    local protocol="$2"
    local comment="$3"

    echo "[INFO] UFW: Allowing port $port/$protocol"

    if [[ "$protocol" == "both" ]]; then
        if $USE_SUDO ufw allow "$port"/tcp comment "$comment (TCP)"; then
            echo "[OK] UFW: Port $port/tcp allowed"
        fi
        if $USE_SUDO ufw allow "$port"/udp comment "$comment (UDP)"; then
            echo "[OK] UFW: Port $port/udp allowed"
        fi
    else
        if $USE_SUDO ufw allow "$port"/"$protocol" comment "$comment"; then
            echo "[OK] UFW: Port $port/$protocol allowed"
        else
            echo "[WARNING] UFW: Failed to add rule (may already exist)"
            return 1
        fi
    fi

    return 0
}

_ufw_allow_port_range() {
    local start_port="$1"
    local end_port="$2"
    local protocol="$3"
    local comment="$4"

    echo "[INFO] UFW: Allowing port range $start_port-$end_port/$protocol"

    if [[ "$protocol" == "both" ]]; then
        $USE_SUDO ufw allow "$start_port":"$end_port"/tcp comment "$comment (TCP)"
        $USE_SUDO ufw allow "$start_port":"$end_port"/udp comment "$comment (UDP)"
    else
        $USE_SUDO ufw allow "$start_port":"$end_port"/"$protocol" comment "$comment"
    fi

    echo "[OK] UFW: Port range $start_port-$end_port/$protocol allowed"
    return 0
}

_ufw_remove_port() {
    local port="$1"
    local protocol="$2"

    echo "[INFO] UFW: Removing port $port/$protocol"

    if $USE_SUDO ufw delete allow "$port"/"$protocol"; then
        echo "[OK] UFW: Port $port/$protocol removed"
        return 0
    else
        echo "[WARNING] UFW: Failed to remove rule (may not exist)"
        return 1
    fi
}

# ========== firewalld Implementation ==========

_firewalld_allow_port() {
    local port="$1"
    local protocol="$2"
    local comment="$3"

    echo "[INFO] firewalld: Allowing port $port/$protocol"

    if [[ "$protocol" == "both" ]]; then
        $USE_SUDO firewall-cmd --permanent --add-port="$port"/tcp
        $USE_SUDO firewall-cmd --permanent --add-port="$port"/udp
    else
        $USE_SUDO firewall-cmd --permanent --add-port="$port"/"$protocol"
    fi

    $USE_SUDO firewall-cmd --reload
    echo "[OK] firewalld: Port $port/$protocol allowed"
    return 0
}

_firewalld_allow_port_range() {
    local start_port="$1"
    local end_port="$2"
    local protocol="$3"
    local comment="$4"

    echo "[INFO] firewalld: Allowing port range $start_port-$end_port/$protocol"

    if [[ "$protocol" == "both" ]]; then
        $USE_SUDO firewall-cmd --permanent --add-port="$start_port"-"$end_port"/tcp
        $USE_SUDO firewall-cmd --permanent --add-port="$start_port"-"$end_port"/udp
    else
        $USE_SUDO firewall-cmd --permanent --add-port="$start_port"-"$end_port"/"$protocol"
    fi

    $USE_SUDO firewall-cmd --reload
    echo "[OK] firewalld: Port range $start_port-$end_port/$protocol allowed"
    return 0
}

_firewalld_remove_port() {
    local port="$1"
    local protocol="$2"

    echo "[INFO] firewalld: Removing port $port/$protocol"

    if $USE_SUDO firewall-cmd --permanent --remove-port="$port"/"$protocol"; then
        $USE_SUDO firewall-cmd --reload
        echo "[OK] firewalld: Port $port/$protocol removed"
        return 0
    else
        echo "[WARNING] firewalld: Failed to remove rule (may not exist)"
        return 1
    fi
}

# ========== iptables Implementation ==========

_iptables_allow_port() {
    local port="$1"
    local protocol="$2"
    local comment="$3"

    echo "[INFO] iptables: Allowing port $port/$protocol"

    if [[ "$protocol" == "both" ]]; then
        # Check and add TCP rule
        if ! $USE_SUDO iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
            $USE_SUDO iptables -I INPUT -p tcp --dport "$port" -j ACCEPT -m comment --comment "$comment (TCP)"
        fi
        # Check and add UDP rule
        if ! $USE_SUDO iptables -C INPUT -p udp --dport "$port" -j ACCEPT 2>/dev/null; then
            $USE_SUDO iptables -I INPUT -p udp --dport "$port" -j ACCEPT -m comment --comment "$comment (UDP)"
        fi
    else
        # Check if rule already exists
        if ! $USE_SUDO iptables -C INPUT -p "$protocol" --dport "$port" -j ACCEPT 2>/dev/null; then
            $USE_SUDO iptables -I INPUT -p "$protocol" --dport "$port" -j ACCEPT -m comment --comment "$comment"
        else
            echo "[INFO] iptables: Rule already exists for port $port/$protocol"
        fi
    fi

    _iptables_save_rules
    echo "[OK] iptables: Port $port/$protocol allowed"
    return 0
}

_iptables_allow_port_range() {
    local start_port="$1"
    local end_port="$2"
    local protocol="$3"
    local comment="$4"

    echo "[INFO] iptables: Allowing port range $start_port-$end_port/$protocol"

    if [[ "$protocol" == "both" ]]; then
        $USE_SUDO iptables -I INPUT -p tcp --dport "$start_port":"$end_port" -j ACCEPT -m comment --comment "$comment (TCP)"
        $USE_SUDO iptables -I INPUT -p udp --dport "$start_port":"$end_port" -j ACCEPT -m comment --comment "$comment (UDP)"
    else
        $USE_SUDO iptables -I INPUT -p "$protocol" --dport "$start_port":"$end_port" -j ACCEPT -m comment --comment "$comment"
    fi

    _iptables_save_rules
    echo "[OK] iptables: Port range $start_port-$end_port/$protocol allowed"
    return 0
}

_iptables_remove_port() {
    local port="$1"
    local protocol="$2"

    echo "[INFO] iptables: Removing port $port/$protocol"

    if $USE_SUDO iptables -D INPUT -p "$protocol" --dport "$port" -j ACCEPT 2>/dev/null; then
        _iptables_save_rules
        echo "[OK] iptables: Port $port/$protocol removed"
        return 0
    else
        echo "[WARNING] iptables: Failed to remove rule (may not exist)"
        return 1
    fi
}

_iptables_save_rules() {
    # Try to save rules with various methods
    if command -v netfilter-persistent >/dev/null 2>&1; then
        $USE_SUDO netfilter-persistent save 2>/dev/null
    elif command -v iptables-save >/dev/null 2>&1; then
        $USE_SUDO mkdir -p /etc/iptables 2>/dev/null
        $USE_SUDO sh -c "iptables-save > /etc/iptables/rules.v4" 2>/dev/null || true
    fi
}

# Export functions for use in other scripts
export -f detect_firewall
export -f firewall_allow_port
export -f firewall_allow_port_range
export -f firewall_remove_port
export -f firewall_list_rules
export -f firewall_get_status
