#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# FrankenPHP apt variant (93 mode 1, default): official deb repository
# (frankenphp.dev/docs "deb packages" - static-php repo, distro-agnostic
# suite "php-zts", works on Debian/Ubuntu/Kali) + php-zts extension set
# incl. PostgreSQL (php-zts-pgsql / php-zts-pdo-pgsql per the official
# "Installing extensions: sudo apt install php-zts-<extension>" pattern).
# DNS-01 certificates: this variant has NO embedded dnspod module, so
# certificate issuance runs exclusively through the acme.sh dns_dp
# pre-flight (frankenphp_acme_sh_install.sh) - prebuilt certs on disk are
# pinned by the Caddyfile file-cert gate.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRANKENPHP_INSTALL_INDEX="93-install-system"
FRANKENPHP_APT_RUNTIME_MASK_PATH="/run/systemd/system/frankenphp.service"
FRANKENPHP_APT_LEGACY_MASK_PATH="/etc/systemd/system/frankenphp.service"

source "$SCRIPT_CURRENT_DIR/frankenphp_install_modes.sh"
source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

frankenphp_install_apt_package_missing() {
    local package=""
    local package_check=""

    package="$1"
    package_check="$(dpkg -s "$package" 2>/dev/null | awk '/^Status: / {print $4}')"
    if [ "$package_check" = "installed" ]; then
        echo "no"
    else
        echo "yes"
    fi
}

# The package post-install script may start its vendor unit. A runtime mask is
# the systemd-native, installation-window mutex: it prevents activation without
# persisting a local /etc override. Stop and disable are separate because the
# systemctl contract states that disable does not stop a running service.
frankenphp_install_apt_packaged_service_mask_ensure() {
    local runtime_mask_target=""
    local legacy_mask_target=""

    runtime_mask_target="$(readlink "$FRANKENPHP_APT_RUNTIME_MASK_PATH" 2>/dev/null)"
    if [ "$runtime_mask_target" = "/dev/null" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] packaged service runtime mask already present"
        return
    fi
    legacy_mask_target="$(readlink "$FRANKENPHP_APT_LEGACY_MASK_PATH" 2>/dev/null)"
    if [ "$legacy_mask_target" = "/dev/null" ]; then
        $USE_SUDO rm -f "$FRANKENPHP_APT_LEGACY_MASK_PATH"
        $USE_SUDO systemctl daemon-reload >/dev/null 2>&1
    fi
    $USE_SUDO systemctl mask --runtime frankenphp.service >/dev/null 2>&1
    runtime_mask_target="$(readlink "$FRANKENPHP_APT_RUNTIME_MASK_PATH" 2>/dev/null)"
    if [ "$runtime_mask_target" = "/dev/null" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] packaged service runtime-masked for package preparation"
    else
        echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] packaged service runtime mask did not converge"
    fi
}

frankenphp_install_apt_packaged_service_mask_ready() {
    local runtime_mask_target=""

    runtime_mask_target="$(readlink "$FRANKENPHP_APT_RUNTIME_MASK_PATH" 2>/dev/null)"
    if [ "$runtime_mask_target" = "/dev/null" ]; then
        echo "yes"
    else
        echo "no"
    fi
}

frankenphp_install_apt_packaged_service_stop_ensure() {
    local active_state=""

    active_state="$(systemctl show frankenphp.service -p ActiveState --value 2>/dev/null)"
    if [ "$active_state" != "inactive" ] && [ "$active_state" != "failed" ] && [ -n "$active_state" ]; then
        $USE_SUDO systemctl stop frankenphp.service >/dev/null 2>&1
    fi
    active_state="$(systemctl show frankenphp.service -p ActiveState --value 2>/dev/null)"
    if [ -z "$active_state" ] || [ "$active_state" = "inactive" ] || [ "$active_state" = "failed" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] packaged service inactive"
    else
        echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] packaged service remains ${active_state}"
    fi
}

frankenphp_install_apt_packaged_service_disable_ensure() {
    local unit_file_state=""

    unit_file_state="$(systemctl show frankenphp.service -p UnitFileState --value 2>/dev/null)"
    case "$unit_file_state" in
        enabled|enabled-runtime|linked|linked-runtime|alias)
            $USE_SUDO systemctl disable frankenphp.service >/dev/null 2>&1
            ;;
    esac
    unit_file_state="$(systemctl show frankenphp.service -p UnitFileState --value 2>/dev/null)"
    case "$unit_file_state" in
        enabled|enabled-runtime|linked|linked-runtime|alias)
            echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] packaged service remains ${unit_file_state}"
            ;;
        *)
            echo "[${FRANKENPHP_INSTALL_INDEX}] packaged service boot activation absent (${unit_file_state:-not-found})"
            ;;
    esac
}

frankenphp_install_apt_packaged_service_unmask_ensure() {
    local runtime_mask_target=""

    runtime_mask_target="$(readlink "$FRANKENPHP_APT_RUNTIME_MASK_PATH" 2>/dev/null)"
    if [ "$runtime_mask_target" = "/dev/null" ]; then
        $USE_SUDO systemctl unmask --runtime frankenphp.service >/dev/null 2>&1
    fi
    runtime_mask_target="$(readlink "$FRANKENPHP_APT_RUNTIME_MASK_PATH" 2>/dev/null)"
    if [ "$runtime_mask_target" = "/dev/null" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] packaged service runtime mask remains"
    else
        echo "[${FRANKENPHP_INSTALL_INDEX}] packaged service runtime mask cleared"
    fi
}

