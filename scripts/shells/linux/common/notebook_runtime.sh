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
# Free space (MB) that must remain on the destination after a model-cache save or
# restore; a copy that does not fit is skipped whole (override: env var of this name).
NOTEBOOK_CACHE_MIN_FREE_MB="${NOTEBOOK_CACHE_MIN_FREE_MB:-1024}"
NOTEBOOK_PREREQ_STEP_TIMEOUT_SECONDS=1800
NOTEBOOK_LOCAL_AI_INSTALL_ENV=""
NOTEBOOK_ASSIST_DEFAULT_ENV=""
# Prerequisite steps a notebook VM never uses (Android tools, the dashboard frontend:
# mode 2 is --no-ui; sherpa: kokoro already covers the pinned offline TTS); each is the skip
# variable of its manifest row (service contract prerequisites.steps).
NOTEBOOK_SKIPPED_PREREQ_ENVS=(DEVICE_TOOLS_SKIP FRONTEND_PACKAGES_SKIP SHERPA_SKIP)
NOTEBOOK_INTERNET_OK=true
# Set by notebook_copy_missing when the last copy was skipped (no space) or failed.
NOTEBOOK_COPY_INCOMPLETE=false
# A notebook node assists with GPU work: only the engines of the active mode of the pinned
# startup TTS plan (contract tts_runtime_plan, also read by pyutils/tts/runtime_profile.py)
# plus the local translation runtime install by default; engines the plan uses only in the
# other mode are skipped, every other neural TTS engine stays opt-in (a caller's
# NEURAL_TTS_INSTALL / <ENGINE>_INSTALL / <ENGINE>_SKIP / --include wins).
NOTEBOOK_TTS_PLAN_KEY="tts_runtime_plan"
# Per-platform neural TTS allowlist (contract notebook_defaults.tts_engines): with a row for
# the platform every other neural engine is skipped and the listed ones install in every mode.
NOTEBOOK_TTS_ENGINES_KEY="notebook_defaults.tts_engines"
# Cache parents holding one model directory per TTS engine id (<cache>/pycore/<id>, <cache>/tts/<id>).
NOTEBOOK_TTS_ENGINE_CACHE_PARENTS=(pycore tts)
# TTS engine ids this VM does not install (notebook_prepare_environment); their cache is not restored.
NOTEBOOK_TTS_SKIPPED_ENGINES=()
# Seconds between progress lines while the percentage does not change.
NOTEBOOK_PROGRESS_INTERVAL_SECONDS=5
# rsync options of every copy-missing transfer (never overwrite; no download temp files).
NOTEBOOK_RSYNC_COPY_ARGS=(-a --ignore-existing --no-perms --no-owner --no-group
    --exclude '*.incomplete' --exclude '*.lock' --exclude '*.part' --exclude '*.tmp')
# Decrypted secrets are backed up under the persist root in sync mode (Google Drive) and
# restored on a fresh VM; notebook_boot.py exports the re-decrypt choice (1 = decrypt all again).
NOTEBOOK_SECRET_BACKUP_NAME="secrets"
NOTEBOOK_SECRET_REDECRYPT_ENV="NOTEBOOK_SECRET_REDECRYPT"
# One-shot 0600 file with the password notebook_boot.py resolved (read once, then removed).
NOTEBOOK_SECRET_HANDOFF_ENV="NOTEBOOK_SECRET_HANDOFF_FILE"
# Exported by notebook_boot.py after the kernel-side setup (Drive mount, secret password).
NOTEBOOK_KERNEL_PREPARED_ENV="NOTEBOOK_KERNEL_PREPARED"
NOTEBOOK_BOOT_SCRIPT="$NOTEBOOK_REPO_ROOT/pycore/bootstrap/notebook_boot.py"

