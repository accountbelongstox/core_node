#!/bin/bash

# Variables
TMP_INFO_DIR="/usr/local/.pcore_local/deploy/"
DOCKER_COMPOSE_SELECT_FILE="$TMP_INFO_DIR/.DOCKER_COMPOSE_SELECT"
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check for docker compose select file
if [ ! -f "$DOCKER_COMPOSE_SELECT_FILE" ]; then
    echo -e "${GREEN}Error: .DOCKER_COMPOSE_SELECT file not found. Current docker image not built.${NC}"
    exit 1
else
    DOCKER_COMPOSE=$(cat "$DOCKER_COMPOSE_SELECT_FILE")
fi

if [ -z "$DOCKER_COMPOSE" ]; then
    echo -e "${GREEN}Error: No docker_compose configuration found in $DOCKER_COMPOSE_SELECT_FILE.${NC}"
    exit 1
else
    echo "Generating docker-compose file based on selected services: $DOCKER_COMPOSE"
fi

IFS=' ' read -ra services <<< "$DOCKER_COMPOSE"

# Variables from TMP_INFO_DIR
BT_USER=$(cat "$TMP_INFO_DIR/.BT_USER")
BT_PWD=$(cat "$TMP_INFO_DIR/.BT_PWD")
SAMBA_USER=$(cat "$TMP_INFO_DIR/.SAMBA_USER")
SAMBA_PWD=$(cat "$TMP_INFO_DIR/.SAMBA_PWD")
SAMBA_SHARE_DIR=$(cat "$TMP_INFO_DIR/.SAMBA_SHARE_DIR")
MYSQL_ROOT_USER=$(cat "$TMP_INFO_DIR/.MYSQL_ROOT_USER")
MYSQL_ROOT_PASSWORD=$(cat "$TMP_INFO_DIR/.MYSQL_ROOT_PASSWORD")
MYSQL_USER=$(cat "$TMP_INFO_DIR/.MYSQL_USER")
MYSQL_PASSWORD=$(cat "$TMP_INFO_DIR/.MYSQL_PASSWORD")
ZEROTIER_DOMAIN=$(cat "$TMP_INFO_DIR/.ZEROTIER_DOMAIN")
ZTNCUI_PASSWD=$(cat "$TMP_INFO_DIR/.ZTNCUI_PASSWD")
POSTGRES_USER=$(cat "$TMP_INFO_DIR/.POSTGRES_USER")
POSTGRES_PASSWORD=$(cat "$TMP_INFO_DIR/.POSTGRES_PASSWORD")
UPS_USER=$(cat "$TMP_INFO_DIR/.UPS_USER")
UPS_DEVICES=$(cat "$TMP_INFO_DIR/.UPS_DEVICES")
UPS_PORT=$(cat "$TMP_INFO_DIR/.UPS_PORT")
UPS_API_USER=$(cat "$TMP_INFO_DIR/.UPS_API_USER")
UPS_API_PASSWORD=$(cat "$TMP_INFO_DIR/.UPS_API_PASSWORD")
WEBNUT_PORT=$(cat "$TMP_INFO_DIR/.WEBNUT_PORT")

# Function to print service credentials
print_service_credentials() {
    local service="$1"
    case "$service" in
        nginx-proxy-manager)
            echo -e "nginx-proxy-manager:"
            echo -e "  user: ${GREEN}admin@example.com${NC}"
            echo -e "  pwd: ${GREEN}changeme${NC}"
            ;;
        baota)
            echo -e "baota:"
            echo -e "  BT_USER: ${GREEN}${BT_USER}${NC}"
            echo -e "  BT_PWD: ${GREEN}${BT_PWD}${NC}"
            ;;
        samba)
            echo -e "samba:"
            echo -e "  SAMBA_USER: ${GREEN}${SAMBA_USER}${NC}"
            echo -e "  SAMBA_PWD: ${GREEN}${SAMBA_PWD}${NC}"
            echo -e "  SAMBA_SHARE_DIR: ${GREEN}${SAMBA_SHARE_DIR}${NC}"
            ;;
        mysql)
            echo -e "mysql:"
            echo -e "  root_account: ${GREEN}${MYSQL_ROOT_USER}${NC}"
            echo -e "  root_password: ${GREEN}${MYSQL_ROOT_PASSWORD}${NC}"
            echo -e "  user_account: ${GREEN}${MYSQL_USER}${NC}"
            echo -e "  user_password: ${GREEN}${MYSQL_PASSWORD}${NC}"
            ;;
        ztncui)
            echo -e "ztncui:"
            echo -e "  ZEROTIER_DOMAIN: ${GREEN}${ZEROTIER_DOMAIN}${NC}"
            echo -e "  ZTNCUI_PASSWD: ${GREEN}${ZTNCUI_PASSWD}${NC}"
            ;;
        postgres)
            echo -e "postgres:"
            echo -e "  POSTGRES_USER: ${GREEN}${POSTGRES_USER}${NC}"
            echo -e "  POSTGRES_PASSWORD: ${GREEN}${POSTGRES_PASSWORD}${NC}"
            ;;
        nut-upsd)
            echo -e "nut-upsd:"
            echo -e "  UPS_USER: ${GREEN}${UPS_USER}${NC}"
            echo -e "  UPS_DEVICES: ${GREEN}${UPS_DEVICES}${NC}"
            echo -e "  UPS_PORT: ${GREEN}${UPS_PORT}${NC}"
            echo -e "  UPS_API_USER: ${GREEN}${UPS_API_USER}${NC}"
            echo -e "  UPS_API_PASSWORD: ${GREEN}${UPS_API_PASSWORD}${NC}"
            ;;
        webnut)
            echo -e "webnut:"
            echo -e "  WEBNUT_PORT: ${GREEN}${WEBNUT_PORT}${NC}"
            ;;
        *)
            echo -e "Sip for ${GREEN}${service}${NC}"
            ;;
    esac
}

# Main execution
echo -e "\nPrinting service credentials:\n"
for service in "${services[@]}"; do
    print_service_credentials "$service"
done
