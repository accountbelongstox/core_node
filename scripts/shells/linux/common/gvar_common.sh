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

# Shared environment hub: this file may export variables for consumers that source it.
# Other project *.sh files must not export path/config constants; resolve them locally or source hubs like this one.

# Detect environment type
CURRENT_USER=""
DESKTOP_WINDOWS_MOUNT_PATH=""
DESKTOP_WINDOWS_DRIVES=""
GVAR_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_ENVIRONMENT_SCRIPT="$GVAR_COMMON_DIR/runtime_environment.sh"
GVAR_STORAGE_COMMON_SCRIPT="$GVAR_COMMON_DIR/gvar_storage_common.sh"
GVAR_SYSTEM_COMMON_SCRIPT="$GVAR_COMMON_DIR/gvar_system_common.sh"
GLOBAL_VAR_STORE_SCRIPT="$GVAR_COMMON_DIR/global_var_store.sh"

source "$RUNTIME_ENVIRONMENT_SCRIPT"

# Detected actual desktop user (when running as root)
ACTUAL_DESKTOP_USER=""
ACTUAL_DESKTOP_USER_HOME=""
CORE_PERMISSION_USER=""
CORE_PERMISSION_GROUP=""
SYSTEM_USER_EXCLUDED=false
SYSTEM_USER_ACTIVE_REGULAR=false
SUDO_READY=false
CORE_NODE_DELETION_AUTHORIZED=false

# Resolve whether an account is service-only.
system_user_is_excluded() {
    local candidate="$1"

    SYSTEM_USER_EXCLUDED=false
    case "$candidate" in
        root|bin|sys|sync|games|man|lp|mail|news|uucp|proxy|backup|list|irc|_apt|git|gitea|mysql|postgres|redis|nginx|www-data|node|nobody|daemon|messagebus|sshd|polkitd|systemd-network|systemd-timesync)
            SYSTEM_USER_EXCLUDED=true
            ;;
    esac
}

# Resolve whether an account is interactive and non-system.
system_user_candidate_is_active_regular() {
    local candidate="$1"
    local candidate_uid=""
    local candidate_entry=""
    local candidate_shell=""

    SYSTEM_USER_ACTIVE_REGULAR=false
    [ -n "$candidate" ] || return
    candidate_uid="$(id -u "$candidate" 2>/dev/null || true)"
    [ -n "$candidate_uid" ] || return
    [ "$candidate_uid" -ge 1000 ] 2>/dev/null || return
    [ "$candidate_uid" -lt 65534 ] 2>/dev/null || return
    system_user_is_excluded "$candidate"
    [ "$SYSTEM_USER_EXCLUDED" = false ] || return
    if command -v getent >/dev/null 2>&1; then
        candidate_entry="$(getent passwd "$candidate" 2>/dev/null || true)"
        candidate_shell="${candidate_entry##*:}"
        case "$candidate_shell" in
            */nologin|*/false) return ;;
        esac
    fi
    SYSTEM_USER_ACTIVE_REGULAR=true
}

