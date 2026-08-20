#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Stable Debian menu entry for the canonical cross-distribution lifecycle.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(cd "$SCRIPT_CURRENT_DIR/../../common" && pwd)"
FRANKENPHP_INSTALL_PIPELINE="${COMMON_DIR}/frankenphp_install_pipeline.sh"

source "$FRANKENPHP_INSTALL_PIPELINE"
frankenphp_install_pipeline "$@"
