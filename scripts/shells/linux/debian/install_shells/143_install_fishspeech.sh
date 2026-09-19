#!/bin/bash
SCRIPT_INDEX="143"
# Fish Speech / Fish Audio prerequisite (Linux).
# Builds a DEDICATED self-contained per-engine venv (base Python 3.12) via
# isolated_venv.ensure_venv('fishspeech', ...) carrying the bridge/SDK dependency
# plan; clones fish-speech for optional local tools/api_server.py. The main
# interpreter is only an HTTP client to the class-C bridge server.
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

# --- Install method selection (native/docker), plan steps 16-17 ---
# Per-engine choice; a saved valid choice is reused verbatim with no countdown.
if [[ "${FISHSPEECH_SKIP:-0}" != "1" ]]; then
    . "$SCRIPT_DIR/../../common/install_method_common.sh"
    INSTALL_METHOD="$(install_method_select fishspeech \
        --supported "native docker" \
        --recommended native \
        --recommendation-source "Fish Speech docs document native install and an official docker option (hub: fishaudio/fish-speech) - https://speech.fish.audio/install/" \
        --default native --method "${TTS_METHOD:-}" ${TTS_METHOD_RESELECT:+--reselect})" || {
        _method_rc=$?
        if [[ $_method_rc -eq 10 ]]; then
            echo "[fishspeech] install method selection cancelled; nothing changed."
            exit 0
        fi
        exit "$_method_rc"
    }
    if [[ "$INSTALL_METHOD" == "docker" ]]; then
        . "$SCRIPT_DIR/../../common/docker_prereq_common.sh"
        if ! docker_prereq_ensure_for_engine fishspeech "$SCRIPT_DIR"; then
            echo "[fishspeech][!] docker platform ensure failed (phase above); docker backend is not ready." >&2
            exit 1
        fi
        install_method_record_backend fishspeech docker
        . "$SCRIPT_DIR/../../common/tts_docker_compose_common.sh"
        if ! tts_docker_apply_engine fishspeech "$TARGET_DIR"; then
            echo "[fishspeech][!] docker compose apply failed (phase above); docker backend is not ready." >&2
            exit 1
        fi
        echo "[fishspeech][OK] docker compose service converged (project pycore-tts-fishspeech)."
        exit 0
    fi
    install_method_record_backend fishspeech native
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
    complete_prereq_step "$PYTHON" "[install_fishspeech] " --absent-ok "server CPU host"
    exit 0
fi

[[ "${FISHSPEECH_SKIP:-0}" == "1" ]] && { echo "[install_fishspeech] [i] FISHSPEECH_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_fishspeech] " --absent-ok "FISHSPEECH_SKIP=1"; }
if server_up; then
    echo "[install_fishspeech] [OK] server at $SERVER_URL."
    complete_prereq_step "$PYTHON" "[install_fishspeech] " --absent-ok "external server reachable"
fi
if tts_engine_compatible "$PYTHON" "fishspeech" "[install_fishspeech] " \
    && [[ -f "$API_DST" && "$FORCE" -eq 0 && "$DO_FULL" -eq 0 ]] \
    && tts_dependencies_ready "$PYTHON" "fishspeech" "$DEPS_SENTINEL"; then
    tts_probe_isolated_venv_provisioned "$PYTHON" "fishspeech"
    if [[ "$TTS_ISOLATED_VENV_READY" == "1" ]]; then
        tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "Fish Speech already installed"
        echo "[install_fishspeech]  Runtime: pycore launches fishspeech_api_server.py (class C) under the isolated venv on demand."
        complete_prereq_step "$PYTHON" "[install_fishspeech] "
    fi
fi
if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]]; then
    echo "[install_fishspeech] [i] opt-in only. Pass --full, FISHSPEECH_INSTALL=1, or NEURAL_TTS_INSTALL=1."
    complete_prereq_step "$PYTHON" "[install_fishspeech] " --absent-ok "opt-in"
fi

if ! PYTHON="$(resolve_python)"; then
    echo "[install_fishspeech] [!] Python 3 not found."
    fail_prereq_step "$PYTHON" "[install_fishspeech] "
fi
tts_ensure_engine_base_runtime "$PYTHON" "fishspeech"
if ! tts_engine_compatible "$PYTHON" "fishspeech" "[install_fishspeech] "; then
    complete_prereq_step "$PYTHON" "[install_fishspeech] " --absent-ok "incompatible Python"
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
_chunking_src="$(pycore_tts_install_assets_dir "$SCRIPT_DIR")/tts_text_chunking.py"
[[ -f "$_chunking_src" ]] && cp -f "$_chunking_src" "$TARGET_DIR/tts_text_chunking.py"

