#!/bin/bash
# tts_docker_compose_common.sh - Docker model lifecycle for the TTS engines:
# ensure | up | test | down | status, driven by the shared model definition
# scripts/shells/docker_compose/tts/<model>/model.sh (also read by
# scripts/shells/win/win_common/DockerWslBridge.ps1).
#
# Contract:
#   * Every action prints exactly one line
#       [docker-model] RESULT <action> <model> PASS|FAIL|SKIP <reason>
#     and returns 0 only on PASS. The status never carries values.
#   * ensure is idempotent at the finest grain: host packages, the WSL
#     [boot] systemd key, Docker Engine (79_install_docker.sh through
#     docker_prereq_ensure_for_engine), assets (content compare), the image
#     (fingerprint label), weights (sentinel) and the import check
#     (fingerprint sentinel). It never starts the service container.
#   * up and test never build. down keeps the image and the staging data.
#   * The device is cpu unless <MODEL>_DEVICE=cuda* and docker info lists the
#     nvidia runtime.
#   * Build files live in <staging>/pycore_docker, never <staging>/docker (a
#     native upstream clone may own that directory).
#   * Shared hubs (gvar store, HF helpers) run in subprocesses, so sourcing
#     this file stays side-effect free.

TTS_DOCKER_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TTS_DOCKER_REPO_ROOT="$(cd "$TTS_DOCKER_LIB_DIR/../../../.." && pwd)"
TTS_DOCKER_INSTALL_SHELLS_DIR="$(cd "$TTS_DOCKER_LIB_DIR/../debian/install_shells" && pwd)"
TTS_DOCKER_PREREQ_LIB="$TTS_DOCKER_LIB_DIR/docker_prereq_common.sh"
TTS_DOCKER_HF_LIB="$TTS_DOCKER_LIB_DIR/tts_install_assets_common.sh"
TTS_DOCKER_MODELS_DIR="$TTS_DOCKER_REPO_ROOT/scripts/shells/docker_compose/tts"
TTS_DOCKER_ASSETS_SRC_DIR="$TTS_DOCKER_REPO_ROOT/pycore/tts_install_assets"
TTS_DOCKER_MODEL_FILE="model.sh"
TTS_DOCKER_BUILD_SUBDIR="pycore_docker"
TTS_DOCKER_BUILD_FILES=(Dockerfile compose.yml compose.gpu.yml)
TTS_DOCKER_TAG="[docker-model]"
TTS_DOCKER_RESULT_TAG="[docker-model] RESULT"
TTS_DOCKER_ACTIONS="ensure up test down status"
TTS_DOCKER_REQUIRED_KEYS=(MODEL_PORT MODEL_MEM_LIMIT MODEL_CPUS MODEL_HOST_FREE_RAM_GB MODEL_EST_DISK_GB MODEL_TEST_TIMEOUT MODEL_HEALTH_PATH MODEL_WEIGHTS_METHOD MODEL_DEFAULT_DEVICE)
TTS_DOCKER_OPTIONAL_KEYS=(MODEL_PIDS_LIMIT MODEL_CONTEXT_ASSETS MODEL_WEIGHTS_REPO MODEL_WEIGHTS_SUBDIR MODEL_WEIGHTS_ALLOW MODEL_IMPORT_CHECK MODEL_TORCH_INDEX_CUDA)
TTS_DOCKER_WEIGHTS_METHODS="compose_run hf_flat none"
TTS_DOCKER_TORCH_INDEX_CPU="https://download.pytorch.org/whl/cpu"
TTS_DOCKER_TORCH_INDEX_CUDA_DEFAULT="https://download.pytorch.org/whl/cu130"
TTS_DOCKER_FINGERPRINT_LABEL="pycore.fingerprint"
TTS_DOCKER_MANAGED_LABEL="pycore.managed=true"
TTS_DOCKER_DEFAULT_PIDS_LIMIT=512
TTS_DOCKER_MEM_HEADROOM_MB=512
TTS_DOCKER_DISK_HEADROOM_GB=2
TTS_DOCKER_HEALTH_POLL_SEC=5
TTS_DOCKER_DOWN_TIMEOUT_SEC=30
TTS_DOCKER_ENGINE_PROBE_SEC=15
TTS_DOCKER_HTTP_PROBE_SEC=10
TTS_DOCKER_LOG_TAIL_LINES=40
TTS_DOCKER_WAV_MIN_BYTES=10240
TTS_DOCKER_WSL_CONF="/etc/wsl.conf"
TTS_DOCKER_WSL_SYSTEMD_SECTION="boot"
TTS_DOCKER_WSL_SYSTEMD_KEY="systemd"
TTS_DOCKER_WSL_SYSTEMD_VALUE="true"
TTS_DOCKER_RESTART_REASON="restart-required"
TTS_DOCKER_HOST_PREREQ_PACKAGES=(ca-certificates curl gpg python3)
TTS_DOCKER_WEIGHTS_SENTINEL=".pycore_weights_done"
TTS_DOCKER_IMPORT_SENTINEL=".import_verified"
TTS_DOCKER_HF_OFFICIAL_ENDPOINT="https://huggingface.co"
TTS_DOCKER_SNAPSHOT_PY='import os
from huggingface_hub import snapshot_download
allow = [item.strip() for item in os.environ.get("PYCORE_WEIGHTS_ALLOW", "").split(",") if item.strip()] or None
endpoints = os.environ["PYCORE_HF_ENDPOINTS"].split()
for repo in os.environ["PYCORE_WEIGHTS_REPOS"].split():
    for index, endpoint in enumerate(endpoints):
        try:
            path = snapshot_download(repo_id=repo, allow_patterns=allow, endpoint=endpoint)
            print("[docker-model] staged " + repo + " via " + endpoint + " -> " + path, flush=True)
            break
        except Exception as error:
            if index == len(endpoints) - 1:
                raise
            print("[docker-model] " + repo + " via " + endpoint + " failed (" + type(error).__name__ + "); trying " + endpoints[index + 1], flush=True)'
TTS_DOCKER_IMPORT_PY='import importlib, sys
importlib.import_module(sys.argv[1])
print("[docker-model] import ok: " + sys.argv[1], flush=True)'

