#!/bin/bash
#
# XRDP Real-time Monitor Service
# Monitors XRDP logs and diagnoses connection issues in real-time
#
# Usage:
#   ./xrdp_monitor.sh                    # Start monitoring
#   ./xrdp_monitor.sh --install         # Install as systemd service
#   ./xrdp_monitor.sh --remove          # Remove service
#   ./xrdp_monitor.sh --status          # Check service status
#
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

# Script paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
GRANDPARENT_DIR="$(dirname "$PARENT_DIR")"
COMMON_DIR="$GRANDPARENT_DIR/common"
SERVICE_MANAGER="$COMMON_DIR/systemd_service_manager.sh"

# XRDP configuration
XRDP_LOG="/var/log/xrdp.log"
XRDP_SESMAN_LOG="/var/log/xrdp-sesman.log"
XRDP_SYSLOG_PATTERN="xrdp|xorgxrdp"

# Monitor configuration
MONITOR_DIR="/var/_core_node/xrdp_monitor"
MONITOR_LOG="$MONITOR_DIR/monitor.log"
CONNECTIONS_LOG="$MONITOR_DIR/connections.log"
DISCONNECTS_LOG="$MONITOR_DIR/disconnects.log"
ERRORS_LOG="$MONITOR_DIR/errors.log"
ANALYSIS_LOG="$MONITOR_DIR/analysis.log"
STATE_FILE="$MONITOR_DIR/.state"

# Service configuration
SERVICE_NAME="xrdp-monitor"
SERVICE_DESCRIPTION="XRDP Connection Monitor and Diagnostics"
SERVICE_SCRIPT="/usr/local/bin/xrdp_monitor_daemon.sh"

# Resource limits
CPU_LIMIT="5%"
MEMORY_LIMIT="100M"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Initialize monitoring directory
init_monitor_dir() {
    mkdir -p "$MONITOR_DIR"
    chmod 750 "$MONITOR_DIR" 2>/dev/null || true

    # Initialize state file
    if [[ ! -f "$STATE_FILE" ]]; then
        echo "LAST_POSITION=0" > "$STATE_FILE"
        echo "CONNECTIONS_COUNT=0" >> "$STATE_FILE"
        echo "DISCONNECTS_COUNT=0" >> "$STATE_FILE"
        echo "ERRORS_COUNT=0" >> "$STATE_FILE"
    fi

    # Bound any logs left oversized from a previous run.
    cap_monitor_logs
}

# Cap an append-only log to its last ${2:-10MB} bytes, preserving the inode (the
# tail -F loop keeps writing at the new end). No-op if the file is under the cap.
cap_log_file() {
    local f="$1" max="${2:-10485760}" sz tmp
    [ -f "$f" ] || return 0
    sz="$(stat -c %s "$f" 2>/dev/null || echo 0)"
    [ "${sz:-0}" -gt "$max" ] 2>/dev/null || return 0
    tmp="${f}.cap.$$"
    tail -c "$max" "$f" > "$tmp" 2>/dev/null && cat "$tmp" > "$f" 2>/dev/null
    rm -f "$tmp" 2>/dev/null || true
}

# Bound every monitor log (and the appended .state file) so /var/_core_node never
# grows without limit. Called on startup and periodically inside the monitor loop.
cap_monitor_logs() {
    cap_log_file "$MONITOR_LOG"
    cap_log_file "$CONNECTIONS_LOG"
    cap_log_file "$DISCONNECTS_LOG"
    cap_log_file "$ERRORS_LOG"
    cap_log_file "$ANALYSIS_LOG"
    cap_log_file "$STATE_FILE" 65536
}

# Log message with timestamp
log_message() {
    local level="$1"
    local message="$2"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    echo "[$timestamp] [$level] $message" >> "$MONITOR_LOG"
}

