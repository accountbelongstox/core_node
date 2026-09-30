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
NOTEBOOK_KAGGLE_INPUT_DIR="/kaggle/input"
NOTEBOOK_SEED_SEARCH_DEPTH=4
# Persist-root marker: its caches were filled once (a seed source must carry it).
NOTEBOOK_PERSIST_MARKER=".cache_initialized"
# VM-local marker: this VM ran the prerequisite installers once (venvs and
# system packages are not persisted, so every fresh VM needs one install pass).
NOTEBOOK_VM_MARKER_NAME="notebook_vm_ready"
NOTEBOOK_CONNECTIVITY_URL="https://pypi.org/simple/"
NOTEBOOK_CONNECTIVITY_TIMEOUT=10
NOTEBOOK_TAG="[NOTEBOOK]"
NOTEBOOK_STAGE_INDEX=0
NOTEBOOK_HEARTBEAT_SECONDS=15
NOTEBOOK_CACHE_SAVE_SECONDS=600

source "$NOTEBOOK_RUNTIME_DIR/secret_tool_common.sh"

# notebook_stage TITLE -> numbered banner for the next setup stage.
notebook_stage() {
    NOTEBOOK_STAGE_INDEX=$((NOTEBOOK_STAGE_INDEX + 1))
    echo -e "\033[36m$NOTEBOOK_TAG ----- Stage $NOTEBOOK_STAGE_INDEX: $1 -----\033[0m"
}

# Final setup state before the worker starts (no secret values are printed).
notebook_print_summary() {
    local identity_file="$CORE_NODE_DATA_DIR/config/$NOTEBOOK_RELAY_IDENTITY_FILE"
    local identity_state="missing (enrolls as a new device)"
    local pending_count=0

    notebook_stage "Launch summary"
    [ -s "$identity_file" ] && identity_state="$identity_file"
    [ -d "$NOTEBOOK_ENCRYPTED_DIR" ] && pending_count="$(notebook_pending_secrets | wc -l | tr -d ' ')"
    echo "$NOTEBOOK_TAG Platform        : $NOTEBOOK_PLATFORM (service mode 2, Relay agent, outbound only)"
    echo "$NOTEBOOK_TAG Accelerator     : ${NOTEBOOK_ACCELERATOR:-unknown}$([ "${NOTEBOOK_ACCELERATOR:-}" = tpu ] && echo ' (no TPU backend; inference on CPU)')"
    echo "$NOTEBOOK_TAG Persist root    : $NOTEBOOK_PERSIST_DIR$([ "$NOTEBOOK_PERSIST_EPHEMERAL" = true ] && echo ' (ephemeral)')"
    echo "$NOTEBOOK_TAG Data dir        : $CORE_NODE_DATA_DIR"
    echo "$NOTEBOOK_TAG Model cache     : ${CORE_NODE_CACHE_DIR:-unset}"
    echo "$NOTEBOOK_TAG Cache state     : $([ -f "$NOTEBOOK_PERSIST_DIR/$NOTEBOOK_PERSIST_MARKER" ] && echo initialized || echo 'not initialized yet')"
    echo "$NOTEBOOK_TAG VM installers   : $(notebook_vm_ready && echo done || echo 'not completed')"
    echo "$NOTEBOOK_TAG Encrypted left  : $pending_count secret(s)"
    echo "$NOTEBOOK_TAG Relay identity  : $identity_state"
    echo "$NOTEBOOK_TAG Laravel API     : ${LARAVEL_WORKER_API_URL:-service contract default}"
}

