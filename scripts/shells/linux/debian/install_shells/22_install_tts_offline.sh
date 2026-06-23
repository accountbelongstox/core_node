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

# Single source of truth + UMBRELLA for the pycore voice pipeline's offline/local
# TTS & STT engine collection. Prefix 22 sorts after 13_ensure_python. Also invoked
# by scripts/shells/linux/common/iniscripts/install_tts_offline.sh (pyservice).
#
# CORE (always, the "never fails" offline TTS):
#   - Sherpa-ONNX + a Kokoro multi-lang (zh/en) model into $HOME/.core_node/cache/tts/sherpa.
#
# UMBRELLA (default; one run prepares the collection, each step idempotent):
#   DEFAULT (conflict-free, installed automatically):
#     TTS : edge-tts, Azure Speech SDK     STT : faster-whisper, openai-whisper, Vosk, Azure SDK
#   OPT-IN ONLY (NOT installed by default):
#     MeloTTS, GPT-SoVITS — both pin an OLD transformers (MeloTTS ==4.27.4) and would
#     DOWNGRADE the shared venv's transformers (5.x, used by the deepseek/qwen/nllb stack)
#     and break it. Install them explicitly: --melotts / --gptsovits, or the env opt-ins
#     MELOTTS_INSTALL=1 / GPTSOVITS_INSTALL=1. The opt-in is enforced in the sub-installers,
#     so prepare.sh's pyservice sweep skips them by default too.
#   Each engine delegates to its own canonical idempotent installer (skip-if-present).
#   A CPU host is reconciled back to CPU torch/onnxruntime by the post-install guards.
#
# Flows:
#   - dd.sh / install_shells sweep (no args)   -> CORE + UMBRELLA (default engines only).
#   - standalone `22_install_tts_offline.sh`    -> CORE + UMBRELLA (default engines only).
#   - pyservice prepare.sh sweep (exports PYCORE_INISCRIPTS_SWEEP=1) -> CORE only;
#     prepare.sh runs the sibling installers itself, so the umbrella stands down.
#
# Invocation contracts:
#   22_install_tts_offline.sh [--python <py>] [--force] [--core-only] [--melotts] [--gptsovits]
#     --force      re-extract the model + re-run every DEFAULT engine installer with --force.
#                  (The sherpa-onnx WHEEL itself is build-managed by the CPU/GPU guard,
#                  which is idempotent and has no force-reinstall concept. --force does NOT
#                  opt MeloTTS/GPT-SoVITS in — pair it with --melotts/--gptsovits for that.)
#     --core-only  install only Sherpa + Kokoro model (skip the umbrella).
#     --melotts    opt IN to MeloTTS (pins transformers==4.27.4; downgrades a 5.x venv).
#     --gptsovits  opt IN to GPT-SoVITS (clones repo + pins an old transformers).
#     --parallel   hand off to tts_parallel_install.sh: each engine streams live in its
#                  own tmux pane / terminal window; downloads overlap while the shared
#                  pip lock (base_libs/pip_lock.sh) serializes venv writes.

