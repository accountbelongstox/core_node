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

# Single source of truth for the faster-whisper prerequisite (DEFAULT STT engine
# for the pycore "Video Extraction" feature) on Linux/macOS. Prefix 15 sorts right
# AFTER 13_ensure_python.sh and 14_install_python_prereq_packages.sh in install.sh's
# numeric-ordered run, so pip and ML prereqs are ready.
# Also invoked by prepare_pycore_prerequisites.sh (pyservice).
# (the pyservice prerequisite reference) to keep one copy of the logic.
#
# Invocation contracts:
#   - install.sh flow:  16_install_faster_whisper.sh           (no args; resolves python)
#   - pyservice flow:   16_install_faster_whisper.sh --python <py> [--model <m>] [--force]
set -uo pipefail

# Declare all variables at the beginning
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
PYTHON="python3"
MODEL=""
FORCE=0
MIN_RAM_GB=1
MIN_DISK_GB=100
RAM_GB=""
DISK_GB=""
reasons=()
PIP_ARGS=()
CUDA_INDEX_LIB=""
CUDA_POLICY_TAG=""
CUDA_POLICY_MAJOR=""
CTRANSLATE_CUDA_MAJOR="12"
USE_CTRANSLATE_CUDA=0

# Resolve the common dir the same way sibling install scripts do.
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_CURRENT_DIR/../../common/tts_install_assets_common.sh"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables (exports COMPILE_DIR), then the shared venv resolution
# (exports VENV_DIR / VENV_PYTHON3 / VENV_PIP3 and helpers) so package installs
# target the shared venv built by 13_ensure_python.sh, not the system python.
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/venv_python_common.sh"
# Serialize pip into the shared venv (safe under the parallel install driver). Defensive.
PIPLOCK_LIB="$PARENT_DIR_LEVEL_2/common/base_libs/pip_lock.sh"
[ -f "$PIPLOCK_LIB" ] && . "$PIPLOCK_LIB"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }
CUDA_INDEX_LIB="$PARENT_DIR_LEVEL_2/common/base_libs/cuda_index.sh"
[ -f "$CUDA_INDEX_LIB" ] && . "$CUDA_INDEX_LIB"
CTRANSLATE_CUDA_MAJOR="${AI_CTRANSLATE2_CUDA_MAJOR:-12}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --model)  MODEL="$2";  shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

# Resolve a real Python 3 interpreter (prefer the one passed in, else PATH).
resolve_python() {
    local preferred="$1"
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
get_ram_gb() {
    if [[ -r /proc/meminfo ]]; then
        awk '/^MemTotal:/{ printf "%d", $2/1024/1024 }' /proc/meminfo && return 0
    fi
    if command -v sysctl >/dev/null 2>&1; then
        local b; b="$(sysctl -n hw.memsize 2>/dev/null)"
        [[ -n "$b" ]] && echo $(( b / 1024 / 1024 / 1024 )) && return 0
    fi
    echo ""
}
get_free_disk_gb() {
    df -k -P 2>/dev/null | awk '
        NR>1 && $1 !~ /^(tmpfs|devtmpfs|overlay|squashfs|none|udev|devfs|map.*)$/ { sum += $4 }
        END { if (sum > 0) printf "%d", sum/1024/1024 }'
}
is_server() {
    [[ "$(uname -s)" == "Darwin" ]] && return 1
    if command -v systemctl >/dev/null 2>&1; then
        case "$(systemctl get-default 2>/dev/null)" in graphical.target) return 1 ;; esac
    fi
    if [[ -n "${DISPLAY:-}" || -n "${WAYLAND_DISPLAY:-}" || -n "${XDG_CURRENT_DESKTOP:-}" ]]; then return 1; fi
    return 0
}
# GPU detection -- same logic as the canonical lib_gpu.sh / the *_cpu_guard.sh helpers
# (nvidia-smi -L; honors TORCH_FORCE_CUDA=1 and CUDA_VISIBLE_DEVICES=-1).
has_cuda() {
    [ "${TORCH_FORCE_CUDA:-0}" = "1" ] && return 0
    [ "${CUDA_VISIBLE_DEVICES:-}" = "-1" ] && return 1
    command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1
}

ctranslate_cuda_usable() {
    "$PYTHON" -c 'import ctranslate2,sys; sys.exit(0 if ctranslate2.get_cuda_device_count() > 0 else 1)' >/dev/null 2>&1
}

echo "============================================================"
echo " Installing faster-whisper (default STT for Video Extraction)"
echo "============================================================"

# --- 0) resolve python (13_ensure_python.sh has already run in install flow) --- #
# Prefer the shared venv built by 13_ensure_python.sh so packages install INTO the
# venv (not the externally-managed system python). An explicit --python still wins.
if [[ "$PYTHON" == "python3" ]]; then
    PYTHON="$(venv_python_from_common)"
fi
if ! PYTHON="$(resolve_python "$PYTHON")"; then
    echo "[X] Python 3 was NOT found. Run 13_ensure_python.sh first, or pass --python <path>." >&2
    exit 1
fi
echo "  python : $PYTHON"