# Analyze connection error and provide diagnosis
analyze_error() {
    local error_msg="$1"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

    # Connection Request failed
    if echo "$error_msg" | grep -q "CR-TPDU.*Connection Request.*failed"; then
        echo "[$timestamp] DIAGNOSIS: Client connection initiation failed" >> "$ANALYSIS_LOG"
        echo "  Possible causes:" >> "$ANALYSIS_LOG"
        echo "    - Network connectivity issue between client and server" >> "$ANALYSIS_LOG"
        echo "    - Firewall blocking RDP port 3389" >> "$ANALYSIS_LOG"
        echo "    - XRDP service not fully started" >> "$ANALYSIS_LOG"
        echo "  Recommendation: Check network connectivity and firewall rules" >> "$ANALYSIS_LOG"
        echo "" >> "$ANALYSIS_LOG"
        return
    fi

    # SSL/TLS errors
    if echo "$error_msg" | grep -qi "ssl\|tls"; then
        echo "[$timestamp] DIAGNOSIS: SSL/TLS encryption error" >> "$ANALYSIS_LOG"
        echo "  Possible causes:" >> "$ANALYSIS_LOG"
        echo "    - SSL certificate issues" >> "$ANALYSIS_LOG"
        echo "    - Incompatible encryption protocol" >> "$ANALYSIS_LOG"
        echo "    - Client using outdated RDP version" >> "$ANALYSIS_LOG"
        echo "  Recommendation: Check /etc/xrdp/xrdp.ini security_layer and crypt_level settings" >> "$ANALYSIS_LOG"
        echo "" >> "$ANALYSIS_LOG"
        return
    fi

    # Authentication failed
    if echo "$error_msg" | grep -qi "authentication\|login.*failed\|pam"; then
        echo "[$timestamp] DIAGNOSIS: Authentication failure" >> "$ANALYSIS_LOG"
        echo "  Possible causes:" >> "$ANALYSIS_LOG"
        echo "    - Incorrect username or password" >> "$ANALYSIS_LOG"
        echo "    - User account locked or expired" >> "$ANALYSIS_LOG"
        echo "    - PAM configuration issue" >> "$ANALYSIS_LOG"
        echo "  Recommendation: Verify user credentials and check PAM logs" >> "$ANALYSIS_LOG"
        echo "" >> "$ANALYSIS_LOG"
        return
    fi

    # X server errors
    if echo "$error_msg" | grep -qi "xorg\|x11\|display.*failed\|could not start X"; then
        echo "[$timestamp] DIAGNOSIS: X server startup failure" >> "$ANALYSIS_LOG"
        echo "  Possible causes:" >> "$ANALYSIS_LOG"
        echo "    - Missing .xsession or .xinitrc file" >> "$ANALYSIS_LOG"
        echo "    - Desktop environment not properly installed" >> "$ANALYSIS_LOG"
        echo "    - X11 wrapper permissions issue (check /etc/X11/Xwrapper.config)" >> "$ANALYSIS_LOG"
        echo "    - Display number conflict" >> "$ANALYSIS_LOG"
        echo "  Recommendation: Verify desktop session files and X11 configuration" >> "$ANALYSIS_LOG"
        echo "" >> "$ANALYSIS_LOG"
        return
    fi

    # Session disconnected after login
    if echo "$error_msg" | grep -qi "session.*disconnect\|connection closed\|terminated"; then
        echo "[$timestamp] DIAGNOSIS: Session disconnected after login" >> "$ANALYSIS_LOG"
        echo "  Possible causes:" >> "$ANALYSIS_LOG"
        echo "    - Desktop session failed to start (check .xsession)" >> "$ANALYSIS_LOG"
        echo "    - PolicyKit authentication popup (check /etc/polkit-1/)" >> "$ANALYSIS_LOG"
        echo "    - Missing desktop environment components" >> "$ANALYSIS_LOG"
        echo "    - User's session script has errors" >> "$ANALYSIS_LOG"
        echo "  Recommendation: Check user's .xsession and .xsessionrc files" >> "$ANALYSIS_LOG"
        echo "" >> "$ANALYSIS_LOG"
        return
    fi

    # MCS connection sequence errors
    if echo "$error_msg" | grep -q "MCS Connection Sequence"; then
        echo "[$timestamp] DIAGNOSIS: RDP protocol negotiation failed" >> "$ANALYSIS_LOG"
        echo "  Possible causes:" >> "$ANALYSIS_LOG"
        echo "    - Client and server protocol mismatch" >> "$ANALYSIS_LOG"
        echo "    - Network packet corruption" >> "$ANALYSIS_LOG"
        echo "    - Client RDP version too old" >> "$ANALYSIS_LOG"
        echo "  Recommendation: Update RDP client or adjust XRDP security settings" >> "$ANALYSIS_LOG"
        echo "" >> "$ANALYSIS_LOG"
        return
    fi

    # Generic error
    echo "[$timestamp] DIAGNOSIS: Unclassified error" >> "$ANALYSIS_LOG"
    echo "  Error message: $error_msg" >> "$ANALYSIS_LOG"
    echo "  Recommendation: Check full logs in $XRDP_LOG and $XRDP_SESMAN_LOG" >> "$ANALYSIS_LOG"
    echo "" >> "$ANALYSIS_LOG"
}

