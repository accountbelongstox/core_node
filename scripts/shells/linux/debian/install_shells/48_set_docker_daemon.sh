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
SHELLS_SCRIPTS_DIR="$(dirname "$PARENT_DIR_LEVEL_2")/scripts"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
INSTALL_DOCKER=$(get_var "INSTALL_DOCKER")
INSTALL_MODE=$(get_var "INSTALL_MODE")

# Source /etc/environment for CLOUD_PROVIDER
if [ -f /etc/environment ]; then
    set -a
    source /etc/environment
    set +a
fi

# Get region information
SELECTED_REGION=$(get_var "SELECTED_REGION")
CLOUD_PROVIDER=${CLOUD_PROVIDER:-$(get_var "CLOUD_PROVIDER")}

if [ "$INSTALL_DOCKER" = "false" ]; then
    echo "Skipping Docker installation,INSTALL_DOCKER: $INSTALL_DOCKER,INSTALL_MODE: $INSTALL_MODE" 
    exit 0
fi

echo "Calling update_docker_dns_mirror.js with CLOUD_PROVIDER='$CLOUD_PROVIDER' SELECTED_REGION='$SELECTED_REGION'..."
node "$SHELLS_SCRIPTS_DIR/update_docker_dns_mirror.js" "$CLOUD_PROVIDER" "$SELECTED_REGION"
result=$?

if [ $result -eq 2 ]; then
    echo -e "\033[33mDocker configuration updated. Docker needs to be restarted.\033[0m"
    $USE_SUDO systemctl restart docker
    echo -e "\033[32mDocker restarted.\033[0m"
elif [ $result -eq 0 ]; then
    echo -e "\033[32mNo Docker configuration changes needed.\033[0m"
else
    echo -e "\033[31mAn error occurred while updating Docker configuration.\033[0m"
fi

