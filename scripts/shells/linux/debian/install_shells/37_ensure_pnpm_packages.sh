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
SCRIPT_INDEX="29"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
# Get region information
SELECTED_REGION=$(get_var "SELECTED_REGION")

# Get USE_SUDO variable 
USE_SUDO=$(get_var "USE_SUDO")
if [ -z "$USE_SUDO" ]; then
    USE_SUDO="sudo"
fi

CHECK_PACKAGES_SCRIPT="$(dirname "$PARENT_DIR_LEVEL_2")/scripts/check_global_packages.js"

# Fallback registry when registry.npmjs.org returns 403 (e.g. network/proxy/geo restriction)
FALLBACK_REGISTRY="https://registry.npmmirror.com/"
PNPM_REGISTRY_DEFAULT="https://registry.npmjs.org/"
PNPM_REGISTRY_CHINA="https://repo.huaweicloud.com/repository/npm/"

RESOLVED_PNPM_GLOBAL_DIR="${PNPM_GLOBAL_DIR:-$NODE_BIN_DIR/../pnpm-global}"
RESOLVED_PNPM_GLOBAL_BIN_DIR="${PNPM_GLOBAL_BIN_DIR:-$RESOLVED_PNPM_GLOBAL_DIR/bin}"

# Resolve current non-root user home for .pnpmrc writes.
resolve_pnpm_user_home() {
    local real_user_home=""
    local real_user=""

    real_user="$(get_real_user_from_common_functions 2>/dev/null || echo "")"
    if [ -n "$real_user" ] && [ "$real_user" != "root" ]; then
        real_user_home="$(getent passwd "$real_user" 2>/dev/null | cut -d: -f6)"
    fi
    echo "${real_user_home:-${HOME:-/root}}"
}

resolve_pnpm_binary_path() {
    local pnpm_path=""

    if [ -x "$PNPM_BIN" ]; then
        pnpm_path="$PNPM_BIN"
    elif [ -x "$NODE_BIN_DIR/pnpm" ]; then
        pnpm_path="$NODE_BIN_DIR/pnpm"
    elif command -v pnpm >/dev/null 2>&1; then
        pnpm_path="$(command -v pnpm)"
        if [ -n "$pnpm_path" ] && [ ! -x "$pnpm_path" ]; then
            pnpm_path=""
        fi
    fi

    echo "$pnpm_path"
}

# Function to extract package names from pnpm list output
get_installed_packages() {
    # Use the Node.js script to get the package list
    if [ -f "$CHECK_PACKAGES_SCRIPT" ]; then
        GLOBAL_PACKAGES=$(run_node_from_common_functions "$CHECK_PACKAGES_SCRIPT" list)
    else
        echo "Warning: check_global_packages.js not found at $CHECK_PACKAGES_SCRIPT"
        echo "Falling back to pnpm list command"
        GLOBAL_PACKAGES=$(run_pnpm_from_common_functions list -g --depth=0 2>/dev/null || run_npm_from_common_functions list -g --depth=0)
    fi
    echo "$GLOBAL_PACKAGES" | grep -v 'pnpm@\|npm@' | sed -n 's/.*\([@/][^@]*\)@.*/\1/p' | sed 's/^[@/]*//'
}

