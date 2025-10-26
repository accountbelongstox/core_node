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
# Check if aliyun.service is running
if systemctl is-active --quiet aliyun.service; then
    echo "aliyun.service is running. Proceeding with uninstallation."

    # Download and execute the uninstallation scripts
    $USE_SUDO wget "http://update2.aegis.aliyun.com/download/uninstall.sh" && chmod +x uninstall.sh &&./uninstall.sh
    $USE_SUDO wget http://update.aegis.aliyun.com/download/quartz_uninstall.sh && chmod +x quartz_uninstall.sh &&./quartz_uninstall.sh
    $USE_SUDO wget http://update.aegis.aliyun.com/download/uninstall.sh && chmod +x uninstall.sh &&./uninstall.sh

    # Additional cleanup commands
    echo "Uninstalling Aliyun service..."
    $USE_SUDO pkill aliyun-service
    $USE_SUDO rm -fr /etc/init.d/agentwatch /usr/sbin/aliyun-service
    $USE_SUDO rm -rf /usr/local/aegis*
    $USE_SUDO systemctl stop aliyun.service
    $USE_SUDO systemctl disable aliyun.service
    $USE_SUDO rm -rf /usr/local/share/assist-daemon
    $USE_SUDO rm -rf /usr/local/share/aliyun-assis
fi

if systemctl list-units --full -all | grep -Fq "aliyun"; then
    echo "aliyun.service exists, stopping the service..."
    $USE_SUDO systemctl stop aliyun
fi

if systemctl list-units --full -all | grep -Fq "aegis"; then
    echo "aegis.service exists, stopping the service..."
    $USE_SUDO systemctl stop aegis
fi

if systemctl list-units --full -all | grep -Fq "aliyun"; then
    echo "aliyun.service exists, disabling the service..."
    $USE_SUDO systemctl disable aliyun
fi

if systemctl list-units --full -all | grep -Fq "aegis"; then
    echo "aegis.service exists, disabling the service..."
    $USE_SUDO systemctl disable aegis
fi

SERVICE_FILE="/etc/init.d/aliyun"
if [ -f "$SERVICE_FILE" ]; then
    echo "aliyun.service exists, stopping the service..."
    $USE_SUDO systemctl stop aliyun
fi
