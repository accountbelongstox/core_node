#!/bin/bash
SCRIPT_INDEX="137"
# GPT-SoVITS TTS prerequisite (Linux) - free voice-clone HTTP server on :9880 (class C).
# Auto-run by prepare_pycore_prerequisites.sh (pyservice).
#
# Lifecycle rule (see development-guides/cross-docs/
# TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md Section 5 & Section 7, Bucket B): the repo's requirements.txt
# pins an OLD transformers, INCOMPATIBLE with the main interpreter's shared 4.46.x pin
# (deepseek/qwen25/nllb/bark). So the requirements are NEVER installed into the main
# interpreter: they are built into a DEDICATED per-engine venv by
# pycore.pyutils.common.python_env.isolated_venv.ensure_venv("gptsovits", ...) (self-contained:
# dedicated base Python 3.10, no host package sharing; the venv carries its own torch stack,
# shadowing the main copies). pycore's tts_service_manager launches the cloned api_v2.py
# under that venv (isolated_venv.resolve_python("gptsovits")) and the gptsovits engine talks
# to it over HTTP as a managed class-C server, so the conflicting pins never touch the main
# interpreter. The heavy clone + venv build + model download is nonetheless OPT-IN so a normal
# boot is never ambushed - it runs only when requested (--full / GPTSOVITS_INSTALL=1);
# an already-built install (.deps_done) is still maintained + self-repaired.
# Everything is IDEMPOTENT (never re-clones/re-downloads what is present). CPU/GPU: CUDA
# torch when a GPU is present, else CPU (the post-install torch_cpu_guard.sh also reconciles).
# Repo: https://github.com/RVC-Boss/GPT-SoVITS ; models: HF lj1995/GPT-SoVITS.
#
# Invocation (prepare_pycore_prerequisites.sh):  install_gptsovits.sh --python <py> [--full] [--force]
# Env: GPTSOVITS_SKIP=1 (skip), GPTSOVITS_INSTALL=1 (== --full), GPTSOVITS_DIR, GPTSOVITS_URL
set -uo pipefail

PYTHON="python3"
ENGINE_PYTHON=""
FORCE=0
DO_FULL=0
REPO_URL="https://github.com/RVC-Boss/GPT-SoVITS.git"
HF_REPO="lj1995/GPT-SoVITS"
SERVER_URL="${GPTSOVITS_URL:-http://127.0.0.1:9880}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Repo root = 5 levels up from install_shells (scripts/shells/linux/debian/install_shells);
# needed on sys.path so `import pycore...` resolves when building the isolated venv.
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
CACHE_ROOT="${CORE_NODE_CACHE_DIR:-$CORE_NODE_ROOT/.cache}"
# Staging lives under the shared cache dir (<cache>/pycore/gptsovits).
TARGET_DIR="${GPTSOVITS_DIR:-$CACHE_ROOT/pycore/gptsovits}"
MODELS_DIR="$TARGET_DIR/GPT_SoVITS/pretrained_models"
SENTINEL="$MODELS_DIR/.snapshot_done"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
REQ_FILE="$TARGET_DIR/requirements.txt"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        --full)   DO_FULL=1;   shift   ;;
        *) shift ;;
    esac
done
ENGINE_PYTHON="${GPTSOVITS_PYTHON:-}"
SERVER_URL="${SERVER_URL%/}"
# Env opt-in (mirrors --full): GPTSOVITS_INSTALL=1 enables a fresh install.
[[ "${GPTSOVITS_INSTALL:-0}" == "1" ]] && DO_FULL=1

# --- Install method selection (native/docker), plan steps 16-17 ---
# Per-engine choice; a saved valid choice is reused verbatim with no countdown.
if [[ "${GPTSOVITS_SKIP:-0}" != "1" ]]; then
    . "$SCRIPT_DIR/../../common/install_method_common.sh"
    INSTALL_METHOD="$(install_method_select gptsovits \
        --supported "native docker" \
        --recommended native \
        --recommendation-source "GPT-SoVITS official README documents native setup and a community docker image (hub: xxxxrt666/gpt-sovits) - https://github.com/RVC-Boss/GPT-SoVITS" \
        --default native --method "${TTS_METHOD:-}" ${TTS_METHOD_RESELECT:+--reselect})" || {
        _method_rc=$?
        if [[ $_method_rc -eq 10 ]]; then
            echo "[gptsovits] install method selection cancelled; nothing changed."
            exit 0
        fi
        exit "$_method_rc"
    }
    if [[ "$INSTALL_METHOD" == "docker" ]]; then
        . "$SCRIPT_DIR/../../common/docker_prereq_common.sh"
        if ! docker_prereq_ensure_for_engine gptsovits "$SCRIPT_DIR"; then
            echo "[gptsovits][!] docker platform ensure failed (phase above); docker backend is not ready." >&2
            exit 1
        fi
        install_method_record_backend gptsovits docker
        . "$SCRIPT_DIR/../../common/tts_docker_compose_common.sh"
        if ! tts_docker_apply_engine gptsovits "$TARGET_DIR"; then
            echo "[gptsovits][!] docker compose apply failed (phase above); docker backend is not ready." >&2
            exit 1
        fi
        echo "[gptsovits][OK] docker compose service converged (project pycore-tts-gptsovits)."
        exit 0
    fi
    install_method_record_backend gptsovits native
