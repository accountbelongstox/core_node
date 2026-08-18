#!/bin/bash
# Node.js Toolchain installer for Debian.
# Installs or upgrades: node, npm, corepack, pnpm, yarn, bun.

SCRIPT_NAME="17_install_node_toolchain_24.sh"
SCRIPT_INDEX="17"

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
COMMON_DIR="$PARENT_DIR_LEVEL_2/common"

SCRIPT_TEMP_NAME="17_install_node_toolchain_24"
SCRIPT_TEMP_DIR=""

source "$COMMON_DIR/gvar_common.sh"
source "$COMMON_DIR/common_functions.sh"
source "$COMMON_DIR/runtime_helpers_common.sh"

SELECTED_REGION="${SELECTED_REGION:-$(get_var "SELECTED_REGION" 2>/dev/null || echo "Global")}"
INSTALL_NODE="${INSTALL_NODE:-$(get_var "INSTALL_NODE" 2>/dev/null || echo "true")}"

NODE_SHORT_VERSION_GUARD="${NODE_SHORT_VERSION:-24}"
if [ -z "$NODE_SHORT_VERSION_GUARD" ]; then
    NODE_SHORT_VERSION_GUARD=24
fi
NODE_SHORT_VERSION_GUARD="${NODE_SHORT_VERSION_GUARD//[^0-9]/}"
if [ -z "$NODE_SHORT_VERSION_GUARD" ]; then
    NODE_SHORT_VERSION_GUARD=24
fi

NODE_VERSION="${NODE_VERSION:-v24.11.1}"
NODE_INSTALL_DIR="${NODE_INSTALL_DIR:-$COMPILE_DIR/node}"
NODE_INSTALLATION_DIR="$NODE_INSTALL_DIR/$NODE_VERSION"
NODE_BIN_DIR="$NODE_INSTALLATION_DIR/bin"
NODE_HOME_PATH="$NODE_INSTALLATION_DIR"
NODE_PATH_VALUE="$NODE_INSTALLATION_DIR/lib/node_modules"
NODE_BIN_PATH="$NODE_BIN_DIR/node"
NPM_BIN_PATH="$NODE_BIN_DIR/npm"
NPX_BIN_PATH="$NODE_BIN_DIR/npx"
COREPACK_BIN_PATH="$NODE_BIN_DIR/corepack"
PNPM_BIN_PATH="$NODE_BIN_DIR/pnpm"
YARN_BIN_PATH="$NODE_BIN_DIR/yarn"
PNPM_HOME_PATH="$NODE_INSTALLATION_DIR/pnpm-global"
PNPM_GLOBAL_BIN_DIR="$PNPM_HOME_PATH/bin"
COREPACK_LINK="/usr/local/bin/corepack"
NPM_LINK="/usr/local/bin/npm"
NPX_LINK="/usr/local/bin/npx"
NODE_LINK="/usr/local/bin/node"
PNPM_LINK="/usr/local/bin/pnpm"
YARN_LINK="/usr/local/bin/yarn"

BUN_INSTALL_DIR="${BUN_INSTALL_DIR:-$COMPILE_DIR/bun}"
BUN_BIN_DIR="$BUN_INSTALL_DIR/bin"
BUN_BIN_PATH="$BUN_BIN_DIR/bun"
BUN_LINK="/usr/local/bin/bun"

NPM_REGISTRY="https://registry.npmjs.org/"
PNPM_REGISTRY="https://registry.npmjs.org/"
if [ "$SELECTED_REGION" = "China" ]; then
    NPM_REGISTRY="https://registry.npmmirror.com/"
    PNPM_REGISTRY="https://registry.npmmirror.com/"
fi

NODE_ARCH_SUFFIX="linux-x64"
NODE_ARCHIVE_PATH=""
NODE_EXTRACT_DIR=""
NODE_ARCHIVE_MIN_SIZE=20971520
NODE_DOWNLOAD_URLS=()

NODE_STATE=""
NODE_INSTALLED_VERSION=""
NODE_INSTALLED_MAJOR=""

SCRIPT_TEMP_DIR="$(create_script_temp_dir "$SCRIPT_TEMP_NAME")"
if [ -z "$SCRIPT_TEMP_DIR" ] || [ ! -d "$SCRIPT_TEMP_DIR" ]; then
    SCRIPT_TEMP_DIR="/tmp/$SCRIPT_TEMP_NAME"
    $USE_SUDO mkdir -p "$SCRIPT_TEMP_DIR" 2>/dev/null || true