# Per-call state (reset by tts_docker_run_action / _tts_docker_load_model).
TTS_DOCKER_MODEL=""
TTS_DOCKER_SERVICE=""
TTS_DOCKER_PROJECT=""
TTS_DOCKER_IMAGE=""
TTS_DOCKER_CONTAINER=""
TTS_DOCKER_ASSET_DIR=""
TTS_DOCKER_STAGING=""
TTS_DOCKER_BUILD_DIR=""
TTS_DOCKER_DEVICE="cpu"
TTS_DOCKER_DEVICE_NOTE=""
TTS_DOCKER_TORCH_INDEX=""
TTS_DOCKER_HF_ENDPOINT=""
TTS_DOCKER_HF_STAGING_ENDPOINTS=""
TTS_DOCKER_FINGERPRINT=""
TTS_DOCKER_COMPOSE_ARGS=()
TTS_DOCKER_COMPOSE_ENV=()
TTS_DOCKER_STATUS=""
TTS_DOCKER_REASON=""
TTS_DOCKER_STEP_NOTE=""
TTS_DOCKER_TEST_CLEANUP_ARMED=0

_tts_docker_log() {
    echo "$TTS_DOCKER_TAG $*"
}

_tts_docker_set() {
    TTS_DOCKER_STATUS="$1"
    TTS_DOCKER_REASON="$2"
}

_tts_docker_print_result() {
    echo "$TTS_DOCKER_RESULT_TAG $1 $2 ${TTS_DOCKER_STATUS:-FAIL} ${TTS_DOCKER_REASON:-unknown}"
}

_tts_docker_ge() {
    awk -v have="$1" -v need="$2" 'BEGIN { exit !((have + 0) >= (need + 0)) }'
}

# Sync one file by content compare (idempotent per minimal operation).
_tts_docker_sync_file() {
    local src="$1" dst="$2"
    [[ -f "$src" ]] || { echo "$TTS_DOCKER_TAG [!] asset missing: $src" >&2; return 1; }
    if [[ -f "$dst" ]] && cmp -s "$src" "$dst"; then
        return 0
    fi
    mkdir -p "$(dirname "$dst")" || return 1
    cp -f "$src" "$dst" || return 1
    _tts_docker_log "synced $(basename "$dst")"
}

_tts_docker_reset_model() {
    local key=""
    for key in "${TTS_DOCKER_REQUIRED_KEYS[@]}" "${TTS_DOCKER_OPTIONAL_KEYS[@]}"; do
        unset "$key"
    done
    unset -f model_smoke 2>/dev/null || true
}

