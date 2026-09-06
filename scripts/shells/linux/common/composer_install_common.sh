#!/bin/bash

# Source-once guard: repeated `source` is a no-op. NOT exported so child
# bash processes still perform their own full load.
if [ "${COMPOSER_INSTALL_COMMON_LOADED:-false}" = "true" ]; then
    return
fi
COMPOSER_INSTALL_COMMON_LOADED="true"

COMPOSER_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSER_INSTALL_DIR="/usr/local/lib/composer"
COMPOSER_PHAR_PATH="$COMPOSER_INSTALL_DIR/composer.phar"
COMPOSER_TARGET_PATH="/usr/local/bin/composer"
COMPOSER_SAFE_PATH="/usr/local/bin/composer-safe"
COMPOSER_HOME="/usr/local/share/composer"
COMPOSER_LARAVEL_BINARY="$COMPOSER_HOME/vendor/bin/laravel"
COMPOSER_LARAVEL_LINK="/usr/local/bin/laravel"
COMPOSER_INSTALLER_URL="https://getcomposer.org/installer"
COMPOSER_SIGNATURE_URL="https://composer.github.io/installer.sig"
COMPOSER_RUNTIME_PHP=""
COMPOSER_RUNTIME_SUBCOMMAND=""
COMPOSER_RUNTIME_READY="no"
COMPOSER_INSTALLER_READY="no"
COMPOSER_PHAR_READY="no"
COMPOSER_MAIN_WRAPPER_READY="no"
COMPOSER_SAFE_WRAPPER_READY="no"
COMPOSER_LARAVEL_READY="no"
COMPOSER_INSTALL_READY="no"
COMPOSER_FORCE_REFRESH="no"
COMPOSER_TEMP_DIR=""
COMPOSER_INSTALLER_PATH=""
COMPOSER_SIGNATURE_PATH=""
COMPOSER_HASH_PROBE_PATH=""
COMPOSER_EXPECTED_HASH=""
COMPOSER_ACTUAL_HASH=""
COMPOSER_WRAPPER_CONTENT=""
COMPOSER_WRAPPER_PATH=""
COMPOSER_WRAPPER_EXISTING=""
COMPOSER_WRAPPER_TEMP=""
COMPOSER_CURRENT_LINK=""
COMPOSER_ARG=""
COMPOSER_CURL_BIN=""

source "$COMPOSER_COMMON_DIR/gvar_common.sh"
source "$COMPOSER_COMMON_DIR/common_functions.sh"
source "$COMPOSER_COMMON_DIR/frankenphp_manager.sh"

composer_runtime_resolve() {
    COMPOSER_RUNTIME_PHP=""
    COMPOSER_RUNTIME_SUBCOMMAND=""
    COMPOSER_RUNTIME_READY="no"
    if [ "$(php_runtime_plane)" = "frankenphp" ]; then
        fm_runtime_converge
    fi
    if [ -x /usr/local/bin/php ]; then
        COMPOSER_RUNTIME_PHP="/usr/local/bin/php"
    elif [ -x /usr/bin/php8.5 ]; then
        COMPOSER_RUNTIME_PHP="/usr/bin/php8.5"
    elif [ -x /usr/bin/php ]; then
        COMPOSER_RUNTIME_PHP="/usr/bin/php"
    elif [ -n "$FM_RUNTIME_BINARY" ] && [ -x "$FM_RUNTIME_BINARY" ]; then
        COMPOSER_RUNTIME_PHP="$FM_RUNTIME_BINARY"
        COMPOSER_RUNTIME_SUBCOMMAND="php-cli"
    fi
    if [ -n "$COMPOSER_RUNTIME_PHP" ] && [ -x "$COMPOSER_RUNTIME_PHP" ]; then
        COMPOSER_RUNTIME_READY="yes"
    else
        echo "[COMPOSER] No PHP CLI runtime is available"
    fi
}

composer_php_run() {
    if [ -n "$COMPOSER_RUNTIME_SUBCOMMAND" ]; then
        "$COMPOSER_RUNTIME_PHP" "$COMPOSER_RUNTIME_SUBCOMMAND" "$@"
    else
        "$COMPOSER_RUNTIME_PHP" "$@"
    fi
}

composer_php_run_privileged() {
    if [ -n "$COMPOSER_RUNTIME_SUBCOMMAND" ]; then
        $USE_SUDO env COMPOSER_ALLOW_SUPERUSER=1 "$COMPOSER_RUNTIME_PHP" "$COMPOSER_RUNTIME_SUBCOMMAND" "$@"
    else
        $USE_SUDO env COMPOSER_ALLOW_SUPERUSER=1 "$COMPOSER_RUNTIME_PHP" "$@"
    fi
}