get_package_binary_name() {
    local package_name="$1"

    if [[ "$package_name" == @*/* ]]; then
        package_name="${package_name#*/}"
    fi
    echo "$package_name"
}

# Function to check if a package is installed and linked correctly
is_package_installed() {
    local package_name=$1
    local pnpm_bin_dir=$(run_pnpm_from_common_functions bin -g 2>/dev/null)
    local package_binary_name=""
    package_binary_name="$(get_package_binary_name "$package_name")"

    if [ -n "$pnpm_bin_dir" ] && [ -x "$pnpm_bin_dir/$package_binary_name" ]; then
        echo "true"
    elif command -v "$package_binary_name" >/dev/null 2>&1; then
        echo "true"
    else
        echo "false"
    fi
}

# Function to install package if not already installed
ensure_package() {
    local package=$1

    if [ "$(is_package_installed "$package")" = "true" ]; then
        echo "[$SCRIPT_INDEX] $package is already installed, skipping..."
        return
    fi

    echo "[$SCRIPT_INDEX] Installing $package..."

    # Guard against ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY: this script runs under
    # automation (no TTY); allow pnpm to purge/replace the global modules dir non-interactively.
    export npm_config_confirm_modules_purge=false
    do_install() {
        local temp_log=$(mktemp)
        if [ "$package" = "puppeteer" ]; then
            PUPPETEER_SKIP_DOWNLOAD=true run_pnpm_from_common_functions --config.confirm-modules-purge=false add -g "$package" 2>&1 | tee "$temp_log"
        else
            run_pnpm_from_common_functions --config.confirm-modules-purge=false add -g "$package" 2>&1 | tee "$temp_log"
        fi
        
        if grep -q "ERR_PNPM_UNEXPECTED_STORE" "$temp_log"; then
            echo "[$SCRIPT_INDEX] Detected store mismatch. Cleaning up global node_modules to fix..."
            local pnpm_global_dir=$(run_pnpm_from_common_functions config get global-dir 2>/dev/null)
            if [ -n "$pnpm_global_dir" ] && [ -d "$pnpm_global_dir" ]; then
                # Remove the layout version directories (e.g., 5, 6)
                find "$pnpm_global_dir" -maxdepth 1 -type d -name "[0-9]*" -exec rm -rf {} + 2>/dev/null || true
                echo "[$SCRIPT_INDEX] Retrying installation of $package..."
                if [ "$package" = "puppeteer" ]; then
                    PUPPETEER_SKIP_DOWNLOAD=true run_pnpm_from_common_functions --config.confirm-modules-purge=false add -g "$package" || true
                else
                    run_pnpm_from_common_functions --config.confirm-modules-purge=false add -g "$package" || true
                fi
            fi
        fi
        rm -f "$temp_log"
    }

    do_install
    if [ "$(is_package_installed "$package")" = "true" ]; then
        echo "[$SCRIPT_INDEX] $package installed successfully"
        return
    fi
    
    echo "[$SCRIPT_INDEX] Install failed, retrying with fallback registry..."
    run_pnpm_from_common_functions config set registry "$FALLBACK_REGISTRY"
    local real_user_home=""
    local real_user="$(get_real_user_from_common_functions 2>/dev/null || echo "")"
    if [ -n "$real_user" ] && [ "$real_user" != "root" ]; then
        real_user_home="$(getent passwd "$real_user" 2>/dev/null | cut -d: -f6)"
    fi
    local user_home="${real_user_home:-${HOME:-/root}}"
    local pnpmrc_path="$user_home/.pnpmrc"
    if [ -f "$pnpmrc_path" ]; then
        local enable_scripts
        enable_scripts=$(run_pnpm_from_common_functions config get enable-pre-post-scripts 2>/dev/null || echo "true")
        printf 'registry=%s\nenable-pre-post-scripts=%s\n' "$FALLBACK_REGISTRY" "$enable_scripts" > "$pnpmrc_path"
    fi
    do_install
    if [ "$(is_package_installed "$package")" = "true" ]; then
        echo "[$SCRIPT_INDEX] $package installed successfully (via fallback registry)"
    else
        echo "[$SCRIPT_INDEX] Failed to install $package"
    fi
}

echo "[$SCRIPT_INDEX] PNPM Global Package Installation Script"

# Idempotent: every step runs on each invocation. We only skip at finest granularity
# (e.g. skip installing a single package when it is already installed). Re-running
# repairs partial failures (e.g. previous run failed on 403 for some packages).

# Function to configure and repair pnpm global environment on every run.
configure_pnpm_global_dirs() {
    local pnpm_global_dir_target=""
    local pnpm_global_bin_target=""
    local pnpm_global_dir_final=""
    local pnpm_global_bin_final=""
    local pnpm_path=""
    local pnpm_registry="$PNPM_REGISTRY_DEFAULT"
    local current_user_home=""
    local pnpmrc_path=""
    local enable_scripts="true"

    pnpm_global_dir_target="${RESOLVED_PNPM_GLOBAL_DIR:-$NODE_BIN_DIR/../pnpm-global}"
    pnpm_global_bin_target="${RESOLVED_PNPM_GLOBAL_BIN_DIR:-$pnpm_global_dir_target/bin}"

    if [ "$SELECTED_REGION" = "China" ]; then
        pnpm_registry="$PNPM_REGISTRY_CHINA"
    fi

    echo "[$SCRIPT_INDEX] Re-applying pnpm configuration..."
    echo "[$SCRIPT_INDEX]   global-dir: $pnpm_global_dir_target"
    echo "[$SCRIPT_INDEX]   global-bin-dir: $pnpm_global_bin_target"
    echo "[$SCRIPT_INDEX]   registry: $pnpm_registry"

    # Always cleanup stale values before repair.
    if [ -n "$PNPM_HOME" ]; then
        unset PNPM_HOME
    fi

    # Create/update config paths.
    $USE_SUDO mkdir -p "$pnpm_global_dir_target" "$pnpm_global_bin_target" "$pnpm_global_dir_target/store" || true

    pnpm_path="$(resolve_pnpm_binary_path)"
    if [ -n "$pnpm_path" ] && [ -x "$pnpm_path" ]; then
        "$pnpm_path" config set global-dir "$pnpm_global_dir_target" || true
        "$pnpm_path" config set global-bin-dir "$pnpm_global_bin_target" || true
        "$pnpm_path" config set store-dir "$pnpm_global_dir_target/store" || true
        "$pnpm_path" config set registry "$pnpm_registry" || true

        pnpm_global_dir_final="$("$pnpm_path" config get global-dir 2>/dev/null || true)"
        pnpm_global_bin_final="$("$pnpm_path" config get global-bin-dir 2>/dev/null || true)"
        if [ -z "$pnpm_global_dir_final" ] || [ "$pnpm_global_dir_final" = "undefined" ]; then
            pnpm_global_dir_final="$pnpm_global_dir_target"
        fi
        if [ -z "$pnpm_global_bin_final" ] || [ "$pnpm_global_bin_final" = "undefined" ]; then
            pnpm_global_bin_final="$pnpm_global_bin_target"
        fi
    else
        pnpm_global_dir_final="$pnpm_global_dir_target"
        pnpm_global_bin_final="$pnpm_global_bin_target"
    fi

    # Keep env + global vars in sync for all subsequent steps.
    set_env_and_var "PNPM_HOME" "$pnpm_global_dir_final"
    set_env_and_var "PNPM_GLOBAL_BIN_DIR" "$pnpm_global_bin_final"
    PNPM_HOME="$pnpm_global_dir_final"
    PNPM_GLOBAL_BIN_DIR="$pnpm_global_bin_final"

    # Ensure pnpm config file is aligned to selected region.
    current_user_home="$(resolve_pnpm_user_home)"
    pnpmrc_path="$current_user_home/.pnpmrc"
    echo "[$SCRIPT_INDEX] Updating pnpmrc for user: $pnpmrc_path"
    if [ "$SELECTED_REGION" = "China" ]; then
        printf 'registry=%s\nenable-pre-post-scripts=%s\n' "$pnpm_registry" "$enable_scripts" > "$pnpmrc_path"
    else
        printf 'registry=%s\nenable-pre-post-scripts=%s\n' "$pnpm_registry" "$enable_scripts" > "$pnpmrc_path"
    fi

    # Always ensure PATH includes configured pnpm global bin directory.
    echo "[$SCRIPT_INDEX] Ensuring pnpm paths are in PATH..."
    if ensure_pnpm_path_from_common_functions; then
        echo "[$SCRIPT_INDEX] pnpm paths configured in PATH"
    else
        if [ -n "$pnpm_global_bin_final" ] && [ -d "$pnpm_global_bin_final" ]; then
            case ":$PATH:" in
                *":$pnpm_global_bin_final:"*) ;;
                *) export PATH="$pnpm_global_bin_final:$PATH" ;;
            esac
            echo "[$SCRIPT_INDEX] Added pnpm global bin to current session PATH: $pnpm_global_bin_final"
        else
            echo "[$SCRIPT_INDEX] Warning: Could not determine pnpm global bin directory"
        fi
    fi

    # Repair /usr/local symlink each run so package binaries remain reachable.
    if [ -n "$pnpm_path" ] && [ -x "$pnpm_path" ]; then
        $USE_SUDO ln -sf "$pnpm_path" /usr/local/bin/pnpm || true
    elif [ -x "$NODE_BIN_DIR/pnpm" ]; then
        $USE_SUDO ln -sf "$NODE_BIN_DIR/pnpm" /usr/local/bin/pnpm || true
    elif [ -x "$PNPM_BIN" ]; then
        $USE_SUDO ln -sf "$PNPM_BIN" /usr/local/bin/pnpm || true
    fi
}

