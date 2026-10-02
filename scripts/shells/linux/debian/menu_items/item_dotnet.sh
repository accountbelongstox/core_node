#!/bin/bash

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../common/install_item_runner.sh"

ITEM_KEY="START_DOTNET"
ITEM_TITLE=".NET SDK"
ITEM_STEPS=(
    "57_install_dotnet"
)

install_item_main "$@"
