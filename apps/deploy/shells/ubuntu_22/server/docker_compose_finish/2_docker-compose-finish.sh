#!/bin/bash

# Determine current and deploy directories
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEPLOY_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$CURRENT_DIR")")")")
TEMPLATE_DIR="$DEPLOY_DIR/template"
DOCKER_COMPOSE_TEMPLATE_DIR="$TEMPLATE_DIR/docker_compose"
SERVER_DIR=$(dirname "$CURRENT_DIR")
DOCKER_AFTER_DIR="$SERVER_DIR/docker_after"

# Directory for temporary info
TMP_INFO_DIR="/usr/local/.pcore_local/deploy/"

# Reading necessary configurations from TMP_INFO_DIR
PARENT_DIR=$(dirname "$(dirname "$(readlink -f "$0")")")
PYTHON_MAIN_SCRIPT=$(cat "$TMP_INFO_DIR/.PYTHON_MAIN_SCRIPT")
PYTHON_EXECUTABLE=$(cat "$TMP_INFO_DIR/.PYTHON_EXECUTABLE")
MAIN_DIR=$(cat "$TMP_INFO_DIR/.MAIN_DIR")
WEB_DIR=$(cat "$TMP_INFO_DIR/.WEB_DIR")
BT_IMAGE=$(cat "$TMP_INFO_DIR/.BT_IMAGE")
DOCKER_DATA=$(cat "$TMP_INFO_DIR/.DOCKER_DATA")
SERVICE_DIR=$(cat "$TMP_INFO_DIR/.SERVICE_DIR")
BT_USER=$(cat "$TMP_INFO_DIR/.BT_USER")
BT_PWD=$(cat "$TMP_INFO_DIR/.BT_PWD")
BT_ENTRY=$(cat "$TMP_INFO_DIR/.BT_ENTRY")
POSTGRES_USER=$(cat "$TMP_INFO_DIR/.POSTGRES_USER")
POSTGRES_PASSWORD=$(cat "$TMP_INFO_DIR/.POSTGRES_PASSWORD")
SAMBA_USER=$(cat "$TMP_INFO_DIR/.SAMBA_USER")
SAMBA_PWD=$(cat "$TMP_INFO_DIR/.SAMBA_PWD")
MYSQL_ROOT_USER=$(cat "$TMP_INFO_DIR/.MYSQL_ROOT_USER")
MYSQL_ROOT_PASSWORD=$(cat "$TMP_INFO_DIR/.MYSQL_ROOT_PASSWORD")
MYSQL_USER=$(cat "$TMP_INFO_DIR/.MYSQL_USER")
MYSQL_PASSWORD=$(cat "$TMP_INFO_DIR/.MYSQL_PASSWORD")
ZEROTIER_DOMAIN=$(cat "$TMP_INFO_DIR/.ZEROTIER_DOMIAN")
ZTNCUI_PASSWD=$(cat "$TMP_INFO_DIR/.ZTNCUI_PASSWD")
SAMBA_SHARE_DIR=$(cat "$TMP_INFO_DIR/.SAMBA_SHARE_DIR")
UPS_USER=$(cat "$TMP_INFO_DIR/.UPS_USER")
UPS_DEVICES=$(cat "$TMP_INFO_DIR/.UPS_DEVICES")
UPS_ADMIN_PASSWORD=$(cat "$TMP_INFO_DIR/.UPS_ADMIN_PASSWORD")
UPS_PORT=$(cat "$TMP_INFO_DIR/.UPS_PORT")
UPS_API_USER=$(cat "$TMP_INFO_DIR/.UPS_API_USER")
UPS_API_PASSWORD=$(cat "$TMP_INFO_DIR/.UPS_API_PASSWORD")
WEBNUT_PORT=$(cat "$TMP_INFO_DIR/.WEBNUT_PORT")

RED='\033[0;31m'
NC='\033[0m'

# Check for docker compose select file
DOCKER_COMPOSE_SELECT_FILE="$TMP_INFO_DIR/.DOCKER_COMPOSE_SELECT"
if [ ! -f "$DOCKER_COMPOSE_SELECT_FILE" ]; then
    echo -e "${RED}Error: .DOCKER_COMPOSE_SELECT file not found. Current docker image not built.${NC}"
    exit 1
else
    DOCKER_COMPOSE=$(cat "$DOCKER_COMPOSE_SELECT_FILE")
fi

if [ -z "$DOCKER_COMPOSE" ]; then
    echo -e "${RED}Error: No docker_compose configuration found in $DOCKER_COMPOSE_SELECT_FILE.${NC}"
    exit 1
else
    echo "Generating docker-compose file based on selected services: $DOCKER_COMPOSE"
fi

IFS=' ' read -ra services <<< "$DOCKER_COMPOSE"

# Execute each service script
for service in "${services[@]}"; do
    case "$service" in
        node*)
            echo "Running: $DOCKER_AFTER_DIR/nodejs.sh $service"
            "$DOCKER_AFTER_DIR/nodejs.sh" "$service"
            ;;
        *)
            SERVICE_SCRIPT="$DOCKER_AFTER_DIR/${service}.sh"
            if [ -f "$SERVICE_SCRIPT" ]; then
                echo "Setting: $service"
                "$SERVICE_SCRIPT"
            fi
            ;;
    esac
done

# Execute the final script
"$DOCKER_AFTER_DIR/public_info_print.sh"
