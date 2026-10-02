#!/bin/bash

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../common/install_item_runner.sh"

ITEM_KEY="DATABASE_ENGINE"
ITEM_TITLE="Database"
ITEM_STEPS=(
    "75_install_postgresql"
    "85_install_mysql"
)

install_item_main "$@"
