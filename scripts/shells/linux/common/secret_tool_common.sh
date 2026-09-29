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
# Batch secret crypto (one process, one password, parallel key derivation).
SECRET_CRYPTO_JS="$SECRET_TOOL_ROOT_DIR/scripts/encryption_tools/secret_crypto.js"
SECRET_CRYPTO_RESULT_TAG="SECRET_CRYPTO"
SECRET_NODE_INSTALL_SCRIPT="$SECRET_TOOL_ROOT_DIR/scripts/shells/linux/debian/install_shells/17_install_node_toolchain_26.sh"
SECRET_NODE_BIN=""
SECRET_CRYPTO_DONE=()
SECRET_CRYPTO_SKIPPED=()
SECRET_CRYPTO_WRONG=()
SECRET_CRYPTO_FAILED=()

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

# Sets SECRET_NODE_BIN; when Node.js is missing, installs it once through the
# idempotent 17_install_node_toolchain_26.sh.
secret_ensure_node() {
    SECRET_NODE_BIN="${NODE_BIN:-}"
    [ -n "$SECRET_NODE_BIN" ] && [ -x "$SECRET_NODE_BIN" ] && return 0
    SECRET_NODE_BIN="$(resolve_tool_bin node 2>/dev/null || command -v node 2>/dev/null || true)"
    [ -n "$SECRET_NODE_BIN" ] && return 0
    echo "[SECRETS] Node.js not found; installing it with $SECRET_NODE_INSTALL_SCRIPT" >&2
    INSTALL_NODE=true bash "$SECRET_NODE_INSTALL_SCRIPT" >&2
    hash -r 2>/dev/null
    SECRET_NODE_BIN="$(resolve_tool_bin node 2>/dev/null || command -v node 2>/dev/null || true)"
}

# secret_read VAR_NAME KEY_NAME
# VAR_NAME = first non-empty line of the decrypted secret (empty when missing; never decrypts).
secret_read() {
    local __sr_var="$1"
    local __sr_key="$2"

    secret_ensure_node
    printf -v "$__sr_var" '%s' "$("$SECRET_NODE_BIN" "$SECRET_CRYPTO_JS" read "$__sr_key" 2>/dev/null)"
}

# secret_crypto_batch <password> <node|""> decrypt|encrypt|verify [OUT_DIR] [--force] SRC...
# An empty <node> resolves (and if needed installs) Node.js via secret_ensure_node.
# Runs secret_crypto.js once for every SRC and sorts the file names into
# SECRET_CRYPTO_DONE (decrypted/encrypted/verified), SECRET_CRYPTO_SKIPPED
# (already decrypted), SECRET_CRYPTO_WRONG (wrong password, nothing written)
# and SECRET_CRYPTO_FAILED (unreadable file or I/O error).
secret_crypto_batch() {
    local password="$1"
    local node_bin="$2"
    local command="$3"
    local line=""
    local tag=""
    local status=""
    local name=""

    shift 3
    if [ -z "$node_bin" ]; then
        secret_ensure_node
        node_bin="$SECRET_NODE_BIN"
    fi
    SECRET_CRYPTO_DONE=()
    SECRET_CRYPTO_SKIPPED=()
    SECRET_CRYPTO_WRONG=()
    SECRET_CRYPTO_FAILED=()
    while IFS=$'\t' read -r tag status name line; do
        [ "$tag" = "$SECRET_CRYPTO_RESULT_TAG" ] || continue
        case "$status" in
            decrypted|encrypted|verified) SECRET_CRYPTO_DONE+=("$name") ;;
            skipped_exists) SECRET_CRYPTO_SKIPPED+=("$name") ;;
            wrong_password) SECRET_CRYPTO_WRONG+=("$name") ;;
            *) SECRET_CRYPTO_FAILED+=("$name") ;;
        esac
    done < <(secret_tool_run "$password" "" "$node_bin" "$SECRET_CRYPTO_JS" "$command" "$SECRET_PASSWORD_ARG" "$@" 2>&1)
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
