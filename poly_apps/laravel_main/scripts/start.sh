#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

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
