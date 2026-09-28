#!/bin/bash

# Compile branch helper for 93_install_frankenphp. Fine-grained probe-
# driven convergence (no step-state layer): every fm_* primitive is
# self-probing and idempotent, logs its own outcome and never signals
# via exit codes - the pipeline re-probes file state instead. The
# owner record is written only by the central lifecycle after this candidate
# passes its independent readiness probe.

FRANKENPHP_INSTALL_COMPILE_INDEX="93-install-compile"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRANKENPHP_INSTALL_COMPILE_NAMESPACE="93_install_frankenphp"

source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
source "$SCRIPT_CURRENT_DIR/common_functions.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

frankenphp_install_compile() {
    # Candidate-only convergence: bootstrap discovery and the custom build do
    # not mutate owner state, runtime links, services or packages.
    fm_ensure_dnspod_module
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_compile "$@"
fi