# --- 1) capacity / environment guard ------------------------------------- #
RAM_GB="$(get_ram_gb)"; DISK_GB="$(get_free_disk_gb)"
echo "  ram    : ${RAM_GB:-?} GB"
echo "  disk   : ${DISK_GB:-?} GB free (all filesystems)"
if [[ "$FORCE" -eq 0 ]]; then
    [[ -n "$RAM_GB"  && "$RAM_GB"  -lt "$MIN_RAM_GB"  ]] && reasons+=("RAM ${RAM_GB} GB < ${MIN_RAM_GB} GB")
    [[ -n "$DISK_GB" && "$DISK_GB" -lt "$MIN_DISK_GB" ]] && reasons+=("free disk ${DISK_GB} GB < ${MIN_DISK_GB} GB")
    if [[ ${#reasons[@]} -gt 0 ]]; then
        echo "[skip] System too small for faster-whisper (${reasons[*]}); skipping. Use --force to override."
        complete_prereq_step "$PYTHON" "[faster_whisper] " --absent-ok "resource policy" faster_whisper
    fi
    if is_server && ! has_cuda; then
        echo "[skip] Headless server (non-desktop) with no CUDA GPU; skipping. Use --force to override."
        complete_prereq_step "$PYTHON" "[faster_whisper] " --absent-ok "headless CPU host" faster_whisper
    fi
fi

# --- 2) faster-whisper (idempotent) -------------------------------------- #
if py_has_module faster_whisper && [[ "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_CURRENT_DIR" "faster-whisper already installed"
else
    echo "[..] pip install --upgrade faster-whisper ..."
    # Install INTO the shared venv; no PEP668 escape flags needed there.
    PIP_ARGS=(--upgrade faster-whisper)
    echo "[run] $PYTHON -m pip install ${PIP_ARGS[*]}"
    if ! vpip "$PYTHON" -m pip install "${PIP_ARGS[@]}"; then
        echo "[X] faster-whisper install failed." >&2
        fail_prereq_step "$PYTHON" "[faster_whisper] " faster_whisper
    fi
    if ! py_has_module faster_whisper; then
        echo "[X] faster-whisper still not importable after install." >&2
        fail_prereq_step "$PYTHON" "[faster_whisper] " faster_whisper
    fi
    echo "[OK] faster-whisper installed."
fi

# --- 3) Runtime mode: preserve the one canonical CUDA major -------------- #
CUDA_POLICY_TAG="$(cuda_policy_tag)"
CUDA_POLICY_MAJOR="$(cuda_policy_field major "$CUDA_POLICY_TAG" 2>/dev/null || true)"
if has_cuda && [[ "$CUDA_POLICY_MAJOR" == "$CTRANSLATE_CUDA_MAJOR" ]] && ctranslate_cuda_usable; then
    USE_CTRANSLATE_CUDA=1
    echo "[OK] CTranslate2 CUDA $CTRANSLATE_CUDA_MAJOR is usable."
elif has_cuda; then
    echo "[i] GPU host uses canonical ${CUDA_POLICY_TAG:-CPU policy}; CTranslate2 requires CUDA $CTRANSLATE_CUDA_MAJOR."
    echo "[i] faster-whisper uses CPU int8; no second CUDA runtime is installed."
else
    echo "[i] No NVIDIA GPU detected -> CPU int8 inference."
fi

# --- 4) model pre-download (GPU large-v3 / CPU medium when --model omitted) #
_gpu_flag="--cpu"
if [[ "$USE_CTRANSLATE_CUDA" -eq 1 ]]; then _gpu_flag="--gpu"; fi
tts_official_env_line "$PYTHON" "$SCRIPT_CURRENT_DIR" faster_whisper | while read -r _line; do
    echo "  official env (faster_whisper): $_line"
done
if [[ -z "$MODEL" || "$MODEL" == "auto" ]]; then
    MODEL="$(tts_model_tier "$PYTHON" "$SCRIPT_CURRENT_DIR" faster_whisper_model "$_gpu_flag")"
    echo "[..] auto model tier ($(echo "$_gpu_flag" | tr -d '-')): '$MODEL'"
fi
if [[ -n "$MODEL" && "$MODEL" != "auto" ]]; then
    echo "[..] Pre-downloading faster-whisper model '$MODEL' ..."
    echo "[run] $PYTHON -c \"from faster_whisper import download_model; download_model('$MODEL'); print('cached')\""
    if "$PYTHON" -c "from faster_whisper import download_model; download_model('$MODEL'); print('cached')"; then
        echo "[OK] model '$MODEL' ready."
        repo_root="$(pycore_repo_root_from_install_shells "$SCRIPT_CURRENT_DIR")"
        PYTHONPATH="$repo_root" "$PYTHON" -c "from pycore.pyutils.common.model_tiers import persist_stt_models; persist_stt_models(faster_whisper='$MODEL')" 2>/dev/null || true
    else
        echo "[!] model download did not complete; it will download on first use."
    fi
fi

complete_prereq_step "$PYTHON" "[faster_whisper] " faster_whisper
