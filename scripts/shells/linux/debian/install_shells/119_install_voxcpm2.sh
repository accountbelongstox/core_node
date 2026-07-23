#!/bin/bash
# VoxCPM2 prerequisite (Linux) — OpenBMB in-process TTS (pip voxcpm).
# GPU hosts install CUDA torch by default (~8GB VRAM recommended).
#
# Official: https://voxcpm.readthedocs.io/en/latest/quickstart.html
#
# Invocation: 119_install_voxcpm2.sh --python <py> [--full] [--force]
# Env: VOXCPM2_SKIP=1, VOXCPM2_INSTALL=1, NEURAL_TTS_INSTALL=1, VOXCPM2_MODEL
set -uo pipefail

PYTHON="python3"
FORCE=0
DO_FULL=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
CACHE_ROOT="${CORE_NODE_CACHE_DIR:-$CORE_NODE_ROOT/.cache}"
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
TARGET_DIR="${VOXCPM2_DIR:-$CACHE_ROOT/pycore/voxcpm2}"
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
[[ "${VOXCPM2_INSTALL:-0}" == "1" || "${NEURAL_TTS_INSTALL:-0}" == "1" ]] && DO_FULL=1

resolve_python() {
    local p
    for p in "$PYTHON" python3 python; do
        if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
            command -v "$p"; return 0
        fi
    done
    return 1
}

. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"
. "$SCRIPT_DIR/../../common/base_libs/cuda_index.sh"

PIPLOCK_LIB="$SCRIPT_DIR/../../common/base_libs/pip_lock.sh"
[ -f "$PIPLOCK_LIB" ] && . "$PIPLOCK_LIB"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }
pip_i() { vpip "$PYTHON" -m pip install --break-system-packages "$@" 2>/dev/null || vpip "$PYTHON" -m pip install "$@"; }

echo "============================================================"
echo " [install_voxcpm2] VoxCPM2 (OpenBMB)"
echo "============================================================"

# Honor the skip flag FIRST (before the opt-in / --full gate) so it wins even when the
# NEURAL_TTS_INSTALL batch would otherwise force a full install. --absent-ok keeps the skip
# a clean idempotent no-op (voxcpm legitimately absent), mirroring pyservice.sh --skip-voxcpm2.
[[ "${VOXCPM2_SKIP:-0}" == "1" ]] && { echo "[install_voxcpm2] [i] VOXCPM2_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_voxcpm2] " --absent-ok "VOXCPM2_SKIP=1" voxcpm; }
if tts_engine_compatible "$PYTHON" "voxcpm2" "[install_voxcpm2] " \
    && [[ "$FORCE" -eq 0 && "$DO_FULL" -eq 0 ]] \
    && tts_dependencies_ready "$PYTHON" "voxcpm2" "$DEPS_SENTINEL"; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "VoxCPM2 already installed"
    complete_prereq_step "$PYTHON" "[install_voxcpm2] " voxcpm
fi
if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]]; then
    echo "[install_voxcpm2] [i] opt-in only. Pass --full, VOXCPM2_INSTALL=1, or NEURAL_TTS_INSTALL=1."
    complete_prereq_step "$PYTHON" "[install_voxcpm2] " --absent-ok "opt-in" voxcpm
fi

if ! PYTHON="$(resolve_python)"; then
    echo "[install_voxcpm2] [!] Python 3 not found."
    fail_prereq_step "$PYTHON" "[install_voxcpm2] " voxcpm
fi
if ! tts_engine_compatible "$PYTHON" "voxcpm2" "[install_voxcpm2] "; then
    complete_prereq_step "$PYTHON" "[install_voxcpm2] " --absent-ok "incompatible Python" voxcpm
fi

