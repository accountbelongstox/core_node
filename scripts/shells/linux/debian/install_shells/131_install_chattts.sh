#!/bin/bash
# ChatTTS prerequisite (Linux) - official PyPI + local OpenAI-compatible api.
# Official: pip install ChatTTS (https://github.com/2noise/ChatTTS#installation)
# API: chattts_api_server.py -> POST /v1/audio/speech
#
# Invocation: install_chattts.sh --python <py> [--full] [--force]
# Env: CHATTTS_SKIP=1, CHATTTS_INSTALL=1, NEURAL_TTS_INSTALL=1, CHATTTS_DIR, CHATTTS_URL
set -uo pipefail

PYTHON="python3"
FORCE=0
DO_FULL=0
SERVER_URL="${CHATTTS_URL:-http://127.0.0.1:8000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
CACHE_ROOT="${CORE_NODE_CACHE_DIR:-$CORE_NODE_ROOT/.cache}"
TARGET_DIR="${CHATTTS_DIR:-$CACHE_ROOT/pycore/chattts}"
WEIGHTS_DIR="$TARGET_DIR/weights"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
MODEL_SENTINEL="$TARGET_DIR/.model_installed"
MODEL_REPO="2Noise/ChatTTS"
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
API_SRC="$(pycore_tts_install_assets_dir "$SCRIPT_DIR")/chattts_api_server.py"
API_DST="$TARGET_DIR/chattts_api_server.py"
MODEL_MANIFEST="$(pycore_tts_install_assets_dir "$SCRIPT_DIR")/chattts_model_files.txt"
source "$SCRIPT_DIR/../../common/common_functions.sh"
SUDO=""
PIPLOCK_LIB=""
CHATTTS_METADATA=""
PACKAGE_METADATA=""
PACKAGE_NAME=""
MISSING_PACKAGES=()
MODEL_READY=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        --full)   DO_FULL=1;   shift   ;;
        *) shift ;;
    esac
done
SERVER_URL="${SERVER_URL%/}"
[[ "${CHATTTS_INSTALL:-0}" == "1" || "${NEURAL_TTS_INSTALL:-0}" == "1" ]] && DO_FULL=1
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"
. "$SCRIPT_DIR/../../common/base_libs/cuda_index.sh"

PIPLOCK_LIB="$SCRIPT_DIR/../../common/base_libs/pip_lock.sh"
. "$PIPLOCK_LIB"
pip_i() { vpip "$PYTHON" -m pip install --break-system-packages "$@" 2>/dev/null || vpip "$PYTHON" -m pip install "$@"; }

server_up() {
    command -v curl >/dev/null 2>&1 || return 1
    local body=""
    body="$(curl -fsS --connect-timeout 3 "$SERVER_URL/health" 2>/dev/null || true)"
    printf '%s' "$body" | grep -Eq '"model_loaded"[[:space:]]*:[[:space:]]*true'
}

ensure_linux_audio_deps() {
    command -v ffmpeg >/dev/null 2>&1 && return 0
    command -v apt-get >/dev/null 2>&1 || return 0
    echo "[install_chattts] [..] apt: ffmpeg ..."
    $SUDO apt-get install -y ffmpeg >/dev/null 2>&1 || true
}

echo "============================================================"
echo " [install_chattts] ChatTTS (dialogue TTS api)"
echo "============================================================"

if [ "$(get_global_var "SKIP_LARGE_MODELS" "false")" = "true" ]; then
    echo "[install_chattts] [skip] Server environment without desktop and GPU detected. Skipping ChatTTS installation."
    complete_prereq_step "$PYTHON" "[install_chattts] " --absent-ok "server CPU host" ChatTTS
    exit 0
fi

[[ "${CHATTTS_SKIP:-0}" == "1" ]] && { echo "[install_chattts] [i] CHATTTS_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_chattts] " --absent-ok "CHATTTS_SKIP=1" ChatTTS; }
if server_up; then
    echo "[install_chattts] [OK] server reachable at $SERVER_URL."
    complete_prereq_step "$PYTHON" "[install_chattts] " --absent-ok "external server reachable" ChatTTS
fi

CHATTTS_METADATA="$("$PYTHON" -m pip show ChatTTS 2>/dev/null || true)"

