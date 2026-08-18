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

SCRIPT_NAME="17_install_node_toolchain_24.sh"
SCRIPT_INDEX="17"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

INSTALL_NODE=$(get_var "INSTALL_NODE")
INSTALL_MODE=$(get_var "INSTALL_MODE")
SELECTED_REGION="${SELECTED_REGION:-$(get_var "SELECTED_REGION")}"

NODE_INSTALLATION_DIR="$NODE_INSTALL_DIR/node-$NODE_VERSION"
NODE_INSTALL_BIN_DIR="$NODE_INSTALLATION_DIR/bin"
NODE_HOME_PATH="$NODE_INSTALLATION_DIR"
NODE_PATH_VALUE="$NODE_INSTALLATION_DIR/lib/node_modules"
PNPM_HOME_PATH="$NODE_INSTALLATION_DIR/pnpm-global"
NPM_BIN_PATH="$NODE_INSTALL_BIN_DIR/npm"
NPX_BIN_PATH="$NODE_INSTALL_BIN_DIR/npx"
NODE_BIN_PATH="$NODE_INSTALL_BIN_DIR/node"
COREPACK_BIN_PATH="$NODE_INSTALL_BIN_DIR/corepack"
PNPM_BIN_PATH="$NODE_INSTALL_BIN_DIR/pnpm"
YARN_BIN_PATH="$NODE_INSTALL_BIN_DIR/yarn"
BUN_BIN_PATH="$BUN_BIN_DIR/bun"
BUN_SYMLINK="/usr/local/bin/bun"
NPM_SYMLINK="/usr/local/bin/npm"
NODE_SYMLINK="/usr/local/bin/node"
NPX_SYMLINK="/usr/local/bin/npx"
COREPACK_SYMLINK="/usr/local/bin/corepack"
PNPM_SYMLINK="/usr/local/bin/pnpm"
YARN_SYMLINK="/usr/local/bin/yarn"
SCRIPT_TEMP_DIR=$(create_script_temp_dir "17_install_node_toolchain")
TAR_FILE="$SCRIPT_TEMP_DIR/node-$NODE_VERSION.tar.xz"
EXTRACT_DIR="$SCRIPT_TEMP_DIR/node-$NODE_VERSION"

NODE_SHORT_VERSION_GUARD="${NODE_SHORT_VERSION:-24}"
NODE_ARCH_SUFFIX="linux-x64"
NODE_DOWNLOAD_URLS=()
NODE_INSTALL_OK="false"
NODE_INSTALLATION_STATUS="NOT_FOUND"
NODE_VERSION_CURRENT=""
NPM_REGISTRY="https://registry.npmjs.org/"
PNPM_REGISTRY="https://registry.npmjs.org/"

if [ "$SELECTED_REGION" = "China" ]; then
    NPM_REGISTRY="https://registry.npmmirror.com/"
    PNPM_REGISTRY="https://registry.npmmirror.com/"
fi
SKIP_TOOLCHAIN_INSTALL="false"

if [ "$INSTALL_NODE" = "false" ]; then
    echo "Skipping Node.js installation, INSTALL_NODE: $INSTALL_NODE, INSTALL_MODE: $INSTALL_MODE"
    echo "To use updated environment variables, restart your shell or run 'source /etc/environment'"
    SKIP_TOOLCHAIN_INSTALL="true"
fi

echo "COMPILE_DIR: $COMPILE_DIR"
echo "SELECTED_REGION: $SELECTED_REGION"
echo "NODE_VERSION: $NODE_VERSION"
echo "NODE_INSTALL_DIR: $NODE_INSTALL_DIR"
echo "SCRIPT: $SCRIPT_NAME"

if [ "$NODE_SHORT_VERSION_GUARD" -le 0 ]; then
    NODE_SHORT_VERSION_GUARD=24
fi

