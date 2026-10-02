#!/bin/bash

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../common/install_item_runner.sh"

ITEM_KEY="START_WEB_SERVER"
ITEM_TITLE="Web Server"
ITEM_STEPS=(
    "33_install_nginx"
    "35_install_certbot"
    "93_install_php"
    "175_laravel_main_start"
)

install_item_main "$@"