# Monitor xrdp logs in real-time
monitor_logs() {
    log_message "INFO" "Starting XRDP monitor service"
    log_message "INFO" "Monitoring: $XRDP_LOG, $XRDP_SESMAN_LOG"

    local connection_count=0
    local disconnect_count=0
    local error_count=0
    local cap_counter=0

    # Use tail -F to follow logs even if they rotate
    tail -F -n 0 "$XRDP_LOG" "$XRDP_SESMAN_LOG" 2>/dev/null | while read -r line; do
        timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

        # Periodically bound the monitor logs (every ~200 events) so they never grow
        # without limit on a busy/long-running monitor.
        cap_counter=$((cap_counter + 1))
        if (( cap_counter % 200 == 0 )); then cap_monitor_logs; fi

        # Detect new connection
        if echo "$line" | grep -qi "connected.*from\|new connection\|login successful"; then
            connection_count=$((connection_count + 1))

            # Extract IP address if present
            ip=$(echo "$line" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)

            echo "[$timestamp] NEW CONNECTION #$connection_count from ${ip:-unknown}" >> "$CONNECTIONS_LOG"
            log_message "CONNECT" "New connection from ${ip:-unknown}"

            # Update state
            echo "CONNECTIONS_COUNT=$connection_count" >> "$STATE_FILE"
        fi

        # Detect disconnection
        if echo "$line" | grep -qi "disconnect\|connection closed\|session.*end\|logout"; then
            disconnect_count=$((disconnect_count + 1))

            echo "[$timestamp] DISCONNECT #$disconnect_count" >> "$DISCONNECTS_LOG"
            echo "  Details: $line" >> "$DISCONNECTS_LOG"
            log_message "DISCONNECT" "Connection terminated"

            # Update state
            echo "DISCONNECTS_COUNT=$disconnect_count" >> "$STATE_FILE"
        fi

        # Detect errors
        if echo "$line" | grep -qi "\[ERROR\]\|failed\|failure"; then
            error_count=$((error_count + 1))

            echo "[$timestamp] ERROR #$error_count" >> "$ERRORS_LOG"
            echo "  $line" >> "$ERRORS_LOG"
            log_message "ERROR" "Error detected in logs"

            # Analyze error
            analyze_error "$line"

            # Update state
            echo "ERRORS_COUNT=$error_count" >> "$STATE_FILE"
        fi

        # Detect warnings
        if echo "$line" | grep -qi "\[WARN\]\|warning"; then
            log_message "WARN" "$line"
        fi
    done
}

