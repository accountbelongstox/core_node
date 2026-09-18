#!/bin/bash
# tts_docker_compose_common.sh - per-engine TTS docker compose converge (plan 19).
#
# Contract:
#   * Assets under scripts/shells/docker_compose/tts/<engine>/ are synced into
#     <staging>/docker by content compare - identical content is never rewritten.
#   * Converge is per-engine (project pycore-tts-<engine>), never the whole stack;
#     a container with the same compose fingerprint is left running untouched.
#   * The GPU overlay (compose.gpu.yml) is applied only when the engine device
#     policy resolves to CUDA (explicit <ENGINE>_DEVICE=cuda*, or auto with a
#     visible nvidia-smi); the TORCH_INDEX build arg follows the same decision
#     (fishspeech pins the cu128 wheel tier for its torch==2.8.0 ABI).
#   * Runtime never builds/pulls here; this helper is install-chain only.

# Engine -> container port map (loopback-published; container binds match).
_tts_docker_port() {
    case "$1" in
        melotts)    printf '57212' ;;
        voxcpm2)    printf '57214' ;;
        cosyvoice)  printf '50000' ;;
        fishspeech) printf '8080'  ;;
        gptsovits)  printf '9880'  ;;
        *)          printf ''      ;;
    esac
}

# Extra build-context asset files (pycore/tts_install_assets) per engine.
_tts_docker_context_assets() {
    case "$1" in
        melotts)  printf '%s\n' "melotts_api_server.py" "tts_text_chunking.py" ;;
        voxcpm2)  printf '%s\n' "voxcpm2_api_server.py" "tts_text_chunking.py" "tts_audio_assembly.py" ;;
        gptsovits) printf '%s\n' "gptsovits_build_constraints.txt" ;;
        *)        : ;;
    esac
}

_tts_docker_repo_root() {
    local here
    here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    (cd "$here/../../../.." && pwd)
}

# Sync one file by content compare (idempotent per minimal operation).
_tts_docker_sync_file() {
    local src="$1" dst="$2"
    [[ -f "$src" ]] || { echo "[tts-docker][!] asset missing: $src" >&2; return 1; }
    if [[ -f "$dst" ]] && cmp -s "$src" "$dst"; then
        return 0
    fi
    mkdir -p "$(dirname "$dst")"
    cp -f "$src" "$dst"
    echo "[tts-docker] synced $(basename "$dst")"
}

_tts_docker_device() {
    # cpu | cuda (auto probes a visible NVIDIA device)
    local engine="$1" want
    want="$(printenv "${engine^^}_DEVICE" 2>/dev/null || true)"
    want="${want:-auto}"
    case "$want" in
        cpu) printf 'cpu'; return 0 ;;
        cuda*) printf 'cuda'; return 0 ;;
    esac
    if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1; then
        printf 'cuda'
    else
        printf 'cpu'
    fi
}

_tts_docker_torch_index() {
    local engine="$1" device="$2"
    [[ "$device" == "cpu" ]] && { printf 'https://download.pytorch.org/whl/cpu'; return 0; }
    if [[ "$engine" == "fishspeech" ]]; then
        # torch==2.8.0 ABI pin has no cu130 wheels; newest carrying tier.
        printf 'https://download.pytorch.org/whl/cu128'
    else
        printf 'https://download.pytorch.org/whl/cu130'
    fi
}

# Converge one engine's compose service. Returns non-zero with a phase message
# on failure; never touches other projects/containers.
tts_docker_apply_engine() {
    local engine="${1:-}" staging="${2:-}"
    local repo_root asset_dir docker_dir port device torch_index
    local fingerprint_file fingerprint container_id compose_files
    local asset fingerprint_assets=()
    [[ -z "$engine" || -z "$staging" ]] && { echo "[tts-docker][!] engine and staging dir are required" >&2; return 1; }
    command -v docker >/dev/null 2>&1 || { echo "[tts-docker][!] docker CLI missing" >&2; return 1; }
    docker compose version >/dev/null 2>&1 || { echo "[tts-docker][!] docker compose plugin missing" >&2; return 1; }

    repo_root="$(_tts_docker_repo_root)"
    asset_dir="$repo_root/scripts/shells/docker_compose/tts/$engine"
    docker_dir="$staging/docker"
    port="$(_tts_docker_port "$engine")"
    [[ -d "$asset_dir" ]] || { echo "[tts-docker][!] no compose assets for $engine ($asset_dir)" >&2; return 1; }
    [[ -n "$port" ]] || { echo "[tts-docker][!] no port mapping for $engine" >&2; return 1; }

    _tts_docker_sync_file "$asset_dir/Dockerfile" "$docker_dir/Dockerfile" || return 1
    _tts_docker_sync_file "$asset_dir/compose.yml" "$docker_dir/compose.yml" || return 1
    _tts_docker_sync_file "$asset_dir/compose.gpu.yml" "$docker_dir/compose.gpu.yml" || return 1
    while IFS= read -r asset; do
        [[ -z "$asset" ]] && continue
        _tts_docker_sync_file "$repo_root/pycore/tts_install_assets/$asset" "$docker_dir/$asset" || return 1
        fingerprint_assets+=("$docker_dir/$asset")
    done < <(_tts_docker_context_assets "$engine")

    device="$(_tts_docker_device "$engine")"
    torch_index="$(_tts_docker_torch_index "$engine" "$device")"
    compose_files=(-f "$docker_dir/compose.yml")
    [[ "$device" == "cuda" ]] && compose_files+=(-f "$docker_dir/compose.gpu.yml")
    echo "[tts-docker] $engine device=$device torch_index=$torch_index port=$port"

    fingerprint="$(cat "$docker_dir/Dockerfile" "$docker_dir/compose.yml" "$docker_dir/compose.gpu.yml" "${fingerprint_assets[@]}" 2>/dev/null | sha256sum | cut -d' ' -f1)"
    fingerprint="$(printf '%s' "$fingerprint" | tr -d ' \r\n'):$device"
    fingerprint_file="$docker_dir/.compose_fingerprint"
    container_id="$(docker ps -aq -f "name=^pycore-tts-${engine}$" 2>/dev/null | head -n 1)"
    if [[ -n "$container_id" && -f "$fingerprint_file" ]] \
        && [[ "$(tr -d '\r\n' < "$fingerprint_file")" == "$fingerprint" ]]; then
        echo "[tts-docker] $engine compose service unchanged; container $container_id left as-is."
        return 0
    fi

    echo "[tts-docker] converging compose project pycore-tts-$engine (build may take minutes on first run) ..."
    if ! (cd "$docker_dir" && TTS_STAGING="$staging" TTS_PORT="$port" TTS_DEVICE="$device" TORCH_INDEX="$torch_index" \
            docker compose -p "pycore-tts-$engine" "${compose_files[@]}" up -d --build); then
        echo "[tts-docker][!] docker compose up failed for $engine (phase above)." >&2
        return 1
    fi
    printf '%s\n' "$fingerprint" > "$fingerprint_file"
    echo "[tts-docker] [OK] pycore-tts-$engine is up (loopback port $port)."
    return 0
}
