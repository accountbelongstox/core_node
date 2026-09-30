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
SECRET_TOOL_ENCRYPTED_DIR="$SECRET_TOOL_ROOT_DIR/.secret_keys/already_encrypted"
# Tracked list of secrets encrypted with a password other than the main one
# (one name per line, '#' comments). A split decrypt records them; dd re-encrypts
# them from .secret_ignore with the main password and drops them from the list.
# Mirrors $Global:SECRET_MISMATCH_LIST in win_common/GlobalVarStoreCommon.ps1.
SECRET_MISMATCH_LIST="$SECRET_TOOL_ROOT_DIR/.secret_keys/password_mismatch.list"
SECRET_MISMATCH_HEADER="# Secrets encrypted with a different password; dd re-encrypts them with the main password"
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

# Prints the listed mismatched secret names whose encrypted copy still exists.
secret_mismatch_names() {
    local name=""

    [ -f "$SECRET_MISMATCH_LIST" ] || return 0
    while IFS= read -r name || [ -n "$name" ]; do
        name="${name%$'\r'}"
        name="${name#"${name%%[![:space:]]*}"}"
        name="${name%"${name##*[![:space:]]}"}"
        [ -n "$name" ] && [ "${name:0:1}" != "#" ] || continue
        [ -f "$SECRET_TOOL_ENCRYPTED_DIR/$name.js" ] && printf '%s\n' "$name"
    done < "$SECRET_MISMATCH_LIST"
}

# secret_mismatch_contains NAME -> success when NAME is listed.
secret_mismatch_contains() {
    secret_mismatch_names | grep -qxF -- "$1"
}

# secret_mismatch_write NAME... -> rewrites the list (removed when empty).
secret_mismatch_write() {
    local name=""

    if [ "$#" -eq 0 ]; then
        rm -f "$SECRET_MISMATCH_LIST"
        return 0
    fi
    {
        printf '%s\n' "$SECRET_MISMATCH_HEADER"
        for name in "$@"; do
            printf '%s\n' "$name"
        done
    } > "$SECRET_MISMATCH_LIST"
}

# secret_mismatch_record NAME... -> adds names (deduplicated, sorted).
secret_mismatch_record() {
    local names=()

    [ "$#" -gt 0 ] || return 0
    mapfile -t names < <({ secret_mismatch_names; printf '%s\n' "$@"; } | sort -u)
    secret_mismatch_write "${names[@]}"
}

# secret_mismatch_forget NAME... -> removes names from the list.
secret_mismatch_forget() {
    local names=()
    local drop=""

    drop="$(printf '%s\n' "$@")"
    mapfile -t names < <(secret_mismatch_names | grep -vxF -- "$drop")
    secret_mismatch_write "${names[@]}"
}

# secret_record_password_split
# Call right after a secret_crypto_batch decrypt: when one password opened some
# secrets and not others, the rejected ones were encrypted with a second password.
secret_record_password_split() {
    local name=""

    [ "${#SECRET_CRYPTO_DONE[@]}" -gt 0 ] && [ "${#SECRET_CRYPTO_WRONG[@]}" -gt 0 ] || return 0
    secret_mismatch_record "${SECRET_CRYPTO_WRONG[@]}"
    echo -e "\033[33m[SECRETS] ${#SECRET_CRYPTO_WRONG[@]} secret(s) use a different password than the other ${#SECRET_CRYPTO_DONE[@]}; recorded in ${SECRET_MISMATCH_LIST##*/}:\033[0m"
    for name in "${SECRET_CRYPTO_WRONG[@]}"; do
        echo -e "\033[33m  - $name\033[0m"
    done
    echo -e "\033[33m[SECRETS] On a host holding their plaintext, dd offers to re-encrypt them with the main password\033[0m"
}

# secret_reference_file [EXCLUDED_NAME...]
# Prints an encrypted secret that carries the main password: never a listed
# mismatched secret nor an excluded one (the file about to be replaced).
secret_reference_file() {
    local file=""
    local name=""
    local mismatched=""

    mismatched="$(secret_mismatch_names)"
    for file in "$SECRET_TOOL_ENCRYPTED_DIR"/*.js; do
        [ -f "$file" ] || continue
        name="${file##*/}"
        name="${name%.js}"
        printf '%s\n' "$@" | grep -qxF -- "$name" && continue
        [ -n "$mismatched" ] && printf '%s\n' "$mismatched" | grep -qxF -- "$name" && continue
        printf '%s' "$file"
        return 0
    done
}

# secret_password_is_main PASSWORD NODE [EXCLUDED_NAME...]
# Success when PASSWORD opens the reference secret (or no reference exists yet).
# Sets SECRET_REFERENCE_NAME to the checked secret for messages.
SECRET_REFERENCE_NAME=""
secret_password_is_main() {
    local password="$1"
    local node_bin="$2"
    local reference=""

    shift 2
    reference="$(secret_reference_file "$@")"
    SECRET_REFERENCE_NAME="${reference##*/}"
    [ -n "$reference" ] || return 0
    secret_crypto_batch "$password" "$node_bin" verify "$reference"
    [ "${#SECRET_CRYPTO_DONE[@]}" -gt 0 ]
}

# secret_confirm_main_password VAR_NAME NODE LABEL [EXCLUDED_NAME...]
# Guard before encrypting: a password that does not open the reference secret
# would start a second password. Asks (default No); a refusal empties VAR_NAME.
secret_confirm_main_password() {
    local __scmp_var="$1"
    local __scmp_node="$2"
    local __scmp_label="$3"
    local __scmp_answer=""

    shift 3
    [ -n "${!__scmp_var}" ] || return 0
    secret_password_is_main "${!__scmp_var}" "$__scmp_node" "$@" && return 0
    echo -e "\033[31m$__scmp_label This password does not decrypt $SECRET_REFERENCE_NAME: encrypting with it would create a second secret password\033[0m"
    prompt_read_default __scmp_answer "n" 120 "Encrypt with this different password anyway? [y/N]: "
    [[ "$__scmp_answer" =~ ^[Yy] ]] && return 0
    printf -v "$__scmp_var" '%s' ""
    echo -e "\033[33m$__scmp_label Encryption cancelled; use the main secret password\033[0m"
}
