#!/bin/bash
# CosyVoice prerequisite (Linux) — FunAudioLLM FastAPI server on :50000.
# Auto-run by prepare_pycore_prerequisites.sh (pyservice). Clones FunAudioLLM/CosyVoice idempotently.
# pycore's cosyvoice engine is an HTTP CLIENT to runtime/python/fastapi/server.py.
#
# Official: https://github.com/FunAudioLLM/CosyVoice
#   python runtime/python/fastapi/server.py --port 50000 --model_dir iic/CosyVoice2-0.5B
#
# Linux extras: apt ffmpeg/sox/libsndfile; git submodule init for Matcha-TTS.
#
# Invocation: install_cosyvoice.sh --python <py> [--full] [--force]
# Env: COSYVOICE_SKIP=1, COSYVOICE_INSTALL=1, COSYVOICE_DIR, COSYVOICE_URL
set -uo pipefail

PYTHON="python3"
FORCE=0
DO_FULL=0
REPO_URL="https://github.com/FunAudioLLM/CosyVoice.git"
SERVER_URL="${COSYVOICE_URL:-http://127.0.0.1:50000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../../.." && pwd)"
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
TARGET_DIR="${COSYVOICE_DIR:-$CORE_NODE_CACHE_DIR/pycore/cosyvoice}"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
REPO_MARKER="$TARGET_DIR/cosyvoice/cli/cosyvoice.py"
SUDO=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        --full)   DO_FULL=1;   shift   ;;
        *) shift ;;
    esac
done
SERVER_URL="${SERVER_URL%/}"
[[ "${COSYVOICE_INSTALL:-0}" == "1" || "${NEURAL_TTS_INSTALL:-0}" == "1" ]] && DO_FULL=1
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

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

server_up() {
    command -v curl >/dev/null 2>&1 || return 1
    local c
    c="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 "$SERVER_URL/docs" 2>/dev/null || echo 000)"
    [[ "$c" != "000" && "$c" -lt 500 ]]
}

ensure_linux_system_deps() {
    command -v apt-get >/dev/null 2>&1 || return 0
    echo "[install_cosyvoice] [..] apt: ffmpeg sox libsox-dev libsndfile1 (audio toolchain) ..."
    $SUDO apt-get install -y ffmpeg sox libsox-dev libsndfile1 git-lfs >/dev/null 2>&1 || true
    command -v git-lfs >/dev/null 2>&1 && git lfs install >/dev/null 2>&1 || true
}

init_cosyvoice_submodules() {
    [[ -d "$TARGET_DIR/.git" ]] || return 0
    echo "[install_cosyvoice] [..] git submodule update --init --recursive (Matcha-TTS) ..."
    (cd "$TARGET_DIR" && git submodule update --init --recursive) || \
        echo "[install_cosyvoice] [!] submodule init incomplete; server start may fail."
}

echo "============================================================"
echo " [install_cosyvoice] CosyVoice (multilingual clone TTS)"
echo "============================================================"

[[ "${COSYVOICE_SKIP:-0}" == "1" ]] && { echo "[install_cosyvoice] [i] COSYVOICE_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_cosyvoice] " torch; }
if server_up; then
    echo "[install_cosyvoice] [OK] server at $SERVER_URL."
    echo "[install_cosyvoice]      Set COSYVOICE_SPK_ID or COSYVOICE_REF_AUDIO."
    complete_prereq_step "$PYTHON" "[install_cosyvoice] " torch
fi
if [[ -f "$REPO_MARKER" && -f "$DEPS_SENTINEL" && "$FORCE" -eq 0 && "$DO_FULL" -eq 0 ]]; then
    echo "[install_cosyvoice] [OK] already installed."
    echo "[install_cosyvoice]  START: cd \"$TARGET_DIR\" && python runtime/python/fastapi/server.py --port 50000"
    complete_prereq_step "$PYTHON" "[install_cosyvoice] " torch
fi
if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]]; then
    echo "[install_cosyvoice] [i] opt-in only. Pass --full, COSYVOICE_INSTALL=1, or NEURAL_TTS_INSTALL=1."
    complete_prereq_step "$PYTHON" "[install_cosyvoice] " torch
fi

if ! PYTHON="$(resolve_python)"; then
    echo "[install_cosyvoice] [!] Python 3 not found."
    complete_prereq_step "$PYTHON" "[install_cosyvoice] " torch
fi
ensure_linux_system_deps

echo "[install_cosyvoice]  staging : $TARGET_DIR"
echo "[install_cosyvoice]  compute : $(gpu_present && echo 'CUDA GPU' || echo 'CPU only')"
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" cosyvoice | while read -r _line; do
    echo "[install_cosyvoice]  official env (cosyvoice): $_line"
done
_cosy_model="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" cosyvoice_model_dir $(gpu_present && echo --gpu || echo --cpu))"
echo "[install_cosyvoice]  model_dir: $_cosy_model"

if [[ -f "$REPO_MARKER" ]]; then
    echo "[install_cosyvoice] [OK] repo already present."
else
    command -v git >/dev/null 2>&1 || { echo "[install_cosyvoice] [!] git not found."; complete_prereq_step "$PYTHON" "[install_cosyvoice] " torch; }
    mkdir -p "$(dirname "$TARGET_DIR")"
    git clone --depth 1 --progress "$REPO_URL" "$TARGET_DIR" || { echo "[install_cosyvoice] [!] clone failed."; complete_prereq_step "$PYTHON" "[install_cosyvoice] " torch; }
fi
init_cosyvoice_submodules

if [[ -f "$DEPS_SENTINEL" && "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "dependencies already installed (.deps_done)"
else
    install_pycore_torch_stack "$PYTHON" "[install_cosyvoice] "
    [[ -f "$TARGET_DIR/requirements.txt" ]] && pip_i -r "$TARGET_DIR/requirements.txt" || true
    pip_i fastapi uvicorn modelscope huggingface_hub onnxruntime || true
    date -u +%Y-%m-%dT%H:%M:%SZ >"$DEPS_SENTINEL"
    echo "[install_cosyvoice] [OK] dependencies installed."
fi

echo "[install_cosyvoice] [OK] ready. Set COSYVOICE_SPK_ID or COSYVOICE_REF_AUDIO (+ COSYVOICE_PROMPT_TEXT)."
echo "[install_cosyvoice]  START: cd \"$TARGET_DIR\" && python runtime/python/fastapi/server.py --port 50000 --model_dir $_cosy_model"
complete_prereq_step "$PYTHON" "[install_cosyvoice] " torch