fi

resolve_python() {
    local preferred="${1:-$PYTHON}"
    local p
    for p in "$preferred" python3 python; do
        if command -v "$p" >/dev/null 2>&1; then
            command -v "$p"; return 0
        fi
    done
    return 1
}
resolve_requested_python() {
    local requested="$1"
    if command -v "$requested" >/dev/null 2>&1; then
        command -v "$requested"
        return 0
    fi
    return 1
}
. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"   # provides gpu_present() (canonical: CUDADetector)
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
# Driver-matched CUDA wheel index (single source of truth) so the GPU torch install never
# grabs the default "latest" wheel (e.g. cu130) that a 12.4 driver can't run.
. "$SCRIPT_DIR/../../common/base_libs/cuda_index.sh"
source "$SCRIPT_DIR/../../common/common_functions.sh"

# Serialize pip into the shared venv (safe under the parallel install driver). Defensive.
PIPLOCK_LIB="$SCRIPT_DIR/../../common/base_libs/pip_lock.sh"
. "$PIPLOCK_LIB"
server_up() { command -v curl >/dev/null 2>&1 || return 1; local c; c="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 "$SERVER_URL/" 2>/dev/null || echo 000)"; [[ "$c" != "000" ]]; }
pip_i() { vpip "$PYTHON" -m pip install --break-system-packages "$@" 2>/dev/null || vpip "$PYTHON" -m pip install "$@"; }

echo "============================================================"
echo " [install_gptsovits] GPT-SoVITS TTS (free voice-clone server)"
echo "============================================================"

if [ "$(get_global_var "SKIP_LARGE_MODELS" "false")" = "true" ] && ! tts_engine_cpu_supported "$PYTHON" "gptsovits"; then
    echo "[install_gptsovits] [skip] Server environment without desktop and GPU detected. Skipping GPT-SoVITS installation."
    complete_prereq_step "$PYTHON" "[install_gptsovits] " --absent-ok "server CPU host" torch
    exit 0
fi

[[ "${GPTSOVITS_SKIP:-0}" == "1" ]] && { echo "[install_gptsovits] [i] GPTSOVITS_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_gptsovits] " --absent-ok "GPTSOVITS_SKIP=1" torch; }
if server_up; then
    echo "[install_gptsovits] [OK] server reachable at $SERVER_URL -> nothing to do."
    echo "[install_gptsovits]      Set GPTSOVITS_REF_AUDIO to a reference clip to enable the engine."
    complete_prereq_step "$PYTHON" "[install_gptsovits] " --absent-ok "external server reachable" torch
fi
# Fully installed already (repo + models + isolated venv) -> instant idempotent exit, no
# re-pip. The venv is verified (and self-repaired) before the fast exit so a broken venv is
# never masked by present sentinels.
if [[ -f "$TARGET_DIR/api_v2.py" && -f "$SENTINEL" && -f "$REQ_FILE" && "$FORCE" -eq 0 ]] \
    && tts_dependency_stamp_matches "$PYTHON" "gptsovits" "$DEPS_SENTINEL"; then
    tts_probe_isolated_venv_provisioned "$PYTHON" "gptsovits"
    if [[ "$TTS_ISOLATED_VENV_READY" -eq 1 ]]; then
        tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "GPT-SoVITS repo + models + isolated venv already present"
        echo "[install_gptsovits]  START:  pycore launches $TARGET_DIR/api_v2.py under the ISOLATED venv as a managed class-C server ($SERVER_URL)."
        complete_prereq_step "$PYTHON" "[install_gptsovits] " torch
    fi
    echo "[install_gptsovits] [..] isolated venv needs (re)provisioning; continuing."
