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

# WXT imports config/queue_center_contract.json from the repository root
# directly. Do not copy the task contract here; wxt.config.ts explicitly allows
# that root so Laravel, Pycore, both UIs, and mcp-chrome read one source.
# Import variable management library and key definitions
source "$MCP_SCRIPT_DIR/var_keys.sh"
source "$MCP_SCRIPT_DIR/var_manager.sh"

# Source get_real_user.sh for permission management (only if running as root)
MCP_COMMON_LIB_DIR="/www/programing/core_node/scripts/shells/linux/common"
if [ "$(id -u)" -eq 0 ] && [ -f "$MCP_COMMON_LIB_DIR/get_real_user.sh" ]; then
    source "$MCP_COMMON_LIB_DIR/get_real_user.sh" 2>/dev/null || true
fi

# --- Dev-watch mode (invoked by the ncore-mcp-chrome systemd service, or by
#     `start.sh --dev`). Skips build/register and runs only the WXT dev watch,
#     so the service stays always-on for dynamic debugging. INVOCATION_ID is
#     set by systemd for every service start, so the auto-created unit (whose
#     ExecStart is `bash start.sh`) lands here without any extra flag. --- #
if [ "${1:-}" = "--dev" ] || [ -n "$INVOCATION_ID" ]; then
    # Under systemd PATH is minimal; source nvm and extend PATH so pnpm resolves.
    for MCP_DEV_NVM in "$HOME/.nvm" "/usr/local/nvm" "/opt/nvm"; do
        if [ -s "$MCP_DEV_NVM/nvm.sh" ]; then
            # shellcheck disable=SC1090
            source "$MCP_DEV_NVM/nvm.sh" >/dev/null 2>&1 || true
            break
        fi
    done
    export PATH="$HOME/.local/share/pnpm:$HOME/.local/bin:/usr/local/bin:/usr/bin:$PATH"
    if ! command -v pnpm >/dev/null 2>&1; then
        echo "[start.sh --dev] pnpm not found in PATH" >&2
        exit 127
    fi
    MCP_DEV_EXT_DIR="$MCP_PROJECT_ROOT/app/chrome-extension"
    if [ ! -d "$MCP_DEV_EXT_DIR" ]; then
        echo "[start.sh --dev] chrome-extension dir not found: $MCP_DEV_EXT_DIR" >&2
        exit 1
    fi
    cd "$MCP_DEV_EXT_DIR" || { echo "[start.sh --dev] cannot cd to $MCP_DEV_EXT_DIR" >&2; exit 1; }
    echo "[start.sh --dev] starting WXT dev watch in $MCP_DEV_EXT_DIR"
    exec pnpm run dev
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
    local mcp_extension_output="$MCP_PROJECT_ROOT/.output"
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
# Step 0: Ensure PATH and fix node/pnpm symlinks (idempotent, works under sudo)
# ======================================

# Well-known Node.js install locations on Linux
MCP_NODE_SEARCH_DIRS=(
    /opt/_kali_2026/node
    /opt/node
    /usr/local/node
    /usr/local/lib/nodejs
)

mcp_find_node_bin_dir() {
    # Search for node binary in well-known locations
    for mcp_search_dir in "${MCP_NODE_SEARCH_DIRS[@]}"; do
        if [ ! -d "$mcp_search_dir" ]; then
            continue
        fi
        # Find node-* directories (versioned installs)
        for mcp_ver_dir in "$mcp_search_dir"/node-v*; do
            if [ -x "$mcp_ver_dir/bin/node" ]; then
                echo "$mcp_ver_dir/bin"
                return 0
            fi
        done
    done
    # Fallback: check if node is already in PATH
    local mcp_existing
    mcp_existing=$(command -v node 2>/dev/null)
    if [ -n "$mcp_existing" ] && [ -x "$mcp_existing" ]; then
        dirname "$mcp_existing"
        return 0
    fi
    return 1
}

mcp_ensure_symlink() {
    local mcp_binary_name="$1"
    local mcp_source_path="$2"

    if [ -z "$mcp_source_path" ] || [ ! -e "$mcp_source_path" ]; then
        return 1
    fi

    local mcp_link="/usr/local/bin/$mcp_binary_name"
    local mcp_current_target=""

    if [ -L "$mcp_link" ]; then
        mcp_current_target=$(readlink -f "$mcp_link" 2>/dev/null)
        local mcp_expected_target
        mcp_expected_target=$(readlink -f "$mcp_source_path" 2>/dev/null)
        if [ "$mcp_current_target" = "$mcp_expected_target" ]; then
            return 0  # Already correct
        fi
    fi

    # Create or repair symlink
    if [ "$(id -u)" -eq 0 ]; then
        ln -sf "$mcp_source_path" "$mcp_link" 2>/dev/null
    else
        sudo ln -sf "$mcp_source_path" "$mcp_link" 2>/dev/null
    fi

    # Ensure executable by all users
    chmod a+x "$mcp_source_path" 2>/dev/null || true
}