case "$(uname -m)" in
    x86_64|amd64) NODE_ARCH_SUFFIX="linux-x64" ;;
    aarch64|arm64) NODE_ARCH_SUFFIX="linux-arm64" ;;
    armv7l|armhf) NODE_ARCH_SUFFIX="linux-armv7l" ;;
    *) echo "Unsupported architecture $(uname -m), using linux-x64 fallback"; NODE_ARCH_SUFFIX="linux-x64" ;;
esac

NODE_DOWNLOAD_URLS=(
    "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-$NODE_ARCH_SUFFIX.tar.xz"
)

NODE_TOOLS_BINARIES=(
    node
    npm
    npx
    corepack
    pnpm
    yarn
    bun
)

sanitize_path_for_environment() {
    local candidate="$1"
    if [ -z "$candidate" ] || [ ! -d "$candidate" ]; then
        echo ""
        return
    fi
    echo "$candidate"
}

path_has_entry() {
    local path_value="$1"
    local entry="$2"
    if [ -z "$path_value" ] || [ -z "$entry" ]; then
        echo "false"
        return
    fi
    case ",$path_value," in
        *,"$entry",*) echo "true" ;;
        *) echo "false" ;;
    esac
}

append_path_entry_to_environment() {
    local entry="$1"
    local current_path
    local has_entry

    entry="$(sanitize_path_for_environment "$entry")"
    if [ -z "$entry" ]; then
        return
    fi

    if [ -f /etc/environment ]; then
        current_path="$(grep '^PATH=' /etc/environment 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "")"
    fi
    if [ -z "$current_path" ]; then
        current_path="/usr/local/bin:/usr/bin:/bin"
    fi

    has_entry="$(path_has_entry "$current_path" "$entry")"
    if [ "$has_entry" = "true" ]; then
        return
    fi
    set_env_and_var "PATH" "$entry:$current_path"
}

# Run command as the real desktop user when running as root so per-user pm config is owned
# correctly. This avoids `~/.config/pnpm/rc` permission issues for normal users.
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
        (cd "$real_home" 2>/dev/null || cd /tmp; sudo -u "$real_user" env "HOME=$real_home" "$@")
    else
        "$@"
    fi
}

heal_real_user_pm_config_ownership() {
    local real_user real_home cur_owner target
    real_user="$(get_real_user_from_common_functions 2>/dev/null || echo "")"
    if [ -z "$real_user" ] || [ "$real_user" = "root" ]; then
        real_user="${SUDO_USER:-$(id -un 2>/dev/null)}"
    fi
    if [ -z "$real_user" ] || [ "$real_user" = "root" ]; then
        return
    fi
    real_home="$(getent passwd "$real_user" 2>/dev/null | cut -d: -f6)"
    if [ -z "$real_home" ] || [ ! -d "$real_home" ]; then
        return
    fi

    for target in "$real_home/.config/pnpm" "$real_home/.pnpmrc" "$real_home/.npmrc" "$real_home/.npm-global"; do
        [ -e "$target" ] || continue
        cur_owner="$(stat -c '%U' "$target" 2>/dev/null || echo "")"
        if [ -n "$cur_owner" ] && [ "$cur_owner" != "$real_user" ]; then
            echo "Healing root-owned package config: $target"
            $USE_SUDO chown -R "$real_user:$real_user" "$target" 2>/dev/null || true
        fi
    done
}

is_safe_system_path() {
    local path_value="$1"
    if [ -z "$path_value" ] || [ "${path_value:0:1}" != "/" ]; then
        echo "false"
        return
    fi
    case "$path_value" in
        /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var)
            echo "false" ;;
        *) echo "true" ;;
    esac
}