fi
# OPT-IN: a fresh install clones the repo and builds its requirements.txt into a DEDICATED
# isolated venv (the old-transformers pin never touches the shared interpreter). It is still
# gated behind an explicit opt-in (--full / GPTSOVITS_INSTALL=1) because the clone + venv
# build + model download is heavy. An already-built install (.deps_done) is maintained +
# self-repaired without opt-in.
if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 && ! -f "$DEPS_SENTINEL" ]]; then
    echo "[install_gptsovits] [i] opt-in only -> NOT installing. Pass --full or GPTSOVITS_INSTALL=1 to clone + build the isolated GPT-SoVITS venv. Skipping."
    complete_prereq_step "$PYTHON" "[install_gptsovits] " --absent-ok "opt-in" torch
fi

echo "[install_gptsovits]  staging : $TARGET_DIR"
echo "[install_gptsovits]  models  : $MODELS_DIR"
echo "[install_gptsovits]  compute : $(gpu_hardware_present && echo 'CUDA GPU -> GPU build + models' || echo 'CPU only -> CPU build')"
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" gptsovits | while read -r _line; do
    echo "[install_gptsovits]  official env (gptsovits): $_line"
done

if ! PYTHON="$(resolve_python "$PYTHON")"; then
    echo "[install_gptsovits] [!] Python 3 not found; cannot install."
    fail_prereq_step "$PYTHON" "[install_gptsovits] " torch
fi
if [[ -n "$ENGINE_PYTHON" ]]; then
    if ENGINE_PYTHON="$(resolve_requested_python "$ENGINE_PYTHON")"; then
        export GPTSOVITS_PYTHON="$ENGINE_PYTHON"
    else
        echo "[install_gptsovits] [i] GPTSOVITS_PYTHON is invalid; using the shared interpreter policy."
        ENGINE_PYTHON="$PYTHON"
        unset GPTSOVITS_PYTHON
    fi
else
    ENGINE_PYTHON="$PYTHON"
fi
tts_ensure_engine_base_runtime "$PYTHON" "gptsovits"
if ! tts_engine_compatible "$ENGINE_PYTHON" "gptsovits" "[install_gptsovits] "; then
    complete_prereq_step "$PYTHON" "[install_gptsovits] " --absent-ok "incompatible Python" torch
fi

# 1) clone (idempotent) --------------------------------------------------- #
if [[ -f "$TARGET_DIR/api_v2.py" ]]; then
    echo "[install_gptsovits] [OK] repo already present -> skipping clone."
else
    command -v git >/dev/null 2>&1 || { echo "[install_gptsovits] [!] git not found; install git then re-run."; fail_prereq_step "$PYTHON" "[install_gptsovits] " torch; }
    echo "[install_gptsovits] [..] cloning $REPO_URL -> $TARGET_DIR (progress shown)"
    mkdir -p "$(dirname "$TARGET_DIR")"
    git clone --depth 1 --progress "$REPO_URL" "$TARGET_DIR" || { echo "[install_gptsovits] [!] clone failed."; fail_prereq_step "$PYTHON" "[install_gptsovits] " torch; }
fi

# 2) isolated venv from requirements.txt -- ONE-TIME via a .deps_done sentinel, self-repairing.
# The repo's requirements.txt pins an OLD transformers; building it into a DEDICATED
# per-engine venv (isolated_venv.ensure_venv, self-contained base Python 3.10; the venv carries its own CUDA
# torch) keeps that pin OUT of the main interpreter. This also ends the huggingface_hub
# upgrade<->downgrade ping-pong the old shared-interpreter install caused: any hub version
# the requirements need now lives only inside the venv. ensure_venv is idempotent (a cheap
# import probe when healthy) and repairs a broken venv, so it is safe to run every sweep.
if [[ ! -f "$REQ_FILE" ]]; then
    echo "[install_gptsovits] [!] requirements.txt not found in the cloned repo; cannot build the isolated venv."
    fail_prereq_step "$PYTHON" "[install_gptsovits] " torch