source "$NOTEBOOK_RUNTIME_DIR/secret_tool_common.sh"
source "$NOTEBOOK_RUNTIME_DIR/service_contract_common.sh"

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
    local backup_dir=""

    notebook_stage "Launch summary"
    [ -s "$identity_file" ] && identity_state="$identity_file"
    [ -d "$NOTEBOOK_ENCRYPTED_DIR" ] && pending_count="$(notebook_pending_secrets | wc -l | tr -d ' ')"
    backup_dir="$(notebook_secret_backup_dir)"
    echo "$NOTEBOOK_TAG Platform        : $NOTEBOOK_PLATFORM (service mode 2, Relay agent, outbound only)"
    echo "$NOTEBOOK_TAG Accelerator     : ${NOTEBOOK_ACCELERATOR:-unknown}$([ "${NOTEBOOK_ACCELERATOR:-}" = tpu ] && echo ' (no TPU backend; inference on CPU)')"
    echo "$NOTEBOOK_TAG Persist root    : $NOTEBOOK_PERSIST_DIR$([ "$NOTEBOOK_PERSIST_EPHEMERAL" = true ] && echo ' (ephemeral)')"
    echo "$NOTEBOOK_TAG Data dir        : $CORE_NODE_DATA_DIR"
    echo "$NOTEBOOK_TAG Model cache     : ${CORE_NODE_CACHE_DIR:-unset}"
    echo "$NOTEBOOK_TAG Cache state     : $([ -f "$NOTEBOOK_PERSIST_DIR/$NOTEBOOK_PERSIST_MARKER" ] && echo initialized || echo 'not initialized yet')"
    echo "$NOTEBOOK_TAG VM installers   : $(notebook_vm_ready && echo done || echo 'not completed')"
    echo "$NOTEBOOK_TAG Encrypted left  : $pending_count secret(s)"
    echo "$NOTEBOOK_TAG Secret backup   : ${backup_dir:-not used (no Google Drive persist root)}"
    echo "$NOTEBOOK_TAG Relay identity  : $identity_state"
    echo "$NOTEBOOK_TAG Laravel API     : ${LARAVEL_WORKER_API_URL:-service contract default}"
    echo "$NOTEBOOK_TAG AI services     : local only (third-party keys off); translation: $(sc_get local_ai.translate_model) via $(command -v ollama >/dev/null 2>&1 && echo ollama || echo 'ollama (not installed yet)')"
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
    # Only the kernel env var identifies Kaggle: Colab also creates /kaggle/input
    # for its Kaggle dataset integration.
    if [ -n "${KAGGLE_KERNEL_RUN_TYPE:-}" ]; then
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

# Prints gpu | tpu | cpu: the launcher's NOTEBOOK_ACCELERATOR, else an nvidia-smi probe.
notebook_accelerator_kind() {
    if [ -n "${NOTEBOOK_ACCELERATOR:-}" ]; then
        echo "$NOTEBOOK_ACCELERATOR"
    elif command -v nvidia-smi >/dev/null 2>&1 && [ -n "$(nvidia-smi -L 2>/dev/null)" ]; then
        echo gpu
    else
        echo cpu
    fi
}

# notebook_tts_skipped_engines MODE -> "id skip_env" lines (manifest prerequisites.steps) of the
# TTS engines this VM does not install: with a $NOTEBOOK_TTS_ENGINES_KEY row for the platform every
# neural or explicit engine outside it, else the engines the TTS plan (word, word_batch, sentence
# chains) uses in some mode but not in MODE; engines without a skip variable (edge: cloud) never install.
notebook_tts_skipped_engines() {
    python3 -c 'import json, sys
contract = json.load(open(sys.argv[1], encoding="utf-8"))
plan = contract[sys.argv[2]]
mode = sys.argv[3]
allowed = contract
for key in sys.argv[4].split("."):
    allowed = allowed.get(key, {}) if isinstance(allowed, dict) else {}
allowed = allowed.get(sys.argv[5]) if isinstance(allowed, dict) else None
steps = contract["prerequisites"]["steps"]
if allowed:
    skipped = {step["id"] for step in steps if step["mode"] in ("neural", "explicit")} - set(allowed)
else:
    engines = {m: set(plan[m]["word"]) | set(plan[m]["word_batch"]) | set(plan[m]["sentence"]) for m in ("gpu", "cpu")}
    skipped = set().union(*engines.values()) - engines[mode]
skip_env = {step["id"]: step["skip_env"] for step in steps}
print("\n".join((e + " " + skip_env.get(e, "")).rstrip() for e in sorted(skipped)))' \
        "$SERVICE_CONTRACT_FILE" "$NOTEBOOK_TTS_PLAN_KEY" "$1" "$NOTEBOOK_TTS_ENGINES_KEY" "$NOTEBOOK_PLATFORM"
}

