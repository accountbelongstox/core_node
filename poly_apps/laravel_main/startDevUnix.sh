#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Save current working directory
ORIGINAL_DIR=$(pwd)

# Change to the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

PORT=9000

echo "Clearing route cache..."
php artisan route:clear

echo "Listing routes..."
php artisan route:list

echo "Running migrations..."
php artisan migrate

echo "Detecting local IPs (excluding loopback)..."

# Try multiple methods for better compatibility
if command -v ip >/dev/null 2>&1; then
    # Linux - use ip command
    IP_LIST=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -vE '^127\.|^0\.')
elif command -v ifconfig >/dev/null 2>&1; then
    # macOS/BSD - use ifconfig
    IP_LIST=$(ifconfig | grep -E 'inet [0-9]' | grep -v 127.0.0.1 | awk '{print $2}' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$')
else
    # Fallback - use hostname
    IP_LIST=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -vE '^127\.|^0\.|^$' || echo "Unable to detect IP")
fi

echo "Accessible URLs (ready to copy):"
if [ -n "$IP_LIST" ]; then
    for IP in $IP_LIST; do
        echo "  http://$IP:$PORT"
    done
else
    echo "  http://localhost:$PORT (fallback)"
fi

echo "Starting Laravel development environment with hot reload..."
echo "Note: Running in headless API mode - web.php serves only API debug interface"
echo "Press Ctrl+C to stop all services"

# Check if pcntl extension is available for full dev mode
if php -m | grep -q pcntl; then
    echo "Full development mode with logs enabled"
    composer dev
else
    echo "Limited development mode (no logs) - pcntl extension not available"
    composer dev:win
fi

# After the server exits, return to original directory
cd "$ORIGINAL_DIR"
