#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_MAIN="$SCRIPT_DIR/main.py"
PYTHON_BIN=""

GVAR_SCRIPT="$SCRIPT_DIR/../shells/linux/common/gvar_common.sh"
EXECUTION_KEY="UNIFIED_APP_MANAGER_EXECUTION"

if [ -f "$GVAR_SCRIPT" ]; then
    # shellcheck disable=SC1090
    . "$GVAR_SCRIPT"
else
    echo "[ERROR] Required gvar library not found: $GVAR_SCRIPT" >&2
    exit 1
fi

log() {
    local level="$1"
    local message="$2"
    case "$level" in
        info) printf '[INFO] %s
' "$message" ;;
        ok) printf '[OK] %s
' "$message" ;;
        warn) printf '[WARN] %s
' "$message" ;;
        err) printf '[ERROR] %s
' "$message" ;;
        *) printf '[LOG] %s
' "$message" ;;
    esac
}

select_python() {
    if command -v python3 >/dev/null 2>&1; then
        PYTHON_BIN="python3"
    elif command -v python >/dev/null 2>&1; then
        PYTHON_BIN="python"
    else
        log err "Python is required but was not found in PATH."
        return 1
    fi
    log info "Using Python interpreter: $(command -v "$PYTHON_BIN")"
}

launch_script_background() {
    local script_path="$1"

    if [ ! -f "$script_path" ]; then
        log warn "Script not found: $script_path"
        return
    fi

    log info "Launching script in background: $script_path"
    bash "$script_path" &
}

launch_command_background() {
    local command="$1"

    if [ -z "$command" ]; then
        return
    fi

    log info "Running command in background: $command"
    bash -lc "$command" &
}

dispatch_execution_requests() {
    local payload_file="$1"
    local python_bin="$PYTHON_BIN"
    local -a execution_items=()

    if [ ! -f "$payload_file" ]; then
        log warn "Execution payload not found: $payload_file"
        return 0
    fi

    mapfile -t execution_items < <("$python_bin" - "$payload_file" <<'PY'
import json
import sys
from pathlib import Path

def main(path_str: str) -> None:
    payload_path = Path(path_str)
    if not payload_path.exists():
        return
    text = payload_path.read_text(encoding="utf-8").strip()
    if not text:
        return

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        print("error\tFAILED_TO_PARSE_EXECUTION_PAYLOAD")
        return

    action = data.get("action")
    if action:
        print("meta\tACTION=" + str(action))

    dispatch = data.get("dispatch") or {}
    params = data.get("params") or {}

    scripts = []
    commands = []

    if isinstance(dispatch, dict):
        scripts.extend(dispatch.get("scripts", []) or [])
        commands.extend(dispatch.get("commands", []) or [])

    if isinstance(params, dict):
        command = params.get("command")
        if isinstance(command, str) and command.strip():
            commands.append(command)
        extra_commands = params.get("commands")
        if isinstance(extra_commands, list):
            for item in extra_commands:
                if isinstance(item, dict):
                    value = item.get("command")
                else:
                    value = item
                if isinstance(value, str) and value.strip():
                    commands.append(value)
        extra_scripts = params.get("scripts")
        if isinstance(extra_scripts, list):
            for entry in extra_scripts:
                if isinstance(entry, str) and entry.strip():
                    scripts.append(entry)

    script_path = data.get("script_path")
    if isinstance(script_path, str) and script_path.strip():
        scripts.append(script_path)

    for path in scripts:
        if isinstance(path, str) and path.strip():
            print("script\t" + path)

    for cmd in commands:
        if isinstance(cmd, str) and cmd.strip():
            print("command\t" + cmd)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        main(sys.argv[1])
PY
    )

    local entry=""
    local action=""

    for entry in "${execution_items[@]}"; do
        local kind="${entry%%$'\t'*}"
        local value="${entry#*$'\t'}"

        case "$kind" in
            meta)
                if [[ "$value" == ACTION=* ]]; then
                    action="${value#ACTION=}"
                fi
                ;;
            script)
                launch_script_background "$value"
                ;;
            command)
                launch_command_background "$value"
                ;;
            warn)
                log warn "$value"
                ;;
            error|err)
                log err "$value"
                ;;
        esac
    done

    if [ -n "$action" ]; then
        log info "Dispatched action: $action"
    fi

    return 0
}

run_python_manager() {
    local payload_file="$GLOBAL_VAR_DIR/$EXECUTION_KEY"

    rm -f "$payload_file" 2>/dev/null || true

    UNIFIED_MANAGER_EXECUTION_KEY="$EXECUTION_KEY" "$PYTHON_BIN" -u "$PYTHON_MAIN"
    local status=$?

    if [ $status -ne 0 ]; then
        log err "Python manager exited with status $status"
        return 1
    fi

    if [ ! -f "$payload_file" ]; then
        log info "No execution instructions produced by Python manager"
        return 0
    fi

    dispatch_execution_requests "$payload_file"
    rm -f "$payload_file" 2>/dev/null || true

    return 0
}

main_loop() {
    if [ ! -f "$PYTHON_MAIN" ]; then
        log err "Python entry point not found: $PYTHON_MAIN"
        return 1
    fi

    select_python || return 1

    log info "Unified Manager (Python Integration Version)"
    printf '\n'

    while true; do
        if ! run_python_manager; then
            break
        fi

        printf '\n'
        read -r -p "Continue with Unified Manager? (Y/n) " answer || break
        if [[ $answer =~ ^[Nn] ]]; then
            break
        fi
        printf '\n'
    done

    log info "Unified Manager session ended"
}

main_loop "$@"