# notebook_prepare_environment PLATFORM
# Phase 1, BEFORE runtime_environment.sh: pins CORE_NODE_DATA_DIR and the
# toolchain caches to the persist root (caller exports win).
notebook_prepare_environment() {
    local entry="" var="" name="" plan_mode=""

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
    if [ "${!NOTEBOOK_KERNEL_PREPARED_ENV:-}" != 1 ]; then
        echo -e "\033[33m$NOTEBOOK_TAG Kernel setup did not run: put %run $NOTEBOOK_BOOT_SCRIPT $NOTEBOOK_PLATFORM before this command in the cell (mounts Drive, resolves the secret password)\033[0m"
    fi
    notebook_resolve_persist_dir
    mkdir -p "$NOTEBOOK_PERSIST_DIR/core_node" "$NOTEBOOK_PERSIST_DIR/cache" "$NOTEBOOK_PERSIST_DIR/toolchain"
    if [ "$NOTEBOOK_PERSIST_EPHEMERAL" = true ]; then
        echo -e "\033[33m$NOTEBOOK_TAG Google Drive is not mounted; caches and the Relay identity are lost with this VM.\033[0m"
        echo -e "\033[33m$NOTEBOOK_TAG A shell cannot mount Drive; %run $NOTEBOOK_BOOT_SCRIPT $NOTEBOOK_PLATFORM mounts it before this command\033[0m"
    fi

    : "${CORE_NODE_DATA_DIR:=$NOTEBOOK_PERSIST_DIR/core_node}"
    # Notebook VMs run everything as root and ship an unused default login user
    # (Colab: ubuntu); root-created files must stay root's (pip cache, persist root).
    : "${CORE_NODE_DATA_OWNER:=root}"
    export CORE_NODE_DATA_OWNER
    # A session is time-limited: a prerequisite that cannot finish is skipped
    # (retried next run) instead of blocking the service start.
    : "${PYCORE_PREREQ_STEP_TIMEOUT_SECONDS:=$NOTEBOOK_PREREQ_STEP_TIMEOUT_SECONDS}"
    export PYCORE_PREREQ_STEP_TIMEOUT_SECONDS
    # Third-party AI is off on notebook nodes (notebook_policy.py): the local AI
    # runtime (Ollama + translation model) is installed by default (caller wins).
    : "${NEURAL_TTS_INSTALL:=0}"
    export NEURAL_TTS_INSTALL
    plan_mode=cpu
    [ "$(notebook_accelerator_kind)" = gpu ] && plan_mode=gpu
    NOTEBOOK_TTS_SKIPPED_ENGINES=()
    while read -r name entry; do
        [ -n "$name" ] || continue
        NOTEBOOK_TTS_SKIPPED_ENGINES+=("$name")
        [ -n "$entry" ] || continue
        [ -n "${!entry:-}" ] || printf -v "$entry" '%s' 1
        export "${entry?}"
    done < <(notebook_tts_skipped_engines "$plan_mode")
    echo "$NOTEBOOK_TAG TTS engines not installed (accelerator mode $plan_mode): ${NOTEBOOK_TTS_SKIPPED_ENGINES[*]:-none}"
    # Queue assist (audio lanes, translation) is on by default on a notebook node (caller wins).
    NOTEBOOK_ASSIST_DEFAULT_ENV="$(sc_get notebook_defaults.assist_default_env)"
    if [ -n "$NOTEBOOK_ASSIST_DEFAULT_ENV" ]; then
        [ -n "${!NOTEBOOK_ASSIST_DEFAULT_ENV:-}" ] || printf -v "$NOTEBOOK_ASSIST_DEFAULT_ENV" '%s' 1
        export "${NOTEBOOK_ASSIST_DEFAULT_ENV?}"
    fi
    for entry in "${NOTEBOOK_SKIPPED_PREREQ_ENVS[@]}"; do
        [ -n "${!entry:-}" ] || printf -v "$entry" '%s' 1
        export "${entry?}"
    done
    NOTEBOOK_LOCAL_AI_INSTALL_ENV="$(sc_get local_ai.install_env)"
    if [ -n "$NOTEBOOK_LOCAL_AI_INSTALL_ENV" ]; then
        [ -n "${!NOTEBOOK_LOCAL_AI_INSTALL_ENV:-}" ] || printf -v "$NOTEBOOK_LOCAL_AI_INSTALL_ENV" '%s' 1
        export "${NOTEBOOK_LOCAL_AI_INSTALL_ENV?}"
    fi
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
        notebook_copy_missing "$candidate" "$NOTEBOOK_PERSIST_DIR" progress
        if [ -f "$NOTEBOOK_PERSIST_DIR/$NOTEBOOK_PERSIST_MARKER" ]; then
            echo "$NOTEBOOK_TAG Cache: seeded from $candidate"
            return 0
        fi
    done < <(notebook_seed_candidates)
    echo -e "\033[33m$NOTEBOOK_TAG Cache: none yet; this run's prerequisite installers initialize it\033[0m"
    case "$NOTEBOOK_PLATFORM" in
        colab)
            [ "$NOTEBOOK_PERSIST_EPHEMERAL" = true ] && echo -e "\033[33m$NOTEBOOK_TAG To keep it: put %run $NOTEBOOK_BOOT_SCRIPT colab before this command in the cell (mounts Drive)\033[0m"
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
        notebook_save_model_cache progress
        if [ "$NOTEBOOK_COPY_INCOMPLETE" = true ]; then
            echo -e "\033[33m$NOTEBOOK_TAG Model cache not saved completely; $NOTEBOOK_PERSIST_MARKER is not written, the next run retries\033[0m" >&2
            return 0
        fi
    fi
    touch "$NOTEBOOK_PERSIST_DIR/$NOTEBOOK_PERSIST_MARKER"
}

