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

# Update Existing Services to Use Launcher Scripts
# This script updates systemd service files to use launcher scripts

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Service prefixes managed by unified_manager
UNIFIED_PREFIXES=("app-" "webapp-" "nuxt-" "laravel-" "flutter-" "react-" "vue-")

echo "================================================"
echo "Update Services to Use Launcher Scripts"
echo "================================================"
echo ""

# Detect all unified services
services=()
for prefix in "${UNIFIED_PREFIXES[@]}"; do
    found=$(systemctl list-unit-files --type=service --no-pager --no-legend 2>/dev/null | \
        grep -E "^${prefix}[^[:space:]]+\.service" | \
        awk '{print $1}' | \
        sed 's/.service$//')

    if [ -n "$found" ]; then
        while IFS= read -r service; do
            services+=("$service")
        done <<< "$found"
    fi
done

if [ ${#services[@]} -eq 0 ]; then
    echo -e "${YELLOW}No unified manager services found${NC}"
    exit 0
fi

echo -e "${CYAN}Found ${#services[@]} service(s) to update:${NC}"
for service in "${services[@]}"; do
    echo "  - $service"
done
echo ""

read -p "Do you want to update these services? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Operation cancelled"
    exit 0
fi

echo ""

# Update each service
updated_count=0
skipped_count=0

for service in "${services[@]}"; do
    echo "================================================"
    echo "Processing: $service"
    echo "================================================"

    local service_file="/etc/systemd/system/${service}.service"
    local launcher_script="/var/_core_node/unified_manager/temp_scripts/${service}.sh"

    # Check if launcher script exists
    if [ ! -f "$launcher_script" ]; then
        echo -e "${YELLOW}Launcher script not found: $launcher_script${NC}"
        echo -e "${YELLOW}Skipping $service (launcher needs to be generated first)${NC}"
        ((skipped_count++))
        echo ""
        continue
    fi

    # Check if service file exists
    if [ ! -f "$service_file" ]; then
        echo -e "${YELLOW}Service file not found: $service_file${NC}"
        ((skipped_count++))
        echo ""
        continue
    fi

    # Check if already using launcher script
    if grep -q "ExecStart=$launcher_script" "$service_file"; then
        echo -e "${GREEN}Already using launcher script${NC}"
        ((skipped_count++))
        echo ""
        continue
    fi

    echo "Stopping service..."
    sudo systemctl stop "$service" 2>/dev/null || true

    # Backup original service file
    sudo cp "$service_file" "${service_file}.backup"
    echo -e "${GREEN}Backup created: ${service_file}.backup${NC}"

    # Update ExecStart line
    echo "Updating ExecStart to use launcher script..."
    sudo sed -i "s|^ExecStart=.*|ExecStart=$launcher_script|" "$service_file"

    echo -e "${GREEN}Service file updated${NC}"
    echo ""
    echo "New ExecStart line:"
    grep "^ExecStart=" "$service_file"
    echo ""

    ((updated_count++))
done

echo ""
echo "================================================"
echo "Update Summary"
echo "================================================"
echo -e "${GREEN}Updated: $updated_count${NC}"
echo -e "${YELLOW}Skipped: $skipped_count${NC}"
echo ""

if [ $updated_count -gt 0 ]; then
    echo "Reloading systemd daemon..."
    sudo systemctl daemon-reload
    echo -e "${GREEN}Systemd daemon reloaded${NC}"
    echo ""

    echo -e "${CYAN}Services have been updated to use launcher scripts${NC}"
    echo "You can now start the services with:"
    for service in "${services[@]}"; do
        echo "  sudo systemctl start $service"
    done
    echo ""

    read -p "Do you want to start all services now? (y/N): " start_confirm
    if [[ "$start_confirm" =~ ^[Yy]$ ]]; then
        echo ""
        for service in "${services[@]}"; do
            echo "Starting $service..."
            sudo systemctl start "$service"
            sleep 1
            if systemctl is-active --quiet "$service"; then
                echo -e "${GREEN}âœ?$service started${NC}"
            else
                echo -e "${RED}âœ?$service failed to start${NC}"
                echo "Check logs: sudo journalctl -u $service -n 20"
            fi
        done
    fi
fi

echo ""
echo "Done!"
