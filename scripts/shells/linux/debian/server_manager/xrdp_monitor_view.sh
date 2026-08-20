#!/bin/bash
#
# XRDP Monitor Log Viewer
# Quick access to XRDP monitor logs with real-time updates
#
# Usage:
#   ./xrdp_monitor_view.sh               # Show menu
#   ./xrdp_monitor_view.sh --live        # Live view all activity
#   ./xrdp_monitor_view.sh --connections # View connections only
#   ./xrdp_monitor_view.sh --errors      # View errors only
#   ./xrdp_monitor_view.sh --analysis    # View analysis
#   ./xrdp_monitor_view.sh --summary     # Show statistics summary

MONITOR_DIR="/var/_core_node/xrdp_monitor"
MONITOR_LOG="$MONITOR_DIR/monitor.log"
CONNECTIONS_LOG="$MONITOR_DIR/connections.log"
DISCONNECTS_LOG="$MONITOR_DIR/disconnects.log"
ERRORS_LOG="$MONITOR_DIR/errors.log"
ANALYSIS_LOG="$MONITOR_DIR/analysis.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Show summary statistics
show_summary() {
    echo -e "${BLUE}=== XRDP Monitor Summary ===${NC}"
    echo ""

    if [[ -f "$CONNECTIONS_LOG" ]]; then
        local conn_count=$(grep -c "CONNECTION" "$CONNECTIONS_LOG" 2>/dev/null || echo "0")
        echo -e "${GREEN}Total Connections: $conn_count${NC}"

        if [[ $conn_count -gt 0 ]]; then
            echo "Recent connections:"
            tail -5 "$CONNECTIONS_LOG" | sed 's/^/  /'
        fi
    else
        echo -e "${YELLOW}No connection data yet${NC}"
    fi

    echo ""

    if [[ -f "$DISCONNECTS_LOG" ]]; then
        local disc_count=$(grep -c "DISCONNECT" "$DISCONNECTS_LOG" 2>/dev/null || echo "0")
        echo -e "${YELLOW}Total Disconnects: $disc_count${NC}"

        if [[ $disc_count -gt 0 ]]; then
            echo "Recent disconnects:"
            tail -5 "$DISCONNECTS_LOG" | sed 's/^/  /'
        fi
    else
        echo -e "${YELLOW}No disconnect data yet${NC}"
    fi

    echo ""

    if [[ -f "$ERRORS_LOG" ]]; then
        local error_count=$(grep -c "ERROR" "$ERRORS_LOG" 2>/dev/null || echo "0")
        echo -e "${RED}Total Errors: $error_count${NC}"

        if [[ $error_count -gt 0 ]]; then
            echo "Recent errors:"
            tail -5 "$ERRORS_LOG" | sed 's/^/  /'
        fi
    else
        echo -e "${GREEN}No errors detected${NC}"
    fi

    echo ""

    # Service status
    echo -e "${CYAN}Service Status:${NC}"
    if systemctl is-active --quiet ncore-xrdp-monitor; then
        echo -e "  ${GREEN}Running${NC}"
    else
        echo -e "  ${RED}Stopped${NC}"
    fi

    echo ""
}

# Live view all activity
live_view() {
    echo -e "${BLUE}=== XRDP Monitor Live View ===${NC}"
    echo "Press Ctrl+C to stop"
    echo ""

    sudo tail -f "$MONITOR_LOG" 2>/dev/null || {
        echo -e "${RED}Monitor log not accessible${NC}"
        exit 1
    }
}

# View connections only
view_connections() {
    echo -e "${GREEN}=== XRDP Connections ===${NC}"
    echo ""

    if [[ -f "$CONNECTIONS_LOG" ]]; then
        cat "$CONNECTIONS_LOG"
    else
        echo "No connections recorded yet"
    fi
}

# View connections live
view_connections_live() {
    echo -e "${GREEN}=== XRDP Connections (Live) ===${NC}"
    echo "Press Ctrl+C to stop"
    echo ""

    sudo tail -f "$CONNECTIONS_LOG" 2>/dev/null || {
        echo "Waiting for connections..."
        touch "$CONNECTIONS_LOG" 2>/dev/null
        sudo tail -f "$CONNECTIONS_LOG"
    }
}

# View errors only
view_errors() {
    echo -e "${RED}=== XRDP Errors ===${NC}"
    echo ""

    if [[ -f "$ERRORS_LOG" ]]; then
        cat "$ERRORS_LOG"
    else
        echo -e "${GREEN}No errors detected${NC}"
    fi
}

# View errors live
view_errors_live() {
    echo -e "${RED}=== XRDP Errors (Live) ===${NC}"
    echo "Press Ctrl+C to stop"
    echo ""

    sudo tail -f "$ERRORS_LOG" 2>/dev/null || {
        echo "Waiting for errors..."
        touch "$ERRORS_LOG" 2>/dev/null
        sudo tail -f "$ERRORS_LOG"
    }
}

# View analysis
view_analysis() {
    echo -e "${CYAN}=== XRDP Error Analysis ===${NC}"
    echo ""

    if [[ -f "$ANALYSIS_LOG" ]]; then
        cat "$ANALYSIS_LOG"
    else
        echo "No analysis data yet"
    fi
}

# View analysis live
view_analysis_live() {
    echo -e "${CYAN}=== XRDP Error Analysis (Live) ===${NC}"
    echo "Press Ctrl+C to stop"
    echo ""

    sudo tail -f "$ANALYSIS_LOG" 2>/dev/null || {
        echo "Waiting for analysis data..."
        touch "$ANALYSIS_LOG" 2>/dev/null
        sudo tail -f "$ANALYSIS_LOG"
    }
}

# Show interactive menu
show_menu() {
    clear
    echo -e "${BLUE}+----------------------------------------+${NC}"
    echo -e "${BLUE}  XRDP Monitor Log Viewer             {NC}"
    echo -e "${BLUE}+----------------------------------------+${NC}"
    echo ""
    show_summary
    echo ""
    echo -e "${CYAN}Options:${NC}"
    echo "  1) Live view all activity"
    echo "  2) View connections (live)"
    echo "  3) View errors (live)"
    echo "  4) View error analysis (live)"
    echo "  5) Refresh summary"
    echo "  6) View service logs"
    echo "  q) Quit"
    echo ""
    read -p "Select option: " choice

    case "$choice" in
        1) live_view ;;
        2) view_connections_live ;;
        3) view_errors_live ;;
        4) view_analysis_live ;;
        5) show_menu ;;
        6) sudo journalctl -u ncore-xrdp-monitor -f ;;
        q|Q) exit 0 ;;
        *) echo "Invalid option"; sleep 1; show_menu ;;
    esac
}

# Main execution
main() {
    case "${1:-}" in
        --live)
            live_view
            ;;
        --connections)
            view_connections_live
            ;;
        --errors)
            view_errors_live
            ;;
        --analysis)
            view_analysis_live
            ;;
        --summary)
            show_summary
            ;;
        --help|-h)
            echo "XRDP Monitor Log Viewer"
            echo ""
            echo "Usage:"
            echo "  $0                   Interactive menu"
            echo "  $0 --live           Live view all activity"
            echo "  $0 --connections    View connections (live)"
            echo "  $0 --errors         View errors (live)"
            echo "  $0 --analysis       View error analysis (live)"
            echo "  $0 --summary        Show statistics summary"
            echo ""
            ;;
        "")
            show_menu
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage"
            exit 1
            ;;
    esac
}

main "$@"
