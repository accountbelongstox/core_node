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

FRANKENPHP_INSTALL_MODE_COMPILE="compile"
FRANKENPHP_INSTALL_MODE_GIT="git"
FRANKENPHP_INSTALL_MODE_APT="apt"
FRANKENPHP_INSTALL_MODE_PREBUILT="prebuilt"

FRANKENPHP_INSTALL_MODE_DEFAULT="$FRANKENPHP_INSTALL_MODE_COMPILE"
FRANKENPHP_INSTALL_MODE_MENU_COMPILE="1"
FRANKENPHP_INSTALL_MODE_MENU_APT="2"
FRANKENPHP_INSTALL_MODE_MENU_GIT="3"

FRANKENPHP_INSTALL_93_INDEX="93"
FRANKENPHP_INSTALL_PIPELINE_DEFAULT_NO_MUTEX="false"

FRANKENPHP_INSTALL_PIPELINE_INDEX="93-install"
FRANKENPHP_INSTALL_PIPELINE_COMPILE_INDEX="93-install-compile"
FRANKENPHP_INSTALL_PIPELINE_PREBUILT_INDEX="93-install-prebuilt"
FRANKENPHP_INSTALL_PIPELINE_SYSTEM_INDEX="93-install-system"
FRANKENPHP_INSTALL_PIPELINE_CLEANUP_COMPILE_INDEX="93-install-cleanup-compile"
FRANKENPHP_INSTALL_PIPELINE_CLEANUP_PREBUILT_INDEX="93-install-cleanup-prebuilt"
FRANKENPHP_INSTALL_PIPELINE_CLEANUP_SYSTEM_INDEX="93-install-cleanup-system"

FRANKENPHP_INSTALL_PIPELINE_COMPILE_SCRIPT_NAME="frankenphp_install_pipeline_compile.sh"
FRANKENPHP_INSTALL_PIPELINE_PREBUILT_SCRIPT_NAME="frankenphp_install_pipeline_prebuilt.sh"
FRANKENPHP_INSTALL_PIPELINE_SYSTEM_SCRIPT_NAME="frankenphp_install_apt.sh"
FRANKENPHP_INSTALL_PIPELINE_CLEANUP_COMPILE_SCRIPT_NAME="frankenphp_install_pipeline_cleanup_compile.sh"
FRANKENPHP_INSTALL_PIPELINE_CLEANUP_PREBUILT_SCRIPT_NAME="frankenphp_install_pipeline_cleanup_prebuilt.sh"
FRANKENPHP_INSTALL_PIPELINE_CLEANUP_SYSTEM_SCRIPT_NAME="frankenphp_install_pipeline_cleanup_apt.sh"

FRANKENPHP_INSTALL_RUNTIME_LINK_PATH="/usr/local/bin/frankenphp"

FRANKENPHP_APT_PACKAGES=("php-zts-dev" "php-zts-pgsql" "php-zts-pdo-pgsql")

frankenphp_install_mode_normalize() {
    local raw_mode=""
    local normalized_mode=""

    raw_mode="$1"
    case "$raw_mode" in
        "$FRANKENPHP_INSTALL_MODE_COMPILE"|$FRANKENPHP_INSTALL_MODE_MENU_COMPILE|compile|1)
            normalized_mode="$FRANKENPHP_INSTALL_MODE_COMPILE"
            ;;
        "$FRANKENPHP_INSTALL_MODE_APT"|$FRANKENPHP_INSTALL_MODE_MENU_APT|apt|2)
            normalized_mode="$FRANKENPHP_INSTALL_MODE_APT"
            ;;
        "$FRANKENPHP_INSTALL_MODE_PREBUILT"|$FRANKENPHP_INSTALL_MODE_GIT|$FRANKENPHP_INSTALL_MODE_MENU_GIT|git|3)
            normalized_mode="$FRANKENPHP_INSTALL_MODE_PREBUILT"
            ;;
        *)
            normalized_mode=""
            ;;
    esac
    printf '%s' "$normalized_mode"
}

frankenphp_install_mode_label() {
    local mode=""
    local label=""

    mode="$1"
    case "$mode" in
        "$FRANKENPHP_INSTALL_MODE_COMPILE")
            label="compile"
            ;;
        "$FRANKENPHP_INSTALL_MODE_APT")
            label="apt"
            ;;
        "$FRANKENPHP_INSTALL_MODE_GIT"|"$FRANKENPHP_INSTALL_MODE_PREBUILT")
            label="prebuilt"
            ;;
        *)
            label="unknown"
            ;;
    esac
    printf '%s' "$label"
}
