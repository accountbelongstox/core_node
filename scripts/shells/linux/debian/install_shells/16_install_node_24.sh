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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Declare all variables at the beginning
INSTALL_NODE=$(get_var "INSTALL_NODE")
INSTALL_MODE=$(get_var "INSTALL_MODE")
SELECTED_REGION=${SELECTED_REGION:-$(get_var "SELECTED_REGION")}
# NODE_VERSION, NODE_SHORT_VERSION, NODE_INSTALL_DIR, NODE_DOWNLOAD_URL are already defined in gvar_common.sh
# Defensive default so integer comparisons never see empty (avoids "integer expression expected")
NODE_SHORT_VERSION="${NODE_SHORT_VERSION:-24}"
# Detect architecture for correct Node binary (idempotent: reinstall if wrong arch was installed)
NODE_ARCH_SUFFIX="linux-x64"
case "$(uname -m)" in
    x86_64|amd64) NODE_ARCH_SUFFIX="linux-x64" ;;
    aarch64|arm64) NODE_ARCH_SUFFIX="linux-arm64" ;;
    armv7l|armhf) NODE_ARCH_SUFFIX="linux-armv7l" ;;
    *) echo "Unsupported architecture $(uname -m), using linux-x64"; NODE_ARCH_SUFFIX="linux-x64" ;;
esac
# Use official Node.js download URL for detected arch
NODE_DOWNLOAD_URLS=(
    "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-$NODE_ARCH_SUFFIX.tar.xz"
)
# Use global temporary directory structure
SCRIPT_TEMP_DIR=$(create_script_temp_dir "17_install_node_24")
TAR_FILE="$SCRIPT_TEMP_DIR/node-$NODE_VERSION-$NODE_ARCH_SUFFIX.tar.xz"
EXTRACT_DIR="$SCRIPT_TEMP_DIR/node-$NODE_VERSION-$NODE_ARCH_SUFFIX"
NODE_BIN_DIR="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin"

if [ "$INSTALL_NODE" = "false" ]; then
    echo "Skipping Node.js installation, INSTALL_NODE: $INSTALL_NODE, INSTALL_MODE: $INSTALL_MODE"
    exit 0
fi

echo "COMPILE_DIR: $COMPILE_DIR"
echo "SELECTED_REGION: $SELECTED_REGION"
echo "NODE_VERSION: $NODE_VERSION"
echo "NODE_ARCH_SUFFIX: $NODE_ARCH_SUFFIX"
echo "NODE_INSTALL_DIR: $NODE_INSTALL_DIR"

# Run a command as the real (desktop) user when this script runs as root, so per-user
# package-manager config (~/.config/pnpm/rc, ~/.pnpmrc, ~/.npmrc) is written with the
# REAL user's ownership. A root-mode run that writes these as root:root later
# EACCES-blocks the normal user (pnpm cannot create ~/.config/pnpm/rc.<rand>). When
# already the real user, run directly so HOME + the live session env survive. Global
# installs still land in the shared 777 $NODE_HOME (via --prefix at the call site), so
# every user shares the binaries regardless of which user ran the install.
run_as_real_user_node() {
    local cur_user real_user real_home
    cur_user="$(id -un 2>/dev/null)"
    real_user="$(get_real_user_from_common_functions 2>/dev/null || echo "")"
    if [ -z "$real_user" ] || [ "$real_user" = "root" ]; then
        real_user="${SUDO_USER:-$cur_user}"
    fi
    if [ "$(id -u)" -eq 0 ] && [ -n "$real_user" ] && [ "$real_user" != "$cur_user" ] && command -v sudo >/dev/null 2>&1; then
        real_home="$(getent passwd "$real_user" 2>/dev/null | cut -d: -f6)"
        [ -z "$real_home" ] && real_home="$HOME"
        sudo -u "$real_user" env "HOME=$real_home" "$@"
    else
        "$@"
    fi
}

