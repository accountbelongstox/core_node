#!/bin/bash
# MeloTTS offline TTS prerequisite (Linux) — free zh/en mixed synthesis.
# Auto-run by prepare_pycore_prerequisites.sh (pyservice). MeloTTS pins transformers==4.27.4 which can
# DOWNGRADE the shared AI env, so the install is OPT-IN (never ambushes a boot).
# CPU/GPU principle: CPU torch + EN/ZH on a CPU host; CUDA torch + the full model
# set (EN,ZH,JP,KR,ES,FR) when a GPU is present. Free; models cache from HF.
# The post-install torch_cpu_guard.sh reconciles the torch build on no-GPU hosts.
#
# Invocation (prepare_pycore_prerequisites.sh):  install_melotts.sh --python <py>
#   --full   (perform the heavy install; else status-only)
#   --force  (reinstall / re-warm)
# Env: MELOTTS_INSTALL=1 (== --full)
set -uo pipefail

. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
PYTHON="python3"
DO_FULL=0
FORCE=0
DEVICE="cpu"
LANGS="EN,ZH"
MELO_PRESENT=0
NEED_WARM=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --full)   DO_FULL=1;   shift   ;;
        --force)  FORCE=1;     shift   ;;
        *) shift ;;
    esac
done
[[ "${MELOTTS_INSTALL:-0}" == "1" ]] && DO_FULL=1

resolve_python() {
    local p
    for p in "$PYTHON" python3 python; do
        if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
            command -v "$p"; return 0
        fi
    done
    return 1
}

py_has_module() { "$PYTHON" -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$1') else 1)" >/dev/null 2>&1; }

. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"
[[ -f "$SCRIPT_DIR/../../common/base_libs/setuptools_guard.sh" ]] && . "$SCRIPT_DIR/../../common/base_libs/setuptools_guard.sh"
. "$SCRIPT_DIR/../../common/base_libs/cuda_index.sh"

PIPLOCK_LIB="$SCRIPT_DIR/../../common/base_libs/pip_lock.sh"
[ -f "$PIPLOCK_LIB" ] && . "$PIPLOCK_LIB"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }

pip_install() {
    vpip "$PYTHON" -m pip install --break-system-packages "$@" 2>/dev/null || vpip "$PYTHON" -m pip install "$@"
}

# sudo prefix for the (rare) system-package step below (root -> none).
SUDO=""
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

echo "============================================================"
echo " [install_melotts] MeloTTS (free offline zh/en TTS)"
echo "============================================================"

if ! PYTHON="$(resolve_python)"; then
    echo "[install_melotts] [!] Python 3 not found. Run 13_ensure_python.sh first."
    complete_prereq_step "$PYTHON" "[install_melotts] " melo
fi

[[ "${MELOTTS_SKIP:-0}" == "1" ]] && { echo "[install_melotts] [i] MELOTTS_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_melotts] " melo; }
MELO_PRESENT=0
py_has_module melo && MELO_PRESENT=1
# Warm models only when freshly installing (or forced): on a steady-state re-run melo is
# already importable, so skip the per-language TTS() load to keep the re-run a cheap no-op.
[[ "$MELO_PRESENT" -eq 0 || "$FORCE" -eq 1 ]] && NEED_WARM=1
if gpu_present; then DEVICE="cuda:0"; LANGS="EN,ZH,JP,KR,ES,FR"; fi

echo "[install_melotts]  python  : $PYTHON"
echo "[install_melotts]  melo    : $([[ $MELO_PRESENT -eq 1 ]] && echo installed || echo absent)"
echo "[install_melotts]  compute : $(gpu_present && echo 'CUDA GPU -> GPU build + full model set' || echo 'CPU only -> CPU build + EN/ZH')"
# OPT-IN: MeloTTS pins transformers==4.27.4 and would DOWNGRADE the shared venv's pinned
# transformers (4.46.3 via LLM_TRANSFORMERS_SPEC, used by the deepseek/qwen/nllb stack),
# breaking it. So a fresh install happens ONLY when explicitly requested (--full /
# MELOTTS_INSTALL=1). FORCE alone does NOT opt in. An already-present install is still
# maintained (a --force re-run can refresh it).
if [[ "$MELO_PRESENT" -eq 0 && "$DO_FULL" -eq 0 ]]; then
    echo "[install_melotts] [i] opt-in only -> NOT installing. Pass --full or MELOTTS_INSTALL=1 to install (pins transformers==4.27.4; downgrades the shared transformers 4.46.3). Skipping."
    complete_prereq_step "$PYTHON" "[install_melotts] " --absent-ok "opt-in; use --full or MELOTTS_INSTALL=1" melo
fi
if [[ "$MELO_PRESENT" -eq 0 ]]; then
    echo "[install_melotts] [!] NOTE: installing MeloTTS pins transformers==4.27.4 — this WILL downgrade the shared venv's transformers 4.46.3. (opt-in confirmed via --full/MELOTTS_INSTALL=1)"
fi

# --- heavy install (opt-in) --------------------------------------------- #
if [[ "$MELO_PRESENT" -eq 0 || "$FORCE" -eq 1 ]]; then
    install_pycore_torch_stack "$PYTHON" "[install_melotts] "
    # fugashi (a MeloTTS dependency) needs the system MeCab toolchain to build — ensure it first.
    ensure_mecab || true
    echo "[install_melotts] [..] pip install melotts (PyPI) ..."
    pip_install melotts || true
    py_has_module melo || pip_install 'git+https://github.com/myshell-ai/MeloTTS.git' || true
    "$PYTHON" -m unidic download >/dev/null 2>&1 || true
    "$PYTHON" -c "import nltk; nltk.download('averaged_perceptron_tagger_eng', quiet=True)" >/dev/null 2>&1 || true
    py_has_module melo && MELO_PRESENT=1
    if [[ "$MELO_PRESENT" -eq 1 ]]; then echo "[install_melotts] [OK] MeloTTS installed."; else echo "[install_melotts] [!] MeloTTS not importable after install."; complete_prereq_step "$PYTHON" "[install_melotts] " melo; fi
fi

# --- pre-download the language models (CUDA: full set; CPU: EN/ZH) ------- #
# Idempotent: skip the warmup entirely on a steady-state re-run (melo already present and
# not forced) — models otherwise download lazily on first synth anyway.
if [[ "$NEED_WARM" -eq 1 ]]; then
# `from melo.api import TTS` imports librosa -> pkg_resources; restore it if a
# setuptools>=81 in the shared venv has removed pkg_resources, else the warm-up aborts.
ensure_pkg_resources "$PYTHON"
echo "[install_melotts] [..] pre-downloading models [$LANGS] on $DEVICE (first-use cache) ..."
"$PYTHON" - "$LANGS" "$DEVICE" <<'PY' || echo "[install_melotts] [!] pre-download incomplete (models still download lazily on first synth)."
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
    echo "[install_melotts] [OK] melo already present -> skipping model warmup (FORCE / --force to re-warm)."
fi

echo "[install_melotts] [OK] MeloTTS ready (free, offline). pycore selects cuda:0 automatically when a GPU is present."
complete_prereq_step "$PYTHON" "[install_melotts] " melo