mkdir -p "$TARGET_DIR"
echo "[install_voxcpm2]  staging : $TARGET_DIR"
echo "[install_voxcpm2]  weights : $WEIGHTS_DIR"
echo "[install_voxcpm2]  compute : $(gpu_present && echo 'CUDA GPU (default)' || echo 'CPU only')"
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" voxcpm2 | while read -r _line; do
    echo "[install_voxcpm2]  official env (voxcpm2): $_line"
done
_vox_model="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" voxcpm2_model --gpu)"
echo "[install_voxcpm2]  model   : ${_vox_model}"
echo "[install_voxcpm2]  sentinel: $MODEL_SENTINEL ($([ -f "$MODEL_SENTINEL" ] && echo present || echo absent))"

if tts_dependencies_ready "$PYTHON" "voxcpm2" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "dependencies already installed (.deps_done)"
else
    install_pycore_torch_stack "$PYTHON" "[install_voxcpm2] "
    echo "[install_voxcpm2] [..] pip install voxcpm soundfile ..."
    pip_i voxcpm soundfile || true
    if tts_engine_health_ok "$PYTHON" "voxcpm2" && tts_write_dependency_stamp "$PYTHON" "voxcpm2" "$DEPS_SENTINEL"; then
        echo "[install_voxcpm2] [OK] dependencies installed."
    else
        echo "[install_voxcpm2] [!] dependencies are incomplete; retrying next run." >&2
        fail_prereq_step "$PYTHON" "[install_voxcpm2] " voxcpm
    fi
fi

# --- HF weights (IDEMPOTENT: sentinel + curl resume + HF size verification) --- #
# allow-list excludes redundant flax/tf/onnx format variants.
_model_ready=0
if [[ -f "$MODEL_SENTINEL" && "$FORCE" -eq 0 ]]; then
    _sentinel_model="$(cat "$MODEL_SENTINEL" 2>/dev/null | tr -d '\r\n')"
    if [[ -n "$_sentinel_model" && "$_sentinel_model" == "$_vox_model" ]] && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_vox_model" "$PYTHON"; then
        tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "model weights verified ($_vox_model)"
        _model_ready=1
    elif [[ -n "$_sentinel_model" && "$_sentinel_model" != "$_vox_model" ]]; then
        echo "[install_voxcpm2] [..] model tier changed ($_sentinel_model -> $_vox_model); refreshing weights."
    elif ! neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_vox_model" "$PYTHON"; then
        echo "[install_voxcpm2] [..] local weights incomplete or corrupt; repairing download."
    fi
fi
if [[ "$_model_ready" -eq 0 ]]; then
    echo "[install_voxcpm2] [..] downloading/repairing model '$_vox_model' (curl, resumable) ..."
    if install_hf_repo_flat "$_vox_model" "$WEIGHTS_DIR" "$MODEL_SENTINEL" "[install_voxcpm2] " "$WEIGHT_ALLOW" "" "$_vox_model" \
       && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_vox_model" "$PYTHON"; then
        _model_ready=1
        echo "[install_voxcpm2] [OK] model '$_vox_model' ready at $WEIGHTS_DIR."
    else
        echo "[install_voxcpm2] [!] model download not finished; partial files kept at $WEIGHTS_DIR; will RESUME next run."
        fail_prereq_step "$PYTHON" "[install_voxcpm2] " voxcpm
    fi
fi

if [[ "$_model_ready" -ne 1 ]]; then
    fail_prereq_step "$PYTHON" "[install_voxcpm2] " voxcpm
fi

echo "[install_voxcpm2] [OK] VoxCPM2 ready. Weights pre-downloaded (idempotent); engine auto-detects local."
if [[ -f "$MODEL_SENTINEL" ]] && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_vox_model" "$PYTHON"; then
    echo "[install_voxcpm2]  local weights auto-detected: $WEIGHTS_DIR"
fi
echo "[install_voxcpm2]  Optional: export VOXCPM2_MODEL=${_vox_model}"
complete_prereq_step "$PYTHON" "[install_voxcpm2] " voxcpm
