#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

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

# Source gvar_common.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Get INSTALL_UPSC from global variables
INSTALL_UPSC=$(get_var "INSTALL_UPSC" "false")
INSTALL_MODE=$(get_var "INSTALL_MODE")

# WSL: skip UPSC (no real block devices / systemd in typical WSL)
if grep -qiE "microsoft|wsl" /proc/version 2>/dev/null || [ -n "${WSL_DISTRO_NAME:-}" ]; then
    print_info_from_common_functions "WSL detected: skipping UPSC script"
    exit 0
fi

# Configuration file paths
UPS_CONF="/etc/nut/ups.conf"
UPSD_CONF="/etc/nut/upsd.conf"
UPSD_USERS_CONF="/etc/nut/upsd.users"
UPSMON_CONF="/etc/nut/upsmon.conf"

# Check if UPSC components are installed
check_upsc_installed() {
    local has_nut=false
    local has_apache=false
    local has_service=false

    # Check for NUT packages
    if dpkg -l | grep -q "^ii.*nut"; then
        has_nut=true
    fi

    # Check for Apache2
    if dpkg -l | grep -q "^ii.*apache2"; then
        has_apache=true
    fi

    # Check for NUT services
    if systemctl list-unit-files | grep -q "nut-server\|nut-monitor"; then
        has_service=true
    fi

    # Return true if any component is installed
    if [[ "$has_nut" == true ]] || [[ "$has_apache" == true ]] || [[ "$has_service" == true ]]; then
        return 0
    fi
    return 1
}

# Prompt user for uninstallation
prompt_uninstall() {
    echo ""
    echo "============================================"
    echo "UPSC Installation Status Check"
    echo "============================================"
    echo ""
    print_warning_from_common_functions "INSTALL_UPSC is set to false"
    print_info_from_common_functions "UPSC installation is disabled in configuration"
    echo ""

    # Check what's installed
    local has_nut=false
    local has_apache=false
    local has_service=false

    if dpkg -l | grep -q "^ii.*nut"; then
        has_nut=true
        print_info_from_common_functions "Found: NUT (Network UPS Tools) packages"
    fi

    if dpkg -l | grep -q "^ii.*apache2"; then
        has_apache=true
        print_info_from_common_functions "Found: Apache2 web server"
    fi

    if systemctl list-unit-files | grep -q "nut-server\|nut-monitor"; then
        has_service=true
        print_info_from_common_functions "Found: NUT services"
    fi

    # If nothing is installed, just exit
    if [[ "$has_nut" == false ]] && [[ "$has_apache" == false ]] && [[ "$has_service" == false ]]; then
        echo ""
        print_success_from_common_functions "UPSC components are not installed"
        print_info_from_common_functions "No action needed"
        return 1
    fi

    # Prompt for uninstallation
    echo ""
    print_warning_from_common_functions "The following components will be uninstalled:"
    if [[ "$has_nut" == true ]]; then
        echo "  - NUT packages (nut, nut-client, nut-server)"
    fi
    if [[ "$has_apache" == true ]]; then
        echo "  - Apache2 web server and all related packages"
    fi
    if [[ "$has_service" == true ]]; then
        echo "  - NUT systemd services"
    fi
    echo ""
    echo -n "Do you want to uninstall UPSC and related components? (Y/n) [Y]: "
    read -r response

    case "$response" in
        [nN]|[nN][oO])
            print_info_from_common_functions "Keeping UPSC components as is"
            return 1
            ;;
        *)
            # Default is Yes (uninstall)
            return 0
            ;;
    esac
}

