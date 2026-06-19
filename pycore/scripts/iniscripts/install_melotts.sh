#!/bin/bash
# MeloTTS offline TTS prerequisite (Linux) — free zh/en mixed synthesis.
# Auto-run by prepare.sh (pyservice). MeloTTS pins transformers==4.27.4 which can
# DOWNGRADE the shared AI env, so the install is OPT-IN (never ambushes a boot).
# CPU/GPU principle: CPU torch + EN/ZH on a CPU host; CUDA torch + the full model
# set (EN,ZH,JP,KR,ES,FR) when a GPU is present. Free; models cache from HF.
# The post-install torch_cpu_guard.sh reconciles the torch build on no-GPU hosts.
#
# Invocation (prepare.sh):  install_melotts.sh --python <py>
#   --full   (perform the heavy install; else status-only)
#   --force  (reinstall / re-warm)
# Env: MELOTTS_INSTALL=1 (== --full)
set -uo pipefail

PYTHON="python3"
DO_FULL=0
FORCE=0
DEVICE="cpu"
LANGS="EN,ZH"

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

. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib_gpu.sh"   # gpu_present() (canonical: CUDADetector)

pip_install() {
    "$PYTHON" -m pip install --break-system-packages "$@" 2>/dev/null || "$PYTHON" -m pip install "$@"
}

echo "============================================================"
echo " [install_melotts] MeloTTS (free offline zh/en TTS)"
echo "============================================================"

if ! PYTHON="$(resolve_python)"; then
    echo "[install_melotts] [!] Python 3 not found. Run 13_ensure_python.sh first."
    exit 0
fi

[[ "${MELOTTS_SKIP:-0}" == "1" ]] && { echo "[install_melotts] [i] MELOTTS_SKIP=1 -> skipping."; exit 0; }
MELO_PRESENT=0
py_has_module melo && MELO_PRESENT=1
if gpu_present; then DEVICE="cuda:0"; LANGS="EN,ZH,JP,KR,ES,FR"; fi

echo "[install_melotts]  python  : $PYTHON"
echo "[install_melotts]  melo    : $([[ $MELO_PRESENT -eq 1 ]] && echo installed || echo absent)"
echo "[install_melotts]  compute : $(gpu_present && echo 'CUDA GPU -> GPU build + full model set' || echo 'CPU only -> CPU build + EN/ZH')"
# Installs by default (idempotent: skipped when melo is already importable). Opt out
# of the whole engine with MELOTTS_SKIP=1 if transformers==4.27.4 conflicts.
if [[ "$MELO_PRESENT" -eq 0 ]]; then
    echo "[install_melotts] [!] NOTE: MeloTTS pins transformers==4.27.4 — may downgrade the shared AI env. Set MELOTTS_SKIP=1 to opt out."
fi

# --- heavy install (opt-in) --------------------------------------------- #
if [[ "$MELO_PRESENT" -eq 0 || "$FORCE" -eq 1 ]]; then
    if gpu_present; then
        echo "[install_melotts] [..] installing torch (CUDA build) ..."
        pip_install torch torchaudio || true
    else
        echo "[install_melotts] [..] installing torch (CPU build) ..."
        "$PYTHON" -m pip install --break-system-packages --index-url https://download.pytorch.org/whl/cpu torch torchaudio 2>/dev/null \
            || "$PYTHON" -m pip install --index-url https://download.pytorch.org/whl/cpu torch torchaudio || true
    fi
    echo "[install_melotts] [..] pip install MeloTTS (git) ..."
    echo "[install_melotts] [!] MeloTTS pins transformers==4.27.4 which may downgrade the shared env."
    pip_install 'git+https://github.com/myshell-ai/MeloTTS.git' || true
    "$PYTHON" -m unidic download >/dev/null 2>&1 || true
    py_has_module melo && MELO_PRESENT=1
    if [[ "$MELO_PRESENT" -eq 1 ]]; then echo "[install_melotts] [OK] MeloTTS installed."; else echo "[install_melotts] [!] MeloTTS not importable after install."; exit 0; fi
fi

# --- pre-download the language models (CUDA: full set; CPU: EN/ZH) ------- #
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

echo "[install_melotts] [OK] MeloTTS ready (free, offline). pycore selects cuda:0 automatically when a GPU is present."
exit 0
