#!/usr/bin/env bash
# notebook_runtime.sh - hosted notebook platforms (Google Colab, Kaggle) for pyservice.
#
# Sourced by pyservice_entry.sh when a platform token (colab | kaggle) is given.
# A notebook VM is ephemeral and reachable only outbound, so pyservice runs there
# as the outbound-only Relay device agent (mode 2) against Laravel, and every
# tree that must survive the VM lives under ONE persist root:
#   <persist>/core_node        CORE_NODE_DATA_DIR (config incl. the Relay device
#                              identity, user data, installer state)
#   <persist>/cache            shared model / pip cache ($LEGACY_CORE_NODE_DATA_DIR/cache)
#   <persist>/toolchain/<name> uv / npm package caches
# Secrets come from .secret_keys/already_encrypted, decrypted in one batch with
# one password ($NOTEBOOK_PASSWORD_ENV, else a terminal prompt). The Relay device
# identity is itself an encrypted secret ($NOTEBOOK_RELAY_IDENTITY_SECRET), so a
# fresh VM without the persist root still reconnects as the already-claimed device.

if [ "${NOTEBOOK_RUNTIME_LOADED:-false}" = "true" ]; then
    return
fi
NOTEBOOK_RUNTIME_LOADED="true"

# ---- variable declarations ----
NOTEBOOK_RUNTIME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTEBOOK_REPO_ROOT="$(cd "$NOTEBOOK_RUNTIME_DIR/../../../.." && pwd)"
NOTEBOOK_PLATFORMS=(colab kaggle)
NOTEBOOK_PLATFORM="${NOTEBOOK_PLATFORM:-}"
NOTEBOOK_PERSIST_DIR="${NOTEBOOK_PERSIST_DIR:-}"
NOTEBOOK_PERSIST_NAME="core_node_notebook"
NOTEBOOK_PERSIST_EPHEMERAL=false
NOTEBOOK_COLAB_DRIVE_DIR="/content/drive/MyDrive"
NOTEBOOK_COLAB_LOCAL_DIR="/content"
NOTEBOOK_KAGGLE_WORKING_DIR="/kaggle/working"
NOTEBOOK_SECRET_DIR="$NOTEBOOK_REPO_ROOT/.secret_keys"
NOTEBOOK_ENCRYPTED_DIR="$NOTEBOOK_SECRET_DIR/already_encrypted"
NOTEBOOK_RAW_DIR="$NOTEBOOK_SECRET_DIR/.secret_ignore"
NOTEBOOK_PASSWORD_ENV="CORE_NODE_SECRET_PASSWORD"
# Mirrors RELAY_IDENTITY_FILE_NAME in pycore/pyutils/common/relay_identity.py.
NOTEBOOK_RELAY_IDENTITY_FILE="pycore_relay_identity.json"
NOTEBOOK_RELAY_IDENTITY_SECRET="PYCORE_RELAY_DEVICE_IDENTITY_1"
NOTEBOOK_TOOLCHAIN_CACHES=("UV_CACHE_DIR:uv" "npm_config_cache:npm")
NOTEBOOK_TAG="[NOTEBOOK]"

source "$NOTEBOOK_RUNTIME_DIR/secret_tool_common.sh"

# notebook_is_platform NAME -> success when NAME is a supported platform token.
notebook_is_platform() {
    local name=""
    for name in "${NOTEBOOK_PLATFORMS[@]}"; do
        [ "$name" = "${1:-}" ] && return 0
    done
    return 1
}

# notebook_platform_detected NAME -> success when this VM looks like NAME.
# Kaggle images are built on the Colab runtime image, so Kaggle is checked first.
notebook_platform_detected() {
    local kaggle=false

    if [ -n "${KAGGLE_KERNEL_RUN_TYPE:-}" ] || [ -d /kaggle/input ]; then
        kaggle=true
    fi
    case "${1:-}" in
        kaggle) [ "$kaggle" = true ] ;;
        colab)  [ "$kaggle" = false ] && { [ -n "${COLAB_RELEASE_TAG:-}" ] || [ -n "${COLAB_BACKEND_VERSION:-}" ]; } ;;
        *) return 1 ;;
    esac
}

