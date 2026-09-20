#!/bin/bash
SCRIPT_INDEX="147"
# VoxCPM2 prerequisite (Linux) - OpenBMB TTS, ISOLATED self-contained per-engine
# venv (base Python 3.12; the main 3.13 interpreter is outside the official
# 3.10-3.12 window and is never touched). Production runs VoxCPM2 as a class-C
# HTTP server (voxcpm2_api_server.py, port 57214) under that venv; the main
# interpreter only talks to it over HTTP.
# GPU hosts install CUDA torch into the venv by default (~8GB VRAM recommended).
#
# Official: https://voxcpm.readthedocs.io/en/latest/quickstart.html
#
# Invocation: 147_install_voxcpm2.sh --python <py> [--full] [--force]
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
WEIGHT_ALLOW="*.bin,*.safetensors,*.pt,*.pth,*.json,*.txt,*.model,*.vocab,tokenization_voxcpm2.py"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        --full)   DO_FULL=1;   shift   ;;
        *) shift ;;
    esac
done
[[ "${VOXCPM2_INSTALL:-0}" == "1" || "${NEURAL_TTS_INSTALL:-0}" == "1" ]] && DO_FULL=1

# --- Install method selection (native/docker), plan steps 16-17 ---
# VoxCPM has no official container evidence (checked 2026-09); the supported set
# is native-only, so the selector persists it directly without a countdown.
if [[ "${VOXCPM2_SKIP:-0}" != "1" ]]; then
    . "$SCRIPT_DIR/../../common/install_method_common.sh"
    INSTALL_METHOD="$(install_method_select voxcpm2 \
        --supported "native" \
        --recommended native \
        --recommendation-source "VoxCPM official repo documents native install only; no official container image - https://github.com/OpenBMB/VoxCPM" \
        --default native --method "${TTS_METHOD:-}" ${TTS_METHOD_RESELECT:+--reselect})" || {
        _method_rc=$?
        if [[ $_method_rc -eq 10 ]]; then
            echo "[voxcpm2] install method selection cancelled; nothing changed."
            exit 0
        fi
        exit "$_method_rc"
    }
    install_method_record_backend voxcpm2 "$INSTALL_METHOD"
fi

resolve_python() {
    local p
    for p in "$PYTHON" python3 python; do
        if command -v "$p" >/dev/null 2>&1; then
            command -v "$p"; return 0
        fi
    done
    return 1
}

. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"
. "$SCRIPT_DIR/../../common/base_libs/cuda_index.sh"
source "$SCRIPT_DIR/../../common/common_functions.sh"

PIPLOCK_LIB="$SCRIPT_DIR/../../common/base_libs/pip_lock.sh"
. "$PIPLOCK_LIB"
pip_i() { vpip "$PYTHON" -m pip install --break-system-packages "$@" 2>/dev/null || vpip "$PYTHON" -m pip install "$@"; }

echo "============================================================"
echo " [install_voxcpm2] VoxCPM2 (OpenBMB)"
echo "============================================================"

echo "============================================================"

if [ "$(get_global_var "SKIP_LARGE_MODELS" "false")" = "true" ] && ! tts_engine_cpu_supported "$PYTHON" "voxcpm2"; then
    echo "[install_voxcpm2] [skip] Server environment without desktop and GPU detected. Skipping VoxCPM2 installation."
    complete_prereq_step "$PYTHON" "[install_voxcpm2] " --absent-ok "server CPU host"
    exit 0
fi

# Honor the skip flag FIRST (before the opt-in / --full gate) so it wins even when the
# NEURAL_TTS_INSTALL batch would otherwise force a full install. --absent-ok keeps the skip
# a clean idempotent no-op when VOXCPM2_SKIP=1 (voxcpm legitimately absent).
[[ "${VOXCPM2_SKIP:-0}" == "1" ]] && { echo "[install_voxcpm2] [i] VOXCPM2_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_voxcpm2] " --absent-ok "VOXCPM2_SKIP=1"; }
if tts_engine_compatible "$PYTHON" "voxcpm2" "[install_voxcpm2] " \
    && [[ "$FORCE" -eq 0 && "$DO_FULL" -eq 0 ]] \
    && tts_dependencies_ready "$PYTHON" "voxcpm2" "$DEPS_SENTINEL"; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "VoxCPM2 already installed"
    complete_prereq_step "$PYTHON" "[install_voxcpm2] "
fi
if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]]; then
    echo "[install_voxcpm2] [i] opt-in only. Pass --full, VOXCPM2_INSTALL=1, or NEURAL_TTS_INSTALL=1."
    complete_prereq_step "$PYTHON" "[install_voxcpm2] " --absent-ok "opt-in"
fi

if ! PYTHON="$(resolve_python)"; then
    echo "[install_voxcpm2] [!] Python 3 not found."
    fail_prereq_step "$PYTHON" "[install_voxcpm2] "