# Sets NOTEBOOK_INTERNET_OK; when the probe fails prints the operation that enables
# outbound internet (every installer would otherwise wait out its own timeout).
notebook_check_connectivity() {
    notebook_stage "Prerequisites"
    command -v curl >/dev/null 2>&1 || return 0
    if curl -fsSI -o /dev/null --max-time "$NOTEBOOK_CONNECTIVITY_TIMEOUT" "$NOTEBOOK_CONNECTIVITY_URL" 2>/dev/null; then
        NOTEBOOK_INTERNET_OK=true
        echo "$NOTEBOOK_TAG Internet: ok"
        return 0
    fi
    NOTEBOOK_INTERNET_OK=false
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

# notebook_free_mb DIR -> free MB on the filesystem holding DIR (nearest existing
# parent); empty when df cannot tell (e.g. a FUSE mount that reports no quota).
notebook_free_mb() {
    local dir="$1" kb=""
    while [ ! -d "$dir" ] && [ "$dir" != "/" ]; do dir="$(dirname "$dir")"; done
    kb="$(df -Pk "$dir" 2>/dev/null | awk 'NR==2 && $4 ~ /^[0-9]+$/ && $2 > 0 {print $4}')"
    [ -n "$kb" ] && echo $((kb / 1024))
    return 0
}

# notebook_copy_delta_bytes SOURCE TARGET -> bytes of files TARGET lacks (rsync dry run;
# without rsync the size difference of the two trees, never negative).
notebook_copy_delta_bytes() {
    local bytes=""
    if command -v rsync >/dev/null 2>&1; then
        bytes="$(rsync "${NOTEBOOK_RSYNC_COPY_ARGS[@]}" --dry-run --stats \
            "$1/" "$2/" 2>/dev/null | awk -F': ' '/^Total transferred file size/ {gsub(/[^0-9]/, "", $2); print $2}')"
        echo "${bytes:-0}"
        return 0
    fi
    local src_kb dst_kb
    src_kb="$(du -sk "$1" 2>/dev/null | cut -f1)"
    dst_kb="$(du -sk "$2" 2>/dev/null | cut -f1)"
    echo $(( (${src_kb:-0} > ${dst_kb:-0} ? ${src_kb:-0} - ${dst_kb:-0} : 0) * 1024 ))
}

# Filters rsync --info=progress2 output: a line (bytes, percent, speed, ETA, files) on every
# new whole percent and at least every NOTEBOOK_PROGRESS_INTERVAL_SECONDS, plus every other line.
notebook_progress_filter() {
    awk -v RS='[\r\n]+' -v tag="$NOTEBOOK_TAG" -v interval="$NOTEBOOK_PROGRESS_INTERVAL_SECONDS" '
        function now() { srand(); return srand() }
        BEGIN { last = -1; shown = 0 }
        /^ *[0-9,]+ +[0-9]+% / {
            p = $2 + 0; t = now()
            if (p == last && t - shown < interval) next
            last = p; shown = t; sub(/^ +/, ""); print tag "     " $0; fflush(); next
        }
        NF { print tag "     " $0; fflush() }'
}

# notebook_copy_missing SOURCE TARGET [progress] [NEED_BYTES] -> copies files TARGET lacks (never
# overwrites; skips download temp files). Idempotent and resumable. The free-space guard
# runs first: when the missing files plus NOTEBOOK_CACHE_MIN_FREE_MB do not fit on the
# target filesystem, nothing is written (one warning; the next run retries). rsync
# --delay-updates puts files in place only after the transfer, so no partial file is
# left in the cache tree. "progress" streams the transfer progress to the cell; a caller
# that already measured the missing bytes passes NEED_BYTES and skips the dry-run scan.
notebook_copy_missing() {
    local output="" rc=0 need_bytes="${4:-}" need_mb=0 free_mb="" progress="${3:-}"
    NOTEBOOK_COPY_INCOMPLETE=false
    [ -d "$1" ] || return 0
    mkdir -p "$2" || return 1
    [ -n "$need_bytes" ] || need_bytes="$(notebook_copy_delta_bytes "$1" "$2")"
    [ "${need_bytes:-0}" -gt 0 ] || return 0
    need_mb=$(( (need_bytes + 1048575) / 1048576 ))
    free_mb="$(notebook_free_mb "$2")"
    if [ -n "$free_mb" ] && [ $((need_mb + NOTEBOOK_CACHE_MIN_FREE_MB)) -gt "$free_mb" ]; then
        NOTEBOOK_COPY_INCOMPLETE=true
        echo -e "\033[33m$NOTEBOOK_TAG Skipping copy $1 -> $2: needs ${need_mb} MB (+ ${NOTEBOOK_CACHE_MIN_FREE_MB} MB reserve), only ${free_mb} MB free; the next run retries\033[0m" >&2
        return 0
    fi
    [ -n "$progress" ] && echo "$NOTEBOOK_TAG   $1 -> $2: ${need_mb} MB missing, ${free_mb:-unknown} MB free on the target"
    if command -v rsync >/dev/null 2>&1; then
        if [ -n "$progress" ]; then
            rsync "${NOTEBOOK_RSYNC_COPY_ARGS[@]}" --delay-updates --info=progress2,stats0 \
                "$1/" "$2/" 2>&1 | notebook_progress_filter
            rc="${PIPESTATUS[0]}"
        else
            output="$(rsync "${NOTEBOOK_RSYNC_COPY_ARGS[@]}" --delay-updates "$1/" "$2/" 2>&1)" || rc=$?
        fi
        # 24 = source files vanished while downloads were running: harmless.
        [ "$rc" -eq 24 ] && rc=0
    else
        [ -n "$progress" ] && echo "$NOTEBOOK_TAG   rsync is unavailable; copying with tar (no progress) ..."
        output="$(tar -C "$1" --exclude='*.incomplete' --exclude='*.lock' --exclude='*.part' --exclude='*.tmp' -cf - . 2>&1 \
            | tar -C "$2" --skip-old-files -xf - 2>&1)" || rc=$?
    fi
    if [ "$rc" -ne 0 ]; then
        NOTEBOOK_COPY_INCOMPLETE=true
        echo -e "\033[33m$NOTEBOOK_TAG Copy $1 -> $2 incomplete (exit $rc; Drive quota or I/O): $(printf '%s' "$output" | tail -n 3 | tr '\n' ' ')\033[0m" >&2
    fi
    return "$rc"
}

# notebook_cache_entries DIR -> restore units of a cache tree: every top-level entry, with the
# TTS engine parents (NOTEBOOK_TTS_ENGINE_CACHE_PARENTS) split into one entry per engine.
notebook_cache_entries() {
    local path="" name="" parent=""

    for path in "$1"/* "$1"/.[!.]*; do
        [ -e "$path" ] || continue
        name="${path##*/}"
        for parent in "${NOTEBOOK_TTS_ENGINE_CACHE_PARENTS[@]}"; do
            if [ "$name" = "$parent" ] && [ -d "$path" ]; then
                for path in "$1/$name"/* "$1/$name"/.[!.]*; do
                    [ -e "$path" ] && printf '%s\n' "$name/${path##*/}"
                done
                continue 2
            fi
        done
        printf '%s\n' "$name"
    done
}

