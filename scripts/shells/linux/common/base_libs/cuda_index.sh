#!/usr/bin/env bash
# Unified CUDA policy for PyTorch, Paddle, and the CUDA toolkit.

_CUDA_INDEX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_RUNTIME_POLICY_FILE="$(cd "$_CUDA_INDEX_DIR/../../.." && pwd)/ai_runtime_policy.env"
source "$AI_RUNTIME_POLICY_FILE"

AI_CUDA_TIERS="${AI_CUDA_TIERS:-}"
AI_TORCH_INDEX_BASE="${AI_TORCH_INDEX_BASE:-https://download.pytorch.org/whl}"
AI_TORCH_CPU_INDEX="${AI_TORCH_CPU_INDEX:-https://download.pytorch.org/whl/cpu}"
AI_PADDLE_INDEX_BASE="${AI_PADDLE_INDEX_BASE:-https://www.paddlepaddle.org.cn/packages/stable}"
AI_PADDLE_CPU_INDEX="${AI_PADDLE_CPU_INDEX:-https://www.paddlepaddle.org.cn/packages/stable/cpu/}"

cuda_driver_version() {
    local output ver
    if ! command -v nvidia-smi >/dev/null 2>&1; then printf '%s' ""; return 0; fi
    output="$(nvidia-smi 2>/dev/null || true)"
    ver="$(printf '%s\n' "$output" | grep -oE 'CUDA (UMD )?Version: [0-9.]+' | head -1)"
    ver="${ver#CUDA UMD Version: }"
    ver="${ver#CUDA Version: }"
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

cuda_policy_tag() {
    local cv requested torch_tag paddle_tag row tag minimum
    local -a cuda_rows
    cv="$(cuda_driver_cv)"
    [[ -n "$cv" ]] || { printf '%s' ""; return 0; }
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
        IFS=':' read -r tag minimum _ <<< "$row"
        if [[ "$cv" -ge "$minimum" ]]; then printf '%s' "$tag"; return 0; fi
    fi
    IFS=',' read -ra cuda_rows <<< "$AI_CUDA_TIERS"
    for row in "${cuda_rows[@]}"; do
        IFS=':' read -r tag minimum _ <<< "$row"
        if [[ "$cv" -ge "$minimum" ]]; then printf '%s' "$tag"; return 0; fi
    done
    printf '%s' ""
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
