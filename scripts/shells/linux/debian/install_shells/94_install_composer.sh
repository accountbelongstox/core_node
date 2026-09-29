#!/bin/bash
SCRIPT_INDEX="94"

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(cd "$SCRIPT_CURRENT_DIR/../../common" && pwd)"
COMPOSER_INSTALL_COMMON="$COMMON_DIR/composer_install_common.sh"
WEB_ACCESS_COMMON="$COMMON_DIR/web_access_common.sh"

source "$WEB_ACCESS_COMMON"
source "$COMPOSER_INSTALL_COMMON"
web_access_config_ensure
composer_install_ensure "$@"
