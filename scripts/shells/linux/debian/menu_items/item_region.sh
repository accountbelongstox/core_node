#!/bin/bash

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../common/install_item_runner.sh"

ITEM_KEY="SELECTED_REGION"
ITEM_TITLE="Region"
ITEM_STEPS=(
    "5_system_maintenance"
    "9_fix_dns"
    "13_install_default_python"
    "17_install_node_toolchain_26"
    "37_ensure_pnpm_packages"
    "39_ensure_npmrc"
    "59_install_flutter"
    "79_install_docker"
    "91_install_golang"
    "92_install_java"
    "97_install_tailscale"
    "187_install_android_sdk"
)

install_item_main "$@"
