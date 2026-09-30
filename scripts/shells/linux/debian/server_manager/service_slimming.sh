#!/bin/bash

# Service slimming manager: list, disable and re-enable the background
# services that dd.sh / the base image install but an API host does not need.
# Idempotent and state-driven (see common/service_slimming_common.sh).
#
# Usage:
#   bash service_slimming.sh scan [key]          report state + memory
#   bash service_slimming.sh prompt [key]        ask (default N) per service, then disable
#   bash service_slimming.sh disable <key...>    disable without asking
#   bash service_slimming.sh enable <key...>     enable + start again
#   bash service_slimming.sh keys                list catalog keys

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
COMMON_DIR="$PARENT_DIR_LEVEL_2/common"
COMMAND="${1:-scan}"
ENTRY=""
UNITS=""
KEY=""

source "$COMMON_DIR/service_slimming_common.sh"
if [ -f "$COMMON_DIR/prompt_common.sh" ]; then
    source "$COMMON_DIR/prompt_common.sh"
fi

shift || true

case "$COMMAND" in
    scan)
        svc_slim_scan "${1:-}"
        ;;
    keys)
        for ENTRY in "${SVC_SLIM_CATALOG[@]}"; do
            svc_slim_entry_field "$ENTRY" 1
            echo
        done
        ;;
    prompt)
        if [ -n "${1:-}" ]; then
            svc_slim_prompt_disable_key "$1"
        else
            svc_slim_prompt_all
        fi
        ;;
    disable|enable)
        if [ "$#" -eq 0 ]; then
            echo "Usage: $0 $COMMAND <key...>" >&2
            exit 1
        fi
        for KEY in "$@"; do
            ENTRY="$(svc_slim_find_entry "$KEY")"
            if [ -z "$ENTRY" ]; then
                echo "[svc-slim] unknown key: $KEY" >&2
                continue
            fi
            UNITS="$(svc_slim_entry_field "$ENTRY" 2)"
            if [ "$COMMAND" = "disable" ]; then
                svc_slim_disable_units "$UNITS"
            else
                svc_slim_enable_units "$UNITS"
            fi
        done
        ;;
    *)
        sed -n '3,12p' "${BASH_SOURCE[0]}"
        exit 1
        ;;
esac