# Prefer an explicit caller or active login. A root-only process then scores
# valid /home accounts by common interactive directories before using root.
detect_system_user() {
    local candidate=""
    local candidate_home=""
    local home_entry=""
    local marker=""
    local best_user=""
    local candidate_score=0
    local best_score=-1

    candidate="${SUDO_USER:-}"
    system_user_candidate_is_active_regular "$candidate"
    if [ "$SYSTEM_USER_ACTIVE_REGULAR" = true ]; then
        echo "$candidate"
        return
    fi

    candidate="$(id -un 2>/dev/null || true)"
    system_user_candidate_is_active_regular "$candidate"
    if [ "$SYSTEM_USER_ACTIVE_REGULAR" = true ]; then
        echo "$candidate"
        return
    fi

    if command -v who >/dev/null 2>&1; then
        candidate="$(who 2>/dev/null | awk 'NF { print $1; exit }')"
        system_user_candidate_is_active_regular "$candidate"
        if [ "$SYSTEM_USER_ACTIVE_REGULAR" = true ]; then
            echo "$candidate"
            return
        fi
    fi

    if command -v loginctl >/dev/null 2>&1; then
        while read -r candidate; do
            [ -n "$candidate" ] || continue
            system_user_candidate_is_active_regular "$candidate"
            if [ "$SYSTEM_USER_ACTIVE_REGULAR" = true ]; then
                echo "$candidate"
                return
            fi
        done < <(loginctl list-sessions --no-legend 2>/dev/null | awk 'NF >= 3 { print $3 }')
    fi

    for candidate_home in /home/*; do
        [ -d "$candidate_home" ] || continue
        candidate="${candidate_home##*/}"
        system_user_candidate_is_active_regular "$candidate"
        [ "$SYSTEM_USER_ACTIVE_REGULAR" = true ] || continue
        home_entry="$(getent passwd "$candidate" 2>/dev/null | cut -d: -f6)"
        [ "$home_entry" = "$candidate_home" ] || continue
        candidate_score=0
        for marker in Downloads Documents Desktop; do
            [ -d "$candidate_home/$marker" ] && candidate_score=$((candidate_score + 1))
        done
        if [ "$candidate_score" -gt "$best_score" ]; then
            best_user="$candidate"
            best_score="$candidate_score"
        fi
    done
    if [ -n "$best_user" ]; then
        echo "$best_user"
        return
    fi

    echo "root"
}

# Check and set sudo. Skip sudo when already root: sudo-as-root is an
# identity no-op that still opens a PAM session per invocation, flooding
# the journal (3 lines x ~6 source-time calls x every gvar re-source) on
# the systemd service plane.
if [ "$(id -u)" = "0" ]; then
    USE_SUDO=""
elif command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# Function to check and install sudo if needed
check_and_install_sudo() {
    SUDO_READY=false
    # Root never needs sudo (same journal-noise rationale as USE_SUDO).
    if [ "$(id -u)" = "0" ]; then
        USE_SUDO=""
        SUDO_READY=true
        return
    fi
    if command -v sudo >/dev/null 2>&1; then
        USE_SUDO="sudo"
        SUDO_READY=true
        return
    fi

    echo "[INFO] sudo is not installed, attempting to install..."

    # Try to install sudo as root (if we have root access)
    if [ "$(id -u)" -eq 0 ]; then
        if command -v apt-get >/dev/null 2>&1; then
            apt-get update && apt-get install -y sudo
        elif command -v yum >/dev/null 2>&1; then
            yum install -y sudo
        elif command -v dnf >/dev/null 2>&1; then
            dnf install -y sudo
        elif command -v zypper >/dev/null 2>&1; then
            zypper install -y sudo
        elif command -v pacman >/dev/null 2>&1; then
            pacman -S --noconfirm sudo
        else
            echo "[ERROR] Package manager not found, cannot install sudo"
            USE_SUDO=""
            return
        fi

        if command -v sudo >/dev/null 2>&1; then
            USE_SUDO="sudo"
            SUDO_READY=true
            echo "[OK] sudo installed successfully"
        else
            echo "[ERROR] Failed to install sudo"
            USE_SUDO=""
        fi
    else
        echo "[WARNING] Not running as root, cannot install sudo"
        echo "[INFO] Please run as root or install sudo manually"
        USE_SUDO=""
        return
    fi
}

# Core Node project root directory
CORE_NODE_PROJECT_ROOT=""

# Function to detect actual desktop user when running as root
# This is useful for services that need to interact with the desktop user's session
detect_actual_desktop_user() {
    local detected_user=""
    local detected_home=""

    detected_user="$(detect_system_user)"
    detected_home="$(getent passwd "$detected_user" 2>/dev/null | cut -d: -f6)"
    [ -n "$detected_home" ] || detected_home="/root"
    ACTUAL_DESKTOP_USER="$detected_user"
    ACTUAL_DESKTOP_USER_HOME="$detected_home"
}

# Detect actual desktop user (if running as root)
detect_actual_desktop_user

source "$GVAR_STORAGE_COMMON_SCRIPT"