# notebook_platform_detected NAME -> success when this VM looks like NAME.
# notebook_boot.py passes its kernel-side result; otherwise Kaggle is checked
# first (its image is built on the Colab runtime image), and Colab, which does
# not always export COLAB_* variables, by its google.colab package.
notebook_platform_detected() {
    local kaggle=false

    if [ -n "${NOTEBOOK_PLATFORM_DETECTED:-}" ]; then
        [ "$NOTEBOOK_PLATFORM_DETECTED" = "${1:-}" ]
        return
    fi
    if [ -n "${KAGGLE_KERNEL_RUN_TYPE:-}" ] || [ -d /kaggle/input ]; then
        kaggle=true
    fi
    case "${1:-}" in
        kaggle) [ "$kaggle" = true ] ;;
        colab)
            [ "$kaggle" = false ] || return 1
            [ -n "${COLAB_RELEASE_TAG:-}" ] || [ -n "${COLAB_BACKEND_VERSION:-}" ] && return 0
            [ -d "$NOTEBOOK_COLAB_LOCAL_DIR" ] && python3 -c "import google.colab" >/dev/null 2>&1
            ;;
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

    notebook_stage "Persist root"
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
        echo -e "\033[33m$NOTEBOOK_TAG A shell cannot mount Drive; notebook_boot.py mounts it automatically, or run in a cell: from google.colab import drive; drive.mount('/content/drive')\033[0m"
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
    notebook_seed_persist_root
}

# Prints earlier persist roots this VM can already see: Colab's local fallback
# (a run before Drive was mounted) and Kaggle inputs, which Kaggle mounts itself
# (a previous version's output or a dataset holding $NOTEBOOK_PERSIST_NAME).
notebook_seed_candidates() {
    case "$NOTEBOOK_PLATFORM" in
        colab)
            printf '%s\n' "$NOTEBOOK_COLAB_LOCAL_DIR/$NOTEBOOK_PERSIST_NAME"
            ;;
        kaggle)
            [ -d "$NOTEBOOK_KAGGLE_INPUT_DIR" ] || return 0
            find "$NOTEBOOK_KAGGLE_INPUT_DIR" -maxdepth "$NOTEBOOK_SEED_SEARCH_DEPTH" -type d -name "$NOTEBOOK_PERSIST_NAME" 2>/dev/null
            ;;
    esac
}

# Idempotent: an initialized persist root is reused as is; an empty one is
# seeded (no overwrite) from the first initialized earlier root; otherwise the
# prerequisite installers of this run initialize it, and the operations that
# keep it for the next VM are printed.
notebook_seed_persist_root() {
    local candidate=""

    if [ -f "$NOTEBOOK_PERSIST_DIR/$NOTEBOOK_PERSIST_MARKER" ]; then
        echo "$NOTEBOOK_TAG Cache: reusing $NOTEBOOK_PERSIST_DIR"
        return 0
    fi
    while IFS= read -r candidate; do
        [ -n "$candidate" ] && [ "$candidate" != "$NOTEBOOK_PERSIST_DIR" ] || continue
        [ -f "$candidate/$NOTEBOOK_PERSIST_MARKER" ] || continue
        echo "$NOTEBOOK_TAG Cache: seeding $NOTEBOOK_PERSIST_DIR from $candidate ..."
        cp -an "$candidate/." "$NOTEBOOK_PERSIST_DIR/" 2>/dev/null || true
        if [ -f "$NOTEBOOK_PERSIST_DIR/$NOTEBOOK_PERSIST_MARKER" ]; then
            echo "$NOTEBOOK_TAG Cache: seeded from $candidate"
            return 0
        fi
    done < <(notebook_seed_candidates)
    echo -e "\033[33m$NOTEBOOK_TAG Cache: none yet; this run's prerequisite installers initialize it\033[0m"
    case "$NOTEBOOK_PLATFORM" in
        colab)
            [ "$NOTEBOOK_PERSIST_EPHEMERAL" = true ] && echo -e "\033[33m$NOTEBOOK_TAG To keep it: run from a cell with %run $NOTEBOOK_REPO_ROOT/pycore/pyutils/notebook_boot.py colab (mounts Drive automatically)\033[0m"
            ;;
        kaggle)
            echo -e "\033[33m$NOTEBOOK_TAG To keep it: notebook Settings > Persistence > Files, or Save Version and Add Input with that output (Kaggle mounts it under $NOTEBOOK_KAGGLE_INPUT_DIR)\033[0m"
            ;;
    esac
}

