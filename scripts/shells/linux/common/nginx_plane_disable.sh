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

# Nginx plane-disable (common area; companion of nginx_manager.sh, called by
# 49_install_frankenphp.sh for the web-server plane mutual exclusion, usable
# standalone). DISABLES THE SERVICE AND RECORDS STATE ONLY: never uninstalls
# packages, never removes configs/sites/certificates - re-running
# 33_install_nginx.sh (or nginx_manager.sh) restores the plane at any time.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_INDEX="nginx-plane"

source "$SCRIPT_CURRENT_DIR/gvar_common.sh"

NGINX_UNIT="nginx.service"

echo "[$SCRIPT_INDEX] Nginx plane-disable (idempotent, service stop + record only)"

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "$NGINX_UNIT" >/dev/null 2>&1; then
    if systemctl is-active --quiet "$NGINX_UNIT"; then
        $USE_SUDO systemctl stop "$NGINX_UNIT" || echo "[$SCRIPT_INDEX] [WARN] nginx stop reported failure"
    else
        echo "[$SCRIPT_INDEX] nginx already inactive"
    fi
    if systemctl is-enabled --quiet "$NGINX_UNIT" 2>/dev/null; then
        $USE_SUDO systemctl disable "$NGINX_UNIT" || echo "[$SCRIPT_INDEX] [WARN] nginx disable reported failure"
    else
        echo "[$SCRIPT_INDEX] nginx already disabled"
    fi
else
    echo "[$SCRIPT_INDEX] No systemd nginx unit present (nothing to disable)"
fi

set_global_var NGINX_PLANE_DISABLED "true" 'false'
echo "[$SCRIPT_INDEX] nginx plane-disabled (packages, configs and certificates preserved)"