source "$GVAR_SYSTEM_COMMON_SCRIPT"

# Function to map paths based on environment (using get_base_data_directory)
# SYNC WARNING: This function MUST be kept in sync with:
# - Python version: pycore/pyfoundations/system_paths.py::map_web_path()
# - All mappings must produce identical results across Shell and Python
map_web_path() {
    local path_key="$1"
    local sub_path="${2:-}"
    local mapped_path=""
    local base_path=""
    local data_base=""

    # Get optimal base directory
    data_base=$(get_base_data_directory)

    # Determine the web base. The selected disk (a large/Windows-NTFS DATA disk, or
    # root) is honored AS-IS so web data lives ON that disk: a Windows NTFS DATA disk
    # is SHARED with Windows (Linux /mnt/<ntfs>/www == Windows D:\www). data_base of
    # "/" or "/www" collapses to /www; anything else gets "<data_base>/www". There is
    # NO production short-circuit and NO POSIX coercion: NTFS DATA disks are mounted
    # uid=/gid= (3_setting_base.sh) so the login user owns the tree, and any residual
    # chmod/chown failure on NTFS is tolerated. PostgreSQL is unaffected -- its data
    # dir stays on native ext4 (pg_mount -> /var/lib/postgresql/d), not under www.
    if [ "$IS_WSL" = true ]; then
        base_path="$data_base/www"
    else
        case "$data_base" in
            /|/www) base_path="/www" ;;
            *)      base_path="$data_base/www" ;;
        esac
    fi

    # Map paths using common base path
    case "$path_key" in
        "wwwroot")
            mapped_path="$base_path/wwwroot"
            ;;
        "pycore_db")
            mapped_path="$base_path/wwwroot/pycore_db"
            ;;
        "laravel_db")
            mapped_path="$base_path/wwwroot/laravel_db"
            ;;
        "postgresql")
            # PostgreSQL data root on the shared web/data disk (native Windows +
            # native Linux server). On WSL the cluster instead uses an ext4 loop
            # image (laravel_db/postgresql/pgdata.ext4) at pg_mount, since drvfs
            # cannot host a postgres-owned, mode-0700 data dir.
            mapped_path="$base_path/wwwroot/postgresql"
            ;;
        "nginxconfig")
            mapped_path="$base_path/nginxconfig"
            ;;
        "shared-data")
            mapped_path="$base_path/shared-data"
            ;;
        "backup")
            mapped_path="$base_path/backup"
            ;;
        "cache")
            mapped_path="$base_path/cache"
            ;;
        "www")
            mapped_path="$base_path"
            ;;
        "compile_dir")
            # Compile directory for development languages (node, py, ...).
            # Format: _ubuntu_24, _debian_13, _kali_2026 (underscore prefix).
            # Base prefers /opt when root has >50G free (or /opt dir already in use);
            # see get_dev_compile_base. NOT the web data base.
            data_base=$(get_dev_compile_base)

            # Use base_dir/_system_version for all environments
            mapped_path="${data_base}/${SYS_DIR}"
            ;;
        "applications_dir")
            # Applications directory - same location as compile_dir for consistency
            data_base=$(get_dev_compile_base)

            # Use base_dir/_system_version/applications for all environments
            mapped_path="${data_base}/${SYS_DIR}/applications"
            ;;
        "nginx")
            # Keep /etc/nginx in Linux filesystem
            mapped_path="/etc/nginx"
            ;;
        "php")
            # Keep /etc/php in Linux filesystem
            mapped_path="/etc/php"
            ;;
        "logs")
            # Keep logs in Linux filesystem
            mapped_path="/var/log"
            ;;
        "app_manager_logs")
            # Unified App Manager log namespace ROOT (scripts/app_manager/linux_sh).
            # Service stdout/stderr (service.log) and foreground.log live under
            # <this>/namespaces/apps/<name>/. Kept on the native Linux fs like
            # "logs". Retired predecessor: see "app_manager_logs_old".
            mapped_path="/opt/_core_node/logs"
            ;;
        "app_manager_logs_old")
            # Retired App Manager log root (formerly "core_node_unified_manager").
            # Kept ONLY so cleanup tooling can locate and purge the old 13GB tree.
            mapped_path="/opt/core_node_unified_manager/logs"
            ;;
        "pg_mount")
            # Native ext4 loop-mount target for the PostgreSQL D-drive image (WSL
            # persistence). MUST be on the native Linux fs (NOT drvfs): the whole
            # point is to give pg a postgres-owned, mode-0700 data dir that drvfs
            # cannot provide. The data/image itself lives under "laravel_db".
            mapped_path="/var/lib/postgresql/d"
            ;;
        "programing")
            # Programming/development directory under base_path
            mapped_path="$base_path/programing"
            ;;
        "core_node")
            # Core node project directory under programing
            mapped_path="$base_path/programing/core_node"
            ;;
        "npm_global")
            # NPM global packages directory (inside the dev compile_dir -> same base).
            data_base=$(get_dev_compile_base)

            # Use base_dir/_system_version/npm-global for all environments
            mapped_path="${data_base}/${SYS_DIR}/npm-global"
            ;;
        "dev_system")
            # Development system directory (same as compile_dir -> same base).
            data_base=$(get_dev_compile_base)

            # Use base_dir/_system_version for all environments
            mapped_path="${data_base}/${SYS_DIR}"
            ;;
        *)
            # Default: return the key as-is (assume it's already a path)
            mapped_path="$path_key"
            ;;
    esac

    # If sub_path is provided, concatenate it to the mapped path
    if [ -n "$sub_path" ]; then
        # Remove leading slash from sub_path if present to avoid double slashes
        sub_path=$(echo "$sub_path" | sed 's|^/||')
        mapped_path="$mapped_path/$sub_path"
    fi

    # Create directory if it doesn't exist (only for web-related paths, not system paths)
    # IMPORTANT RULE:
    # - Never auto-create directories when sub_path is provided
    # - Only auto-create the main path_key directories when explicitly needed
    # - Scripts should use ensure_web_directory() for intentional directory creation
    case "$path_key" in
        "wwwroot"|"nginxconfig"|"shared-data"|"backup"|"cache"|"compile_dir")
            # Only auto-create if no sub_path is provided (these are the target installation paths)
            if [ -z "$sub_path" ] && [ ! -d "$mapped_path" ]; then
                echo "Creating directory: $mapped_path" >&2
                $USE_SUDO mkdir -p "$mapped_path"
                # Set proper permissions (skip chown in desktop Windows as it may not support it)
                if [ "$IS_DESKTOP_WITH_WINDOWS" = false ]; then
                    local detected_user=$(detect_system_user)
                    local detected_group=$(id -gn "$detected_user" 2>/dev/null || echo "$detected_user")
                    $USE_SUDO chown "$detected_user:$detected_group" "$mapped_path" 2>/dev/null || true
                fi
                $USE_SUDO chmod 777 "$mapped_path" 2>/dev/null || true
            fi
            ;;
        "www")
            # For "www" path, NEVER auto-create when sub_path is provided
            # Callers should use ensure_web_directory() for sub-paths like "mysql", "code-server", etc.
            # Only create the base www directory itself if no sub_path
            if [ -z "$sub_path" ] && [ ! -d "$mapped_path" ]; then
                echo "Creating directory: $mapped_path" >&2
                $USE_SUDO mkdir -p "$mapped_path"
                # Set proper permissions (skip chown in desktop Windows as it may not support it)
                if [ "$IS_DESKTOP_WITH_WINDOWS" = false ]; then
                    local detected_user=$(detect_system_user)
                    local detected_group=$(id -gn "$detected_user" 2>/dev/null || echo "$detected_user")
                    $USE_SUDO chown "$detected_user:$detected_group" "$mapped_path" 2>/dev/null || true
                fi
                $USE_SUDO chmod 777 "$mapped_path" 2>/dev/null || true
            fi
            ;;
    esac

    echo "$mapped_path"
}