# notebook_vm_ready -> success when this VM already ran the installers once.
notebook_vm_ready() {
    [ -f "$LEGACY_CORE_NODE_DATA_DIR/$NOTEBOOK_VM_MARKER_NAME" ]
}

# Records a successful install pass for this VM and the persist root.
notebook_mark_initialized() {
    mkdir -p "$LEGACY_CORE_NODE_DATA_DIR"
    touch "$LEGACY_CORE_NODE_DATA_DIR/$NOTEBOOK_VM_MARKER_NAME"
    if [ "$(notebook_cache_mode)" = sync ]; then
        echo "$NOTEBOOK_TAG Saving freshly installed model-cache files to $NOTEBOOK_PERSIST_DIR/cache ..."
        notebook_save_model_cache
    fi
    touch "$NOTEBOOK_PERSIST_DIR/$NOTEBOOK_PERSIST_MARKER"
}

# Prints the operation that enables outbound internet when the probe fails.
notebook_check_connectivity() {
    notebook_stage "Prerequisites"
    command -v curl >/dev/null 2>&1 || return 0
    if curl -fsSI -o /dev/null --max-time "$NOTEBOOK_CONNECTIVITY_TIMEOUT" "$NOTEBOOK_CONNECTIVITY_URL" 2>/dev/null; then
        echo "$NOTEBOOK_TAG Internet: ok"
        return 0
    fi
    echo -e "\033[31m$NOTEBOOK_TAG No outbound internet ($NOTEBOOK_CONNECTIVITY_URL unreachable)\033[0m"
    case "$NOTEBOOK_PLATFORM" in
        kaggle) echo -e "\033[33m$NOTEBOOK_TAG Enable notebook Settings > Internet (requires a phone-verified Kaggle account)\033[0m" ;;
        colab)  echo -e "\033[33m$NOTEBOOK_TAG Reconnect the runtime (Runtime > Disconnect and delete runtime) and run again\033[0m" ;;
    esac
}

