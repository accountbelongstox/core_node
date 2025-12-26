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

# Get project root directory - use MCP prefix to avoid conflicts
MCP_SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MCP_PROJECT_ROOT="$( cd "$MCP_SCRIPT_DIR/.." && pwd )"

# Import variable management library and key definitions
source "$MCP_SCRIPT_DIR/var_keys.sh"
source "$MCP_SCRIPT_DIR/var_manager.sh"

# Source get_real_user.sh for permission management (only if running as root)
MCP_COMMON_LIB_DIR="/www/programing/core_node/scripts/shells/linux/common"
if [ "$(id -u)" -eq 0 ] && [ -f "$MCP_COMMON_LIB_DIR/get_real_user.sh" ]; then
    source "$MCP_COMMON_LIB_DIR/get_real_user.sh" 2>/dev/null || true
fi

echo -e "\n${CYAN}========================================${NC}"
echo -e "${CYAN}  Chrome MCP Server - Linux/macOS${NC}"
echo -e "${CYAN}========================================\n${NC}"

# Change to project root
cd "$MCP_PROJECT_ROOT"

# ======================================
# Helper Functions
# ======================================

# Helper function: Create directory with proper permissions
mcp_create_build_dir_with_permissions() {
    local mcp_target_dir="$1"

    # Create directory silently
    if [ ! -d "$mcp_target_dir" ]; then
        mkdir -p "$mcp_target_dir" 2>/dev/null || true
    fi

    # Fix permissions if running as root
    if [ "$(id -u)" -eq 0 ]; then
        local mcp_real_user=$(get_real_user 2>/dev/null || echo "")
        if [ -n "$mcp_real_user" ]; then
            chown -R "$mcp_real_user:$mcp_real_user" "$mcp_target_dir" 2>/dev/null || true
        fi
    fi
}

# Helper function: Fix permissions after build
mcp_fix_build_permissions() {
    local mcp_target_dir="$1"

    if [ "$(id -u)" -eq 0 ] && [ -d "$mcp_target_dir" ]; then
        local mcp_real_user=$(get_real_user 2>/dev/null || echo "")
        if [ -n "$mcp_real_user" ]; then
            echo -e "${CYAN}  Fixing permissions for: $mcp_target_dir${NC}"
            chown -R "$mcp_real_user:$mcp_real_user" "$mcp_target_dir"
            echo -e "${GREEN}  [OK] Permissions fixed for user: $mcp_real_user${NC}"
        fi
    fi
}

# Helper function: Clean old build directories
mcp_clean_old_build_dirs() {
    echo -e "${CYAN}  Cleaning old build directories...${NC}"

    # Clean native-server dist (may have wrong permissions from previous root build)
    local mcp_native_dist="$MCP_PROJECT_ROOT/app/native-server/dist"
    if [ -d "$mcp_native_dist" ]; then
        rm -rf "$mcp_native_dist" 2>/dev/null || {
            echo -e "${YELLOW}  [WARN] Removing old native-server dist directory${NC}"
            if [ "$(id -u)" -eq 0 ]; then
                rm -rf "$mcp_native_dist"
            fi
        }
    fi

    # Clean extension .output (may have wrong permissions from previous root build)
    local mcp_extension_output="$MCP_PROJECT_ROOT/app/chrome-extension/.output"
    if [ -d "$mcp_extension_output" ]; then
        rm -rf "$mcp_extension_output" 2>/dev/null || {
            echo -e "${YELLOW}  [WARN] Removing old extension output directory${NC}"
            if [ "$(id -u)" -eq 0 ]; then
                rm -rf "$mcp_extension_output"
            fi
        }
    fi

    echo -e "${GREEN}  [OK] Old build directories cleaned${NC}"
}

# ======================================
# Step 1: Call Python for processing
# ======================================
echo -e "${YELLOW}[Python] Processing build configuration...${NC}"
echo ""

