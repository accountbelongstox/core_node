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

echo "Flutter Development Server Setup"
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Step 1: Updating Flutter packages..."
echo "This command downloads and updates all dependencies in pubspec.yaml"
flutter pub get
echo "Package update completed!"
echo ""

# Function to get local IP addresses
get_local_ips() {
    local ips=()

    # Try different methods to get IP addresses
    if command -v ip >/dev/null 2>&1; then
        # Modern Linux systems with ip command
        # Extract IP addresses from ip addr show output
        local ip_output=$(ip addr show 2>/dev/null | grep -E "inet [0-9]" | grep -v "127.0.0.1" | awk '{print $2}' | cut -d'/' -f1)
        while IFS= read -r ip; do
            if [[ -n "$ip" && "$ip" != "127.0.0.1" && "$ip" != "0.0.0.0" ]]; then
                ips+=("$ip")
            fi
        done <<< "$ip_output"
    elif command -v ifconfig >/dev/null 2>&1; then
        # Older systems or macOS with ifconfig
        local ifconfig_output=$(ifconfig 2>/dev/null | grep -E "inet [0-9]" | grep -v "127.0.0.1" | awk '{print $2}')
        while IFS= read -r ip; do
            # Remove 'addr:' prefix if present (some systems)
            ip=${ip#addr:}
            if [[ -n "$ip" && "$ip" != "127.0.0.1" && "$ip" != "0.0.0.0" ]]; then
                ips+=("$ip")
            fi
        done <<< "$ifconfig_output"
    elif command -v hostname >/dev/null 2>&1; then
        # Fallback: try hostname -I (Linux) or hostname -i
        local hostname_ips
        if hostname_ips=$(hostname -I 2>/dev/null); then
            for ip in $hostname_ips; do
                if [[ "$ip" != "127.0.0.1" && "$ip" != "0.0.0.0" ]]; then
                    ips+=("$ip")
                fi
            done
        elif hostname_ips=$(hostname -i 2>/dev/null); then
            for ip in $hostname_ips; do
                if [[ "$ip" != "127.0.0.1" && "$ip" != "0.0.0.0" ]]; then
                    ips+=("$ip")
                fi
            done
        fi
    fi

    # Remove duplicates and sort
    if [ ${#ips[@]} -gt 0 ]; then
        printf '%s\n' "${ips[@]}" | sort -u
    fi
}

echo "Step 2: Starting Flutter web server..."
echo "This command starts the Flutter web server in Chrome mode"
echo ""

# Display all available access URLs
echo -e "\033[32m=== Server Access URLs ===\033[0m"
echo -e "\033[33mLocal access: http://127.0.0.1:8080\033[0m"

local_ips=($(get_local_ips))
if [ ${#local_ips[@]} -gt 0 ]; then
    echo -e "\033[36mNetwork access:\033[0m"
    for ip in "${local_ips[@]}"; do
        echo -e "  \033[37mhttp://$ip:8080\033[0m"
    done
else
    echo -e "\033[33mNo network interfaces found for external access\033[0m"
fi
echo ""
echo "Note: The server listens on 0.0.0.0 for external access"
echo ""
echo "Developer Tips:"
echo "- Use Ctrl+C to stop the server"
echo "- Check console for any errors"
echo "- Hot reload is available"
echo "- Press 'r' in the console for hot restart"
echo ""
echo "Please do not close this window. The server will start in 2 seconds."
echo "If the server doesn't start, please close the window and try again."
echo ""

flutter run -d web-server --web-port 8080 --web-hostname 0.0.0.0 