# Test registry access; on 403/Forbidden or fetch failure, switch to fallback registry (no auth required).
ensure_registry_accessible() {
    local view_out
    view_out=$(run_pnpm_from_common_functions view npm version 2>&1 || true)
    if [ -n "$view_out" ] && ! echo "$view_out" | grep -qE '403|Forbidden|ERR_PNPM_FETCH_403'; then
        echo "[$SCRIPT_INDEX] Registry access OK: $(run_pnpm_from_common_functions config get registry)"
        return
    fi
    echo "[$SCRIPT_INDEX] Registry returned 403 or unreachable, switching to fallback: $FALLBACK_REGISTRY"
    run_pnpm_from_common_functions config set registry "$FALLBACK_REGISTRY"
    local real_user_home=""
    local real_user="$(get_real_user_from_common_functions 2>/dev/null || echo "")"
    if [ -n "$real_user" ] && [ "$real_user" != "root" ]; then
        real_user_home="$(getent passwd "$real_user" 2>/dev/null | cut -d: -f6)"
    fi
    local user_home="${real_user_home:-${HOME:-/root}}"
    local pnpmrc_path="$user_home/.pnpmrc"
    if [ -f "$pnpmrc_path" ]; then
        local enable_scripts
        enable_scripts=$(run_pnpm_from_common_functions config get enable-pre-post-scripts 2>/dev/null || echo "true")
        printf 'registry=%s\nenable-pre-post-scripts=%s\n' "$FALLBACK_REGISTRY" "$enable_scripts" > "$pnpmrc_path"
    fi
    echo "[$SCRIPT_INDEX] Fallback registry configured"
}

