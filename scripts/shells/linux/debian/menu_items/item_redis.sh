#!/bin/bash

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../common/install_item_runner.sh"

ITEM_KEY="START_REDIS"
ITEM_TITLE="Redis"
ITEM_STEPS=(
    "73_install_redis"
)

install_item_main "$@"
