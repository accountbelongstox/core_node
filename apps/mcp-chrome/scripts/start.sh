#!/bin/bash

# ======================================
# Chrome MCP Server Startup Script
# ======================================
# Functions:
# 1. Check and install dependencies
# 2. Build all components (shared, native-server, chrome-extension)
# 3. Register Native Messaging Host
# 4. Provide extension loading guide
# ======================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

echo -e "${CYAN}"
echo "========================================"
echo "  Chrome MCP Server Startup Script"
echo "========================================"
echo -e "${NC}"

# Navigate to project root
cd "$PROJECT_ROOT"

# ======================================
# Step 1: Check Dependencies
# ======================================
echo -e "${YELLOW}[1/5] Checking dependencies...${NC}"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}  ✓ Node.js: $NODE_VERSION${NC}"

    # Check version >= 18.19.0
    MAJOR_VERSION=$(echo $NODE_VERSION | sed 's/v//' | cut -d'.' -f1)
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        echo -e "${RED}  ✗ Error: Node.js version too low, requires >= 18.19.0${NC}"
        exit 1
    fi
else
    echo -e "${RED}  ✗ Error: Node.js not installed, please install Node.js >= 18.19.0${NC}"
    exit 1
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo -e "${GREEN}  ✓ pnpm: v$PNPM_VERSION${NC}"
else
    echo -e "${YELLOW}  ✗ Error: pnpm not installed, installing...${NC}"
    npm install -g pnpm
    echo -e "${GREEN}  ✓ pnpm installed successfully${NC}"
fi

# ======================================
# Step 2: Build Native Server First (to fix postinstall)
# ======================================
echo -e "\n${YELLOW}[2/5] Building native-server (to enable postinstall)...${NC}"

# Check if shared package dist exists
if [ ! -d "packages/shared/dist" ]; then
    echo -e "${CYAN}  Building shared package first...${NC}"
    cd "packages/shared"
    pnpm install --ignore-scripts
    pnpm run build
    cd "$PROJECT_ROOT"
    echo -e "${GREEN}  ✓ Shared package built${NC}"
fi

# Build native-server without running postinstall
echo -e "${CYAN}  Building native-server...${NC}"
cd "app/native-server"
pnpm install --ignore-scripts
pnpm run build
cd "$PROJECT_ROOT"
echo -e "${GREEN}  ✓ Native server built successfully${NC}"

# ======================================
# Step 3: Install Dependencies
# ======================================
echo -e "\n${YELLOW}[3/5] Installing project dependencies...${NC}"

echo -e "${CYAN}  Installing dependencies (may take a few minutes)...${NC}"
pnpm install
echo -e "${GREEN}  ✓ Dependencies installed successfully${NC}"

# ======================================
# Step 4: Build All Components
# ======================================
echo -e "\n${YELLOW}[4/5] Building all project components...${NC}"

# Build shared package
echo -e "${CYAN}  [4.1] Building shared package (packages/shared)...${NC}"
pnpm run build:shared
echo -e "${GREEN}  ✓ Shared package built successfully${NC}"

# Build native-server (again to ensure latest)
echo -e "\n${CYAN}  [4.2] Rebuilding Native Server (app/native-server)...${NC}"
pnpm run build:native
echo -e "${GREEN}  ✓ Native Server built successfully${NC}"

# Build chrome-extension
echo -e "\n${CYAN}  [4.3] Building Chrome Extension (app/chrome-extension)...${NC}"
pnpm run build:extension
echo -e "${GREEN}  ✓ Chrome Extension built successfully${NC}"

# ======================================
# Step 5: Register Native Messaging Host
# ======================================
echo -e "\n${YELLOW}[5/5] Registering Native Messaging Host...${NC}"

# Run registration script
cd "$PROJECT_ROOT/app/native-server"
node dist/scripts/register-dev.js
cd "$PROJECT_ROOT"
echo -e "${GREEN}  ✓ Native Messaging Host registered successfully${NC}"

# ======================================
# Usage Guide
# ======================================
echo -e "\n${CYAN}========================================${NC}"
echo -e "${GREEN}  BUILD COMPLETE - IMPORTANT FILES${NC}"
echo -e "${CYAN}========================================${NC}"

