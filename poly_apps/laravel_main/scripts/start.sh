#!/bin/bash

# Thin delegator. The canonical laravel_main start logic (toolchain ensure,
# SSH, plane-specific TLS/domain setup, and Octane runtime) lives in the
# installer chain:
#   scripts/shells/linux/debian/install_shells/175_laravel_main_start.sh
# Keeping the implementation there removes the old reverse reference where an
# app script reached into the infra installers. All arguments pass through.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
POLY_APPS_DIR="$(cd "${LARAVEL_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${POLY_APPS_DIR}/.." && pwd)"
CANONICAL_START="${REPO_ROOT}/scripts/shells/linux/debian/install_shells/175_laravel_main_start.sh"

exec bash "$CANONICAL_START" "$@"