PYTHON="python3"
MELOTTS=0
GPTSOVITS=0
FORCE=0
CORE_ONLY=0
UMBRELLA=1
PARALLEL=0
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
# Shared venv resolution: gvar_common exports COMPILE_DIR + CORE_NODE_PROJECT_ROOT,
# then venv_python_common derives VENV_DIR / VENV_PYTHON3 / VENV_PIP3 from it (install
# INTO the venv that 13_ensure_python.sh builds, never the externally-managed system
# python). install_shells -> debian -> linux -> common (same path style as SHERPA_GUARD).
# These two are sourced BEFORE `set -u` because they intentionally test bare,
# possibly-unset vars (e.g. SHELLS_DIR); enabling set -u first aborts in gvar_common.
# This mirrors the proven 21_install_edge_tts.sh / 13_ensure_python.sh ordering.
source "$SCRIPT_DIR/../../common/gvar_common.sh"
source "$SCRIPT_DIR/../../common/venv_python_common.sh"
set -uo pipefail
# Single source of truth for the sherpa-onnx CPU/GPU build choice (mirrors the
# torch/onnxruntime guards): install_shells -> debian -> linux -> common.
COMMON_DIR="$SCRIPT_DIR/../../common"
SHERPA_GUARD="$COMMON_DIR/sherpa_onnx_cpu_guard.sh"
# Serialize pip into the shared venv (concurrent pip corrupts it). vpip wraps every pip
# call here; the parallel driver relies on it so engines' downloads overlap but their
# pip steps queue. Defensive: degrade to a pass-through vpip if the lib is missing.
PIPLOCK_LIB="$COMMON_DIR/base_libs/pip_lock.sh"
[ -f "$PIPLOCK_LIB" ] && . "$PIPLOCK_LIB"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }
MODEL_DIR="${CORE_NODE_CACHE_DIR:-/var/_core_node/cache}/tts/sherpa"
# int8-quantized Kokoro (zh/en) — smaller/faster one-time download.
MODEL_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-multi-lang-v1_1.tar.bz2"
MODEL_ARCHIVE=""
MODEL_SENTINEL=""
MODEL_OK=0
TMP_EXTRACT=""
PIP_ARGS=()
# Umbrella wiring (resolved after gvar_common gives us CORE_NODE_PROJECT_ROOT).
REPO_ROOT=""
INISCRIPTS_DIR=""
EDGE_TTS_SCRIPT=""
FASTER_WHISPER_SCRIPT=""
WHISPER_SCRIPT=""
VOSK_SCRIPT=""
MELOTTS_SCRIPT=""
GPTSOVITS_SCRIPT=""
ENGINE_OK=()
ENGINE_FAILED=()
ENGINE_SKIPPED=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python)    PYTHON="$2"; shift 2 ;;
        --melotts)   MELOTTS=1;   shift   ;;
        --gptsovits) GPTSOVITS=1; shift   ;;
        --force)     FORCE=1;     shift   ;;
        --core-only) CORE_ONLY=1; shift   ;;
        --parallel)  PARALLEL=1;  shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

# --parallel: hand off to the multi-terminal driver (each engine streams in its own
# tmux pane / window; downloads overlap, the shared pip lock serializes venv writes).
# The driver calls back `22 --core-only` (no --parallel) so there is no recursion.
if [[ "$PARALLEL" -eq 1 ]]; then
    PARALLEL_DRIVER="$SCRIPT_DIR/tts_parallel_install.sh"
    if [[ -f "$PARALLEL_DRIVER" ]]; then
        PARALLEL_ARGS=(--python "$PYTHON")
        [[ "$MELOTTS" -eq 1 ]]   && PARALLEL_ARGS+=(--melotts)
        [[ "$GPTSOVITS" -eq 1 ]] && PARALLEL_ARGS+=(--gptsovits)
        [[ "$FORCE" -eq 1 ]]     && PARALLEL_ARGS+=(--force)
        echo "[i] --parallel: handing off to $PARALLEL_DRIVER"
        exec bash "$PARALLEL_DRIVER" "${PARALLEL_ARGS[@]}"
    fi
    echo "[!] parallel driver not found ($PARALLEL_DRIVER); continuing with the serial umbrella."
fi

# pyservice prepare.sh runs every sibling installer itself, so when it delegates here
# the umbrella stands down (CORE only) to avoid a redundant second sweep.
if [[ "${PYCORE_INISCRIPTS_SWEEP:-0}" == "1" || "$CORE_ONLY" -eq 1 ]]; then
    UMBRELLA=0
fi

# Resolve repo root (prefer the canonical export; fall back to 5-up from here) and
# wire each engine to its own idempotent installer (canonical numbered script where
# one exists, else the self-contained iniscript). NEVER wire install_tts_offline.sh
# (it delegates back here) or prepare.sh (recursion).
if [[ -n "${CORE_NODE_PROJECT_ROOT:-}" && -d "$CORE_NODE_PROJECT_ROOT/scripts/shells/linux/common/iniscripts" ]]; then
    REPO_ROOT="$CORE_NODE_PROJECT_ROOT"
else
    REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
