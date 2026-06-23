#!/bin/bash
# GPT-SoVITS TTS prerequisite (Linux) — free voice-clone HTTP server on :9880.
# Auto-run by prepare.sh (pyservice). Installs by default into a STAGING area under
# the code's data root and downloads the pretrained models — IDEMPOTENTLY (never
# re-clones or re-downloads what is present). CPU/GPU: CUDA torch when a GPU is
# present, else CPU (the post-install torch_cpu_guard.sh also reconciles this).
# Repo: https://github.com/RVC-Boss/GPT-SoVITS ; models: HF lj1995/GPT-SoVITS.
#
# Invocation (prepare.sh):  install_gptsovits.sh --python <py> [--force]
# Env: GPTSOVITS_SKIP=1 (skip), GPTSOVITS_DIR, GPTSOVITS_URL
set -uo pipefail

PYTHON="python3"
FORCE=0
DO_FULL=0
REPO_URL="https://github.com/RVC-Boss/GPT-SoVITS.git"
HF_REPO="lj1995/GPT-SoVITS"
SERVER_URL="${GPTSOVITS_URL:-http://127.0.0.1:9880}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# CORE_NODE_ROOT = parent-of-repo (where .data/pycore/gptsovits actually lives).
# Old location pycore/scripts/iniscripts used ../../../.. (4 up) = parent of the repo
# root; the real GPT-SoVITS staging tree sits there. From the new location
# (scripts/shells/linux/common/iniscripts, 5 below repo root) that same parent-of-repo
# target is SIX levels up. (Repo root would be 5 up, but the existing data is in the parent.)
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../../.." && pwd)"
TARGET_DIR="${GPTSOVITS_DIR:-$CORE_NODE_ROOT/.data/pycore/gptsovits}"
MODELS_DIR="$TARGET_DIR/GPT_SoVITS/pretrained_models"
SENTINEL="$MODELS_DIR/.snapshot_done"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        --full)   DO_FULL=1;   shift   ;;
        *) shift ;;
    esac
done
SERVER_URL="${SERVER_URL%/}"
# Env opt-in (mirrors --full): GPTSOVITS_INSTALL=1 enables a fresh install.
[[ "${GPTSOVITS_INSTALL:-0}" == "1" ]] && DO_FULL=1

resolve_python() {
    local p
    for p in "$PYTHON" python3 python; do
        if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
            command -v "$p"; return 0
        fi
    done
    return 1
}
. "$SCRIPT_DIR/../base_libs/lib_gpu.sh"   # provides gpu_present() (canonical: CUDADetector)
# Serialize pip into the shared venv (safe under the parallel install driver). Defensive.
PIPLOCK_LIB="$SCRIPT_DIR/../base_libs/pip_lock.sh"
[ -f "$PIPLOCK_LIB" ] && . "$PIPLOCK_LIB"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }
server_up() { command -v curl >/dev/null 2>&1 || return 1; local c; c="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 "$SERVER_URL/" 2>/dev/null || echo 000)"; [[ "$c" != "000" ]]; }
pip_i() { vpip "$PYTHON" -m pip install --break-system-packages "$@" 2>/dev/null || vpip "$PYTHON" -m pip install "$@"; }

echo "============================================================"
echo " [install_gptsovits] GPT-SoVITS TTS (free voice-clone server)"
echo "============================================================"

[[ "${GPTSOVITS_SKIP:-0}" == "1" ]] && { echo "[install_gptsovits] [i] GPTSOVITS_SKIP=1 -> skipping."; exit 0; }
if server_up; then
    echo "[install_gptsovits] [OK] server reachable at $SERVER_URL -> nothing to do."
    echo "[install_gptsovits]      Set GPTSOVITS_REF_AUDIO to a reference clip to enable the engine."
    exit 0
fi
# Fully installed already (repo + models) -> instant idempotent exit, no re-pip.
if [[ -f "$TARGET_DIR/api_v2.py" && -f "$SENTINEL" && "$FORCE" -eq 0 ]]; then
    echo "[install_gptsovits] [OK] already installed (repo + models present) -> skipping."
    echo "[install_gptsovits]  START:  cd \"$TARGET_DIR\" && python api_v2.py   (serves $SERVER_URL)"
    exit 0
fi
# OPT-IN: a fresh install clones the repo and pip-installs its requirements.txt, which
# pins an OLD transformers and would downgrade the shared venv (5.x, used by the LLM
# stack). So install ONLY when explicitly requested (--full / GPTSOVITS_INSTALL=1).
if [[ "$DO_FULL" -eq 0 ]]; then
    echo "[install_gptsovits] [i] opt-in only -> NOT installing. Pass --full or GPTSOVITS_INSTALL=1 to install (clones repo + pins an old transformers). Skipping."
    exit 0
fi

echo "[install_gptsovits]  staging : $TARGET_DIR"
echo "[install_gptsovits]  models  : $MODELS_DIR"
echo "[install_gptsovits]  compute : $(gpu_present && echo 'CUDA GPU -> GPU build + models' || echo 'CPU only -> CPU build')"

if ! PYTHON="$(resolve_python)"; then
    echo "[install_gptsovits] [!] Python 3 not found; cannot install."
    exit 0
fi

