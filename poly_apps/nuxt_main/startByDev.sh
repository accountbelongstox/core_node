#!/bin/bash
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

# VRISTO Nuxt.js Project Development Startup Script
# Function: Check dependencies, display IP addresses, start development server

# Define color variables
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
RESET="\033[0m"

# Function to install yarn globally if not present
install_yarn() {
    echo -e "${YELLOW}Yarn not found. Installing yarn globally...${RESET}"
    
    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: npm is not installed. Please install Node.js first.${RESET}"
        exit 1
    fi
    
    # Install yarn globally
    echo -e "${CYAN}Installing yarn globally using npm...${RESET}"
    npm install -g yarn
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install yarn globally. Please check your npm configuration or run 'npm install -g yarn' manually.${RESET}"
        exit 1
    fi
    
    echo -e "${GREEN}Yarn installed successfully!${RESET}"
}

# Check if node_modules directory exists
if [ ! -d "node_modules" ]; then
    echo "No node_modules directory detected, installing dependencies..."
    
    # Check if yarn is installed
    if command -v yarn &> /dev/null; then
        echo -e "${CYAN}Using yarn to install dependencies...${RESET}"
        yarn install
        yarn install         2
    else
        # Install yarn if not present
        install_yarn
        
        # Now use yarn to install dependencies
        echo -e "${CYAN}Using yarn to install dependencies...${RESET}"
        yarn install
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

# Check if yarn is installed (shoul

d be available now after installation)
if command -v yarn &> /dev/null; then
    echo -e "${CYAN}Using command: yarn dev -- --host=0.0.0.0${RESET}"
    yarn dev -- --host=0.0.0.0
else
    # Fallback to npm if yarn installation failed
    echo -e "${YELLOW}Yarn not available, falling back to npm...${RESET}"
    echo -e "${CYAN}Using command: npm run dev -- --host=0.0.0.0${RESET}"
    npm run dev -- --host=0.0.0.0
fi