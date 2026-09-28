#!/usr/bin/env bash
# Unified CUDA policy for PyTorch, Paddle, and the CUDA toolkit.

_CUDA_INDEX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_RUNTIME_POLICY_FILE="$(cd "$_CUDA_INDEX_DIR/../../.." && pwd)/ai_runtime_policy.env"
source "$AI_RUNTIME_POLICY_FILE"
# Hardware presence (driver-independent) for the no-driver fallback below.
if ! type gpu_hardware_present >/dev/null 2>&1; then
    source "$_CUDA_INDEX_DIR/lib_gpu.sh"
fi

AI_CUDA_TIERS="${AI_CUDA_TIERS:-}"
AI_TORCH_INDEX_BASE="${AI_TORCH_INDEX_BASE:-https://download.pytorch.org/whl}"
AI_TORCH_CPU_INDEX="${AI_TORCH_CPU_INDEX:-https://download.pytorch.org/whl/cpu}"
AI_PADDLE_INDEX_BASE="${AI_PADDLE_INDEX_BASE:-https://www.paddlepaddle.org.cn/packages/stable}"
AI_PADDLE_CPU_INDEX="${AI_PADDLE_CPU_INDEX:-https://www.paddlepaddle.org.cn/packages/stable/cpu/}"

# Run-scoped memoization (same contract as lib_gpu.sh): the pyservice orchestrator
# exports PYCORE_CUDA_DRIVER_VERSION(+_SET) and PYCORE_CUDA_POLICY_TAG(+_SET/_SIG)
# once per run so child installers skip the nvidia-smi spawn; standalone scripts
# detect on their own and memoize in-process. The policy-tag cache is keyed by the
# override signature (CORE_CUDA_TAG|PYTORCH_CUDA_INDEX_URL|PADDLE_CUDA_INDEX_URL)
# so a changed override always recomputes.
_CUDA_DRIVER_VERSION_CACHE=""
_CUDA_DRIVER_VERSION_CACHE_SET=0
_CUDA_POLICY_TAG_CACHE=""
_CUDA_POLICY_TAG_CACHE_SET=0
_CUDA_POLICY_TAG_SIG=""

cuda_driver_version() {
    local output ver
    if [[ "$_CUDA_DRIVER_VERSION_CACHE_SET" == "1" ]]; then
        printf '%s' "$_CUDA_DRIVER_VERSION_CACHE"
        return 0
    fi
    if [[ "${PYCORE_CUDA_DRIVER_VERSION_SET:-}" == "1" ]]; then
        ver="${PYCORE_CUDA_DRIVER_VERSION:-}"
    elif ! command -v nvidia-smi >/dev/null 2>&1; then
        ver=""
    else
        output="$(nvidia-smi 2>/dev/null || true)"
        ver="$(printf '%s\n' "$output" | grep -oE 'CUDA (UMD )?Version: [0-9.]+' | head -1)"
        ver="${ver#CUDA UMD Version: }"
        ver="${ver#CUDA Version: }"
    fi
    _CUDA_DRIVER_VERSION_CACHE="$ver"
    _CUDA_DRIVER_VERSION_CACHE_SET=1
    printf '%s' "$ver"
}

cuda_driver_cv() {
    local ver major minor
    ver="$(cuda_driver_version)"
    major="${ver%%.*}"
    minor="${ver#*.}"
    minor="${minor%%.*}"
    if [[ -n "$major" && "$major" -eq "$major" ]] 2>/dev/null; then
        printf '%s' "$((major * 100 + ${minor:-0}))"
    fi
}

cuda_tag_from_url() {
    local url="${1:-}" tag
    tag="$(printf '%s' "$url" | grep -oE 'cu[0-9]{3}' | tail -1)"
    printf '%s' "$tag"
}

cuda_policy_row_by_tag() {
    local wanted="${1:-}" row
    local -a cuda_rows
    IFS=',' read -ra cuda_rows <<< "$AI_CUDA_TIERS"
    for row in "${cuda_rows[@]}"; do
        [[ "${row%%:*}" == "$wanted" ]] && { printf '%s' "$row"; return 0; }
    done
    return 1
}

# Newest configured tier row (highest minimum driver cv; rows may be unordered).
# Mirrors runtime_abi._load_cuda_tiers sorting (minimum_driver_cv DESC).
cuda_policy_newest_row() {
    local row best="" best_min=-1 tag minimum
    local -a cuda_rows
    IFS=',' read -ra cuda_rows <<< "$AI_CUDA_TIERS"
    for row in "${cuda_rows[@]}"; do
        IFS=':' read -r tag minimum _ <<< "$row"
        [[ "$minimum" =~ ^[0-9]+$ ]] || continue
        if [[ "$minimum" -gt "$best_min" ]]; then best_min="$minimum"; best="$row"; fi
    done
    printf '%s' "$best"
}

# 0 when the active driver reports a CUDA cv but it is below EVERY configured
# tier (driver too old for the unified policy; needs an upgrade, not CPU wheels).
cuda_policy_driver_below_tiers() {
    local cv
    cv="$(cuda_driver_cv)"
    [[ -n "$cv" ]] || return 1
    [[ -z "$(cuda_policy_tag)" ]]
}