# Sets NOTEBOOK_PERSIST_DIR (a caller export wins) and NOTEBOOK_PERSIST_EPHEMERAL.
notebook_resolve_persist_dir() {
    if [ -n "$NOTEBOOK_PERSIST_DIR" ]; then
        return 0
    fi
    case "$NOTEBOOK_PLATFORM" in
        colab)
            if [ -d "$NOTEBOOK_COLAB_DRIVE_DIR" ]; then
                NOTEBOOK_PERSIST_DIR="$NOTEBOOK_COLAB_DRIVE_DIR/$NOTEBOOK_PERSIST_NAME"
            else
                NOTEBOOK_PERSIST_DIR="$NOTEBOOK_COLAB_LOCAL_DIR/$NOTEBOOK_PERSIST_NAME"
                NOTEBOOK_PERSIST_EPHEMERAL=true
            fi
            ;;
        kaggle)
            # Kept between sessions only with the notebook setting
            # Persistence = Files; 20 GB cap shared with the notebook output.
            NOTEBOOK_PERSIST_DIR="$NOTEBOOK_KAGGLE_WORKING_DIR/$NOTEBOOK_PERSIST_NAME"
            ;;
    esac
}

# notebook_prepare_environment PLATFORM
# Phase 1, BEFORE runtime_environment.sh: pins CORE_NODE_DATA_DIR and the
# toolchain caches to the persist root (caller exports win).
notebook_prepare_environment() {
    local entry="" var="" name=""

    NOTEBOOK_PLATFORM="$1"
    if notebook_platform_detected "$NOTEBOOK_PLATFORM"; then
        # Notebook cells give shell commands a pty but never forward keystrokes:
        # every prompt takes its default and secrets come from the environment.
        export PROMPT_TTY_DISABLED=1
        export NONINTERACTIVE=1
    else
        echo -e "\033[33m$NOTEBOOK_TAG This VM does not look like $NOTEBOOK_PLATFORM; continuing with the $NOTEBOOK_PLATFORM layout\033[0m"
    fi
    notebook_resolve_persist_dir
    mkdir -p "$NOTEBOOK_PERSIST_DIR/core_node" "$NOTEBOOK_PERSIST_DIR/cache" "$NOTEBOOK_PERSIST_DIR/toolchain"
    if [ "$NOTEBOOK_PERSIST_EPHEMERAL" = true ]; then
        echo -e "\033[33m$NOTEBOOK_TAG Google Drive is not mounted; caches and the Relay identity are lost with this VM.\033[0m"
        echo -e "\033[33m$NOTEBOOK_TAG Mount it first: from google.colab import drive; drive.mount('/content/drive')\033[0m"
    fi

    : "${CORE_NODE_DATA_DIR:=$NOTEBOOK_PERSIST_DIR/core_node}"
    for entry in "${NOTEBOOK_TOOLCHAIN_CACHES[@]}"; do
        var="${entry%%:*}"
        name="${entry#*:}"
        mkdir -p "$NOTEBOOK_PERSIST_DIR/toolchain/$name"
        [ -n "${!var:-}" ] || printf -v "$var" '%s' "$NOTEBOOK_PERSIST_DIR/toolchain/$name"
        export "${var?}"
    done
    # Network-backed persist roots (Google Drive) store neither symlinks nor hardlinks.
    : "${HF_HUB_DISABLE_SYMLINKS:=1}"
    : "${UV_LINK_MODE:=copy}"
    export CORE_NODE_DATA_DIR HF_HUB_DISABLE_SYMLINKS UV_LINK_MODE NOTEBOOK_PLATFORM NOTEBOOK_PERSIST_DIR
    echo "$NOTEBOOK_TAG Platform: $NOTEBOOK_PLATFORM  persist root: $NOTEBOOK_PERSIST_DIR"
}

