#!/bin/bash

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../common/install_item_runner.sh"

ITEM_KEY="CLOUD_PROVIDER"
ITEM_TITLE="Cloud Provider"
ITEM_STEPS=(
    "5_system_maintenance"
    "79_install_docker"
)

install_item_main "$@"