fi

normalize_arch_suffix() {
    local machine_arch=""
    machine_arch="$(uname -m 2>/dev/null || echo "x86_64")"
    case "$machine_arch" in
        x86_64|amd64) NODE_ARCH_SUFFIX="linux-x64" ;;
        aarch64|arm64) NODE_ARCH_SUFFIX="linux-arm64" ;;
        armv7l|armhf) NODE_ARCH_SUFFIX="linux-armv7l" ;;
        *) NODE_ARCH_SUFFIX="linux-x64" ;;
    esac
}

normalize_node_version() {
    local raw=""
    raw="$1"
    raw="${raw#v}"
    raw="${raw%%[^0-9.]*}"
    echo "$raw"
}

version_ge() {
    local left raw_left raw_right
    local -a left_parts right_parts
    local idx=0
    local left_num=0
    local right_num=0

    raw_left="$(normalize_node_version "$1")"
    raw_right="$(normalize_node_version "$2")"

    IFS="." read -r -a left_parts <<< "$raw_left"
    IFS="." read -r -a right_parts <<< "$raw_right"

    while [ $idx -lt 4 ]; do
        left_num="${left_parts[$idx]:-0}"
        right_num="${right_parts[$idx]:-0}"

        if [ -z "$left_num" ]; then
            left_num=0
        fi
        if [ -z "$right_num" ]; then
            right_num=0
        fi

        if [ "$left_num" -gt "$right_num" ]; then
            return 0
        fi
        if [ "$left_num" -lt "$right_num" ]; then
            return 1
        fi
        idx=$((idx + 1))
    done

    return 0
}

