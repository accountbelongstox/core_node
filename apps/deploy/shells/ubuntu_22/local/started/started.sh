#!/bin/bash

# 定义颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # 无颜色

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

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
