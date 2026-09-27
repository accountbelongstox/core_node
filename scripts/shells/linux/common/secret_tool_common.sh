#!/bin/bash
# Secret password I/O shared by dd.sh, installers and gitput: hidden terminal
# input, and the node secret tools run with the password on stdin (never on a
# command line, where /proc/<pid>/cmdline exposes it to every local account).

# Source-once guard: repeated `source` is a no-op.
if [ "${SECRET_TOOL_COMMON_LOADED:-false}" = "true" ]; then
    return
fi
SECRET_TOOL_COMMON_LOADED="true"

SECRET_TOOL_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRET_TOOL_ROOT_DIR="$(cd "$SECRET_TOOL_COMMON_DIR/../../../.." && pwd)"
SECRET_PASSWORD_RUNNER_JS="$SECRET_TOOL_ROOT_DIR/scripts/encryption_tools/secret_password_runner.js"
# Placeholder the runner replaces with the stdin password (see the runner).
SECRET_PASSWORD_ARG="--password-stdin"

source "$SECRET_TOOL_COMMON_DIR/prompt_common.sh"

# secret_tool_run <password> <privilege-prefix|""> <node> <tool.js> [args...]
# Runs the tool through the password runner; args carry $SECRET_PASSWORD_ARG
# where the tool expects its password.
# Usage: secret_tool_run "$pw" "" "$node" "$enc_js" pwd "$SECRET_PASSWORD_ARG" "$out_dir"
secret_tool_run() {
    local password="$1"
    local privilege_prefix="$2"
    local node_bin="$3"

    shift 3
    if [ -n "$privilege_prefix" ]; then
        printf '%s' "$password" | "$privilege_prefix" "$node_bin" "$SECRET_PASSWORD_RUNNER_JS" "$@"
    else
        printf '%s' "$password" | "$node_bin" "$SECRET_PASSWORD_RUNNER_JS" "$@"
    fi
}

# secret_read_hidden VAR_NAME PROMPT
# Reads one line from the terminal with echo off, printing * per character.
# VAR_NAME is empty when no foreground terminal is available.
secret_read_hidden() {
    local __srh_var="$1"
    local __srh_prompt="$2"
    local __srh_value=""
    local __srh_char=""
    local __srh_old_stty=""
    local __srh_old_int_trap=""

    printf -v "$__srh_var" '%s' ""
    prompt_tty_foreground || return 0
    exec 3<> /dev/tty || return 0
    __srh_old_stty="$(stty -g <&3 2>/dev/null)"
    __srh_old_int_trap="$(trap -p INT)"
    # Ctrl-C must not leave the terminal without echo.
    trap 'stty echo </dev/tty 2>/dev/null; printf "\n" >/dev/tty; trap - INT; kill -INT $$' INT
    printf '%s' "$__srh_prompt" >&3
    stty -echo <&3 2>/dev/null
    while IFS= read -r -n1 __srh_char <&3; do
        case "$__srh_char" in
            ""|$'\n'|$'\r')
                break
                ;;
            $'\x7f'|$'\b')
                if [ -n "$__srh_value" ]; then
                    __srh_value="${__srh_value%?}"
                    printf '\b \b' >&3
                fi
                ;;
            *)
                __srh_value+="$__srh_char"
                printf '*' >&3
                ;;
        esac
    done
    printf '\n' >&3
    if [ -n "$__srh_old_stty" ]; then
        stty "$__srh_old_stty" <&3 2>/dev/null
    else
        stty echo <&3 2>/dev/null
    fi
    if [ -n "$__srh_old_int_trap" ]; then
        eval "$__srh_old_int_trap"
    else
        trap - INT
    fi
    exec 3>&-
    printf -v "$__srh_var" '%s' "$__srh_value"
}