mcp_ensure_node_deps() {
    # 1. Augment PATH with standard locations (safe to prepend; idempotent)
    export PATH="/usr/local/bin:/usr/local/sbin:/usr/bin:/bin:$PATH"

    # 2. Find Node.js bin directory
    local mcp_node_bin_dir
    mcp_node_bin_dir=$(mcp_find_node_bin_dir)
    if [ -z "$mcp_node_bin_dir" ]; then
        echo -e "${RED}  [ERROR] Node.js not found in any known location${NC}"
        echo -e "${YELLOW}  Run prerequisite: scripts/shells/linux/debian/install_shells/17_install_node_24.sh${NC}"
        exit 1
    fi

    # Add Node.js bin to PATH
    export PATH="$mcp_node_bin_dir:$PATH"

    # 3. Repair /usr/local/bin symlinks for node/npm/npx (idempotent)
    for mcp_bin in node npm npx; do
        if [ -x "$mcp_node_bin_dir/$mcp_bin" ]; then
            mcp_ensure_symlink "$mcp_bin" "$mcp_node_bin_dir/$mcp_bin"
        fi
    done

    # 4. Verify node works
    if ! command -v node &>/dev/null; then
        echo -e "${RED}  [ERROR] Node.js binary not executable at $mcp_node_bin_dir/node${NC}"
        exit 1
    fi

    # 5. Ensure pnpm is available
    if command -v pnpm &>/dev/null; then
        # pnpm found - repair symlink if in node bin dir
        if [ -e "$mcp_node_bin_dir/pnpm" ]; then
            mcp_ensure_symlink "pnpm" "$mcp_node_bin_dir/pnpm"
        fi
        return 0
    fi

    # pnpm not found - try to install it
    echo -e "${YELLOW}  pnpm not found, auto-installing...${NC}"
    export npm_config_confirm_modules_purge=false

    if [ -x "$mcp_node_bin_dir/npm" ]; then
        "$mcp_node_bin_dir/npm" install -g pnpm --config.confirm-modules-purge=false 2>&1 | tail -3
    else
        npm install -g pnpm --config.confirm-modules-purge=false 2>&1 | tail -3
    fi

    # Repair symlink after install
    if [ -e "$mcp_node_bin_dir/pnpm" ]; then
        mcp_ensure_symlink "pnpm" "$mcp_node_bin_dir/pnpm"
    fi

    # Final check
    if ! command -v pnpm &>/dev/null; then
        echo -e "${RED}  [ERROR] pnpm auto-install failed${NC}"
        echo -e "${YELLOW}  Run prerequisite: scripts/shells/linux/debian/install_shells/30_ensure_pnpm_packages.sh${NC}"
        exit 1
    fi
    echo -e "${GREEN}  [OK] pnpm auto-installed successfully${NC}"
}

# Run dependency repair early (before Python and build steps)
mcp_ensure_node_deps

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

MCP_VARS_DIR=$(mcp_get_vars_dir)

# Read UI title
mcp_ui_title=$(mcp_get_var "$VAR_KEY_UI_TITLE")
if [ -z "$mcp_ui_title" ]; then
    mcp_ui_title="Chrome MCP Server Setup"
