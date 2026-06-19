#!/bin/bash
# Offline Vosk STT prerequisite (Linux) — pip + a model, auto-run by prepare.sh
# (pyservice). Vosk is FREE and CPU-only (no CUDA inference), so the CPU/GPU
# principle selects MODEL SIZE: small on a CPU host, the large gigaspeech model
# when CUDA is present. Unzips into $HOME/.core_node/cache/stt/vosk/<name>/, which
# pycore.pyutils.stt.stt_orchestrator scans (looks for */conf). Idempotent +
# resumable. Docs: https://alphacephei.com/vosk/models
#
# Invocation (prepare.sh):  install_vosk.sh --python <py>
#   --model auto|small|large   (default auto: CUDA->large, else small)
#   --force                    (re-download / re-extract)
set -uo pipefail

PYTHON="python3"
MODEL="auto"
FORCE=0
MODEL_ROOT="$HOME/.core_node/cache/stt/vosk"
SMALL_NAME="vosk-model-small-en-us-0.15"
LARGE_NAME="vosk-model-en-us-0.42-gigaspeech"
BASE_URL="https://alphacephei.com/vosk/models"
CHOSEN_NAME=""
MODEL_URL=""
MODEL_DIR=""
ARCHIVE=""
TMP_EXTRACT=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --model)  MODEL="$2";  shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        *) shift ;;
    esac
done

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

# GPU detection from the ONE shared helper (canonical: CUDADetector).
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib_gpu.sh"   # provides gpu_present()

echo "============================================================"
echo " [install_vosk] Installing offline Vosk STT (pip + model)"
echo "============================================================"

if ! PYTHON="$(resolve_python)"; then
    echo "[install_vosk] [X] Python 3 not found. Run 13_ensure_python.sh first, or pass --python <path>." >&2
    exit 0
fi
echo "[install_vosk] python : $PYTHON"

# --- 1) vosk pip package ------------------------------------------------- #
if py_has_module vosk && [[ "$FORCE" -eq 0 ]]; then
    echo "[install_vosk] [OK] vosk already installed; skipping pip."
else
    echo "[install_vosk] [..] pip install --upgrade vosk ..."
    "$PYTHON" -m pip install --break-system-packages --upgrade vosk 2>/dev/null \
        || "$PYTHON" -m pip install --upgrade vosk || true
    if py_has_module vosk; then echo "[install_vosk] [OK] vosk installed."; else echo "[install_vosk] [!] vosk install failed; STT falls back to whisper/azure."; fi
fi

# --- 2) choose model by CPU/GPU principle -------------------------------- #
case "$MODEL" in
    small) CHOSEN_NAME="$SMALL_NAME" ;;
    large) CHOSEN_NAME="$LARGE_NAME" ;;
    *) if gpu_present; then CHOSEN_NAME="$LARGE_NAME"; echo "[install_vosk] CUDA detected -> LARGE model ($LARGE_NAME, ~2.3GB)."; \
       else CHOSEN_NAME="$SMALL_NAME"; echo "[install_vosk] No CUDA -> SMALL CPU model ($SMALL_NAME, ~40MB)."; fi ;;
esac
MODEL_URL="$BASE_URL/$CHOSEN_NAME.zip"
MODEL_DIR="$MODEL_ROOT/$CHOSEN_NAME"
ARCHIVE="$MODEL_ROOT/$CHOSEN_NAME.zip"
TMP_EXTRACT="$(mktemp -d)"
mkdir -p "$MODEL_ROOT"

echo "[install_vosk]  model dir : $MODEL_DIR"
echo "[install_vosk]  source    : $MODEL_URL"

# IDEMPOTENT: any model with a conf/ dir already present -> done.
if find "$MODEL_ROOT" -type d -name conf 2>/dev/null | grep -q . && [[ "$FORCE" -eq 0 ]]; then
    echo "[install_vosk] [OK] A Vosk model is already installed (conf/ present) -> skipping download."
    rm -rf "$TMP_EXTRACT" 2>/dev/null || true
    exit 0
fi

# --- 3) download (resume until BYTES complete) + extract ----------------- #
# Completeness is judged by BYTES-ON-DISK vs the remote Content-Length, NEVER by
# the downloader's exit status. -C -/-c resume the partial so a re-run continues
# instead of restarting; the progress bar is shown each attempt.
remote_size() {
    local sz
    sz="$(curl -sIL --connect-timeout 20 "$MODEL_URL" 2>/dev/null | tr -d '\r' | awk 'BEGIN{IGNORECASE=1} /^content-length:/{v=$2} END{print v+0}')"
    echo "${sz:-0}"
}
local_size() { [[ -f "$ARCHIVE" ]] && stat -c%s "$ARCHIVE" 2>/dev/null || echo 0; }

EXPECTED="$(remote_size)"
echo "[install_vosk] [..] downloading $MODEL_URL ($(( EXPECTED / 1048576 ))MB) -> $ARCHIVE"
COMPLETE=0
attempt=0
while [[ "$COMPLETE" -eq 0 && "$attempt" -lt 6 ]]; do
    attempt=$((attempt + 1))
    have="$(local_size)"
    if [[ "$EXPECTED" -gt 0 && "$have" -ge "$EXPECTED" ]]; then COMPLETE=1; break; fi
    echo "[install_vosk] [..] attempt $attempt: have $(( have / 1048576 ))MB / $(( EXPECTED / 1048576 ))MB (resume + live progress)"
    curl -fL -C - --retry 2 --connect-timeout 30 --progress-bar "$MODEL_URL" -o "$ARCHIVE" \
        || wget -c -q --show-progress "$MODEL_URL" -O "$ARCHIVE" || true
    now="$(local_size)"
    if [[ "$EXPECTED" -gt 0 ]]; then
        [[ "$now" -ge "$EXPECTED" ]] && COMPLETE=1
        [[ "$now" -le "$have" ]] && echo "[install_vosk] [!] no progress this attempt (network); will resume."
    else
        COMPLETE=1   # unknown size -> single pass, verify by extraction below
    fi
done

if [[ "$COMPLETE" -eq 0 ]]; then
    echo "[install_vosk] [!] still incomplete after $attempt attempts; partial .zip KEPT to RESUME next run (continues, never restarts). whisper/azure STT still work."
    rm -rf "$TMP_EXTRACT" 2>/dev/null || true
    exit 0
fi

echo "[install_vosk] [..] extracting ..."
if command -v unzip >/dev/null 2>&1; then
    unzip -q -o "$ARCHIVE" -d "$TMP_EXTRACT" || "$PYTHON" -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$ARCHIVE" "$TMP_EXTRACT"
else
    "$PYTHON" -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$ARCHIVE" "$TMP_EXTRACT"
fi
inner="$(find "$TMP_EXTRACT" -mindepth 1 -maxdepth 1 -type d | head -n1)"
src="${inner:-$TMP_EXTRACT}"
rm -rf "$MODEL_DIR"
mv "$src" "$MODEL_DIR" 2>/dev/null || true
if [[ -d "$MODEL_DIR/conf" ]]; then
    echo "[install_vosk] [OK] Vosk model installed: $MODEL_DIR (free, offline). .zip KEPT at $ARCHIVE."
else
    echo "[install_vosk] [!] Extract produced no conf/ (archive may be partial); .zip KEPT to RESUME."
fi
rm -rf "$TMP_EXTRACT" 2>/dev/null || true
exit 0