# 1) clone (idempotent) --------------------------------------------------- #
if [[ -f "$TARGET_DIR/api_v2.py" ]]; then
    echo "[install_gptsovits] [OK] repo already present -> skipping clone."
else
    command -v git >/dev/null 2>&1 || { echo "[install_gptsovits] [!] git not found; install git then re-run."; exit 0; }
    echo "[install_gptsovits] [..] cloning $REPO_URL -> $TARGET_DIR (progress shown)"
    mkdir -p "$(dirname "$TARGET_DIR")"
    git clone --depth 1 --progress "$REPO_URL" "$TARGET_DIR" || { echo "[install_gptsovits] [!] clone failed."; exit 0; }
fi

# 2) torch + requirements -- ONE-TIME via a .deps_done sentinel. Re-running pip
# every boot caused a huggingface_hub upgrade<->downgrade ping-pong (the repo pins
# transformers, which needs huggingface_hub<1.0) and rebuilt native deps. Once only.
if [[ -f "$DEPS_SENTINEL" && "$FORCE" -eq 0 ]]; then
    echo "[install_gptsovits] [OK] dependencies already installed (.deps_done) -> skipping pip."
else
    if gpu_present; then
        echo "[install_gptsovits] [..] ensuring torch (CUDA build) ..."
        pip_i torch torchaudio || true
    else
        echo "[install_gptsovits] [..] ensuring torch (CPU build) ..."
        vpip "$PYTHON" -m pip install --break-system-packages --index-url https://download.pytorch.org/whl/cpu torch torchaudio 2>/dev/null \
            || vpip "$PYTHON" -m pip install --index-url https://download.pytorch.org/whl/cpu torch torchaudio || true
    fi
    # huggingface_hub only when MISSING -- NEVER --upgrade (that breaks transformers).
    if ! "$PYTHON" -c "import huggingface_hub" 2>/dev/null; then pip_i huggingface_hub || true; fi
    if [[ -f "$TARGET_DIR/requirements.txt" ]]; then
        echo "[install_gptsovits] [..] pip install -r requirements.txt (one-time) ..."
        pip_i -r "$TARGET_DIR/requirements.txt" || echo "[install_gptsovits] [!] some requirements failed."
    fi
    date -u +%Y-%m-%dT%H:%M:%SZ > "$DEPS_SENTINEL"
    echo "[install_gptsovits] [OK] dependencies installed (.deps_done written; won't re-run)."
fi

# 3) pretrained models from HuggingFace (IDEMPOTENT: sentinel + snapshot skip) #
if [[ -f "$SENTINEL" && "$FORCE" -eq 0 ]]; then
    echo "[install_gptsovits] [OK] pretrained models already downloaded (sentinel) -> skipping."
else
    # The HF byte CDN is often blocked (direct /resolve/ transfers 0 bytes); the
    # shared downloader lists files via the HF API but streams BYTES from hf-mirror.com
    # (proven to flow), resumable + idempotent + live progress. Default = the v2 set
    # (~1.2GB) not all v2+v3+v4 (~5.3GB); override via GPTSOVITS_HF_ALLOW ('*' = all)
    # and GPTSOVITS_MIRROR.
    # Per CPU/GPU principle: GPU -> v4 set (largest/newest, ~2.4GB); CPU -> v2 set
    # (~1.2GB, CPU-friendly). NOT all v2+v3+v4 (~5.3GB). User GPTSOVITS_HF_ALLOW wins.
    if [[ -z "${GPTSOVITS_HF_ALLOW:-}" ]]; then
        if gpu_present; then
            export GPTSOVITS_HF_ALLOW='chinese-hubert-base/*,chinese-roberta-wwm-ext-large/*,s1v3.ckpt,gsv-v4-pretrained/*'
            echo "[install_gptsovits]  models: GPU -> v4 set (largest: s1v3 + gsv-v4-pretrained + base encoders)"
        else
            export GPTSOVITS_HF_ALLOW='chinese-hubert-base/*,chinese-roberta-wwm-ext-large/*,gsv-v2final-pretrained/*'
            echo "[install_gptsovits]  models: CPU -> v2 set (gsv-v2final-pretrained + base encoders)"
        fi
    fi
    echo "[install_gptsovits] [..] downloading models $HF_REPO -> $MODELS_DIR (mirror bytes, resumable, live progress)"
    mkdir -p "$MODELS_DIR"
    "$PYTHON" "$SCRIPT_DIR/gptsovits_dl.py" "$HF_REPO" "$MODELS_DIR" "$SENTINEL" || true
    if [[ -f "$SENTINEL" ]]; then
        echo "[install_gptsovits] [OK] pretrained models downloaded."
    else
        echo "[install_gptsovits] [!] model download not finished; will RESUME next run (finished files are NOT re-downloaded)."
    fi
fi

echo "[install_gptsovits] [OK] GPT-SoVITS ready ($TARGET_DIR)."
echo "[install_gptsovits]  START:  cd \"$TARGET_DIR\" && python api_v2.py   (serves $SERVER_URL)"
echo "[install_gptsovits]  Then set GPTSOVITS_REF_AUDIO (+ optional GPTSOVITS_PROMPT_TEXT/LANG)."
exit 0