source "$GLOBAL_VAR_STORE_SCRIPT"

# Function to detect and return CORE_NODE_DIR dynamically based on gvar_common.sh location
get_core_node_dir() {
    # Calculate CORE_NODE_DIR based on gvar_common.sh location
    # gvar_common.sh is at: core_node/scripts/shells/linux/common/gvar_common.sh
    # So we need to go up 4 levels: common -> linux -> shells -> scripts -> core_node

    local gvar_common_path="${BASH_SOURCE[0]}"

    # Resolve to absolute path if it's a symlink
    if [ -L "$gvar_common_path" ]; then
        gvar_common_path="$(readlink -f "$gvar_common_path")"
    fi

    # Get directory of gvar_common.sh
    local gvar_common_dir="$(cd "$(dirname "$gvar_common_path")" && pwd)"

    # Go up 4 levels to reach core_node root
    # common -> linux -> shells -> scripts -> core_node
    local core_node_dir="$(dirname "$(dirname "$(dirname "$(dirname "$gvar_common_dir")")")")"

    # Verify this is actually core_node directory by checking for markers
    if [ ! -d "$core_node_dir/.secret_keys" ] && [ ! -f "$core_node_dir/package.json" ]; then
        # Fallback: try environment variable
        if [ -n "$CORE_NODE_DIR" ]; then
            core_node_dir="$CORE_NODE_DIR"
        else
            # Fallback: check common paths based on environment
            if [ "$IS_WSL" = true ] && [ -d "/mnt/d/programing/core_node" ]; then
                core_node_dir="/mnt/d/programing/core_node"
            elif [ -d "/usr/wwwroot/core_node" ]; then
                core_node_dir="/usr/wwwroot/core_node"
            elif [ -d "/opt/core_node" ]; then
                core_node_dir="/opt/core_node"
            else
                # Final fallback
                core_node_dir="/opt/core_node"
            fi
        fi
    fi

    echo "$core_node_dir"
}