# Phase 2, AFTER runtime_environment.sh and BEFORE shared_cache_env.sh: the
# shared model cache is derived from the fixed legacy root, so link its cache
# directory into the persist root.
notebook_bind_model_cache() {
    local target="$LEGACY_CORE_NODE_DATA_DIR/cache"
    local source_dir="$NOTEBOOK_PERSIST_DIR/cache"

    mkdir -p "$LEGACY_CORE_NODE_DATA_DIR"
    if [ -L "$target" ]; then
        ln -sfn "$source_dir" "$target"
    elif [ -d "$target" ] && [ -n "$(ls -A "$target" 2>/dev/null)" ]; then
        echo -e "\033[33m$NOTEBOOK_TAG $target already holds a local cache; it is kept and not persisted\033[0m"
        return 0
    else
        [ -d "$target" ] && rmdir "$target"
        ln -s "$source_dir" "$target"
    fi
    echo "$NOTEBOOK_TAG Model cache: $target -> $source_dir"
}

# Sets the named variable to the secret password: the env var (consumed and
# unset so no child inherits it), else a terminal prompt; empty when neither.
notebook_read_password() {
    local __nrp_var="$1"
    local __nrp_label="$2"
    local __nrp_value="${!NOTEBOOK_PASSWORD_ENV:-}"

    unset "$NOTEBOOK_PASSWORD_ENV"
    if [ -z "$__nrp_value" ]; then
        secret_prompt_password __nrp_value "$__nrp_label"
    fi
    printf -v "$__nrp_var" '%s' "$__nrp_value"
}

# Decrypts every encrypted secret into the raw dir (existing raw files are kept).
notebook_decrypt_secrets() {
    local password=""
    local name=""

    [ -d "$NOTEBOOK_ENCRYPTED_DIR" ] || return 0
    notebook_read_password password "$NOTEBOOK_TAG Secret decrypt"
    if [ -z "$password" ]; then
        echo -e "\033[33m$NOTEBOOK_TAG No secret password (set $NOTEBOOK_PASSWORD_ENV or run in a terminal); encrypted secrets stay encrypted\033[0m"
        return 0
    fi
    mkdir -p "$NOTEBOOK_RAW_DIR" && chmod 700 "$NOTEBOOK_RAW_DIR" 2>/dev/null || true
    secret_crypto_batch "$password" "" decrypt "$NOTEBOOK_RAW_DIR" "$NOTEBOOK_ENCRYPTED_DIR"
    password=""
    echo "$NOTEBOOK_TAG Secrets decrypted: ${#SECRET_CRYPTO_DONE[@]}  already present: ${#SECRET_CRYPTO_SKIPPED[@]}  wrong password: ${#SECRET_CRYPTO_WRONG[@]}  failed: ${#SECRET_CRYPTO_FAILED[@]}"
    for name in "${SECRET_CRYPTO_WRONG[@]}" "${SECRET_CRYPTO_FAILED[@]}"; do
        echo -e "\033[31m$NOTEBOOK_TAG   not decrypted: $name\033[0m"
    done
}

