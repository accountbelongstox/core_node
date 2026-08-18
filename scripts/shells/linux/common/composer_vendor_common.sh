#!/bin/bash
# Canonical Composer vendor integrity ensure (Debian/Ubuntu/WSL), shared by the
# laravel_main entry points (175_laravel_main_start.sh, laravel_start_service.sh,
# poly_apps/laravel_main/scripts/start_service.sh) and run_app.sh.
#
# composer.lock is the single source of truth for vendor/. A bare existence
# check ("vendor/autoload.php exists") is NOT sufficient: an autoloader
# generated against a different lock state (partial file sync, stale checkout,
# interrupted install) references package files that do not exist and dies with
# "Failed opening required .../vendor/composer/../<pkg>/<file>".
#
# Repair ladder (official Composer semantics, getcomposer.org/doc/03-cli.md):
#   1. composer install  - syncs vendor/ to the exact locked versions (installs
#                          missing packages, removes ones the lock dropped).
#   2. wipe + install    - composer trusts installed.json; when package dirs
#                          were deleted while still listed there, only a full
#                          rebuild from the lock repairs the tree.
# Fast path: a loadable autoloader means zero work (no composer invocation).
#
# House style: no return/exit-code signaling. Tools are detected by direct file
# checks; every repair step is trusted to run, and the resulting state is then
# re-probed from the filesystem (autoload file + clean php load). The final
# state is published in COMPOSER_VENDOR_AUTOLOAD_OK ("yes"/"no").
#
# Caller contract (read at call time):
#   PHP_BIN      - php binary (file-checked first when set)
#   COMPOSER_CMD - composer command, may be multi-word ("php composer.phar")
#
# Usage: ensure_composer_vendor <app_dir> [extra composer install args...]
#        then inspect COMPOSER_VENDOR_AUTOLOAD_OK.

COMPOSER_VENDOR_PHP=""
COMPOSER_VENDOR_COMPOSER=""
COMPOSER_VENDOR_AUTOLOAD_OK="no"

# Resolve php by direct file detection: caller-provided PHP_BIN, then known
# install locations, then a PATH lookup as the last resort.
composer_vendor_resolve_php() {
    COMPOSER_VENDOR_PHP=""
    if [ -n "${PHP_BIN:-}" ] && [ -x "${PHP_BIN}" ]; then
        COMPOSER_VENDOR_PHP="${PHP_BIN}"
    elif [ -x /usr/local/bin/php ]; then
        COMPOSER_VENDOR_PHP="/usr/local/bin/php"
    elif [ -x /usr/bin/php ]; then
        COMPOSER_VENDOR_PHP="/usr/bin/php"
    elif [ -n "$(command -v php 2>/dev/null)" ]; then
        COMPOSER_VENDOR_PHP="$(command -v php)"
    fi
}

# Resolve composer: caller-provided COMPOSER_CMD, then known install locations.
composer_vendor_resolve_composer() {
    COMPOSER_VENDOR_COMPOSER="${COMPOSER_CMD:-}"
    if [ -z "$COMPOSER_VENDOR_COMPOSER" ]; then
        if [ -x /usr/local/bin/composer ]; then
            COMPOSER_VENDOR_COMPOSER="/usr/local/bin/composer"
        elif [ -x /usr/bin/composer ]; then
            COMPOSER_VENDOR_COMPOSER="/usr/bin/composer"
        else
            COMPOSER_VENDOR_COMPOSER="composer"
        fi
    fi
}

# Probe vendor state: autoload file must exist AND load cleanly under php.
# A broken tree prints a PHP warning/fatal; a healthy load prints nothing.
composer_vendor_probe_autoload() {
    local app_dir="$1"
    local probe_out=""
    COMPOSER_VENDOR_AUTOLOAD_OK="no"
    if [ -n "$COMPOSER_VENDOR_PHP" ] && [ -f "${app_dir}/vendor/autoload.php" ]; then
        probe_out="$("$COMPOSER_VENDOR_PHP" -r 'require $argv[1];' "${app_dir}/vendor/autoload.php" 2>&1)"
        if [ -z "$probe_out" ]; then
            COMPOSER_VENDOR_AUTOLOAD_OK="yes"
        fi
    fi
}

ensure_composer_vendor() {
    local app_dir="$1"
    shift
    local install_args=("$@")

    composer_vendor_resolve_php
    composer_vendor_resolve_composer
    composer_vendor_probe_autoload "$app_dir"

    if [ "$COMPOSER_VENDOR_AUTOLOAD_OK" != "yes" ]; then
        if [ -f "${app_dir}/vendor/autoload.php" ]; then
            echo "vendor/ autoloader is broken (out of sync with composer.lock). Repairing from composer.lock..."
        else
            echo "vendor/ not found. Running composer install..."
        fi

        # Stage 1: sync vendor/ to composer.lock (trusted to run; state re-probed).
        (cd "$app_dir" && $COMPOSER_VENDOR_COMPOSER install --no-interaction "${install_args[@]}")
        composer_vendor_probe_autoload "$app_dir"

        if [ "$COMPOSER_VENDOR_AUTOLOAD_OK" != "yes" ]; then
            # Stage 2: installed.json still lists deleted packages -> full rebuild.
            echo "Autoloader still broken; rebuilding vendor/ from scratch (composer.lock is authoritative)..."
            rm -rf "${app_dir}/vendor"
            (cd "$app_dir" && $COMPOSER_VENDOR_COMPOSER install --no-interaction "${install_args[@]}")
            composer_vendor_probe_autoload "$app_dir"

            if [ "$COMPOSER_VENDOR_AUTOLOAD_OK" != "yes" ]; then
                echo "ERROR: vendor/ rebuilt but the autoloader still does not load."
            fi
        fi
    fi
}
