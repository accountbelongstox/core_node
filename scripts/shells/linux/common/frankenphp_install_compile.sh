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

# Compile branch helper for 93_install_frankenphp.
# Uses the existing fm_install / fm_ensure_dnspod_module flow so behavior is kept
# identical to the original dedicated FrankenPHP step: official installer +
# official static rebuild path for dnspod.

FRANKENPHP_INSTALL_COMPILE_INDEX="93-install-compile"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRANKENPHP_INSTALL_COMPILE_NAMESPACE="93_install_frankenphp"

source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
source "$SCRIPT_CURRENT_DIR/common_functions.sh"
source "$SCRIPT_CURRENT_DIR/step_state.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

frankenphp_install_compile_init() {
    if [ -z "$FRANKENPHP_INSTALL_COMPILE_NAMESPACE" ]; then
        FRANKENPHP_INSTALL_COMPILE_NAMESPACE="93_install_frankenphp"
    fi
}

frankenphp_install_compile_mode() {
    echo "compile"
}

frankenphp_install_compile_binary_install() {
    fm_install
}

frankenphp_install_compile_link_shim() {
    fm_ensure_local_bin_link
    fm_ensure_php_cli_shim
}

frankenphp_install_compile_dnspod() {
    fm_ensure_dnspod_module
}

frankenphp_install_compile_finalize() {
    fm_store_info
}

frankenphp_install_compile() {
    # State-true fingerprints: a step re-runs whenever the underlying binary
    # state changed (version / link / module presence), so a prebuilt binary
    # installed in between can never leave a stale "satisfied" record.
    local install_fingerprint="compile-$(fm_version_tag 2>/dev/null)"
    local link_fingerprint="shims-$(readlink -f "$(fm_get_binary)" 2>/dev/null)"
    local dnspod_fingerprint="dnspod-$(fm_version_tag 2>/dev/null)-$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE" >/dev/null 2>&1 && echo embedded || echo missing)"

    frankenphp_install_compile_init

    step_run "$FRANKENPHP_INSTALL_COMPILE_NAMESPACE" "binary-install" "$install_fingerprint" \
        frankenphp_install_compile_binary_install

    step_run "$FRANKENPHP_INSTALL_COMPILE_NAMESPACE" "binary-shims" "$link_fingerprint" \
        frankenphp_install_compile_link_shim

    # Keep the same behavior as the original: rebuild for dnspod but do not
    # abort the whole flow when the rebuild step is deferred.
    step_run "$FRANKENPHP_INSTALL_COMPILE_NAMESPACE" "dnspod-module" "$dnspod_fingerprint" \
        frankenphp_install_compile_dnspod

    frankenphp_install_compile_finalize
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_compile "$@"
fi
