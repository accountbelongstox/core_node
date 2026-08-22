#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Canonical Laravel 13 upgrader (common-area copy, sourced by
# install_shells/175_laravel_main_start.sh). Requires the caller to provide
# LARAVEL_DIR, PHP_BIN and COMPOSER_CMD; falls back to the core_node layout.

LARAVEL_13_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_13_REPO_ROOT="$(cd "$LARAVEL_13_COMMON_DIR/../../../../.." && pwd)"
LARAVEL_DIR="${LARAVEL_DIR:-${CORE_NODE_DIR:-$LARAVEL_13_REPO_ROOT}/poly_apps/laravel_main}"
PHP_BIN="${PHP_BIN:-$(command -v php)}"
COMPOSER_CMD="${COMPOSER_CMD:-$(command -v composer)}"

LARAVEL_13_TARGET_MAJOR="13"
LARAVEL_13_UPGRADE_READY="no"

laravel_framework_major() {
    local autoload_path="${LARAVEL_DIR}/vendor/autoload.php"
    local lock_path="${LARAVEL_DIR}/composer.lock"
    local version=""
    local major=""

    if [ -f "$autoload_path" ]; then
        version="$(LARAVEL_UPGRADE_AUTOLOAD="$autoload_path" php_script_run '
            require getenv("LARAVEL_UPGRADE_AUTOLOAD");
            echo \Composer\InstalledVersions::getPrettyVersion("laravel/framework") ?? "";
        ' 2>/dev/null)"
    elif [ -f "$lock_path" ]; then
        version="$(LARAVEL_UPGRADE_LOCK="$lock_path" php_script_run '
            $lock = json_decode(file_get_contents(getenv("LARAVEL_UPGRADE_LOCK")), true, 512, JSON_THROW_ON_ERROR);
            $packages = array_merge($lock["packages"] ?? [], $lock["packages-dev"] ?? []);
            foreach ($packages as $package) {
                if (($package["name"] ?? null) === "laravel/framework") {
                    echo $package["version"] ?? "";
                    break;
                }
            }
        ' 2>/dev/null)"
    fi

    major="${version#v}"
    major="${major%%.*}"
    printf '%s' "$major"
}

upgrade_laravel_to_13() {
    local current_major=""
    local answer=""
    local laravel_real=""
    local vendor_path=""
    local vendor_real=""
    local upgraded_major=""

    LARAVEL_13_UPGRADE_READY="no"
    current_major="$(laravel_framework_major)"
    if [ -z "$current_major" ] || [ "$current_major" = "$LARAVEL_13_TARGET_MAJOR" ]; then
        LARAVEL_13_UPGRADE_READY="yes"
        return
    fi

    if [ "$current_major" != "12" ]; then
        echo "ERROR: Unsupported Laravel framework major detected: ${current_major}. Laravel 13 is required."
        return
    fi

    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf 'Laravel 12 detected. Upgrade to Laravel 13? [y/N] ' > /dev/tty
        read -r answer < /dev/tty
    fi
    case "$answer" in
        [Yy]*) ;;
        *)
            echo "Laravel 13 upgrade declined. Startup stopped because Laravel 12 is unsupported."
            return
            ;;
    esac

    laravel_real="$(cd "$LARAVEL_DIR" && pwd -P)"
    vendor_path="${laravel_real}/vendor"
    if [ -d "$vendor_path" ]; then
        vendor_real="$(cd "$vendor_path" && pwd -P)"
        if [ "$vendor_real" != "$vendor_path" ]; then
            echo "ERROR: Refusing to remove an unexpected vendor path: $vendor_real"
            return
        fi

        echo "Removing Laravel 12 dependencies: $vendor_real"
        rm -rf -- "$vendor_real"
        if [ -d "$vendor_real" ]; then
            echo "ERROR: Laravel 12 vendor removal failed: $vendor_real"
            return
        fi
    fi

    echo "Resolving the Laravel 13 dependency graph..."
    $COMPOSER_CMD --working-dir="$laravel_real" update --with-all-dependencies --no-interaction

    upgraded_major="$(laravel_framework_major)"
    if [ "$upgraded_major" != "$LARAVEL_13_TARGET_MAJOR" ]; then
        echo "ERROR: Composer completed without installing Laravel 13."
        return
    fi

    LARAVEL_13_UPGRADE_READY="yes"
    echo "Laravel 13 dependencies installed successfully."
}
