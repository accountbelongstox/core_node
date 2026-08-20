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

# Network Utils Module
# Provides network-related utility functions for launchers

# Get all available IP addresses
get_all_ips() {
    local port="$1"
    echo ""
    echo "=== Available Network Addresses ==="

    # Get localhost
    echo "   Local:    http://localhost:$port/"
    echo "   Local:    http://127.0.0.1:$port/"

    # Get all network interfaces
    local ips=$(ip route get 1.1.1.1 2>/dev/null | grep -oE 'src [0-9.]+' | cut -d' ' -f2)
    if [ -n "$ips" ]; then
        for ip in $ips; do
            echo "   Network:  http://$ip:$port/"
        done
    fi

    # Get all interface IPs (alternative method)
    local all_ips=$(hostname -I 2>/dev/null)
    if [ -n "$all_ips" ]; then
        for ip in $all_ips; do
            if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                echo "   Interface: http://$ip:$port/"
            fi
        done
    fi

    # Try to get public IP
    local public_ip=$(curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || curl -s --connect-timeout 3 ipinfo.io/ip 2>/dev/null)
    if [ -n "$public_ip" ] && [[ "$public_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "   Public:   http://$public_ip:$port/"
    fi

    echo "========================================"
    echo ""
}

# Check and modify package.json for host binding
setup_host_binding() {
    local app_path="$1"
    local package_json="$app_path/package.json"

    if [ -f "$package_json" ]; then
        echo "Configuring host binding to 0.0.0.0..."

        # Check if vite.config exists
        if [ -f "$app_path/vite.config.js" ] || [ -f "$app_path/vite.config.ts" ]; then
            # For Vite projects, create/update vite.config
            local vite_config="$app_path/vite.config.js"
            if [ -f "$app_path/vite.config.ts" ]; then
                vite_config="$app_path/vite.config.ts"
            fi

            # Backup original config
            if [ ! -f "${vite_config}.backup" ]; then
                cp "$vite_config" "${vite_config}.backup"
            fi

            # Check if host is already configured
            if ! grep -q "host.*0\.0\.0\.0\|host.*true" "$vite_config" 2>/dev/null; then
                echo "Adding host: '0.0.0.0' to Vite config..."
                # Simple approach: add host config if defineConfig is present
                if grep -q "defineConfig" "$vite_config"; then
                    sed -i "s/defineConfig({/defineConfig({\n  server: { host: '0.0.0.0', port: 3000 },/" "$vite_config"
                fi
            fi
        fi

        # Check for Vue CLI projects
        if [ -f "$app_path/vue.config.js" ]; then
            local vue_config="$app_path/vue.config.js"
            if [ ! -f "${vue_config}.backup" ]; then
                cp "$vue_config" "${vue_config}.backup"
            fi

            if ! grep -q "host.*0\.0\.0\.0" "$vue_config" 2>/dev/null; then
                echo "Adding host: '0.0.0.0' to Vue config..."
                # Add devServer config if not exists
                if ! grep -q "devServer" "$vue_config"; then
                    sed -i "s/module\.exports = {/module.exports = {\n  devServer: { host: '0.0.0.0', port: 3000 },/" "$vue_config"
                fi
            fi
        fi

        # For Nuxt projects
        if [ -f "$app_path/nuxt.config.js" ] || [ -f "$app_path/nuxt.config.ts" ]; then
            local nuxt_config="$app_path/nuxt.config.js"
            if [ -f "$app_path/nuxt.config.ts" ]; then
                nuxt_config="$app_path/nuxt.config.ts"
            fi

            if [ ! -f "${nuxt_config}.backup" ]; then
                cp "$nuxt_config" "${nuxt_config}.backup"
            fi

            if ! grep -q "host.*0\.0\.0\.0" "$nuxt_config" 2>/dev/null; then
                echo "Adding host: '0.0.0.0' to Nuxt config..."
                # Add server config if not exists
                if ! grep -q "nitro:" "$nuxt_config"; then
                    sed -i "s/export default defineNuxtConfig({/export default defineNuxtConfig({\n  nitro: { host: '0.0.0.0', port: 3000 },/" "$nuxt_config"
                fi
            fi
        fi
    fi
}

# Extract port from command or default
extract_port() {
    local command="$1"
    local default_port="$2"

    # Try to extract port from common patterns
    local port=$(echo "$command" | grep -oE '\-\-port[= ][0-9]+|\-p[= ][0-9]+|:[0-9]+' | grep -oE '[0-9]+' | head -1)

    if [ -z "$port" ]; then
        port="$default_port"
    fi

    echo "$port"
}