# notebook_cache_entry_skipped ENTRY -> success when ENTRY is the cache of a TTS engine this VM
# does not install.
notebook_cache_entry_skipped() {
    local parent="" engine=""

    for parent in "${NOTEBOOK_TTS_ENGINE_CACHE_PARENTS[@]}"; do
        for engine in "${NOTEBOOK_TTS_SKIPPED_ENGINES[@]}"; do
            [ "$1" = "$parent/$engine" ] && return 0
        done
    done
    return 1
}

# Sync mode: persist root -> local cache, entry by entry (missing files only). Lists every
# entry with its Drive and local size and the decision first, then copies each with progress;
# caches of TTS engines this VM does not install stay on Drive.
notebook_restore_model_cache() {
    local source="$NOTEBOOK_PERSIST_DIR/cache"
    local target="$LEGACY_CORE_NODE_DATA_DIR/cache"
    local started="$SECONDS"
    local entries=() restore=() needs=()
    local entry="" index=0 count=0 drive_mb=0 local_mb=0 need_mb=0
    local total_mb=0 skipped_mb=0 done_mb=0 incomplete=false

    [ -d "$source" ] || return 0
    mapfile -t entries < <(notebook_cache_entries "$source")
    count="${#entries[@]}"
    echo "$NOTEBOOK_TAG Model cache: $count entries in $source -> $target; sizing (Drive / local) ..."
    for entry in "${entries[@]}"; do
        index=$((index + 1))
        printf '%s   [%d/%d] %s: ' "$NOTEBOOK_TAG" "$index" "$count" "$entry"
        drive_mb="$(du -sm "$source/$entry" 2>/dev/null | cut -f1)"
        drive_mb="${drive_mb:-0}"
        if notebook_cache_entry_skipped "$entry"; then
            skipped_mb=$((skipped_mb + drive_mb))
            echo "${drive_mb} MB on Drive -> skip (TTS engine not installed on $NOTEBOOK_PLATFORM)"
            continue
        fi
        local_mb=0
        [ -e "$target/$entry" ] && local_mb="$(du -sm "$target/$entry" 2>/dev/null | cut -f1)"
        local_mb="${local_mb:-0}"
        need_mb=$(( drive_mb > local_mb ? drive_mb - local_mb : 0 ))
        if [ "$need_mb" -eq 0 ]; then
            echo "${drive_mb} MB on Drive, ${local_mb} MB local -> up to date"
            continue
        fi
        restore+=("$entry")
        needs+=("$need_mb")
        total_mb=$((total_mb + need_mb))
        echo "${drive_mb} MB on Drive, ${local_mb} MB local -> restore ~${need_mb} MB"
    done
    echo "$NOTEBOOK_TAG Model cache: restoring ${#restore[@]} entries (~${total_mb} MB); left on Drive: ${skipped_mb} MB of unused TTS engines"
    for index in "${!restore[@]}"; do
        entry="${restore[$index]}"
        echo "$NOTEBOOK_TAG   [$((index + 1))/${#restore[@]}] $entry: ~${needs[$index]} MB (${done_mb}/${total_mb} MB done, $((SECONDS - started))s)"
        if [ -d "$source/$entry" ]; then
            notebook_copy_missing "$source/$entry" "$target/$entry" progress $((needs[index] * 1048576))
        else
            mkdir -p "$(dirname "$target/$entry")"
            NOTEBOOK_COPY_INCOMPLETE=false
            [ -e "$target/$entry" ] || cp -p "$source/$entry" "$target/$entry" || NOTEBOOK_COPY_INCOMPLETE=true
        fi
        [ "$NOTEBOOK_COPY_INCOMPLETE" = true ] && incomplete=true
        done_mb=$((done_mb + needs[index]))
    done
    NOTEBOOK_COPY_INCOMPLETE="$incomplete"
    echo "$NOTEBOOK_TAG Model cache: restored ${done_mb} MB in $((SECONDS - started))s ($(du -sh "$target" 2>/dev/null | cut -f1) local)"
}