detect_and_fix_previous_issues() {
    echo "Detecting and fixing previous installation issues..."

    # 1) environment variable cleanup in /etc/environment
    if [ -f /etc/environment ]; then
        echo "Checking /etc/environment for broken entries..."
        $USE_SUDO sed -i '/NODE-V.*_HOME=/d' /etc/environment 2>/dev/null || true
        $USE_SUDO sed -i '/^NODE_HOME=/d' /etc/environment 2>/dev/null || true
        $USE_SUDO sed -i '/^NODE_PATH=/d' /etc/environment 2>/dev/null || true
        $USE_SUDO sed -i '/^PNPM_HOME=/d' /etc/environment 2>/dev/null || true
        $USE_SUDO sed -i '/^BUN_INSTALL=/d' /etc/environment 2>/dev/null || true
    fi

    # 2) remove broken global node toolchain symlinks
    echo "Checking /usr/local/bin for broken links..."
    for binary in "${NODE_TOOLS_BINARIES[@]}"; do
        local link_path="/usr/local/bin/$binary"
        if [ -L "$link_path" ] && [ ! -e "$link_path" ]; then
            echo "Removing broken symlink: $link_path"
            $USE_SUDO rm -f "$link_path"
        fi
    done

    # 3) repair exec format issue on wrong architecture
    if [ -e "$NODE_SYMLINK" ]; then
        local node_err
        node_err=$("$NODE_SYMLINK" -v 2>&1) || true
        if echo "$node_err" | grep -qi "exec format error"; then
            echo "Found wrong-architecture node symlink, removing links and target path."
            $USE_SUDO rm -f "$NODE_SYMLINK" "$NPM_SYMLINK" "$NPX_SYMLINK" "$COREPACK_SYMLINK" "$PNPM_SYMLINK" "$YARN_SYMLINK" "$BUN_SYMLINK"
            $USE_SUDO rm -rf "$NODE_INSTALLATION_DIR"
        fi
    fi

    # 4) cleanup known wrong-location Node trees (idempotent and non-interactive)
    echo "Checking for Node.js installations in known wrong locations..."
    for wrong_location in /usr/local/node /opt/node /var/node /usr/local/lib/node_modules; do
        if [ -d "$wrong_location" ] && [ "$wrong_location" != "$NODE_INSTALL_DIR" ]; then
            echo "Removing legacy node location: $wrong_location"
            $USE_SUDO rm -rf "$wrong_location"
        fi
    done

    # 5) remove conflicting user `.npmrc` when running as root (keep real-user config)
    if [ "$(id -u)" -eq 0 ]; then
        local real_user_owner real_user_home
        real_user_owner="$(get_real_user_from_common_functions 2>/dev/null || echo "")"
        if [ -n "$real_user_owner" ] && [ "$real_user_owner" != "root" ]; then
            real_user_home="$(getent passwd "$real_user_owner" 2>/dev/null | cut -d: -f6)"
            if [ -n "$real_user_home" ] && [ -f "$real_user_home/.npmrc" ]; then
                cp -a "$real_user_home/.npmrc" "$real_user_home/.npmrc.bak.$(date +%s)" 2>/dev/null || true
                rm -f "$real_user_home/.npmrc" 2>/dev/null || true
            fi
        fi
    fi

    heal_real_user_pm_config_ownership
    echo "Previous issues detection and fixing completed."
}

check_node_installation_status() {
    NODE_INSTALLATION_STATUS="NOT_FOUND"
    NODE_INSTALL_OK="false"
    NODE_VERSION_CURRENT=""

    if [ ! -x "$NODE_BIN_PATH" ] || [ ! -x "$NPM_BIN_PATH" ] || [ ! -x "$NPX_BIN_PATH" ]; then
        if [ -x "$NODE_BIN_PATH" ] || [ -x "$NPM_BIN_PATH" ] || [ -x "$NPX_BIN_PATH" ]; then
            NODE_INSTALLATION_STATUS="PARTIAL"
        fi
        return
    fi

    local node_version_output node_major
    node_version_output=$("$NODE_BIN_PATH" -v 2>&1 || true)
    if echo "$node_version_output" | grep -qi "exec format error"; then
        NODE_INSTALLATION_STATUS="WRONG_ARCH"
        return
    fi

    NODE_VERSION_CURRENT="$(echo "$node_version_output" | sed 's/^v//g')"
    node_major="$(echo "$NODE_VERSION_CURRENT" | cut -d. -f1)"
    if [ -z "$node_major" ]; then
        NODE_INSTALLATION_STATUS="NOT_FOUND"
        return
    fi

    if [ "$node_major" -ge "$NODE_SHORT_VERSION_GUARD" ] 2>/dev/null; then
        NODE_INSTALLATION_STATUS="READY"
        NODE_INSTALL_OK="true"
    else
        NODE_INSTALLATION_STATUS="OLD_VERSION"
    fi
}