MCP_PYTHON_SCRIPT="$MCP_SCRIPT_DIR/build_orchestrator.py"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}ERROR: Python 3 is not installed or not in PATH${NC}"
    echo -e "${YELLOW}Please install Python 3.7+ from https://www.python.org/${NC}"
    exit 1
fi

# Run Python script
if ! python3 "$MCP_PYTHON_SCRIPT"; then
    mcp_error=$(mcp_get_var "$VAR_KEY_ERROR" || echo "Unknown error")
    echo ""
    echo -e "${RED}ERROR: Python processing failed: $mcp_error${NC}"
    exit 1
fi

echo ""

# ======================================
# Step 2: Read variables and execute build commands
# ======================================

# DEBUG: Print all variable keys
echo -e "${CYAN}[DEBUG] ========== VARIABLE KEYS ==========${NC}"
echo -e "${CYAN}[DEBUG] VAR_KEY_UI_TITLE = $VAR_KEY_UI_TITLE${NC}"
echo -e "${CYAN}[DEBUG] VAR_KEY_UI_STEP_1 = $VAR_KEY_UI_STEP_1${NC}"
echo -e "${CYAN}[DEBUG] VAR_KEY_EXTENSION_PATH = $VAR_KEY_EXTENSION_PATH${NC}"
echo -e "${CYAN}[DEBUG] VAR_KEY_NATIVE_PATH = $VAR_KEY_NATIVE_PATH${NC}"
echo -e "${CYAN}[DEBUG] VAR_KEY_CMD_BUILD_EXTENSION = $VAR_KEY_CMD_BUILD_EXTENSION${NC}"

# DEBUG: Test mcp_get_var function before using it
echo -e "${CYAN}[DEBUG] ========== TESTING GET_VAR FUNCTION ==========${NC}"
echo -e "${CYAN}[DEBUG] Function type: $(type -t mcp_get_var 2>&1)${NC}"

# Show the actual function definition
echo -e "${CYAN}[DEBUG] Function definition:${NC}"
declare -f mcp_get_var | head -15

# Test raw cat first
echo -e "${CYAN}[DEBUG] Raw cat test:${NC}"
cat /var/_core_node/_build_global_vars/mcpchrome_ui_title
echo ""

# Test head -c directly
echo -e "${CYAN}[DEBUG] Raw head -c test:${NC}"
head -c 99999 /var/_core_node/_build_global_vars/mcpchrome_ui_title 2>/dev/null
echo ""

# Test mcp_get_var direct output with explicit file descriptor
echo -e "${CYAN}[DEBUG] mcp_get_var direct test (fd 1):${NC}"
mcp_get_var "mcpchrome_ui_title" >&1
echo ""

# Test command substitution
echo -e "${CYAN}[DEBUG] Command substitution test:${NC}"
test_result=$(cat /var/_core_node/_build_global_vars/mcpchrome_ui_title)
echo -e "${CYAN}[DEBUG] cat result = '$test_result'${NC}"
test_result2=$(mcp_get_var "mcpchrome_ui_title")
echo -e "${CYAN}[DEBUG] mcp_get_var result = '$test_result2'${NC}"

# DEBUG: Print variable files
echo -e "${CYAN}[DEBUG] ========== VARIABLE FILES ==========${NC}"
MCP_VARS_DIR=$(mcp_get_vars_dir)
echo -e "${CYAN}[DEBUG] VARS_DIR = $MCP_VARS_DIR${NC}"
echo -e "${CYAN}[DEBUG] Variable files:${NC}"
ls -la "$MCP_VARS_DIR" 2>&1 | grep mcpchrome | head -10

# DEBUG: Read and print actual variable values
echo -e "${CYAN}[DEBUG] ========== VARIABLE VALUES ==========${NC}"
echo -e "${CYAN}[DEBUG] Reading UI_TITLE...${NC}"
mcp_ui_title=$(mcp_get_var "$VAR_KEY_UI_TITLE")
echo -e "${CYAN}[DEBUG] UI_TITLE value = '$mcp_ui_title'${NC}"