# Install monitoring service
install_service() {
    echo -e "${BLUE}Installing XRDP Monitor Service...${NC}"

    if [[ ! -f "$SERVICE_MANAGER" ]]; then
        echo -e "${RED}ERROR: Service manager not found at $SERVICE_MANAGER${NC}"
        return 1
    fi

    # Initialize monitoring directory
    init_monitor_dir

    # Create daemon script
    echo "Creating daemon script at $SERVICE_SCRIPT..."
    cat > "$SERVICE_SCRIPT" << 'DAEMON_EOF'
#!/bin/bash
# XRDP Monitor Daemon
set -euo pipefail

MONITOR_DIR="/var/_core_node/xrdp_monitor"
MONITOR_LOG="$MONITOR_DIR/monitor.log"
CONNECTIONS_LOG="$MONITOR_DIR/connections.log"
DISCONNECTS_LOG="$MONITOR_DIR/disconnects.log"
ERRORS_LOG="$MONITOR_DIR/errors.log"
ANALYSIS_LOG="$MONITOR_DIR/analysis.log"

XRDP_LOG="/var/log/xrdp.log"
XRDP_SESMAN_LOG="/var/log/xrdp-sesman.log"

# Initialize
mkdir -p "$MONITOR_DIR"
chmod 750 "$MONITOR_DIR" 2>/dev/null || true

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$MONITOR_LOG"
}

# Bound the daemon's append-only logs (inode preserved; safe under set -e).
cap_log_file() {
    local f="$1" max="${2:-10485760}" sz tmp
    [ -f "$f" ] || return 0
    sz="$(stat -c %s "$f" 2>/dev/null || echo 0)"
    [ "${sz:-0}" -gt "$max" ] 2>/dev/null || return 0
    tmp="${f}.cap.$$"
    { tail -c "$max" "$f" > "$tmp" 2>/dev/null && cat "$tmp" > "$f" 2>/dev/null; } || true
    rm -f "$tmp" 2>/dev/null || true
}
cap_monitor_logs() {
    cap_log_file "$MONITOR_LOG"
    cap_log_file "$CONNECTIONS_LOG"
    cap_log_file "$DISCONNECTS_LOG"
    cap_log_file "$ERRORS_LOG"
    cap_log_file "$ANALYSIS_LOG"
}

analyze_error() {
    local error_msg="$1"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

    if echo "$error_msg" | grep -q "CR-TPDU.*failed"; then
        echo "[$timestamp] DIAGNOSIS: Client connection initiation failed" >> "$ANALYSIS_LOG"
        echo "  Possible causes: Network connectivity, firewall, or service issues" >> "$ANALYSIS_LOG"
        echo "" >> "$ANALYSIS_LOG"
    elif echo "$error_msg" | grep -qi "ssl\|tls"; then
        echo "[$timestamp] DIAGNOSIS: SSL/TLS encryption error" >> "$ANALYSIS_LOG"
        echo "  Check /etc/xrdp/xrdp.ini security settings" >> "$ANALYSIS_LOG"
        echo "" >> "$ANALYSIS_LOG"
    elif echo "$error_msg" | grep -qi "xorg\|x11\|display"; then
        echo "[$timestamp] DIAGNOSIS: X server startup failure" >> "$ANALYSIS_LOG"
        echo "  Check .xsession files and X11 configuration" >> "$ANALYSIS_LOG"
        echo "" >> "$ANALYSIS_LOG"
    elif echo "$error_msg" | grep -qi "session.*disconnect"; then
        echo "[$timestamp] DIAGNOSIS: Session disconnected after login" >> "$ANALYSIS_LOG"
        echo "  Check desktop environment and PolicyKit configuration" >> "$ANALYSIS_LOG"
        echo "" >> "$ANALYSIS_LOG"
    fi
}

log_message "XRDP Monitor daemon started"
cap_monitor_logs

connection_count=0
disconnect_count=0
error_count=0
cap_counter=0

