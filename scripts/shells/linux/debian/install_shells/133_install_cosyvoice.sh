#!/bin/bash
SCRIPT_INDEX="133"
# CosyVoice prerequisite (Linux) - FunAudioLLM FastAPI server on :50000.
# Auto-run by prepare_pycore_prerequisites.sh (pyservice). Clones FunAudioLLM/CosyVoice idempotently
# and builds a DEDICATED self-contained per-engine venv (base Python 3.10) via
# isolated_venv.ensure_venv('cosyvoice', ...) - never the main interpreter.
# pycore launches runtime/python/fastapi/server.py under that venv on demand (class C);
# the main interpreter is only an HTTP CLIENT.
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
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
CACHE_ROOT="${CORE_NODE_CACHE_DIR:-$CORE_NODE_ROOT/.cache}"
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
TARGET_DIR="${COSYVOICE_DIR:-$CACHE_ROOT/pycore/cosyvoice}"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
REPO_MARKER="$TARGET_DIR/cosyvoice/cli/cosyvoice.py"
source "$SCRIPT_DIR/../../common/common_functions.sh"
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

# --- Install method selection (native/docker), plan steps 16-17 ---
# Per-engine choice; a saved valid choice is reused verbatim with no countdown.
if [[ "${COSYVOICE_SKIP:-0}" != "1" ]]; then
    . "$SCRIPT_DIR/../../common/install_method_common.sh"
    INSTALL_METHOD="$(install_method_select cosyvoice \
        --supported "native docker" \
        --recommended native \
        --recommendation-source "CosyVoice official repo installs natively (conda python=3.10); upstream also ships a docker/ runtime directory - https://github.com/FunAudioLLM/CosyVoice" \
        --default native --method "${TTS_METHOD:-}" ${TTS_METHOD_RESELECT:+--reselect})" || {
        _method_rc=$?
        if [[ $_method_rc -eq 10 ]]; then
            echo "[cosyvoice] install method selection cancelled; nothing changed."
            exit 0
        fi
        exit "$_method_rc"
    }
    if [[ "$INSTALL_METHOD" == "docker" ]]; then
        . "$SCRIPT_DIR/../../common/docker_prereq_common.sh"
        if ! docker_prereq_ensure_for_engine cosyvoice "$SCRIPT_DIR"; then
            echo "[cosyvoice][!] docker platform ensure failed (phase above); docker backend is not ready." >&2
            exit 1
        fi
        install_method_record_backend cosyvoice docker
        . "$SCRIPT_DIR/../../common/tts_docker_compose_common.sh"
        if ! tts_docker_apply_engine cosyvoice "$TARGET_DIR"; then
            echo "[cosyvoice][!] docker compose apply failed (phase above); docker backend is not ready." >&2
            exit 1
        fi
        echo "[cosyvoice][OK] docker compose service converged (project pycore-tts-cosyvoice)."
        exit 0
    fi
    install_method_record_backend cosyvoice native
fi
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

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

PIPLOCK_LIB="$SCRIPT_DIR/../../common/base_libs/pip_lock.sh"
. "$PIPLOCK_LIB"
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
    if ! (cd "$TARGET_DIR" && git submodule update --init --recursive); then
        echo "[install_cosyvoice] [!] submodule init incomplete; server start may fail."
        return 1
    fi
    return 0
}

echo "============================================================"
echo " [install_cosyvoice] CosyVoice (multilingual clone TTS)"
echo "============================================================"

if [ "$(get_global_var "SKIP_LARGE_MODELS" "false")" = "true" ] && ! tts_engine_cpu_supported "$PYTHON" "cosyvoice"; then
    echo "[install_cosyvoice] [skip] Server environment without desktop and GPU detected. Skipping CosyVoice installation."
    complete_prereq_step "$PYTHON" "[install_cosyvoice] " --absent-ok "server CPU host" torch
    exit 0
fi

[[ "${COSYVOICE_SKIP:-0}" == "1" ]] && { echo "[install_cosyvoice] [i] COSYVOICE_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_cosyvoice] " --absent-ok "COSYVOICE_SKIP=1" torch; }
if server_up; then
    echo "[install_cosyvoice] [OK] server at $SERVER_URL."
    echo "[install_cosyvoice]      Set COSYVOICE_SPK_ID or COSYVOICE_REF_AUDIO."
    complete_prereq_step "$PYTHON" "[install_cosyvoice] " --absent-ok "external server reachable" torch
