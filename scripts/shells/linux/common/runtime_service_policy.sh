#!/usr/bin/env bash

RUNTIME_SERVICE_POLICY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_ENVIRONMENT_SCRIPT="$RUNTIME_SERVICE_POLICY_DIR/runtime_environment.sh"
CORE_RUNTIME_PYCORE_SERVICE="pycore"
CORE_RUNTIME_LEGACY_PYCORE_SERVICE="pycore-module-caller"
RUNTIME_SERVICE_LOAD_STATE=""
RUNTIME_SERVICE_ACTIVE_STATE=""
RUNTIME_SERVICE_UNIT_FILE_STATE=""
RUNTIME_SERVICE_POLICY_READY=false
RUNTIME_SERVICE_POLICY_SUDO=""
RUNTIME_SERVICE_POLICY_UNIT=""
RUNTIME_SERVICE_POLICY_BLOCKED=false
CORE_RUNTIME_PYCORE_UNITS=("$CORE_RUNTIME_PYCORE_SERVICE" "$CORE_RUNTIME_LEGACY_PYCORE_SERVICE")

if [ -z "${IS_HEADLESS_SERVER+x}" ]; then
    source "$RUNTIME_ENVIRONMENT_SCRIPT"
fi

runtime_service_policy_resolve_sudo() {
    RUNTIME_SERVICE_POLICY_SUDO=""
    if [ "$(id -u)" -ne 0 ]; then
        if [ -n "${USE_SUDO:-}" ]; then
            RUNTIME_SERVICE_POLICY_SUDO="$USE_SUDO"
        elif command -v sudo >/dev/null 2>&1; then
            RUNTIME_SERVICE_POLICY_SUDO="sudo"
        fi
    fi
}

runtime_service_policy_read_unit() {
    RUNTIME_SERVICE_POLICY_UNIT="$1"
    RUNTIME_SERVICE_LOAD_STATE="not-found"
    RUNTIME_SERVICE_ACTIVE_STATE="inactive"
    RUNTIME_SERVICE_UNIT_FILE_STATE="disabled"
    if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
        RUNTIME_SERVICE_LOAD_STATE="$(systemctl show "$RUNTIME_SERVICE_POLICY_UNIT.service" --property=LoadState --value 2>/dev/null)"
        RUNTIME_SERVICE_ACTIVE_STATE="$(systemctl show "$RUNTIME_SERVICE_POLICY_UNIT.service" --property=ActiveState --value 2>/dev/null)"
        RUNTIME_SERVICE_UNIT_FILE_STATE="$(systemctl show "$RUNTIME_SERVICE_POLICY_UNIT.service" --property=UnitFileState --value 2>/dev/null)"
        [ -n "$RUNTIME_SERVICE_LOAD_STATE" ] || RUNTIME_SERVICE_LOAD_STATE="not-found"
        [ -n "$RUNTIME_SERVICE_ACTIVE_STATE" ] || RUNTIME_SERVICE_ACTIVE_STATE="inactive"
        [ -n "$RUNTIME_SERVICE_UNIT_FILE_STATE" ] || RUNTIME_SERVICE_UNIT_FILE_STATE="disabled"
    fi
}

runtime_service_policy_disable_unit() {
    RUNTIME_SERVICE_POLICY_UNIT="$1"
    RUNTIME_SERVICE_POLICY_READY=false
    runtime_service_policy_resolve_sudo
    runtime_service_policy_read_unit "$RUNTIME_SERVICE_POLICY_UNIT"

    case "$RUNTIME_SERVICE_ACTIVE_STATE" in
        active|activating|reloading)
            echo "[server-policy] Stopping $RUNTIME_SERVICE_POLICY_UNIT.service ..."
            $RUNTIME_SERVICE_POLICY_SUDO systemctl stop "$RUNTIME_SERVICE_POLICY_UNIT.service"
            ;;
    esac

    runtime_service_policy_read_unit "$RUNTIME_SERVICE_POLICY_UNIT"
    case "$RUNTIME_SERVICE_UNIT_FILE_STATE" in
        enabled|enabled-runtime|linked|linked-runtime)
            echo "[server-policy] Disabling $RUNTIME_SERVICE_POLICY_UNIT.service ..."
            $RUNTIME_SERVICE_POLICY_SUDO systemctl disable "$RUNTIME_SERVICE_POLICY_UNIT.service"
            ;;
    esac

    runtime_service_policy_read_unit "$RUNTIME_SERVICE_POLICY_UNIT"
    case "$RUNTIME_SERVICE_ACTIVE_STATE:$RUNTIME_SERVICE_UNIT_FILE_STATE" in
        active:*|activating:*|reloading:*|*:enabled|*:enabled-runtime|*:linked|*:linked-runtime)
            echo "[server-policy] $RUNTIME_SERVICE_POLICY_UNIT.service is not fully disabled."
            ;;
        *)
            RUNTIME_SERVICE_POLICY_READY=true
            echo "[server-policy] $RUNTIME_SERVICE_POLICY_UNIT.service is stopped and disabled."
            ;;
    esac
}

runtime_service_policy_classify_unit() {
    RUNTIME_SERVICE_POLICY_UNIT="$1"
    RUNTIME_SERVICE_POLICY_BLOCKED=false
    if [ "$IS_HEADLESS_SERVER" = true ]; then
        case "$RUNTIME_SERVICE_POLICY_UNIT" in
            "$CORE_RUNTIME_PYCORE_SERVICE"|"$CORE_RUNTIME_LEGACY_PYCORE_SERVICE")
                RUNTIME_SERVICE_POLICY_BLOCKED=true
                ;;
        esac
    fi
}

runtime_service_policy_converge_pycore() {
    RUNTIME_SERVICE_POLICY_READY=true
    if [ "$IS_HEADLESS_SERVER" = true ]; then
        for RUNTIME_SERVICE_POLICY_UNIT in "${CORE_RUNTIME_PYCORE_UNITS[@]}"; do
            runtime_service_policy_disable_unit "$RUNTIME_SERVICE_POLICY_UNIT"
        done
    fi
}

runtime_service_policy_converge_server() {
    RUNTIME_SERVICE_POLICY_READY=true
    if [ "$IS_HEADLESS_SERVER" = true ]; then
        runtime_service_policy_converge_pycore
    fi
}

export CORE_RUNTIME_PYCORE_SERVICE
export CORE_RUNTIME_LEGACY_PYCORE_SERVICE
