#!/bin/bash
# Qwen3-TTS prerequisite (Linux) — Alibaba qwen-tts, class C (isolated venv + HTTP server).
#
# Lifecycle rule (see development-guides/cross-docs/
# TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5 & §7, Bucket B): qwen-tts pins
# transformers==4.57.3, which CANNOT coexist with the main interpreter's shared 4.46.x
# pin (Bucket A: deepseek/qwen25/nllb/bark). So qwen-tts is NEVER installed into the main
# interpreter. It lives in a DEDICATED per-engine venv built + verified by
# pycore.pyutils.tts.qwen3tts_venv.ensure_venv() (created --system-site-packages so it
# REUSES the system CUDA torch; only the pinned transformers/accelerate are layered in,
# shadowing the main copies). The qwen3tts_api_server.py runs under that venv and pycore
# (tts_service_manager / qwen3tts_engine) talks to it over HTTP as a managed class-C server.
#
# Official: https://github.com/QwenLM/Qwen3-TTS  (qwen-tts is installed INTO the venv, not here)
#
# Idempotent + self-repairing: ensure_venv() is a cheap import probe when healthy and
# REBUILDS the venv when qwen_tts fails to import; HF weights download/repair via curl
# resume + size verification (.deps_done = venv provisioned, .model_installed = repo id).
# Skip with QWEN3TTS_SKIP=1. --force rebuilds the venv and re-validates every weight file.
set -uo pipefail

PYTHON="python3"
FORCE=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Repo root = 5 levels up from install_shells (scripts/shells/linux/debian/install_shells);
# needed on sys.path so `import pycore...` resolves when building the isolated venv.
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
TARGET_DIR="${QWEN3TTS_DIR:-$CORE_NODE_CACHE_DIR/pycore/qwen3tts}"
WEIGHTS_DIR="$TARGET_DIR/weights"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
MODEL_SENTINEL="$TARGET_DIR/.model_installed"
# qwen_tts is intentionally absent from the main interpreter (it lives in the isolated
# venv), so the post-install probe reports it as an accepted SKIP, never a FAIL.
QWEN3TTS_ABSENT_NOTE="qwen-tts lives in the isolated venv (Bucket B), not the main interpreter"
# Python bool literal handed to ensure_venv(force=...); set True on --force after parsing.
_QWEN3TTS_FORCE_PY=False

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        --full)   shift   ;;
        *) shift ;;
    esac
done
[[ "$FORCE" -eq 1 ]] && _QWEN3TTS_FORCE_PY=True

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

# Provision / verify the ISOLATED qwen-tts venv (Bucket B). Delegates to the single
# source of truth pycore.pyutils.tts.qwen3tts_venv.ensure_venv(), run UNDER $PYTHON so
# the venv is built next to that interpreter and reuses its system CUDA torch via
# --system-site-packages. Cheap when already healthy; rebuilds a broken venv. $1 is a
# Python bool literal (True on --force). Returns 0 only when qwen_tts imports in the venv.
provision_qwen3tts_venv() {
    local force_py="$1"
    "$PYTHON" -c "import sys; sys.path.insert(0, r'''$CORE_NODE_ROOT'''); from pycore.pyutils.tts import qwen3tts_venv; sys.exit(0 if qwen3tts_venv.ensure_venv(force=$force_py) else 1)"
}

echo "============================================================"
echo " [install_qwen3tts] Qwen3-TTS (Alibaba qwen-tts)"
echo "============================================================"

[[ "${QWEN3TTS_SKIP:-0}" == "1" ]] && { echo "[install_qwen3tts] [i] QWEN3TTS_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_qwen3tts] " --absent-ok "$QWEN3TTS_ABSENT_NOTE" qwen_tts; }

if ! PYTHON="$(resolve_python)"; then
    echo "[install_qwen3tts] [!] Python 3 not found."
    complete_prereq_step "$PYTHON" "[install_qwen3tts] " --absent-ok "$QWEN3TTS_ABSENT_NOTE" qwen_tts
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
        # Weights verified; also verify (and self-repair) the isolated venv before the
        # fast idempotent exit \u2014 a broken venv must never be masked by a present sentinel.
        if provision_qwen3tts_venv "$_QWEN3TTS_FORCE_PY"; then
            tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "Qwen3-TTS already installed (isolated venv + verified model)"
            complete_prereq_step "$PYTHON" "[install_qwen3tts] " --absent-ok "$QWEN3TTS_ABSENT_NOTE" qwen_tts
        fi
        echo "[install_qwen3tts] [..] isolated venv needs (re)provisioning; continuing."
    fi
    if [[ "$_sentinel_model" != "$_qwen_model" ]]; then
        echo "[install_qwen3tts] [..] model tier changed (${_sentinel_model:-unknown} -> $_qwen_model); refreshing weights."
    elif ! neural_tts_local_weights_ready "$WEIGHTS_DIR" "$_qwen_model"; then
        echo "[install_qwen3tts] [..] local weights incomplete or corrupt; repairing download."
    fi
fi

_ASSETS_DIR="$(pycore_tts_install_assets_dir "$SCRIPT_DIR")"
if [[ -f "$_ASSETS_DIR/qwen3tts_api_server.py" ]]; then
    cp -f "$_ASSETS_DIR/qwen3tts_api_server.py" "$TARGET_DIR/qwen3tts_api_server.py"
fi

# --- Isolated qwen-tts venv (Bucket B) ----------------------------------- #
# NEVER `pip install qwen-tts` into the main interpreter: its transformers==4.57.3 pin
# would break the shared 4.46.x stack. The main interpreter only needs the shared torch
# stack (installed below), which the venv REUSES via --system-site-packages. ensure_venv()
# is idempotent + self-repairing, so it runs on every sweep — even with the sentinel
# present — to heal a drifted / half-built venv.
if [[ -f "$DEPS_SENTINEL" && "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "isolated qwen-tts venv provisioned (.deps_done)"
    if provision_qwen3tts_venv "$_QWEN3TTS_FORCE_PY"; then
        echo "[install_qwen3tts] [OK] isolated qwen-tts venv verified (self-repair)."
    else
        echo "[install_qwen3tts] [!] venv verify/repair incomplete; will RESUME next run."
    fi
else
    "$PYTHON" -m pip install --upgrade pip || true
    install_pycore_torch_stack "$PYTHON" "[install_qwen3tts] "
    echo "[install_qwen3tts] [..] provisioning isolated qwen-tts venv (transformers==4.57.3 shadows main; system torch reused) ..."
    if provision_qwen3tts_venv "$_QWEN3TTS_FORCE_PY"; then
        date -u +%Y-%m-%dT%H:%M:%SZ > "$DEPS_SENTINEL"
        echo "[install_qwen3tts] [OK] isolated qwen-tts venv ready; main interpreter untouched."
    else
        echo "[install_qwen3tts] [!] venv provisioning incomplete; will RESUME next run."
    fi
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
echo "[install_qwen3tts]  START:  pycore runs pycore/tts_install_assets/qwen3tts_api_server.py under the ISOLATED venv as a managed class-C server (QWEN3TTS_PORT, default 57210)."
complete_prereq_step "$PYTHON" "[install_qwen3tts] " --absent-ok "$QWEN3TTS_ABSENT_NOTE" qwen_tts
