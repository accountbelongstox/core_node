#!/bin/bash
SCRIPT_INDEX="93"

# Stable Debian menu entry for the canonical cross-distribution lifecycle.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(cd "$SCRIPT_CURRENT_DIR/../../common" && pwd)"
FRANKENPHP_INSTALL_PIPELINE="${COMMON_DIR}/frankenphp_install_pipeline.sh"
WEB_ACCESS_COMMON="${COMMON_DIR}/web_access_common.sh"
PHP_LINK_COMMON="${COMMON_DIR}/php_link_common.sh"

source "$WEB_ACCESS_COMMON"
source "$FRANKENPHP_INSTALL_PIPELINE"
source "$PHP_LINK_COMMON"
web_access_config_ensure
frankenphp_install_pipeline "$@"
fm_php_ini_ensure
# Idempotent self-repair: converge on ONE php link even when the whole
# install pipeline was skipped (already installed).
ensure_single_php_link || true