if tts_dependencies_ready "$PYTHON" "chattts" "$DEPS_SENTINEL" \
    && [[ "$CHATTTS_METADATA" == *"Name:"* && -f "$API_DST" && -f "$MODEL_SENTINEL" ]] \
    && neural_tts_local_weights_ready "$WEIGHTS_DIR" "" "$PYTHON" "$MODEL_MANIFEST" \
    && [[ "$FORCE" -eq 0 && "$DO_FULL" -eq 0 ]]; then
    echo "[install_chattts] [OK] already installed."
    echo "[install_chattts]  START: cd \"$TARGET_DIR\" && python chattts_api_server.py"
    complete_prereq_step "$PYTHON" "[install_chattts] " ChatTTS
fi
if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]] \
    && ! tts_dependencies_ready "$PYTHON" "chattts" "$DEPS_SENTINEL"; then
    echo "[install_chattts] [i] opt-in only. Pass --full, CHATTTS_INSTALL=1, or NEURAL_TTS_INSTALL=1."
    complete_prereq_step "$PYTHON" "[install_chattts] " --absent-ok "opt-in" ChatTTS
fi

ensure_linux_audio_deps
mkdir -p "$TARGET_DIR"
cp -f "$API_SRC" "$API_DST"

echo "[install_chattts]  staging : $TARGET_DIR"
echo "[install_chattts]  weights : $WEIGHTS_DIR"
echo "[install_chattts]  compute : $(gpu_present && echo 'CUDA GPU' || echo 'CPU only')"

if tts_dependencies_ready "$PYTHON" "chattts" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 ]]; then
    echo "[install_chattts] [OK] .deps_done present."
else
    install_pycore_torch_stack "$PYTHON" "[install_chattts] "
    MISSING_PACKAGES=()
    for PACKAGE_NAME in ChatTTS fastapi uvicorn pydub; do
        PACKAGE_METADATA="$("$PYTHON" -m pip show "$PACKAGE_NAME" 2>/dev/null || true)"
        if [[ "$PACKAGE_METADATA" != *"Name:"* ]]; then
            MISSING_PACKAGES+=("$PACKAGE_NAME")
        fi
    done
    if [[ ${#MISSING_PACKAGES[@]} -gt 0 ]]; then
        echo "[install_chattts] [..] pip install missing packages: ${MISSING_PACKAGES[*]} ..."
        pip_i "${MISSING_PACKAGES[@]}" || true
    else
        echo "[install_chattts] [OK] pip package metadata is complete; preserving installed packages."
    fi
    if tts_engine_health_ok "$PYTHON" "chattts"; then
        tts_write_dependency_stamp "$PYTHON" "chattts" "$DEPS_SENTINEL"
    else
        echo "[install_chattts] [!] dependencies are incomplete; retrying next run." >&2
    fi
fi

CHATTTS_METADATA="$("$PYTHON" -m pip show ChatTTS 2>/dev/null || true)"
if [[ "$CHATTTS_METADATA" == *"Name:"* ]]; then
    if [[ -f "$MODEL_SENTINEL" ]] \
        && neural_tts_local_weights_ready "$WEIGHTS_DIR" "" "$PYTHON" "$MODEL_MANIFEST"; then
        MODEL_READY=1
    else
        echo "[install_chattts] [..] downloading or repairing installer-managed ChatTTS weights ..."
        if install_hf_repo_flat "$MODEL_REPO" "$WEIGHTS_DIR" "$MODEL_SENTINEL" \
            "[install_chattts] " "asset/*" "$(_hf_mirror_base)" "$MODEL_REPO" "$PYTHON" "1" \
            && neural_tts_local_weights_ready "$WEIGHTS_DIR" "" "$PYTHON" "$MODEL_MANIFEST"; then
            MODEL_READY=1
        fi
    fi
    if [[ "$MODEL_READY" -eq 1 ]]; then
        echo "[install_chattts] [OK] ready ($TARGET_DIR)."
        echo "[install_chattts]  START: cd \"$TARGET_DIR\" && python chattts_api_server.py"
        complete_prereq_step "$PYTHON" "[install_chattts] " ChatTTS
    fi
    echo "[install_chattts] [!] ChatTTS model download is incomplete; partial files were preserved for the next repair pass." >&2
    fail_prereq_step "$PYTHON" "[install_chattts] " ChatTTS
else
    echo "[install_chattts] [!] ChatTTS metadata is still missing; retrying next run."
    fail_prereq_step "$PYTHON" "[install_chattts] " ChatTTS
fi
