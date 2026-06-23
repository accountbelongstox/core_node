#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Single source of truth for the OFFLINE TTS fallback engines (Linux/macOS) used
# by the pycore voice-subtitle pipeline. Prefix 22 sorts after 13_ensure_python.
# Also invoked by pycore/scripts/iniscripts/install_tts_offline.sh (pyservice).
#
# Engines:
#   - Sherpa-ONNX (DEFAULT): pure-pip `sherpa-onnx` + a Kokoro multi-lang (zh/en)
#     model into $HOME/.core_node/cache/tts/sherpa. The "never fails" engine.
#   - MeloTTS (OPT-IN via --melotts): transformers==4.27.4 pin can clash with the
#     shared env, so it is NOT installed by default.
#   - GPT-SoVITS: NOT installed here; the pycore client talks to its api server
#     on 127.0.0.1:9880 if the user runs it.
#
# Invocation contracts:
#   - install.sh flow:  22_install_tts_offline.sh             (no args)
#   - pyservice flow:   22_install_tts_offline.sh --python <py> [--melotts] [--force]
set -uo pipefail

PYTHON="python3"
MELOTTS=0
FORCE=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Shared venv resolution: gvar_common exports COMPILE_DIR, then venv_python_common
# derives VENV_DIR / VENV_PYTHON3 / VENV_PIP3 from it (install INTO the venv that
# 13_ensure_python.sh builds, never the externally-managed system python).
# install_shells -> debian -> linux -> common (same path style as SHERPA_GUARD).
source "$SCRIPT_DIR/../../common/gvar_common.sh"
source "$SCRIPT_DIR/../../common/venv_python_common.sh"
# Single source of truth for the sherpa-onnx CPU/GPU build choice (mirrors the
# torch/onnxruntime guards): install_shells -> debian -> linux -> common.
SHERPA_GUARD="$SCRIPT_DIR/../../common/sherpa_onnx_cpu_guard.sh"
MODEL_DIR="$HOME/.core_node/cache/tts/sherpa"
# int8-quantized Kokoro (zh/en) — smaller/faster one-time download.
MODEL_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-multi-lang-v1_1.tar.bz2"
MODEL_ARCHIVE=""
TMP_EXTRACT=""
PIP_ARGS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python)  PYTHON="$2"; shift 2 ;;
        --melotts) MELOTTS=1;   shift   ;;
        --force)   FORCE=1;     shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

resolve_python() {
    local preferred="$1"
    # Prefer the shared venv interpreter built by 13_ensure_python.sh so package
    # installs land INSIDE the venv (not the externally-managed system python).
    if [[ -x "$VENV_PYTHON3" ]]; then
        echo "$VENV_PYTHON3"; return 0
    fi
    if [[ -n "$preferred" ]] && command -v "$preferred" >/dev/null 2>&1; then
        echo "[run] $preferred -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)'" >&2
        if "$preferred" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
            command -v "$preferred"; return 0
        fi
    fi
    local name
    for name in python3 python; do
        if command -v "$name" >/dev/null 2>&1; then
            echo "[run] $name -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)'" >&2
            if "$name" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
                command -v "$name"; return 0
            fi
        fi
    done
    return 1
}

py_has_module() {
    echo "[run] $PYTHON -c \"import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$1') else 1)\"" >&2
    "$PYTHON" -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$1') else 1)" >/dev/null 2>&1
}

pip_install() {
    PIP_ARGS=("$@")
    # Inside the shared venv no PEP668 escape flags are needed (or wanted). Only an
    # externally-managed system python (no pyvenv.cfg) gets --break-system-packages.
    if [[ "$(uname -s)" != "Darwin" ]] && ! venv_is_venv_from_common "$PYTHON"; then
        PIP_ARGS=(--break-system-packages "${PIP_ARGS[@]}")
    fi
    echo "[pip] $PYTHON -m pip install ${PIP_ARGS[*]}"
    "$PYTHON" -m pip install "${PIP_ARGS[@]}" || "$PYTHON" -m pip install "$@"
}