# Export CORE_NODE_DIR for use in other scripts
export CORE_NODE_DIR=$(get_core_node_dir)

# Debug function to analyze path issues
debug_path_analysis() {
    echo "=== PATH ANALYSIS DEBUG ==="
    echo "Current script location: ${BASH_SOURCE[0]}"
    echo "Script directory: $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    echo "IS_WSL: $IS_WSL"
    echo "IS_PRODUCTION: $IS_PRODUCTION"
    echo "HAS_DESKTOP_ENVIRONMENT: $HAS_DESKTOP_ENVIRONMENT"
    echo ""
    echo "Base data directory: $(get_base_data_directory)"
    echo "Core node project root: $(get_core_node_project_root)"
    echo "Core node dir: $(get_core_node_dir)"
    echo ""
    echo "Expected path structure:"
    echo "  Windows: D:\\programing\\core_node\\scripts\\shells\\linux"
    echo "  WSL: /mnt/d/programing/core_node/scripts/shells/linux"
    echo "=== END DEBUG ==="
}

# Export debug function
export -f debug_path_analysis

# Load secret_manager library
GVAR_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Only reference the centralized secret_manager directory under shells
NEW_SECRET_MANAGER_PATH="$(dirname "$(dirname "$GVAR_SCRIPT_DIR")")/secret_manager/secret_manager.sh"
source "$NEW_SECRET_MANAGER_PATH"

# Read encrypted content through the centralized secret manager.
get_secret_content() {
    local key_name="$1"

    if [ -z "$key_name" ]; then
        echo "Error: KeyName parameter is required" >&2
        return
    fi

    secret_get_key "$key_name"
}


# Alias for set_global_var for backward compatibility  
# Call set_is_global after all functions are defined
set_is_global

# Directory variables (set after all functions are defined)
BASE_DIR=$(map_web_path "www")
WIS_PROGRAMING_DIR="$BASE_DIR/programing"
COMPILE_DIR=$(map_web_path "compile_dir")

