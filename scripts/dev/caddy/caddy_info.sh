#!/bin/bash

echo "???? Checking Caddy installation details..."
echo "--------------------------------------------"

# 1. Check if Caddy is installed
if ! command -v caddy &> /dev/null; then
    echo "???Caddy is not installed or not in PATH."
    exit 1
else
    echo "???Caddy is installed at: $(command -v caddy)"
fi

# 2. Display Caddy version
echo "--------------------------------------------"
echo "???? Caddy Version:"
caddy version

# 3. Show executable path
echo "--------------------------------------------"
echo "???? Caddy Executable Path:"
which caddy

# 4. Check systemd service status
echo "--------------------------------------------"
echo "??????? systemd Service Status (caddy.service):"
systemctl status caddy.service 2>/dev/null || echo "[WARN]  Not active or service not found."

# 5. Check if enabled on boot
echo "--------------------------------------------"
echo "???? systemd Enabled on Boot:"
systemctl is-enabled caddy.service 2>/dev/null || echo "[WARN]  Not enabled or service not found."

# 6. Check for Caddyfile
echo "--------------------------------------------"
echo "???? Caddyfile Location and Preview:"
if [ -f /etc/caddy/Caddyfile ]; then
    echo "Found: /etc/caddy/Caddyfile"
    echo "Preview (first 20 lines):"
    head -n 20 /etc/caddy/Caddyfile
else
    echo "No Caddyfile found at /etc/caddy/Caddyfile"
    echo "Caddy might be using API or another config method."
fi

# 7. Show listening ports
echo "--------------------------------------------"
echo "???? Listening Ports (related to caddy):"
sudo ss -tulpn | grep caddy || echo "[WARN]  No active ports found (Caddy might not be running)"

# 8. Show installed Caddy modules (if xcaddy used)
echo "--------------------------------------------"
echo "???? Caddy Modules (if available):"
caddy list-modules 2>/dev/null || echo "Could not retrieve modules (possibly not built with xcaddy)"

# 9. Show recent logs
echo "--------------------------------------------"
echo "???? Recent Logs (journalctl -u caddy.service):"
journalctl -u caddy.service -n 20 --no-pager 2>/dev/null || echo "[WARN]  No logs available or journalctl not accessible."

# 10. Show environment (user, system info)
echo "--------------------------------------------"
echo "???? System Info:"
echo "Hostname: $(hostname)"
echo "User: $(whoami)"
echo "OS Version: $(lsb_release -d 2>/dev/null | cut -f2-)"
echo "Kernel: $(uname -r)"

echo "--------------------------------------------"
echo "???Caddy information collection complete."
