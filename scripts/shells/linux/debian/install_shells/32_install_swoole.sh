#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Script: 32_install_swoole.sh
# Description: Install Swoole extension for PHP 8.5 and Laravel Octane support
# PHP Version: 8.5 (Upgraded from 8.4)
# Swoole Version: 6.x (Compiled from master for PHP 8.5 compatibility)
# Laravel Octane: v2.13.x (Requires compatibility patch for Swoole 6.x)
# Compatibility: Automatically applies Octane/Swoole 6.x patch after installation
# Author: System Administrator
# Version: 1.1

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_INDEX="[32_SWOOLE]"

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_vars.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_functions.sh"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}$SCRIPT_INDEX PHP Swoole Extension Installation${NC}"
echo -e "${CYAN}========================================${NC}"

check_swoole_installed() {
    echo -e "${BLUE}$SCRIPT_INDEX Checking Swoole installation...${NC}"

    # Get dynamic extension directory from PHP
    local ext_dir=$(php -r "echo ini_get('extension_dir');" 2>/dev/null)
    local swoole_so="$ext_dir/swoole.so"

    echo -e "${CYAN}$SCRIPT_INDEX PHP extension directory: $ext_dir${NC}"

    if [ -f "$swoole_so" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Swoole extension file exists: $swoole_so${NC}"

        if php -m 2>/dev/null | grep -q "swoole"; then
            local swoole_version=$(php -r "echo phpversion('swoole');" 2>/dev/null || echo "unknown")
            echo -e "${GREEN}$SCRIPT_INDEX Swoole module loaded in CLI: $swoole_version${NC}"
        else
            echo -e "${YELLOW}$SCRIPT_INDEX Swoole extension exists but not loaded in CLI${NC}"
            echo -e "${YELLOW}$SCRIPT_INDEX This may indicate configuration issue${NC}"
        fi

        return 0
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Swoole extension file not found: $swoole_so${NC}"
        return 1
    fi
}

check_swoole_configuration() {
    echo -e "${BLUE}$SCRIPT_INDEX Checking Swoole configuration files...${NC}"

    local config_valid=true
    local swoole_ini="/etc/php/8.5/mods-available/swoole.ini"

    if [ ! -f "$swoole_ini" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Configuration file missing: $swoole_ini${NC}"
        config_valid=false
    else
        echo -e "${GREEN}$SCRIPT_INDEX Configuration file exists: $swoole_ini${NC}"
    fi

    # Only check CLI - FPM is not installed when using Swoole
    for sapi in cli; do
        local link="/etc/php/8.5/$sapi/conf.d/20-swoole.ini"
        if [ ! -L "$link" ]; then
            echo -e "${YELLOW}$SCRIPT_INDEX Symlink missing for $sapi: $link${NC}"
            config_valid=false
        else
            echo -e "${GREEN}$SCRIPT_INDEX Symlink exists for $sapi: $link${NC}"
        fi
    done

    if $config_valid; then
        echo -e "${GREEN}$SCRIPT_INDEX All Swoole configuration files are valid${NC}"
        return 0
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Some Swoole configuration files need repair${NC}"
        return 1
    fi
}

ensure_php_symlink() {
    echo -e "${BLUE}$SCRIPT_INDEX Ensuring PHP ${PHP_VERSION} is the default php...${NC}"

    if [ ! -x "$PHP_BIN" ]; then
        echo -e "${RED}$SCRIPT_INDEX PHP ${PHP_VERSION} binary not found at $PHP_BIN${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX Please run 31_ensure_php85_intelligent.sh first${NC}"
        return 1
    fi

    # 1) /usr/bin/php via update-alternatives -- SAME priority as step 31 (shared
    #    PHP_ALT_PRIORITY) so re-running this step never lowers the default 31 set.
    #    No --remove-all (that would wipe other registered php alternatives).
    if [ ! -e "/usr/bin/php" ] || ! /usr/bin/php -v 2>/dev/null | grep -q "PHP ${PHP_VERSION}"; then
        $USE_SUDO update-alternatives --install /usr/bin/php php "$PHP_BIN" "$PHP_ALT_PRIORITY"
        $USE_SUDO update-alternatives --set php "$PHP_BIN"
        echo -e "${GREEN}$SCRIPT_INDEX PHP ${PHP_VERSION} set as default (priority ${PHP_ALT_PRIORITY})${NC}"
    else
        echo -e "${GREEN}$SCRIPT_INDEX PHP ${PHP_VERSION} already the default php${NC}"
    fi

    # 2) The canonical entrypoint link that step 31 CREATES and step 34 CONSUMES.
    #    32 previously only checked /usr/bin/php while this contract
    #    link was broken. Keep it in sync here too.
    if [ "$(readlink -f "$TARGET_LINK_PATH" 2>/dev/null)" != "$(readlink -f "$PHP_BIN" 2>/dev/null)" ]; then
        $USE_SUDO mkdir -p "$(dirname "$TARGET_LINK_PATH")"
        $USE_SUDO ln -sf "$PHP_BIN" "$TARGET_LINK_PATH"
        echo -e "${GREEN}$SCRIPT_INDEX Linked $TARGET_LINK_PATH -> $PHP_BIN${NC}"
    fi

    if "$TARGET_LINK_PATH" -v 2>/dev/null | grep -q "PHP ${PHP_VERSION}"; then
        echo -e "${GREEN}$SCRIPT_INDEX PHP ${PHP_VERSION} available at $TARGET_LINK_PATH and /usr/bin/php${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to make PHP ${PHP_VERSION} the default${NC}"
        return 1
    fi
}

uninstall_old_swoole() {
    echo -e "${BLUE}$SCRIPT_INDEX Checking for existing Swoole installation...${NC}"

    local swoole_version=$(php -r "echo phpversion('swoole');" 2>/dev/null)

    if [ -n "$swoole_version" ] && [ "$swoole_version" != "false" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Found existing Swoole version: $swoole_version${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Removing old Swoole installation...${NC}"

        # Try pecl uninstall first
        if command -v pecl >/dev/null 2>&1; then
            echo -e "${CYAN}$SCRIPT_INDEX Attempting PECL uninstall...${NC}"
            echo "" | $USE_SUDO pecl uninstall swoole 2>/dev/null || true
        fi

        # Remove swoole.so from extension directory
        local ext_dir=$(php -r "echo ini_get('extension_dir');" 2>/dev/null)
        if [ -n "$ext_dir" ] && [ -f "$ext_dir/swoole.so" ]; then
            echo -e "${CYAN}$SCRIPT_INDEX Removing $ext_dir/swoole.so${NC}"
            $USE_SUDO rm -f "$ext_dir/swoole.so"
        fi

        # Remove swoole.ini configuration
        local swoole_ini="/etc/php/8.5/mods-available/swoole.ini"
        if [ -f "$swoole_ini" ]; then
            echo -e "${CYAN}$SCRIPT_INDEX Removing $swoole_ini${NC}"
            $USE_SUDO rm -f "$swoole_ini"
        fi

        # Remove symlinks
        for sapi in cli fpm; do
            local link="/etc/php/8.5/$sapi/conf.d/20-swoole.ini"
            if [ -L "$link" ]; then
                echo -e "${CYAN}$SCRIPT_INDEX Removing $link${NC}"
                $USE_SUDO rm -f "$link"
            fi
        done

        # Verify removal
        if php -m 2>/dev/null | grep -q "swoole"; then
            echo -e "${YELLOW}$SCRIPT_INDEX Warning: Swoole still loaded, may require PHP restart${NC}"
        else
            echo -e "${GREEN}$SCRIPT_INDEX Old Swoole removed successfully${NC}"
        fi
    else
        echo -e "${CYAN}$SCRIPT_INDEX No existing Swoole installation found${NC}"
    fi

    return 0
}

install_swoole_dependencies() {
    echo -e "${BLUE}$SCRIPT_INDEX Installing Swoole build dependencies...${NC}"

    local deps=(
        "php8.5-dev"
        "php-pear"
        "build-essential"
        "libssl-dev"
        "libcurl4-openssl-dev"
        "libpcre2-dev"
        "libpq-dev"
    )

    $USE_SUDO apt-get update -qq
    $USE_SUDO apt-get install -y "${deps[@]}"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Dependencies installed${NC}"

        ensure_php_symlink || return 1

        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to install dependencies${NC}"
        return 1
    fi
}

# Does a given Swoole git ref's official composer.json `php` constraint admit the running
# PHP? Returns 0 (yes / undeterminable) or 1 (explicitly excluded). Parses the simple
# ">=X.Y" + optional "<A.B" forms Swoole uses (e.g. ">=8.2 <8.6", ">=8.1 <8.5").
swoole_ref_supports_php() {
    local ref="$1" php_ver="$2"
    local pvid; pvid="$(echo "$php_ver" | awk -F. '{printf "%d", $1*100+$2}')"
    local constraint
    constraint="$(curl -fsSL "https://raw.githubusercontent.com/swoole/swoole-src/${ref}/composer.json" 2>/dev/null \
        | sed -n 's/.*"php"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
    [ -z "$constraint" ] && return 0   # offline / unknown -> do not block
    local lo hi
    lo="$(printf '%s' "$constraint" | grep -oE '>=?[[:space:]]*[0-9]+\.[0-9]+' | head -n1 | grep -oE '[0-9]+\.[0-9]+')"
    hi="$(printf '%s' "$constraint" | grep -oE '<[[:space:]]*[0-9]+\.[0-9]+'   | head -n1 | grep -oE '[0-9]+\.[0-9]+')"
    if [ -n "$lo" ]; then
        local loid; loid="$(echo "$lo" | awk -F. '{printf "%d", $1*100+$2}')"
        [ "$pvid" -lt "$loid" ] && return 1
    fi
    if [ -n "$hi" ]; then
        local hiid; hiid="$(echo "$hi" | awk -F. '{printf "%d", $1*100+$2}')"
        [ "$pvid" -ge "$hiid" ] && return 1
    fi
    return 0
}

# Select the Swoole build ref for the running PHP -- "select an available version" rather
# than trust a possibly-stale hardcoded tag:
#   1. $SWOOLE_BUILD_REF if set (explicit override).
#   2. the latest STABLE GitHub release, IF its composer.json admits this PHP.
#   3. the provided known-good pin, IF it admits this PHP.
#   4. master (last resort), with a warning.
# Prints the chosen ref on stdout (diagnostics go to stderr).
select_swoole_build_ref() {
    local php_ver="$1" pin="$2"
    if [ -n "${SWOOLE_BUILD_REF:-}" ]; then
        echo "$SWOOLE_BUILD_REF"; return 0
    fi
    local latest
    latest="$(curl -fsSL "https://api.github.com/repos/swoole/swoole-src/releases/latest" 2>/dev/null \
        | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
    if printf '%s' "$latest" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+$' && swoole_ref_supports_php "$latest" "$php_ver"; then
        echo "$latest"; return 0
    fi
    if swoole_ref_supports_php "$pin" "$php_ver"; then
        echo "$pin"; return 0
    fi
    echo "[WARN] No tagged Swoole release admits PHP ${php_ver}; falling back to master" >&2
    echo "master"
}

install_swoole_pecl() {
    echo -e "${BLUE}$SCRIPT_INDEX Installing Swoole...${NC}"

    # Check PHP version
    local php_ver=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null)
    
    # For PHP 8.5+, install from source (master) as PECL version is incompatible
    # Note: Swoole 6.x requires compatibility patch for Laravel Octane v2.13.x
    # The patch will be automatically applied by octane_swoole_compat_fixer.php
    if [[ "$php_ver" == "8.5" ]]; then
        # Select the Swoole version. Per Swoole's own composer.json `php` constraint
        # (official): 6.2.x => ">=8.2 <8.6" (supports PHP 8.5); 6.1.x => ">=8.1 <8.5"
        # (EXCLUDES 8.5); 6.0.x predates 8.5. So PHP 8.5 needs Swoole >= 6.2.0. We pick
        # the latest stable release that admits the running PHP (auto-tracking fixes),
        # falling back to this known-good pin offline. Override via SWOOLE_BUILD_REF.
        local swoole_pin="v6.2.1"
        local swoole_ref
        swoole_ref="$(select_swoole_build_ref "$php_ver" "$swoole_pin")"

        echo -e "${YELLOW}$SCRIPT_INDEX PHP 8.5 detected. Building Swoole from source (ref: $swoole_ref)...${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Note: Swoole 6.x will be patched for Octane v2.13.x compatibility${NC}"

        if ! command -v git >/dev/null 2>&1; then
            $USE_SUDO apt-get install -y git
        fi

        # Build under a WRITABLE temp dir; mktemp -d avoids PID collisions. Fall back
        # through candidates so a stale/unwritable GLOBAL_TEMP_DIR (e.g. the legacy
        # root-owned /usr/tmp inherited from the menu) can never block the build.
        local build_dir="" _tbase
        for _tbase in "${GLOBAL_TEMP_DIR%/}" "${TMPDIR%/}" /var/tmp /tmp; do
            [ -n "$_tbase" ] || continue
            build_dir="$(mktemp -d "${_tbase}/swoole-src-build-XXXXXX" 2>/dev/null)" && break
            build_dir=""
        done
        if [ -z "$build_dir" ]; then
            echo -e "${RED}$SCRIPT_INDEX Could not create a writable build dir (tried '$GLOBAL_TEMP_DIR', /var/tmp, /tmp)${NC}"
            return 1
        fi

        echo -e "${CYAN}$SCRIPT_INDEX Cloning Swoole (ref: $swoole_ref) into $build_dir...${NC}"
        if ! git clone --depth 1 --branch "$swoole_ref" \
            https://github.com/swoole/swoole-src.git "$build_dir"; then
            echo -e "${YELLOW}$SCRIPT_INDEX Shallow clone of '$swoole_ref' failed; retrying a full clone...${NC}"
            rm -rf "$build_dir"
            if ! git clone --branch "$swoole_ref" \
                https://github.com/swoole/swoole-src.git "$build_dir"; then
                echo -e "${RED}$SCRIPT_INDEX Failed to clone Swoole '$swoole_ref'${NC}"
                return 1
            fi
        fi

        if [ ! -f "$build_dir/config.m4" ]; then
            echo -e "${RED}$SCRIPT_INDEX Clone did not produce a Swoole source tree (no config.m4)${NC}"
            return 1
        fi

        # Save current directory
        local original_dir=$(pwd)
        cd "$build_dir"
        
        echo -e "${CYAN}$SCRIPT_INDEX Compiling Swoole...${NC}"
        phpize
        ./configure --enable-openssl --enable-swoole-curl --enable-mysqlnd
        make -j$(nproc)
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}$SCRIPT_INDEX Build failed${NC}"
            cd "$original_dir"
            return 1
        fi
        
        $USE_SUDO make install
        local install_status=$?
        
        cd "$original_dir"
        rm -rf "$build_dir"
        
        if [ $install_status -eq 0 ]; then
            echo -e "${GREEN}$SCRIPT_INDEX Swoole installed from source${NC}"
            return 0
        else
            echo -e "${RED}$SCRIPT_INDEX Installation failed${NC}"
            return 1
        fi
    fi

    # Fallback to PECL for older versions
    echo -e "${BLUE}$SCRIPT_INDEX Installing via PECL...${NC}"
    if ! command -v pecl >/dev/null 2>&1; then
        echo -e "${RED}$SCRIPT_INDEX PECL not found, installing php-pear...${NC}"
        $USE_SUDO apt-get install -y php-pear
    fi

    echo -e "${CYAN}$SCRIPT_INDEX Running: pecl install --force swoole${NC}"
    echo "" | $USE_SUDO pecl install --force swoole

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Swoole installed via PECL${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX PECL installation failed${NC}"
        return 1
    fi
}

enable_swoole_extension() {
    echo -e "${BLUE}$SCRIPT_INDEX Enabling Swoole extension...${NC}"

    local swoole_ini="/etc/php/8.5/mods-available/swoole.ini"

    if [ ! -f "$swoole_ini" ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Creating $swoole_ini${NC}"
        echo "extension=swoole.so" | $USE_SUDO tee "$swoole_ini" > /dev/null
    fi

    $USE_SUDO phpenmod -v 8.5 swoole

    # Only check CLI - FPM is not installed when using Swoole
    for sapi in cli; do
        local link="/etc/php/8.5/$sapi/conf.d/20-swoole.ini"
        if [ ! -L "$link" ]; then
            echo -e "${CYAN}$SCRIPT_INDEX Creating symlink for $sapi${NC}"
            $USE_SUDO ln -sf "$swoole_ini" "$link"
        fi
    done

    echo -e "${GREEN}$SCRIPT_INDEX Swoole extension enabled${NC}"
    return 0
}

restart_php_fpm() {
    echo -e "${BLUE}$SCRIPT_INDEX [SKIPPED] PHP-FPM restart not needed - Using Swoole${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Swoole runs independently, no FPM service required${NC}"
    # PHP-FPM is not installed when using Swoole with Laravel Octane
    return 0
}

verify_swoole() {
    echo -e "${BLUE}$SCRIPT_INDEX Verifying Swoole installation...${NC}"

    if php -m | grep -q "swoole"; then
        local swoole_version=$(php -r "echo phpversion('swoole');" 2>/dev/null || echo "unknown")
        echo -e "${GREEN}$SCRIPT_INDEX �?Swoole installed successfully${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX   Version: $swoole_version${NC}"

        echo ""
        echo -e "${CYAN}$SCRIPT_INDEX Swoole configuration:${NC}"
        php --ri swoole | head -20

        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX �?Swoole verification failed${NC}"
        return 1
    fi
}

check_octane_compatibility() {
    echo ""
    echo -e "${BLUE}$SCRIPT_INDEX Checking Laravel Octane compatibility...${NC}"

    # Get Laravel root using map_web_path
    local laravel_root=$(map_web_path "core_node" "poly_apps/laravel_main")

    if [ ! -d "$laravel_root" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Laravel not found at: $laravel_root, skipping compatibility check${NC}"
        return 0
    fi

    local fixer_script="$laravel_root/app/Support/OctaneSwooleCompatFixer.php"

    if [ ! -f "$fixer_script" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Compatibility fixer not found, skipping${NC}"
        return 0
    fi

    php "$fixer_script" "$laravel_root"

    return 0
}

main() {
    echo -e "${BLUE}$SCRIPT_INDEX Starting Swoole installation/configuration check...${NC}"
    echo ""

    local swoole_installed=false
    local config_valid=false

    check_swoole_installed && swoole_installed=true
    check_swoole_configuration && config_valid=true

    echo ""

    if $swoole_installed && $config_valid; then
        echo -e "${GREEN}$SCRIPT_INDEX Swoole is fully configured and working${NC}"

        # Check Swoole version and compatibility
        local swoole_version=$(php -r "echo phpversion('swoole');" 2>/dev/null)
        echo -e "${CYAN}$SCRIPT_INDEX Swoole version: $swoole_version${NC}"

        # Run compatibility check for Octane
        check_octane_compatibility

        echo -e "${GREEN}$SCRIPT_INDEX Nothing to do${NC}"
        exit 0
    elif $swoole_installed && ! $config_valid; then
        echo -e "${YELLOW}$SCRIPT_INDEX Swoole module is loaded but configuration needs repair${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Repairing Swoole configuration...${NC}"
        echo ""

        enable_swoole_extension || exit 1
        restart_php_fpm
        verify_swoole || exit 1
        check_octane_compatibility

        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX Swoole configuration repaired${NC}"
        echo -e "${GREEN}========================================${NC}"
    elif ! $swoole_installed && $config_valid; then
        echo -e "${YELLOW}$SCRIPT_INDEX Configuration exists but Swoole module not loaded${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX This may indicate extension file is missing or PHP-FPM needs restart${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Reinstalling Swoole...${NC}"
        echo ""

        uninstall_old_swoole
        install_swoole_dependencies || exit 1
        install_swoole_pecl || exit 1
        enable_swoole_extension || exit 1
        restart_php_fpm
        verify_swoole || exit 1
        check_octane_compatibility

        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX Swoole reinstalled${NC}"
        echo -e "${GREEN}========================================${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Swoole not installed${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Performing fresh installation...${NC}"
        echo ""

        uninstall_old_swoole
        install_swoole_dependencies || exit 1
        install_swoole_pecl || exit 1
        enable_swoole_extension || exit 1
        restart_php_fpm
        verify_swoole || exit 1
        check_octane_compatibility

        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX Swoole installation completed${NC}"
        echo -e "${GREEN}========================================${NC}"
    fi

    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo -e "  1. Install Laravel Octane: composer require laravel/octane"
    echo -e "  2. Publish config: php artisan octane:install --server=swoole"
    echo -e "  3. Start server: php artisan octane:start"
    echo ""
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