fi
INISCRIPTS_DIR="$REPO_ROOT/scripts/shells/linux/common/iniscripts"
EDGE_TTS_SCRIPT="$SCRIPT_DIR/21_install_edge_tts.sh"
FASTER_WHISPER_SCRIPT="$SCRIPT_DIR/14_install_faster_whisper.sh"
WHISPER_SCRIPT="$INISCRIPTS_DIR/install_whisper.sh"
VOSK_SCRIPT="$INISCRIPTS_DIR/install_vosk.sh"
MELOTTS_SCRIPT="$INISCRIPTS_DIR/install_melotts.sh"
GPTSOVITS_SCRIPT="$INISCRIPTS_DIR/install_gptsovits.sh"

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
    vpip "$PYTHON" -m pip install "${PIP_ARGS[@]}" || vpip "$PYTHON" -m pip install "$@"
}

# Run one engine's own idempotent installer, forwarding the shared interpreter and
# --force. Never aborts the umbrella: a failing engine is recorded and the rest still
# install (the orchestrator's "degraded, not fatal" contract).
run_engine_installer() {
    local label="$1" script="$2"; shift 2
    if [[ ! -s "$script" ]]; then
        echo "[!] $label installer not found: $script (skipping)."
        ENGINE_SKIPPED+=("$label")
        return 0
    fi
    local extra=()
    [[ "$FORCE" -eq 1 ]] && extra+=(--force)
    echo "------------------------------------------------------------"
    echo "[..] $label  ->  $script"
    if bash "$script" --python "$PYTHON" "${extra[@]}" "$@"; then
        ENGINE_OK+=("$label")
    else
        echo "[!] $label installer returned non-zero (continuing; this feature may be degraded)."
        ENGINE_FAILED+=("$label")
    fi
    return 0
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
    echo "[run] $PYTHON -c '<tarfile r:bz2 -> extractall(filter=data) safe extract>' $archive $tmp"
    if ! "$PYTHON" -c "import tarfile, sys
t = tarfile.open(sys.argv[1], 'r:bz2')
try:
    t.extractall(sys.argv[2], filter='data')   # safe extraction (Py 3.12+); silences the Py 3.14 tarfile deprecation
except TypeError:
    t.extractall(sys.argv[2])                   # older Python without the filter= argument
t.close()" "$archive" "$tmp"; then
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
echo " Installing local TTS/STT engines (sherpa core + umbrella)"
echo "============================================================"

if ! PYTHON="$(resolve_python "$PYTHON")"; then
    echo "[X] Python 3 was NOT found. Run 13_ensure_python.sh first, or pass --python <path>." >&2
    exit 1
fi
echo "  python   : $PYTHON"
echo "  mode     : $([[ "$UMBRELLA" -eq 1 ]] && echo 'CORE + UMBRELLA (full TTS/STT collection)' || echo 'CORE only (sherpa + model; siblings handled elsewhere)')"
echo "  repo     : $REPO_ROOT"

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

# --- 3) UMBRELLA: the rest of the local TTS/STT collection --------------- #
# Each engine has its OWN idempotent installer (skip-if-present); we just drive them
# with the shared interpreter. CORE-only / pyservice-sweep mode skips this block.
if [[ "$UMBRELLA" -eq 1 ]]; then
    echo "============================================================"
    echo " Umbrella: preparing the local TTS/STT collection"
    echo "          (default engines; MeloTTS/GPT-SoVITS are opt-in)"
    echo "============================================================"
    # DEFAULT engines (conflict-free with the shared venv's transformers).
    run_engine_installer "edge-tts (TTS)"        "$EDGE_TTS_SCRIPT"
    run_engine_installer "faster-whisper (STT)"  "$FASTER_WHISPER_SCRIPT"
    run_engine_installer "openai-whisper (STT)"  "$WHISPER_SCRIPT"
    run_engine_installer "Vosk (STT)"            "$VOSK_SCRIPT"

    # OPT-IN engines: MeloTTS / GPT-SoVITS pin an old transformers and would downgrade the
    # shared venv (transformers 5.x, used by the LLM stack). Only when explicitly enabled.
    # The sub-installers also self-gate, so this stays safe even if reached another way.
    if [[ "$MELOTTS" -eq 1 || "${MELOTTS_INSTALL:-0}" == "1" ]]; then
        run_engine_installer "MeloTTS (TTS)" "$MELOTTS_SCRIPT" --full
    else
        echo "[i] MeloTTS skipped (opt-in: --melotts or MELOTTS_INSTALL=1; pins transformers==4.27.4)."
        ENGINE_SKIPPED+=("MeloTTS (opt-in)")
    fi
    if [[ "$GPTSOVITS" -eq 1 || "${GPTSOVITS_INSTALL:-0}" == "1" ]]; then
        run_engine_installer "GPT-SoVITS (TTS)" "$GPTSOVITS_SCRIPT" --full
    else
        echo "[i] GPT-SoVITS skipped (opt-in: --gptsovits or GPTSOVITS_INSTALL=1; pins an old transformers)."
        ENGINE_SKIPPED+=("GPT-SoVITS (opt-in)")
    fi

    # Azure Speech SDK (cloud TTS+STT fallback; no model, needs key+region at run time).
    echo "------------------------------------------------------------"
    if py_has_module azure.cognitiveservices.speech && [[ "$FORCE" -eq 0 ]]; then
        echo "[OK] azure-cognitiveservices-speech already present; skipping."
        ENGINE_OK+=("Azure Speech SDK")
    else
        echo "[..] Azure Speech SDK (cloud TTS+STT) -> pip azure-cognitiveservices-speech"
        if pip_install --upgrade azure-cognitiveservices-speech && py_has_module azure.cognitiveservices.speech; then
            echo "[OK] azure-cognitiveservices-speech installed."
            ENGINE_OK+=("Azure Speech SDK")
        else
            echo "[!] azure-cognitiveservices-speech install failed (cloud fallback unavailable until installed)."
            ENGINE_FAILED+=("Azure Speech SDK")
        fi
    fi

    # Post-install CPU/GPU guards (repair-only): MeloTTS / GPT-SoVITS / faster-whisper
    # can transitively pull CUDA torch (+~4.3G nvidia-*). On a GPU-less host switch the
    # builds back to CPU. Repair-only: never installs when a minimal box lacks them.
    if [[ -f "$COMMON_DIR/torch_cpu_guard.sh" ]]; then
        echo "------------------------------------------------------------"
        echo "[..] torch CPU/GPU guard (repair-only)"
        TCG_REPAIR_ONLY=1 bash "$COMMON_DIR/torch_cpu_guard.sh" --python "$PYTHON" || true
    fi
    if [[ -f "$COMMON_DIR/onnxruntime_cpu_guard.sh" ]]; then
        echo "[..] onnxruntime CPU/GPU guard (repair-only)"
        OCG_REPAIR_ONLY=1 bash "$COMMON_DIR/onnxruntime_cpu_guard.sh" --python "$PYTHON" || true
    fi

    echo "============================================================"
    echo " TTS/STT collection summary"
    echo "   ok / present : ${ENGINE_OK[*]:-none}"
    echo "   degraded     : ${ENGINE_FAILED[*]:-none}"
    echo "   skipped      : ${ENGINE_SKIPPED[*]:-none}"
    echo "============================================================"
else
    # CORE-only / pyservice-sweep: prepare.sh installs the (default) siblings itself. Still
    # honor an explicit MeloTTS / GPT-SoVITS opt-in passed here.
    [[ "$MELOTTS" -eq 1 ]]   && run_engine_installer "MeloTTS (TTS)"    "$MELOTTS_SCRIPT"   --full
    [[ "$GPTSOVITS" -eq 1 ]] && run_engine_installer "GPT-SoVITS (TTS)" "$GPTSOVITS_SCRIPT" --full
    if [[ "$MELOTTS" -eq 0 && "$GPTSOVITS" -eq 0 ]]; then
        echo "[i] CORE-only mode: sherpa + model done; siblings handled by prepare.sh / numbered sweep."
    fi
fi

exit 0