fi
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  $mcp_ui_title${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Step 1: Check dependencies
mcp_step1=$(mcp_get_var "$VAR_KEY_UI_STEP_1")
if [ -z "$mcp_step1" ]; then
    mcp_step1="Checking dependencies..."
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
fi
echo -e "${YELLOW}[5/6] $mcp_step5${NC}"

# Get build output directory from Python-computed variable (cross-platform)
MCP_BUILD_OUTPUT_DIR=$(mcp_get_var "$VAR_KEY_BUILD_OUTPUT_DIR")

# Create build directory with proper permissions before building
mcp_create_build_dir_with_permissions "$MCP_BUILD_OUTPUT_DIR"

mcp_cmd_build_extension=$(mcp_get_var "$VAR_KEY_CMD_BUILD_EXTENSION")
if [ -z "$mcp_cmd_build_extension" ]; then
    echo -e "${RED}[ERROR] Build command is EMPTY!${NC}"
    exit 1
fi

eval "$mcp_cmd_build_extension"
mcp_build_exit_code=$?

if [ $mcp_build_exit_code -ne 0 ]; then
    echo -e "${RED}  [ERROR] Failed to build Chrome Extension${NC}"
    exit 1
fi

mcp_extension_path=$(mcp_get_var "$VAR_KEY_EXTENSION_PATH")
if [ -z "$mcp_extension_path" ]; then
    echo -e "${RED}[ERROR] EXTENSION_PATH is EMPTY!${NC}"
    exit 1
fi

mcp_manifest_json="$mcp_extension_path/manifest.json"
if [ -f "$mcp_manifest_json" ]; then
    echo -e "${GREEN}  [OK] Chrome Extension built successfully${NC}"
    # Fix permissions after successful build
    mcp_fix_build_permissions "$MCP_BUILD_OUTPUT_DIR"
else
    echo -e "${RED}  [ERROR] Extension build completed but manifest not found at $mcp_manifest_json${NC}"
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

# ======================================
# Step 7: Optional systemd service registration (always-on dynamic debugging)
# ======================================
# Reuse the repo service manager (debian_service_manager.sh) to create the
# ncore-mcp-chrome unit. The unit's ExecStart is `bash start.sh`; under systemd
# INVOCATION_ID is set, so start.sh enters its dev-watch mode above (WXT HMR).
MCP_CORE_NODE_ROOT="$(cd "$MCP_PROJECT_ROOT/../.." && pwd)"
MCP_DEB_SVC_MGR="$MCP_CORE_NODE_ROOT/scripts/shells/linux/common/debian_service_manager.sh"
MCP_SERVICE_NAME="ncore-mcp-chrome"
MCP_SVC_SUDO=""

if [ -f "$MCP_DEB_SVC_MGR" ] && command -v systemctl >/dev/null 2>&1; then
    if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
        MCP_SVC_SUDO="sudo"
    fi

    if systemctl cat "${MCP_SERVICE_NAME}.service" >/dev/null 2>&1; then
        echo ""
        echo -e "${CYAN}  [INFO] ${MCP_SERVICE_NAME} already installed; restarting (idempotent reload)${NC}"
        $MCP_SVC_SUDO systemctl restart "$MCP_SERVICE_NAME" 2>/dev/null || true
        echo -e "${GREEN}  [OK] ${MCP_SERVICE_NAME} restarted${NC}"
    else
        echo ""
        echo -e "${YELLOW}  For always-on dynamic debugging, register MCP Chrome as a system service${NC}"
        echo -e "${YELLOW}  (systemd unit ${MCP_SERVICE_NAME}; autostarts the WXT dev watch at boot).${NC}"
        read -rp "  Add to system service? [y/N] " mcp_svc_ans || mcp_svc_ans=""
        if [[ "$mcp_svc_ans" =~ ^[Yy]$ ]]; then
            if $MCP_SVC_SUDO bash "$MCP_DEB_SVC_MGR" create "$MCP_SCRIPT_DIR/start.sh" mcp-chrome "MCP Chrome dynamic-debug dev server" "30%" "1G"; then
                echo -e "${GREEN}  [OK] ${MCP_SERVICE_NAME} created and started${NC}"
            else
                echo -e "${YELLOW}  [WARN] Service creation failed (see messages above)${NC}"
            fi
        else
            echo -e "${DARK_GRAY}  Skipped service registration.${NC}"
        fi
    fi
fi

# Print useful service management commands (if service exists)
if systemctl cat "${MCP_SERVICE_NAME}.service" >/dev/null 2>&1; then
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${YELLOW}  SERVICE COMMANDS (${MCP_SERVICE_NAME})${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo -e "${WHITE}  View logs:        ${CYAN}sudo journalctl -u ${MCP_SERVICE_NAME} -f${NC}"
    echo -e "${WHITE}  Last 50 lines:    ${CYAN}sudo journalctl -u ${MCP_SERVICE_NAME} --no-pager -n 50${NC}"
    echo -e "${WHITE}  Restart:          ${CYAN}sudo systemctl restart ${MCP_SERVICE_NAME}${NC}"
    echo -e "${WHITE}  Stop:             ${CYAN}sudo systemctl stop ${MCP_SERVICE_NAME}${NC}"
    echo -e "${WHITE}  Status:           ${CYAN}sudo systemctl status ${MCP_SERVICE_NAME}${NC}"
    echo -e "${WHITE}  Disable autostart:${CYAN}sudo systemctl disable ${MCP_SERVICE_NAME}${NC}"
    echo ""
fi
echo ""
