#!/bin/bash
# Install Pycore HTTP Module Caller Service

set -e

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/debian_service_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/app_paths.sh"

SERVICE_NAME="pycore-module-caller"
SERVICE_DESCRIPTION="Pycore Module Caller FastAPI Service"
SERVICE_PORT=59000
SERVICE_SCRIPT="${CORE_NODE_ROOT_FROM_SCRIPTS}/pycore_module_caller.py"
SERVICE_WORKING_DIR="$CORE_NODE_ROOT_FROM_SCRIPTS"
SERVICE_USER="root"
# IMPORTANT: Use /usr/local/bin/python (venv) instead of /usr/bin/python3 (system)
# This ensures the service runs with venv Python that has all required packages
SERVICE_EXEC="PYTHONPATH=${CORE_NODE_ROOT_FROM_SCRIPTS} /usr/local/bin/python $SERVICE_SCRIPT"

echo "Installing $SERVICE_DESCRIPTION..."
echo "  Port: $SERVICE_PORT"
echo "  Script: $SERVICE_SCRIPT"
echo "  Service File: /etc/systemd/system/$SERVICE_NAME.service"
echo ""
read -p "Continue installation? [Y/n]: " -r
# Default to Y if user just presses Enter
REPLY=${REPLY:-Y}
if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ -n $REPLY ]]; then
    echo "Installation cancelled"
    exit 0
fi

echo ""
echo "=== Service File Content ==="
cat <<EOF

[Unit]
Description=$SERVICE_DESCRIPTION
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$SERVICE_WORKING_DIR
ExecStart=$SERVICE_EXEC
Restart=always
RestartSec=10s
StandardOutput=journal
StandardError=journal

Environment="PYTHONPATH=$SERVICE_WORKING_DIR"
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[Install]
WantedBy=multi-user.target

EOF
echo "============================"
echo ""

if [ ! -f "$SERVICE_SCRIPT" ]; then
    echo "Error: Service script not found at $SERVICE_SCRIPT"
    exit 1
fi

create_systemd_service \
    "$SERVICE_NAME" \
    "$SERVICE_DESCRIPTION" \
    "$SERVICE_EXEC" \
    "$SERVICE_WORKING_DIR" \
    "$SERVICE_USER"

systemctl enable "$SERVICE_NAME.service"
systemctl restart "$SERVICE_NAME.service"

sleep 3

# Check service status
if systemctl is-active --quiet "$SERVICE_NAME.service"; then
    echo "�?Pycore FastAPI service started successfully"
    echo "  Service: $SERVICE_NAME"
    echo "  Port: $SERVICE_PORT"
    echo "  Health: http://127.0.0.1:$SERVICE_PORT/health"
    echo "  API Docs: http://127.0.0.1:$SERVICE_PORT/docs"

    # Test health endpoint
    if curl -s "http://127.0.0.1:$SERVICE_PORT/health" > /dev/null 2>&1; then
        echo "�?Health check passed"
    else
        echo "�?Health check failed"
    fi
else
    echo "�?Failed to start Pycore FastAPI service"
    systemctl status "$SERVICE_NAME.service" --no-pager
    exit 1
fi

echo "Installation complete!"
