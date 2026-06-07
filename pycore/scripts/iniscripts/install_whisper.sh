#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_whisper.sh - Dedicated prerequisite installer for OpenAI Whisper.
#
# Run by prepare.sh before the Pycore service launches. Installs `openai-whisper`
# (import name `whisper`, mapped in pycore/pyfoundations/third_party.py as
# "whisper": "openai-whisper") and optionally pre-downloads a model.
#
# IDEMPOTENT: skips pip if `whisper` already imports; skips model download if the
# model is already cached. whisper needs the `ffmpeg` executable on PATH at run
# time - this script only checks/warns, it does not install ffmpeg.
#
# Usage:
#   ./install_whisper.sh --python /usr/bin/python3
#   ./install_whisper.sh --python python3 --model base
#   ./install_whisper.sh --force
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"

PYTHON="python3"
MODEL=""
FORCE=0

# Minimum system capacity to bother installing whisper on. --force overrides.
MIN_RAM_GB=1        # skip if total physical RAM is below this
MIN_DISK_GB=100     # skip if total FREE space across all filesystems is below this

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --model)  MODEL="$2";  shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

py_has_module() {
    "$PYTHON" -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$1') else 1)" >/dev/null 2>&1
}

# Total physical RAM in whole GB (Linux /proc/meminfo, macOS sysctl); "" if unknown.
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

# Total FREE disk in whole GB, summed across real (non-pseudo) filesystems; "" if unknown.
get_free_disk_gb() {
    df -k -P 2>/dev/null | awk '
        NR>1 && $1 !~ /^(tmpfs|devtmpfs|overlay|squashfs|none|udev|devfs|map.*)$/ { sum += $4 }
        END { if (sum > 0) printf "%d", sum/1024/1024 }'
}

# Headless / non-desktop system? (Linux only; macOS is treated as a desktop.)
is_server() {
    [[ "$(uname -s)" == "Darwin" ]] && return 1
    if command -v systemctl >/dev/null 2>&1; then
        case "$(systemctl get-default 2>/dev/null)" in
            graphical.target) return 1 ;;   # boots to a GUI => desktop
        esac
    fi
    # An active display / desktop session => desktop, not a server.
    if [[ -n "${DISPLAY:-}" || -n "${WAYLAND_DISPLAY:-}" || -n "${XDG_CURRENT_DESKTOP:-}" ]]; then
        return 1
    fi
    return 0   # no GUI target, no display => treat as headless server
}

# NVIDIA CUDA GPU usable?
has_cuda() {
    command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1
}

echo "============================================================"
echo " Installing openai-whisper (speech-to-text)"
echo "============================================================"
echo "  python : $PYTHON"

# --- 0) system-capacity / environment guard ------------------------------ #
# Skip the heavy whisper install when it is not worth it:
#   * (both)  total RAM < MIN_RAM_GB GB, OR total FREE disk < MIN_DISK_GB GB
#   * (Linux) headless server (non-desktop) AND no CUDA GPU
# Metrics that cannot be read are "unknown" and do NOT trigger a skip.
# --force bypasses the whole guard.
RAM_GB="$(get_ram_gb)"
DISK_GB="$(get_free_disk_gb)"
echo "  ram    : ${RAM_GB:-?} GB"
echo "  disk   : ${DISK_GB:-?} GB free (all filesystems)"

if [[ "$FORCE" -eq 0 ]]; then
    reasons=()
    [[ -n "$RAM_GB"  && "$RAM_GB"  -lt "$MIN_RAM_GB"  ]] && reasons+=("RAM ${RAM_GB} GB < ${MIN_RAM_GB} GB")
    [[ -n "$DISK_GB" && "$DISK_GB" -lt "$MIN_DISK_GB" ]] && reasons+=("free disk ${DISK_GB} GB < ${MIN_DISK_GB} GB")
    if [[ ${#reasons[@]} -gt 0 ]]; then
        echo "[skip] System too small for whisper (${reasons[*]}); skipping install. Use --force to override."
        exit 0
    fi
    if is_server && ! has_cuda; then
        echo "[skip] Headless server (non-desktop) with no CUDA GPU; skipping whisper install. Use --force to override."
        exit 0
    fi
fi

# --- 1) openai-whisper --------------------------------------------------- #
if py_has_module whisper && [[ "$FORCE" -eq 0 ]]; then
    ver="$("$PYTHON" -c "import whisper; print(getattr(whisper,'__version__','?'))" 2>/dev/null)"
    echo "[OK] whisper already installed (version $ver); skipping pip."
else
    echo "[..] pip install --upgrade openai-whisper ..."
    PIP_ARGS=(--upgrade openai-whisper)
    # On externally-managed Linux Pythons (PEP 668) this flag avoids a hard error.
    if [[ "$(uname -s)" != "Darwin" ]]; then PIP_ARGS=(--break-system-packages "${PIP_ARGS[@]}"); fi
    if ! "$PYTHON" -m pip install "${PIP_ARGS[@]}"; then
        # Retry without the flag for environments that reject it (venvs, older pip).
        if ! "$PYTHON" -m pip install --upgrade openai-whisper; then
            echo "[X] openai-whisper install failed." >&2
            exit 1
        fi
    fi
    if ! py_has_module whisper; then
        echo "[X] whisper still not importable after install." >&2
        exit 1
    fi
    ver="$("$PYTHON" -c "import whisper; print(getattr(whisper,'__version__','?'))" 2>/dev/null)"
    echo "[OK] openai-whisper installed (version $ver)."
fi

# --- 2) ffmpeg presence check -------------------------------------------- #
if command -v ffmpeg >/dev/null 2>&1; then
    echo "[OK] ffmpeg found on PATH."
else
    echo "[!] ffmpeg NOT on PATH - whisper needs it to decode audio at run time."
    echo "    Install it later, e.g.: apt install ffmpeg  /  brew install ffmpeg"
fi

# --- 3) optional model pre-download -------------------------------------- #
if [[ -n "$MODEL" ]]; then
    echo "[..] Ensuring whisper model '$MODEL' is downloaded ..."
    if "$PYTHON" -u "$SCRIPT_DIR/download_whisper_model.py" "$MODEL"; then
        echo "[OK] model '$MODEL' is ready."
    else
        echo "[!] model download did not complete; whisper will fetch it on first use."
    fi
fi

exit 0