fi
tts_probe_isolated_venv_provisioned "$PYTHON" "gptsovits"
if [[ "$TTS_ISOLATED_VENV_READY" -eq 1 ]] && tts_dependency_stamp_matches "$PYTHON" "gptsovits" "$DEPS_SENTINEL" && [[ "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "isolated GPT-SoVITS venv provisioned (.deps_done)"
    echo "[install_gptsovits] [OK] isolated GPT-SoVITS venv verified."
else
    echo "[install_gptsovits] [..] building isolated GPT-SoVITS venv from requirements.txt (old transformers isolated; the venv carries its own torch stack) ..."
    tts_provision_isolated_venv "$PYTHON" "gptsovits" "$FORCE" -r "$REQ_FILE"
    if [[ "$TTS_ISOLATED_VENV_READY" -eq 1 ]] && tts_write_dependency_stamp "$PYTHON" "gptsovits" "$DEPS_SENTINEL"; then
        echo "[install_gptsovits] [OK] isolated GPT-SoVITS venv ready (.deps_done); main interpreter untouched."
    else
        echo "[install_gptsovits] [!] venv provisioning incomplete; will RESUME next run."
        fail_prereq_step "$PYTHON" "[install_gptsovits] "
    fi
fi

# 2b) torchcodec: api_v2 loads the reference clip via load_with_torchcodec; the
# cloned requirements.txt predates that dependency, so repair missing-only
# (never --upgrade; pip resolves the compatible build for the venv's torch).
if [[ "$TTS_ISOLATED_VENV_READY" -eq 1 ]]; then
    gptsovits_venv_py="$(tts_resolve_isolated_python "$PYTHON" "gptsovits")"
    if [[ -n "$gptsovits_venv_py" ]] && ! "$gptsovits_venv_py" -c 'import torchcodec' >/dev/null 2>&1; then
        echo "[install_gptsovits] [..] installing missing torchcodec into the isolated venv (api_v2 audio loader) ..."
        "$gptsovits_venv_py" -m pip install torchcodec || echo "[install_gptsovits] [!] torchcodec install failed; will retry next run."
    fi
fi

# 2c) NLTK data: the English G2P path (pos_tag / g2p_en) fails every /tts call
# without these resources; download missing-only into the venv's own nltk_data
# (NLTK searches <sys.prefix>/nltk_data).
if [[ "$TTS_ISOLATED_VENV_READY" -eq 1 ]]; then
    gptsovits_venv_py="$(tts_resolve_isolated_python "$PYTHON" "gptsovits")"
    if [[ -n "$gptsovits_venv_py" ]]; then
        gptsovits_venv_root="$(dirname "$(dirname "$gptsovits_venv_py")")"
        nltk_missing=0
        for res in "taggers/averaged_perceptron_tagger_eng" "corpora/cmudict"; do
            if [[ ! -e "$gptsovits_venv_root/nltk_data/$res" && ! -e "$gptsovits_venv_root/nltk_data/$res.zip" ]]; then
                nltk_missing=1
            fi
        done
        if [[ "$nltk_missing" -eq 1 ]]; then
            echo "[install_gptsovits] [..] downloading missing NLTK data (averaged_perceptron_tagger_eng, cmudict) into the isolated venv ..."
            "$gptsovits_venv_py" -m nltk.downloader -d "$gptsovits_venv_root/nltk_data" averaged_perceptron_tagger_eng cmudict || echo "[install_gptsovits] [!] NLTK data download failed; will retry next run."
        fi
    fi
fi

# 3) pretrained models from HuggingFace (IDEMPOTENT: sentinel + curl resume) #
if [[ -f "$SENTINEL" && "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "pretrained models sentinel present"
else
    if [[ -z "${GPTSOVITS_HF_ALLOW:-}" ]]; then
        if gpu_hardware_present; then
            export GPTSOVITS_HF_ALLOW="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" gptsovits_hf_allow --gpu)"
            echo "[install_gptsovits]  models: GPU max -> GPTSOVITS_HF_ALLOW=$GPTSOVITS_HF_ALLOW"
        else
            export GPTSOVITS_HF_ALLOW="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" gptsovits_hf_allow --cpu)"
            echo "[install_gptsovits]  models: CPU max -> GPTSOVITS_HF_ALLOW=$GPTSOVITS_HF_ALLOW"
        fi
    fi
    echo "[install_gptsovits] [..] downloading models $HF_REPO -> $MODELS_DIR (mirror bytes, resumable, live progress)"
    mkdir -p "$MODELS_DIR"
    _allow="${GPTSOVITS_HF_ALLOW:-*}"
    install_hf_repo_flat "$HF_REPO" "$MODELS_DIR" "$SENTINEL" "[install_gptsovits] " "$_allow" "$(_hf_mirror_base)" "done" || true
    if [[ -f "$SENTINEL" ]]; then
        echo "[install_gptsovits] [OK] pretrained models downloaded."
    else
        echo "[install_gptsovits] [!] model download not finished; will RESUME next run (finished files are NOT re-downloaded)."
        fail_prereq_step "$PYTHON" "[install_gptsovits] "
    fi
fi

echo "[install_gptsovits] [OK] GPT-SoVITS ready ($TARGET_DIR)."
echo "[install_gptsovits]  START:  pycore launches $TARGET_DIR/api_v2.py under the ISOLATED venv (isolated_venv.resolve_python(\"gptsovits\")) as a managed class-C server ($SERVER_URL); no manual start needed."
echo "[install_gptsovits]  Then set GPTSOVITS_REF_AUDIO (+ optional GPTSOVITS_PROMPT_TEXT/LANG)."
complete_prereq_step "$PYTHON" "[install_gptsovits] " torch
