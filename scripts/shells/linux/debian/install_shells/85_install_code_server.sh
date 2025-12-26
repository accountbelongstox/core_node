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
                log "âœ?Service stopped successfully"
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
                log "âœ?Service disabled successfully"
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
        log "âœ?Cleanup completed successfully"
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

# Main execution
main() {
    log "Code Server Management Script"
    log "Installation mode: $INSTALL_MODE"
    echo ""

    # Check if code-server service exists
    if ! check_service_exists; then
        log "No code-server service found"
        log "Nothing to manage"
        exit 0
    fi

    # Show current service information
    log "Found code-server service: ncore-${CODE_SERVER_SERVICE_NAME}.service"

    if check_service_active; then
        log "Status: Active (running)"
    else
        log "Status: Inactive (stopped)"
    fi

    if check_service_enabled; then
        log "Auto-start: Enabled"
    else
        log "Auto-start: Disabled"
    fi
    echo ""

    # Automatic cleanup based on installation mode
    if [ "$INSTALL_MODE" != "server" ] && [ "$INSTALL_MODE" != "full" ]; then
        warn "Code Server is only used in 'server' or 'full' mode"
        warn "Current mode: $INSTALL_MODE"
        echo ""

        log "Automatically cleaning up code-server service..."
        cleanup_code_server
    else
        log "Installation mode is '$INSTALL_MODE' - code-server is appropriate for this mode"
        log "Service will remain in current state"

        # Only show status, no action needed
        if check_service_active || check_service_enabled; then
            log "Code-server service is active/enabled as expected"
        else
            log "Code-server service is stopped/disabled"
            log "To start it, run: sudo systemctl start ncore-${CODE_SERVER_SERVICE_NAME}.service"
        fi
    fi

    exit 0
}

# Run main function
main "$@"