# notebook_save_model_cache [progress] -> sync mode: local cache -> persist root
# (save what the persist root lacks).
notebook_save_model_cache() {
    [ "$(notebook_cache_mode)" = sync ] || return 0
    notebook_copy_missing "$LEGACY_CORE_NODE_DATA_DIR/cache" "$NOTEBOOK_PERSIST_DIR/cache" "${1:-}"
}

# Sync mode: background saver so an abruptly killed VM still persisted its
# downloads; prints its pid (empty in link mode).
notebook_start_cache_saver() {
    [ "$(notebook_cache_mode)" = sync ] || return 0
    (
        renice -n 19 -p "$BASHPID" >/dev/null
        while sleep "$NOTEBOOK_CACHE_SAVE_SECONDS"; do
            notebook_copy_missing "$LEGACY_CORE_NODE_DATA_DIR/cache" "$NOTEBOOK_PERSIST_DIR/cache"
        done
    ) >&2 &
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
        notebook_save_model_cache progress
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
# unset so no child inherits it), else the one-shot handoff file of notebook_boot.py
# (read and removed), else a terminal prompt; empty when none.
notebook_read_password() {
    local __nrp_var="$1"
    local __nrp_label="$2"
    local __nrp_value="${!NOTEBOOK_PASSWORD_ENV:-}"
    local __nrp_handoff="${!NOTEBOOK_SECRET_HANDOFF_ENV:-}"

    unset "$NOTEBOOK_PASSWORD_ENV" "$NOTEBOOK_SECRET_HANDOFF_ENV"
    if [ -n "$__nrp_handoff" ] && [ -f "$__nrp_handoff" ]; then
        [ -n "$__nrp_value" ] || __nrp_value="$(cat "$__nrp_handoff")"
        rm -f "$__nrp_handoff"
    fi
    if [ -z "$__nrp_value" ]; then
        secret_prompt_password __nrp_value "$__nrp_label"
    fi
    printf -v "$__nrp_var" '%s' "$__nrp_value"
}

# Prints the encrypted secrets the main password opens (every .js except the listed
# second-password ones, which dd re-encrypts on the host holding their plaintext).
notebook_encrypted_secrets() {
    local file="" name="" mismatched=""

    mismatched="$(secret_mismatch_names)"
    for file in "$NOTEBOOK_ENCRYPTED_DIR"/*.js; do
        [ -f "$file" ] || continue
        name="${file##*/}"
        name="${name%.js}"
        [ -n "$mismatched" ] && printf '%s\n' "$mismatched" | grep -qxF -- "$name" && continue
        printf '%s\n' "$name"
    done
}

