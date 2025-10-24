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

# Source LGar.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# WARNING: INSTALL_UPSC is hardcoded to false - UPS Control installation is disabled
INSTALL_UPSC="false"
INSTALL_MODE=$(get_var "INSTALL_MODE")

uninstall_upsc() {
    echo "Uninstalling UPSC and related components..."

    # Stop and disable services
    SERVICES=("nut-server.service" "nut-monitor.service")
    for SERVICE in "${SERVICES[@]}"; do
        if systemctl list-units --type=service --all | grep -q "$SERVICE"; then
            echo "Stopping and disabling $SERVICE..."
            $USE_SUDO systemctl stop "$SERVICE"
            $USE_SUDO systemctl disable "$SERVICE"
        else
            echo -e "\033[1;33mWarning: Service $SERVICE not found, skipping stop/disable.\033[0m"
        fi
    done

    # Uninstall nut packages
    if dpkg -l | grep -q "nut-client"; then
        $USE_SUDO apt-get purge -y nut-client
    fi
    if dpkg -l | grep -q "nut-server"; then
        $USE_SUDO apt-get purge -y nut-server
    fi
    if dpkg -l | grep -q "nut"; then
        $USE_SUDO apt-get purge -y nut
    fi
    
    $USE_SUDO apt-get autoremove -y

    # Remove configuration files
    $USE_SUDO rm -f "$UPS_CONF" "$UPSD_CONF" "$UPSD_USERS_CONF" "$UPSMON_CONF"

    # Check for and uninstall apache2
    if dpkg -l | grep -q "apache2"; then
        echo "Uninstalling apache2 as it is a dependency..."
        if systemctl list-units --type=service --all | grep -q "apache2.service"; then
            $USE_SUDO systemctl stop apache2.service
            $USE_SUDO systemctl disable apache2.service
        else
            echo -e "\033[1;33mWarning: Service apache2.service not found, skipping stop/disable.\033[0m"
        fi
        $USE_SUDO apt-get purge -y apache2
    fi
    
    echo "UPSC uninstallation complete."
}

if [ "$INSTALL_UPSC" = "false" ]; then
    echo "Skipping UPSC installation and performing uninstallation instead, INSTALL_UPSC: $INSTALL_UPSC, INSTALL_MODE: $INSTALL_MODE"
    uninstall_upsc
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
