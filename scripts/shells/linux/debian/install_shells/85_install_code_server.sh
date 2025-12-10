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

# Code Server Cleanup Script
# This script provides cleanup functionality for code-server installation

set -e

# Script index for logging
SCRIPT_INDEX="85"

# Path setup
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Initialize global variables
init_global_vars

# Get installation mode
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")

# Define service name
CODE_SERVER_SERVICE_NAME="code-server"

# Ensure sudo is available
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
    echo -e "${GREEN}[$SCRIPT_INDEX] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$SCRIPT_INDEX] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$SCRIPT_INDEX] ERROR: $1${NC}"
}

# Function to check if code-server service exists
check_service_exists() {
    if systemctl list-unit-files | grep -q "ncore-${CODE_SERVER_SERVICE_NAME}.service"; then
        return 0
    else
        return 1
    fi
}

# Function to check if service is active
check_service_active() {
    if $USE_SUDO systemctl is-active --quiet "ncore-${CODE_SERVER_SERVICE_NAME}.service" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to check if service is enabled
check_service_enabled() {
    if $USE_SUDO systemctl is-enabled --quiet "ncore-${CODE_SERVER_SERVICE_NAME}.service" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to cleanup code-server (stop and disable service only)
cleanup_code_server() {
    log "Starting code-server cleanup..."
    log "This will stop and disable the code-server service"
    log "NOTE: Files will NOT be deleted, only service will be stopped"
    echo ""

    local cleanup_performed=false

    # Check if service exists
    if check_service_exists; then
        log "Found code-server service: ncore-${CODE_SERVER_SERVICE_NAME}.service"

        # Stop service if active
        if check_service_active; then
            log "Stopping code-server service..."
            if $USE_SUDO systemctl stop "ncore-${CODE_SERVER_SERVICE_NAME}.service"; then
                log "✓ Service stopped successfully"
                cleanup_performed=true
            else
                error "Failed to stop service"
            fi
        else
            log "Service is not running"
        fi

        # Disable service if enabled
        if check_service_enabled; then
            log "Disabling code-server service from auto-start..."
            if $USE_SUDO systemctl disable "ncore-${CODE_SERVER_SERVICE_NAME}.service"; then
                log "✓ Service disabled successfully"
                cleanup_performed=true
            else
                error "Failed to disable service"
            fi
        else
            log "Service is not enabled"
        fi

        # Show final status
        echo ""
        log "Service status after cleanup:"
        $USE_SUDO systemctl status "ncore-${CODE_SERVER_SERVICE_NAME}.service" --no-pager -l || true

    else
        log "Code-server service not found"
    fi

    echo ""
    if [ "$cleanup_performed" = true ]; then
        log "✓ Cleanup completed successfully"
        log "Service has been stopped and disabled"
    else
        log "No cleanup actions were needed"
    fi

    echo ""
    log "Note: Service files and code-server installation remain intact"
    log "To completely remove code-server, run:"
    log "  apt remove code-server"
    log "  rm -rf ~/.config/code-server"
    log "  rm -rf ~/.local/share/code-server"
}

# Function to show service information
show_service_info() {
    log "Code-server service information:"
    echo ""

    if check_service_exists; then
        log "Service name: ncore-${CODE_SERVER_SERVICE_NAME}.service"

        if check_service_active; then
            log "Status: ${GREEN}Active (running)${NC}"
        else
            log "Status: ${YELLOW}Inactive (stopped)${NC}"
        fi

        if check_service_enabled; then
            log "Auto-start: ${GREEN}Enabled${NC}"
        else
            log "Auto-start: ${YELLOW}Disabled${NC}"
        fi

        echo ""
        log "Service details:"
        $USE_SUDO systemctl status "ncore-${CODE_SERVER_SERVICE_NAME}.service" --no-pager -l || true
    else
        log "Service not found: ncore-${CODE_SERVER_SERVICE_NAME}.service"
    fi
}

# Main menu
show_menu() {
    clear
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║          Code Server Management Script             ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "  1. Show service information"
    echo "  2. Cleanup (stop and disable service)"
    echo "  3. Exit"
    echo ""
    echo -e "${YELLOW}Note: This script does NOT install code-server${NC}"
    echo -e "${YELLOW}      It only manages existing installations${NC}"
    echo ""
}

# Main execution
main() {
    log "Code Server Management Script"
    log "Installation mode: $INSTALL_MODE"
    echo ""

    # Check if installation should be skipped based on mode
    if [ "$INSTALL_MODE" != "server" ] && [ "$INSTALL_MODE" != "full" ]; then
        warn "Code Server is only used in 'server' or 'full' mode"
        warn "Current mode: $INSTALL_MODE"
        echo ""

        # Still offer cleanup
        if check_service_exists; then
            log "Found existing code-server service"
            echo ""
            echo "Do you want to cleanup (stop and disable) the service? (y/N)"
            read -r response

            if [[ "$response" =~ ^[Yy]$ ]]; then
                cleanup_code_server
            else
                log "Cleanup skipped"
            fi
        else
            log "No code-server service found"
        fi

        exit 0
    fi

    # Show menu for server/full mode
    while true; do
        show_menu
        read -p "Select an option (1-3): " choice

        case "$choice" in
            1)
                echo ""
                show_service_info
                echo ""
                read -p "Press Enter to continue..."
                ;;
            2)
                echo ""
                echo "This will stop and disable the code-server service."
                echo "Files will NOT be deleted."
                echo ""
                echo "Continue? (y/N)"
                read -r confirm

                if [[ "$confirm" =~ ^[Yy]$ ]]; then
                    cleanup_code_server
                else
                    log "Cleanup cancelled"
                fi

                echo ""
                read -p "Press Enter to continue..."
                ;;
            3)
                log "Exiting..."
                exit 0
                ;;
            *)
                error "Invalid option. Please try again."
                sleep 1
                ;;
        esac
    done
}

# Run main function
main "$@"