# Seeds the Relay device identity from its decrypted secret when the persist
# root has none; a persisted identity is newer (key rotation) and always wins.
notebook_restore_relay_identity() {
    local config_dir="$CORE_NODE_DATA_DIR/config"
    local identity_file="$config_dir/$NOTEBOOK_RELAY_IDENTITY_FILE"
    local raw_file="$NOTEBOOK_RAW_DIR/$NOTEBOOK_RELAY_IDENTITY_SECRET"
    local tmp_file=""

    if [ -s "$identity_file" ]; then
        echo "$NOTEBOOK_TAG Relay identity: $identity_file"
        return 0
    fi
    if [ ! -s "$raw_file" ]; then
        echo -e "\033[33m$NOTEBOOK_TAG No Relay identity yet: this VM enrolls as a new device; claim it in Laravel, then save it with: ./pyservice.sh $NOTEBOOK_PLATFORM --export-identity\033[0m"
        return 0
    fi
    mkdir -p "$config_dir"
    tmp_file="$(mktemp "$config_dir/.$NOTEBOOK_RELAY_IDENTITY_FILE.XXXXXX")" || return 0
    if grep -m1 -v '^[[:space:]]*$' "$raw_file" | tr -d '\r\n ' | base64 -d > "$tmp_file" 2>/dev/null && [ -s "$tmp_file" ]; then
        chmod 600 "$tmp_file"
        mv -f "$tmp_file" "$identity_file"
        echo -e "\033[32m$NOTEBOOK_TAG Relay identity restored from $NOTEBOOK_RELAY_IDENTITY_SECRET\033[0m"
        return 0
    fi
    rm -f "$tmp_file"
    echo -e "\033[31m$NOTEBOOK_TAG $NOTEBOOK_RELAY_IDENTITY_SECRET is not a valid identity export; enrolling as a new device\033[0m"
}

# Returns the first encrypted secret other than the identity (password check).
notebook_reference_secret() {
    local file=""
    for file in "$NOTEBOOK_ENCRYPTED_DIR"/*.js; do
        [ -f "$file" ] || continue
        [ "${file##*/}" = "$NOTEBOOK_RELAY_IDENTITY_SECRET.js" ] && continue
        printf '%s' "$file"
        return 0
    done
}

# Encrypts the current Relay device identity into already_encrypted with the
# shared secret password (checked against another secret first).
notebook_export_relay_identity() {
    local identity_file="$CORE_NODE_DATA_DIR/config/$NOTEBOOK_RELAY_IDENTITY_FILE"
    local raw_file="$NOTEBOOK_RAW_DIR/$NOTEBOOK_RELAY_IDENTITY_SECRET"
    local reference_file=""
    local password=""

    if [ ! -s "$identity_file" ]; then
        echo -e "\033[31m$NOTEBOOK_TAG No Relay identity at $identity_file; run ./pyservice.sh $NOTEBOOK_PLATFORM first and claim the device\033[0m" >&2
        return 1
    fi
    notebook_read_password password "$NOTEBOOK_TAG Identity encrypt"
    if [ -z "$password" ]; then
        echo -e "\033[31m$NOTEBOOK_TAG A secret password is required (set $NOTEBOOK_PASSWORD_ENV or run in a terminal)\033[0m" >&2
        return 1
    fi
    reference_file="$(notebook_reference_secret)"
    if [ -n "$reference_file" ]; then
        secret_crypto_batch "$password" "" verify "$reference_file"
        if [ "${#SECRET_CRYPTO_DONE[@]}" -eq 0 ]; then
            password=""
            echo -e "\033[31m$NOTEBOOK_TAG This password does not decrypt ${reference_file##*/}; use the shared secret password\033[0m" >&2
            return 1
        fi
    fi
    mkdir -p "$NOTEBOOK_RAW_DIR" && chmod 700 "$NOTEBOOK_RAW_DIR" 2>/dev/null || true
    (umask 077 && base64 -w 0 "$identity_file" > "$raw_file")
    secret_crypto_batch "$password" "" encrypt "$NOTEBOOK_ENCRYPTED_DIR" "$raw_file"
    password=""
    if [ "${#SECRET_CRYPTO_DONE[@]}" -eq 0 ]; then
        echo -e "\033[31m$NOTEBOOK_TAG Encrypting $NOTEBOOK_RELAY_IDENTITY_SECRET failed\033[0m" >&2
        return 1
    fi
    echo -e "\033[32m$NOTEBOOK_TAG Saved $NOTEBOOK_ENCRYPTED_DIR/$NOTEBOOK_RELAY_IDENTITY_SECRET.js; commit it so every notebook VM reconnects as this device\033[0m"
    echo -e "\033[33m$NOTEBOOK_TAG Run one notebook VM per identity at a time; concurrent VMs with one identity conflict in Relay\033[0m"
}
