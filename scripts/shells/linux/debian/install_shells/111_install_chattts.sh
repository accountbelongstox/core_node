#!/bin/bash
# ChatTTS prerequisite (Linux) — official PyPI + local OpenAI-compatible api.
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
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
API_SRC="$(pycore_tts_install_assets_dir "$SCRIPT_DIR")/chattts_api_server.py"
API_DST="$TARGET_DIR/chattts_api_server.py"
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
[[ "${CHATTTS_INSTALL:-0}" == "1" || "${NEURAL_TTS_INSTALL:-0}" == "1" ]] && DO_FULL=1
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
py_has_module() { "$1" -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$2') else 1)" >/dev/null 2>&1; }

. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"
. "$SCRIPT_DIR/../../common/base_libs/cuda_index.sh"

PIPLOCK_LIB="$SCRIPT_DIR/../../common/base_libs/pip_lock.sh"
[ -f "$PIPLOCK_LIB" ] && . "$PIPLOCK_LIB"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }
pip_i() { vpip "$PYTHON" -m pip install --break-system-packages "$@" 2>/dev/null || vpip "$PYTHON" -m pip install "$@"; }

server_up() {
    command -v curl >/dev/null 2>&1 || return 1
    local c
    c="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 "$SERVER_URL/health" 2>/dev/null || echo 000)"
    [[ "$c" != "000" && "$c" -lt 500 ]] && return 0
    c="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 "$SERVER_URL/" 2>/dev/null || echo 000)"
    [[ "$c" != "000" && "$c" -lt 500 ]]
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

[[ "${CHATTTS_SKIP:-0}" == "1" ]] && { echo "[install_chattts] [i] CHATTTS_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_chattts] " --absent-ok "CHATTTS_SKIP=1" ChatTTS; }
if server_up; then
    echo "[install_chattts] [OK] server reachable at $SERVER_URL."
    complete_prereq_step "$PYTHON" "[install_chattts] " --absent-ok "external server reachable" ChatTTS
fi

if ! PYTHON="$(resolve_python)"; then
    echo "[install_chattts] [!] Python 3 not found."
    fail_prereq_step "$PYTHON" "[install_chattts] " ChatTTS
fi

if tts_dependencies_ready "$PYTHON" "chattts" "$DEPS_SENTINEL" && [[ -f "$API_DST" && "$FORCE" -eq 0 && "$DO_FULL" -eq 0 ]]; then
    echo "[install_chattts] [OK] already installed."
    echo "[install_chattts]  START: cd \"$TARGET_DIR\" && python chattts_api_server.py"
    complete_prereq_step "$PYTHON" "[install_chattts] " ChatTTS
fi
if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]]; then
    echo "[install_chattts] [i] opt-in only. Pass --full, CHATTTS_INSTALL=1, or NEURAL_TTS_INSTALL=1."
    complete_prereq_step "$PYTHON" "[install_chattts] " --absent-ok "opt-in" ChatTTS
fi

ensure_linux_audio_deps
mkdir -p "$TARGET_DIR"
[[ -f "$API_SRC" ]] && cp -f "$API_SRC" "$API_DST"

echo "[install_chattts]  staging : $TARGET_DIR"
echo "[install_chattts]  compute : $(gpu_present && echo 'CUDA GPU' || echo 'CPU only')"

if tts_dependencies_ready "$PYTHON" "chattts" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 ]]; then
    echo "[install_chattts] [OK] .deps_done present."
else
    install_pycore_torch_stack "$PYTHON" "[install_chattts] "
    echo "[install_chattts] [..] pip install ChatTTS (official PyPI) ..."
    pip_i --upgrade ChatTTS || true
    pip_i fastapi uvicorn pydub || true
    if ! tts_engine_health_ok "$PYTHON" "chattts" || ! tts_write_dependency_stamp "$PYTHON" "chattts" "$DEPS_SENTINEL"; then
        echo "[install_chattts] [!] dependencies are incomplete; retrying next run." >&2
        fail_prereq_step "$PYTHON" "[install_chattts] " ChatTTS
    fi
fi

if py_has_module "$PYTHON" ChatTTS; then
    echo "[install_chattts] [OK] ready ($TARGET_DIR)."
    echo "[install_chattts]  START: cd \"$TARGET_DIR\" && python chattts_api_server.py"
else
    echo "[install_chattts] [!] ChatTTS not importable after install."
fi
complete_prereq_step "$PYTHON" "[install_chattts] " ChatTTS
