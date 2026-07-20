#!/bin/bash
# MeloTTS offline TTS prerequisite (Linux) — free zh/en mixed synthesis, class C
# (isolated venv + HTTP server). Auto-run by prepare_pycore_prerequisites.sh (pyservice).
#
# Lifecycle rule (see development-guides/cross-docs/
# TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5 & §7, Bucket B): MeloTTS pins an OLD
# transformers (~4.27.x), which CANNOT coexist with the main interpreter's shared 4.46.x
# pin (deepseek/qwen25/nllb/bark). So melo is NEVER installed into the main interpreter.
# It lives in a DEDICATED per-engine venv built + verified by
# pycore.pyutils.tts.isolated_venv.ensure_venv("melotts", ...) (created --system-site-packages
# so it REUSES the system CUDA torch; only the pinned transformers + melo are layered in,
# shadowing the main copies). melotts_api_server.py runs under that venv and pycore
# (tts_service_manager / melotts_engine) talks to it over HTTP as a managed class-C server.
#
# Because the venv fully isolates the pin, melo no longer clobbers the shared stack; the
# heavy build (venv + old-transformers install + model warm) is nonetheless OPT-IN so a
# normal boot is never ambushed — it runs only on --full / MELOTTS_INSTALL=1. An
# already-built venv is still maintained + self-repaired on every sweep.
#
# Official: https://github.com/myshell-ai/MeloTTS  (melo is installed INTO the venv, not here)
#
# Idempotent + self-repairing: ensure_venv() is a cheap import probe when healthy and
# REBUILDS the venv when melo fails to import (.deps_done = venv provisioned).
# Skip with MELOTTS_SKIP=1. --force rebuilds the venv and re-warms the models.
#
# Invocation (prepare_pycore_prerequisites.sh):  install_melotts.sh --python <py> [--full] [--force]
# Env: MELOTTS_INSTALL=1 (== --full), MELOTTS_SKIP=1, MELOTTS_DIR
set -uo pipefail

PYTHON="python3"
DO_FULL=0
FORCE=0
DEVICE="cpu"
LANGS="EN,ZH"
NEED_WARM=0
VENV_PY=""
SUDO=""
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
# Repo root = 5 levels up from install_shells (scripts/shells/linux/debian/install_shells);
# needed on sys.path so `import pycore...` resolves when building the isolated venv.
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
TARGET_DIR="${MELOTTS_DIR:-$CORE_NODE_CACHE_DIR/pycore/melotts}"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
# melo is intentionally absent from the main interpreter (it lives in the isolated venv),
# so the post-install probe reports it as an accepted SKIP, never a FAIL.
MELOTTS_ABSENT_NOTE="melo lives in the isolated venv (Bucket B), not the main interpreter"
# MeloTTS pip spec: prefer the PyPI wheel, fall back to the upstream git repo.
MELOTTS_PYPI_SPEC="melotts"
MELOTTS_GIT_SPEC="git+https://github.com/myshell-ai/MeloTTS.git"
# Python bool literal handed to ensure_venv(force=...); set True on --force after parsing.
_MELOTTS_FORCE_PY=False

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --full)   DO_FULL=1;   shift   ;;
        --force)  FORCE=1;     shift   ;;
        *) shift ;;
    esac
done
[[ "${MELOTTS_INSTALL:-0}" == "1" ]] && DO_FULL=1
[[ "$FORCE" -eq 1 ]] && _MELOTTS_FORCE_PY=True

. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"
[[ -f "$SCRIPT_DIR/../../common/base_libs/setuptools_guard.sh" ]] && . "$SCRIPT_DIR/../../common/base_libs/setuptools_guard.sh"
. "$SCRIPT_DIR/../../common/base_libs/cuda_index.sh"

PIPLOCK_LIB="$SCRIPT_DIR/../../common/base_libs/pip_lock.sh"
[ -f "$PIPLOCK_LIB" ] && . "$PIPLOCK_LIB"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }

resolve_python() {
    local p
    for p in "$PYTHON" python3 python; do
        if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
            command -v "$p"; return 0
        fi
    done
    return 1
}

# sudo prefix for the (rare) system-package step below (root -> none).
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

