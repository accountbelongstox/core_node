#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# FrankenPHP installation step now delegates all business logic to the common
# pipeline helper: mode selection, install mode dispatch, plane mutex handling,
# Caddyfile convergence and verification.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
COMMON_DIR="$(dirname "$PARENT_DIR_LEVEL_1")/common"
FRANKENPHP_PIPELINE="$COMMON_DIR/frankenphp_install_pipeline.sh"

source "$COMMON_DIR/gvar_common.sh"

if [ -f "$FRANKENPHP_PIPELINE" ]; then
    # shellcheck source=/dev/null
    source "$FRANKENPHP_PIPELINE"
    frankenphp_install_pipeline "$@"
else
    echo "[93] ERROR: pipeline script missing: $FRANKENPHP_PIPELINE"
    exit 1
fi