# Extract a .tar.bz2 archive into the model dir and write the sentinel on
# success. Uses PYTHON's tarfile (stdlib bz2) for parity with Windows and to not
# depend on tar's bz2 support. Returns 0 only when a model .onnx landed. This is
# the idempotent EXTRACT step — callable on a cached archive WITHOUT downloading.
install_sherpa_model() {
    local archive="$1" tmp="$2" mdir="$3" sentinel="$4" url="$5"
    [[ -f "$archive" ]] || return 1
    rm -rf "$tmp"; mkdir -p "$tmp"
    echo "[..] Extracting $archive -> $tmp (python tarfile)"
    echo "[run] $PYTHON -c \"import tarfile,sys; t=tarfile.open(sys.argv[1],'r:bz2'); t.extractall(sys.argv[2]); t.close()\" $archive $tmp"
    if ! "$PYTHON" -c "import tarfile,sys
t=tarfile.open(sys.argv[1],'r:bz2'); t.extractall(sys.argv[2]); t.close()" "$archive" "$tmp"; then
        echo "[!] Extract failed (archive incomplete/invalid)."
        rm -rf "$tmp"; return 1
    fi
    local inner src
    inner="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n1)"
    src="${inner:-$tmp}"
    echo "[..] Installing $src/* -> $mdir"
    cp -rf "$src"/* "$mdir"/ 2>/dev/null || true
    if find "$mdir" -name '*.onnx' -type f 2>/dev/null | grep -q .; then
        echo "$url" > "$sentinel"
        echo "[OK] Model installed to $mdir (archive KEPT at $archive for reuse)."
        rm -rf "$tmp"; return 0
    fi
    echo "[!] Extract produced no .onnx (archive may be partial)."
    rm -rf "$tmp"; return 1
}

echo "============================================================"
echo " Installing offline TTS engines (sherpa-onnx + model)"
echo "============================================================"

if ! PYTHON="$(resolve_python "$PYTHON")"; then
    echo "[X] Python 3 was NOT found. Run 13_ensure_python.sh first, or pass --python <path>." >&2
    exit 1
fi
echo "  python : $PYTHON"

# --- 1) sherpa-onnx (CPU build by default; GPU build opt-in, CPU-guarded) ---- #
# The CPU/GPU build choice goes through sherpa_onnx_cpu_guard.sh (idempotent):
#   NO GPU -> CPU wheel, and any stray '+cuda' build is switched back to CPU, so a
#            CPU host NEVER ends up on the GPU build.
#   GPU + SHERPA_ONNX_CUDA_SPEC=<ver+cuda...> -> that exact GPU wheel from the CUDA
#            flat index (needs system CUDA Toolkit + cuDNN).
if [[ -f "$SHERPA_GUARD" ]]; then
    echo "[..] Ensuring sherpa-onnx CPU/GPU build via guard ..."
    echo "[run] SOG_PYTHON=$PYTHON bash $SHERPA_GUARD --python $PYTHON"
    SOG_PYTHON="$PYTHON" bash "$SHERPA_GUARD" --python "$PYTHON"
    if py_has_module sherpa_onnx; then
        echo "[OK] sherpa-onnx present (build guarded)."
    else
        echo "[!] sherpa-onnx not importable; offline TTS will fall back to edge/ai."
    fi
else
    echo "[!] sherpa guard missing ($SHERPA_GUARD); falling back to plain CPU pip."
    if pip_install --upgrade sherpa-onnx && py_has_module sherpa_onnx; then
        echo "[OK] sherpa-onnx installed (CPU)."
    else
        echo "[!] sherpa-onnx install failed; offline TTS will fall back to edge/ai."
    fi
fi

# --- 2) Kokoro multi-lang model ------------------------------------------ #
# STEP-IDEMPOTENT, in order (each step skips work already done):
#   1. model + sentinel present -> skip everything.
#   2. cached .bz2 present       -> EXTRACT it (no download). "有了就用bz2".
#   3. archive missing/partial   -> RESUME download (curl -C-/wget -c), extract.
# The .bz2 is KEPT after a successful extract so a wiped model dir re-extracts
# without re-downloading.
MODEL_SENTINEL="$MODEL_DIR/.model_installed"
MODEL_ARCHIVE="$MODEL_DIR/.download.tar.bz2"
# TMP_EXTRACT is created lazily only on the download/extract path below so the
# steady-state (already-installed) re-run leaks no empty mktemp -d directory.
TMP_EXTRACT=""

# Verbose path / state report.
echo "  model dir   : $MODEL_DIR"
echo "  sentinel    : $MODEL_SENTINEL ($([[ -f "$MODEL_SENTINEL" ]] && echo present || echo absent))"
echo "  model .onnx : $(find "$MODEL_DIR" -name '*.onnx' -type f 2>/dev/null | head -n1 || echo 'none yet')"
if [[ -f "$MODEL_ARCHIVE" ]]; then
    echo "  prev dload  : $MODEL_ARCHIVE ($(( $(stat -c%s "$MODEL_ARCHIVE" 2>/dev/null || echo 0) / 1048576 )) MB cached -> will reuse/resume)"
else
    echo "  prev dload  : none (fresh download to $MODEL_ARCHIVE)"
fi
echo "  source url  : $MODEL_URL"

if [[ -f "$MODEL_SENTINEL" ]] && find "$MODEL_DIR" -name '*.onnx' -type f 2>/dev/null | grep -q . && [[ "$FORCE" -eq 0 ]]; then
    echo "[OK] STEP1 model present + sentinel -> skipping (no download, no extract)."
else
    mkdir -p "$MODEL_DIR"
    TMP_EXTRACT="$(mktemp -d)"
    MODEL_OK=0
    # STEP 2: reuse a cached archive WITHOUT downloading.
    if [[ -f "$MODEL_ARCHIVE" ]]; then
        echo "[..] STEP2 cached archive found -> extracting it (no download)."
        if install_sherpa_model "$MODEL_ARCHIVE" "$TMP_EXTRACT" "$MODEL_DIR" "$MODEL_SENTINEL" "$MODEL_URL"; then
            MODEL_OK=1
        else
            echo "[!] Cached archive is partial/invalid -> will RESUME the download next."
        fi
    fi
    # STEP 3: download (resume the partial) then extract.
    if [[ "$MODEL_OK" -eq 0 ]]; then
        echo "[..] STEP3 downloading (resumable) $MODEL_URL -> $MODEL_ARCHIVE"
        if curl -fL -C - --retry 3 --connect-timeout 30 "$MODEL_URL" -o "$MODEL_ARCHIVE" || wget -c -q "$MODEL_URL" -O "$MODEL_ARCHIVE"; then
            install_sherpa_model "$MODEL_ARCHIVE" "$TMP_EXTRACT" "$MODEL_DIR" "$MODEL_SENTINEL" "$MODEL_URL" \
                || echo "[!] Archive incomplete after download; KEPT to RESUME next boot."
        else
            echo "[!] Download incomplete; partial archive KEPT and will RESUME next boot. edge/ai TTS still work."
        fi
    fi
    rm -rf "$TMP_EXTRACT" 2>/dev/null || true
fi

# --- 3) MeloTTS (opt-in) ------------------------------------------------- #
if [[ "$MELOTTS" -eq 1 ]] && py_has_module melo && [[ "$FORCE" -eq 0 ]]; then
    echo "[OK] MeloTTS already installed; skipping."
elif [[ "$MELOTTS" -eq 1 ]]; then
    echo "[..] (opt-in) pip install MeloTTS ..."
    echo "[!] MeloTTS pins transformers==4.27.4 which may downgrade the shared env."
    pip_install 'git+https://github.com/myshell-ai/MeloTTS.git' || true
    echo "[run] $PYTHON -m unidic download"
    "$PYTHON" -m unidic download >/dev/null 2>&1 || true
    if py_has_module melo; then echo "[OK] MeloTTS installed."; else echo "[!] MeloTTS not importable after install."; fi
else
    echo "[i] MeloTTS skipped (pass --melotts to install; GPT-SoVITS is manual, see docs)."
fi

exit 0
