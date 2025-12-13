#!/bin/bash

# ======================================
# Chrome MCP Server Startup Script (Linux/macOS)
# ======================================
# Functions:
# 1. Check and install dependencies
# 2. Build all components (shared, native-server, chrome-extension)
# 3. Register Native Messaging Host (Local Development Version)
# 4. Provide extension loading guide
# ======================================

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

echo -e "\n${CYAN}========================================${NC}"
echo -e "${CYAN}  Chrome MCP Server - Linux/macOS Setup${NC}"
echo -e "${CYAN}========================================\n${NC}"

# Navigate to project root
cd "$PROJECT_ROOT"

# ======================================
# Helper Functions
# ======================================

build_with_retry() {
    local command="$1"
    local component_name="$2"
    local max_retries="${3:-2}"
    local attempt=1

    while [ $attempt -le $max_retries ]; do
        echo -e "${CYAN}  Building $component_name (attempt $attempt/$max_retries)...${NC}"

        if eval "$command"; then
            echo -e "${GREEN}  ✓ $component_name built successfully${NC}"
            return 0
        fi

        if [ $attempt -lt $max_retries ]; then
            echo -e "${YELLOW}  ⚠ Retrying in 2 seconds...${NC}"
            sleep 2
        fi

        attempt=$((attempt + 1))
    done

    echo -e "${RED}  ✗ ERROR: $component_name build failed after $max_retries attempts${NC}"
    return 1
}

# ======================================
# Step 1: Check Dependencies
# ======================================
echo -e "${YELLOW}[1/6] Checking dependencies...${NC}"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}  ✓ Node.js: $NODE_VERSION${NC}"

    # Check version >= 18.19.0
    MAJOR_VERSION=$(echo $NODE_VERSION | sed 's/v//' | cut -d'.' -f1)
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        echo -e "${RED}  ✗ ERROR: Node.js version too low, requires >= 18.19.0${NC}"
        exit 1
    fi
else
    echo -e "${RED}  ✗ ERROR: Node.js not installed${NC}"
    echo -e "${YELLOW}  Please install Node.js >= 18.19.0 from https://nodejs.org/${NC}"
    exit 1
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo -e "${GREEN}  ✓ pnpm: v$PNPM_VERSION${NC}"
else
    echo -e "${YELLOW}  ⚠ pnpm not installed, installing...${NC}"
    npm install -g pnpm
    echo -e "${GREEN}  ✓ pnpm installed successfully${NC}"
fi

# Check Chrome/Chromium
CHROME_INSTALLED=false
CHROMIUM_INSTALLED=false

if command -v google-chrome &> /dev/null || command -v google-chrome-stable &> /dev/null; then
    echo -e "${GREEN}  ✓ Chrome detected${NC}"
    CHROME_INSTALLED=true
elif [ -d "/Applications/Google Chrome.app" ]; then
    echo -e "${GREEN}  ✓ Chrome detected (macOS)${NC}"
    CHROME_INSTALLED=true
fi

if command -v chromium &> /dev/null || command -v chromium-browser &> /dev/null; then
    echo -e "${GREEN}  ✓ Chromium detected${NC}"
    CHROMIUM_INSTALLED=true
elif [ -d "/Applications/Chromium.app" ]; then
    echo -e "${GREEN}  ✓ Chromium detected (macOS)${NC}"
    CHROMIUM_INSTALLED=true
fi

if [ "$CHROME_INSTALLED" = false ] && [ "$CHROMIUM_INSTALLED" = false ]; then
    echo -e "${YELLOW}  ⚠ Chrome/Chromium not detected in default location${NC}"
fi

# ======================================
# Step 2: Install Dependencies
# ======================================
echo -e "\n${YELLOW}[2/6] Installing project dependencies...${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${CYAN}  Installing dependencies (may take a few minutes)...${NC}"
    pnpm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}  ✗ ERROR: Dependency installation failed${NC}"
        exit 1
    fi
    echo -e "${GREEN}  ✓ Dependencies installed successfully${NC}"
else
    echo -e "${GREEN}  ✓ Dependencies already installed (node_modules exists)${NC}"
fi

# ======================================
# Step 3: Build Shared Package
# ======================================
echo -e "\n${YELLOW}[3/6] Building shared package...${NC}"

if ! build_with_retry "pnpm run build:shared" "Shared package" 2; then
    exit 1
fi

# ======================================
# Step 4: Build Native Server
# ======================================
echo -e "\n${YELLOW}[4/6] Building Native Server...${NC}"

if ! build_with_retry "pnpm run build:native" "Native Server" 2; then
    exit 1
fi

# Verify run_host.sh exists
RUN_HOST_PATH="$PROJECT_ROOT/app/native-server/dist/run_host.sh"
if [ -f "$RUN_HOST_PATH" ]; then
    echo -e "${GREEN}  ✓ Startup script: run_host.sh${NC}"
    # Ensure execution permissions
    chmod +x "$RUN_HOST_PATH"
else
    echo -e "${RED}  ✗ ERROR: run_host.sh not found${NC}"
    exit 1
fi