_tts_docker_load_model() {
    local model="$1" staging="$2" key="" definition=""
    TTS_DOCKER_MODEL="$model"
    if [[ ! "$model" =~ ^[a-z0-9_]+$ ]]; then
        _tts_docker_set FAIL "invalid_model_name($model)"
        return 1
    fi
    definition="$TTS_DOCKER_MODELS_DIR/$model/$TTS_DOCKER_MODEL_FILE"
    if [[ ! -f "$definition" ]]; then
        _tts_docker_set FAIL "model_definition_missing($definition)"
        return 1
    fi
    _tts_docker_reset_model
    # shellcheck source=/dev/null
    . "$definition"
    for key in "${TTS_DOCKER_REQUIRED_KEYS[@]}"; do
        if [[ -z "${!key:-}" ]]; then
            _tts_docker_set FAIL "model_definition_key_missing($key)"
            return 1
        fi
    done
    if [[ " $TTS_DOCKER_WEIGHTS_METHODS " != *" $MODEL_WEIGHTS_METHOD "* ]]; then
        _tts_docker_set FAIL "model_definition_invalid(MODEL_WEIGHTS_METHOD=$MODEL_WEIGHTS_METHOD)"
        return 1
    fi
    MODEL_PIDS_LIMIT="${MODEL_PIDS_LIMIT:-$TTS_DOCKER_DEFAULT_PIDS_LIMIT}"
    MODEL_CONTEXT_ASSETS="${MODEL_CONTEXT_ASSETS:-}"
    MODEL_WEIGHTS_REPO="${MODEL_WEIGHTS_REPO:-}"
    MODEL_WEIGHTS_SUBDIR="${MODEL_WEIGHTS_SUBDIR:-}"
    MODEL_WEIGHTS_ALLOW="${MODEL_WEIGHTS_ALLOW:-}"
    MODEL_IMPORT_CHECK="${MODEL_IMPORT_CHECK:-}"
    MODEL_TORCH_INDEX_CUDA="${MODEL_TORCH_INDEX_CUDA:-$TTS_DOCKER_TORCH_INDEX_CUDA_DEFAULT}"
    if [[ "$MODEL_WEIGHTS_METHOD" != "none" && ( -z "$MODEL_WEIGHTS_REPO" || -z "$MODEL_WEIGHTS_SUBDIR" ) ]]; then
        _tts_docker_set FAIL "model_definition_key_missing(MODEL_WEIGHTS_REPO,MODEL_WEIGHTS_SUBDIR)"
        return 1
    fi

    TTS_DOCKER_SERVICE="$model"
    TTS_DOCKER_PROJECT="pycore-tts-$model"
    TTS_DOCKER_IMAGE="pycore-tts-$model:local"
    TTS_DOCKER_CONTAINER="pycore-tts-$model"
    TTS_DOCKER_ASSET_DIR="$TTS_DOCKER_MODELS_DIR/$model"
    if [[ -z "$staging" && -z "${CORE_NODE_CACHE_DIR:-}" ]]; then
        _tts_docker_set FAIL "staging_unresolved(pass a staging dir or export CORE_NODE_CACHE_DIR from shared_cache_env.sh; no repo-local fallback)"
        return 1
    fi
    TTS_DOCKER_STAGING="${staging:-$CORE_NODE_CACHE_DIR/pycore/$model}"
    [[ "$TTS_DOCKER_STAGING" == /* ]] || TTS_DOCKER_STAGING="$PWD/$TTS_DOCKER_STAGING"
    TTS_DOCKER_STAGING="${TTS_DOCKER_STAGING%/}"
    TTS_DOCKER_BUILD_DIR="$TTS_DOCKER_STAGING/$TTS_DOCKER_BUILD_SUBDIR"
    return 0
}

_tts_docker_engine_active() {
    command -v docker >/dev/null 2>&1 || return 1
    timeout "$TTS_DOCKER_ENGINE_PROBE_SEC" docker info >/dev/null 2>&1
}

_tts_docker_start_engine() {
    command -v docker >/dev/null 2>&1 || return 1
    _tts_docker_engine_active && return 0
    if [[ -d /run/systemd/system ]] && command -v systemctl >/dev/null 2>&1; then
        _tts_docker_log "starting docker.service"
        systemctl start docker >/dev/null 2>&1 || true
    elif command -v service >/dev/null 2>&1; then
        _tts_docker_log "systemd is not PID 1; trying 'service docker start'"
        service docker start >/dev/null 2>&1 || true
    fi
    _tts_docker_engine_active
}

_tts_docker_nvidia_runtime() {
    local runtimes=""
    runtimes="$(timeout "$TTS_DOCKER_ENGINE_PROBE_SEC" docker info --format '{{json .Runtimes}}' 2>/dev/null || true)"
    [[ "$runtimes" == *'"nvidia"'* ]]
}

_tts_docker_resolve_device() {
    local var="${TTS_DOCKER_MODEL^^}_DEVICE" want=""
    want="$(printenv "$var" 2>/dev/null || true)"
    want="${want:-$MODEL_DEFAULT_DEVICE}"
    TTS_DOCKER_DEVICE="cpu"
    TTS_DOCKER_DEVICE_NOTE=""
    case "$want" in
        cuda*)
            if _tts_docker_nvidia_runtime; then
                TTS_DOCKER_DEVICE="cuda"
            else
                TTS_DOCKER_DEVICE_NOTE="$var=$want requested but docker info lists no nvidia runtime (NVIDIA Container Toolkit); using cpu"
            fi
            ;;
    esac
    TTS_DOCKER_TORCH_INDEX="$TTS_DOCKER_TORCH_INDEX_CPU"
    [[ "$TTS_DOCKER_DEVICE" == "cuda" ]] && TTS_DOCKER_TORCH_INDEX="$MODEL_TORCH_INDEX_CUDA"
    return 0
}

# sha256 over the source Dockerfile, compose files and context assets, plus the
# device. Computed from the repo sources, so status stays read-only.
_tts_docker_fingerprint() {
    local asset="" digest="" files=() assets=()
    for asset in "${TTS_DOCKER_BUILD_FILES[@]}"; do
        files+=("$TTS_DOCKER_ASSET_DIR/$asset")
    done
    read -r -a assets <<< "$MODEL_CONTEXT_ASSETS"
    for asset in "${assets[@]}"; do
        files+=("$TTS_DOCKER_ASSETS_SRC_DIR/$asset")
    done
    digest="$(cat "${files[@]}" 2>/dev/null | sha256sum)"
    printf '%s:%s' "${digest%% *}" "$TTS_DOCKER_DEVICE"
}

# Weight staging endpoints: the operator's HF_ENDPOINT (or the official Hub)
# first, then the shared installer mirror (_hf_mirror_base) as a fallback. The
# mirror answers LFS files with a cross-host 308 that huggingface_hub HEAD
# calls do not follow, so it cannot be the only in-container endpoint.
_tts_docker_resolve_hf_staging_endpoints() {
    local primary="${HF_ENDPOINT:-$TTS_DOCKER_HF_OFFICIAL_ENDPOINT}" mirror=""
    mirror="$(bash -c '. "$1" >/dev/null 2>&1 && _hf_mirror_base' _ "$TTS_DOCKER_HF_LIB" 2>/dev/null || true)"
    primary="${primary%/}"
    mirror="${mirror%/}"
    TTS_DOCKER_HF_STAGING_ENDPOINTS="$primary"
    [[ -n "$mirror" && "$mirror" != "$primary" ]] && TTS_DOCKER_HF_STAGING_ENDPOINTS="$primary $mirror"
    return 0
}

# Resolve device, fingerprint and the compose invocation. The container gets
# HF_ENDPOINT only when the operator set it (compose defaults to the Hub).
_tts_docker_prepare() {
    _tts_docker_resolve_device
    TTS_DOCKER_FINGERPRINT="$(_tts_docker_fingerprint)"
    TTS_DOCKER_HF_ENDPOINT="${HF_ENDPOINT:-}"
    TTS_DOCKER_COMPOSE_ARGS=(-f "$TTS_DOCKER_BUILD_DIR/compose.yml")
    [[ "$TTS_DOCKER_DEVICE" == "cuda" ]] && TTS_DOCKER_COMPOSE_ARGS+=(-f "$TTS_DOCKER_BUILD_DIR/compose.gpu.yml")
    TTS_DOCKER_COMPOSE_ENV=(
        "TTS_STAGING=$TTS_DOCKER_STAGING"
        "TTS_PORT=$MODEL_PORT"
        "TTS_DEVICE=$TTS_DOCKER_DEVICE"
        "TORCH_INDEX=$TTS_DOCKER_TORCH_INDEX"
        "TTS_MEM_LIMIT=$MODEL_MEM_LIMIT"
        "TTS_CPUS=$MODEL_CPUS"
        "TTS_PIDS_LIMIT=$MODEL_PIDS_LIMIT"
        "TTS_WEIGHTS_SUBDIR=$MODEL_WEIGHTS_SUBDIR"
        "TTS_IMAGE_FINGERPRINT=$TTS_DOCKER_FINGERPRINT"
        "CORE_NODE_REPO=$TTS_DOCKER_REPO_ROOT"
        "BUILDKIT_PROGRESS=plain"
        "COMPOSE_ANSI=never"
    )
    [[ -n "$TTS_DOCKER_HF_ENDPOINT" ]] && TTS_DOCKER_COMPOSE_ENV+=("HF_ENDPOINT=$TTS_DOCKER_HF_ENDPOINT")
    return 0
}

_tts_docker_compose() {
    env "${TTS_DOCKER_COMPOSE_ENV[@]}" docker compose -p "$TTS_DOCKER_PROJECT" \
        --project-directory "$TTS_DOCKER_BUILD_DIR" "${TTS_DOCKER_COMPOSE_ARGS[@]}" "$@"
}

_tts_docker_image_present() {
    docker image inspect "$TTS_DOCKER_IMAGE" >/dev/null 2>&1
}

_tts_docker_image_label() {
    local label=""
    label="$(docker image inspect -f "{{ index .Config.Labels \"$TTS_DOCKER_FINGERPRINT_LABEL\" }}" "$TTS_DOCKER_IMAGE" 2>/dev/null || true)"
    [[ "$label" == "<no value>" ]] && label=""
    printf '%s' "$label"
}

_tts_docker_image_size_gb() {
    local bytes=""
    bytes="$(docker image inspect -f '{{.Size}}' "$TTS_DOCKER_IMAGE" 2>/dev/null || true)"
    awk -v bytes="${bytes:-0}" 'BEGIN { printf "%.2f", bytes / 1073741824 }'
}

_tts_docker_container_state() {
    docker inspect -f '{{.State.Status}}' "$TTS_DOCKER_CONTAINER" 2>/dev/null || true
}

_tts_docker_container_logs() {
    local line=""
    docker logs --tail "$TTS_DOCKER_LOG_TAIL_LINES" "$TTS_DOCKER_CONTAINER" 2>&1 | while IFS= read -r line; do
        echo "$TTS_DOCKER_TAG [log] $line"
    done
}

_tts_docker_mem_available_mb() {
    awk '/^MemAvailable:/ { printf "%d", $2 / 1024; exit }' /proc/meminfo 2>/dev/null
}

# docker size string (3g, 4608m, 512k, bytes) -> MB.
_tts_docker_size_to_mb() {
    awk -v raw="$1" 'BEGIN {
        value = tolower(raw); unit = substr(value, length(value)); number = value + 0
        if (unit == "g") number = number * 1024
        else if (unit == "k") number = number / 1024
        else if (unit != "m") number = number / 1048576
        printf "%d", number
    }'
}

_tts_docker_disk_free_gb() {
    local path="$1"
    while [[ -n "$path" && ! -e "$path" ]]; do
        path="$(dirname "$path")"
    done
    df -Pk "${path:-/}" 2>/dev/null | awk 'NR == 2 { printf "%.1f", $4 / 1048576 }'
}

_tts_docker_root_dir() {
    local root=""
    root="$(timeout "$TTS_DOCKER_ENGINE_PROBE_SEC" docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
    printf '%s' "${root:-/var/lib/docker}"
}

_tts_docker_is_wsl() {
    local release=""
    [[ -n "${WSL_DISTRO_NAME:-}" ]] && return 0
    release="$(cat /proc/sys/kernel/osrelease 2>/dev/null || true)"
    [[ "${release,,}" == *microsoft* ]]
}

_tts_docker_pid1() {
    cat /proc/1/comm 2>/dev/null || true
}

_tts_docker_wsl_systemd_configured() {
    [[ -f "$TTS_DOCKER_WSL_CONF" ]] || return 1
    awk -v want_section="$TTS_DOCKER_WSL_SYSTEMD_SECTION" -v want_key="$TTS_DOCKER_WSL_SYSTEMD_KEY" \
        -v want_value="$TTS_DOCKER_WSL_SYSTEMD_VALUE" '
        /^[[:space:]]*\[/ { section = tolower($0); gsub(/[[:space:]]/, "", section); gsub(/\[|\]/, "", section); next }
        section == want_section {
            line = $0; sub(/[#;].*/, "", line); eq = index(line, "=")
            if (eq == 0) next
            key = tolower(substr(line, 1, eq - 1)); value = tolower(substr(line, eq + 1))
            gsub(/[[:space:]]/, "", key); gsub(/[[:space:]]/, "", value)
            if (key == want_key) found = value
        }
        END { exit (found == want_value) ? 0 : 1 }
    ' "$TTS_DOCKER_WSL_CONF"
}