# Register the official deb repository (keyring + sources list), idempotent
# by file content.
frankenphp_install_apt_repo_ensure() {
    local key_candidate=""
    local key_present="no"
    local sources_present="no"

    key_candidate="$(mktemp "${TMPDIR:-/tmp}/frankenphp-apt-key.XXXXXX")"
    if [ -s "$FRANKENPHP_APT_KEY_PATH" ] \
        && grep -q '^-----BEGIN PGP PUBLIC KEY BLOCK-----$' "$FRANKENPHP_APT_KEY_PATH" 2>/dev/null; then
        key_present="yes"
    fi
    if [ -f "$FRANKENPHP_APT_SOURCES_FILE" ] \
        && [ "$(cat "$FRANKENPHP_APT_SOURCES_FILE" 2>/dev/null)" = "$FRANKENPHP_APT_REPO_LINE" ]; then
        sources_present="yes"
    fi

    if [ "$key_present" = "no" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] fetching official repo key: ${FRANKENPHP_APT_KEY_URL}"
        $USE_SUDO mkdir -p "$(dirname "$FRANKENPHP_APT_KEY_PATH")"
        curl -fsSL "$FRANKENPHP_APT_KEY_URL" -o "$key_candidate"
        if [ -s "$key_candidate" ] \
            && grep -q '^-----BEGIN PGP PUBLIC KEY BLOCK-----$' "$key_candidate" 2>/dev/null; then
            $USE_SUDO install -m 0644 "$key_candidate" "$FRANKENPHP_APT_KEY_PATH"
        fi
    fi
    rm -f "$key_candidate"
    if [ -s "$FRANKENPHP_APT_KEY_PATH" ] \
        && grep -q '^-----BEGIN PGP PUBLIC KEY BLOCK-----$' "$FRANKENPHP_APT_KEY_PATH" 2>/dev/null; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] repo key ready: ${FRANKENPHP_APT_KEY_PATH}"
    else
        echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] repo key missing: ${FRANKENPHP_APT_KEY_PATH}"
    fi

    if [ "$sources_present" = "no" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] adding official repo: ${FRANKENPHP_APT_SOURCES_FILE}"
        printf '%s\n' "$FRANKENPHP_APT_REPO_LINE" | $USE_SUDO tee "$FRANKENPHP_APT_SOURCES_FILE" >/dev/null
    fi
    if [ -f "$FRANKENPHP_APT_SOURCES_FILE" ] \
        && [ "$(cat "$FRANKENPHP_APT_SOURCES_FILE" 2>/dev/null)" = "$FRANKENPHP_APT_REPO_LINE" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] repo source ready: ${FRANKENPHP_APT_SOURCES_FILE}"
    else
        echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] repo source missing: ${FRANKENPHP_APT_SOURCES_FILE}"
    fi
}

frankenphp_install_apt_packages_ensure() {
    local package=""
    local packages_missing="no"
    local service_mask_ready=""

    service_mask_ready="$(frankenphp_install_apt_packaged_service_mask_ready)"

    for package in "${FRANKENPHP_APT_PACKAGES[@]}"; do
        if [ "$(frankenphp_install_apt_package_missing "$package")" = "yes" ]; then
            packages_missing="yes"
        fi
    done

    if [ "$packages_missing" = "yes" ] && [ -s "$FRANKENPHP_APT_KEY_PATH" ] \
        && [ -f "$FRANKENPHP_APT_SOURCES_FILE" ]; then
        $USE_SUDO apt-get update
    fi
    for package in "${FRANKENPHP_APT_PACKAGES[@]}"; do
        if [ "$(frankenphp_install_apt_package_missing "$package")" = "yes" ]; then
            if [ "$service_mask_ready" = "yes" ]; then
                echo "[${FRANKENPHP_INSTALL_INDEX}] installing missing package: ${package}"
                $USE_SUDO apt-get install -y "$package"
            else
                echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] package deferred because the vendor service mask is absent: ${package}"
            fi
        fi
        if [ "$(frankenphp_install_apt_package_missing "$package")" = "yes" ]; then
            echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] package remains missing: ${package}"
        else
            echo "[${FRANKENPHP_INSTALL_INDEX}] package ready: ${package}"
        fi
    done
}

frankenphp_install_apt() {
    echo "[${FRANKENPHP_INSTALL_INDEX}] FrankenPHP apt variant (official deb repo, PHP ${FRANKENPHP_APT_PHP_VERSION}):"
    echo "  - packages: ${FRANKENPHP_APT_PACKAGES[*]}"

    frankenphp_install_apt_repo_ensure
    frankenphp_install_apt_packaged_service_mask_ensure
    frankenphp_install_apt_packages_ensure
    frankenphp_install_apt_packaged_service_stop_ensure
    frankenphp_install_apt_packaged_service_unmask_ensure
    frankenphp_install_apt_packaged_service_disable_ensure
    frankenphp_install_apt_packaged_service_stop_ensure

    if [ "$(fm_variant_ready "$FRANKENPHP_INSTALL_MODE_APT")" = "yes" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] apt candidate ready: ${FRANKENPHP_APT_BINARY_PATH}"
    else
        echo "[${FRANKENPHP_INSTALL_INDEX}] [ERROR] apt candidate incomplete; active owner was not changed"
    fi
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_apt "$@"
fi
