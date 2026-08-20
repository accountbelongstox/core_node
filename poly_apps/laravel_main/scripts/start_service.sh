#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
CANONICAL_SERVICE_LAUNCHER="${REPO_ROOT}/scripts/shells/linux/debian/debian_com/laravel_start_service.sh"

LARAVEL_DIR="$LARAVEL_DIR" exec /bin/bash "$CANONICAL_SERVICE_LAUNCHER" "$@"