tail -F -n 0 "$XRDP_LOG" "$XRDP_SESMAN_LOG" 2>/dev/null | while read -r line; do
    timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

    # Periodically bound the logs (every ~200 events) so they never grow unbounded.
    cap_counter=$((cap_counter + 1))
    if (( cap_counter % 200 == 0 )); then cap_monitor_logs; fi

    if echo "$line" | grep -qi "connected.*from\|new connection\|login successful"; then
        connection_count=$((connection_count + 1))
        ip=$(echo "$line" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)
        echo "[$timestamp] CONNECTION #$connection_count from ${ip:-unknown}" >> "$CONNECTIONS_LOG"
        log_message "CONNECT: ${ip:-unknown}"
    fi

    if echo "$line" | grep -qi "disconnect\|connection closed"; then
        disconnect_count=$((disconnect_count + 1))
        echo "[$timestamp] DISCONNECT #$disconnect_count: $line" >> "$DISCONNECTS_LOG"
        log_message "DISCONNECT"
    fi

    if echo "$line" | grep -qi "\[ERROR\]\|failed\|failure"; then
        error_count=$((error_count + 1))
        echo "[$timestamp] ERROR #$error_count: $line" >> "$ERRORS_LOG"
        log_message "ERROR detected"
        analyze_error "$line"
    fi
done
DAEMON_EOF

    chmod +x "$SERVICE_SCRIPT"
    echo -e "${GREEN}Daemon script created${NC}"

    # Install service using service manager
    echo "Installing systemd service..."
    if sudo bash "$SERVICE_MANAGER" create "$SERVICE_SCRIPT" "$SERVICE_NAME" "$SERVICE_DESCRIPTION" "$CPU_LIMIT" "$MEMORY_LIMIT"; then
        echo -e "${GREEN}XRDP Monitor service installed successfully${NC}"
        echo ""
        echo "Service commands:"
        echo "  sudo systemctl status $SERVICE_NAME"
        echo "  sudo systemctl stop $SERVICE_NAME"
        echo "  sudo systemctl restart $SERVICE_NAME"
        echo ""
        echo "Monitor logs location:"
        echo "  Main log:         $MONITOR_LOG"
        echo "  Connections:      $CONNECTIONS_LOG"
        echo "  Disconnects:      $DISCONNECTS_LOG"
        echo "  Errors:           $ERRORS_LOG"
        echo "  Analysis:         $ANALYSIS_LOG"
        echo ""
        return 0
    else
        echo -e "${RED}Failed to install service${NC}"
        return 1
    fi
}

# Remove monitoring service
remove_service() {
    echo -e "${YELLOW}Removing XRDP Monitor Service...${NC}"

    if [[ -f "$SERVICE_MANAGER" ]]; then
        sudo bash "$SERVICE_MANAGER" remove "$SERVICE_NAME" 2>/dev/null || true
    fi

    sudo rm -f "$SERVICE_SCRIPT" 2>/dev/null || true

    echo -e "${GREEN}Service removed${NC}"
    echo "Monitor logs are preserved in: $MONITOR_DIR"
}

# Check service status
check_status() {
    if systemctl is-active --quiet "ncore-$SERVICE_NAME" 2>/dev/null; then
        echo -e "${GREEN}Service is running${NC}"
        echo ""
        sudo systemctl status "ncore-$SERVICE_NAME" --no-pager
        echo ""
        echo "Recent activity:"
        echo "---"
        tail -20 "$MONITOR_LOG" 2>/dev/null || echo "No logs yet"
    else
        echo -e "${YELLOW}Service is not running${NC}"
    fi
}

# Show usage
show_usage() {
    echo "XRDP Real-time Monitor Service"
    echo ""
    echo "Usage:"
    echo "  $0                    Start monitoring (foreground)"
    echo "  $0 --install         Install as systemd service"
    echo "  $0 --remove          Remove service"
    echo "  $0 --status          Check service status"
    echo "  $0 --help            Show this help"
    echo ""
}

# Main execution
main() {
    case "${1:-}" in
        --install)
            install_service
            ;;
        --remove)
            remove_service
            ;;
        --status)
            check_status
            ;;
        --help|-h)
            show_usage
            ;;
        "")
            init_monitor_dir
            echo "Starting XRDP monitor in foreground mode..."
            echo "Press Ctrl+C to stop"
            echo ""
            monitor_logs
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