# Prints the encrypted secrets that have no decrypted raw file yet.
notebook_pending_secrets() {
    local name=""
    while IFS= read -r name; do
        [ -s "$NOTEBOOK_RAW_DIR/$name" ] || printf '%s\n' "$name"
    done < <(notebook_encrypted_secrets)
}

# Prints the Drive backup directory of the decrypted secrets (sync mode only), else nothing.
notebook_secret_backup_dir() {
    [ -n "$NOTEBOOK_PERSIST_DIR" ] && [ "$(notebook_cache_mode)" = sync ] || return 0
    printf '%s\n' "$NOTEBOOK_PERSIST_DIR/$NOTEBOOK_SECRET_BACKUP_NAME"
}

# notebook_restore_secret_backup DIR -> copies backed-up secrets this VM has not decrypted.
notebook_restore_secret_backup() {
    local name="" restored=0

    [ -d "$1" ] || return 0
    mkdir -p "$NOTEBOOK_RAW_DIR" && chmod 700 "$NOTEBOOK_RAW_DIR" 2>/dev/null || true
    while IFS= read -r name; do
        [ -s "$1/$name" ] || continue
        (umask 077 && cp -f "$1/$name" "$NOTEBOOK_RAW_DIR/$name") && restored=$((restored + 1))
    done < <(notebook_pending_secrets)
    echo "$NOTEBOOK_TAG Secrets: restored $restored from the Google Drive backup $1"
}

# notebook_save_secret_backup DIR -> copies new or changed decrypted secrets to DIR.
notebook_save_secret_backup() {
    local name="" saved=0 total=0

    mkdir -p "$1" && chmod 700 "$1" 2>/dev/null || true
    while IFS= read -r name; do
        [ -s "$NOTEBOOK_RAW_DIR/$name" ] || continue
        total=$((total + 1))
        cmp -s "$NOTEBOOK_RAW_DIR/$name" "$1/$name" && continue
        cp -f "$NOTEBOOK_RAW_DIR/$name" "$1/$name" && saved=$((saved + 1))
    done < <(notebook_encrypted_secrets)
    echo "$NOTEBOOK_TAG Secrets: Google Drive backup $1 holds $total (updated $saved)"
}

# Names the listed second-password secrets that decryption skips.
notebook_report_mismatched_secrets() {
    local names=()

    mapfile -t names < <(secret_mismatch_names)
    [ "${#names[@]}" -gt 0 ] || return 0
    echo -e "\033[33m$NOTEBOOK_TAG Skipped ${#names[@]} second-password secret(s) (${SECRET_MISMATCH_LIST##*/}): ${names[*]}\033[0m"
    echo -e "\033[33m$NOTEBOOK_TAG Run dd on the host that holds their plaintext to re-encrypt them with the main password\033[0m"
}

