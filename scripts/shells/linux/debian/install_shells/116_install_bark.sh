#!/bin/bash
# Bark TTS prerequisite (Linux) — Suno via Hugging Face transformers.
# Category 1 / Bucket A: Python 3.x native, in-process local model that SHARES the
# main interpreter's single pinned transformers with deepseek/qwen25/nllb.
#
# Lifecycle rule (see development-guides/cross-docs/
# TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §7, Bucket A): Bark installs transformers
# at the SHARED pin $LLM_TRANSFORMERS_SPEC, version-idempotently (only when absent) and
# NEVER with --upgrade. --upgrade is the race that clobbers the pinned stack the parallel
# LLM installers share, so it is forbidden here.
#
# Official: https://huggingface.co/docs/transformers/model_doc/bark
#   pip install transformers scipy   (Do NOT pip install bark — wrong PyPI package.)
#
# Invocation: 116_install_bark.sh --python <py> [--full] [--force]
# Env: BARK_SKIP=1, BARK_INSTALL=1, NEURAL_TTS_INSTALL=1, BARK_DIR, BARK_MODEL
set -uo pipefail

PYTHON="python3"
FORCE=0
DO_FULL=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
CACHE_ROOT="${CORE_NODE_CACHE_DIR:-$CORE_NODE_ROOT/.cache}"
TARGET_DIR="${BARK_DIR:-$CACHE_ROOT/pycore/bark}"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
WEIGHTS_DIR="$TARGET_DIR/weights"
MODEL_SENTINEL="$TARGET_DIR/.model_installed"
WEIGHT_ALLOW="pytorch_model.bin,config.json,generation_config.json,tokenizer.json,tokenizer_config.json,special_tokens_map.json,vocab.txt,speaker_embeddings_path.json,speaker_embeddings/*.npy,speaker_embeddings/v2/*.npy"
# Shared Bucket-A transformers pin is loaded by common_functions.sh.
LLM_TRANSFORMERS_SPEC="${LLM_TRANSFORMERS_SPEC:-${AI_SHARED_TRANSFORMERS_SPEC:-transformers}}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        --full)   DO_FULL=1;   shift   ;;
        *) shift ;;
    esac
done
[[ "${BARK_INSTALL:-0}" == "1" || "${NEURAL_TTS_INSTALL:-0}" == "1" ]] && DO_FULL=1

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
echo " [install_bark] Bark (Suno / transformers)"
echo "============================================================"

[[ "${BARK_SKIP:-0}" == "1" ]] && { echo "[install_bark] [i] BARK_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_bark] " --absent-ok "BARK_SKIP=1" transformers; }
if tts_dependencies_ready "$PYTHON" "bark" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 && "$DO_FULL" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "Bark already installed"
    complete_prereq_step "$PYTHON" "[install_bark] " transformers
fi
if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]]; then
    echo "[install_bark] [i] opt-in only. Pass --full, BARK_INSTALL=1, or NEURAL_TTS_INSTALL=1."
    complete_prereq_step "$PYTHON" "[install_bark] " --absent-ok "opt-in" transformers
fi

if ! PYTHON="$(resolve_python)"; then
    echo "[install_bark] [!] Python 3 not found."
    fail_prereq_step "$PYTHON" "[install_bark] " transformers
fi

mkdir -p "$TARGET_DIR"
_gpu_flag="--cpu"
if gpu_present; then _gpu_flag="--gpu"; fi
_bark_model="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" bark_model "$_gpu_flag")"
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" bark | while read -r _line; do
    echo "[install_bark]  official env (bark): $_line"
done
echo "[install_bark]  staging : $TARGET_DIR"
echo "[install_bark]  weights : $WEIGHTS_DIR"
echo "[install_bark]  compute : $(gpu_present && echo 'CUDA GPU' || echo 'CPU only')"
echo "[install_bark]  model   : $_bark_model"
echo "[install_bark]  sentinel: $MODEL_SENTINEL ($([ -f "$MODEL_SENTINEL" ] && echo present || echo absent))"