fi
if tts_engine_compatible "$PYTHON" "cosyvoice" "[install_cosyvoice] " \
    && [[ -f "$REPO_MARKER" && "$FORCE" -eq 0 && "$DO_FULL" -eq 0 ]] \
    && tts_dependencies_ready "$PYTHON" "cosyvoice" "$DEPS_SENTINEL"; then
    tts_probe_isolated_venv_provisioned "$PYTHON" "cosyvoice"
    if [[ "$TTS_ISOLATED_VENV_READY" == "1" ]]; then
        echo "[install_cosyvoice] [OK] already installed."
        echo "[install_cosyvoice]  Runtime: pycore launches runtime/python/fastapi/server.py (class C) under the isolated venv on demand."
        complete_prereq_step "$PYTHON" "[install_cosyvoice] " torch
    fi
fi
if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]]; then
    echo "[install_cosyvoice] [i] opt-in only. Pass --full, COSYVOICE_INSTALL=1, or NEURAL_TTS_INSTALL=1."
    complete_prereq_step "$PYTHON" "[install_cosyvoice] " --absent-ok "opt-in" torch
fi

if ! PYTHON="$(resolve_python)"; then
    echo "[install_cosyvoice] [!] Python 3 not found."
    fail_prereq_step "$PYTHON" "[install_cosyvoice] " torch
fi
tts_ensure_engine_base_runtime "$PYTHON" "cosyvoice"
if ! tts_engine_compatible "$PYTHON" "cosyvoice" "[install_cosyvoice] "; then
    complete_prereq_step "$PYTHON" "[install_cosyvoice] " --absent-ok "incompatible Python" torch
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
    command -v git >/dev/null 2>&1 || { echo "[install_cosyvoice] [!] git not found."; fail_prereq_step "$PYTHON" "[install_cosyvoice] " torch; }
    mkdir -p "$(dirname "$TARGET_DIR")"
    git clone --depth 1 --progress "$REPO_URL" "$TARGET_DIR" || { echo "[install_cosyvoice] [!] clone failed."; fail_prereq_step "$PYTHON" "[install_cosyvoice] " torch; }
fi
if ! init_cosyvoice_submodules; then
    fail_prereq_step "$PYTHON" "[install_cosyvoice] " torch
fi

# --- Isolated venv (Bucket B, self-contained): CosyVoice and its pinned
#     dependencies go only into the dedicated Python 3.10 venv; the main
#     interpreter (3.13) is outside the official 3.10-3.12 window and is never
#     touched. pycore launches runtime/python/fastapi/server.py under that venv
#     on demand (class C). --- #
tts_probe_isolated_venv_provisioned "$PYTHON" "cosyvoice"
if [[ "$TTS_ISOLATED_VENV_READY" == "1" ]] && tts_dependencies_ready "$PYTHON" "cosyvoice" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "isolated venv already provisioned (.deps_done)"
else
    if [[ ! -f "$TARGET_DIR/requirements.txt" ]]; then
        echo "[install_cosyvoice] [!] requirements.txt missing at $TARGET_DIR." >&2
        fail_prereq_step "$PYTHON" "[install_cosyvoice] " torch
    fi
    echo "[install_cosyvoice] [..] building/verifying isolated cosyvoice venv (ensure_venv; first build takes minutes) ..."
    tts_provision_isolated_venv "$PYTHON" "cosyvoice" "$FORCE" \
        -r "$TARGET_DIR/requirements.txt" fastapi uvicorn modelscope huggingface_hub onnxruntime
    if [[ "$TTS_ISOLATED_VENV_READY" == "1" ]] && tts_write_dependency_stamp "$PYTHON" "cosyvoice" "$DEPS_SENTINEL"; then
        echo "[install_cosyvoice] [OK] isolated cosyvoice venv ready (policy stamp written)."
    else
        echo "[install_cosyvoice] [!] venv build incomplete; will retry next run (main interpreter untouched)." >&2
        fail_prereq_step "$PYTHON" "[install_cosyvoice] " torch
    fi
fi

echo "[install_cosyvoice] [OK] ready. Set COSYVOICE_SPK_ID or COSYVOICE_REF_AUDIO (+ COSYVOICE_PROMPT_TEXT)."
echo "[install_cosyvoice]  Runtime: pycore launches runtime/python/fastapi/server.py (class C) under the isolated venv on demand."
complete_prereq_step "$PYTHON" "[install_cosyvoice] " torch
