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

# FrankenPHP plane-disable (common area; companion of frankenphp_manager.sh,
# called by 33_install_nginx.sh / 35_install_certbot.sh for the web-server
# plane mutual exclusion). DISABLES THE OCTANE FRANKENPHP SERVICE AND RECORDS
# STATE ONLY: never deletes the binary, the Caddyfile or the Mercure keys -
# re-running 93_install_frankenphp.sh (or the 132 frankenphp branch)
# restores the plane.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_INDEX="frankenphp-plane"

source "$SCRIPT_CURRENT_DIR/gvar_common.sh"

FRANKENPHP_UNIT_PREFIX="octane-frankenphp"

echo "[$SCRIPT_INDEX] FrankenPHP plane-disable (idempotent, service stop + record only)"

if command -v systemctl >/dev/null 2>&1; then
    for frankenphp_unit in $(systemctl list-unit-files --type=service --no-legend "${FRANKENPHP_UNIT_PREFIX}-*" 2>/dev/null | awk '{print $1}'); do
        if systemctl is-active --quiet "$frankenphp_unit"; then
            $USE_SUDO systemctl stop "$frankenphp_unit" || echo "[$SCRIPT_INDEX] [WARN] $frankenphp_unit stop reported failure"
        fi
        if systemctl is-enabled --quiet "$frankenphp_unit" 2>/dev/null; then
            $USE_SUDO systemctl disable "$frankenphp_unit" || echo "[$SCRIPT_INDEX] [WARN] $frankenphp_unit disable reported failure"
        else
            echo "[$SCRIPT_INDEX] $frankenphp_unit already disabled"
        fi
    done
fi

if pgrep -f "octane:start.*frankenphp" >/dev/null 2>&1; then
    $USE_SUDO pkill -f "octane:start.*frankenphp" || echo "[$SCRIPT_INDEX] [WARN] stray octane frankenphp process termination reported failure"
else
    echo "[$SCRIPT_INDEX] No running octane frankenphp process"
fi

set_global_var FRANKENPHP_PLANE_DISABLED "true" 'false'
echo "[$SCRIPT_INDEX] frankenphp plane-disabled (binary, Caddyfile and Mercure keys preserved)"
