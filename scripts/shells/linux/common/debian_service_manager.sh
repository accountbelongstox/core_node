#!/bin/bash

DEBIAN_SERVICE_MANAGER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$DEBIAN_SERVICE_MANAGER_DIR/systemd_service_manager.sh"

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    source "$DEBIAN_SERVICE_MANAGER_DIR/systemd_service_cli.sh"
    systemd_service_cli_main "$@"
fi