clean_node_install_workspace() {
    echo "Cleaning Node.js install workspace for idempotent re-install..."

    for binary in node npm npx corepack pnpm yarn; do
        $USE_SUDO rm -f "/usr/local/bin/$binary" 2>/dev/null || true
    done
    if [ "$NODE_INSTALLATION_DIR" = "$NODE_INSTALLATION_DIR" ] && [ -d "$NODE_INSTALLATION_DIR" ]; then
        $USE_SUDO rm -rf "$NODE_INSTALLATION_DIR"
    fi
    if [ -d "$EXTRACT_DIR" ]; then
        cleanup_temp_files_from_common_functions "$EXTRACT_DIR"
    fi
    if [ -f "$TAR_FILE" ]; then
        rm -f "$TAR_FILE"
    fi
}

download_node_payload() {
    cleanup_temp_files_from_common_functions "$EXTRACT_DIR"
    if ! check_existing_download_from_common_functions "$TAR_FILE" 20971520; then
        download_with_fallback_from_common_functions "${NODE_DOWNLOAD_URLS[@]}" "$TAR_FILE"
    fi
}

extract_node_payload() {
    extract_archive_from_common_functions "$TAR_FILE" "$EXTRACT_DIR" 1
}

install_node_tree() {
    echo "Installing Node.js $NODE_VERSION..."
    echo "Download URL: ${NODE_DOWNLOAD_URLS[0]}"

    download_node_payload
    extract_node_payload

    if [ -d "$EXTRACT_DIR" ]; then
        $USE_SUDO mkdir -p "$NODE_INSTALL_DIR"
        $USE_SUDO rm -rf "$NODE_INSTALLATION_DIR"

        local source_dev target_dev
        source_dev=$(stat -c %d "$EXTRACT_DIR" 2>/dev/null || echo "")
        target_dev=$(stat -c %d "$NODE_INSTALL_DIR" 2>/dev/null || echo "")
        if [ -n "$source_dev" ] && [ -n "$target_dev" ] && [ "$source_dev" != "$target_dev" ]; then
            $USE_SUDO cp -a "$EXTRACT_DIR" "$NODE_INSTALLATION_DIR"
            $USE_SUDO rm -rf "$EXTRACT_DIR"
        else
            $USE_SUDO mv "$EXTRACT_DIR" "$NODE_INSTALLATION_DIR"
        fi

        if [ -d "$NODE_INSTALLATION_DIR" ]; then
            local safe_target
            safe_target="$(is_safe_system_path "$NODE_INSTALL_DIR")"
            if [ "$safe_target" = "true" ]; then
                safe_chown_R root:root "$NODE_INSTALLATION_DIR"
                safe_chmod_R 755 "$NODE_INSTALLATION_DIR"
            else
                echo "[SKIP] Refusing permission fix on unsafe path: $NODE_INSTALLATION_DIR"
            fi
        fi
        NODE_INSTALL_OK="true"
    fi

    cleanup_temp_files_from_common_functions "$EXTRACT_DIR"
}

