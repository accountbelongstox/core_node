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

# Compile runner for 93_install_frankenphp:
# keep pipeline orchestration as the single orchestrator and print PostgreSQL
# extension support only for compiled FrankenPHP.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_CURRENT_DIR/frankenphp_install_modes.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

source "$SCRIPT_CURRENT_DIR/frankenphp_install_compile.sh"

frankenphp_install_pipeline_compile() {
    local binary=""
    local pgsql_support=""

    fm_variant_set "$FRANKENPHP_INSTALL_MODE_COMPILE"
    fm_unlink_frankenphp_runtime
    frankenphp_install_compile

    binary="$(fm_resolve_binary_path "$FRANKENPHP_COMPILED_BINARY_PATH")"
    if [ -n "$binary" ]; then
        if [ "$(fm_embedded_extension_loaded "$binary" "pgsql")" = "yes" ] \
            && [ "$(fm_embedded_extension_loaded "$binary" "pdo_pgsql")" = "yes" ]; then
            pgsql_support="yes"
        else
            pgsql_support="no"
        fi
        echo "[${FRANKENPHP_INSTALL_PIPELINE_COMPILE_INDEX}] [VERIFY] compiled frankenphp PostgreSQL support: ${pgsql_support} (binary: ${binary})"
    else
        echo "[${FRANKENPHP_INSTALL_PIPELINE_COMPILE_INDEX}] [VERIFY] compiled frankenphp PostgreSQL support: unknown (compiled binary missing)"
    fi
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_pipeline_compile "$@"
fi
