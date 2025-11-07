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

# AI Translator App - Start Script (Linux/Unix)
# This script checks for dependencies and starts the application

set -e

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$APP_DIR")")"
NODE_MODULES="$PROJECT_ROOT/node_modules"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m'

echo -e "${CYAN}========================================"
echo -e "AI Translator App - Start Script"
echo -e "========================================${NC}"
echo ""

# Function to check if pnpm is installed
check_pnpm_installed() {
    if command -v pnpm &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to check if node_modules exists and is valid
check_node_modules_valid() {
    local path=$1

    if [ ! -d "$path" ]; then
        return 1
    fi

    local module_count=$(find "$path" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)

    if [ "$module_count" -lt 10 ]; then
        return 1
    fi

    return 0
}

# Step 1: Check project root
echo -e "${YELLOW}[1/4] Checking project root...${NC}"
echo -e "${GRAY}      Project root: $PROJECT_ROOT${NC}"

if [ ! -d "$PROJECT_ROOT" ]; then
    echo -e "${RED}[ERROR] Project root not found: $PROJECT_ROOT${NC}"
    exit 1
fi

if [ ! -f "$PROJECT_ROOT/main.js" ]; then
    echo -e "${RED}[ERROR] main.js not found in project root${NC}"
    exit 1
fi

echo -e "${GREEN}[OK] Project root verified${NC}"
echo ""

# Step 2: Check node_modules
echo -e "${YELLOW}[2/4] Checking dependencies...${NC}"
echo -e "${GRAY}      node_modules: $NODE_MODULES${NC}"

if ! check_node_modules_valid "$NODE_MODULES"; then
    echo -e "${YELLOW}[WARN] node_modules not found or incomplete${NC}"
    echo ""

    # Check if pnpm is installed
    if ! check_pnpm_installed; then
        echo -e "${RED}[ERROR] pnpm is not installed${NC}"
        echo -e "${CYAN}[INFO] Please install pnpm first:${NC}"
        echo -e "${GRAY}       npm install -g pnpm${NC}"
        echo -e "${GRAY}       or curl -fsSL https://get.pnpm.io/install.sh | sh -${NC}"
        exit 1
    fi

    echo -e "${CYAN}[INFO] Installing dependencies with pnpm...${NC}"

    cd "$PROJECT_ROOT"

    echo -e "${GRAY}[CMD] pnpm install${NC}"

    if ! pnpm install; then
        echo -e "${RED}[ERROR] pnpm install failed${NC}"
        exit 1
    fi

    echo -e "${GREEN}[OK] Dependencies installed successfully${NC}"
else
    echo -e "${GREEN}[OK] Dependencies already installed${NC}"
fi

echo ""

# Step 3: Verify configuration
echo -e "${YELLOW}[3/4] Verifying configuration...${NC}"

CONFIG_FILE="$APP_DIR/config/index.js"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}[WARN] Configuration file not found: $CONFIG_FILE${NC}"
else
    echo -e "${GREEN}[OK] Configuration file exists${NC}"
fi

echo ""

# Step 4: Start application
echo -e "${YELLOW}[4/4] Starting application...${NC}"
echo -e "${GRAY}      App: ai_translator_app${NC}"
echo -e "${GRAY}      Command: node main.js app=ai_translator_app${NC}"
echo ""

cd "$PROJECT_ROOT"

echo -e "${CYAN}========================================"
echo -e "Application Output:"
echo -e "========================================${NC}"
echo ""

node ./main.js app=ai_translator_app

EXIT_CODE=$?

echo ""
echo -e "${CYAN}========================================"
echo -e "Application exited with code: $EXIT_CODE"
echo -e "========================================${NC}"

exit $EXIT_CODE