# notebook_cache_mode -> "sync" when the persist root is on Google Drive (a FUSE
# mount without real symlink/chmod/stat semantics: the hot model cache cannot
# live on it), else "link" (a plain disk such as /kaggle/working).
notebook_cache_mode() {
    case "$NOTEBOOK_PERSIST_DIR/" in
        "$NOTEBOOK_COLAB_DRIVE_DIR"/*) echo sync ;;
        *) echo link ;;
    esac
}

# notebook_copy_missing SOURCE TARGET -> copies files TARGET lacks (never
# overwrites; skips download temp files). Idempotent and resumable.
notebook_copy_missing() {
    [ -d "$1" ] || return 0
    mkdir -p "$2"
    if command -v rsync >/dev/null 2>&1; then
        rsync -a --ignore-existing --no-perms --no-owner --no-group \
            --exclude '*.incomplete' --exclude '*.lock' --exclude '*.part' --exclude '*.tmp' \
            "$1/" "$2/" 2>/dev/null || true
    else
        tar -C "$1" --exclude='*.incomplete' --exclude='*.lock' --exclude='*.part' --exclude='*.tmp' -cf - . 2>/dev/null \
            | tar -C "$2" --skip-old-files -xf - 2>/dev/null || true
    fi
}

# Sync mode: persist root -> local cache (restore what this VM lacks).
notebook_restore_model_cache() {
    local target="$LEGACY_CORE_NODE_DATA_DIR/cache"
    local started="$SECONDS"

    echo "$NOTEBOOK_TAG Model cache: restoring $NOTEBOOK_PERSIST_DIR/cache -> $target (missing files only) ..."
    notebook_copy_missing "$NOTEBOOK_PERSIST_DIR/cache" "$target"
    echo "$NOTEBOOK_TAG Model cache: restored in $((SECONDS - started))s ($(du -sh "$target" 2>/dev/null | cut -f1) local)"
}

# Sync mode: local cache -> persist root (save what the persist root lacks).
notebook_save_model_cache() {
    [ "$(notebook_cache_mode)" = sync ] || return 0
    notebook_copy_missing "$LEGACY_CORE_NODE_DATA_DIR/cache" "$NOTEBOOK_PERSIST_DIR/cache"
}

# Sync mode: background saver so an abruptly killed VM still persisted its
# downloads; prints its pid (empty in link mode).
notebook_start_cache_saver() {
    [ "$(notebook_cache_mode)" = sync ] || return 0
    (
        while sleep "$NOTEBOOK_CACHE_SAVE_SECONDS"; do
            nice -n 19 bash -c "$(declare -f notebook_copy_missing); notebook_copy_missing '$LEGACY_CORE_NODE_DATA_DIR/cache' '$NOTEBOOK_PERSIST_DIR/cache'"
        done
    ) >/dev/null 2>&1 &
    echo "$!"
}

# notebook_run_worker CMD... -> runs the worker as a child (not exec) so the
# model cache is saved when it stops; SIGINT/SIGTERM are forwarded to it.
notebook_run_worker() {
    local worker_pid=""
    local saver_pid=""
    local rc=0

    saver_pid="$(notebook_start_cache_saver)"
    "$@" &
    worker_pid=$!
    trap 'kill -INT "$worker_pid" 2>/dev/null' INT
    trap 'kill -TERM "$worker_pid" 2>/dev/null' TERM
    while kill -0 "$worker_pid" 2>/dev/null; do
        wait "$worker_pid"
        rc=$?
    done
    trap - INT TERM
    [ -n "$saver_pid" ] && kill "$saver_pid" 2>/dev/null
    if [ "$(notebook_cache_mode)" = sync ]; then
        echo "$NOTEBOOK_TAG Saving new model-cache files to $NOTEBOOK_PERSIST_DIR/cache ..."
        notebook_save_model_cache
    fi
    return "$rc"
}

# Phase 2, AFTER runtime_environment.sh and BEFORE shared_cache_env.sh: the
# shared model cache is derived from the fixed legacy root. Link mode points it
# at the persist root; sync mode keeps it a local directory restored from (and
# later saved back to) the persist root.
notebook_bind_model_cache() {
    local target="$LEGACY_CORE_NODE_DATA_DIR/cache"
    local source_dir="$NOTEBOOK_PERSIST_DIR/cache"

    notebook_stage "Model cache"
    mkdir -p "$LEGACY_CORE_NODE_DATA_DIR"
    if [ "$(notebook_cache_mode)" = sync ]; then
        [ -L "$target" ] && rm -f "$target"
        mkdir -p "$target"
        notebook_restore_model_cache
        return 0
    fi
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

# Prints the encrypted secrets that have no decrypted raw file yet.
notebook_pending_secrets() {
    local file="" name=""
    for file in "$NOTEBOOK_ENCRYPTED_DIR"/*.js; do
        [ -f "$file" ] || continue
        name="${file##*/}"
        name="${name%.js}"
        [ -s "$NOTEBOOK_RAW_DIR/$name" ] || printf '%s\n' "$name"
    done
}

# notebook_decrypt_with_progress PASSWORD PENDING_COUNT
# The batch prints its per-file results only at the end and every secret costs
# a 1.5M-round PBKDF2 derivation (minutes on a 2-vCPU notebook VM), so a
# heartbeat line keeps the notebook output visibly alive meanwhile.
notebook_decrypt_with_progress() {
    local started="$SECONDS"
    local heartbeat_pid=""

    echo "$NOTEBOOK_TAG Decrypting $2 secret(s) on $(nproc 2>/dev/null || echo '?') CPU(s); this can take a few minutes ..."
    (
        while sleep "$NOTEBOOK_HEARTBEAT_SECONDS"; do
            echo "$NOTEBOOK_TAG   still decrypting ... $((SECONDS - started))s"
        done
    ) &
    heartbeat_pid=$!
    secret_crypto_batch "$1" "$SECRET_NODE_BIN" decrypt "$NOTEBOOK_RAW_DIR" "$NOTEBOOK_ENCRYPTED_DIR"
    kill "$heartbeat_pid" 2>/dev/null
    wait "$heartbeat_pid" 2>/dev/null
    echo "$NOTEBOOK_TAG Decryption finished in $((SECONDS - started))s"
}

