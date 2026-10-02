#!/bin/bash

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../common/install_item_runner.sh"

ITEM_KEY="MESH_VPN_PROVIDER"
ITEM_TITLE="Mesh VPN"
ITEM_STEPS=(
    "97_install_tailscale"
    "98_install_headscale_server"
)

install_item_main "$@"
