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
# for the pycore "Video Extraction" feature) on Linux/macOS. Prefix 14 sorts right
# AFTER 13_ensure_python.sh in install.sh's numeric-ordered run, so pip is ready.
# Also invoked directly by scripts/shells/linux/common/iniscripts/install_faster_whisper.sh
# (the pyservice prerequisite reference) to keep one copy of the logic.
#
# Invocation contracts:
#   - install.sh flow:  14_install_faster_whisper.sh           (no args; resolves python)
#   - pyservice flow:   14_install_faster_whisper.sh --python <py> [--model <m>] [--force]
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
GPU_ARGS=()

# Resolve the common dir the same way sibling install scripts do.
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
        exit 0
    fi
    if is_server && ! has_cuda; then
        echo "[skip] Headless server (non-desktop) with no CUDA GPU; skipping. Use --force to override."
        exit 0
    fi
fi

# --- 2) faster-whisper (idempotent) -------------------------------------- #
if py_has_module faster_whisper && [[ "$FORCE" -eq 0 ]]; then
    echo "[OK] faster-whisper already installed; skipping pip."
else
    echo "[..] pip install --upgrade faster-whisper ..."
    # Install INTO the shared venv; no PEP668 escape flags needed there.
    PIP_ARGS=(--upgrade faster-whisper)
    echo "[run] $PYTHON -m pip install ${PIP_ARGS[*]}"
    if ! vpip "$PYTHON" -m pip install "${PIP_ARGS[@]}"; then
        echo "[X] faster-whisper install failed." >&2
        exit 1
    fi
    if ! py_has_module faster_whisper; then
        echo "[X] faster-whisper still not importable after install." >&2
        exit 1
    fi
    echo "[OK] faster-whisper installed."
fi

# --- 3) GPU runtime libs (only if a CUDA GPU is present; idempotent) ------ #
# Skip-when-present: on a GPU host re-run, an already-satisfied cublas/cudnn must NOT
# re-invoke pip every time (the steady-state run stays a cheap no-op).
if has_cuda && py_has_module nvidia.cublas && py_has_module nvidia.cudnn && [[ "$FORCE" -eq 0 ]]; then
    echo "[OK] GPU runtime libs (cublas/cudnn) already present; skipping."
elif has_cuda; then
    echo "[..] NVIDIA GPU detected -> pip install nvidia-cublas-cu12 nvidia-cudnn-cu12==9.* ..."
    # Install the CUDA/nvidia wheels INTO the shared venv (no PEP668 escape flags).
    GPU_ARGS=('nvidia-cublas-cu12' 'nvidia-cudnn-cu12==9.*')
    echo "[run] $PYTHON -m pip install ${GPU_ARGS[*]}"
    if ! vpip "$PYTHON" -m pip install "${GPU_ARGS[@]}"; then
        echo "[!] GPU lib install failed; whisper will fall back to CPU (int8)."
    else
        echo "[OK] GPU runtime libs present."
    fi
else
    echo "[i] No NVIDIA GPU detected -> CPU (int8) inference."
fi

# --- 4) optional model pre-download -------------------------------------- #
if [[ -n "$MODEL" && "$MODEL" != "auto" ]]; then
    echo "[..] Pre-downloading faster-whisper model '$MODEL' ..."
    echo "[run] $PYTHON -c \"from faster_whisper import download_model; download_model('$MODEL'); print('cached')\""
    if "$PYTHON" -c "from faster_whisper import download_model; download_model('$MODEL'); print('cached')"; then
        echo "[OK] model '$MODEL' ready."
    else
        echo "[!] model download did not complete; it will download on first use."
    fi
fi

exit 0