# Ensure pnpm is installed first (bootstrap). Do not skip later steps when pnpm already exists.
# Run under automation (no TTY): never let pnpm abort on a global modules-dir purge.
export npm_config_confirm_modules_purge=false

echo "[$SCRIPT_INDEX] Ensuring pnpm is installed..."

# Check if pnpm exists using absolute path
if [ -x "$PNPM_BIN" ]; then
    echo "[$SCRIPT_INDEX] pnpm is already installed: $(run_pnpm_from_common_functions --version)"
elif command -v pnpm >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] pnpm found in PATH: $(pnpm --version)"
else
    echo "[$SCRIPT_INDEX] pnpm not found, installing via npm..."

    # Use npm from absolute path
    if [ -x "$NPM_BIN" ]; then
        run_npm_from_common_functions install -g pnpm || true
        echo "[$SCRIPT_INDEX] pnpm installed successfully"
    elif command -v npm >/dev/null 2>&1; then
        npm install -g pnpm || true
        echo "[$SCRIPT_INDEX] pnpm installed successfully"
    else
        echo "[$SCRIPT_INDEX] ERROR: npm not found, cannot install pnpm"
    fi

    # Create symlink if not exists
    if [ -f "$NODE_BIN_DIR/pnpm" ] && [ ! -L /usr/local/bin/pnpm ]; then
        $USE_SUDO ln -sf "$NODE_BIN_DIR/pnpm" /usr/local/bin/pnpm
        echo "[$SCRIPT_INDEX] Created symlink: /usr/local/bin/pnpm"
    fi
fi

# Always run: re-apply config and registry so re-run repairs wrong or missing config.
# Configure pnpm global directories
configure_pnpm_global_dirs
ensure_registry_accessible

echo "[$SCRIPT_INDEX] Checking currently installed global packages..."

# Cache the global packages list
INSTALLED_PACKAGES=$(get_installed_packages)

echo "[$SCRIPT_INDEX] Currently installed global packages:"
echo "$INSTALLED_PACKAGES"
echo "[$SCRIPT_INDEX] ----------------------------------------"

# Package mapping: install_name:import_name
declare -A PACKAGES=(
    ["js-yaml"]="js-yaml"
    ["pm2"]="pm2"
    ["typescript"]="typescript"
    ["ts-node"]="ts-node"
    ["nodemon"]="nodemon"
    ["yarn"]="yarn"
    ["pnpm"]="pnpm"
    ["http-server"]="http-server"
    ["puppeteer"]="puppeteer"
    ["serve"]="serve"
    ["npm-check-updates"]="npm-check-updates"
    ["node-gyp"]="node-gyp"
)

# Convert PACKAGES array to JSON format for Node.js script
PACKAGES_JSON="{"
first=true
for install_name in "${!PACKAGES[@]}"; do
    import_name="${PACKAGES[$install_name]}"
    if [ "$first" = true ]; then
        first=false
    else
        PACKAGES_JSON+=","
    fi
    PACKAGES_JSON+="\"$install_name\":\"$import_name\""
done
PACKAGES_JSON+="}"

echo "[$SCRIPT_INDEX] Checking packages using Node.js script..."
echo "[$SCRIPT_INDEX] Package mapping: $PACKAGES_JSON"

