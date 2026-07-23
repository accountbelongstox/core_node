#!/bin/bash
# F5-TTS prerequisite (Linux) — SWivid/F5-TTS + minimal HTTP /process wrapper.
# Auto-run by prepare_pycore_prerequisites.sh (pyservice). Clones SWivid/F5-TTS idempotently and copies
# f5tts_api_server.py into the staging dir. pycore's f5tts engine calls POST /process.
#
# Official: https://github.com/SWivid/F5-TTS (src/f5_tts/api.py)
# Wrapper:  f5tts_api_server.py (community HTTP pattern, issue #329)
#
# Linux extras: apt ffmpeg + espeak-ng (some builds need a phonemizer backend).
#
# Invocation: install_f5tts.sh --python <py> [--full] [--force]
# Env: F5TTS_SKIP=1, F5TTS_INSTALL=1, F5TTS_DIR, F5TTS_URL
set -uo pipefail

PYTHON="python3"
FORCE=0
DO_FULL=0
REPO_URL="https://github.com/SWivid/F5-TTS.git"
SERVER_URL="${F5TTS_URL:-http://127.0.0.1:7860}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
CACHE_ROOT="${CORE_NODE_CACHE_DIR:-$CORE_NODE_ROOT/.cache}"
TARGET_DIR="${F5TTS_DIR:-$CACHE_ROOT/pycore/f5tts}"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
REPO_MARKER="$TARGET_DIR/src/f5_tts/api.py"
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
API_SRC="$(pycore_tts_install_assets_dir "$SCRIPT_DIR")/f5tts_api_server.py"
API_DST="$TARGET_DIR/f5tts_api_server.py"
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
[[ "${F5TTS_INSTALL:-0}" == "1" || "${NEURAL_TTS_INSTALL:-0}" == "1" ]] && DO_FULL=1
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
    c="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 "$SERVER_URL/health" 2>/dev/null || echo 000)"
    [[ "$c" != "000" && "$c" -lt 500 ]]
}

ensure_linux_audio_deps() {
    command -v apt-get >/dev/null 2>&1 || return 0
    echo "[install_f5tts] [..] apt: ffmpeg espeak-ng libsndfile1 ..."
    $SUDO apt-get install -y ffmpeg espeak-ng libsndfile1 >/dev/null 2>&1 || true
}

echo "============================================================"
echo " [install_f5tts] F5-TTS (flow-matching clone api)"
echo "============================================================"

[[ "${F5TTS_SKIP:-0}" == "1" ]] && { echo "[install_f5tts] [i] F5TTS_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_f5tts] " --absent-ok "F5TTS_SKIP=1" f5_tts; }
if server_up; then
    echo "[install_f5tts] [OK] server at $SERVER_URL."
    echo "[install_f5tts]      Set F5TTS_REF_AUDIO + F5TTS_REF_TEXT."
    complete_prereq_step "$PYTHON" "[install_f5tts] " --absent-ok "external server reachable" f5_tts
fi
if [[ -f "$REPO_MARKER" && "$FORCE" -eq 0 && "$DO_FULL" -eq 0 ]] \
    && tts_dependencies_ready "$PYTHON" "f5tts" "$DEPS_SENTINEL"; then
    echo "[install_f5tts] [OK] already installed."
    echo "[install_f5tts]  START: cd \"$TARGET_DIR\" && python f5tts_api_server.py"
    complete_prereq_step "$PYTHON" "[install_f5tts] " f5_tts
fi
if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]]; then
    echo "[install_f5tts] [i] opt-in only. Pass --full, F5TTS_INSTALL=1, or NEURAL_TTS_INSTALL=1."
    complete_prereq_step "$PYTHON" "[install_f5tts] " --absent-ok "opt-in" f5_tts
fi

if ! PYTHON="$(resolve_python)"; then
    echo "[install_f5tts] [!] Python 3 not found."
    fail_prereq_step "$PYTHON" "[install_f5tts] " f5_tts
fi
ensure_linux_audio_deps

echo "[install_f5tts]  staging : $TARGET_DIR"
echo "[install_f5tts]  compute : $(gpu_present && echo 'CUDA GPU' || echo 'CPU only')"

if [[ -f "$REPO_MARKER" ]]; then
    echo "[install_f5tts] [OK] repo already present."
else
    command -v git >/dev/null 2>&1 || { echo "[install_f5tts] [!] git not found."; fail_prereq_step "$PYTHON" "[install_f5tts] " f5_tts; }
    mkdir -p "$(dirname "$TARGET_DIR")"
    git clone --depth 1 --progress "$REPO_URL" "$TARGET_DIR" || { echo "[install_f5tts] [!] clone failed."; fail_prereq_step "$PYTHON" "[install_f5tts] " f5_tts; }
fi
[[ -f "$API_SRC" ]] && cp -f "$API_SRC" "$API_DST"

if tts_dependencies_ready "$PYTHON" "f5tts" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 ]]; then
    echo "[install_f5tts] [OK] .deps_done present."
else
    install_pycore_torch_stack "$PYTHON" "[install_f5tts] "
    (cd "$TARGET_DIR" && pip_i -e .) || true
    pip_i fastapi uvicorn python-multipart || true
    if tts_engine_health_ok "$PYTHON" "f5tts" && tts_write_dependency_stamp "$PYTHON" "f5tts" "$DEPS_SENTINEL"; then
        echo "[install_f5tts] [OK] dependencies installed."
    else
        echo "[install_f5tts] [!] dependencies are incomplete; retrying next run." >&2
        fail_prereq_step "$PYTHON" "[install_f5tts] " f5_tts
    fi
fi

echo "[install_f5tts] [OK] ready. Set F5TTS_REF_AUDIO + F5TTS_REF_TEXT."
echo "[install_f5tts]  START: cd \"$TARGET_DIR\" && python f5tts_api_server.py"
complete_prereq_step "$PYTHON" "[install_f5tts] " f5_tts