check_node_correct_architecture() {
    local output
    output=$("$NODE_BIN_PATH" -v 2>&1 || true)
    if echo "$output" | grep -qi "exec format error"; then
        echo "Detected wrong architecture binary in $NODE_BIN_PATH"
        NODE_INSTALLATION_STATUS="WRONG_ARCH"
        NODE_INSTALL_OK="false"
        return
    fi

    if [ -x "$COREPACK_BIN_PATH" ] && [ -x "$NPM_BIN_PATH" ]; then
        NODE_INSTALLATION_STATUS="READY"
        NODE_INSTALL_OK="true"
    else
        NODE_INSTALLATION_STATUS="PARTIAL"
        NODE_INSTALL_OK="false"
    fi
}

ensure_node_installation() {
    check_node_installation_status

    case "$NODE_INSTALLATION_STATUS" in
        READY)
            echo "=================================================="
            echo "Node.js $NODE_VERSION is already installed"
            echo "=================================================="
            ;;
        WRONG_ARCH|OLD_VERSION|PARTIAL|NOT_FOUND)
            echo "=================================================="
            echo "Node.js $NODE_VERSION needs install or re-install"
            echo "=================================================="
            clean_node_install_workspace
            install_node_tree
            check_node_correct_architecture
            if [ "$NODE_INSTALL_OK" != "true" ]; then
                echo "[WARN] Node.js install did not complete this run."
            fi
            ;;
        *)
            clean_node_install_workspace
            install_node_tree
            check_node_correct_architecture
            ;;
    esac
}

fix_node_install_dir_permissions_all_users() {
    echo "Ensuring Node.js install directory is writable by all users (chmod 777)..."
    local safe_path
    safe_path="$(is_safe_system_path "$NODE_INSTALL_DIR")"
    if [ "$safe_path" != "true" ]; then
        echo "[SKIP] Refusing chmod on unsafe path: $NODE_INSTALL_DIR"
        return
    fi
    if [ -d "$NODE_INSTALL_DIR" ]; then
        repair_owned_tree_777 "$NODE_INSTALL_DIR"
        echo "[OK] ensured active-user ownership and mode 777 on: $NODE_INSTALL_DIR"
    else
        echo "[SKIP] Node install dir does not exist yet: $NODE_INSTALL_DIR"
    fi
}

create_or_refresh_symlink() {
    local source_path="$1"
    local link_path="$2"
    if [ -x "$source_path" ]; then
        $USE_SUDO ln -sf "$source_path" "$link_path"
        echo "Linked: $link_path -> $source_path"
    fi
}

create_core_symlinks() {
    echo "Creating and verifying symlinks..."
    create_or_refresh_symlink "$NODE_BIN_PATH" "$NODE_SYMLINK"
    create_or_refresh_symlink "$NPM_BIN_PATH" "$NPM_SYMLINK"
    create_or_refresh_symlink "$NPX_BIN_PATH" "$NPX_SYMLINK"
    create_or_refresh_symlink "$COREPACK_BIN_PATH" "$COREPACK_SYMLINK"
    create_or_refresh_symlink "$PNPM_BIN_PATH" "$PNPM_SYMLINK"
    create_or_refresh_symlink "$YARN_BIN_PATH" "$YARN_SYMLINK"
    create_or_refresh_symlink "$BUN_BIN_PATH" "$BUN_SYMLINK"
}

setup_environment() {
    echo "Setting up Node.js environment variables..."
    set_env_and_var "NODE_HOME" "$NODE_HOME_PATH"
    set_env_and_var "NODE_PATH" "$NODE_PATH_VALUE"
    set_env_and_var "PNPM_HOME" "$PNPM_HOME_PATH"
    set_env_and_var "BUN_INSTALL" "$BUN_INSTALL_DIR"

    append_path_entry_to_environment "$NODE_BIN_PATH"
    append_path_entry_to_environment "$PNPM_HOME_PATH/bin"
    append_path_entry_to_environment "$BUN_BIN_DIR"
    append_path_entry_to_environment "/usr/local/bin"
}