if tts_dependencies_ready "$PYTHON" "bark" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "dependencies already installed (.deps_done)"
else
    install_pycore_torch_stack "$PYTHON" "[install_bark] "
    # Bucket A: install transformers at the SHARED pin, version-idempotently and NEVER
    # --upgrade (that clobbers the pin the deepseek/qwen25/nllb stack shares in this
    # interpreter). Install only when missing; matches 98_install_qwen25.sh. scipy +
    # accelerate ride along.
    if shared_transformers_matches_from_common_functions "$PYTHON" && "$PYTHON" -c "import scipy, accelerate" >/dev/null 2>&1; then
        echo "[install_bark] [OK] transformers/scipy/accelerate already present; keeping the shared pin."
    else
        echo "[install_bark] [..] pip install $LLM_TRANSFORMERS_SPEC scipy accelerate ..."
        pip_i "$LLM_TRANSFORMERS_SPEC" scipy accelerate || true
    fi
    if tts_engine_health_ok "$PYTHON" "bark" && tts_write_dependency_stamp "$PYTHON" "bark" "$DEPS_SENTINEL"; then
        echo "[install_bark] [OK] dependencies installed."
    else
        echo "[install_bark] [!] dependencies are incomplete; retrying next run." >&2
        fail_prereq_step "$PYTHON" "[install_bark] " transformers
    fi
fi

# --- HF weights (IDEMPOTENT: sentinel + curl resume + HF size verification) --- #
# Transformers Bark uses the main PyTorch checkpoint plus config/tokenizer and
# speaker preset files; original Bark component .pt files are not pre-downloaded.
_model_ready=0
if [[ -f "$MODEL_SENTINEL" && "$FORCE" -eq 0 ]]; then
    _sentinel_model="$(cat "$MODEL_SENTINEL" 2>/dev/null | tr -d '\r\n')"
    if [[ -n "$_sentinel_model" && "$_sentinel_model" == "$_bark_model" ]] && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_bark_model" "$PYTHON"; then
        tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "model weights verified ($_bark_model)"
        _model_ready=1
    elif [[ -n "$_sentinel_model" && "$_sentinel_model" != "$_bark_model" ]]; then
        echo "[install_bark] [..] model tier changed ($_sentinel_model -> $_bark_model); refreshing weights."
    elif ! neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_bark_model" "$PYTHON"; then
        echo "[install_bark] [..] local weights incomplete or corrupt; repairing download."
    fi
fi
if [[ "$_model_ready" -eq 0 ]]; then
    echo "[install_bark] [..] downloading/repairing model '$_bark_model' (curl, resumable) ..."
    if install_hf_repo_flat "$_bark_model" "$WEIGHTS_DIR" "$MODEL_SENTINEL" "[install_bark] " "$WEIGHT_ALLOW" "" "$_bark_model" \
       && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_bark_model" "$PYTHON"; then
        _model_ready=1
        echo "[install_bark] [OK] model '$_bark_model' ready at $WEIGHTS_DIR."
    else
        echo "[install_bark] [!] model download not finished; partial files kept at $WEIGHTS_DIR; will RESUME next run."
        fail_prereq_step "$PYTHON" "[install_bark] " transformers
    fi
fi

if [[ "$_model_ready" -ne 1 ]]; then
    fail_prereq_step "$PYTHON" "[install_bark] " transformers
fi

echo "[install_bark] [OK] Bark ready. Weights pre-downloaded (idempotent); engine auto-detects local."
if [[ -f "$MODEL_SENTINEL" ]] && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_bark_model" "$PYTHON"; then
    echo "[install_bark]  local weights auto-detected: $WEIGHTS_DIR"
fi
echo "[install_bark]  export BARK_MODEL/ BARK_VOICE_PRESET to override."
complete_prereq_step "$PYTHON" "[install_bark] " transformers