# Merge only [boot] systemd=true into /etc/wsl.conf; every other section and
# key is kept as-is.
_tts_docker_wsl_merge_systemd() {
    local tmp=""
    tmp="$(mktemp)" || return 1
    if [[ -f "$TTS_DOCKER_WSL_CONF" ]]; then
        awk -v want_section="$TTS_DOCKER_WSL_SYSTEMD_SECTION" -v want_key="$TTS_DOCKER_WSL_SYSTEMD_KEY" \
            -v want_value="$TTS_DOCKER_WSL_SYSTEMD_VALUE" '
            function insert_key() { if (in_section && !done) { print want_key "=" want_value; done = 1 } }
            /^[[:space:]]*\[/ {
                insert_key()
                name = tolower($0); gsub(/[[:space:]]/, "", name); gsub(/\[|\]/, "", name)
                in_section = (name == want_section)
                if (in_section) seen = 1
                print; next
            }
            in_section {
                line = $0; sub(/[#;].*/, "", line); eq = index(line, "=")
                if (eq > 0) {
                    key = tolower(substr(line, 1, eq - 1)); gsub(/[[:space:]]/, "", key)
                    if (key == want_key) { if (!done) print want_key "=" want_value; done = 1; next }
                }
            }
            { print }
            END {
                insert_key()
                if (!seen) { print ""; print "[" want_section "]"; print want_key "=" want_value }
            }
        ' "$TTS_DOCKER_WSL_CONF" > "$tmp" || { rm -f "$tmp"; return 1; }
    else
        printf '[%s]\n%s=%s\n' "$TTS_DOCKER_WSL_SYSTEMD_SECTION" "$TTS_DOCKER_WSL_SYSTEMD_KEY" "$TTS_DOCKER_WSL_SYSTEMD_VALUE" > "$tmp"
    fi
    cat "$tmp" > "$TTS_DOCKER_WSL_CONF" || { rm -f "$tmp"; return 1; }
    rm -f "$tmp"
    return 0
}

# WSL only: dockerd needs systemd as PID 1. A missing key is merged and the
# action reports restart-required (the Windows bridge terminates the distro
# once and re-runs ensure).
_tts_docker_wsl_systemd_ensure() {
    local pid1=""
    _tts_docker_is_wsl || return 0
    pid1="$(_tts_docker_pid1)"
    if _tts_docker_wsl_systemd_configured; then
        if [[ "$pid1" == "systemd" ]]; then
            _tts_docker_log "WSL: $TTS_DOCKER_WSL_CONF has [$TTS_DOCKER_WSL_SYSTEMD_SECTION] $TTS_DOCKER_WSL_SYSTEMD_KEY=$TTS_DOCKER_WSL_SYSTEMD_VALUE and PID 1 is systemd."
            return 0
        fi
        _tts_docker_set SKIP "$TTS_DOCKER_RESTART_REASON wsl_conf_systemd_set pid1=${pid1:-unknown} terminate_the_distro_then_rerun_ensure"
        return 1
    fi
    if ! _tts_docker_wsl_merge_systemd; then
        _tts_docker_set FAIL "wsl_conf_merge_failed($TTS_DOCKER_WSL_CONF)"
        return 1
    fi
    _tts_docker_log "WSL: merged [$TTS_DOCKER_WSL_SYSTEMD_SECTION] $TTS_DOCKER_WSL_SYSTEMD_KEY=$TTS_DOCKER_WSL_SYSTEMD_VALUE into $TTS_DOCKER_WSL_CONF (other sections kept)."
    _tts_docker_set SKIP "$TTS_DOCKER_RESTART_REASON wsl_conf_systemd_merged pid1=${pid1:-unknown} terminate_the_distro_then_rerun_ensure"
    return 1
}

_tts_docker_host_prereqs() {
    local pkg="" missing=()
    TTS_DOCKER_STEP_NOTE=""
    command -v dpkg >/dev/null 2>&1 || return 0
    for pkg in "${TTS_DOCKER_HOST_PREREQ_PACKAGES[@]}"; do
        dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
    done
    if [[ ${#missing[@]} -eq 0 ]]; then
        _tts_docker_log "host packages present: ${TTS_DOCKER_HOST_PREREQ_PACKAGES[*]}"
        return 0
    fi
    TTS_DOCKER_STEP_NOTE="$(IFS=,; echo "${missing[*]}")"
    _tts_docker_log "installing missing host packages: ${missing[*]}"
    DEBIAN_FRONTEND=noninteractive apt-get update -qq || return 1
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing[@]}"
}

# Docker Engine through the shared dispatcher (START_DOCKER linkage + the
# numbered 79_install_docker.sh chain), in a subprocess so the gvar hub loads
# in its own scope.
_tts_docker_engine_ensure() {
    bash -c '. "$1" || exit 1; docker_prereq_ensure_for_engine "$2" "$3"' _ \
        "$TTS_DOCKER_PREREQ_LIB" "$TTS_DOCKER_MODEL" "$TTS_DOCKER_INSTALL_SHELLS_DIR"
}

_tts_docker_sync_assets() {
    local asset="" assets=()
    mkdir -p "$TTS_DOCKER_BUILD_DIR" || return 1
    for asset in "${TTS_DOCKER_BUILD_FILES[@]}"; do
        _tts_docker_sync_file "$TTS_DOCKER_ASSET_DIR/$asset" "$TTS_DOCKER_BUILD_DIR/$asset" || return 1
    done
    read -r -a assets <<< "$MODEL_CONTEXT_ASSETS"
    for asset in "${assets[@]}"; do
        _tts_docker_sync_file "$TTS_DOCKER_ASSETS_SRC_DIR/$asset" "$TTS_DOCKER_BUILD_DIR/$asset" || return 1
    done
    return 0
}

# Build only when the image is missing or its fingerprint label differs. The
# disk gate applies only when a build is needed.
_tts_docker_build_if_needed() {
    local label="" root="" free_gb="" need_gb=""
    TTS_DOCKER_STEP_NOTE=""
    if _tts_docker_image_present; then
        label="$(_tts_docker_image_label)"
        if [[ "$label" == "$TTS_DOCKER_FINGERPRINT" ]]; then
            _tts_docker_log "image $TTS_DOCKER_IMAGE is current (fingerprint $TTS_DOCKER_FINGERPRINT); no build."
            TTS_DOCKER_STEP_NOTE="unchanged"
            return 0
        fi
        _tts_docker_log "image $TTS_DOCKER_IMAGE fingerprint differs (image=${label:-none} want=$TTS_DOCKER_FINGERPRINT); rebuilding."
    else
        _tts_docker_log "image $TTS_DOCKER_IMAGE is missing; building (the first build takes several minutes)."
    fi
    root="$(_tts_docker_root_dir)"
    free_gb="$(_tts_docker_disk_free_gb "$root")"
    need_gb="$(awk -v est="$MODEL_EST_DISK_GB" -v headroom="$TTS_DOCKER_DISK_HEADROOM_GB" 'BEGIN { printf "%.1f", est + headroom }')"
    if ! _tts_docker_ge "${free_gb:-0}" "$need_gb"; then
        _tts_docker_set SKIP "docker_root_free_gb=${free_gb:-unknown} need=$need_gb root=$root"
        return 1
    fi
    _tts_docker_log "disk gate OK: $root free ${free_gb} GB >= ${need_gb} GB; device=$TTS_DOCKER_DEVICE torch_index=$TTS_DOCKER_TORCH_INDEX"
    if ! _tts_docker_compose build; then
        _tts_docker_set FAIL "image_build_failed(see_build_output_above)"
        return 1
    fi
    label="$(_tts_docker_image_label)"
    if [[ "$label" != "$TTS_DOCKER_FINGERPRINT" ]]; then
        _tts_docker_set FAIL "image_label_mismatch(image=${label:-none})"
        return 1
    fi
    TTS_DOCKER_STEP_NOTE="built"
    return 0
}

_tts_docker_weights_dest() {
    printf '%s/%s' "$TTS_DOCKER_STAGING" "$MODEL_WEIGHTS_SUBDIR"
}

# compose_run keeps its stamp inside the HF cache dir; hf_flat shares the
# native installer's .ckpt_<name>_done sentinel next to the checkpoint dir.
_tts_docker_weights_sentinel() {
    local dest=""
    dest="$(_tts_docker_weights_dest)"
    case "$MODEL_WEIGHTS_METHOD" in
        compose_run) printf '%s/%s' "$dest" "$TTS_DOCKER_WEIGHTS_SENTINEL" ;;
        hf_flat) printf '%s/.ckpt_%s_done' "$(dirname "$dest")" "$(basename "$dest")" ;;
        *) printf '' ;;
    esac
}

_tts_docker_weights_stamp() {
    printf '%s|%s' "$MODEL_WEIGHTS_REPO" "$MODEL_WEIGHTS_ALLOW"
}

_tts_docker_weights_present() {
    local sentinel="" current=""
    sentinel="$(_tts_docker_weights_sentinel)"
    case "$MODEL_WEIGHTS_METHOD" in
        none) return 0 ;;
        compose_run)
            [[ -f "$sentinel" ]] || return 1
            current="$(head -n 1 "$sentinel" 2>/dev/null | tr -d '\r')"
            [[ "$current" == "$(_tts_docker_weights_stamp)" ]]
            ;;
        hf_flat)
            [[ -f "$sentinel" && -f "$(_tts_docker_weights_dest)/config.json" ]]
            ;;
    esac
}

