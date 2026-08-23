#!/bin/bash
# Chrome MCP Server Startup Script (Linux/macOS)
# Shell owns build/watch orchestration; Python is called after builds to recover
# the MCP connection.

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
DARK_GRAY='\033[0;90m'
NC='\033[0m' # No Color
MCP_WATCH_CHOICE="${MCP_CHROME_WATCH_MODE:-}"
MCP_WATCH_MODE="dev"
MCP_DEV_PID=""
MCP_SCRIPT_DIR=""
MCP_PROJECT_ROOT=""
MCP_CORE_NODE_ROOT=""
MCP_LINUX_COMMON_DIR=""
MCP_GVAR_COMMON=""
MCP_VENV_PYTHON_COMMON=""
MCP_SERVICE_CONTRACT_COMMON=""
MCP_PORT=""
MCP_PYTHON_EXE=""
MCP_COMMON_LIB_DIR=""
MCP_COMPILE_CHOICE=""
MCP_DEV_NVM=""
MCP_PYTHON_SCRIPT=""
MCP_VARS_DIR=""
MCP_NODE_VERSION=""
MCP_PNPM_VERSION=""
MCP_BUILD_OUTPUT_DIR=""
MCP_GLOBAL_LOG_DIR=""
MCP_NODE_SEARCH_DIRS=()
mcp_ui_title=""
mcp_step1=""
mcp_step2=""
mcp_step3=""
mcp_step4=""
mcp_step5=""
mcp_step6=""
mcp_shared_path=""
mcp_native_path=""
mcp_run_host_sh=""
mcp_extension_path=""
mcp_manifest_json=""
mcp_system_manifest_path=""

# Get project root directory - use MCP prefix to avoid conflicts
MCP_SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MCP_PROJECT_ROOT="$( cd "$MCP_SCRIPT_DIR/.." && pwd )"
MCP_CORE_NODE_ROOT="$(cd "$MCP_PROJECT_ROOT/../.." && pwd)"
MCP_LINUX_COMMON_DIR="$MCP_CORE_NODE_ROOT/scripts/shells/linux/common"
MCP_GVAR_COMMON="$MCP_LINUX_COMMON_DIR/gvar_common.sh"
MCP_VENV_PYTHON_COMMON="$MCP_LINUX_COMMON_DIR/venv_python_common.sh"
MCP_SERVICE_CONTRACT_COMMON="$MCP_LINUX_COMMON_DIR/service_contract_common.sh"

# WXT imports config/queue_center_contract.json from the repository root
# directly. Do not copy the task contract here; wxt.config.ts explicitly allows
# that root so Laravel, Pycore, both UIs, and mcp-chrome read one source.
# Import variable management library and key definitions
source "$MCP_SCRIPT_DIR/var_keys.sh"
source "$MCP_SCRIPT_DIR/var_manager.sh"
source "$MCP_GVAR_COMMON"
source "$MCP_VENV_PYTHON_COMMON"
source "$MCP_SERVICE_CONTRACT_COMMON"
MCP_PYTHON_EXE="$VENV_PYTHON3"
MCP_PORT="$(sc_require ports.mcp_chrome)"

# Source get_real_user.sh for permission management (only if running as root)
MCP_COMMON_LIB_DIR="$MCP_LINUX_COMMON_DIR"
if [ "$(id -u)" -eq 0 ] && [ -f "$MCP_COMMON_LIB_DIR/get_real_user.sh" ]; then
    source "$MCP_COMMON_LIB_DIR/get_real_user.sh" 2>/dev/null || true
fi

# The system service starts the shell-owned watcher and lets Python only monitor
# build artifacts and wake the native MCP connection.
if [ -n "$INVOCATION_ID" ]; then
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
        echo "[start.sh] pnpm not found in PATH" >&2
        exit 127
    fi
    echo "[start.sh] starting shell-owned MCP Chrome watcher"
    pnpm run dev &
    MCP_DEV_PID=$!
    trap 'kill "$MCP_DEV_PID" 2>/dev/null || true' EXIT INT TERM
    "$MCP_PYTHON_EXE" "$MCP_SCRIPT_DIR/service_supervisor.py" --project-root "$MCP_PROJECT_ROOT" --watch-mode dev --recover-on-start
    kill "$MCP_DEV_PID" 2>/dev/null || true
    exit
fi

echo -e "\n${CYAN}========================================${NC}"
echo -e "${CYAN}  Chrome MCP Server - Linux/macOS${NC}"
echo -e "${CYAN}========================================\n${NC}"

if [ "$HAS_DESKTOP_ENVIRONMENT" = "false" ]; then
    read -rp "Server environment detected (no desktop). Compile Chrome MCP plugin anyway? [y/N] " MCP_COMPILE_CHOICE || MCP_COMPILE_CHOICE=""
    case "$MCP_COMPILE_CHOICE" in
        y|Y|yes|YES|Yes)
            echo -e "${GREEN}  Proceeding with compilation.${NC}"
            ;;
        *)
            echo -e "${YELLOW}  Skipping Chrome MCP compilation.${NC}"
            exit 0
            ;;
    esac