# Python VENV constants
if [ -n "${COMPILE_DIR:-}" ]; then
    export VENV_DIR="$COMPILE_DIR/python3_venv"
    export VENV_PYTHON3="$VENV_DIR/bin/python3"
    export VENV_PYTHON="$VENV_DIR/bin/python"
    export VENV_PIP3="$VENV_DIR/bin/pip3"
    export VENV_PIP="$VENV_DIR/bin/pip"
fi
# Installation directories (set after all functions are defined)
POETRY_HOME="$COMPILE_DIR/poetry"
POETRY_LINK="$COMPILE_DIR/bin/poetry"
NODE_INSTALL_DIR="$COMPILE_DIR/node"
NODE_SHORT_VERSION="24"
NODE_VERSION="v24.11.1"
NODE_DOWNLOAD_URL="https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz"
NODE_BIN_DIR="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin"
NODE_BIN="$NODE_BIN_DIR/node"
NPM_BIN="$NODE_BIN_DIR/npm"
NPX_BIN="$NODE_BIN_DIR/npx"
COREPACK_BIN="$NODE_BIN_DIR/corepack"

# PNPM global directories
PNPM_GLOBAL_DIR="$NODE_INSTALL_DIR/node-$NODE_VERSION/pnpm-global"
PNPM_GLOBAL_BIN_DIR="$PNPM_GLOBAL_DIR/bin"
PNPM_BIN="$NODE_BIN_DIR/pnpm"
BUN_INSTALL_DIR="$COMPILE_DIR/bun"
BUN_BIN_DIR="$BUN_INSTALL_DIR/bin"
BUN_BIN="$BUN_BIN_DIR/bun"
YARN_BIN="$NODE_BIN_DIR/yarn"

GO_DIR="$COMPILE_DIR/go"
GO_BIN="$GO_DIR/bin/go"
# Pinned Go toolchain (single source of truth for 91_install_golang.sh);
# frankenphp v1.12.7 native xcaddy rebuild (Caddy v2.11.4) needs go >= 1.26.0.
GO_VERSION="1.26.6"
GO_VERSION_AMD64_FILE="go${GO_VERSION}.linux-amd64"
GO_TAR_URL="https://dl.google.com/go/$GO_VERSION_AMD64_FILE.tar.gz"
# Anti-hijack integrity pins for the tarball (official go.dev/dl values).
GO_TARBALL_SIZE="66890545"
GO_TARBALL_SHA256="708effb774be8237570d0add163225abbdfaf4fca28b2611df167beba4feef89"
# Ordered download fallbacks (gvar_common): aliyun first (most stable on
# CN networks), official go.dev/dl next, NJU last (stalls on some networks).
# Consumed by sourcing from 91_install_golang.sh; not exported.
GO_TAR_URLS=(
    "https://mirrors.aliyun.com/golang/$GO_VERSION_AMD64_FILE.tar.gz"
    "https://go.dev/dl/$GO_VERSION_AMD64_FILE.tar.gz"
    "https://golang.google.cn/dl/$GO_VERSION_AMD64_FILE.tar.gz"
    "$GO_TAR_URL"
    "https://mirrors.nju.edu.cn/golang/$GO_VERSION_AMD64_FILE.tar.gz"
)

# Ruby installation directories
RUBY_INSTALL_DIR="$COMPILE_DIR/ruby"
RUBY_GEM_HOME="$RUBY_INSTALL_DIR/gems"
RUBY_GEM_BIN_DIR="$RUBY_GEM_HOME/bin"

UPS_CONF="/etc/nut/ups.conf"
UPSD_CONF="/etc/nut/upsd.conf"
UPSD_USERS_CONF="/etc/nut/upsd.users"
UPSMON_CONF="/etc/nut/upsmon.conf"

# MCP Services Configuration
MCP_SOURCE_DIR="$CORE_SCRIPTS_DIR/mcp"
MCP_SERVER_DIR="$COMPILE_DIR/mcp_server"
MCP_LOCAL_DIR="scripts/mcp"