_tts_docker_stage_weights() {
    local dest="" sentinel=""
    TTS_DOCKER_STEP_NOTE=""
    if [[ "$MODEL_WEIGHTS_METHOD" == "none" ]]; then
        TTS_DOCKER_STEP_NOTE="none"
        return 0
    fi
    dest="$(_tts_docker_weights_dest)"
    sentinel="$(_tts_docker_weights_sentinel)"
    if _tts_docker_weights_present; then
        _tts_docker_log "weights present: $MODEL_WEIGHTS_REPO ($sentinel)"
        TTS_DOCKER_STEP_NOTE="present"
        return 0
    fi
    mkdir -p "$dest" || return 1
    _tts_docker_log "staging weights ($MODEL_WEIGHTS_METHOD): $MODEL_WEIGHTS_REPO -> $dest"
    case "$MODEL_WEIGHTS_METHOD" in
        compose_run)
            _tts_docker_resolve_hf_staging_endpoints
            _tts_docker_log "HF endpoints (in order): $TTS_DOCKER_HF_STAGING_ENDPOINTS"
            _tts_docker_compose run --rm --no-deps -T \
                -e "PYCORE_WEIGHTS_REPOS=$MODEL_WEIGHTS_REPO" -e "PYCORE_WEIGHTS_ALLOW=$MODEL_WEIGHTS_ALLOW" \
                -e "PYCORE_HF_ENDPOINTS=$TTS_DOCKER_HF_STAGING_ENDPOINTS" \
                "$TTS_DOCKER_SERVICE" python -c "$TTS_DOCKER_SNAPSHOT_PY" || return 1
            printf '%s\n' "$(_tts_docker_weights_stamp)" > "$sentinel" || return 1
            ;;
        hf_flat)
            bash -c '. "$1" >/dev/null 2>&1 || exit 1; install_hf_repo_flat "$2" "$3" "$4" "$5" "$6" "" "$7"' _ \
                "$TTS_DOCKER_HF_LIB" "$MODEL_WEIGHTS_REPO" "$dest" "$sentinel" "$TTS_DOCKER_TAG " \
                "$MODEL_WEIGHTS_ALLOW" "$(basename "$dest")" || return 1
            ;;
    esac
    _tts_docker_weights_present || return 1
    TTS_DOCKER_STEP_NOTE="staged"
    return 0
}

