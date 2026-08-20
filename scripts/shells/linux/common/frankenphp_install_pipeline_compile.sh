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

# Compile candidate preparer for the central 93 lifecycle.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_CURRENT_DIR/frankenphp_install_modes.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_install_apt.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_install_compile.sh"

frankenphp_install_pipeline_compile() {
    local binary=""
    local bootstrap_binary=""
    local service_mask_ready=""
    local pgsql_support=""

    # The first static build may need the official installer as metadata
    # bootstrap. Keep its packaged service activation fenced exactly like the
    # apt candidate flow; the central lifecycle decides package retirement.
    frankenphp_install_apt_packaged_service_mask_ensure
    service_mask_ready="$(frankenphp_install_apt_packaged_service_mask_ready)"
    bootstrap_binary="$(fm_get_bootstrap_binary)"
    if [ "$service_mask_ready" = "yes" ] || [ "$(fm_binary_usable "$bootstrap_binary")" = "yes" ]; then
        frankenphp_install_compile
    else
        echo "[${FRANKENPHP_INSTALL_PIPELINE_COMPILE_INDEX}] [WARN] compile preparation deferred: no bootstrap binary and vendor service mask absent"
    fi
    frankenphp_install_apt_packaged_service_stop_ensure
    frankenphp_install_apt_packaged_service_unmask_ensure
    frankenphp_install_apt_packaged_service_disable_ensure
    frankenphp_install_apt_packaged_service_stop_ensure

    binary="$(fm_variant_prepared_binary "$FRANKENPHP_INSTALL_MODE_COMPILE")"
    if [ -n "$binary" ]; then
        if [ "$(fm_embedded_extension_loaded "$binary" "pgsql")" = "yes" ] \
            && [ "$(fm_embedded_extension_loaded "$binary" "pdo_pgsql")" = "yes" ]; then
            pgsql_support="yes"
        else
            pgsql_support="no"
        fi
        echo "[${FRANKENPHP_INSTALL_PIPELINE_COMPILE_INDEX}] [VERIFY] compiled candidate PostgreSQL support: ${pgsql_support} (binary: ${binary})"
    else
        echo "[${FRANKENPHP_INSTALL_PIPELINE_COMPILE_INDEX}] [VERIFY] compiled candidate PostgreSQL support: unknown (compiled binary missing)"
    fi
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_pipeline_compile "$@"
fi