fi

if [ -z "$MCP_WATCH_CHOICE" ]; then
    read -rp "Enable development watch mode? [Y/n] " MCP_WATCH_CHOICE || MCP_WATCH_CHOICE=""
fi
case "$MCP_WATCH_CHOICE" in
    n|N|no|NO|No|once|ONCE|Once)
        MCP_WATCH_MODE="once"
        echo -e "${YELLOW}  One-time build selected.${NC}"
        ;;
    *)
        MCP_WATCH_MODE="dev"
        echo -e "${GREEN}  Development watch mode selected.${NC}"
        ;;
esac
echo ""

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
    local mcp_found_bin_dir=""
    local mcp_existing=""

    # Search for node binary in well-known locations
    for mcp_search_dir in "${MCP_NODE_SEARCH_DIRS[@]}"; do
        if [ ! -d "$mcp_search_dir" ]; then
            continue
        fi
        # Find node-* directories (versioned installs)
        for mcp_ver_dir in "$mcp_search_dir"/node-v*; do
            if [ -x "$mcp_ver_dir/bin/node" ]; then
                mcp_found_bin_dir="$mcp_ver_dir/bin"
                break 2
            fi
        done
    done

    if [ -z "$mcp_found_bin_dir" ]; then
        mcp_existing=$(command -v node 2>/dev/null)
        if [ -n "$mcp_existing" ] && [ -x "$mcp_existing" ]; then
            mcp_found_bin_dir=$(dirname "$mcp_existing")
        fi
    fi

    printf '%s' "$mcp_found_bin_dir"
}

mcp_ensure_symlink() {
    local mcp_binary_name="$1"
    local mcp_source_path="$2"
    local mcp_link="/usr/local/bin/$mcp_binary_name"
    local mcp_current_target=""
    local mcp_expected_target=""

    if [ -z "$mcp_source_path" ] || [ ! -e "$mcp_source_path" ]; then
        return
    fi

    if [ -L "$mcp_link" ]; then
        mcp_current_target=$(readlink -f "$mcp_link" 2>/dev/null)
        mcp_expected_target=$(readlink -f "$mcp_source_path" 2>/dev/null)
        if [ "$mcp_current_target" = "$mcp_expected_target" ]; then
            return
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
        echo -e "${YELLOW}  Run prerequisite: scripts/shells/linux/debian/install_shells/17_install_node_toolchain_24.sh${NC}"
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
        return
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
        echo -e "${YELLOW}  Run prerequisite: scripts/shells/linux/debian/install_shells/37_ensure_pnpm_packages.sh${NC}"
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
# Run Python script
"$MCP_PYTHON_EXE" "$MCP_PYTHON_SCRIPT"

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

echo -e "${CYAN}  Installing dependencies...${NC}"
pnpm install
echo -e "${GREEN}  [OK] Dependency state aligned${NC}"

# Step 3: Build Shared package
echo ""
mcp_step3=$(mcp_get_var "$VAR_KEY_UI_STEP_3")
if [ -z "$mcp_step3" ]; then
    mcp_step3="Building shared package..."
fi
echo -e "${YELLOW}[3/6] $mcp_step3${NC}"

echo -e "${CYAN}  Building chrome-mcp-shared...${NC}"
pnpm run build:shared

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

echo -e "${CYAN}  Building mcp-chrome-bridge...${NC}"
pnpm run build:native

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

pnpm run build:extension

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
mcp_step6=$(mcp_get_var "$VAR_KEY_UI_STEP_6" "Registering Native Messaging Host...")
echo -e "${YELLOW}[6/6] $mcp_step6${NC}"

echo -e "${CYAN}  Using local development registration...${NC}"
node "$MCP_SCRIPT_DIR/register-local-dev.cjs"

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
echo -e "${GREEN}  3. Service will start on: http://$(sc_require hosts.loopback):${MCP_PORT}${NC}"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}  [OK] Setup completed successfully!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

if [ "$MCP_WATCH_MODE" = "dev" ]; then
    echo -e "${YELLOW}  Launching watch mode...${NC}"
    echo -e "${WHITE}  Automatic rebuilds enabled. Press Ctrl+C to stop.${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo -e "${CYAN}[Watch] Starting shell-owned development compilation...${NC}"
    pnpm run dev &
    MCP_DEV_PID=$!
    trap 'kill "$MCP_DEV_PID" 2>/dev/null || true' EXIT INT TERM
    "$MCP_PYTHON_EXE" "$MCP_SCRIPT_DIR/service_supervisor.py" --project-root "$MCP_PROJECT_ROOT" --watch-mode "$MCP_WATCH_MODE" --recover-on-start --foreground
    kill "$MCP_DEV_PID" 2>/dev/null || true
else
    echo -e "${YELLOW}  One-time build complete.${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    "$MCP_PYTHON_EXE" "$MCP_SCRIPT_DIR/service_supervisor.py" --wake
fi
