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

# Ensure the pdo_pgsql + pgsql extensions exist for THIS PHP.
#
# The app runs on PostgreSQL on Linux (config/database.php defaults
# POLY_DB_DRIVER=pgsql for PHP_OS_FAMILY===Linux). Without the pgsql PDO driver
# Laravel fails at migrate time with: "could not find driver (Connection: ...
# pgsql)".
#
# This project's PHP 8.5 is installed from the ondrej/php PPA (see
# 32_ensure_php85_intelligent.sh) and every PHP extension is provisioned via
# `apt install php<ver>-<ext>` (e.g. php8.5-pgsql provides pdo_pgsql + pgsql and
# auto-enables them under /etc/php/<ver>/cli/conf.d/). So this script installs the
# apt package -- the SAME mechanism the rest of the toolchain uses -- NOT a
# from-source phpize build. /usr/local/bin/php is just a symlink to the apt php.
#
# Idempotent: if `php -m` already lists pdo_pgsql, prints success and exits 0.

# --- All variables declared at top ---
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
GVAR_COMMON="$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
COMMON_FUNCTIONS="$PARENT_DIR_LEVEL_2/common/common_functions.sh"
PHP_BIN=""
PHP_VER=""
PG_PKG=""
CANDIDATE=""
OS_ID_LOCAL=""
OS_CODENAME_LOCAL=""
REPO_MANAGER=""

# Source global variables (provides USE_SUDO) and shared print helpers
source "$GVAR_COMMON"
source "$COMMON_FUNCTIONS"

print_step_from_common_functions "48_ensure_php_pgsql: ensuring pdo_pgsql / pgsql for PHP"

# --- Resolve the live PHP (the same interpreter Laravel/Octane run) ---
for CANDIDATE in "/usr/local/bin/php" "/usr/bin/php"; do
    if [ -x "$CANDIDATE" ]; then PHP_BIN="$CANDIDATE"; break; fi
done
if [ -z "$PHP_BIN" ] && command -v php >/dev/null 2>&1; then
    PHP_BIN="$(command -v php)"
fi
if [ -z "$PHP_BIN" ]; then
    print_error_from_common_functions "php not found. Run 32_ensure_php85_intelligent.sh first."
    exit 1
fi

# --- Idempotent fast path ---
if "$PHP_BIN" -m 2>/dev/null | grep -qi '^pdo_pgsql$'; then
    print_success_from_common_functions "pdo_pgsql already present -> nothing to do."
    "$PHP_BIN" -m 2>/dev/null | grep -i pgsql || true
    exit 0
fi

# --- Require root or sudo for apt ---
if [ "$(id -u)" -ne 0 ] && [ -z "$USE_SUDO" ]; then
    print_error_from_common_functions "Must run as root or with sudo to install the pgsql PHP package."
    echo "  sudo bash $0"
    exit 1
fi

# --- Resolve PHP major.minor -> php<ver>-pgsql package (ondrej PPA naming) ---
PHP_VER="$("$PHP_BIN" -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null)"
if [ -z "$PHP_VER" ]; then
    PHP_VER="8.5"
fi
PG_PKG="php${PHP_VER}-pgsql"

print_info_from_common_functions "PHP binary:  $PHP_BIN"
print_info_from_common_functions "PHP version: $PHP_VER"
print_info_from_common_functions "Package:     $PG_PKG"

# --- Install the apt package. The PHP apt repository is normally configured by
#     32_ensure_php85_intelligent.sh (Ubuntu -> ondrej PPA, Debian -> Sury), but
#     make THIS script self-sufficient: if the package is not locatable (the common
#     Debian failure "Unable to locate package php8.5-pgsql"), set up that repo here
#     using the shared apt_repository_manager and retry. ---
print_step_from_common_functions "Installing $PG_PKG via apt..."
$USE_SUDO apt-get update -qq || true
if ! $USE_SUDO apt-get install -y "$PG_PKG"; then
    print_step_from_common_functions "$PG_PKG not found -> ensuring the PHP apt repository (Debian Sury / Ubuntu PPA) and retrying..."
    OS_ID_LOCAL="$( . /etc/os-release 2>/dev/null; echo "$ID" )"
    OS_CODENAME_LOCAL="$( . /etc/os-release 2>/dev/null; echo "$VERSION_CODENAME" )"
    REPO_MANAGER="$PARENT_DIR_LEVEL_2/common/apt_repository_manager.sh"
    if [ -f "$REPO_MANAGER" ]; then
        # shellcheck source=/dev/null
        source "$REPO_MANAGER"
        if type add_php_repository_permanent_from_apt_repository_manager >/dev/null 2>&1; then
            # Adds the OS-correct PHP repo permanently (Ubuntu ondrej / Debian Sury).
            add_php_repository_permanent_from_apt_repository_manager \
                "$OS_ID_LOCAL" "$OS_CODENAME_LOCAL" "true"
        else
            print_error_from_common_functions "apt_repository_manager missing add_php_repository_permanent helper."
        fi
    else
        print_error_from_common_functions "apt_repository_manager.sh not found at $REPO_MANAGER."
    fi
    $USE_SUDO apt-get update -qq || true
    if ! $USE_SUDO apt-get install -y "$PG_PKG"; then
        print_error_from_common_functions "apt still failed to install $PG_PKG after configuring the PHP repository."
        echo "  OS: ${OS_ID_LOCAL:-unknown} ${OS_CODENAME_LOCAL:-unknown}"
        echo "  Debian uses packages.sury.org (NOT the Ubuntu ondrej PPA)."
        echo "  Manual: sudo apt-get install -y $PG_PKG"
        exit 1
    fi
fi

# --- Enable for all SAPIs (apt usually auto-enables; be explicit for CLI/Octane) ---
if command -v phpenmod >/dev/null 2>&1; then
    $USE_SUDO phpenmod -v "$PHP_VER" pdo_pgsql 2>/dev/null || true
    $USE_SUDO phpenmod -v "$PHP_VER" pgsql 2>/dev/null || true
fi

# --- Verify against the live interpreter ---
if "$PHP_BIN" -m 2>/dev/null | grep -qi '^pdo_pgsql$'; then
    print_success_from_common_functions "pdo_pgsql + pgsql enabled."
    "$PHP_BIN" -m 2>/dev/null | grep -i pgsql || true
    exit 0
fi

print_error_from_common_functions "pdo_pgsql still not loaded after installing $PG_PKG."
echo "  Inspect: $PHP_BIN --ini"
echo "  Inspect: ls /etc/php/${PHP_VER}/cli/conf.d/ | grep -i pgsql"
exit 1
