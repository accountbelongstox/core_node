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

# Certbot plane-disable (common area; companion of cert_selfheal_common.sh,
# called by 93_install_frankenphp.sh - the frankenphp plane runs its own ACME
# inside Caddy). DISABLES RENEWAL TIMERS AND RECORDS STATE ONLY: never
# uninstalls certbot, never touches /etc/letsencrypt - re-running
# 35_install_certbot.sh restores renewal at any time.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_INDEX="certbot-plane"

source "$SCRIPT_CURRENT_DIR/gvar_common.sh"

CERTBOT_UNITS="certbot-renewal.service certbot-renewal.timer certbot.service certbot.timer"
certbot_unit=""
certbot_load_state=""
certbot_active_state=""
certbot_enable_state=""

echo "[$SCRIPT_INDEX] Certbot plane-disable (idempotent, timers stop + record only)"

for certbot_unit in $CERTBOT_UNITS; do
    certbot_load_state="$(systemctl show "$certbot_unit" -p LoadState --value 2>/dev/null)"
    if [ -z "$certbot_load_state" ] || [ "$certbot_load_state" = "not-found" ]; then
        echo "[$SCRIPT_INDEX] No systemd unit $certbot_unit present"
        continue
    fi
    certbot_active_state="$(systemctl show "$certbot_unit" -p ActiveState --value 2>/dev/null)"
    if [ "$certbot_active_state" != "inactive" ] && [ "$certbot_active_state" != "failed" ]; then
        $USE_SUDO systemctl stop "$certbot_unit" >/dev/null 2>&1 || true
        certbot_active_state="$(systemctl show "$certbot_unit" -p ActiveState --value 2>/dev/null)"
    fi
    if [ "$certbot_active_state" != "inactive" ] && [ "$certbot_active_state" != "failed" ]; then
        echo "[$SCRIPT_INDEX] [WARN] $certbot_unit remains active"
    fi
    certbot_enable_state="$(systemctl show "$certbot_unit" -p UnitFileState --value 2>/dev/null)"
    case "$certbot_enable_state" in
        enabled|enabled-runtime|linked|linked-runtime)
            $USE_SUDO systemctl disable "$certbot_unit" >/dev/null 2>&1 || true
            certbot_enable_state="$(systemctl show "$certbot_unit" -p UnitFileState --value 2>/dev/null)"
            ;;
    esac
    case "$certbot_enable_state" in
        enabled|enabled-runtime|linked|linked-runtime)
            echo "[$SCRIPT_INDEX] [WARN] $certbot_unit remains enabled"
            ;;
        static)
            echo "[$SCRIPT_INDEX] $certbot_unit is static and inactive"
            ;;
        *)
            echo "[$SCRIPT_INDEX] $certbot_unit already disabled"
            ;;
    esac
done

set_global_var CERTBOT_PLANE_DISABLED "true" 'false'
echo "[$SCRIPT_INDEX] certbot plane-disabled (binary, venv and /etc/letsencrypt preserved)"
