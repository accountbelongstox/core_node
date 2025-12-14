#!/bin/bash
# Chrome MCP Server Startup Script (Linux/macOS)
# Entry script - only responsible for calling Python and executing commands
# No business logic here

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
DARK_GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Get project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Import variable management library and key definitions
source "$SCRIPT_DIR/var_keys.sh"
source "$SCRIPT_DIR/var_manager.sh"

echo -e "\n${CYAN}========================================${NC}"
echo -e "${CYAN}  Chrome MCP Server - Linux/macOS${NC}"
echo -e "${CYAN}========================================\n${NC}"

# Change to project root
cd "$PROJECT_ROOT"

# ======================================
# Step 1: Call Python for processing
# ======================================
echo -e "${YELLOW}[Python] Processing build configuration...${NC}"
echo ""

PYTHON_SCRIPT="$SCRIPT_DIR/build_orchestrator.py"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}ERROR: Python 3 is not installed or not in PATH${NC}"
    echo -e "${YELLOW}Please install Python 3.7+ from https://www.python.org/${NC}"
    exit 1
fi

# Run Python script
if ! python3 "$PYTHON_SCRIPT"; then
    error=$(get_var "$VAR_KEY_ERROR" || echo "Unknown error")
    echo ""
    echo -e "${RED}ERROR: Python processing failed: $error${NC}"
    exit 1
fi

echo ""

# ======================================
# Step 2: Read variables and execute build commands
# ======================================

# Read UI title
ui_title=$(get_var "$VAR_KEY_UI_TITLE" || echo "Chrome MCP Server Setup")
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  $ui_title${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Step 1: Check dependencies
step1=$(get_var "$VAR_KEY_UI_STEP_1" || echo "Checking dependencies...")
echo -e "${YELLOW}[1/6] $step1${NC}"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}  ✓ Node.js: $NODE_VERSION${NC}"
else
    echo -e "${RED}  ✗ ERROR: Node.js not installed${NC}"
    exit 1
fi

if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo -e "${GREEN}  ✓ pnpm: v$PNPM_VERSION${NC}"
else
    echo -e "${RED}  ✗ ERROR: pnpm not installed${NC}"
    exit 1
fi

# Step 2: Install dependencies
echo ""
step2=$(get_var "$VAR_KEY_UI_STEP_2" || echo "Installing dependencies...")
echo -e "${YELLOW}[2/6] $step2${NC}"

should_install=$(get_var "$VAR_KEY_SHOULD_INSTALL" || echo "false")
if [ "$should_install" = "true" ]; then
    cmd_install=$(get_var "$VAR_KEY_CMD_INSTALL")
    echo -e "${CYAN}  Installing dependencies...${NC}"
    eval "$cmd_install"
    if [ $? -ne 0 ]; then
        echo -e "${RED}  ✗ ERROR: Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}  ✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}  ✓ Dependencies already installed${NC}"
fi

# Step 3: Build Shared package
echo ""
step3=$(get_var "$VAR_KEY_UI_STEP_3" || echo "Building shared package...")
echo -e "${YELLOW}[3/6] $step3${NC}"

cmd_build_shared=$(get_var "$VAR_KEY_CMD_BUILD_SHARED")
echo -e "${CYAN}  Building chrome-mcp-shared...${NC}"
eval "$cmd_build_shared"
if [ $? -ne 0 ]; then
    echo -e "${RED}  ✗ ERROR: Failed to build shared package${NC}"
    exit 1
fi

shared_path=$(get_var "$VAR_KEY_SHARED_PATH")
if [ -d "$shared_path" ]; then
    echo -e "${GREEN}  ✓ Shared package built successfully${NC}"
fi

# Step 4: Build Native Server
echo ""
step4=$(get_var "$VAR_KEY_UI_STEP_4" || echo "Building Native Server...")
echo -e "${YELLOW}[4/6] $step4${NC}"

cmd_build_native=$(get_var "$VAR_KEY_CMD_BUILD_NATIVE")
echo -e "${CYAN}  Building mcp-chrome-bridge...${NC}"
eval "$cmd_build_native"
if [ $? -ne 0 ]; then
    echo -e "${RED}  ✗ ERROR: Failed to build Native Server${NC}"
    exit 1