uninstall_upsc() {
    print_header_from_common_functions "UPSC Uninstallation"
    print_info_from_common_functions "Starting UPSC component removal..."
    echo ""

    local uninstall_count=0

    # Stop and disable services
    print_step_from_common_functions "Stopping and disabling NUT services..."
    SERVICES=("nut-server.service" "nut-monitor.service")
    for SERVICE in "${SERVICES[@]}"; do
        if systemctl list-units --type=service --all | grep -q "$SERVICE"; then
            print_info_from_common_functions "Processing $SERVICE..."
            $USE_SUDO systemctl stop "$SERVICE" 2>/dev/null || true
            $USE_SUDO systemctl disable "$SERVICE" 2>/dev/null || true
            print_success_from_common_functions "$SERVICE stopped and disabled"
            ((uninstall_count++))
        else
            print_warning_from_common_functions "Service $SERVICE not found, skipping"
        fi
    done
    echo ""

    # Uninstall nut packages
    print_step_from_common_functions "Removing NUT packages..."
    local nut_packages=("nut-client" "nut-server" "nut")
    for pkg in "${nut_packages[@]}"; do
        if dpkg -l | grep -q "^ii.*$pkg"; then
            print_info_from_common_functions "Removing $pkg..."
            $USE_SUDO apt-get purge -y "$pkg" 2>/dev/null || true
            print_success_from_common_functions "$pkg removed"
            ((uninstall_count++))
        fi
    done

    print_step_from_common_functions "Cleaning up unused dependencies..."
    $USE_SUDO apt-get autoremove -y 2>/dev/null || true
    echo ""

    # Remove configuration files
    print_step_from_common_functions "Removing configuration files..."
    local config_files=("$UPS_CONF" "$UPSD_CONF" "$UPSD_USERS_CONF" "$UPSMON_CONF")
    for conf in "${config_files[@]}"; do
        if [[ -f "$conf" ]]; then
            $USE_SUDO rm -f "$conf"
            print_success_from_common_functions "Removed: $conf"
            ((uninstall_count++))
        fi
    done
    echo ""

    # Check for and uninstall apache2
    if dpkg -l | grep -q "^ii.*apache2"; then
        print_step_from_common_functions "Removing Apache2 web server..."

        # Stop and disable apache2 service
        if systemctl list-units --type=service --all | grep -q "apache2.service"; then
            print_info_from_common_functions "Stopping Apache2 service..."
            $USE_SUDO systemctl stop apache2.service 2>/dev/null || true
            $USE_SUDO systemctl disable apache2.service 2>/dev/null || true
            $USE_SUDO systemctl mask apache2.service 2>/dev/null || true
            print_success_from_common_functions "Apache2 service stopped and disabled"
        fi

        print_info_from_common_functions "Removing Apache2 packages..."
        $USE_SUDO apt-get purge -y apache2 apache2-bin apache2-data apache2-utils 2>/dev/null || true
        $USE_SUDO apt-get autoremove -y 2>/dev/null || true
        print_success_from_common_functions "Apache2 removed"
        ((uninstall_count++))
    else
        print_info_from_common_functions "Apache2 not installed, skipping"
    fi
    echo ""

    # Final cleanup
    print_step_from_common_functions "Final cleanup..."
    $USE_SUDO apt-get autoremove -y 2>/dev/null || true
    $USE_SUDO apt-get autoclean -y 2>/dev/null || true
    echo ""

    print_success_from_common_functions "UPSC uninstallation complete"
    print_info_from_common_functions "Components removed: $uninstall_count"
    echo ""
}

if [ "$INSTALL_UPSC" = "false" ]; then
    # Check if any UPSC components are installed
    if check_upsc_installed; then
        # Prompt user for uninstallation
        if prompt_uninstall; then
            # User confirmed uninstallation
            uninstall_upsc
        else
            # User declined uninstallation
            print_info_from_common_functions "No changes made to UPSC installation"
        fi
    else
        # Nothing installed, just inform
        print_header_from_common_functions "UPSC Installation Check"
        print_warning_from_common_functions "INSTALL_UPSC is set to false"
        print_success_from_common_functions "UPSC components are not installed"
        print_info_from_common_functions "No action needed"
    fi
    exit 0
fi

if ! dpkg -l | grep -q nut-client;
 then
#    $USE_SUDO apt-get update
    $USE_SUDO apt-get install -y nut-client
fi

if ! dpkg -l | grep -q nut-server;
 then
#    $USE_SUDO apt-get update
    $USE_SUDO apt-get install -y nut-server
fi



$USE_SUDO rm -f $UPS_CONF $UPSD_CONF $UPSD_USERS_CONF $UPSMON_CONF

$USE_SUDO bash -c "cat > $UPS_CONF <<EOL
[server_ups]
    desc = \"USB to Serial\"
    driver = nutdrv_qx
    port = auto
EOL"

$USE_SUDO bash -c "cat > $UPSD_CONF <<EOL
LISTEN 127.0.0.1 3493
EOL"

$USE_SUDO bash -c "cat > $UPSD_USERS_CONF <<EOL
[admin]
    password = 12345678
    actions = set
    actions = fsd
    instcmds = all

[monitor]
    password = 12345678
    upsmon master
EOL"

$USE_SUDO bash -c "cat > $UPSMON_CONF <<EOL
MONITOR server_ups@localhost 1 monitor 12345678 master
SHUTDOWNCMD \"echo 'Home has no current. Proceeding to shut down...'\"
MINSUPPLIES 1
POLLFREQ 5
POLLFREQALERT 5
HOSTSYNC 15
DEADTIME 15
POWERDOWNFLAG /etc/killpower
RBWARNTIME 10
NOCOMMWARNTIME 300
FINALDELAY 5
EOL"

$USE_SUDO systemctl enable nut-monitor.service

$USE_SUDO systemctl enable nut-server.service
$USE_SUDO systemctl restart nut-server.service
$USE_SUDO systemctl restart nut-monitor.service