fi
tts_ensure_engine_base_runtime "$PYTHON" "voxcpm2"
if ! tts_engine_compatible "$PYTHON" "voxcpm2" "[install_voxcpm2] "; then
    complete_prereq_step "$PYTHON" "[install_voxcpm2] " --absent-ok "incompatible Python"
fi

mkdir -p "$TARGET_DIR"
echo "[install_voxcpm2]  staging : $TARGET_DIR"
echo "[install_voxcpm2]  weights : $WEIGHTS_DIR"
echo "[install_voxcpm2]  compute : $(gpu_hardware_present && echo 'CUDA GPU (default)' || echo 'CPU only')"
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" voxcpm2 | while read -r _line; do
    echo "[install_voxcpm2]  official env (voxcpm2): $_line"
done
_vox_model="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" voxcpm2_model --gpu)"
echo "[install_voxcpm2]  model   : ${_vox_model}"
echo "[install_voxcpm2]  sentinel: $MODEL_SENTINEL ($([ -f "$MODEL_SENTINEL" ] && echo present || echo absent))"

# --- Isolated venv (Bucket B, self-contained): VoxCPM2 and its pinned
#     dependencies go only into the dedicated Python 3.12 venv. --- #
tts_probe_isolated_venv_provisioned "$PYTHON" "voxcpm2"
if [[ "$TTS_ISOLATED_VENV_READY" == "1" ]] && tts_dependencies_ready "$PYTHON" "voxcpm2" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "isolated venv already provisioned (.deps_done)"
else
    echo "[install_voxcpm2] [..] building/verifying isolated voxcpm2 venv (ensure_venv; first build takes minutes) ..."
    tts_provision_isolated_venv "$PYTHON" "voxcpm2" "$FORCE"
    if [[ "$TTS_ISOLATED_VENV_READY" == "1" ]] && tts_write_dependency_stamp "$PYTHON" "voxcpm2" "$DEPS_SENTINEL"; then
        echo "[install_voxcpm2] [OK] isolated voxcpm2 venv ready (policy stamp written)."
    else
        echo "[install_voxcpm2] [!] venv build incomplete; will retry next run (main interpreter untouched)." >&2
        fail_prereq_step "$PYTHON" "[install_voxcpm2] "
    fi
fi

# --- HF weights (IDEMPOTENT: sentinel + curl resume + HF size verification) --- #
# allow-list excludes redundant flax/tf/onnx format variants.
_model_ready=0
if [[ -f "$MODEL_SENTINEL" && "$FORCE" -eq 0 ]]; then
    _sentinel_model="$(cat "$MODEL_SENTINEL" 2>/dev/null | tr -d '\r\n')"
    if [[ -n "$_sentinel_model" && "$_sentinel_model" == "$_vox_model" ]] && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_vox_model" "$PYTHON" "" "$WEIGHT_ALLOW"; then
        tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "model weights verified ($_vox_model)"
        _model_ready=1
    elif [[ -n "$_sentinel_model" && "$_sentinel_model" != "$_vox_model" ]]; then
        echo "[install_voxcpm2] [..] model tier changed ($_sentinel_model -> $_vox_model); refreshing weights."
    elif ! neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_vox_model" "$PYTHON" "" "$WEIGHT_ALLOW"; then
        echo "[install_voxcpm2] [..] local weights incomplete or corrupt; repairing download."
    fi
fi
if [[ "$_model_ready" -eq 0 ]]; then
    echo "[install_voxcpm2] [..] downloading/repairing model '$_vox_model' (curl, resumable) ..."
    if install_hf_repo_flat "$_vox_model" "$WEIGHTS_DIR" "$MODEL_SENTINEL" "[install_voxcpm2] " "$WEIGHT_ALLOW" "" "$_vox_model" \
       && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_vox_model" "$PYTHON" "" "$WEIGHT_ALLOW"; then
        _model_ready=1
        echo "[install_voxcpm2] [OK] model '$_vox_model' ready at $WEIGHTS_DIR."
    else
        echo "[install_voxcpm2] [!] model download not finished; partial files kept at $WEIGHTS_DIR; will RESUME next run."
        fail_prereq_step "$PYTHON" "[install_voxcpm2] "
    fi
fi

if [[ "$_model_ready" -ne 1 ]]; then
    fail_prereq_step "$PYTHON" "[install_voxcpm2] "
fi

echo "[install_voxcpm2] [OK] VoxCPM2 ready. Weights pre-downloaded (idempotent); engine auto-detects local."
if [[ -f "$MODEL_SENTINEL" ]] && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_vox_model" "$PYTHON" "" "$WEIGHT_ALLOW"; then
    echo "[install_voxcpm2]  local weights auto-detected: $WEIGHTS_DIR"
fi
echo "[install_voxcpm2]  Optional: export VOXCPM2_MODEL=${_vox_model}"
complete_prereq_step "$PYTHON" "[install_voxcpm2] "
