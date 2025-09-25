#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_MAIN="$SCRIPT_DIR/main.py"
PYTHON_BIN=""

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

trim() {
    local value="$1"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
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

run_python_manager() {
    local python_output=""
    if ! python_output="$("$PYTHON_BIN" "$PYTHON_MAIN" 2>&1)"; then
        local status=$?
        log err "Python script execution failed with exit code $status"
        if [ -n "$python_output" ]; then
            printf 'Python output:\n'
            while IFS= read -r line; do
                printf '  %s\n' "$line"
            done <<< "$python_output"
        fi
        return 1
    fi

    local result_path=""
    local line=""
    while IFS= read -r line; do
        if [[ $line =~ ^RESULT_PATH:(.+)$ ]]; then
            result_path="$(trim "${BASH_REMATCH[1]}")"
            continue
        fi
        printf '%s\n' "$line"
    done <<< "$python_output"

    if [ -z "$result_path" ]; then
        return 1
    fi

    execute_result_script "$result_path"
}

execute_result_script() {
    local target="$1"
    if [ ! -e "$target" ]; then
        log err "Script not found: $target"
        return 1
    fi

    log info "Executing script: $target"
    local extension="${target##*.}"

    case "$extension" in
        sh)
            bash "$target"
            ;;
        ps1)
            if command -v pwsh >/dev/null 2>&1; then
                pwsh -NoProfile -ExecutionPolicy Bypass -File "$target"
            elif command -v powershell >/dev/null 2>&1; then
                powershell -NoProfile -ExecutionPolicy Bypass -File "$target"
            else
                log warn "PowerShell not available. Cannot execute $target"
                return 1
            fi
            ;;
        bat|cmd)
            log warn "Cannot execute .$extension files on this platform."
            return 1
            ;;
        *)
            bash "$target"
            ;;
    esac

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
