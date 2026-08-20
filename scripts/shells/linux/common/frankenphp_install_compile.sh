#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development process
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

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