# Export the additional variables
export BASE_DIR
export WIS_PROGRAMING_DIR
export COMPILE_DIR
export POETRY_HOME
export POETRY_LINK
export NODE_INSTALL_DIR
export NODE_SHORT_VERSION
export NODE_VERSION
export NODE_DOWNLOAD_URL
export NODE_BIN_DIR
export NODE_BIN
export NPM_BIN
export NPX_BIN
export COREPACK_BIN
export PNPM_GLOBAL_DIR
export PNPM_GLOBAL_BIN_DIR
export PNPM_BIN
export BUN_INSTALL_DIR
export BUN_BIN_DIR
export BUN_BIN
export YARN_BIN
export GO_DIR
export GO_BIN
export GO_VERSION
export GO_VERSION_AMD64_FILE
export GO_TAR_URL
export GO_TARBALL_SIZE
export GO_TARBALL_SHA256
export UPS_CONF
export UPSD_CONF
export UPSD_USERS_CONF
export UPSMON_CONF
export MCP_SOURCE_DIR
export MCP_SERVER_DIR
export MCP_LOCAL_DIR

# =============================================================================
# core_node deletion safety guard (mandatory; see
# development-guides/CORE_NODE_DELETION_SAFETY.md). Authorise deletion of a
# core_node directory ONLY after explicit TRIPLE confirmation (default NO each),
# and hard-refuse system paths, git working trees, and non-interactive runs.
# Sets CORE_NODE_DELETION_AUTHORIZED only after three explicit confirmations.
# =============================================================================
confirm_core_node_deletion() {
    local target="$1"
    local i=0
    local ans=""
    CORE_NODE_DELETION_AUTHORIZED=false
    case "$target" in
        ""|"/"|"/usr"|"/usr/"*|"/etc"|"/etc/"*|"/bin"|"/bin/"*|"/sbin"|"/sbin/"*|"/lib"|"/lib/"*|"/var"|"/var/"*|"/home"|"/root"|"/opt"|"/mnt"|"/www"|"/www/"*)
            echo -e "\033[31m[DELETE-GUARD] Refusing to delete a system/critical path: '$target'\033[0m" >&2
            return ;;
    esac
    if [ -e "$target/.git" ]; then
        echo -e "\033[31m[DELETE-GUARD] '$target' is a git working tree (possible uncommitted work). Refusing to delete it.\033[0m" >&2
        echo -e "\033[31m[DELETE-GUARD] Move/rename it MANUALLY if you must replace it, then re-run.\033[0m" >&2
        return
    fi
    if [ ! -t 0 ] || [ ! -r /dev/tty ]; then
        echo -e "\033[31m[DELETE-GUARD] No interactive terminal; refusing to delete '$target' (default = NO).\033[0m" >&2
        return
    fi
    echo -e "\033[33m[DELETE-GUARD] About to DELETE the core_node directory: $target (IRREVERSIBLE)\033[0m" >&2
    for i in 1 2 3; do
        printf '[DELETE-GUARD] Confirmation %d of 3 - permanently delete "%s"? [N/y]: ' "$i" "$target" > /dev/tty
        read -r ans < /dev/tty || ans=""
        case "$ans" in
            [Yy]) : ;;
            *) echo -e "\033[36m[DELETE-GUARD] Cancelled at step $i (default No). Nothing removed.\033[0m" >&2; return ;;
        esac
    done
    echo -e "\033[33m[DELETE-GUARD] All three confirmations received; proceeding to delete $target\033[0m" >&2
    CORE_NODE_DELETION_AUTHORIZED=true
}

# Calculate and set SKIP_LARGE_MODELS flag
if [ -z "$(get_global_var "SKIP_LARGE_MODELS" "")" ]; then
    if [ "$IS_PRODUCTION" = true ] && [ "$HAS_DESKTOP_ENVIRONMENT" = false ]; then
        if ! command -v nvidia-smi >/dev/null 2>&1 || ! nvidia-smi -L >/dev/null 2>&1; then
            set_global_var "SKIP_LARGE_MODELS" "true" "false"
        else
            set_global_var "SKIP_LARGE_MODELS" "false" "false"
        fi
    else
        set_global_var "SKIP_LARGE_MODELS" "false" "false"
    fi
fi