# ======================================
# Step 5: Build Chrome Extension
# ======================================
echo -e "\n${YELLOW}[5/6] Building Chrome Extension...${NC}"

if ! build_with_retry "pnpm run build:extension" "Chrome Extension" 3; then
    exit 1
fi

# Verify extension output
EXTENSION_PATH="$PROJECT_ROOT/app/chrome-extension/.output/chrome-mv3"
if [ -d "$EXTENSION_PATH" ]; then
    echo -e "${GREEN}  ✓ Extension output: .output/chrome-mv3${NC}"
else
    echo -e "${RED}  ✗ ERROR: Extension output not found${NC}"
    exit 1
fi

# ======================================
# Step 6: Register Native Messaging Host
# ======================================
echo -e "\n${YELLOW}[6/6] Registering Native Messaging Host (Local Development)...${NC}"

# Run local registration script
echo -e "${CYAN}  Using local development registration...${NC}"
node scripts/register-local-dev.cjs
if [ $? -ne 0 ]; then
    echo -e "${RED}  ✗ ERROR: Native Messaging Host registration failed${NC}"
    echo -e "${YELLOW}  Tip: Check if Chrome is running and try restarting it${NC}"
    exit 1
fi

# ======================================
# Verify Registration
# ======================================
if [ "$(uname)" == "Darwin" ]; then
    # macOS paths
    CHROME_MANIFEST="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chromemcp.nativehost.json"
    CHROMIUM_MANIFEST="$HOME/Library/Application Support/Chromium/NativeMessagingHosts/com.chromemcp.nativehost.json"
else
    # Linux paths
    CHROME_MANIFEST="$HOME/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json"
    CHROMIUM_MANIFEST="$HOME/.config/chromium/NativeMessagingHosts/com.chromemcp.nativehost.json"
fi

echo -e "\n${CYAN}  Registration Verification:${NC}"
if [ -f "$CHROME_MANIFEST" ]; then
    echo -e "${GREEN}  ✓ Chrome manifest registered${NC}"
    echo -e "${DARK_GRAY}    Location: $CHROME_MANIFEST${NC}"
fi
if [ -f "$CHROMIUM_MANIFEST" ]; then
    echo -e "${GREEN}  ✓ Chromium manifest registered${NC}"
    echo -e "${DARK_GRAY}    Location: $CHROMIUM_MANIFEST${NC}"
fi

# ======================================
# Success Summary
# ======================================
echo -e "\n${CYAN}========================================${NC}"
echo -e "${GREEN}  ✅ BUILD & REGISTRATION COMPLETE${NC}"
echo -e "${CYAN}========================================${NC}"

echo -e "\n${YELLOW}[IMPORTANT PATHS]${NC}"
echo -e "${WHITE}  Chrome Extension:${NC}"
echo -e "${CYAN}    $EXTENSION_PATH${NC}"
echo -e "\n${WHITE}  Native Server:${NC}"
echo -e "${CYAN}    $PROJECT_ROOT/app/native-server/dist${NC}"
echo -e "\n${WHITE}  MCP STDIO Server:${NC}"
echo -e "${CYAN}    $PROJECT_ROOT/app/native-server/dist/mcp/mcp-server-stdio.js${NC}"

# ======================================
# Setup Instructions
# ======================================
echo -e "\n${CYAN}========================================${NC}"
echo -e "${YELLOW}  📋 NEXT STEPS${NC}"
echo -e "${CYAN}========================================${NC}"

echo -e "\n${YELLOW}[STEP 1] Load Extension in Chrome:${NC}"
echo -e "${WHITE}  1. Open Chrome and go to: chrome://extensions/${NC}"
echo -e "${WHITE}  2. Enable 'Developer mode' (toggle in top right)${NC}"
echo -e "${WHITE}  3. Click 'Load unpacked' button${NC}"
echo -e "${WHITE}  4. Select folder: ${CYAN}$EXTENSION_PATH${NC}"
echo -e "\n${YELLOW}  ⚠ Important: Copy the Extension ID after loading${NC}"

echo -e "\n${YELLOW}[STEP 2] Verify Extension ID:${NC}"
echo -e "${WHITE}  1. In chrome://extensions, find your extension${NC}"
echo -e "${WHITE}  2. Copy the Extension ID (e.g., hbdgbgagpkpjffpklnamcljpakneikee)${NC}"
echo -e "${WHITE}  3. Compare with registered ID in manifest file${NC}"
echo -e "\n${YELLOW}  If IDs don't match, run: pnpm run unregister:local${NC}"
echo -e "${YELLOW}  Then update EXTENSION_ID in these files:${NC}"
echo -e "${CYAN}    - app/native-server/src/scripts/constant.ts${NC}"
echo -e "${CYAN}    - scripts/register-local-dev.cjs${NC}"
echo -e "${YELLOW}  Finally run: pnpm run build:native && pnpm run register:local${NC}"

echo -e "\n${YELLOW}[STEP 3] Start MCP Service:${NC}"
echo -e "${WHITE}  1. Click the extension icon in Chrome toolbar${NC}"
echo -e "${WHITE}  2. Click 'Connect' button in popup${NC}"
echo -e "${GREEN}  3. Service will start on: http://127.0.0.1:12306${NC}"