# Idempotent permission repair: a prior root-mode run may have created root-owned
# package-manager config inside the real user's HOME (~/.config/pnpm, ~/.pnpmrc,
# ~/.npmrc, ~/.npm-global), which then EACCES-blocks the normal user. chown them back
# to the real user. Runs in BOTH root and normal-user mode (uses $USE_SUDO), every run.
heal_real_user_pm_config_ownership() {
    local real_user real_home cur_owner t
    real_user="$(get_real_user_from_common_functions 2>/dev/null || echo "")"
    if [ -z "$real_user" ] || [ "$real_user" = "root" ]; then
        real_user="${SUDO_USER:-$(id -un 2>/dev/null)}"
    fi
    if [ -z "$real_user" ] || [ "$real_user" = "root" ]; then
        return 0
    fi
    real_home="$(getent passwd "$real_user" 2>/dev/null | cut -d: -f6)"
    if [ -z "$real_home" ] || [ ! -d "$real_home" ]; then
        return 0
    fi
    for t in "$real_home/.config/pnpm" "$real_home/.pnpmrc" "$real_home/.npmrc" "$real_home/.npm-global"; do
        [ -e "$t" ] || continue
        cur_owner="$(stat -c '%U' "$t" 2>/dev/null || echo "")"
        if [ -n "$cur_owner" ] && [ "$cur_owner" != "$real_user" ]; then
            echo "Healing root-owned $t -> $real_user:$real_user"
            $USE_SUDO chown -R "$real_user:$real_user" "$t" 2>/dev/null || true
        fi
    done
    return 0
}

