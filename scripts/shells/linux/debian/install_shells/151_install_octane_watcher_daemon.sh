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

# Build pnpm/npm absolute paths from gvar_common.sh variables
PNPM_ABS_PATH="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin/pnpm"
NPM_ABS_PATH="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin/npm"

# Legacy service names to clean up
OLD_SERVICES=(
    "octane-hot-reload"
    "octane-auto-restart"
    "laravel-octane-watcher"
)

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
echo "Laravel Octane Hot-Reload Configuration"
echo "========================================="
echo ""

echo "NOTICE: Hot-reload management has been migrated to PHP"
echo ""
echo "Hot-reload is now automatically handled by ServerManagerV1:"
echo ""

if is_desktop_environment; then
    echo "✓ Desktop Environment Detected"
    echo "  • Octane services will start with --watch flag"
    echo "  • Automatic hot-reload on file changes (powered by chokidar)"
    echo "  • Watches: app/, config/, routes/, database/, resources/"
    echo ""
    echo "Configuration:"
    echo "  • Edit config/octane.php to customize watch settings"
    echo "  • Node.js and chokidar are required for --watch mode"
    INSTALL_MODE="desktop"
else
    echo "✓ Server Environment Detected"
    echo "  • Octane services will use 48-hour auto-restart timer"
    echo "  • Prevents memory leaks in long-running processes"
    echo "  • Timer restarts services every 48 hours"
    echo ""
    INSTALL_MODE="server"
fi

echo "Management:"
echo "  • Add domains:  php artisan servermanager:website add <domain> --php-mode=swoole"
echo "  • List sites:   php artisan servermanager:website summary"
echo "  • Cleanup old:  php artisan servermanager:website cleanup"
echo ""

# Clean up all old legacy services
echo "Cleaning up legacy services..."
CLEANED=0

for service_name in "${OLD_SERVICES[@]}"; do
    # Check for service file
    if [ -f "/etc/systemd/system/${service_name}.service" ]; then
        echo "  Removing legacy service: $service_name"
        $USE_SUDO systemctl stop "${service_name}.service" 2>/dev/null || true
        $USE_SUDO systemctl disable "${service_name}.service" 2>/dev/null || true
        $USE_SUDO rm -f "/etc/systemd/system/${service_name}.service"
        CLEANED=$((CLEANED + 1))
    fi

    # Check for timer file
    if [ -f "/etc/systemd/system/${service_name}.timer" ]; then
        echo "  Removing legacy timer: $service_name"
        $USE_SUDO systemctl stop "${service_name}.timer" 2>/dev/null || true
        $USE_SUDO systemctl disable "${service_name}.timer" 2>/dev/null || true
        $USE_SUDO rm -f "/etc/systemd/system/${service_name}.timer"
        CLEANED=$((CLEANED + 1))
    fi
done

if [ $CLEANED -gt 0 ]; then
    echo "✓ Cleaned up $CLEANED legacy service(s)"
    $USE_SUDO systemctl daemon-reload
    $USE_SUDO systemctl reset-failed 2>/dev/null || true
    echo ""
else
    echo "✓ No legacy services found"
    echo ""
fi

# Check chokidar installation
echo "Checking chokidar installation (required for --watch mode)..."
cd "$LARAVEL_MAIN_PATH"

if [ ! -d "node_modules/chokidar" ]; then
    echo "⚠ chokidar not found, installing..."

    # Check for pnpm using absolute path first (prevents "command not found" on first install)
    if [ -f "$PNPM_ABS_PATH" ]; then
        echo "Using pnpm at: $PNPM_ABS_PATH"
        "$PNPM_ABS_PATH" install --save-dev chokidar
        echo "✓ chokidar installed via pnpm"
    elif command -v pnpm &> /dev/null; then
        echo "Using pnpm from PATH: $(which pnpm)"
        pnpm install --save-dev chokidar
        echo "✓ chokidar installed via pnpm"
    elif [ -f "$NPM_ABS_PATH" ]; then
        echo "pnpm not found, using npm at: $NPM_ABS_PATH"
        "$NPM_ABS_PATH" install --save-dev chokidar
        echo "✓ chokidar installed via npm"
    elif command -v npm &> /dev/null; then
        echo "pnpm not found, using npm from PATH: $(which npm)"
        npm install --save-dev chokidar
        echo "✓ chokidar installed via npm"
    else
        echo "✗ Neither pnpm nor npm found. Please install Node.js first"
        echo "  Run: bash scripts/shells/linux/debian/install_shells/14_install_node_24.sh"
        echo "  You can still use Octane without hot-reload"
    fi
else
    echo "✓ chokidar already installed"
fi

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Configure Octane watch settings in config/octane.php"
echo "  2. Deploy your websites with: php artisan servermanager:website add <domain>"
echo "  3. Services will automatically use hot-reload in desktop environment"
echo ""

exit 0

# OLD CODE BELOW - KEPT FOR REFERENCE BUT NOT EXECUTED
# =======================================================
exit 0

if [ "$INSTALL_MODE" = "hot-reload-old" ]; then
    # This section is deprecated
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