refresh_npmrc_config() {
    local global_npmrc="$NODE_HOME_PATH/etc/npmrc"
    echo "Configuring npm global rc: $global_npmrc"
    $USE_SUDO mkdir -p "$NODE_HOME_PATH/etc"
    cat > "$global_npmrc" <<EOF
prefix=$NODE_HOME_PATH
registry=$NPM_REGISTRY
EOF
    $USE_SUDO chmod 644 "$global_npmrc"
}

ensure_npm() {
    echo "[1/4] Ensuring npm and npm config..."
    if [ ! -x "$NPM_BIN_PATH" ]; then
        echo "[WARN] npm not found in expected location: $NPM_BIN_PATH"
        return
    fi
    local npm_version
    npm_version=$("$NPM_BIN_PATH" -v 2>/dev/null || true)
    if [ -n "$npm_version" ]; then
        echo "Current npm version: $npm_version"
    fi
    run_npm_from_common_functions install -g npm@latest --no-audit --no-fund --ignore-scripts >/dev/null 2>&1 || true
    refresh_npmrc_config
}

ensure_corepack() {
    echo "[2/4] Ensuring corepack..."
    if [ ! -x "$COREPACK_BIN_PATH" ]; then
        if [ -x "$NPM_BIN_PATH" ]; then
            echo "Corepack not found; installing from npm..."
            run_npm_from_common_functions install -g corepack@latest --no-audit --no-fund --ignore-scripts >/dev/null 2>&1 || true
        fi
    fi

    if [ -x "$COREPACK_BIN_PATH" ]; then
        echo "Corepack version: $("$COREPACK_BIN_PATH" --version 2>/dev/null || true)"
        "$COREPACK_BIN_PATH" enable >/dev/null 2>&1 || true
        "$COREPACK_BIN_PATH" prepare pnpm@latest --activate >/dev/null 2>&1 || true
        "$COREPACK_BIN_PATH" prepare yarn@stable --activate >/dev/null 2>&1 || true
    else
        echo "[WARN] corepack is still not available, continuing with npm-managed flow."
    fi
}

ensure_pnpm() {
    echo "[3/4] Ensuring pnpm..."
    if [ -x "$NPM_BIN_PATH" ]; then
        run_npm_from_common_functions install -g pnpm@latest --no-audit --no-fund --ignore-scripts >/dev/null 2>&1 || true
    fi

    if [ -x "$PNPM_BIN_PATH" ]; then
        echo "Linked: $PNPM_SYMLINK -> $PNPM_BIN_PATH"
        create_or_refresh_symlink "$PNPM_BIN_PATH" "$PNPM_SYMLINK"
        run_pnpm_from_common_functions config set global-dir "$PNPM_HOME_PATH" >/dev/null 2>&1 || true
        run_pnpm_from_common_functions config set global-bin-dir "$PNPM_HOME_PATH/bin" >/dev/null 2>&1 || true
        run_pnpm_from_common_functions config set registry "$PNPM_REGISTRY" >/dev/null 2>&1 || true
        echo "pnpm version: $(pnpm --version 2>/dev/null || true)"
        echo "pnpm configuration:"
        pnpm config list >/dev/null 2>&1 || true
    else
        echo "[WARN] pnpm is still missing after upgrade attempt."
    fi
}

ensure_yarn() {
    echo "[4/4] Ensuring yarn..."
    if [ -x "$NPM_BIN_PATH" ]; then
        run_npm_from_common_functions install -g yarn@latest --no-audit --no-fund --ignore-scripts >/dev/null 2>&1 || true
    fi

    if [ -x "$YARN_BIN_PATH" ]; then
        create_or_refresh_symlink "$YARN_BIN_PATH" "$YARN_SYMLINK"
        echo "yarn version: $("$YARN_BIN_PATH" -v 2>/dev/null || true)"
    else
        echo "[WARN] yarn is still missing after upgrade attempt."
    fi
}

