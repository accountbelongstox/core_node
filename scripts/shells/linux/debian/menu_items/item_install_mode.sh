#!/bin/bash

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../common/install_item_runner.sh"

ITEM_KEY="INSTALL_MODE"
ITEM_TITLE="Installation Mode (full chain)"

install_item_main "$@"