# Idempotent: decrypts only when some secret is still encrypted (existing raw
# files are kept); without a password it prints how to supply one.
notebook_decrypt_secrets() {
    local password=""
    local name=""
    local pending=()

    notebook_stage "Secrets"
    [ -d "$NOTEBOOK_ENCRYPTED_DIR" ] || return 0
    mapfile -t pending < <(notebook_pending_secrets)
    if [ "${#pending[@]}" -eq 0 ]; then
        unset "$NOTEBOOK_PASSWORD_ENV"
        echo "$NOTEBOOK_TAG Secrets: all already decrypted"
        return 0
    fi
    notebook_read_password password "$NOTEBOOK_TAG Secret decrypt"
    if [ -z "$password" ]; then
        echo -e "\033[33m$NOTEBOOK_TAG ${#pending[@]} secret(s) still encrypted and no password was given; the client key and Relay identity may be missing\033[0m"
        echo -e "\033[33m$NOTEBOOK_TAG Add the notebook secret $NOTEBOOK_PASSWORD_ENV (Colab: Secrets panel; Kaggle: Add-ons > Secrets) and run notebook_boot.py again, or export $NOTEBOOK_PASSWORD_ENV\033[0m"
        return 0
    fi
    mkdir -p "$NOTEBOOK_RAW_DIR" && chmod 700 "$NOTEBOOK_RAW_DIR" 2>/dev/null || true
    echo "$NOTEBOOK_TAG Resolving Node.js for the secret tool (installed once when missing) ..."
    secret_ensure_node
    if [ -z "$SECRET_NODE_BIN" ]; then
        password=""
        echo -e "\033[31m$NOTEBOOK_TAG Node.js is unavailable; secrets stay encrypted\033[0m"
        return 0
    fi
    echo "$NOTEBOOK_TAG Node.js: $SECRET_NODE_BIN ($("$SECRET_NODE_BIN" --version 2>/dev/null))"
    notebook_decrypt_with_progress "$password" "${#pending[@]}"
    password=""
    echo "$NOTEBOOK_TAG Secrets decrypted: ${#SECRET_CRYPTO_DONE[@]}  already present: ${#SECRET_CRYPTO_SKIPPED[@]}  wrong password: ${#SECRET_CRYPTO_WRONG[@]}  failed: ${#SECRET_CRYPTO_FAILED[@]}"
    for name in "${SECRET_CRYPTO_WRONG[@]}" "${SECRET_CRYPTO_FAILED[@]}"; do
        echo -e "\033[31m$NOTEBOOK_TAG   not decrypted: $name\033[0m"
    done
    secret_record_password_split
}

# Seeds the Relay device identity from its decrypted secret when the persist
# root has none; a persisted identity is newer (key rotation) and always wins.
notebook_restore_relay_identity() {
    local config_dir="$CORE_NODE_DATA_DIR/config"
    local identity_file="$config_dir/$NOTEBOOK_RELAY_IDENTITY_FILE"
    local raw_file="$NOTEBOOK_RAW_DIR/$NOTEBOOK_RELAY_IDENTITY_SECRET"
    local tmp_file=""

    notebook_stage "Relay device identity"
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

# Encrypts the current Relay device identity into already_encrypted with the
# main secret password (checked against a main-password secret first).
notebook_export_relay_identity() {
    local identity_file="$CORE_NODE_DATA_DIR/config/$NOTEBOOK_RELAY_IDENTITY_FILE"
    local raw_file="$NOTEBOOK_RAW_DIR/$NOTEBOOK_RELAY_IDENTITY_SECRET"
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
    if ! secret_password_is_main "$password" "" "$NOTEBOOK_RELAY_IDENTITY_SECRET"; then
        password=""
        echo -e "\033[31m$NOTEBOOK_TAG This password does not decrypt $SECRET_REFERENCE_NAME; use the main secret password\033[0m" >&2
        return 1
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
