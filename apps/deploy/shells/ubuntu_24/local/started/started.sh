#!/bin/bash

# Define colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No color

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Existing code retained
if command -v bt &> /dev/null; then
  echo -e "${GREEN}bt command found, executing bt...${NC}"
  bt 3
else
  echo -e "${RED}bt command not found, please install bt.${NC}"
fi

if command -v docker &> /dev/null; then
  echo -e "${GREEN}docker command found, starting docker...${NC}"
  sudo service docker start
else
  echo -e "${RED}docker command not found, please install docker.${NC}"
fi

if command -v docker-compose &> /dev/null; then
  echo -e "${GREEN}docker-compose command found, starting docker-compose...${NC}"
  sudo docker-compose up -d
else
  echo -e "${RED}docker-compose command not found, please install docker-compose.${NC}"
fi

if ! command -v bt &> /dev/null || ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}One or more required commands are missing. Please execute dd.sh to install the missing commands.${NC}"
  echo -e "${RED}Choose 1. install the server. -> 3) local installation.${NC}"
fi

# New functionality

# Create /www directory
if [ ! -d "/www" ]; then
  echo -e "${GREEN}Creating /www directory...${NC}"
  sudo mkdir -p /www
else
  echo -e "${GREEN}/www directory already exists.${NC}"
fi

# Bind /www/programing directory to D:/programing
if [ ! -d "/www/programing" ]; then
  echo -e "${GREEN}Creating /www/programing directory...${NC}"
  sudo mkdir -p /www/programing
fi

if grep -q "/www/programing" /etc/fstab; then
  echo -e "${GREEN}/www/programing is already bound to D:/programing.${NC}"
else
  echo -e "${GREEN}Binding /www/programing to D:/programing...${NC}"
  sudo mount --bind /mnt/d/programing /www/programing
  echo "/mnt/d/programing /www/programing none bind 0 0" | sudo tee -a /etc/fstab > /dev/null
fi

# Install essential software
install_package_if_missing() {
  PACKAGE_NAME=$1
  if ! command -v $PACKAGE_NAME &> /dev/null; then
    echo -e "${GREEN}Installing ${PACKAGE_NAME}...${NC}"
    sudo apt-get update && sudo apt-get install -y $PACKAGE_NAME
  else
    echo -e "${GREEN}${PACKAGE_NAME} is already installed.${NC}"
  fi
}

install_package_if_missing "git"
install_package_if_missing "curl"
install_package_if_missing "wget"

# Handle node_core directory
if [ ! -d "/mnt/d/programing/node_core" ]; then
  echo -e "${GREEN}Cloning node_core into /mnt/d/programing/node_core...${NC}"
  git clone http://git.local.12gm.com:5021/adminroot/core_node.git /mnt/d/programing/node_core
else
  echo -e "${GREEN}/mnt/d/programing/node_core already exists.${NC}"
fi

# Make dd.sh script executable
if [ -f "${CURRENT_DIR}/dd.sh" ]; then
  echo -e "${GREEN}Setting dd.sh as executable...${NC}"
  sudo chmod +x "${CURRENT_DIR}/dd.sh"
fi

# Check if dd.sh has already been installed
if command -v bt &> /dev/null && command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
  echo -e "${GREEN}All required software is already installed.${NC}"
else
  echo -e "${RED}One or more required commands are missing. Please execute dd.sh to install the missing commands.${NC}"
  echo -e "${RED}Choose 1. install the server. -> 3) local installation.${NC}"
fi