# One-off import of the model's runtime module inside the image (no model
# load), cached per image fingerprint.
_tts_docker_verify_import() {
    local sentinel="$TTS_DOCKER_BUILD_DIR/$TTS_DOCKER_IMPORT_SENTINEL" current=""
    TTS_DOCKER_STEP_NOTE=""
    if [[ -z "$MODEL_IMPORT_CHECK" ]]; then
        TTS_DOCKER_STEP_NOTE="none"
        return 0
    fi
    current="$(head -n 1 "$sentinel" 2>/dev/null | tr -d '\r' || true)"
    if [[ "$current" == "$TTS_DOCKER_FINGERPRINT" ]]; then
        _tts_docker_log "import check cached for this image: $MODEL_IMPORT_CHECK"
        TTS_DOCKER_STEP_NOTE="cached"
        return 0
    fi
    _tts_docker_log "import check (one-off container, no model load): $MODEL_IMPORT_CHECK"
    _tts_docker_compose run --rm --no-deps -T "$TTS_DOCKER_SERVICE" \
        python -c "$TTS_DOCKER_IMPORT_PY" "$MODEL_IMPORT_CHECK" || return 1
    printf '%s\n' "$TTS_DOCKER_FINGERPRINT" > "$sentinel" || return 1
    TTS_DOCKER_STEP_NOTE="verified"
    return 0
}

_tts_docker_up_core() {
    local label=""
    label="$(_tts_docker_image_label)"
    if [[ "$label" != "$TTS_DOCKER_FINGERPRINT" ]]; then
        _tts_docker_log "[!] image fingerprint differs from the current assets (image=${label:-none}); run ensure to rebuild. Starting the existing image."
    fi
    _tts_docker_compose up -d --no-build || return 1
    [[ "$(_tts_docker_container_state)" == "running" ]]
}

# Stop and remove this model's container only; the image and staging stay.
_tts_docker_down_core() {
    local ids="" left=""
    TTS_DOCKER_STEP_NOTE=""
    if ! command -v docker >/dev/null 2>&1; then
        TTS_DOCKER_STEP_NOTE="docker_cli_absent_nothing_to_stop"
        return 0
    fi
    if ! _tts_docker_engine_active; then
        TTS_DOCKER_STEP_NOTE="engine_not_running_nothing_to_stop"
        return 0
    fi
    if [[ -f "$TTS_DOCKER_BUILD_DIR/compose.yml" ]]; then
        _tts_docker_compose down --remove-orphans --timeout "$TTS_DOCKER_DOWN_TIMEOUT_SEC" || return 1
        TTS_DOCKER_STEP_NOTE="compose_down"
    else
        ids="$(docker ps -aq --filter "name=^/?${TTS_DOCKER_CONTAINER}\$" --filter "label=$TTS_DOCKER_MANAGED_LABEL" 2>/dev/null || true)"
        if [[ -n "$ids" ]]; then
            # shellcheck disable=SC2086
            docker rm -f $ids >/dev/null || return 1
            TTS_DOCKER_STEP_NOTE="managed_container_removed"
        else
            TTS_DOCKER_STEP_NOTE="nothing_running"
        fi
    fi
    left="$(docker ps -q --filter "name=^/?${TTS_DOCKER_CONTAINER}\$" 2>/dev/null || true)"
    if [[ -n "$left" ]]; then
        TTS_DOCKER_STEP_NOTE="container_still_running($left)"
        return 1
    fi
    return 0
}

_tts_docker_wait_health() {
    local url="http://127.0.0.1:${MODEL_PORT}${MODEL_HEALTH_PATH}" deadline=$((SECONDS + MODEL_TEST_TIMEOUT))
    TTS_DOCKER_STEP_NOTE=""
    _tts_docker_log "waiting for $url (timeout ${MODEL_TEST_TIMEOUT}s)"
    while (( SECONDS < deadline )); do
        if curl -fsS -m "$TTS_DOCKER_HTTP_PROBE_SEC" -o /dev/null "$url" 2>/dev/null; then
            _tts_docker_log "health OK after $((MODEL_TEST_TIMEOUT - deadline + SECONDS))s"
            return 0
        fi
        if [[ "$(_tts_docker_container_state)" != "running" ]]; then
            TTS_DOCKER_STEP_NOTE="container_exited_before_health"
            return 1
        fi
        sleep "$TTS_DOCKER_HEALTH_POLL_SEC"
    done
    TTS_DOCKER_STEP_NOTE="health_timeout_${MODEL_TEST_TIMEOUT}s"
    return 1
}