composer_paths_ensure() {
    if [ ! -d "$COMPOSER_INSTALL_DIR" ]; then
        $USE_SUDO mkdir -p "$COMPOSER_INSTALL_DIR"
    fi
    if [ ! -d "$COMPOSER_HOME" ]; then
        $USE_SUDO mkdir -p "$COMPOSER_HOME"
    fi
    COMPOSER_TEMP_DIR="$(create_script_temp_dir "composer-installer")"
    COMPOSER_INSTALLER_PATH="$COMPOSER_TEMP_DIR/composer-setup.php"
    COMPOSER_SIGNATURE_PATH="$COMPOSER_TEMP_DIR/installer.sig"
    COMPOSER_HASH_PROBE_PATH="$COMPOSER_TEMP_DIR/installer-hash.php"
}

composer_installer_ensure() {
    COMPOSER_INSTALLER_READY="no"
    COMPOSER_CURL_BIN="$(command -v curl 2>/dev/null)"
    if [ "$COMPOSER_RUNTIME_READY" = "yes" ]; then
        if [ -n "$COMPOSER_CURL_BIN" ]; then
            "$COMPOSER_CURL_BIN" -fsSL --connect-timeout 30 --retry 3 "$COMPOSER_INSTALLER_URL" -o "$COMPOSER_INSTALLER_PATH"
            "$COMPOSER_CURL_BIN" -fsSL --connect-timeout 30 --retry 3 "$COMPOSER_SIGNATURE_URL" -o "$COMPOSER_SIGNATURE_PATH"
        else
            echo "[COMPOSER] curl is required to download the official installer"
        fi
    fi
    COMPOSER_EXPECTED_HASH=""
    COMPOSER_ACTUAL_HASH=""
    if [ -s "$COMPOSER_SIGNATURE_PATH" ]; then
        COMPOSER_EXPECTED_HASH="$(tr -d '[:space:]' < "$COMPOSER_SIGNATURE_PATH")"
    fi
    if [ -s "$COMPOSER_INSTALLER_PATH" ]; then
        printf '<?php echo hash_file("sha384", getenv("COMPOSER_INSTALLER_PATH"));' > "$COMPOSER_HASH_PROBE_PATH"
        COMPOSER_ACTUAL_HASH="$(COMPOSER_INSTALLER_PATH="$COMPOSER_INSTALLER_PATH" composer_php_run "$COMPOSER_HASH_PROBE_PATH" 2>/dev/null)"
    fi
    if [ -n "$COMPOSER_EXPECTED_HASH" ] && [ "$COMPOSER_EXPECTED_HASH" = "$COMPOSER_ACTUAL_HASH" ]; then
        COMPOSER_INSTALLER_READY="yes"
    else
        echo "[COMPOSER] Official installer signature validation failed"
    fi
}

composer_phar_probe() {
    COMPOSER_PHAR_READY="no"
    if [ -s "$COMPOSER_PHAR_PATH" ]; then
        COMPOSER_PHAR_READY="yes"
    fi
}

composer_phar_ensure() {
    composer_phar_probe
    if [ "$COMPOSER_PHAR_READY" != "yes" ] || [ "$COMPOSER_FORCE_REFRESH" = "yes" ]; then
        composer_installer_ensure
        if [ "$COMPOSER_INSTALLER_READY" = "yes" ]; then
            composer_php_run_privileged "$COMPOSER_INSTALLER_PATH" \
                --install-dir="$COMPOSER_INSTALL_DIR" --filename="$(basename "$COMPOSER_PHAR_PATH")" --quiet
        fi
        composer_phar_probe
    fi
    if [ "$COMPOSER_PHAR_READY" = "yes" ]; then
        $USE_SUDO chmod 755 "$COMPOSER_PHAR_PATH"
        echo "[COMPOSER] PHAR payload ready: $COMPOSER_PHAR_PATH"
    else
        echo "[COMPOSER] PHAR payload is missing: $COMPOSER_PHAR_PATH"
    fi
}

composer_wrapper_render() {
    if [ -n "$COMPOSER_RUNTIME_SUBCOMMAND" ]; then
        COMPOSER_WRAPPER_CONTENT="#!/bin/bash
export COMPOSER_ALLOW_SUPERUSER=1
export COMPOSER_HOME=\"$COMPOSER_HOME\"
exec \"$COMPOSER_RUNTIME_PHP\" \"$COMPOSER_RUNTIME_SUBCOMMAND\" \"$COMPOSER_PHAR_PATH\" \"\$@\""
    else
        COMPOSER_WRAPPER_CONTENT="#!/bin/bash
export COMPOSER_ALLOW_SUPERUSER=1
export COMPOSER_HOME=\"$COMPOSER_HOME\"
exec \"$COMPOSER_RUNTIME_PHP\" \"$COMPOSER_PHAR_PATH\" \"\$@\""
    fi
}