echo -e "${CYAN}[DEBUG] Reading EXTENSION_PATH...${NC}"
mcp_ext_path_value=$(mcp_get_var "$VAR_KEY_EXTENSION_PATH")
echo -e "${CYAN}[DEBUG] EXTENSION_PATH value = '$mcp_ext_path_value'${NC}"

echo -e "${CYAN}[DEBUG] Reading NATIVE_PATH...${NC}"
mcp_native_path_value=$(mcp_get_var "$VAR_KEY_NATIVE_PATH")
echo -e "${CYAN}[DEBUG] NATIVE_PATH value = '$mcp_native_path_value'${NC}"

# Read UI title
mcp_ui_title=$(mcp_get_var "$VAR_KEY_UI_TITLE")
if [ -z "$mcp_ui_title" ]; then
    mcp_ui_title="Chrome MCP Server Setup"
    echo -e "${YELLOW}  [DEBUG] UI_TITLE is empty, using default${NC}"
fi
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  $mcp_ui_title${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Step 1: Check dependencies
mcp_step1=$(mcp_get_var "$VAR_KEY_UI_STEP_1")
if [ -z "$mcp_step1" ]; then
    mcp_step1="Checking dependencies..."
    echo -e "${YELLOW}  [DEBUG] UI_STEP_1 is empty, using default${NC}"
fi
echo -e "${YELLOW}[1/6] $mcp_step1${NC}"

if command -v node &> /dev/null; then
    MCP_NODE_VERSION=$(node --version)
    echo -e "${GREEN}  [OK] Node.js: $MCP_NODE_VERSION${NC}"
else
    echo -e "${RED}  [ERROR] ERROR: Node.js not installed${NC}"
    exit 1
fi

if command -v pnpm &> /dev/null; then
    MCP_PNPM_VERSION=$(pnpm --version)
    echo -e "${GREEN}  [OK] pnpm: v$MCP_PNPM_VERSION${NC}"
else
    echo -e "${RED}  [ERROR] ERROR: pnpm not installed${NC}"
    exit 1
fi

# Step 2: Install dependencies
echo ""
mcp_step2=$(mcp_get_var "$VAR_KEY_UI_STEP_2")
if [ -z "$mcp_step2" ]; then
    mcp_step2="Installing dependencies..."
    echo -e "${YELLOW}  [DEBUG] UI_STEP_2 is empty, using default${NC}"
fi
echo -e "${YELLOW}[2/6] $mcp_step2${NC}"

mcp_should_install=$(mcp_get_var "$VAR_KEY_SHOULD_INSTALL" || echo "false")
if [ "$mcp_should_install" = "true" ]; then
    mcp_cmd_install=$(mcp_get_var "$VAR_KEY_CMD_INSTALL")
    echo -e "${CYAN}  Installing dependencies...${NC}"
    eval "$mcp_cmd_install"
    if [ $? -ne 0 ]; then
        echo -e "${RED}  [ERROR] ERROR: Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}  [OK] Dependencies installed${NC}"
else
    echo -e "${GREEN}  [OK] Dependencies already installed${NC}"
fi

# Clean old build directories before building
echo ""
mcp_clean_old_build_dirs

# Step 3: Build Shared package
echo ""
mcp_step3=$(mcp_get_var "$VAR_KEY_UI_STEP_3")
if [ -z "$mcp_step3" ]; then
    mcp_step3="Building shared package..."
    echo -e "${YELLOW}  [DEBUG] UI_STEP_3 is empty, using default${NC}"
fi
echo -e "${YELLOW}[3/6] $mcp_step3${NC}"

mcp_cmd_build_shared=$(mcp_get_var "$VAR_KEY_CMD_BUILD_SHARED")
echo -e "${CYAN}  Building chrome-mcp-shared...${NC}"
eval "$mcp_cmd_build_shared"
if [ $? -ne 0 ]; then
    echo -e "${RED}  [ERROR] ERROR: Failed to build shared package${NC}"
    exit 1
fi

mcp_shared_path=$(mcp_get_var "$VAR_KEY_SHARED_PATH")
if [ -d "$mcp_shared_path" ]; then
    echo -e "${GREEN}  [OK] Shared package built successfully${NC}"
fi

# Step 4: Build Native Server
echo ""
mcp_step4=$(mcp_get_var "$VAR_KEY_UI_STEP_4")
if [ -z "$mcp_step4" ]; then
    mcp_step4="Building Native Server..."
    echo -e "${YELLOW}  [DEBUG] UI_STEP_4 is empty, using default${NC}"
fi
echo -e "${YELLOW}[4/6] $mcp_step4${NC}"

mcp_cmd_build_native=$(mcp_get_var "$VAR_KEY_CMD_BUILD_NATIVE")
echo -e "${CYAN}  Building mcp-chrome-bridge...${NC}"
eval "$mcp_cmd_build_native"
if [ $? -ne 0 ]; then
    echo -e "${RED}  [ERROR] ERROR: Failed to build Native Server${NC}"
    exit 1
fi

mcp_native_path=$(mcp_get_var "$VAR_KEY_NATIVE_PATH")
mcp_run_host_sh="$mcp_native_path/run_host.sh"
if [ -f "$mcp_run_host_sh" ]; then
    echo -e "${GREEN}  [OK] Native Server built successfully${NC}"
    chmod +x "$mcp_run_host_sh"

    # Create and fix permissions for global log directory
    MCP_GLOBAL_LOG_DIR="/var/_core_node/mcp_chrome/logs"
    echo -e "${CYAN}  Setting up global log directory: $MCP_GLOBAL_LOG_DIR${NC}"
    mkdir -p "$MCP_GLOBAL_LOG_DIR" 2>/dev/null || {
        if [ "$(id -u)" -eq 0 ]; then
            mkdir -p "$MCP_GLOBAL_LOG_DIR"
        fi
    }
    if [ -d "$MCP_GLOBAL_LOG_DIR" ]; then
        chmod 777 "$MCP_GLOBAL_LOG_DIR" 2>/dev/null || {
            if [ "$(id -u)" -eq 0 ]; then
                chmod 777 "$MCP_GLOBAL_LOG_DIR"
            fi
        }
        echo -e "${GREEN}  [OK] Global log directory ready: $MCP_GLOBAL_LOG_DIR${NC}"
    else
        echo -e "${YELLOW}  [WARN] Could not create global log directory (will be created at runtime)${NC}"
    fi

    # Fix permissions for native server dist
    mcp_fix_build_permissions "$mcp_native_path"

    # Auto-register Native Host for local development (system-level requires root)
    echo -e "${CYAN}  Auto-registering Native Host to system directory...${NC}"
    if [ "$(id -u)" -eq 0 ]; then
        # Already root, run directly
        node "$MCP_SCRIPT_DIR/register-local-dev.cjs" > /dev/null 2>&1 && \
            echo -e "${GREEN}  [OK] Native Host registered successfully${NC}" || \
            echo -e "${YELLOW}  [WARN] Auto-registration failed${NC}"
    else
        # Not root, try with sudo
        sudo node "$MCP_SCRIPT_DIR/register-local-dev.cjs" > /dev/null 2>&1 && \
            echo -e "${GREEN}  [OK] Native Host registered successfully (with sudo)${NC}" || \
            echo -e "${YELLOW}  [WARN] Auto-registration failed (run with sudo for system-level registration)${NC}"
    fi
fi

# Step 5: Build Chrome Extension
echo ""
mcp_step5=$(mcp_get_var "$VAR_KEY_UI_STEP_5")
if [ -z "$mcp_step5" ]; then
    mcp_step5="Building Chrome Extension..."
    echo -e "${YELLOW}  [DEBUG] UI_STEP_5 is empty, using default${NC}"
fi
echo -e "${YELLOW}[5/6] $mcp_step5${NC}"

# Get build output directory from Python-computed variable (cross-platform)
MCP_BUILD_OUTPUT_DIR=$(mcp_get_var "$VAR_KEY_BUILD_OUTPUT_DIR")
echo -e "${CYAN}[DEBUG] BUILD_OUTPUT_DIR from Python: $MCP_BUILD_OUTPUT_DIR${NC}"

# Create build directory with proper permissions before building
mcp_create_build_dir_with_permissions "$MCP_BUILD_OUTPUT_DIR"

echo -e "${CYAN}[DEBUG] ========== BUILD EXTENSION DEBUG ==========${NC}"
echo -e "${CYAN}[DEBUG] PROJECT_ROOT = $MCP_PROJECT_ROOT${NC}"
echo -e "${CYAN}[DEBUG] BUILD_OUTPUT_DIR = $MCP_BUILD_OUTPUT_DIR${NC}"

echo -e "${CYAN}[DEBUG] Reading build command from variable...${NC}"
echo -e "${CYAN}[DEBUG] VAR_KEY_CMD_BUILD_EXTENSION = $VAR_KEY_CMD_BUILD_EXTENSION${NC}"
echo -e "${CYAN}[DEBUG] VARS_DIR = $(mcp_get_vars_dir)${NC}"
echo -e "${CYAN}[DEBUG] Variable file path: $(mcp_get_vars_dir)/$VAR_KEY_CMD_BUILD_EXTENSION${NC}"
echo -e "${CYAN}[DEBUG] File exists? $(test -f "$(mcp_get_vars_dir)/$VAR_KEY_CMD_BUILD_EXTENSION" && echo "YES" || echo "NO")${NC}"
echo -e "${CYAN}[DEBUG] File content (direct cat): $(cat "$(mcp_get_vars_dir)/$VAR_KEY_CMD_BUILD_EXTENSION" 2>&1)${NC}"

mcp_cmd_build_extension=$(mcp_get_var "$VAR_KEY_CMD_BUILD_EXTENSION")
echo -e "${CYAN}[DEBUG] Build command from mcp_get_var: '$mcp_cmd_build_extension'${NC}"
echo -e "${CYAN}[DEBUG] Build command length: ${#mcp_cmd_build_extension}${NC}"

if [ -z "$mcp_cmd_build_extension" ]; then
    echo -e "${RED}[ERROR] Build command is EMPTY!${NC}"
    exit 1
fi

eval "$mcp_cmd_build_extension"
mcp_build_exit_code=$?

echo -e "${CYAN}[DEBUG] Build exit code: $mcp_build_exit_code${NC}"

if [ $mcp_build_exit_code -ne 0 ]; then
    echo -e "${RED}  [ERROR] Failed to build Chrome Extension${NC}"
    exit 1
fi

mcp_extension_path=$(mcp_get_var "$VAR_KEY_EXTENSION_PATH")
echo -e "${CYAN}[DEBUG] Extension path from variable: '$mcp_extension_path'${NC}"

if [ -z "$mcp_extension_path" ]; then
    echo -e "${RED}[ERROR] EXTENSION_PATH is EMPTY!${NC}"
    echo -e "${CYAN}[DEBUG] VAR_KEY_EXTENSION_PATH = $VAR_KEY_EXTENSION_PATH${NC}"
    echo -e "${CYAN}[DEBUG] Variable file:${NC}"
    ls -la "$MCP_VARS_DIR/$VAR_KEY_EXTENSION_PATH" 2>&1
    cat "$MCP_VARS_DIR/$VAR_KEY_EXTENSION_PATH" 2>&1
fi

mcp_manifest_json="$mcp_extension_path/manifest.json"
echo -e "${CYAN}[DEBUG] Looking for manifest at: $mcp_manifest_json${NC}"

if [ -f "$mcp_manifest_json" ]; then
    echo -e "${GREEN}  [OK] Chrome Extension built successfully${NC}"
    echo -e "${CYAN}  [DEBUG] Manifest file found${NC}"
    # Fix permissions after successful build
    mcp_fix_build_permissions "$MCP_BUILD_OUTPUT_DIR"
else
    echo -e "${RED}  [ERROR] Extension build completed but manifest not found${NC}"
    echo -e "${CYAN}  [DEBUG] Checking actual build output locations:${NC}"

    # Check WXT default output
    if [ -f "$MCP_PROJECT_ROOT/app/chrome-extension/.output/chrome-mv3/manifest.json" ]; then
        echo -e "${YELLOW}  [DEBUG] Found manifest in default location: $MCP_PROJECT_ROOT/app/chrome-extension/.output/chrome-mv3/${NC}"
    fi

    # Check configured output
    if [ -f "$MCP_BUILD_OUTPUT_DIR/chrome-mcp-extension/chrome-mv3/manifest.json" ]; then
        echo -e "${YELLOW}  [DEBUG] Found manifest in configured location: $MCP_BUILD_OUTPUT_DIR/chrome-mcp-extension/chrome-mv3/${NC}"
    fi

    # List what's actually in the directories
    echo -e "${CYAN}  [DEBUG] Contents of BUILD_OUTPUT_DIR ($MCP_BUILD_OUTPUT_DIR):${NC}"
    ls -la "$MCP_BUILD_OUTPUT_DIR" 2>&1 | head -10

    exit 1
fi

# Step 6: Register Native Messaging Host
echo ""
mcp_step6=$(mcp_get_var "$VAR_KEY_UI_STEP_6" || echo "Registering Native Messaging Host...")
echo -e "${YELLOW}[6/6] $mcp_step6${NC}"

mcp_cmd_register=$(mcp_get_var "$VAR_KEY_CMD_REGISTER")
echo -e "${CYAN}  Using local development registration...${NC}"
eval "$mcp_cmd_register"

# Verify system-level registration
echo ""
echo -e "${CYAN}  Registration Verification:${NC}"
mcp_system_manifest_path="/etc/opt/chrome/native-messaging-hosts/com.chromemcp.nativehost.json"
if [ -f "$mcp_system_manifest_path" ]; then
    echo -e "${GREEN}  [OK] Chrome manifest registered (system-level)${NC}"
    echo -e "${DARK_GRAY}    Location: $mcp_system_manifest_path${NC}"
else
    echo -e "${YELLOW}  [WARN] System-level manifest not found${NC}"
    echo -e "${DARK_GRAY}    Expected: $mcp_system_manifest_path${NC}"
fi

# ======================================
# Success Summary
# ======================================
mcp_extension_path=$(mcp_get_var "$VAR_KEY_EXTENSION_PATH")

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}  [OK] BUILD & REGISTRATION COMPLETE${NC}"
echo -e "${CYAN}========================================${NC}"

echo ""
echo -e "${YELLOW}[IMPORTANT PATHS]${NC}"
echo ""
echo -e "${WHITE}  1) Chrome Extension (Frontend):${NC}"
echo -e "${CYAN}     $mcp_extension_path${NC}"
echo ""
echo -e "${WHITE}  2) Native Server (Backend):${NC}"
echo -e "${CYAN}     $mcp_native_path${NC}"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${YELLOW}  NEXT STEPS${NC}"
echo -e "${CYAN}========================================${NC}"

echo ""
echo -e "${YELLOW}[STEP 1] Load Extension in Chrome:${NC}"
echo -e "${WHITE}  1. Open Chrome and go to: chrome://extensions/${NC}"
echo -e "${WHITE}  2. Enable 'Developer mode' (toggle in top right)${NC}"
echo -e "${WHITE}  3. Click 'Load unpacked' button${NC}"
echo -e "${WHITE}  4. Select folder: ${CYAN}$mcp_extension_path${NC}"

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