_tts_docker_test_cleanup() {
    [[ "$TTS_DOCKER_TEST_CLEANUP_ARMED" -eq 1 ]] || return 0
    TTS_DOCKER_TEST_CLEANUP_ARMED=0
    _tts_docker_log "test finished; stopping $TTS_DOCKER_PROJECT (image and staging kept)"
    _tts_docker_down_core || _tts_docker_log "[!] down after test reported: ${TTS_DOCKER_STEP_NOTE:-failure}"
}

# Smoke helper for model.sh: a RIFF header and more than TTS_DOCKER_WAV_MIN_BYTES.
tts_docker_wav_ok() {
    local file="$1" size="" header=""
    [[ -f "$file" ]] || return 1
    size="$(wc -c < "$file" 2>/dev/null | tr -d ' ')"
    header="$(head -c 4 "$file" 2>/dev/null)"
    [[ "$header" == "RIFF" && "${size:-0}" -gt "$TTS_DOCKER_WAV_MIN_BYTES" ]] || return 1
    TTS_DOCKER_STEP_NOTE="wav=$file bytes=$size"
    return 0
}

_tts_docker_action_ensure() {
    local image_note="" weights_note="" import_note="" engine_version=""
    if [[ $EUID -ne 0 ]]; then
        _tts_docker_set FAIL "requires_root"
        return 1
    fi
    _tts_docker_wsl_systemd_ensure || return 1
    if ! _tts_docker_host_prereqs; then
        _tts_docker_set FAIL "host_package_install_failed(${TTS_DOCKER_STEP_NOTE:-apt})"
        return 1
    fi
    if ! _tts_docker_engine_ensure; then
        _tts_docker_set FAIL "docker_engine_ensure_failed(see_79_install_docker_output_above)"
        return 1
    fi
    if ! _tts_docker_start_engine; then
        _tts_docker_set FAIL "docker_engine_not_running"
        return 1
    fi
    if ! mkdir -p "$TTS_DOCKER_STAGING"; then
        _tts_docker_set FAIL "staging_not_writable($TTS_DOCKER_STAGING)"
        return 1
    fi
    if ! _tts_docker_sync_assets; then
        _tts_docker_set FAIL "asset_sync_failed($TTS_DOCKER_BUILD_DIR)"
        return 1
    fi
    _tts_docker_prepare
    [[ -n "$TTS_DOCKER_DEVICE_NOTE" ]] && _tts_docker_log "[i] $TTS_DOCKER_DEVICE_NOTE"
    if ! _tts_docker_compose config -q; then
        _tts_docker_set FAIL "compose_config_invalid($TTS_DOCKER_BUILD_DIR/compose.yml)"
        return 1
    fi
    _tts_docker_build_if_needed || return 1
    image_note="$TTS_DOCKER_STEP_NOTE"
    if ! _tts_docker_stage_weights; then
        _tts_docker_set FAIL "weights_stage_failed($MODEL_WEIGHTS_METHOD:${MODEL_WEIGHTS_REPO// /,})"
        return 1
    fi
    weights_note="$TTS_DOCKER_STEP_NOTE"
    if ! _tts_docker_verify_import; then
        _tts_docker_set FAIL "import_check_failed($MODEL_IMPORT_CHECK)"
        return 1
    fi
    import_note="$TTS_DOCKER_STEP_NOTE"
    engine_version="$(docker version --format '{{.Server.Version}}' 2>/dev/null || true)"
    _tts_docker_set PASS "engine=${engine_version:-unknown} image=$image_note weights=$weights_note import=$import_note device=$TTS_DOCKER_DEVICE container=not_started"
    return 0
}

_tts_docker_action_up() {
    _tts_docker_prepare
    [[ -n "$TTS_DOCKER_DEVICE_NOTE" ]] && _tts_docker_log "[i] $TTS_DOCKER_DEVICE_NOTE"
    if ! _tts_docker_start_engine; then
        _tts_docker_set FAIL "docker_engine_not_running_run_ensure"
        return 1
    fi
    if ! _tts_docker_image_present; then
        _tts_docker_set FAIL "image_missing_run_ensure($TTS_DOCKER_IMAGE)"
        return 1
    fi
    if ! _tts_docker_sync_assets; then
        _tts_docker_set FAIL "asset_sync_failed($TTS_DOCKER_BUILD_DIR)"
        return 1
    fi
    if ! _tts_docker_up_core; then
        _tts_docker_container_logs
        _tts_docker_set FAIL "compose_up_failed(state=$(_tts_docker_container_state))"
        return 1
    fi
    _tts_docker_set PASS "running container=$TTS_DOCKER_CONTAINER port=127.0.0.1:$MODEL_PORT device=$TTS_DOCKER_DEVICE mem_limit=$MODEL_MEM_LIMIT cpus=$MODEL_CPUS"
    return 0
}

_tts_docker_action_test() {
    local need_mb=0 have_mb="" started=$SECONDS failure="" smoke_note=""
    _tts_docker_prepare
    [[ -n "$TTS_DOCKER_DEVICE_NOTE" ]] && _tts_docker_log "[i] $TTS_DOCKER_DEVICE_NOTE"
    if ! _tts_docker_start_engine; then
        _tts_docker_set FAIL "docker_engine_not_running_run_ensure"
        return 1
    fi
    need_mb=$(( $(_tts_docker_size_to_mb "$MODEL_MEM_LIMIT") + TTS_DOCKER_MEM_HEADROOM_MB ))
    have_mb="$(_tts_docker_mem_available_mb)"
    if (( ${have_mb:-0} < need_mb )); then
        _tts_docker_set SKIP "mem_available_mb=${have_mb:-unknown} need_mb=$need_mb"
        return 1
    fi
    if ! _tts_docker_image_present; then
        _tts_docker_set FAIL "image_missing_run_ensure($TTS_DOCKER_IMAGE)"
        return 1
    fi
    if ! _tts_docker_weights_present; then
        _tts_docker_set FAIL "weights_missing_run_ensure($(_tts_docker_weights_sentinel))"
        return 1
    fi
    if ! declare -F model_smoke >/dev/null 2>&1; then
        _tts_docker_set FAIL "model_smoke_undefined($TTS_DOCKER_ASSET_DIR/$TTS_DOCKER_MODEL_FILE)"
        return 1
    fi
    if ! _tts_docker_sync_assets; then
        _tts_docker_set FAIL "asset_sync_failed($TTS_DOCKER_BUILD_DIR)"
        return 1
    fi
    _tts_docker_log "pre-flight OK: MemAvailable ${have_mb} MB >= ${need_mb} MB"
    TTS_DOCKER_TEST_CLEANUP_ARMED=1
    trap '_tts_docker_test_cleanup' EXIT
    trap '_tts_docker_test_cleanup; exit 130' INT TERM
    if ! _tts_docker_up_core; then
        failure="compose_up_failed"
    elif ! _tts_docker_wait_health; then
        failure="$TTS_DOCKER_STEP_NOTE"
    elif ! model_smoke "$TTS_DOCKER_STAGING"; then
        failure="smoke_failed"
    else
        smoke_note="$TTS_DOCKER_STEP_NOTE"
    fi
    [[ -n "$failure" ]] && _tts_docker_container_logs
    _tts_docker_test_cleanup
    trap - EXIT INT TERM
    if [[ -n "$failure" ]]; then
        _tts_docker_set FAIL "$failure elapsed_s=$((SECONDS - started))"
        return 1
    fi
    _tts_docker_set PASS "health_ok smoke_ok $smoke_note elapsed_s=$((SECONDS - started)) container=removed"
    return 0
}

