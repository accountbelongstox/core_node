#!/bin/bash
# Compatibility entry point for existing callers of the historical script name.

SCRIPT_NAME="17_install_node_24.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "$SCRIPT_DIR/17_install_node_toolchain_24.sh" "$@"
