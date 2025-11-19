#!/bin/bash

# VRISTO Nuxt.js Project Development Startup Script
# Function: Check dependencies, display IP addresses, start development server

# Define color variables
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
RESET="\033[0m"

# Check if node_modules directory exists
if [ ! -d "node_modules" ]; then
    echo "No node_modules directory detected, installing dependencies..."
    # Check if yarn is installed
    if command -v yarn &> /dev/null; then
        echo "Using yarn to install dependencies..."
        yarn install
    else
        echo "Using npm to install dependencies..."
        npm install
    fi

    if [ $? -ne 0 ]; then
        echo -e "${RED}Dependency installation failed, please check network connection or run installation command manually.${RESET}"
        exit 1
    fi
    
    echo -e "${GREEN}Dependencies installation completed!${RESET}"
else
    echo -e "${GREEN}node_modules directory exists, skipping installation step.${RESET}"
fi

# Get all available IP addresses
echo -e "\n${CYAN}Available IP addresses:${RESET}"
if command -v ip &> /dev/null; then
    # Linux systems use ip command
    ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | while read -r ip; do
        echo -e "${YELLOW}http://$ip:5173${RESET}"
    done
elif command -v ifconfig &> /dev/null; then
    # macOS systems use ifconfig command
    ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | while read -r ip; do
        echo -e "${YELLOW}http://$ip:5173${RESET}"
    done
else
    # If above commands are not available, try using hostname command
    if command -v hostname &> /dev/null; then
        ip=$(hostname -I | awk '{print $1}')
        if [ ! -z "$ip" ]; then
            echo -e "${YELLOW}http://$ip:5173${RESET}"
        else
            echo "Unable to get IP address, please check network configuration."
        fi
    else
        echo "Unable to get IP address, please check network configuration."
    fi
fi

echo -e "\n${CYAN}Local access address:${RESET}"
echo -e "${YELLOW}http://localhost:5173${RESET}"

# Start development server
echo -e "\n${GREEN}Starting development server...${RESET}"

# Check if yarn is installed
if command -v yarn &> /dev/null; then
    echo -e "${CYAN}Using command: yarn dev -- --host=0.0.0.0${RESET}"
    yarn dev -- --host=0.0.0.0
else
    echo -e "${CYAN}Using command: npm run dev -- --host=0.0.0.0${RESET}"
    npm run dev -- --host=0.0.0.0
fi