_tts_docker_action_down() {
    _tts_docker_prepare
    if ! _tts_docker_down_core; then
        _tts_docker_set FAIL "down_failed(${TTS_DOCKER_STEP_NOTE:-compose})"
        return 1
    fi
    _tts_docker_set PASS "$TTS_DOCKER_STEP_NOTE image_kept staging_kept"
    return 0
}

# Read-only report; PASS means ready to up (engine active, image current,
# weights staged).
_tts_docker_action_status() {
    local engine="absent" compose="absent" active="no" image="missing" size="" label="" freshness="n/a"
    local container="absent" health="n/a" weights="missing" root="/var/lib/docker" disk="" mem="" missing=()
    _tts_docker_prepare
    if command -v docker >/dev/null 2>&1; then
        engine="$(docker version --format '{{.Client.Version}}' 2>/dev/null || true)"
        compose="$(docker compose version --short 2>/dev/null || true)"
        engine="${engine:-unknown}"
        compose="${compose:-absent}"
    fi
    if _tts_docker_engine_active; then
        active="yes"
        root="$(_tts_docker_root_dir)"
        if _tts_docker_image_present; then
            image="present"
            size="$(_tts_docker_image_size_gb)"
            label="$(_tts_docker_image_label)"
            freshness="stale"
            [[ "$label" == "$TTS_DOCKER_FINGERPRINT" ]] && freshness="current"
        fi
        container="$(_tts_docker_container_state)"
        container="${container:-absent}"
        if [[ "$container" == "running" ]]; then
            health="$(curl -s -o /dev/null -m "$TTS_DOCKER_HTTP_PROBE_SEC" -w '%{http_code}' "http://127.0.0.1:${MODEL_PORT}${MODEL_HEALTH_PATH}" 2>/dev/null || true)"
        fi
    fi
    _tts_docker_weights_present && weights="present"
    disk="$(_tts_docker_disk_free_gb "$root")"
    mem="$(_tts_docker_mem_available_mb)"
    _tts_docker_log "model      : $TTS_DOCKER_MODEL (project $TTS_DOCKER_PROJECT, staging $TTS_DOCKER_STAGING)"
    _tts_docker_log "engine     : docker ${engine} compose ${compose} active=${active}"
    _tts_docker_log "image      : $TTS_DOCKER_IMAGE ${image} size_gb=${size:-n/a} fingerprint=${label:-none} expected=$TTS_DOCKER_FINGERPRINT (${freshness})"
    _tts_docker_log "container  : $TTS_DOCKER_CONTAINER ${container} health=${health:-n/a} port=127.0.0.1:$MODEL_PORT$MODEL_HEALTH_PATH"
    _tts_docker_log "weights    : ${weights} ($MODEL_WEIGHTS_METHOD ${MODEL_WEIGHTS_REPO:-none}; sentinel $(_tts_docker_weights_sentinel))"
    _tts_docker_log "device     : $TTS_DOCKER_DEVICE${TTS_DOCKER_DEVICE_NOTE:+ ($TTS_DOCKER_DEVICE_NOTE)}"
    _tts_docker_log "resources  : disk_free_gb=${disk:-unknown} at $root; MemAvailable ${mem:-unknown} MB (test needs $(( $(_tts_docker_size_to_mb "$MODEL_MEM_LIMIT") + TTS_DOCKER_MEM_HEADROOM_MB )) MB)"
    [[ "$active" == "yes" ]] || missing+=("engine")
    [[ "$freshness" == "current" ]] || missing+=("image")
    [[ "$weights" == "present" ]] || missing+=("weights")
    if [[ ${#missing[@]} -gt 0 ]]; then
        _tts_docker_set FAIL "not_ready($(IFS=,; echo "${missing[*]}")) container=$container device=$TTS_DOCKER_DEVICE"
        return 1
    fi
    _tts_docker_set PASS "ready image=current weights=present container=$container device=$TTS_DOCKER_DEVICE"
    return 0
}

# Run one action for one model and print its single RESULT line. Returns 0 only
# on PASS.
tts_docker_run_action() {
    local action="${1:-}" model="${2:-}" staging="${3:-}"
    TTS_DOCKER_STEP_NOTE=""
    _tts_docker_set FAIL "unknown"
    if [[ -z "$action" || " $TTS_DOCKER_ACTIONS " != *" $action "* ]]; then
        _tts_docker_set FAIL "unknown_action(expected:${TTS_DOCKER_ACTIONS// /|})"
    elif [[ -z "$model" ]]; then
        _tts_docker_set FAIL "model_name_required"
    elif _tts_docker_load_model "$model" "$staging"; then
        case "$action" in
            ensure) _tts_docker_action_ensure ;;
            up) _tts_docker_action_up ;;
            test) _tts_docker_action_test ;;
            down) _tts_docker_action_down ;;
            status) _tts_docker_action_status ;;
        esac
    fi
    _tts_docker_print_result "${action:-none}" "${model:-none}"
    [[ "$TTS_DOCKER_STATUS" == "PASS" ]]
}

# Converge one engine's service (ensure, then up). Kept for the engine
# installers that start the service right after install.
tts_docker_apply_engine() {
    local engine="${1:-}" staging="${2:-}"
    tts_docker_run_action ensure "$engine" "$staging" || return 1
    tts_docker_run_action up "$engine" "$staging"
}
