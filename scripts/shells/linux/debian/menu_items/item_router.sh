#!/bin/bash

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../common/install_item_runner.sh"

ITEM_KEY="INSTALL_NETWORK_ROUTER"
ITEM_TITLE="Network Router"
ITEM_STEPS=(
    "113_natgateway"
)

install_item_main "$@"