# Function to detect and fix previous installation issues
detect_and_fix_previous_issues() {
    echo "Detecting and fixing previous installation issues..."

    # 1. Fix broken environment variables from previous runs
    echo "Checking /etc/environment for broken entries..."
    if [ -f /etc/environment ]; then
        # Remove invalid NODE-V* entries
        if grep -q "NODE-V.*_HOME=" /etc/environment; then
            echo "Found broken NODE-V*_HOME entries, removing..."
            $USE_SUDO sed -i '/NODE-V.*_HOME=/d' /etc/environment
        fi

        # Remove invalid entries that don't follow KEY="VALUE" format
        if grep -q "^[^=]*=[^\"]*$" /etc/environment | grep -v "^PATH="; then
            echo "Found entries without proper quoting, fixing..."
            $USE_SUDO sed -i 's/^\([^=]*\)=\([^"]*\)$/\1="\2"/' /etc/environment
        fi

        # Remove duplicate NODE_HOME entries
        if [ $(grep -c "^NODE_HOME=" /etc/environment) -gt 1 ]; then
            echo "Found duplicate NODE_HOME entries, removing duplicates..."
            $USE_SUDO sed -i '/^NODE_HOME=/d' /etc/environment
        fi

        # Remove duplicate NODE_PATH entries
        if [ $(grep -c "^NODE_PATH=" /etc/environment) -gt 1 ]; then
            echo "Found duplicate NODE_PATH entries, removing duplicates..."
            $USE_SUDO sed -i '/^NODE_PATH=/d' /etc/environment
        fi
    fi
    
    # 2. Fix broken symlinks
    echo "Checking for broken symlinks in /usr/local/bin..."
    for binary in node npm npx; do
        local link_path="/usr/local/bin/$binary"
        if [ -L "$link_path" ] && [ ! -e "$link_path" ]; then
            echo "Found broken symlink: $link_path, removing..."
            $USE_SUDO rm -f "$link_path"
        fi
    done

    # 2b. Fix wrong-architecture Node binary (Exec format error): remove so idempotent reinstall uses correct arch
    if [ -e /usr/local/bin/node ]; then
        local node_run_err
        node_run_err=$(/usr/local/bin/node --version 2>&1) || true
        if echo "$node_run_err" | grep -q "Exec format error"; then
            echo "Found wrong-architecture Node binary (Exec format error), removing for reinstall..."
            for binary in node npm npx; do
                $USE_SUDO rm -f "/usr/local/bin/$binary"
            done
            if [ -d "$NODE_INSTALL_DIR/node-$NODE_VERSION" ]; then
                echo "Removing wrong-arch installation: $NODE_INSTALL_DIR/node-$NODE_VERSION"
                $USE_SUDO rm -rf "$NODE_INSTALL_DIR/node-$NODE_VERSION"
            fi
        fi
    fi

    # 3. Clean up old Node.js installations in wrong locations
    echo "Checking for Node.js installations in wrong locations..."
    local wrong_locations=(
        "/usr/local/node"
        "/opt/node"
        "/var/node"
    )

    for wrong_location in "${wrong_locations[@]}"; do
        if [ -d "$wrong_location" ] && [ "$wrong_location" != "$NODE_INSTALL_DIR" ]; then
            echo "Found old Node.js installation in wrong location: $wrong_location"
            read -p "Remove old installation at $wrong_location? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                $USE_SUDO rm -rf "$wrong_location"
                echo "Removed: $wrong_location"
            fi
        fi
    done

    # 4. Fix npm global directory permissions and clean up conflicting npmrc files
    if [ -d "$COMPILE_DIR/npm-global" ]; then
        echo "[SAFE_PATH] COMPILE_DIR=$COMPILE_DIR COMPILE_DIR/npm-global=$COMPILE_DIR/npm-global"
        _safe_compile=false
        if [ -n "$COMPILE_DIR" ] && [[ "$COMPILE_DIR" == /* ]]; then
            case "$COMPILE_DIR" in
                /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var) ;;
                *) _safe_compile=true ;;
            esac
        fi
        if [ "$_safe_compile" = true ]; then
            echo "Fixing npm global directory permissions..."
            if [ "$(id -u)" -eq 0 ]; then
                safe_chown_R root:root "$COMPILE_DIR/npm-global"
                safe_chmod_R 755 "$COMPILE_DIR/npm-global"
            else
                safe_chown_R "$(whoami):$(whoami)" "$COMPILE_DIR/npm-global"
                safe_chmod_R 755 "$COMPILE_DIR/npm-global"
            fi
        else
            echo "[SKIP] Refusing chown/chmod on system or invalid path: $COMPILE_DIR/npm-global"
        fi
    fi

    # 5. Clean up conflicting npmrc files when running as root
    if [ "$(id -u)" -eq 0 ]; then
        echo "Cleaning up conflicting npmrc files..."
        # Only remove the real user's conflicting .npmrc (with a backup), never every account's config.
        # Resolve the real user's home; if it cannot be resolved, skip deletion entirely.
        local real_user_npmrc_owner
        real_user_npmrc_owner="$(get_real_user_from_common_functions 2>/dev/null || echo "")"
        local real_user_home=""
        if [ -n "$real_user_npmrc_owner" ] && [ "$real_user_npmrc_owner" != "root" ]; then
            real_user_home="$(getent passwd "$real_user_npmrc_owner" 2>/dev/null | cut -d: -f6)"
        fi
        if [ -n "$real_user_home" ] && [ -d "$real_user_home" ] && [ -f "$real_user_home/.npmrc" ]; then
            cp -a "$real_user_home/.npmrc" "$real_user_home/.npmrc.bak.$(date +%s)" 2>/dev/null || true
            rm -f "$real_user_home/.npmrc" 2>/dev/null || true
        fi
    fi
    
    # 6. Heal root-owned package-manager config in the real user's HOME (prior root-mode
    # run pollution -> normal-user EACCES). Runs in both root and normal-user mode.
    heal_real_user_pm_config_ownership

    echo "Previous issues detection and fixing completed."
    return 0
}

# Idempotent: ensure the Node.js install directory is writable by ALL users (chmod 777)
# so ordinary (non-root) users can run `npm install -g` / `pnpm add -g` without sudo.
# Runs EVERY time this script executes -- including when Node is already installed
# (case 0) -- per the /opt node dir ordinary-user write requirement. The node subtree
# (NODE_INSTALL_DIR = $COMPILE_DIR/node, e.g. /opt/_<sys>_<ver>/node) is root:root 755
# after install_node, which blocks non-root global installs; this re-asserts 777 each run.
# SAFE_PATH guard prevents touching system dirs.
fix_node_install_dir_permissions_all_users() {
    echo "Ensuring Node.js install directory is writable by all users (chmod 777)..."

    local _safe_node_dir=false
    if [ -n "$NODE_INSTALL_DIR" ] && [[ "$NODE_INSTALL_DIR" == /* ]]; then
        case "$NODE_INSTALL_DIR" in
            /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var) ;;
            *) _safe_node_dir=true ;;
        esac
    fi
    if [ "$_safe_node_dir" != true ]; then
        echo "[SKIP] Refusing chmod on system or invalid path: $NODE_INSTALL_DIR"
        return 0
    fi

    if [ -d "$NODE_INSTALL_DIR" ]; then
        safe_chmod_R 777 "$NODE_INSTALL_DIR"
        echo "[OK] ensured world-writable (0777) on: $NODE_INSTALL_DIR"
    else
        echo "[SKIP] Node install dir does not exist yet: $NODE_INSTALL_DIR"
    fi
    return 0
}

# Function to configure pnpm mirror and global settings
configure_npm_settings() {
    echo "Configuring npm settings..."
    return 0
}

check_node_installation() {
    echo "Checking Node.js installation..."

    # First check if binaries exist in expected location
    local node_bin="$NODE_BIN_DIR/node"
    local npm_bin="$NODE_BIN_DIR/npm"

    if [ ! -f "$node_bin" ] || [ ! -f "$npm_bin" ]; then
        echo "Node.js not found in expected location: $NODE_INSTALL_DIR"

        # Try to find Node.js in system locations
        echo "Searching for existing Node.js installations..."
        local system_node=$(which node 2>/dev/null)
        local system_npm=$(which npm 2>/dev/null)

        if [ -n "$system_node" ] && [ -n "$system_npm" ]; then
            echo "Found system Node.js at: $system_node"
            local system_version=$("$system_node" -v 2>/dev/null | sed 's/^v//')
            local system_major=$(echo "$system_version" | cut -d. -f1)
            # Guard: wrong-arch or broken node -v can leave system_major empty; avoid "integer expression expected"
            if [ -n "$system_major" ] && [ -n "$NODE_SHORT_VERSION" ] && [ "$system_major" -ge "$NODE_SHORT_VERSION" ] 2>/dev/null; then
                echo "System Node.js version $system_version is >= $NODE_SHORT_VERSION (required)"
                echo "Will create proper symlinks and configuration..."
                return 2  # Special return code for system installation found
            else
                echo "System Node.js version $system_version is < $NODE_SHORT_VERSION (required)"
                return 3  # Special return code for old version found
            fi
        fi

        return 1
    fi

    # Check version in target directory
    local current_version
    local run_stderr
    run_stderr=$("$node_bin" -v 2>&1) || true
    current_version=$(echo "$run_stderr" | sed -n 's/^v//p')
    if [ -z "$current_version" ]; then
        if echo "$run_stderr" | grep -q "Exec format error"; then
            echo "Node binary at $node_bin is wrong architecture (Exec format error), will reinstall for $(uname -m)."
            return 4
        fi
        echo "Failed to get Node.js version from $node_bin"
        return 1
    fi

    local major_version
    major_version=$(echo "$current_version" | cut -d. -f1)
    # Guard: ensure both sides are non-empty and numeric to avoid "integer expression expected"
    if [ -z "$major_version" ] || [ -z "$NODE_SHORT_VERSION" ]; then
        echo "Failed to parse Node version (current_version=$current_version, major=$major_version)"
        return 1
    fi
    if [ "$major_version" -ge "$NODE_SHORT_VERSION" ] 2>/dev/null; then
        echo "Found Node.js $current_version in $NODE_INSTALL_DIR (>= required version $NODE_SHORT_VERSION)"
        return 0
    else
        echo "Node.js version too low. Found: $current_version, Required: >= $NODE_SHORT_VERSION.x"
        return 3  # Old version found
    fi
}

remove_old_node_installation() {
    echo "=================================================="
    echo "Old Node.js version detected"
    echo "=================================================="
    echo "Current Node.js needs to be removed to install version $NODE_SHORT_VERSION"
    echo ""

    # Find all Node.js installations
    local locations_to_remove=()

    # Check target directory
    if [ -d "$NODE_INSTALL_DIR" ]; then
        locations_to_remove+=("$NODE_INSTALL_DIR")
    fi

    # Check common installation locations
    local common_locations=(
        "/usr/local/node"
        "/opt/node"
        "/usr/lib/node"
        "/usr/local/lib/node_modules"
    )

    for loc in "${common_locations[@]}"; do
        if [ -d "$loc" ]; then
            locations_to_remove+=("$loc")
        fi
    done

    # Check symlinks
    local symlinks_to_remove=()
    for binary in node npm npx; do
        local link_path="/usr/local/bin/$binary"
        if [ -L "$link_path" ] || [ -f "$link_path" ]; then
            symlinks_to_remove+=("$link_path")
        fi
    done

    echo "Found Node.js installation(s) at:"
    for loc in "${locations_to_remove[@]}"; do
        echo "  - $loc"
    done

    if [ ${#symlinks_to_remove[@]} -gt 0 ]; then
        echo ""
        echo "Found Node.js symlinks:"
        for link in "${symlinks_to_remove[@]}"; do
            echo "  - $link"
        done
    fi

    echo ""
    echo "Remove old Node.js installation? [Y/n]"
    read -r response

    # Default to yes if user just presses Enter
    if [ -z "$response" ] || [[ "$response" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Removing old Node.js installation..."

        # Remove symlinks first
        for link in "${symlinks_to_remove[@]}"; do
            echo "Removing: $link"
            $USE_SUDO rm -f "$link"
        done

        # Remove directories
        for loc in "${locations_to_remove[@]}"; do
            echo "Removing: $loc"
            $USE_SUDO rm -rf "$loc"
        done

        # Clean up environment variables
        if [ -f /etc/environment ]; then
            echo "Cleaning up environment variables..."
            $USE_SUDO sed -i '/^NODE_HOME=/d' /etc/environment
            $USE_SUDO sed -i '/^NODE_PATH=/d' /etc/environment
            $USE_SUDO sed -i '/^NPM_CONFIG_PREFIX=/d' /etc/environment
        fi

        echo "Old Node.js installation removed successfully"
        return 0
    else
        echo "Installation cancelled by user"
        return 1
    fi
}

# Idempotent: when a fresh install is required, force-clean target, extract dir, and download
# so install always has a clean state (avoids inter-device mv and leftover dirs).
force_clean_for_node_install() {
    echo "Force-cleaning old Node install target and temp files for idempotent install..."

    local target_dir="$NODE_INSTALL_DIR/node-$NODE_VERSION"

    for binary in node npm npx; do
        $USE_SUDO rm -f "/usr/local/bin/$binary"
    done

    if [ -d "$target_dir" ]; then
        echo "Removing existing target: $target_dir"
        $USE_SUDO rm -rf "$target_dir"
    fi

    if [ -d "$EXTRACT_DIR" ]; then
        echo "Removing extract dir: $EXTRACT_DIR"
        $USE_SUDO rm -rf "$EXTRACT_DIR"
    fi

    if [ -f "$TAR_FILE" ]; then
        echo "Removing cached download: $TAR_FILE"
        rm -f "$TAR_FILE"
    fi

    echo "Force-clean completed."
}


install_node() {
    echo "Installing Node.js $NODE_VERSION..."
    echo "Download URL: ${NODE_DOWNLOAD_URLS[0]}"

    cleanup_temp_files_from_common_functions "$EXTRACT_DIR"

    # Check if download already exists using common function
    if ! check_existing_download_from_common_functions "$TAR_FILE" 20971520; then
        echo "Downloading Node.js $NODE_VERSION..."
        # Use common download function with fallback support
        if ! download_with_fallback_from_common_functions "${NODE_DOWNLOAD_URLS[@]}" "$TAR_FILE"; then
            echo "Failed to download Node.js from any source"
            return 1
        fi
    fi

    echo "Extracting Node.js..."
    if ! extract_archive_from_common_functions "$TAR_FILE" "$EXTRACT_DIR" 1; then
        echo "Failed to extract Node.js"
        return 1
    fi

    echo "Installing Node.js to $NODE_INSTALL_DIR..."
    $USE_SUDO mkdir -p "$NODE_INSTALL_DIR"
    local target_dir="$NODE_INSTALL_DIR/node-$NODE_VERSION"
    $USE_SUDO rm -rf "$target_dir"

    local src_dev target_dev
    src_dev=$(stat -c %d "$EXTRACT_DIR" 2>/dev/null || echo "")
    target_dev=$(stat -c %d "$NODE_INSTALL_DIR" 2>/dev/null || echo "")
    if [ -n "$src_dev" ] && [ -n "$target_dev" ] && [ "$src_dev" != "$target_dev" ]; then
        echo "Cross-device install: copying then removing extract dir..."
        $USE_SUDO cp -a "$EXTRACT_DIR" "$target_dir"
        if [ $? -ne 0 ]; then
            echo "Failed to install Node.js (cp failed)"
            return 1
        fi
        $USE_SUDO rm -rf "$EXTRACT_DIR"
    else
        if ! $USE_SUDO mv "$EXTRACT_DIR" "$target_dir"; then
            echo "Failed to install Node.js"
            return 1
        fi
    fi

    # Set proper permissions (validate path to avoid touching system dirs)
    echo "[SAFE_PATH] NODE_INSTALL_DIR=$NODE_INSTALL_DIR"
    _safe_node_install=false
    if [ -n "$NODE_INSTALL_DIR" ] && [[ "$NODE_INSTALL_DIR" == /* ]]; then
        case "$NODE_INSTALL_DIR" in
            /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var) ;;
            *) _safe_node_install=true ;;
        esac
    fi
    if [ "$_safe_node_install" = true ]; then
        safe_chown_R root:root "$NODE_INSTALL_DIR/node-$NODE_VERSION"
        safe_chmod_R 755 "$NODE_INSTALL_DIR/node-$NODE_VERSION"
    else
        echo "[SKIP] Refusing chown/chmod on system or invalid path: $NODE_INSTALL_DIR"
    fi

    cleanup_temp_files_from_common_functions "$EXTRACT_DIR"
    return 0
}

# After install_node: if node binary fails with Exec format error (wrong arch), retry with alternate arch once.
ensure_node_correct_arch() {
    local node_bin="$NODE_BIN_DIR/node"
    [ ! -f "$node_bin" ] && return 0
    local out
    out=$("$node_bin" -v 2>&1) || true
    if echo "$out" | grep -q "Exec format error"; then
        echo "Wrong architecture detected (Exec format error). Retrying with alternate arch..."
        if [ "$NODE_ARCH_SUFFIX" = "linux-x64" ]; then
            NODE_ARCH_SUFFIX="linux-arm64"
        else
            NODE_ARCH_SUFFIX="linux-x64"
        fi
        NODE_DOWNLOAD_URLS=("https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-$NODE_ARCH_SUFFIX.tar.xz")
        TAR_FILE="$SCRIPT_TEMP_DIR/node-$NODE_VERSION-$NODE_ARCH_SUFFIX.tar.xz"
        EXTRACT_DIR="$SCRIPT_TEMP_DIR/node-$NODE_VERSION-$NODE_ARCH_SUFFIX"
        force_clean_for_node_install
        install_node
    fi
    return 0
}

# Create and verify the /usr/local/bin symlinks for node/npm/npx. This function's
# header had been lost: its body ran at top level (local/return errors) and the
# trailing `}` was a syntax error that ABORTED the whole script before install_node
# ran -- so node never installed. Restored here.
create_symlinks() {
    echo "Creating and verifying symlinks..."

    local node_path="$NODE_BIN_DIR/node"
    local npm_path="$NODE_BIN_DIR/npm"
    local npx_path="$NODE_BIN_DIR/npx"

    if [ ! -f "$node_path" ] || [ ! -f "$npm_path" ]; then
        echo "Error: Node.js binaries not found in $NODE_BIN_DIR"
        return 1
    fi

    $USE_SUDO ln -sf "$node_path" /usr/local/bin/node
    echo "Created symlink: /usr/local/bin/node -> $node_path"

    $USE_SUDO ln -sf "$npm_path" /usr/local/bin/npm
    echo "Created symlink: /usr/local/bin/npm -> $npm_path"

    $USE_SUDO ln -sf "$npx_path" /usr/local/bin/npx
    echo "Created symlink: /usr/local/bin/npx -> $npx_path"

    echo "Core Node.js symlinks created successfully"
    return 0
}

setup_environment() {
    echo "Setting up Node.js environment variables..."

    if [ -f /etc/environment ]; then
        echo "Cleaning up previous broken environment variables..."
        $USE_SUDO sed -i '/NODE-V.*_HOME=/d' /etc/environment
        $USE_SUDO sed -i '/^NODE_HOME=/d' /etc/environment
        $USE_SUDO sed -i '/^NODE_PATH=/d' /etc/environment
        $USE_SUDO sed -i '/^PNPM_HOME=/d' /etc/environment
    fi

    local actual_node_home="$NODE_INSTALL_DIR/node-$NODE_VERSION"
    local actual_node_path="$actual_node_home/lib/node_modules"
    local pnpm_home="$actual_node_home/pnpm-global"

    set_env_and_var "NODE_HOME" "$actual_node_home"
    set_env_and_var "NODE_PATH" "$actual_node_path"
    # PNPM_HOME (all users): pnpm-installed global binaries live in $PNPM_HOME/bin,
    # which we also put on PATH below so every user can run them. Per pnpm docs.
    set_env_and_var "PNPM_HOME" "$pnpm_home"

    local current_path=$(grep "^PATH=" /etc/environment 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "$PATH")
    local npm_global_bin="$actual_node_home/bin"
    local pnpm_global_bin="$pnpm_home/bin"

    # Prepend whichever of {pnpm_global_bin, npm_global_bin} is not already on PATH
    # so all users get both node/npm and pnpm-installed global CLIs.
    local prepend=""
    if [[ "$current_path" != *"$pnpm_global_bin"* ]]; then
        prepend="$pnpm_global_bin"
    fi
    if [[ "$current_path" != *"$npm_global_bin"* ]]; then
        if [ -n "$prepend" ]; then
            prepend="$prepend:$npm_global_bin"
        else
            prepend="$npm_global_bin"
        fi
    fi
    if [ -n "$prepend" ]; then
        set_env_and_var "PATH" "$prepend:$current_path"
        echo "Added to PATH: $prepend"
    else
        echo "npm + pnpm global directories already in PATH"
    fi

    echo "Environment variables configured:"
    echo "  NODE_HOME: $actual_node_home"
    echo "  NODE_PATH: $actual_node_path"
    echo "  PNPM_HOME: $pnpm_home"
    echo "  PATH includes: $npm_global_bin $pnpm_global_bin"

    return 0
}

verify_and_fix_all_configs() {
    echo "=================================================="
    echo "Verifying and fixing all Node.js configurations..."
    echo "=================================================="

    local node_home="$NODE_INSTALL_DIR/node-$NODE_VERSION"
    local npm_bin="$node_home/bin/npm"
    local pnpm_bin="$node_home/bin/pnpm"
    local yarn_bin="$node_home/bin/yarn"
    local pnpm_global_dir="$node_home/pnpm-global"
    local global_npmrc="$node_home/etc/npmrc"
    local npm_registry pnpm_registry
    if [ "$SELECTED_REGION" = "China" ]; then
        npm_registry="https://registry.npmmirror.com"
        pnpm_registry="https://repo.huaweicloud.com/repository/npm/"
    else
        npm_registry="https://registry.npmjs.org/"
        pnpm_registry="https://registry.npmjs.org/"
    fi

    # Silence deprecated/unknown npm env configs inherited from the parent shell so
    # npm/pnpm stop emitting "npm warn Unknown env config confirm-modules-purge /
    # manage-package-manager-versions" on every call.
    unset npm_config_confirm_modules_purge npm_config_manage_package_manager_versions

    echo "[1/3] Configuring npm (system-wide)..."
    # Global npm/pnpm config at $node_home/etc/npmrc: read by npm globally (all users)
    # and by pnpm (npmrc-compatible). Gives every user the same registry + pnpm global
    # dirs WITHOUT per-user writes (which, created by root, EACCES-block the normal
    # user). prefix=$node_home makes `npm -g` land in the shared tree regardless of any
    # per-user ~/.npmrc prefix. 644 so any user can read it.
    $USE_SUDO mkdir -p "$node_home/etc"
    $USE_SUDO tee "$global_npmrc" >/dev/null <<EOF
registry=$npm_registry
prefix=$node_home
global-dir=$pnpm_global_dir
global-bin-dir=$pnpm_global_dir/bin
EOF
    $USE_SUDO chmod 644 "$global_npmrc"
    echo "Wrote global npm/pnpm config: $global_npmrc"

    echo ""
    echo "[2/3] Installing and configuring pnpm..."
    # --prefix forces the shared $node_home regardless of any per-user ~/.npmrc prefix,
    # so pnpm lands in $node_home/bin (usable by all users via the /usr/local/bin
    # symlink). Run as the real user when root so no root-owned file is left in any
    # user's HOME (the EACCES root cause).
    if [ -x "$pnpm_bin" ]; then
        echo "pnpm already installed globally, skipping reinstall"
    else
        run_as_real_user_node "$npm_bin" install -g pnpm --prefix="$node_home"
    fi
    $USE_SUDO ln -sf "$pnpm_bin" /usr/local/bin/pnpm
    echo "Linked: /usr/local/bin/pnpm"

    # Per-user pnpm rc for the real (desktop) user, written AS that user so it is owned
    # correctly (no root pollution -> no EACCES). pnpm's own global rc is
    # ~/.config/pnpm/rc (per pnpm docs); this mirrors the system-wide npmrc above.
    run_as_real_user_node "$pnpm_bin" config set global-dir "$pnpm_global_dir"
    run_as_real_user_node "$pnpm_bin" config set global-bin-dir "$pnpm_global_dir/bin"
    run_as_real_user_node "$pnpm_bin" config set registry "$pnpm_registry"
    echo "pnpm configured"

    echo ""
    echo "[3/3] Installing and linking yarn..."
    if [ -x "$yarn_bin" ]; then
        echo "yarn already installed globally, skipping reinstall"
    else
        run_as_real_user_node "$npm_bin" install -g yarn --prefix="$node_home"
    fi
    $USE_SUDO ln -sf "$yarn_bin" /usr/local/bin/yarn
    echo "Linked: /usr/local/bin/yarn"

    echo ""
    echo "=================================================="
    echo "All configurations completed"
    echo "=================================================="
    return 0
}

verify_installation() {
    echo "Verifying installation..."

    # Check binaries in install directory
    local node_bin="$NODE_BIN_DIR/node"
    local npm_bin="$NODE_BIN_DIR/npm"

    if [ ! -f "$node_bin" ] || [ ! -f "$npm_bin" ]; then
        echo "Error: Node.js binaries not found in installation directory"
        return 1
    fi

    # Check symlinks
    if [ ! -L /usr/local/bin/node ] || [ ! -L /usr/local/bin/npm ]; then
        echo "Error: Symlinks verification failed"
        return 1
    fi

    echo "Node.js version (from install dir): $($node_bin -v)"
    echo "npm version: $($npm_bin -v)"
    if [ -f "$NODE_BIN_DIR/npx" ]; then
        echo "npx version: $($NODE_BIN_DIR/npx -v)"
    fi

    # Require /usr/local/bin/node --version to work (catches Exec format error after symlink)
    local node_version_out
    if ! node_version_out=$(/usr/local/bin/node --version 2>&1); then
        echo "Error: /usr/local/bin/node --version failed: $node_version_out"
        return 1
    fi
    echo "node --version (from PATH/symlink): $node_version_out"

    # Show pnpm configuration if available
    if command -v pnpm >/dev/null 2>&1; then
        echo ""
        echo "pnpm version: $(pnpm --version)"
        echo "pnpm configuration:"
        pnpm config list
    fi

    return 0
}

# Main execution
echo "Node.js Installation Script"
echo "Target version: $NODE_VERSION"
echo "Installation directory: $NODE_INSTALL_DIR"

# First, detect and fix any previous installation issues
detect_and_fix_previous_issues

# Check installation status
installation_status=$(check_node_installation)
installation_result=$?

case $installation_result in
    0)
        echo "=================================================="
        echo "Node.js $NODE_VERSION is already installed"
        echo "=================================================="
        echo "Verifying and fixing configuration if needed..."
        echo ""
        ;;
    2)
        echo "=================================================="
        echo "Found compatible system Node.js installation"
        echo "=================================================="
        echo "Will configure symlinks and environment for existing installation."
        echo ""
        ;;
    3|4)
        echo "=================================================="
        echo "Old or wrong-architecture Node.js found"
        echo "=================================================="
        echo ""
        if [ "$installation_result" -eq 4 ]; then
            echo "Removing wrong-architecture installation (idempotent repair)..."
            for binary in node npm npx; do
                $USE_SUDO rm -f "/usr/local/bin/$binary"
            done
            $USE_SUDO rm -rf "$NODE_INSTALL_DIR/node-$NODE_VERSION"
        else
            if ! remove_old_node_installation; then
                echo "Installation cancelled"
                exit 0
            fi
        fi
        echo ""
        force_clean_for_node_install
        echo "Installing Node.js $NODE_VERSION ($NODE_ARCH_SUFFIX)..."
        if ! install_node; then
            echo "Node.js installation failed"
            exit 1
        fi
        ensure_node_correct_arch
        ;;
    1)
        echo "=================================================="
        echo "No Node.js installation found"
        echo "=================================================="
        echo "Installing Node.js $NODE_VERSION..."
        echo ""
        force_clean_for_node_install
        if ! install_node; then
            echo "Node.js installation failed"
            exit 1
        fi
        ensure_node_correct_arch
        ;;
esac

if ! create_symlinks; then
    echo "Failed to create symlinks"
    exit 1
fi

if ! setup_environment; then
    echo "Failed to setup environment"
    exit 1
fi

# Always re-assert 777 on the node install dir (idempotent, every run) so ordinary
# users can run npm/pnpm global installs without sudo. Covers the already-installed path.
fix_node_install_dir_permissions_all_users

echo ""
verify_and_fix_all_configs

echo ""
if ! verify_installation; then
    echo "Installation verification failed"
    exit 1
fi

echo "Node.js installation completed successfully!"
echo "COMPILE_DIR: $COMPILE_DIR"
echo "Node.js installed in: $NODE_INSTALL_DIR/node-$NODE_VERSION"
echo "npm global packages in: $NODE_INSTALL_DIR/node-$NODE_VERSION"
echo "Node.js binaries linked to: /usr/local/bin/"
echo "To use updated environment variables, restart your shell or run 'source /etc/environment'"
