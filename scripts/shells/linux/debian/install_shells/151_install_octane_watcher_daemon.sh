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
source "$PARENT_DIR_LEVEL_2/common/app_paths.sh"

SERVICE_NAME="octane-auto-restart"
HOT_RELOAD_SERVICE="octane-hot-reload"
OLD_SERVICE_NAME="laravel-octane-watcher"
OCTANE_MANAGER_SCRIPT="$PARENT_DIR_LEVEL_2/common/octane_service_manager.sh"

# Detect if this is a desktop environment
is_desktop_environment() {
    # Check for common desktop indicators
    if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
        return 0
    fi

    # Check if GUI session exists
    if systemctl --user is-active --quiet graphical-session.target 2>/dev/null; then
        return 0
    fi

    # Check for desktop environment packages
    if dpkg -l | grep -qE "ubuntu-desktop|gnome-shell|kde-plasma|xfce4"; then
        return 0
    fi

    return 1
}

echo "========================================="
echo "Laravel Octane Auto-Management Setup"
echo "========================================="
echo ""

if is_desktop_environment; then
    echo "Desktop environment detected!"
    echo "Installing HOT RELOAD service for development"
    echo ""
    echo "This service monitors Laravel files and automatically"
    echo "reloads Octane services when changes are detected."
    echo ""
    echo "Purpose: Hot reload for active development"
    INSTALL_MODE="hot-reload"
else
    echo "Server environment detected!"
    echo "Installing AUTO-RESTART timer for production"
    echo ""
    echo "This creates a systemd timer to automatically restart"
    echo "all Octane services every 48 hours at midnight."
    echo ""
    echo "Purpose: Prevent memory leaks in long-running Swoole processes"
    INSTALL_MODE="auto-restart"
fi

echo "Script: $OCTANE_MANAGER_SCRIPT restart-all"
echo ""

# Check if octane manager script exists
if [ ! -f "$OCTANE_MANAGER_SCRIPT" ]; then
    echo "Error: Octane manager script not found at $OCTANE_MANAGER_SCRIPT"
    exit 1
fi

# Clean up all possible old/conflicting services
echo "Checking for old services to remove..."
CLEANED=0

# Remove old file watcher service
if systemctl list-units --all | grep -q "$OLD_SERVICE_NAME.service"; then
    echo "  Removing old file watcher service: $OLD_SERVICE_NAME"
    $USE_SUDO systemctl stop "$OLD_SERVICE_NAME.service" 2>/dev/null || true
    $USE_SUDO systemctl disable "$OLD_SERVICE_NAME.service" 2>/dev/null || true
    $USE_SUDO rm -f "/etc/systemd/system/$OLD_SERVICE_NAME.service"
    CLEANED=$((CLEANED + 1))
fi

# If installing hot-reload, remove auto-restart timer/service
if [ "$INSTALL_MODE" = "hot-reload" ]; then
    if systemctl list-units --all | grep -q "$SERVICE_NAME.timer"; then
        echo "  Removing conflicting auto-restart timer: $SERVICE_NAME"
        $USE_SUDO systemctl stop "$SERVICE_NAME.timer" 2>/dev/null || true
        $USE_SUDO systemctl disable "$SERVICE_NAME.timer" 2>/dev/null || true
        $USE_SUDO rm -f "/etc/systemd/system/$SERVICE_NAME.timer"
        CLEANED=$((CLEANED + 1))
    fi
    if systemctl list-units --all | grep -q "$SERVICE_NAME.service"; then
        echo "  Removing conflicting auto-restart service: $SERVICE_NAME"
        $USE_SUDO systemctl stop "$SERVICE_NAME.service" 2>/dev/null || true
        $USE_SUDO systemctl disable "$SERVICE_NAME.service" 2>/dev/null || true
        $USE_SUDO rm -f "/etc/systemd/system/$SERVICE_NAME.service"
        CLEANED=$((CLEANED + 1))
    fi
fi

# If installing auto-restart, remove hot-reload service
if [ "$INSTALL_MODE" = "auto-restart" ]; then
    if systemctl list-units --all | grep -q "$HOT_RELOAD_SERVICE.service"; then
        echo "  Removing conflicting hot-reload service: $HOT_RELOAD_SERVICE"
        $USE_SUDO systemctl stop "$HOT_RELOAD_SERVICE.service" 2>/dev/null || true
        $USE_SUDO systemctl disable "$HOT_RELOAD_SERVICE.service" 2>/dev/null || true
        $USE_SUDO rm -f "/etc/systemd/system/$HOT_RELOAD_SERVICE.service"
        CLEANED=$((CLEANED + 1))
    fi
fi

if [ $CLEANED -gt 0 ]; then
    echo "✓ Cleaned up $CLEANED old service(s)"
    $USE_SUDO systemctl daemon-reload
    echo ""
else
    echo "✓ No old services found"
    echo ""
fi