fi

native_path=$(get_var "$VAR_KEY_NATIVE_PATH")
run_host_sh="$native_path/run_host.sh"
if [ -f "$run_host_sh" ]; then
    echo -e "${GREEN}  ✓ Native Server built successfully${NC}"
    chmod +x "$run_host_sh"
fi

# Step 5: Build Chrome Extension
echo ""
step5=$(get_var "$VAR_KEY_UI_STEP_5" || echo "Building Chrome Extension...")
echo -e "${YELLOW}[5/6] $step5${NC}"

cmd_build_extension=$(get_var "$VAR_KEY_CMD_BUILD_EXTENSION")
retry_max=$(get_var "$VAR_KEY_BUILD_RETRY_MAX" || echo "3")

attempt=1
while [ $attempt -le $retry_max ]; do
    if [ $attempt -gt 1 ]; then
        echo -e "${YELLOW}  ⚠ Retrying build (attempt $attempt/$retry_max)...${NC}"
        sleep 2
    fi

    eval "$cmd_build_extension"

    extension_path=$(get_var "$VAR_KEY_EXTENSION_PATH")
    manifest_json="$extension_path/manifest.json"

    if [ -f "$manifest_json" ]; then
        echo -e "${GREEN}  ✓ Chrome Extension built successfully${NC}"
        break
    fi

    attempt=$((attempt + 1))
done

if [ $attempt -gt $retry_max ]; then
    echo -e "${RED}  ✗ ERROR: Failed to build Chrome Extension after $retry_max attempts${NC}"
    exit 1
fi

# Step 6: Register Native Messaging Host
echo ""
step6=$(get_var "$VAR_KEY_UI_STEP_6" || echo "Registering Native Messaging Host...")
echo -e "${YELLOW}[6/6] $step6${NC}"

cmd_register=$(get_var "$VAR_KEY_CMD_REGISTER")
echo -e "${CYAN}  Using local development registration...${NC}"
eval "$cmd_register"

manifest_path=$(get_var "$VAR_KEY_MANIFEST_PATH")
echo ""
echo -e "${CYAN}  Registration Verification:${NC}"
if [ -f "$manifest_path" ]; then
    echo -e "${GREEN}  ✓ Chrome manifest registered${NC}"
    echo -e "${DARK_GRAY}    Location: $manifest_path${NC}"
fi

# ======================================
# Success Summary
# ======================================
extension_path=$(get_var "$VAR_KEY_EXTENSION_PATH")

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}  [OK] BUILD & REGISTRATION COMPLETE${NC}"
echo -e "${CYAN}========================================${NC}"

echo ""
echo -e "${YELLOW}[IMPORTANT PATHS]${NC}"
echo ""
echo -e "${WHITE}  1) Chrome Extension (Frontend):${NC}"
echo -e "${CYAN}     $extension_path${NC}"
echo ""
echo -e "${WHITE}  2) Native Server (Backend):${NC}"
echo -e "${CYAN}     $native_path${NC}"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${YELLOW}  📋 NEXT STEPS${NC}"
echo -e "${CYAN}========================================${NC}"

echo ""
echo -e "${YELLOW}[STEP 1] Load Extension in Chrome:${NC}"
echo -e "${WHITE}  1. Open Chrome and go to: chrome://extensions/${NC}"
echo -e "${WHITE}  2. Enable 'Developer mode' (toggle in top right)${NC}"
echo -e "${WHITE}  3. Click 'Load unpacked' button${NC}"
echo -e "${WHITE}  4. Select folder: ${CYAN}$extension_path${NC}"

echo ""
echo -e "${YELLOW}[STEP 2] Start MCP Service:${NC}"
echo -e "${WHITE}  1. Click the extension icon in Chrome toolbar${NC}"
echo -e "${WHITE}  2. Click 'Connect' button in popup${NC}"
echo -e "${GREEN}  3. Service will start on: http://127.0.0.1:12306${NC}"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}  [OK] Setup completed successfully!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