read_environment_path() {
    local env_path=""
    if [ -f /etc/environment ]; then
        env_path="$(awk -F= '/^PATH=/{gsub(/^"|"$/,"",$2); print $2; exit}' /etc/environment 2>/dev/null)"
    fi
    if [ -z "$env_path" ]; then
        env_path="/usr/local/bin:/usr/bin:/bin"
    fi
    echo "$env_path"
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

ensure_path_entry() {
    local entry="$1"
    local env_path=""

    if [ -z "$entry" ] || [ ! -d "$entry" ]; then
        return
    fi

    env_path="$(read_environment_path)"
    if [ "$(path_has_entry "$env_path" "$entry")" != "true" ]; then
        set_env_and_var "PATH" "$entry:$env_path"
    fi

    if [ "$(path_has_entry "$PATH" "$entry")" != "true" ]; then
        export PATH="$entry:$PATH"
    fi
}

cleanup_environment_entries() {
    if [ ! -f /etc/environment ]; then
        return
    fi
    $USE_SUDO sed -i '/^NODE_.*_HOME=/d' /etc/environment 2>/dev/null || true
    $USE_SUDO sed -i '/^NODE_HOME=/d' /etc/environment 2>/dev/null || true
    $USE_SUDO sed -i '/^NODE_PATH=/d' /etc/environment 2>/dev/null || true
    $USE_SUDO sed -i '/^PNPM_HOME=/d' /etc/environment 2>/dev/null || true
    $USE_SUDO sed -i '/^BUN_INSTALL=/d' /etc/environment 2>/dev/null || true
}

repair_broken_symlinks() {
    local target=""
    for target in /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/pnpm /usr/local/bin/yarn /usr/local/bin/bun; do
        if [ -L "$target" ] && [ ! -e "$target" ]; then
            $USE_SUDO rm -f "$target"
        elif [ -f "$target" ] && [ ! -x "$target" ]; then
            $USE_SUDO rm -f "$target"
        fi
    done
}

cleanup_wrong_install_locations() {
    local candidate=""
    local candidate_state=""

    for candidate in /usr/local/node /opt/node /var/node; do
        if [ -d "$candidate" ] && [ "$candidate" != "$NODE_INSTALL_DIR" ]; then
            if [ -x "$candidate/bin/node" ] && [ -x "$candidate/bin/npm" ] && [ -x "$candidate/bin/npx" ]; then
                candidate_state="$("$candidate/bin/node" -v 2>/dev/null || true)"
                if [ -n "$candidate_state" ]; then
                    $USE_SUDO rm -rf "$candidate"
                fi
            fi
        fi
    done
}

evaluate_node_state() {
    local version_output=""
    local exec_error=""

    NODE_STATE="MISSING"
    NODE_INSTALLED_VERSION=""
    NODE_INSTALLED_MAJOR=""

    if [ -x "$NODE_BIN_PATH" ] && [ -x "$NPM_BIN_PATH" ] && [ -x "$NPX_BIN_PATH" ]; then
        version_output="$("$NODE_BIN_PATH" -v 2>&1 || true)"
        exec_error="$version_output"

        if echo "$exec_error" | grep -qi "exec format error"; then
            NODE_STATE="WRONG_ARCH"
            return
        fi

        if echo "$exec_error" | grep -q "^v[0-9]"; then
            NODE_INSTALLED_VERSION="$(normalize_node_version "$version_output")"
            NODE_INSTALLED_MAJOR="${NODE_INSTALLED_VERSION%%.*}"
            if version_ge "$NODE_INSTALLED_VERSION" "$NODE_VERSION"; then
                NODE_STATE="READY"
            else
                NODE_STATE="UPGRADE_NEEDED"
            fi
            return
        fi
    fi
}

remove_corrupted_node_binary_dir() {
    if [ -x "$NODE_BIN_PATH" ]; then
        rm -f "$NODE_LINK" "$NPM_LINK" "$NPX_LINK" "$COREPACK_LINK" "$PNPM_LINK" "$YARN_LINK" "$BUN_LINK" 2>/dev/null || true
        $USE_SUDO rm -rf "$NODE_INSTALLATION_DIR"
    fi
}

prepare_node_download_plan() {
    NODE_ARCHIVE_PATH="$SCRIPT_TEMP_DIR/node-$NODE_VERSION-$NODE_ARCH_SUFFIX.tar.xz"
    NODE_EXTRACT_DIR="$SCRIPT_TEMP_DIR/node-$NODE_VERSION-$NODE_ARCH_SUFFIX"
    NODE_DOWNLOAD_URLS=(
        "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-$NODE_ARCH_SUFFIX.tar.xz"
    )
}

download_node_archive() {
    prepare_node_download_plan

    cleanup_temp_files_from_common_functions "$NODE_EXTRACT_DIR"
    if check_existing_download_from_common_functions "$NODE_ARCHIVE_PATH" "$NODE_ARCHIVE_MIN_SIZE"; then
        return
    fi

    download_with_fallback_from_common_functions "${NODE_DOWNLOAD_URLS[@]}" "$NODE_ARCHIVE_PATH" || true
}

extract_node_archive() {
    if [ ! -f "$NODE_ARCHIVE_PATH" ]; then
        return
    fi

    cleanup_temp_files_from_common_functions "$NODE_EXTRACT_DIR"
    $USE_SUDO mkdir -p "$NODE_EXTRACT_DIR"
    extract_archive_from_common_functions "$NODE_ARCHIVE_PATH" "$NODE_EXTRACT_DIR" 1 || true
}

install_node_tree() {
    if [ ! -d "$NODE_EXTRACT_DIR" ] || [ ! -x "$NODE_EXTRACT_DIR/bin/node" ]; then
        return
    fi

    $USE_SUDO rm -rf "$NODE_INSTALLATION_DIR"
    mv "$NODE_EXTRACT_DIR" "$NODE_INSTALLATION_DIR" 2>/dev/null || true
}

ensure_node_installation() {
    evaluate_node_state
    if [ "$NODE_STATE" = "READY" ] && [ "$NODE_INSTALLED_MAJOR" -ge "$NODE_SHORT_VERSION_GUARD" ] 2>/dev/null; then
        return
    fi

    remove_corrupted_node_binary_dir
    download_node_archive
    extract_node_archive
    install_node_tree
}

ensure_link() {
    local source_bin=""
    local link_path=""
    source_bin="$1"
    link_path="$2"

    if [ -z "$source_bin" ] || [ -z "$link_path" ]; then
        return
    fi
    if [ ! -x "$source_bin" ]; then
        return
    fi

    if [ -L "$link_path" ]; then
        local current_link=""
        current_link="$(readlink -f "$link_path" 2>/dev/null || true)"
        if [ "$current_link" = "$source_bin" ]; then
            return
        fi
    fi

    $USE_SUDO rm -f "$link_path"
    $USE_SUDO ln -sf "$source_bin" "$link_path"
}

ensure_node_symlinks() {
    ensure_link "$NODE_BIN_PATH" "$NODE_LINK"
    ensure_link "$NPM_BIN_PATH" "$NPM_LINK"
    ensure_link "$NPX_BIN_PATH" "$NPX_LINK"
    ensure_link "$COREPACK_BIN_PATH" "$COREPACK_LINK"
    ensure_link "$PNPM_BIN_PATH" "$PNPM_LINK"
    ensure_link "$YARN_BIN_PATH" "$YARN_LINK"
    ensure_link "$BUN_BIN_PATH" "$BUN_LINK"
}

configure_node_environment_variables() {
    set_env_and_var "NODE_HOME" "$NODE_HOME_PATH"
    set_env_and_var "NODE_PATH" "$NODE_PATH_VALUE"
    set_env_and_var "PNPM_HOME" "$PNPM_HOME_PATH"
    set_env_and_var "BUN_INSTALL" "$BUN_INSTALL_DIR"

    ensure_path_entry "$NODE_BIN_DIR"
    ensure_path_entry "$PNPM_HOME_PATH/bin"
    ensure_path_entry "$BUN_BIN_DIR"
    ensure_path_entry "/usr/local/bin"
}

configure_npmrc() {
    local npmrc_file=""
    local npmrc_tmp=""
    local npmrc_content=""
    npmrc_file="$NODE_HOME_PATH/etc/npmrc"
    npmrc_tmp="$(mktemp)"
    cat > "$npmrc_tmp" <<EOF
prefix=$NODE_HOME_PATH
registry=$NPM_REGISTRY
EOF

    npmrc_content="$(cat "$npmrc_tmp")"
    if [ ! -f "$npmrc_file" ] || [ "$npmrc_content" != "$(cat "$npmrc_file" 2>/dev/null)" ]; then
        $USE_SUDO mkdir -p "$NODE_HOME_PATH/etc"
        $USE_SUDO cp "$npmrc_tmp" "$npmrc_file"
        $USE_SUDO chmod 644 "$npmrc_file" 2>/dev/null || true
    fi
    rm -f "$npmrc_tmp" 2>/dev/null || true
}

ensure_npm_latest() {
    if [ -x "$NPM_BIN_PATH" ]; then
        "$NPM_BIN_PATH" install -g npm@latest --no-audit --no-fund --ignore-scripts || true
        configure_npmrc
    fi
}

ensure_corepack() {
    if [ -x "$COREPACK_BIN_PATH" ]; then
        "$COREPACK_BIN_PATH" enable || true
        "$COREPACK_BIN_PATH" prepare pnpm@latest --activate || true
        "$COREPACK_BIN_PATH" prepare yarn@stable --activate || true
    elif [ -x "$NPM_BIN_PATH" ]; then
        "$NPM_BIN_PATH" install -g corepack@latest --no-audit --no-fund --ignore-scripts || true
    fi

    if [ -x "$COREPACK_BIN_PATH" ]; then
        ensure_link "$COREPACK_BIN_PATH" "$COREPACK_LINK"
    fi
}

ensure_pnpm() {
    if [ -x "$COREPACK_BIN_PATH" ]; then
        "$COREPACK_BIN_PATH" prepare pnpm@latest --activate || true
    fi

    if [ -x "$COREPACK_BIN_PATH" ] && [ -x "$PNPM_BIN_PATH" ]; then
        "$COREPACK_BIN_PATH" enable pnpm || true
    elif [ -x "$NPM_BIN_PATH" ]; then
        "$NPM_BIN_PATH" install -g pnpm@latest --no-audit --no-fund --ignore-scripts || true
    fi

    if [ -x "$PNPM_BIN_PATH" ]; then
        $USE_SUDO mkdir -p "$PNPM_HOME_PATH" "$PNPM_HOME_PATH/bin" "$PNPM_HOME_PATH/store"
        repair_owned_tree_777 "$PNPM_HOME_PATH"
        "$PNPM_BIN_PATH" config set global-dir "$PNPM_HOME_PATH" || true
        "$PNPM_BIN_PATH" config set global-bin-dir "$PNPM_HOME_PATH/bin" || true
        "$PNPM_BIN_PATH" config set store-dir "$PNPM_HOME_PATH/store" || true
        "$PNPM_BIN_PATH" config set registry "$PNPM_REGISTRY" || true
        ensure_path_entry "$PNPM_HOME_PATH/bin"
        ensure_link "$PNPM_BIN_PATH" "$PNPM_LINK"
    fi
}

reconcile_pnpm_toolchain_environment() {
    local resolved_global_bin=""

    # Always clear stale overrides before re-configuring pnpm context.
    unset PNPM_HOME

    if [ -x "$PNPM_BIN_PATH" ]; then
        $USE_SUDO mkdir -p "$PNPM_HOME_PATH" "$PNPM_HOME_PATH/bin" "$PNPM_HOME_PATH/store" || true
        repair_owned_tree_777 "$PNPM_HOME_PATH" || true
        "$PNPM_BIN_PATH" config set global-dir "$PNPM_HOME_PATH" || true
        "$PNPM_BIN_PATH" config set global-bin-dir "$PNPM_HOME_PATH/bin" || true
        "$PNPM_BIN_PATH" config set store-dir "$PNPM_HOME_PATH/store" || true
        "$PNPM_BIN_PATH" config set registry "$PNPM_REGISTRY" || true
        ensure_link "$PNPM_BIN_PATH" "$PNPM_LINK"

        resolved_global_bin="$("$PNPM_BIN_PATH" config get global-bin-dir 2>/dev/null || true)"
    fi

    set_env_and_var "PNPM_HOME" "$PNPM_HOME_PATH"
    if [ -n "$resolved_global_bin" ]; then
        set_var "PNPM_GLOBAL_BIN_DIR" "$resolved_global_bin"
        ensure_path_entry "$resolved_global_bin"
    else
        set_var "PNPM_GLOBAL_BIN_DIR" "$PNPM_HOME_PATH/bin"
        ensure_path_entry "$PNPM_HOME_PATH/bin"
    fi

    ensure_path_entry "$NODE_BIN_DIR"
    ensure_path_entry "/usr/local/bin"
}

ensure_yarn() {
    if [ -x "$COREPACK_BIN_PATH" ]; then
        "$COREPACK_BIN_PATH" prepare yarn@stable --activate || true
    fi
    if [ ! -x "$YARN_BIN_PATH" ] && [ -x "$NPM_BIN_PATH" ]; then
        "$NPM_BIN_PATH" install -g yarn@latest --no-audit --no-fund --ignore-scripts || true
    fi
    if [ -x "$YARN_BIN_PATH" ]; then
        ensure_link "$YARN_BIN_PATH" "$YARN_LINK"
    fi
}

ensure_bun() {
    if [ -x "$BUN_BIN_PATH" ]; then
        "$BUN_BIN_PATH" upgrade || true
    fi

    if [ ! -x "$BUN_BIN_PATH" ]; then
        $USE_SUDO mkdir -p "$BUN_INSTALL_DIR"
        if command -v curl >/dev/null 2>&1; then
            $USE_SUDO env HOME="$BUN_INSTALL_DIR" BUN_INSTALL="$BUN_INSTALL_DIR" sh -c 'curl -fsSL https://bun.sh/install | bash' || true
        elif command -v wget >/dev/null 2>&1; then
            $USE_SUDO env HOME="$BUN_INSTALL_DIR" BUN_INSTALL="$BUN_INSTALL_DIR" sh -c 'wget -qO- https://bun.sh/install | bash' || true
        fi
    fi

    if [ -x "$BUN_BIN_PATH" ]; then
        ensure_link "$BUN_BIN_PATH" "$BUN_LINK"
        $USE_SUDO chmod +x "$BUN_BIN_PATH" 2>/dev/null || true
        $USE_SUDO chmod 777 "$BUN_INSTALL_DIR" 2>/dev/null || true
    fi
}

repair_permissions() {
    if [ -d "$NODE_INSTALL_DIR" ]; then
        repair_owned_tree_777 "$NODE_INSTALL_DIR"
    fi
    if [ -d "$PNPM_HOME_PATH" ]; then
        repair_owned_tree_777 "$PNPM_HOME_PATH"
    fi
    if [ -d "$BUN_INSTALL_DIR" ]; then
        repair_owned_tree_777 "$BUN_INSTALL_DIR"
    fi
}

verify_installation() {
    local corepack_version=""
    local pnpm_version=""
    local yarn_version=""
    local bun_version=""
    local node_version=""
    local npm_version=""
    local npx_version=""

    echo "=================================================="
    if [ -x "$NODE_BIN_PATH" ]; then
        node_version="$("$NODE_BIN_PATH" -v 2>/dev/null || echo "missing")"
    else
        node_version="missing"
    fi
    if [ -x "$NPM_BIN_PATH" ]; then
        npm_version="$("$NPM_BIN_PATH" -v 2>/dev/null || echo "missing")"
    else
        npm_version="missing"
    fi
    if [ -x "$NPX_BIN_PATH" ]; then
        npx_version="$("$NPX_BIN_PATH" -v 2>/dev/null || echo "missing")"
    else
        npx_version="missing"
    fi
    if [ -x "$COREPACK_BIN_PATH" ]; then
        corepack_version="$("$COREPACK_BIN_PATH" --version 2>/dev/null || echo "missing")"
    else
        corepack_version="missing"
    fi
    if [ -x "$PNPM_BIN_PATH" ]; then
        pnpm_version="$("$PNPM_BIN_PATH" -v 2>/dev/null || echo "missing")"
    else
        pnpm_version="missing"
    fi
    if [ -x "$YARN_BIN_PATH" ]; then
        yarn_version="$("$YARN_BIN_PATH" -v 2>/dev/null || echo "missing")"
    else
        yarn_version="missing"
    fi
    if [ -x "$BUN_BIN_PATH" ]; then
        bun_version="$("$BUN_BIN_PATH" --version 2>/dev/null || echo "missing")"
    else
        bun_version="missing"
    fi

    echo "Node.js version (from install dir): $node_version"
    echo "npm version: $npm_version"
    echo "npx version: $npx_version"
    echo "corepack version: $corepack_version"
    echo "pnpm version: $pnpm_version"
    echo "yarn version: $yarn_version"
    echo "bun version: $bun_version"
    echo "node --version (PATH): $(node -v 2>/dev/null || echo "missing")"
    echo "npm --version (PATH): $(npm -v 2>/dev/null || echo "missing")"
    echo "PATH includes: $PATH"
    echo "=================================================="
}

print_banner() {
    echo "=================================================="
    echo "Node.js Toolchain Installation Script"
    echo "Target version: $NODE_VERSION"
    echo "Installation directory: $NODE_INSTALL_DIR"
    echo "Tools: node, npm, pnpm, yarn, corepack, bun"
    echo "=================================================="
}

print_exit_summary() {
    echo "Node.js toolchain installation completed."
    echo "COMPILE_DIR: $COMPILE_DIR"
    echo "Node.js installed in: $NODE_INSTALLATION_DIR"
    echo "npm global packages in: $NODE_INSTALLATION_DIR"
    echo "Node.js binaries linked to: /usr/local/bin/"
    echo "To use updated environment variables, restart your shell or run 'source /etc/environment'"
}

if [ "$INSTALL_NODE" = "false" ]; then
    echo "Skipping Node.js installation, INSTALL_NODE: $INSTALL_NODE"
    echo "To use updated environment variables, restart your shell or run 'source /etc/environment'"
else
    echo "COMPILE_DIR: $COMPILE_DIR"
    echo "SELECTED_REGION: $SELECTED_REGION"
    echo "NODE_VERSION: $NODE_VERSION"
    echo "NODE_INSTALL_DIR: $NODE_INSTALL_DIR"
    echo "SCRIPT: $SCRIPT_NAME"

    normalize_arch_suffix
    print_banner

    cleanup_environment_entries
    repair_broken_symlinks
    cleanup_wrong_install_locations

    ensure_node_installation
    ensure_node_symlinks
    configure_node_environment_variables
    configure_npmrc
    repair_permissions
    ensure_npm_latest
    ensure_corepack
    ensure_pnpm
    reconcile_pnpm_toolchain_environment
    ensure_yarn
    ensure_bun
    ensure_node_symlinks
    reconcile_pnpm_toolchain_environment
    ensure_path_entry "$BUN_BIN_DIR"
    ensure_path_entry "/usr/local/bin"
    repair_permissions
    verify_installation
    print_exit_summary
fi

cleanup_script_temp_dir "$SCRIPT_TEMP_NAME"