EXTENSION_PATH="$PROJECT_ROOT/app/chrome-extension/.output/chrome-mv3"
NATIVE_SERVER_DIST="$PROJECT_ROOT/app/native-server/dist"
STDIO_SERVER_PATH="$NATIVE_SERVER_DIST/mcp/mcp-server-stdio.js"
STDIO_CONFIG_PATH="$NATIVE_SERVER_DIST/mcp/stdio-config.json"

echo -e "\n${YELLOW}[IMPORTANT FILES]${NC}"
echo -e "  Chrome Extension (built):"
echo -e "${CYAN}    $EXTENSION_PATH${NC}"
echo -e "\n  Native Messaging Host:"
echo -e "${CYAN}    $NATIVE_SERVER_DIST${NC}"
echo -e "\n  MCP STDIO Server (for Cursor/Claude Desktop):"
echo -e "${CYAN}    $STDIO_SERVER_PATH${NC}"
echo -e "\n  MCP STDIO Config:"
echo -e "${CYAN}    $STDIO_CONFIG_PATH${NC}"

# Check where Native Messaging Host is registered
if [ "$(uname)" == "Darwin" ]; then
    # macOS
    NATIVE_HOST_PATH="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chromemcp.nativehost.json"
else
    # Linux
    NATIVE_HOST_PATH="$HOME/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json"
fi

if [ -f "$NATIVE_HOST_PATH" ]; then
    echo -e "\n  Native Messaging Host Manifest:"
    echo -e "${CYAN}    $NATIVE_HOST_PATH${NC}"
fi

echo -e "\n${CYAN}========================================${NC}"
echo -e "${YELLOW}  SETUP STEPS${NC}"
echo -e "${CYAN}========================================${NC}"

echo -e "\n${YELLOW}[STEP 1] Load Chrome Extension:${NC}"
echo -e "  - Open Chrome: chrome://extensions/"
echo -e "  - Enable 'Developer mode'"
echo -e "  - Click 'Load unpacked'"
echo -e "  - Select: ${CYAN}$EXTENSION_PATH${NC}"

echo -e "\n${YELLOW}[STEP 2] Start MCP Service:${NC}"
echo -e "  - Click Chrome extension icon"
echo -e "  - Click 'Connect' button"
echo -e "  - Service starts on: ${GREEN}http://127.0.0.1:12306${NC}"

echo -e "\n${CYAN}========================================${NC}"
echo -e "${YELLOW}  MCP CLIENT CONFIGURATION${NC}"
echo -e "${CYAN}========================================${NC}"

echo -e "\n${YELLOW}[METHOD 1] Streamable HTTP (Recommended)${NC}"
echo -e "  For: Claude Desktop, CherryStudio, etc."
echo -e "  Config:"
echo -e "${CYAN}"
cat << 'EOF'
  {
    "mcpServers": {
      "chrome-mcp-server": {
        "type": "streamableHttp",
        "url": "http://127.0.0.1:12306/mcp"
      }
    }
  }
EOF
echo -e "${NC}"

echo -e "${YELLOW}[METHOD 2] STDIO (Alternative)${NC}"
echo -e "  For: Cursor, older clients"
echo -e "  Config:"
echo -e "${CYAN}"
cat << EOF
  {
    "mcpServers": {
      "chrome-mcp-server": {
        "command": "node",
        "args": ["$STDIO_SERVER_PATH"]
      }
    }
  }
EOF
echo -e "${NC}"

echo -e "\n  ${NC}Note: STDIO server connects to HTTP server at:"
echo -e "        http://127.0.0.1:12306/mcp (via stdio-config.json)${NC}"

echo -e "\n${CYAN}========================================${NC}"
echo -e "${YELLOW}  Development Mode Commands:${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "  pnpm run dev          # Start all components in dev mode"
echo -e "  pnpm run dev:native   # Start Native Server in dev mode only"
echo -e "  pnpm run dev:extension # Start Extension in dev mode only"

echo -e "\n${CYAN}========================================${NC}"
echo -e "${YELLOW}  Documentation Links:${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "  • README: $PROJECT_ROOT/README.md"
echo -e "  • Architecture: $PROJECT_ROOT/docs/ARCHITECTURE.md"
echo -e "  • Tools API: $PROJECT_ROOT/docs/TOOLS.md"
echo -e "  • Troubleshooting: $PROJECT_ROOT/docs/TROUBLESHOOTING.md"

echo -e "\n${GREEN}✅ Startup script completed successfully!${NC}\n"