# notebook_decrypt_with_progress PASSWORD OUTPUT_DIR PENDING_COUNT ENCRYPTED_FILE...
# The batch prints its per-file results only at the end and every secret costs
# a 1.5M-round PBKDF2 derivation (minutes on a 2-vCPU notebook VM), so a
# heartbeat line keeps the notebook output visibly alive meanwhile.
notebook_decrypt_with_progress() {
    local started="$SECONDS"
    local heartbeat_pid=""

    echo "$NOTEBOOK_TAG Decrypting $3 secret(s) on $(nproc 2>/dev/null || echo '?') CPU(s); this can take a few minutes ..."
    (
        while sleep "$NOTEBOOK_HEARTBEAT_SECONDS"; do
            echo "$NOTEBOOK_TAG   still decrypting ... $((SECONDS - started))s"
        done
    ) &
    heartbeat_pid=$!
    secret_crypto_batch "$1" "$SECRET_NODE_BIN" decrypt "$2" "${@:4}"
    kill "$heartbeat_pid" 2>/dev/null
    wait "$heartbeat_pid" 2>/dev/null
    echo "$NOTEBOOK_TAG Decryption finished in $((SECONDS - started))s"
}

# Idempotent: the Drive backup (sync mode) fills what this VM lacks unless a re-decrypt
# was requested ($NOTEBOOK_SECRET_REDECRYPT_ENV=1: every secret again, into a scratch
# directory that replaces only successfully decrypted files); then only still-encrypted
# secrets are decrypted and the backup is updated. Without a password it prints how to
# supply one.
notebook_decrypt_secrets() {
    local password=""
    local name=""
    local backup_dir=""
    local output_dir="$NOTEBOOK_RAW_DIR"
    local redecrypt=false
    local pending=()
    local pending_files=()

    notebook_stage "Secrets"
    [ -d "$NOTEBOOK_ENCRYPTED_DIR" ] || return 0
    backup_dir="$(notebook_secret_backup_dir)"
    [ "${!NOTEBOOK_SECRET_REDECRYPT_ENV:-0}" = 1 ] && redecrypt=true
    if [ "$redecrypt" = true ]; then
        mapfile -t pending < <(notebook_encrypted_secrets)
        echo "$NOTEBOOK_TAG Secrets: re-decrypt requested for ${#pending[@]} secret(s)"
    else
        [ -n "$backup_dir" ] && notebook_restore_secret_backup "$backup_dir"
        mapfile -t pending < <(notebook_pending_secrets)
    fi
    if [ "${#pending[@]}" -eq 0 ]; then
        unset "$NOTEBOOK_PASSWORD_ENV"
        [ -n "${!NOTEBOOK_SECRET_HANDOFF_ENV:-}" ] && rm -f "${!NOTEBOOK_SECRET_HANDOFF_ENV}"
        unset "$NOTEBOOK_SECRET_HANDOFF_ENV"
        echo "$NOTEBOOK_TAG Secrets: all already decrypted"
        [ -n "$backup_dir" ] && notebook_save_secret_backup "$backup_dir"
        notebook_report_mismatched_secrets
        return 0
    fi
    notebook_read_password password "$NOTEBOOK_TAG Secret decrypt"
    if [ -z "$password" ]; then
        echo -e "\033[33m$NOTEBOOK_TAG ${#pending[@]} secret(s) not decrypted: no password was given; the client key and Relay identity may be missing\033[0m"
        echo -e "\033[33m$NOTEBOOK_TAG Add the notebook secret $NOTEBOOK_PASSWORD_ENV (Colab: Secrets panel; Kaggle: Add-ons > Secrets) and run the cell again, or export $NOTEBOOK_PASSWORD_ENV\033[0m"
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
    for name in "${pending[@]}"; do
        pending_files+=("$NOTEBOOK_ENCRYPTED_DIR/$name.js")
    done
    if [ "$redecrypt" = true ]; then
        output_dir="$(mktemp -d "$NOTEBOOK_SECRET_DIR/.redecrypt.XXXXXX")" || output_dir="$NOTEBOOK_RAW_DIR"
    fi
    notebook_decrypt_with_progress "$password" "$output_dir" "${#pending[@]}" "${pending_files[@]}"
    password=""
    if [ "$output_dir" != "$NOTEBOOK_RAW_DIR" ]; then
        for name in "${SECRET_CRYPTO_DONE[@]}"; do
            [ -s "$output_dir/$name" ] && mv -f "$output_dir/$name" "$NOTEBOOK_RAW_DIR/$name"
        done
        rm -rf "$output_dir"
    fi
    [ -n "$backup_dir" ] && notebook_save_secret_backup "$backup_dir"
    notebook_report_mismatched_secrets
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
    if grep -m1 -v '^[[:space:]]*$' "$raw_file" | tr -d '\r\n ' | base64 -d > "$tmp_file" 2>/dev/null && [ -s "$tmp_file" ] \
        && python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if isinstance(d,dict) and d.get("device_id") and d.get("private_key") and d.get("credential_id") else 1)' "$tmp_file" 2>/dev/null; then
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
