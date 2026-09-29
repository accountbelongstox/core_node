#!/bin/bash
# Secret password I/O shared by dd.sh, installers and gitput: confirmed terminal
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
SECRET_PASSWORD_PROMPT_ATTEMPTS=3

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

# secret_prompt_password VAR_NAME LABEL
# Reads the password twice from the terminal, shown in plain text so a typo is
# visible, and retries on mismatch. VAR_NAME is empty when the input is empty
# (skip), the entries never match, or no foreground terminal is available.
secret_prompt_password() {
    local __spp_var="$1"
    local __spp_label="$2"
    local __spp_first=""
    local __spp_second=""
    local __spp_attempt=0

    printf -v "$__spp_var" '%s' ""
    prompt_tty_foreground || return 0
    while [ "$__spp_attempt" -lt "$SECRET_PASSWORD_PROMPT_ATTEMPTS" ]; do
        __spp_attempt=$((__spp_attempt + 1))
        printf '%s password (shown as typed, empty skips): ' "$__spp_label" >/dev/tty
        IFS= read -r __spp_first </dev/tty || return 0
        [ -n "$__spp_first" ] || return 0
        printf '%s password again: ' "$__spp_label" >/dev/tty
        IFS= read -r __spp_second </dev/tty || return 0
        if [ "$__spp_first" = "$__spp_second" ]; then
            printf -v "$__spp_var" '%s' "$__spp_first"
            return 0
        fi
        printf '\033[31m%s passwords do not match (%s/%s)\033[0m\n' "$__spp_label" "$__spp_attempt" "$SECRET_PASSWORD_PROMPT_ATTEMPTS" >/dev/tty
    done
}