# MeloTTS hard-depends on fugashi, whose wheel build needs the system MeCab toolchain
# (mecab-config from libmecab-dev); without it the build aborts with
# "Could not configure working env. Have you installed MeCab?". Reuse an existing MeCab
# install and only apt-install when it is genuinely missing (per the reuse-don't-reinstall
# rule). mecab-ipadic-utf8 is the dictionary needed at runtime.
ensure_mecab() {
    if command -v mecab-config >/dev/null 2>&1 && command -v mecab >/dev/null 2>&1; then
        echo "[install_melotts] [OK] MeCab toolchain already present; reusing."
        return 0
    fi
    echo "[install_melotts] [..] installing MeCab toolchain (mecab libmecab-dev) for fugashi ..."
    $SUDO apt-get install -y mecab libmecab-dev mecab-ipadic-utf8 >/dev/null 2>&1 \
        || $SUDO apt-get install -y mecab libmecab-dev mecab-ipadic >/dev/null 2>&1 \
        || { echo "[install_melotts] [!] could not apt-install MeCab; fugashi build may fail."; return 1; }
    echo "[install_melotts] [OK] MeCab toolchain installed."
}

# Provision / verify the ISOLATED melotts venv (Bucket B). Delegates to the single source
# of truth pycore.pyutils.tts.isolated_venv.ensure_venv("melotts", ...), run UNDER $PYTHON
# so the venv is built next to that interpreter and reuses its system CUDA torch via
# --system-site-packages. Cheap when already healthy; rebuilds a broken venv. $1 is a
# Python bool literal (True on --force); $2 is the melo pip spec (PyPI name or git URL).
# Returns 0 only when melo imports in the venv.
provision_melotts_venv() {
    local force_py="$1" pkg="$2"
    "$PYTHON" -c "import sys; sys.path.insert(0, r'''$CORE_NODE_ROOT'''); from pycore.pyutils.tts import isolated_venv; sys.exit(0 if isolated_venv.ensure_venv('melotts', [r'''$pkg'''], ['transformers==4.27.4'], force=$force_py) else 1)"
}

# PyPI first, then the upstream git repo (the wheel is periodically broken on PyPI). A
# healthy venv short-circuits inside ensure_venv, so the spec only matters on a fresh /
# broken build.
provision_melotts_venv_any() {
    local force_py="$1"
    if provision_melotts_venv "$force_py" "$MELOTTS_PYPI_SPEC"; then return 0; fi
    echo "[install_melotts] [..] PyPI melotts unavailable/broken; retrying with the upstream git repo ..."
    provision_melotts_venv "$force_py" "$MELOTTS_GIT_SPEC"
}

# Resolve the pre-built venv interpreter (post-install data downloads + model warm run
# under it, since melo lives in the venv, not the main interpreter). Empty when absent.
melotts_venv_python() {
    "$PYTHON" -c "import sys; sys.path.insert(0, r'''$CORE_NODE_ROOT'''); from pycore.pyutils.tts import isolated_venv; sys.stdout.write(isolated_venv.resolve_python('melotts') or '')" 2>/dev/null
}

echo "============================================================"
echo " [install_melotts] MeloTTS (free offline zh/en TTS)"
echo "============================================================"

if ! PYTHON="$(resolve_python)"; then
    echo "[install_melotts] [!] Python 3 not found. Run 13_ensure_python.sh first."
    complete_prereq_step "$PYTHON" "[install_melotts] " --absent-ok "$MELOTTS_ABSENT_NOTE" melo
fi

[[ "${MELOTTS_SKIP:-0}" == "1" ]] && { echo "[install_melotts] [i] MELOTTS_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_melotts] " --absent-ok "MELOTTS_SKIP=1" melo; }

mkdir -p "$TARGET_DIR"
if gpu_present; then DEVICE="cuda:0"; LANGS="EN,ZH,JP,KR,ES,FR"; fi
# Warm models only when freshly building (or forced): a steady-state re-run keeps the
# per-language cache, so skip the per-language TTS() load to keep the re-run a cheap no-op.
[[ ! -f "$DEPS_SENTINEL" || "$FORCE" -eq 1 ]] && NEED_WARM=1

echo "[install_melotts]  python  : $PYTHON"
echo "[install_melotts]  venv    : $([[ -f "$DEPS_SENTINEL" ]] && echo 'provisioned (.deps_done)' || echo absent)"
echo "[install_melotts]  compute : $(gpu_present && echo 'CUDA GPU -> GPU build + full model set' || echo 'CPU only -> CPU build + EN/ZH')"
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" melotts | while read -r _line; do
    echo "[install_melotts]  official env (melotts): $_line"
done

