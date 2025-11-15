#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

set -e

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/debian_service_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/app_paths.sh"

SERVICE_NAME="laravel-octane-watcher"
SERVICE_DESCRIPTION="Laravel Octane File Watcher - Auto-restart on changes"
PYTHON_SCRIPT="$LARAVEL_MAIN_PATH/scripts/deploy_tools/laravel_daemon_with_octane_server.py"
SERVICE_USER="root"

echo "========================================="
echo "Laravel Octane File Watcher Installation"
echo "========================================="
echo ""
echo "This daemon monitors Laravel files and automatically"
echo "restarts Octane services when changes are detected."
echo ""
echo "IMPORTANT: This is a DEVELOPMENT tool only!"
echo "For production, use the standard 48h auto-restart timer."
echo ""
echo "Script: $PYTHON_SCRIPT"
echo ""

if [ ! -f "$PYTHON_SCRIPT" ]; then
    echo "Error: Python script not found at $PYTHON_SCRIPT"
    exit 1
fi

echo "Checking dependencies..."

if ! dpkg -l | grep -q python3-inotify; then
    echo "Installing python3-inotify..."
    $USE_SUDO apt update
    $USE_SUDO apt install -y python3-inotify
else
    echo "âœ?python3-inotify is installed"
fi

echo ""
echo "Creating systemd service..."

SERVICE_EXEC="/usr/bin/python3 $PYTHON_SCRIPT"
SERVICE_WORKING_DIR="$LARAVEL_MAIN_PATH"

create_systemd_service \
    "$SERVICE_NAME" \
    "$SERVICE_DESCRIPTION" \
    "$SERVICE_EXEC" \
    "$SERVICE_WORKING_DIR" \
    "$SERVICE_USER" \
    "always" \
    "5s" \
    "10%" \
    "200M"

echo ""
echo "Starting service..."
$USE_SUDO systemctl daemon-reload
$USE_SUDO systemctl enable "$SERVICE_NAME.service"
$USE_SUDO systemctl restart "$SERVICE_NAME.service"

sleep 2

if systemctl is-active --quiet "$SERVICE_NAME.service"; then
    echo "âœ?Laravel Octane Watcher started successfully"
    echo ""
    echo "Service: $SERVICE_NAME"
    echo "Status: systemctl status $SERVICE_NAME"
    echo "Logs: journalctl -u $SERVICE_NAME -f"
    echo "Stop: systemctl stop $SERVICE_NAME"
    echo ""
    echo "Log file: $LARAVEL_MAIN_PATH/storage/logs/octane_watcher.log"
    echo ""
    systemctl status "$SERVICE_NAME.service" --no-pager -l | head -20
else
    echo "âœ?Failed to start Laravel Octane Watcher"
    systemctl status "$SERVICE_NAME.service" --no-pager
    exit 1
fi

echo ""
echo "Installation complete!"
echo ""
echo "The watcher will automatically restart Octane services"
echo "when you modify PHP files, config, routes, etc."
