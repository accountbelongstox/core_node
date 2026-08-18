#!/bin/bash
# Fish Speech / Fish Audio prerequisite (Linux).
# Installs fish-audio-sdk (PyPI, Python 3.13+) and clones fish-speech for optional
# local tools/api_server.py. GPU hosts get CUDA torch by default.
#
# Official SDK: https://docs.fish.audio/developer-guide/sdk-guide/quickstart
# Local server: https://speech.fish.audio/server/
#
# Invocation: 143_install_fishspeech.sh --python <py> [--full] [--force]
# Env: FISHSPEECH_SKIP=1, FISHSPEECH_INSTALL=1, NEURAL_TTS_INSTALL=1, FISHSPEECH_DIR, FISH_API_KEY
set -uo pipefail

PYTHON="python3"
FORCE=0
DO_FULL=0
REPO_URL="https://github.com/fishaudio/fish-speech.git"
SERVER_URL="${FISHSPEECH_URL:-http://127.0.0.1:8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
CACHE_ROOT="${CORE_NODE_CACHE_DIR:-$CORE_NODE_ROOT/.cache}"
TARGET_DIR="${FISHSPEECH_DIR:-$CACHE_ROOT/pycore/fishspeech}"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
REPO_MARKER="$TARGET_DIR/tools/api_server.py"
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
API_SRC="$(pycore_tts_install_assets_dir "$SCRIPT_DIR")/fishspeech_api_server.py"
API_DST="$TARGET_DIR/fishspeech_api_server.py"
source "$SCRIPT_DIR/../../common/common_functions.sh"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        --full)   DO_FULL=1;   shift   ;;
        *) shift ;;
    esac
done
SERVER_URL="${SERVER_URL%/}"
[[ "${FISHSPEECH_INSTALL:-0}" == "1" || "${NEURAL_TTS_INSTALL:-0}" == "1" ]] && DO_FULL=1

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
    c="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 "$SERVER_URL/v1/health" 2>/dev/null || echo 000)"
    [[ "$c" != "000" && "$c" -lt 500 ]]
}

echo "============================================================"
echo " [install_fishspeech] Fish Speech / Fish Audio"
echo "============================================================"

if [ "$(get_global_var "SKIP_LARGE_MODELS" "false")" = "true" ]; then
    echo "[install_fishspeech] [skip] Server environment without desktop and GPU detected. Skipping Fish Speech installation."
    complete_prereq_step "$PYTHON" "[install_fishspeech] " --absent-ok "server CPU host" fishaudio
    exit 0
fi

[[ "${FISHSPEECH_SKIP:-0}" == "1" ]] && { echo "[install_fishspeech] [i] FISHSPEECH_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_fishspeech] " --absent-ok "FISHSPEECH_SKIP=1" fishaudio; }
if server_up; then
    echo "[install_fishspeech] [OK] server at $SERVER_URL."
    complete_prereq_step "$PYTHON" "[install_fishspeech] " --absent-ok "external server reachable" fishaudio
fi
if tts_engine_compatible "$PYTHON" "fishspeech" "[install_fishspeech] " \
    && [[ -f "$API_DST" && "$FORCE" -eq 0 && "$DO_FULL" -eq 0 ]] \
    && tts_dependencies_ready "$PYTHON" "fishspeech" "$DEPS_SENTINEL"; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "Fish Speech already installed"
    echo "[install_fishspeech]  START: cd \"$TARGET_DIR\" && python fishspeech_api_server.py"
    echo "[install_fishspeech]  Or fish-speech: python tools/api_server.py --listen 0.0.0.0:8080"
    complete_prereq_step "$PYTHON" "[install_fishspeech] " fishaudio
fi
if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]]; then
    echo "[install_fishspeech] [i] opt-in only. Pass --full, FISHSPEECH_INSTALL=1, or NEURAL_TTS_INSTALL=1."
    complete_prereq_step "$PYTHON" "[install_fishspeech] " --absent-ok "opt-in" fishaudio
fi

if ! PYTHON="$(resolve_python)"; then
    echo "[install_fishspeech] [!] Python 3 not found."
    fail_prereq_step "$PYTHON" "[install_fishspeech] " fishaudio
fi
if ! tts_engine_compatible "$PYTHON" "fishspeech" "[install_fishspeech] "; then
    complete_prereq_step "$PYTHON" "[install_fishspeech] " --absent-ok "incompatible Python" fishaudio
fi

mkdir -p "$TARGET_DIR"

echo "[install_fishspeech]  staging : $TARGET_DIR"
echo "[install_fishspeech]  compute : $(gpu_present && echo 'CUDA GPU (torch CUDA wheel)' || echo 'CPU only')"
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" fishspeech | while read -r _line; do
    echo "[install_fishspeech]  official env (fishspeech): $_line"
done
_ckpt_flag="--cpu"
if gpu_present; then _ckpt_flag="--gpu"; fi
_fish_ckpt="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" fishspeech_checkpoint "$_ckpt_flag")"
echo "[install_fishspeech]  checkpoint tier ($(echo "$_ckpt_flag" | tr -d '-')): $_fish_ckpt (download per https://speech.fish.audio/install/)"

if [[ ! -f "$REPO_MARKER" ]] && command -v git >/dev/null 2>&1; then
    echo "[install_fishspeech] [..] cloning $REPO_URL (shallow) ..."
    git clone --depth 1 --progress "$REPO_URL" "$TARGET_DIR" 2>/dev/null || true
elif [[ ! -f "$REPO_MARKER" ]]; then
    echo "[install_fishspeech] [i] git not found; installing the Fish Audio SDK without the optional local server repo."
fi
[[ -f "$API_SRC" ]] && cp -f "$API_SRC" "$API_DST"

if tts_dependencies_ready "$PYTHON" "fishspeech" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "dependencies already installed (.deps_done)"
else
    install_pycore_torch_stack "$PYTHON" "[install_fishspeech] "
    echo "[install_fishspeech] [..] pip install fish-audio-sdk fastapi uvicorn requests ..."
    pip_i fish-audio-sdk fastapi uvicorn requests || true
    if [[ -f "$TARGET_DIR/pyproject.toml" || -f "$TARGET_DIR/setup.py" ]]; then
        echo "[install_fishspeech] [..] pip install -e fish-speech (best-effort) ..."
        (cd "$TARGET_DIR" && pip_i -e .) 2>/dev/null || true
    fi
    if tts_engine_health_ok "$PYTHON" "fishspeech" && tts_write_dependency_stamp "$PYTHON" "fishspeech" "$DEPS_SENTINEL"; then
        echo "[install_fishspeech] [OK] dependencies installed."
    else
        echo "[install_fishspeech] [!] dependencies are incomplete; retrying next run." >&2
        fail_prereq_step "$PYTHON" "[install_fishspeech] " fishaudio
    fi
fi

echo "[install_fishspeech] [OK] ready ($TARGET_DIR)."
echo "[install_fishspeech]  SDK: set FISH_API_KEY then python fishspeech_api_server.py"
echo "[install_fishspeech]  Local: download $_fish_ckpt checkpoints per https://speech.fish.audio/install/ then:"
echo "[install_fishspeech]         python tools/api_server.py --listen 0.0.0.0:8080"
complete_prereq_step "$PYTHON" "[install_fishspeech] " fishaudio