# OPT-IN: building the isolated venv is heavy (venv + old-transformers install + model
# warm), so a fresh build runs ONLY when explicitly requested (--full / MELOTTS_INSTALL=1).
# The venv fully isolates the transformers pin, so this no longer risks the shared stack;
# opt-in just avoids ambushing an unattended boot. An already-built venv (.deps_done) is
# still maintained + self-repaired below on every sweep.
if [[ ! -f "$DEPS_SENTINEL" && "$DO_FULL" -eq 0 ]]; then
    echo "[install_melotts] [i] opt-in only -> NOT installing. Pass --full or MELOTTS_INSTALL=1 to build the isolated MeloTTS venv (transformers==4.27.4, fully isolated). Skipping."
    complete_prereq_step "$PYTHON" "[install_melotts] " --absent-ok "opt-in; use --full or MELOTTS_INSTALL=1" melo
fi

# --- Isolated melotts venv (Bucket B) ------------------------------------ #
# NEVER `pip install melotts` into the main interpreter: its old transformers pin would
# downgrade the shared 4.46.x stack. ensure_venv() is idempotent + self-repairing, so it
# runs on every sweep — even with the sentinel present — to heal a drifted / half-built venv.
if [[ -f "$DEPS_SENTINEL" && "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "isolated MeloTTS venv provisioned (.deps_done)"
    if provision_melotts_venv_any "$_MELOTTS_FORCE_PY"; then
        echo "[install_melotts] [OK] isolated MeloTTS venv verified (self-repair)."
    else
        echo "[install_melotts] [!] venv verify/repair incomplete; will RESUME next run."
    fi
else
    # fugashi (a MeloTTS dependency) needs the system MeCab toolchain to build — ensure it first.
    ensure_mecab || true
    "$PYTHON" -m pip install --upgrade pip || true
    install_pycore_torch_stack "$PYTHON" "[install_melotts] "
    echo "[install_melotts] [..] provisioning isolated MeloTTS venv (transformers==4.27.4 shadows main; system torch reused) ..."
    if provision_melotts_venv_any "$_MELOTTS_FORCE_PY"; then
        date -u +%Y-%m-%dT%H:%M:%SZ > "$DEPS_SENTINEL"
        echo "[install_melotts] [OK] isolated MeloTTS venv ready; main interpreter untouched."
    else
        echo "[install_melotts] [!] venv provisioning incomplete; will RESUME next run."
        complete_prereq_step "$PYTHON" "[install_melotts] " --absent-ok "$MELOTTS_ABSENT_NOTE" melo
    fi
fi

# --- post-install data + model warm (run UNDER the venv python) ---------- #
VENV_PY="$(melotts_venv_python)"
if [[ -n "$VENV_PY" ]]; then
    "$VENV_PY" -m unidic download >/dev/null 2>&1 || true
    "$VENV_PY" -c "import nltk; nltk.download('averaged_perceptron_tagger_eng', quiet=True)" >/dev/null 2>&1 || true
fi

# Pre-download the language models (CUDA: full set; CPU: EN/ZH). Idempotent: skip the
# warm-up on a steady-state re-run — models otherwise download lazily on first synth anyway.
if [[ "$NEED_WARM" -eq 1 && -n "$VENV_PY" ]]; then
# `from melo.api import TTS` imports librosa -> pkg_resources; restore it in the venv if a
# setuptools>=81 (inherited via --system-site-packages) has removed pkg_resources.
ensure_pkg_resources "$VENV_PY"
echo "[install_melotts] [..] pre-downloading models [$LANGS] on $DEVICE (first-use cache) ..."
"$VENV_PY" - "$LANGS" "$DEVICE" <<'PY' || echo "[install_melotts] [!] pre-download incomplete (models still download lazily on first synth)."
import sys
from melo.api import TTS
langs = sys.argv[1].split(",")
device = sys.argv[2]
for lang in langs:
    try:
        TTS(language=lang, device=device)
        print("  [warmed]", lang)
    except Exception as e:
        print("  [skip]", lang, "-", e)
PY
else
    echo "[install_melotts] [OK] MeloTTS venv already present -> skipping model warmup (--force to re-warm)."
fi

echo "[install_melotts] [OK] MeloTTS ready (free, offline). pycore selects cuda:0 automatically when a GPU is present."
echo "[install_melotts]  START:  pycore runs pycore/tts_install_assets/melotts_api_server.py under the ISOLATED venv as a managed class-C server (MELOTTS_PORT, default 57212)."
complete_prereq_step "$PYTHON" "[install_melotts] " --absent-ok "$MELOTTS_ABSENT_NOTE" melo
