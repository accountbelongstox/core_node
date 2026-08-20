#!/bin/bash
# Parler-TTS prerequisite (Linux) - Hugging Face parler-tts.
# Category 1: Python 3.13 native with the shared torch distribution.
#
# Official: pip install git+https://github.com/huggingface/parler-tts.git
#
# Invocation: 181_install_parler.sh --python <py> [--full] [--force]
# Env: PARLER_SKIP=1, PARLER_INSTALL=1, NEURAL_TTS_INSTALL=1, PARLER_DIR, PARLER_MODEL
set -uo pipefail

PYTHON="python3"
FORCE=0
DO_FULL=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
CACHE_ROOT="${CORE_NODE_CACHE_DIR:-$CORE_NODE_ROOT/.cache}"
TARGET_DIR="${PARLER_DIR:-$CACHE_ROOT/pycore/parler}"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
WEIGHTS_DIR="$TARGET_DIR/weights"
MODEL_SENTINEL="$TARGET_DIR/.model_installed"
WEIGHT_ALLOW="*.bin,*.safetensors,*.pt,*.json,*.txt,*.model,*.vocab"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        --full)   DO_FULL=1;   shift   ;;
        *) shift ;;
    esac
done
[[ "${PARLER_INSTALL:-0}" == "1" || "${NEURAL_TTS_INSTALL:-0}" == "1" ]] && DO_FULL=1

. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"
. "$SCRIPT_DIR/../../common/base_libs/cuda_index.sh"
source "$SCRIPT_DIR/../../common/common_functions.sh"

PIPLOCK_LIB="$SCRIPT_DIR/../../common/base_libs/pip_lock.sh"
. "$PIPLOCK_LIB"
pip_i() { vpip "$PYTHON" -m pip install --break-system-packages "$@" 2>/dev/null || vpip "$PYTHON" -m pip install "$@"; }

resolve_python() {
    local p
    for p in "$PYTHON" python3 python; do
        if command -v "$p" >/dev/null 2>&1; then
            command -v "$p"; return 0
        fi
    done
    return 1
}

echo "============================================================"
echo " [install_parler] Parler-TTS (Hugging Face)"
echo "============================================================"

echo "============================================================"

if [ "$(get_global_var "SKIP_LARGE_MODELS" "false")" = "true" ]; then
    echo "[install_parler] [skip] Server environment without desktop and GPU detected. Skipping Parler-TTS installation."
    complete_prereq_step "$PYTHON" "[install_parler] " --absent-ok "server CPU host" parler_tts
    exit 0
fi

[[ "${PARLER_SKIP:-0}" == "1" ]] && { echo "[install_parler] [i] PARLER_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_parler] " --absent-ok "PARLER_SKIP=1" parler_tts; }
if tts_dependencies_ready "$PYTHON" "parler" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 && "$DO_FULL" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "Parler-TTS already installed"
    complete_prereq_step "$PYTHON" "[install_parler] " parler_tts
fi
if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]]; then
    echo "[install_parler] [i] opt-in only. Pass --full, PARLER_INSTALL=1, or NEURAL_TTS_INSTALL=1."
    complete_prereq_step "$PYTHON" "[install_parler] " --absent-ok "opt-in" parler_tts
fi

if ! PYTHON="$(resolve_python)"; then
    echo "[install_parler] [!] Python 3 not found."
    fail_prereq_step "$PYTHON" "[install_parler] " parler_tts
fi

mkdir -p "$TARGET_DIR"
_gpu_flag="--cpu"
if gpu_present; then _gpu_flag="--gpu"; fi
_parler_model="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" parler_model "$_gpu_flag")"
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" parler | while read -r _line; do
    echo "[install_parler]  official env (parler): $_line"
done
echo "[install_parler]  staging : $TARGET_DIR"
echo "[install_parler]  weights : $WEIGHTS_DIR"
echo "[install_parler]  model   : $_parler_model"
echo "[install_parler]  sentinel: $MODEL_SENTINEL ($([ -f "$MODEL_SENTINEL" ] && echo present || echo absent))"

if tts_dependencies_ready "$PYTHON" "parler" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "dependencies already installed (.deps_done)"
else
    install_pycore_torch_stack "$PYTHON" "[install_parler] "
    echo "[install_parler] [..] pip install parler-tts (git) + soundfile ..."
    pip_i "git+https://github.com/huggingface/parler-tts.git" soundfile || true
    pip_i "$LLM_TRANSFORMERS_SPEC" || true
    if tts_engine_health_ok "$PYTHON" "parler" && tts_write_dependency_stamp "$PYTHON" "parler" "$DEPS_SENTINEL"; then
        echo "[install_parler] [OK] dependencies installed."
    else
        echo "[install_parler] [!] dependencies are incomplete; retrying next run." >&2
        fail_prereq_step "$PYTHON" "[install_parler] " parler_tts
    fi
fi

# --- HF weights (IDEMPOTENT: sentinel + curl resume + HF size verification) --- #
# allow-list excludes redundant flax/tf/onnx format variants.
_model_ready=0
if [[ -f "$MODEL_SENTINEL" && "$FORCE" -eq 0 ]]; then
    _sentinel_model="$(cat "$MODEL_SENTINEL" 2>/dev/null | tr -d '\r\n')"
    if [[ -n "$_sentinel_model" && "$_sentinel_model" == "$_parler_model" ]] && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_parler_model" "$PYTHON" "" "$WEIGHT_ALLOW"; then
        tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "model weights verified ($_parler_model)"
        _model_ready=1
    elif [[ -n "$_sentinel_model" && "$_sentinel_model" != "$_parler_model" ]]; then
        echo "[install_parler] [..] model tier changed ($_sentinel_model -> $_parler_model); refreshing weights."
    elif ! neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_parler_model" "$PYTHON" "" "$WEIGHT_ALLOW"; then
        echo "[install_parler] [..] local weights incomplete or corrupt; repairing download."
    fi
fi
if [[ "$_model_ready" -eq 0 ]]; then
    echo "[install_parler] [..] downloading/repairing model '$_parler_model' (curl, resumable) ..."
    if install_hf_repo_flat "$_parler_model" "$WEIGHTS_DIR" "$MODEL_SENTINEL" "[install_parler] " "$WEIGHT_ALLOW" "" "$_parler_model" \
       && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_parler_model" "$PYTHON" "" "$WEIGHT_ALLOW"; then
        _model_ready=1
        echo "[install_parler] [OK] model '$_parler_model' ready at $WEIGHTS_DIR."
    else
        echo "[install_parler] [!] model download not finished; partial files kept at $WEIGHTS_DIR; will RESUME next run."
        fail_prereq_step "$PYTHON" "[install_parler] " parler_tts
    fi
fi

if [[ "$_model_ready" -ne 1 ]]; then
    fail_prereq_step "$PYTHON" "[install_parler] " parler_tts
fi

echo "[install_parler] [OK] Parler ready. Weights pre-downloaded (idempotent); engine auto-detects local."
if [[ -f "$MODEL_SENTINEL" ]] && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_parler_model" "$PYTHON" "" "$WEIGHT_ALLOW"; then
    echo "[install_parler]  local weights auto-detected: $WEIGHTS_DIR"
fi
echo "[install_parler]  Set PARLER_DESCRIPTION for voice style; PARLER_MODEL to override."
complete_prereq_step "$PYTHON" "[install_parler] " parler_tts