# ======================================
# MCP Client Configuration
# ======================================
echo -e "\n${CYAN}========================================${NC}"
echo -e "${YELLOW}  🔧 MCP CLIENT CONFIGURATION${NC}"
echo -e "${CYAN}========================================${NC}"

echo -e "\n${YELLOW}[Recommended] Streamable HTTP Method:${NC}"
echo -e "${WHITE}  For: Claude Desktop, CherryStudio, etc.${NC}"
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

echo -e "\n${YELLOW}[Alternative] STDIO Method:${NC}"
echo -e "${WHITE}  For: Cursor, older MCP clients${NC}"
STDIO_PATH="$PROJECT_ROOT/app/native-server/dist/mcp/mcp-server-stdio.js"
cat << EOF

  {
    "mcpServers": {
      "chrome-mcp-server": {
        "command": "node",
        "args": ["$STDIO_PATH"]
      }
    }
  }
EOF

# ======================================
# Development Commands
# ======================================
echo -e "\n${CYAN}========================================${NC}"
echo -e "${YELLOW}  🛠️ DEVELOPMENT COMMANDS${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "${WHITE}  pnpm run dev:native      - Watch mode for Native Server${NC}"
echo -e "${WHITE}  pnpm run dev:extension   - Watch mode for Extension${NC}"
echo -e "${WHITE}  pnpm run build:all       - Rebuild all components${NC}"
echo -e "${WHITE}  pnpm run register:local  - Re-register local version${NC}"
echo -e "${WHITE}  pnpm run unregister:local - Unregister local version${NC}"

# ======================================
# Platform-Specific Notes
# ======================================
echo -e "\n${CYAN}========================================${NC}"
if [ "$(uname)" == "Darwin" ]; then
    echo -e "${YELLOW}  💡 macOS-SPECIFIC NOTES${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "${WHITE}  • Manifest location: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts${NC}"
    echo -e "${WHITE}  • Startup script: run_host.sh${NC}"
    echo -e "${WHITE}  • Script permissions: 755 (automatically set)${NC}"
    echo -e "${WHITE}  • If permission issues occur, run: chmod +x app/native-server/dist/run_host.sh${NC}"
else
    echo -e "${YELLOW}  💡 LINUX-SPECIFIC NOTES${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "${WHITE}  • Manifest location: ~/.config/google-chrome/NativeMessagingHosts${NC}"
    echo -e "${WHITE}  • Startup script: run_host.sh${NC}"
    echo -e "${WHITE}  • Script permissions: 755 (automatically set)${NC}"
    echo -e "${WHITE}  • If permission issues occur, run: chmod +x app/native-server/dist/run_host.sh${NC}"
fi

# ======================================
# Troubleshooting
# ======================================
echo -e "\n${CYAN}========================================${NC}"
echo -e "${YELLOW}  🔍 TROUBLESHOOTING${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "${WHITE}  Connection Issues:${NC}"
echo -e "${WHITE}    1. Verify Extension ID matches registration${NC}"
echo -e "${WHITE}    2. Restart Chrome completely${NC}"
echo -e "${WHITE}    3. Check manifest file exists:${NC}"
if [ "$(uname)" == "Darwin" ]; then
    echo -e "${CYAN}       cat \"$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chromemcp.nativehost.json\"${NC}"
else
    echo -e "${CYAN}       cat ~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json${NC}"
fi

echo -e "\n${WHITE}  Port Conflicts:${NC}"
echo -e "${WHITE}    • Check if port 12306 is in use:${NC}"
echo -e "${CYAN}      lsof -i :12306${NC}"
echo -e "${WHITE}    • Kill process if needed:${NC}"
echo -e "${CYAN}      kill -9 \$(lsof -t -i:12306)${NC}"

echo -e "\n${WHITE}  Permission Issues:${NC}"
echo -e "${WHITE}    • Ensure run_host.sh has execute permissions:${NC}"
echo -e "${CYAN}      chmod +x app/native-server/dist/run_host.sh${NC}"
echo -e "${CYAN}      chmod +x app/native-server/dist/index.js${NC}"
echo -e "${CYAN}      chmod +x app/native-server/dist/cli.js${NC}"

echo -e "\n${WHITE}  Build Issues:${NC}"
echo -e "${WHITE}    • If build fails with WASM errors, retry the script${NC}"
echo -e "${WHITE}    • Clean build: rm -rf app/chrome-extension/.output && pnpm run build:extension${NC}"

echo -e "\n${WHITE}  Documentation:${NC}"
echo -e "${CYAN}    • Local Development Guide: LOCAL_DEVELOPMENT_GUIDE.md${NC}"
echo -e "${CYAN}    • Configuration Checklist: CONFIGURATION_CHECKLIST.md${NC}"

echo -e "\n${CYAN}========================================${NC}"
echo -e "${GREEN}  ✅ Setup completed successfully!${NC}"
echo -e "${WHITE}  Follow the steps above to complete the installation.${NC}"
echo -e "${CYAN}========================================\n${NC}"