# Install based on environment
if [ "$INSTALL_MODE" = "hot-reload" ]; then
    # Desktop environment: Install hot reload service
    SERVICE_FILE="/etc/systemd/system/${HOT_RELOAD_SERVICE}.service"

    echo "Creating hot reload service..."

    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Laravel Octane Hot Reload - Auto-reload on file changes
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$LARAVEL_MAIN_PATH
ExecStart=/usr/local/bin/php $LARAVEL_MAIN_PATH/artisan octane:hot-reload --interval=3

# Auto-restart configuration
Restart=always
RestartSec=10

# Resource limits
CPUQuota=10%
MemoryMax=200M
MemoryHigh=160M

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${HOT_RELOAD_SERVICE}

# Environment
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[Install]
WantedBy=multi-user.target
EOF

    chmod 644 "$SERVICE_FILE"
    echo "✓ Service file created: $SERVICE_FILE"
    echo ""

    echo "Enabling and starting hot reload service..."
    $USE_SUDO systemctl daemon-reload
    $USE_SUDO systemctl enable "$SERVICE_FILE"
    $USE_SUDO systemctl start "${HOT_RELOAD_SERVICE}.service"

    sleep 2

    if systemctl is-active --quiet "${HOT_RELOAD_SERVICE}.service"; then
        echo "✓ Hot reload service started successfully"
        echo ""
        echo "Service: $HOT_RELOAD_SERVICE.service"
        echo ""
        echo "Commands:"
        echo "  Status:  systemctl status ${HOT_RELOAD_SERVICE}.service"
        echo "  Logs:    journalctl -u ${HOT_RELOAD_SERVICE}.service -f"
        echo "  Stop:    systemctl stop ${HOT_RELOAD_SERVICE}.service"
        echo ""
        systemctl status "${HOT_RELOAD_SERVICE}.service" --no-pager -l | head -20
        echo ""
        echo "Installation complete!"
        echo ""
        echo "Hot reload is now active. Files in app/, config/, routes/, database/, resources/"
        echo "will trigger automatic Octane service reloads when modified."
    else
        echo "✗ Failed to start hot reload service"
        systemctl status "${HOT_RELOAD_SERVICE}.service" --no-pager
        exit 1
    fi

else
    # Server environment: Install auto-restart timer
    SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
    TIMER_FILE="/etc/systemd/system/${SERVICE_NAME}.timer"

    echo "Creating systemd service..."

    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Laravel Octane Auto-Restart - Restart all Octane services
After=network.target

[Service]
Type=oneshot
User=root
Group=root
ExecStart=/bin/bash ${OCTANE_MANAGER_SCRIPT} restart-all

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

chmod 644 "$SERVICE_FILE"
echo "✓ Service file created: $SERVICE_FILE"

# Create systemd timer file
echo "Creating systemd timer..."

cat > "$TIMER_FILE" << EOF
[Unit]
Description=Auto-restart all Octane services every 48 hours at midnight
Requires=${SERVICE_NAME}.service

[Timer]
# Run at 03:00 AM every time (48 hours interval)
OnCalendar=*-*-* 03:00:00
# If system was off during scheduled time, run on next boot
Persistent=true
# Randomize execution time by up to 30 minutes to avoid system load spikes
RandomizedDelaySec=30min

[Install]
WantedBy=timers.target
EOF

    chmod 644 "$TIMER_FILE"
    echo "✓ Timer file created: $TIMER_FILE"

    # Reload systemd and enable timer
    echo ""
    echo "Enabling and starting timer..."
    $USE_SUDO systemctl daemon-reload
    $USE_SUDO systemctl enable "$TIMER_FILE"
    $USE_SUDO systemctl start "${SERVICE_NAME}.timer"

    sleep 2

    # Check timer status
    if systemctl is-active --quiet "${SERVICE_NAME}.timer"; then
        echo "✓ Octane auto-restart timer started successfully"
        echo ""
        echo "Timer: $SERVICE_NAME.timer"
        echo "Service: $SERVICE_NAME.service"
        echo ""
        echo "Commands:"
        echo "  Status:  systemctl status ${SERVICE_NAME}.timer"
        echo "  Logs:    journalctl -u ${SERVICE_NAME}.service -f"
        echo "  Manual:  systemctl start ${SERVICE_NAME}.service"
        echo "  Stop:    systemctl stop ${SERVICE_NAME}.timer"
        echo ""
        systemctl status "${SERVICE_NAME}.timer" --no-pager -l | head -20
        echo ""
        echo "Next scheduled run:"
        systemctl list-timers "${SERVICE_NAME}.timer" --no-pager | grep -A 1 "NEXT"
    else
        echo "✗ Failed to start timer"
        systemctl status "${SERVICE_NAME}.timer" --no-pager
        exit 1
    fi

    echo ""
    echo "Installation complete!"
    echo ""
    echo "All Octane services will be automatically restarted"
    echo "every 48 hours at 03:00 AM to prevent memory leaks."
    echo ""
fi
