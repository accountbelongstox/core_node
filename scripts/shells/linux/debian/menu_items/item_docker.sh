#!/bin/bash

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../common/install_item_runner.sh"

ITEM_KEY="START_DOCKER"
ITEM_TITLE="Docker"
ITEM_STEPS=(
    "79_install_docker"
    "83_docker-compose-finish"
)

install_item_main "$@"