cuda_policy_tag() {
    local cv requested torch_tag paddle_tag row tag minimum row_tag sig
    local -a cuda_rows
    sig="${CORE_CUDA_TAG:-}|${PYTORCH_CUDA_INDEX_URL:-}|${PADDLE_CUDA_INDEX_URL:-}"
    if [[ "$_CUDA_POLICY_TAG_CACHE_SET" == "1" && "$sig" == "$_CUDA_POLICY_TAG_SIG" ]]; then
        printf '%s' "$_CUDA_POLICY_TAG_CACHE"
        return 0
    fi
    if [[ "${PYCORE_CUDA_POLICY_TAG_SET:-}" == "1" && "$sig" == "${PYCORE_CUDA_POLICY_TAG_SIG:-}" ]]; then
        _CUDA_POLICY_TAG_CACHE="${PYCORE_CUDA_POLICY_TAG:-}"
        _CUDA_POLICY_TAG_SIG="$sig"
        _CUDA_POLICY_TAG_CACHE_SET=1
        printf '%s' "$_CUDA_POLICY_TAG_CACHE"
        return 0
    fi
    tag=""
    cv="$(cuda_driver_cv)"
    if [[ -z "$cv" ]]; then
        # No driver report (driver absent or not yet loaded pre-reboot): when the
        # hardware is physically present, select a tier so install steps still fetch
        # CUDA wheels/toolkit; the distro driver on Debian 13 / Ubuntu 26 (550+/580+)
        # supports the newest tier. CPU hosts keep "".
        if gpu_hardware_present 2>/dev/null; then
            requested="${CORE_CUDA_TAG:-}"
            if [[ -z "$requested" ]]; then
                requested="$(cuda_tag_from_url "${PYTORCH_CUDA_INDEX_URL:-}")"
            fi
            if [[ -n "$requested" ]] && row="$(cuda_policy_row_by_tag "$requested")"; then
                tag="${row%%:*}"
            else
                IFS=',' read -ra cuda_rows <<< "$AI_CUDA_TIERS"
                [[ -n "${cuda_rows[0]:-}" ]] && tag="${cuda_rows[0]%%:*}"
            fi
        fi
        _CUDA_POLICY_TAG_CACHE="$tag"
        _CUDA_POLICY_TAG_SIG="$sig"
        _CUDA_POLICY_TAG_CACHE_SET=1
        printf '%s' "$tag"
        return 0
    fi
    requested="${CORE_CUDA_TAG:-}"
    torch_tag="$(cuda_tag_from_url "${PYTORCH_CUDA_INDEX_URL:-}")"
    paddle_tag="$(cuda_tag_from_url "${PADDLE_CUDA_INDEX_URL:-}")"
    if [[ -z "$requested" ]]; then
        if [[ -n "$torch_tag" && -n "$paddle_tag" && "$torch_tag" != "$paddle_tag" ]]; then
            requested=""
        elif [[ -n "$torch_tag" ]]; then
            requested="$torch_tag"
        else
            requested="$paddle_tag"
        fi
    fi
    if [[ -n "$requested" ]] && row="$(cuda_policy_row_by_tag "$requested")"; then
        IFS=':' read -r row_tag minimum _ <<< "$row"
        if [[ "$cv" -ge "$minimum" ]]; then tag="$row_tag"; fi
    fi
    if [[ -z "$tag" ]]; then
        IFS=',' read -ra cuda_rows <<< "$AI_CUDA_TIERS"
        for row in "${cuda_rows[@]}"; do
            IFS=':' read -r row_tag minimum _ <<< "$row"
            if [[ "$cv" -ge "$minimum" ]]; then tag="$row_tag"; break; fi
        done
    fi
    _CUDA_POLICY_TAG_CACHE="$tag"
    _CUDA_POLICY_TAG_SIG="$sig"
    _CUDA_POLICY_TAG_CACHE_SET=1
    printf '%s' "$tag"
}

cuda_policy_field() {
    local field="$1" tag="${2:-}" row parsed_tag parsed_minimum parsed_major parsed_toolkit parsed_driver
    [[ -n "$tag" ]] || tag="$(cuda_policy_tag)"
    row="$(cuda_policy_row_by_tag "$tag")" || return 1
    IFS=':' read -r parsed_tag parsed_minimum parsed_major parsed_toolkit parsed_driver <<< "$row"
    case "$field" in
        major) printf '%s' "$parsed_major" ;;
        toolkit) printf '%s' "$parsed_toolkit" ;;
        toolkit_driver) printf '%s' "$parsed_driver" ;;
        *) return 1 ;;
    esac
}

torch_cuda_index_url() {
    local tag override_tag
    tag="$(cuda_policy_tag)"
    [[ -n "$tag" ]] || { printf '%s' "$AI_TORCH_CPU_INDEX"; return 0; }
    override_tag="$(cuda_tag_from_url "${PYTORCH_CUDA_INDEX_URL:-}")"
    if [[ -n "${PYTORCH_CUDA_INDEX_URL:-}" && "$override_tag" == "$tag" ]]; then
        printf '%s' "$PYTORCH_CUDA_INDEX_URL"
    else
        printf '%s' "$AI_TORCH_INDEX_BASE/$tag"
    fi
}

paddle_cuda_index_url() {
    local tag override_tag
    tag="$(cuda_policy_tag)"
    [[ -n "$tag" ]] || { printf '%s' "$AI_PADDLE_CPU_INDEX"; return 0; }
    override_tag="$(cuda_tag_from_url "${PADDLE_CUDA_INDEX_URL:-}")"
    if [[ -n "${PADDLE_CUDA_INDEX_URL:-}" && "$override_tag" == "$tag" ]]; then
        printf '%s' "$PADDLE_CUDA_INDEX_URL"
    else
        printf '%s' "$AI_PADDLE_INDEX_BASE/$tag/"
    fi
}

canonical_torch_packages_csv() {
    local tag key value
    tag="$(cuda_policy_tag)"
    key="AI_TORCH_PACKAGES"
    if [[ -n "$tag" ]]; then
        key="AI_TORCH_PACKAGES_${tag^^}"
    fi
    value="${!key:-}"
    if [[ -z "$value" ]]; then
        value="${AI_TORCH_PACKAGES:-torch,torchvision,torchaudio}"
    fi
    printf '%s' "$value"
}
