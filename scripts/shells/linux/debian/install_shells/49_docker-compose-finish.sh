#!/bin/bash
n# Include common functions
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

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEPLOY_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$CURRENT_DIR")")")")
TEMPLATE_DIR="$DEPLOY_DIR/template"
DOCKER_COMPOSE_TEMPLATE_DIR="$TEMPLATE_DIR/docker_compose"
SERVER_DIR=$(dirname "$CURRENT_DIR")
DOCKER_AFTER_DIR="$SERVER_DIR/docker_after"

# Source global variables
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Check if Docker installation is enabled
INSTALL_DOCKER=$(get_var "INSTALL_DOCKER")
if [ "$INSTALL_DOCKER" != "true" ]; then
    echo "[49] Skipping Docker Compose finish (INSTALL_DOCKER: $INSTALL_DOCKER)"
    exit 0
fi

TMP_INFO_DIR="/usr/local/.pcore_local/deploy/"

PARENT_DIR=$(dirname "$(dirname "$($USE_SUDO readlink -f "$0")")")
PYTHON_MAIN_SCRIPT=$($USE_SUDO cat "$TMP_INFO_DIR/.PYTHON_MAIN_SCRIPT")
PYTHON_EXECUTABLE=$($USE_SUDO cat "$TMP_INFO_DIR/.PY_VENV_DIR")
MAIN_DIR=$($USE_SUDO cat "$TMP_INFO_DIR/.MAIN_DIR")
WEB_DIR=$($USE_SUDO cat "$TMP_INFO_DIR/.WEB_DIR")
BT_IMAGE=$($USE_SUDO cat "$TMP_INFO_DIR/.BT_IMAGE")
DOCKER_DATA=$($USE_SUDO cat "$TMP_INFO_DIR/.DOCKER_DATA")
SERVICE_DIR=$($USE_SUDO cat "$TMP_INFO_DIR/.SERVICE_DIR")
BT_USER=$($USE_SUDO cat "$TMP_INFO_DIR/.BT_USER")
BT_PWD=$($USE_SUDO cat "$TMP_INFO_DIR/.BT_PWD")
BT_ENTRY=$($USE_SUDO cat "$TMP_INFO_DIR/.BT_ENTRY")
POSTGRES_USER=$($USE_SUDO cat "$TMP_INFO_DIR/.POSTGRES_USER")
POSTGRES_PASSWORD=$($USE_SUDO cat "$TMP_INFO_DIR/.POSTGRES_PASSWORD")
SAMBA_USER=$($USE_SUDO cat "$TMP_INFO_DIR/.SAMBA_USER")
SAMBA_PWD=$($USE_SUDO cat "$TMP_INFO_DIR/.SAMBA_PWD")
MYSQL_ROOT_USER=$($USE_SUDO cat "$TMP_INFO_DIR/.MYSQL_ROOT_USER")
MYSQL_ROOT_PASSWORD=$($USE_SUDO cat "$TMP_INFO_DIR/.MYSQL_ROOT_PASSWORD")
MYSQL_USER=$($USE_SUDO cat "$TMP_INFO_DIR/.MYSQL_USER")
MYSQL_PASSWORD=$($USE_SUDO cat "$TMP_INFO_DIR/.MYSQL_PASSWORD")
ZEROTIER_DOMAIN=$($USE_SUDO cat "$TMP_INFO_DIR/.ZEROTIER_DOMIAN")
ZTNCUI_PASSWD=$($USE_SUDO cat "$TMP_INFO_DIR/.ZTNCUI_PASSWD")
SAMBA_SHARE_DIR=$($USE_SUDO cat "$TMP_INFO_DIR/.SAMBA_SHARE_DIR")
UPS_USER=$($USE_SUDO cat "$TMP_INFO_DIR/.UPS_USER")
UPS_DEVICES=$($USE_SUDO cat "$TMP_INFO_DIR/.UPS_DEVICES")
UPS_ADMIN_PASSWORD=$($USE_SUDO cat "$TMP_INFO_DIR/.UPS_ADMIN_PASSWORD")
UPS_PORT=$($USE_SUDO cat "$TMP_INFO_DIR/.UPS_PORT")
UPS_API_USER=$($USE_SUDO cat "$TMP_INFO_DIR/.UPS_API_USER")
UPS_API_PASSWORD=$($USE_SUDO cat "$TMP_INFO_DIR/.UPS_API_PASSWORD")
WEBNUT_PORT=$($USE_SUDO cat "$TMP_INFO_DIR/.WEBNUT_PORT")

RED='\033[0;31m'
NC='\033[0m'

DOCKER_COMPOSE_SELECT_FILE="$TMP_INFO_DIR/.DOCKER_COMPOSE_SELECT"
if [ ! -f "$DOCKER_COMPOSE_SELECT_FILE" ]; then
    echo -e "${RED}Error: .DOCKER_COMPOSE_SELECT file not found. Current docker image not built.${NC}"
    exit 1
else
    DOCKER_COMPOSE=$($USE_SUDO cat "$DOCKER_COMPOSE_SELECT_FILE")
fi

if [ -z "$DOCKER_COMPOSE" ]; then
    echo -e "${RED}Error: No docker_compose configuration found in $DOCKER_COMPOSE_SELECT_FILE.${NC}"
    exit 1
else
    echo "Generating docker-compose file based on selected services: $DOCKER_COMPOSE"
fi

IFS=' ' read -ra services <<< "$DOCKER_COMPOSE"

for service in "${services[@]}"; do
    case "$service" in
        node*)
            echo "Running: $DOCKER_AFTER_DIR/nodejs.sh $service"
            $USE_SUDO "$DOCKER_AFTER_DIR/nodejs.sh" "$service"
            ;;
        *)
            SERVICE_SCRIPT="$DOCKER_AFTER_DIR/${service}.sh"
            if [ -f "$SERVICE_SCRIPT" ]; then
                echo "Setting: $service"
                $USE_SUDO "$SERVICE_SCRIPT"
            fi
            ;;
    esac
done

$USE_SUDO "$DOCKER_AFTER_DIR/public_info_print.sh"
