#!/bin/bash

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../common/install_item_runner.sh"

ITEM_KEY="INSTALL_GITEA"
ITEM_TITLE="Gitea"
ITEM_STEPS=(
    "159_install_gitea"
)

install_item_main "$@"