composer_wrapper_ensure() {
    COMPOSER_WRAPPER_PATH="$1"
    COMPOSER_WRAPPER_EXISTING=""
    COMPOSER_WRAPPER_TEMP="$COMPOSER_TEMP_DIR/$(basename "$COMPOSER_WRAPPER_PATH").tmp.$$"
    if [ -f "$COMPOSER_WRAPPER_PATH" ]; then
        COMPOSER_WRAPPER_EXISTING="$(cat "$COMPOSER_WRAPPER_PATH")"
    fi
    if [ "$COMPOSER_WRAPPER_EXISTING" != "$COMPOSER_WRAPPER_CONTENT" ]; then
        printf '%s\n' "$COMPOSER_WRAPPER_CONTENT" > "$COMPOSER_WRAPPER_TEMP"
        $USE_SUDO cp "$COMPOSER_WRAPPER_TEMP" "$COMPOSER_WRAPPER_PATH"
        rm -f "$COMPOSER_WRAPPER_TEMP"
    fi
    $USE_SUDO chmod 755 "$COMPOSER_WRAPPER_PATH" 2>/dev/null
}

composer_wrappers_ensure() {
    COMPOSER_MAIN_WRAPPER_READY="no"
    COMPOSER_SAFE_WRAPPER_READY="no"
    if [ "$COMPOSER_RUNTIME_READY" = "yes" ] && [ "$COMPOSER_PHAR_READY" = "yes" ]; then
        composer_wrapper_render
        composer_wrapper_ensure "$COMPOSER_TARGET_PATH"
        composer_wrapper_ensure "$COMPOSER_SAFE_PATH"
    fi
    if [ -x "$COMPOSER_TARGET_PATH" ] && [ "$(cat "$COMPOSER_TARGET_PATH")" = "$COMPOSER_WRAPPER_CONTENT" ]; then
        COMPOSER_MAIN_WRAPPER_READY="yes"
    fi
    if [ -x "$COMPOSER_SAFE_PATH" ] && [ "$(cat "$COMPOSER_SAFE_PATH")" = "$COMPOSER_WRAPPER_CONTENT" ]; then
        COMPOSER_SAFE_WRAPPER_READY="yes"
    fi
}

composer_laravel_installer_ensure() {
    COMPOSER_LARAVEL_READY="no"
    if [ ! -f "$COMPOSER_LARAVEL_BINARY" ] && [ "$COMPOSER_MAIN_WRAPPER_READY" = "yes" ]; then
        $USE_SUDO env COMPOSER_HOME="$COMPOSER_HOME" COMPOSER_ALLOW_SUPERUSER=1 \
            "$COMPOSER_TARGET_PATH" global require laravel/installer --no-interaction --no-progress --no-scripts
    fi
    if [ -f "$COMPOSER_LARAVEL_BINARY" ]; then
        $USE_SUDO chmod 755 "$COMPOSER_LARAVEL_BINARY"
        COMPOSER_CURRENT_LINK="$(readlink -f "$COMPOSER_LARAVEL_LINK" 2>/dev/null)"
        if [ "$COMPOSER_CURRENT_LINK" != "$COMPOSER_LARAVEL_BINARY" ]; then
            $USE_SUDO ln -sfn "$COMPOSER_LARAVEL_BINARY" "$COMPOSER_LARAVEL_LINK"
        fi
        COMPOSER_CURRENT_LINK="$(readlink -f "$COMPOSER_LARAVEL_LINK" 2>/dev/null)"
        if [ "$COMPOSER_CURRENT_LINK" = "$COMPOSER_LARAVEL_BINARY" ]; then
            COMPOSER_LARAVEL_READY="yes"
        fi
    fi
}

composer_install_ensure() {
    for COMPOSER_ARG in "$@"; do
        case "$COMPOSER_ARG" in
            --force|-f) COMPOSER_FORCE_REFRESH="yes" ;;
        esac
    done
    composer_runtime_resolve
    composer_paths_ensure
    composer_phar_ensure
    composer_wrappers_ensure
    composer_laravel_installer_ensure
    COMPOSER_INSTALL_READY="no"
    if [ "$COMPOSER_PHAR_READY" = "yes" ] \
        && [ "$COMPOSER_MAIN_WRAPPER_READY" = "yes" ] \
        && [ "$COMPOSER_SAFE_WRAPPER_READY" = "yes" ] \
        && [ "$COMPOSER_LARAVEL_READY" = "yes" ]; then
        COMPOSER_INSTALL_READY="yes"
        echo "[COMPOSER] Composer installation is canonical"
    else
        echo "[COMPOSER] Composer installation remains incomplete"
    fi
}