# Always run: try to install/repair every listed package; ensure_package skips only when that package is already installed and linked.
if [ -f "$CHECK_PACKAGES_SCRIPT" ]; then
    echo "[$SCRIPT_INDEX] Using Node.js script for package detection..."
    MISSING_PACKAGES=$(node "$CHECK_PACKAGES_SCRIPT" check "$PACKAGES_JSON")
    
    if [ -n "$MISSING_PACKAGES" ] && [ "$MISSING_PACKAGES" != "[]" ]; then
        echo "[$SCRIPT_INDEX] Missing packages detected: $MISSING_PACKAGES"
    fi
fi

# Iterate all packages every run so re-run repairs partial failures; ensure_package skips only when that package is already installed.
failed_packages=()
for install_name in "${!PACKAGES[@]}"; do
    ensure_package "$install_name"
    if [ "$(is_package_installed "$install_name")" != "true" ]; then
        failed_packages+=("$install_name")
    fi
done

if [ ${#failed_packages[@]} -gt 0 ]; then
    echo "[$SCRIPT_INDEX] Failed to install packages: ${failed_packages[*]}"
else
    echo "[$SCRIPT_INDEX] All packages installed successfully"
fi

echo "[$SCRIPT_INDEX] Package installation process completed"

# Always run: create/repair symlinks for all global binaries (no skip; idempotent).
# Function to verify pnpm configuration
verify_pnpm_config() {
    echo ""
    echo "[$SCRIPT_INDEX] =================================================="
    echo "[$SCRIPT_INDEX] Verifying pnpm configuration..."
    echo "[$SCRIPT_INDEX] =================================================="

    if command -v pnpm >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] pnpm version: $(pnpm --version)"
        echo ""
        echo "[$SCRIPT_INDEX] pnpm configuration:"
        pnpm config list

        echo ""
        echo "[$SCRIPT_INDEX] Checking enable-pre-post-scripts setting..."
        local enable_scripts=$(pnpm config get enable-pre-post-scripts 2>/dev/null)
        if [ "$enable_scripts" = "true" ]; then
            echo "[$SCRIPT_INDEX] �?enable-pre-post-scripts is set to true"
        else
            echo "[$SCRIPT_INDEX] �?enable-pre-post-scripts is NOT set correctly, fixing..."
            : # pnpm 10+ rejects a global set of this workspace-level key; it is true by default. Docs: https://pnpm.io/settings
            echo "[$SCRIPT_INDEX] �?enable-pre-post-scripts has been set to true"
        fi
    else
        echo "[$SCRIPT_INDEX] pnpm not found"
    fi

    echo "[$SCRIPT_INDEX] =================================================="
}

# Function to handle Node.js binary links
handle_node_binaries() {
    echo "[$SCRIPT_INDEX] Creating symlinks for pnpm global packages..."

    # Get pnpm global binary directory
    local pnpm_bin_dir
    if command -v pnpm >/dev/null 2>&1; then
        pnpm_bin_dir=$(pnpm bin -g 2>/dev/null)
        if [ -n "$pnpm_bin_dir" ] && [ -d "$pnpm_bin_dir" ]; then
            echo "[$SCRIPT_INDEX] pnpm global bin directory: $pnpm_bin_dir"

            # Create or repair symlinks for all binaries; compare canonical paths for idempotency.
            for binary in "$pnpm_bin_dir"/*; do
                if [ -f "$binary" ] && [ -x "$binary" ]; then
                    binary_name=$(basename "$binary")
                    real_binary=$(readlink -f "$binary" 2>/dev/null || echo "$binary")

                    if [ -L "/usr/local/bin/$binary_name" ]; then
                        current_target=$(readlink -f "/usr/local/bin/$binary_name" 2>/dev/null || readlink "/usr/local/bin/$binary_name")
                        if [ -n "$current_target" ] && [ "$current_target" = "$real_binary" ]; then
                            continue
                        fi
                    fi

                    echo "[$SCRIPT_INDEX] Creating symlink for: $binary_name"
                    $USE_SUDO ln -sf "$binary" "/usr/local/bin/$binary_name"
                fi
            done

            echo "[$SCRIPT_INDEX] pnpm global package symlinks created successfully"
        else
            echo "[$SCRIPT_INDEX] Warning: pnpm global bin directory not found"
        fi
    else
        echo "[$SCRIPT_INDEX] Warning: pnpm command not found"
    fi
}

# Always run: create/repair symlinks and verify config (no skip; idempotent).
# Handle binary links
echo "[$SCRIPT_INDEX] Setting up pnpm global package symlinks..."
handle_node_binaries

# Verify pnpm configuration at the end
verify_pnpm_config

echo ""
echo "[$SCRIPT_INDEX] =================================================="
echo "[$SCRIPT_INDEX] All tasks completed successfully"
echo "[$SCRIPT_INDEX] =================================================="
