#!/bin/bash
# Qwen3-TTS prerequisite (Linux) — Alibaba qwen-tts package.
# Category 2: Python 3.13 compatible via official qwen-tts (avoid legacy ComfyUI pins).
#
# Official: https://github.com/QwenLM/Qwen3-TTS  pip install -U qwen-tts
#
# Idempotent by default (no switches required): installs deps, downloads or repairs
# HF weights (curl resume + size verification). Skip with QWEN3TTS_SKIP=1.
# --force reinstalls pip deps and re-validates every weight file.
set -uo pipefail

PYTHON="python3"
FORCE=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../../.." && pwd)"
TARGET_DIR="${QWEN3TTS_DIR:-$CORE_NODE_CACHE_DIR/pycore/qwen3tts}"
WEIGHTS_DIR="$TARGET_DIR/weights"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
MODEL_SENTINEL="$TARGET_DIR/.model_installed"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        --full)   shift   ;;
        *) shift ;;
    esac
done

. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"
. "$SCRIPT_DIR/../../common/base_libs/cuda_index.sh"

PIPLOCK_LIB="$SCRIPT_DIR/../../common/base_libs/pip_lock.sh"
[ -f "$PIPLOCK_LIB" ] && . "$PIPLOCK_LIB"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }
pip_i() { vpip "$PYTHON" -m pip install --break-system-packages "$@" 2>/dev/null || vpip "$PYTHON" -m pip install "$@"; }

resolve_python() {
    local p
    for p in "$PYTHON" python3 python; do
        if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
            command -v "$p"; return 0
        fi
    done
    return 1
}

echo "============================================================"
echo " [install_qwen3tts] Qwen3-TTS (Alibaba qwen-tts)"
echo "============================================================"

[[ "${QWEN3TTS_SKIP:-0}" == "1" ]] && { echo "[install_qwen3tts] [i] QWEN3TTS_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_qwen3tts] " qwen_tts; }

if ! PYTHON="$(resolve_python)"; then
    echo "[install_qwen3tts] [!] Python 3 not found."
    complete_prereq_step "$PYTHON" "[install_qwen3tts] " qwen_tts
fi

mkdir -p "$TARGET_DIR"
_gpu_flag="--cpu"
if gpu_present; then _gpu_flag="--gpu"; fi
_qwen_model="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" qwen3tts_model "$_gpu_flag")"
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" qwen3tts | while read -r _line; do
    echo "[install_qwen3tts]  official env (qwen3tts): $_line"
done
echo "[install_qwen3tts]  staging : $TARGET_DIR"
echo "[install_qwen3tts]  weights : $WEIGHTS_DIR"
echo "[install_qwen3tts]  model   : $_qwen_model"
echo "[install_qwen3tts]  sentinel: $MODEL_SENTINEL ($([ -f "$MODEL_SENTINEL" ] && echo present || echo absent))"

ensure_sox_on_path "[install_qwen3tts] " || true

if [[ -f "$DEPS_SENTINEL" && -f "$MODEL_SENTINEL" && "$FORCE" -eq 0 ]]; then
    _sentinel_model="$(tr -d '\r\n\ufeff' < "$MODEL_SENTINEL" 2>/dev/null || true)"
    if [[ "$_sentinel_model" == "$_qwen_model" ]] && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_qwen_model"; then
        tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "Qwen3-TTS already installed (deps + verified model)"
        complete_prereq_step "$PYTHON" "[install_qwen3tts] " qwen_tts
    fi
    if [[ "$_sentinel_model" != "$_qwen_model" ]]; then
        echo "[install_qwen3tts] [..] model tier changed (${_sentinel_model:-unknown} -> $_qwen_model); refreshing weights."
    elif ! neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_qwen_model"; then
        echo "[install_qwen3tts] [..] local weights incomplete or corrupt; repairing download."
    fi
fi

if [[ -f "$DEPS_SENTINEL" && "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "dependencies already installed (.deps_done)"
else
    install_pycore_torch_stack "$PYTHON" "[install_qwen3tts] "
    echo "[install_qwen3tts] [..] pip install -U qwen-tts soundfile ..."
    pip_i -U qwen-tts soundfile || true
    date -u +%Y-%m-%dT%H:%M:%SZ > "$DEPS_SENTINEL"
    echo "[install_qwen3tts] [OK] dependencies installed."
fi

_model_ready=0
if [[ -f "$MODEL_SENTINEL" && "$FORCE" -eq 0 ]]; then
    _sentinel_model="$(tr -d '\r\n\ufeff' < "$MODEL_SENTINEL" 2>/dev/null || true)"
    if [[ "$_sentinel_model" == "$_qwen_model" ]] && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_qwen_model"; then
        tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "model weights verified ($_qwen_model)"
        _model_ready=1
    fi
fi
if [[ "$_model_ready" -eq 0 ]]; then
    echo "[install_qwen3tts] [..] downloading/repairing model '$_qwen_model' (curl, resumable) ..."
    if install_hf_repo_flat "$_qwen_model" "$WEIGHTS_DIR" "$MODEL_SENTINEL" "[install_qwen3tts] " "*" "$(_hf_mirror_base)" "$_qwen_model" \
        && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_qwen_model"; then
        echo "[install_qwen3tts] [OK] model '$_qwen_model' ready at $WEIGHTS_DIR."
    else
        echo "[install_qwen3tts] [!] model download not finished; partial files kept at $WEIGHTS_DIR; will RESUME next run."
    fi
fi

echo "[install_qwen3tts] [OK] Qwen3-TTS ready. export QWEN3TTS_MODEL=$_qwen_model"
if [[ -f "$MODEL_SENTINEL" ]] && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_qwen_model"; then
    echo "[install_qwen3tts]  local weights auto-detected: $WEIGHTS_DIR"
fi
complete_prereq_step "$PYTHON" "[install_qwen3tts] " qwen_tts