# --- Isolated venv (Bucket B, self-contained): the Fish Speech bridge runs
#     under the dedicated Python 3.12 venv; the main interpreter is only an
#     HTTP client. --- #
tts_probe_isolated_venv_provisioned "$PYTHON" "fishspeech"
if [[ "$TTS_ISOLATED_VENV_READY" == "1" ]] && tts_dependencies_ready "$PYTHON" "fishspeech" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "isolated venv already provisioned (.deps_done)"
else
    echo "[install_fishspeech] [..] building/verifying isolated fishspeech venv (ensure_venv; first build takes minutes) ..."
    tts_provision_isolated_venv "$PYTHON" "fishspeech" "$FORCE"
    if [[ "$TTS_ISOLATED_VENV_READY" == "1" ]]; then
        _venv_py="$(tts_resolve_isolated_python "$PYTHON" "fishspeech")"
        if [[ -n "$_venv_py" && ( -f "$TARGET_DIR/pyproject.toml" || -f "$TARGET_DIR/setup.py" ) ]]; then
            echo "[install_fishspeech] [..] pip install -e fish-speech into the venv (best-effort) ..."
            (cd "$TARGET_DIR" && "$_venv_py" -m pip install -e .) 2>/dev/null || true
        fi
    fi
    if [[ "$TTS_ISOLATED_VENV_READY" == "1" ]] && tts_write_dependency_stamp "$PYTHON" "fishspeech" "$DEPS_SENTINEL"; then
        echo "[install_fishspeech] [OK] isolated fishspeech venv ready (policy stamp written)."
    else
        echo "[install_fishspeech] [!] venv build incomplete; will retry next run (main interpreter untouched)." >&2
        fail_prereq_step "$PYTHON" "[install_fishspeech] "
    fi
fi

echo "[install_fishspeech] [OK] ready ($TARGET_DIR)."
echo "[install_fishspeech]  Runtime: pycore launches fishspeech_api_server.py (class C) under the isolated venv on demand."
echo "[install_fishspeech]  SDK: set FISH_API_KEY; local: download $_fish_ckpt checkpoints per https://speech.fish.audio/install/ and set FISHSPEECH_UPSTREAM."

# --- Local inference checkpoints (IDEMPOTENT: sentinel + resumable download) --- #
# Bridge/SDK mode works without weights; a failed download never fails the step.
# Self-heal stale operator overrides: a FISHSPEECH_CHECKPOINT value that does
# not exist on the Hub (e.g. openaudio-s1, recommended by older docs) would
# 404 on every run. Only a definitive 404 resets it to the tier default;
# network failures keep the operator's choice untouched.
_ckpt_repo="${FISHSPEECH_CHECKPOINT:-$_fish_ckpt}"
[[ "$_ckpt_repo" == */* ]] || _ckpt_repo="fishaudio/$_ckpt_repo"
if [[ -n "${FISHSPEECH_CHECKPOINT:-}" && -n "$_fish_ckpt" && "$(_hf_repo_existence "$_ckpt_repo")" == "missing" ]]; then
    _fallback_repo="$_fish_ckpt"
    [[ "$_fallback_repo" == */* ]] || _fallback_repo="fishaudio/$_fallback_repo"
    if [[ "$_fallback_repo" != "$_ckpt_repo" ]]; then
        echo "[install_fishspeech] [!] FISHSPEECH_CHECKPOINT=$_ckpt_repo does not exist on Hugging Face (404); resetting to tier default $_fallback_repo." >&2
        export FISHSPEECH_CHECKPOINT="$_fallback_repo"
        _ckpt_repo="$_fallback_repo"
    fi
fi
_ckpt_name="$(basename "$_ckpt_repo")"
CKPT_DIR="$TARGET_DIR/checkpoints/$_ckpt_name"
CKPT_SENTINEL="$TARGET_DIR/checkpoints/.ckpt_${_ckpt_name}_done"
if [[ -f "$CKPT_SENTINEL" && -f "$CKPT_DIR/config.json" && "$FORCE" -eq 0 ]]; then
    echo "[install_fishspeech] [OK] checkpoint $_ckpt_name already present."
else
    echo "[install_fishspeech] [..] downloading checkpoint $_ckpt_repo (curl, resumable) ..."
    if install_hf_repo_flat "$_ckpt_repo" "$CKPT_DIR" "$CKPT_SENTINEL" "[install_fishspeech] " "*.json,*.pth,*.safetensors,*.txt,*.tiktoken,*.model" "" "$_ckpt_name" \
        && [[ -f "$CKPT_DIR/config.json" ]]; then
        echo "[install_fishspeech] [OK] checkpoint ready at $CKPT_DIR (local inference mode enabled)."
    else
        echo "[install_fishspeech] [!] checkpoint download incomplete; will RESUME next run (bridge/SDK mode still works)."
    fi
fi
complete_prereq_step "$PYTHON" "[install_fishspeech] "
