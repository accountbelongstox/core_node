#!/bin/bash

################################################################################
# WiFi Restart Script for Ubuntu
#
# Purpose: Restart WiFi to force it to obtain a new IP address
# Usage: sudo ./restart_wifi.sh
#
# This script uses NetworkManager's nmcli command to:
# 1. Turn off WiFi radio
# 2. Wait 5 seconds
# 3. Turn on WiFi radio (will automatically reconnect and get new IP)
#
# Note: Requires root/sudo privileges to execute
################################################################################

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root or with sudo"
    echo "Usage: sudo $0"
    exit 1
fi

# Check if nmcli is available
if ! command -v nmcli &> /dev/null; then
    print_error "nmcli (NetworkManager) is not installed"
    print_info "Install it with: sudo apt-get install network-manager"
    exit 1
fi

# Display current WiFi status
print_info "Current WiFi status:"
nmcli radio wifi

# Get WiFi device name
WIFI_DEVICE=$(nmcli device status | grep wifi | awk '{print $1}' | head -n 1)
if [ -n "$WIFI_DEVICE" ]; then
    print_info "WiFi device: $WIFI_DEVICE"
fi

echo ""
print_info "Starting WiFi restart process..."
echo ""

# Turn off WiFi
print_info "Step 1/3: Turning off WiFi..."
nmcli radio wifi off

if [ $? -eq 0 ]; then
    print_success "WiFi turned off successfully"
else
    print_error "Failed to turn off WiFi"
    exit 1
fi

# Wait for 5 seconds
print_info "Step 2/3: Waiting 5 seconds..."
for i in {5..1}; do
    echo -ne "${BLUE}[INFO]${NC} Waiting... $i seconds remaining\r"
    sleep 1
done
echo "" # New line after countdown

# Turn on WiFi
print_info "Step 3/3: Turning on WiFi..."
nmcli radio wifi on

if [ $? -eq 0 ]; then
    print_success "WiFi turned on successfully"
else
    print_error "Failed to turn on WiFi"
    exit 1
fi

# Wait a moment for connection to establish
sleep 2

# Display new WiFi status
echo ""
print_success "WiFi restart completed!"
echo ""
print_info "Current WiFi status:"
nmcli radio wifi
echo ""
print_info "Active connections:"
nmcli connection show --active | grep wifi

echo ""
print_info "WiFi will now reconnect and obtain a new IP address automatically"
