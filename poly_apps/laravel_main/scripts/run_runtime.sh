#!/bin/bash

# SYNC CONTRACT: this is the per-app instance; the canonical plane branches
# are
#   scripts/shells/linux/debian/debian_com/laravel_runtime_frankenphp.sh
#   scripts/shells/linux/debian/debian_com/laravel_runtime_nginx.sh
# selected by the shared web_server_plane constant (gvar_common.sh) - the
# same dispatch 175_laravel_main_start.sh and the plane-aware laravel
# service perform. Change the branches and this delegate together.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LINUX_COMMON_DIR="${SCRIPT_DIR}/../../../scripts/shells/linux/common"
DEBIAN_COM_DIR="${SCRIPT_DIR}/../../../scripts/shells/linux/debian/debian_com"
PHP_BIN="${PHP_BIN:-$(command -v php)}"
WORKERS="${WORKERS:-4}"
TASK_WORKERS="${TASK_WORKERS:-4}"
OCTANE_WATCH="${OCTANE_WATCH:-0}"
OCTANE_POLL="${OCTANE_POLL:-0}"
RUNTIME_SCRIPT=""

# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/gvar_common.sh"

if [ "$(web_server_plane)" = "frankenphp" ]; then
    RUNTIME_SCRIPT="$DEBIAN_COM_DIR/laravel_runtime_frankenphp.sh"
else
    RUNTIME_SCRIPT="$DEBIAN_COM_DIR/laravel_runtime_nginx.sh"
fi

exec env PHP_BIN="$PHP_BIN" WORKERS="$WORKERS" TASK_WORKERS="$TASK_WORKERS" \
    OCTANE_WATCH="$OCTANE_WATCH" OCTANE_POLL="$OCTANE_POLL" \
    LARAVEL_DIR="$LARAVEL_DIR" /bin/bash "$RUNTIME_SCRIPT"
