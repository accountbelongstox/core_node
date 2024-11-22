#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if 'bt' command exists
if command -v bt &> /dev/null; then
  echo -e "${GREEN}bt command found, executing bt...${NC}"
  bt 3
  bt 14
else
  echo -e "${RED}bt command not found, please install bt.${NC}"
fi

# Check if 'docker' command exists and start the docker service
if command -v docker &> /dev/null; then
  echo -e "${GREEN}docker command found, starting docker...${NC}"
  sudo systemctl start docker
else
  echo -e "${RED}docker command not found, please install docker.${NC}"
fi

# Check if 'docker-compose' command exists and start docker-compose
if command -v docker-compose &> /dev/null; then
  echo -e "${GREEN}docker-compose command found, starting docker-compose...${NC}"
  sudo docker-compose up -d
else
  echo -e "${RED}docker-compose command not found, please install docker-compose.${NC}"
fi

# Check if any required commands are missing and provide instructions
if ! command -v bt &> /dev/null || ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}One or more required commands are missing. Please execute dd.sh to install the missing commands.${NC}"
  echo -e "${RED}Choose 1. install the server. -> 3) local installation.${NC}"
fi