install_or_upgrade_bun() {
    echo "Ensuring bun..."
    if [ -x "$BUN_BIN_PATH" ]; then
        local bun_version
        bun_version=$("$BUN_BIN_PATH" --version 2>/dev/null || true)
        if [ -n "$bun_version" ]; then
            echo "Bun version: $bun_version"
            if "$BUN_BIN_PATH" upgrade >/dev/null 2>&1; then
                echo "Bun upgrade completed."
            fi
            return
        fi
    fi

    echo "Installing/upgrading bun via official installer"
    $USE_SUDO env HOME="$BUN_INSTALL_DIR" BUN_INSTALL="$BUN_INSTALL_DIR" sh -c 'curl -fsSL https://bun.sh/install | bash' >/tmp/bun-install.log 2>&1 || true
    if [ -s /tmp/bun-install.log ]; then
        echo "Bun installer output recorded at /tmp/bun-install.log"
    fi
    if [ ! -x "$BUN_BIN_PATH" ] && command -v wget >/dev/null 2>&1; then
        $USE_SUDO env HOME="$BUN_INSTALL_DIR" BUN_INSTALL="$BUN_INSTALL_DIR" sh -c 'wget -qO- https://bun.sh/install | bash' >/tmp/bun-install.log 2>&1 || true
    fi
    create_or_refresh_symlink "$BUN_BIN_PATH" "$BUN_SYMLINK"
    if [ -x "$BUN_BIN_PATH" ]; then
        echo "Bun ready: $("$BUN_BIN_PATH" --version 2>/dev/null || true)"
    else
        echo "[WARN] bun is still missing; will retry on next run."
    fi
}

configure_after_install() {
    setup_environment
    ensure_npm
    ensure_corepack
    ensure_pnpm
    ensure_yarn
    create_or_refresh_symlink "$COREPACK_BIN_PATH" "$COREPACK_SYMLINK"
    install_or_upgrade_bun
}

verify_installation() {
    echo "Verifying installation..."
    if [ ! -x "$NODE_BIN_PATH" ] || [ ! -x "$NPM_BIN_PATH" ]; then
        echo "Error: Node.js binaries missing in $NODE_INSTALLATION_DIR"
        return
    fi

    echo "Node.js version (from install dir): $($NODE_BIN_PATH -v)"
    echo "npm version: $($NPM_BIN_PATH -v)"
    echo "npx version: $($NPX_BIN_PATH -v)"
    echo "corepack version: $("$COREPACK_BIN_PATH" --version 2>/dev/null || true)"
    echo "pnpm version: $(pnpm --version 2>/dev/null || echo 'missing')"
    echo "yarn version: $(yarn --version 2>/dev/null || echo 'missing')"
    echo "bun version: $("$BUN_BIN_PATH" --version 2>/dev/null || echo 'missing')"
    echo "node --version (from PATH): $(node --version 2>/dev/null || true)"
    echo "Node.js binaries linked to /usr/local/bin/"
}

if [ "$SKIP_TOOLCHAIN_INSTALL" != "true" ]; then
    echo "Node.js Toolchain Installation Script"
    echo "Target version: $NODE_VERSION"
    echo "Installation directory: $NODE_INSTALL_DIR"
    echo "Tools: node, npm, pnpm, yarn, corepack, bun"

    detect_and_fix_previous_issues
    ensure_node_installation
    create_core_symlinks
    fix_node_install_dir_permissions_all_users
    configure_after_install
    verify_installation

    echo "Node.js toolchain installation completed."
    echo "COMPILE_DIR: $COMPILE_DIR"
    echo "Node.js installed in: $NODE_INSTALLATION_DIR"
    echo "npm global packages in: $NODE_INSTALLATION_DIR"
    echo "Node.js binaries linked to: /usr/local/bin/"
    echo "To use updated environment variables, restart your shell or run 'source /etc/environment'"
fi
