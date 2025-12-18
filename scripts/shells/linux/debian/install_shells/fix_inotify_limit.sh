#!/bin/bash

# Fix inotify watch limit for Vite and systemd
# Current limit: 65536
# Recommended: 524288 (for development with multiple projects)

echo "Current inotify watch limit:"
cat /proc/sys/fs/inotify/max_user_watches

echo ""
echo "Increasing limit to 524288..."

# Temporary fix (until reboot)
sudo sysctl fs.inotify.max_user_watches=524288

# Permanent fix (persist after reboot)
echo "fs.inotify.max_user_watches=524288" | sudo tee /etc/sysctl.d/60-inotify-watches.conf

# Apply changes
sudo sysctl -p /etc/sysctl.d/60-inotify-watches.conf

echo ""
echo "✓ inotify watch limit increased successfully"
echo ""
echo "New limit:"
cat /proc/sys/fs/inotify/max_user_watches

echo ""
echo "Restarting laravel_dashboard service..."
sudo systemctl restart webapp-laravel_dashboard

echo ""
echo "✓ Done! File watching should now work properly"
