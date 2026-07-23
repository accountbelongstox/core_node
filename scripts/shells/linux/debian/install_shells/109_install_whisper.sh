#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_whisper.sh - Dedicated prerequisite installer for OpenAI Whisper.
#
# Run by prepare_pycore_prerequisites.sh before the Pycore service launches. Installs `openai-whisper`
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
# Serialize pip into the shared venv (safe under the parallel install driver). Defensive.
PIPLOCK_LIB="$SCRIPT_DIR/../../common/base_libs/pip_lock.sh"
[ -f "$PIPLOCK_LIB" ] && . "$PIPLOCK_LIB"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }
. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh" 2>/dev/null || true
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"

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

# Pull in the canonical detector (gpu_present) from the ONE shared base lib so whisper's
# GPU gate honors TORCH_FORCE_CUDA / CUDA_VISIBLE_DEVICES and uses `nvidia-smi -L`,
# matching every other AI installer.
__libgpu="$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"
if [ -f "$__libgpu" ]; then . "$__libgpu"; fi

# NVIDIA CUDA GPU usable? Delegate to gpu_present; guarded fallback if it is absent.
has_cuda() {
    if declare -F gpu_present >/dev/null; then
        gpu_present
    else
        command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1
    fi
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
        complete_prereq_step "$PYTHON" "[install_whisper] " --absent-ok "resource policy" whisper
    fi
    if is_server && ! has_cuda; then
        echo "[skip] Headless server (non-desktop) with no CUDA GPU; skipping whisper install. Use --force to override."
        complete_prereq_step "$PYTHON" "[install_whisper] " --absent-ok "headless CPU host" whisper
    fi
fi

# --- 1) openai-whisper --------------------------------------------------- #
if py_has_module whisper && [[ "$FORCE" -eq 0 ]]; then
    ver="$("$PYTHON" -c "import whisper; print(getattr(whisper,'__version__','?'))" 2>/dev/null)"
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "whisper already installed (version $ver)"
else
    echo "[..] pip install --upgrade openai-whisper ..."
    PIP_ARGS=(--upgrade openai-whisper)
    # On externally-managed Linux Pythons (PEP 668) this flag avoids a hard error.
    if [[ "$(uname -s)" != "Darwin" ]]; then PIP_ARGS=(--break-system-packages "${PIP_ARGS[@]}"); fi
    if ! vpip "$PYTHON" -m pip install "${PIP_ARGS[@]}"; then
        # Retry without the flag for environments that reject it (venvs, older pip).
        if ! vpip "$PYTHON" -m pip install --upgrade openai-whisper; then
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

# --- 3) model pre-download (GPU large-v3 / CPU medium when --model omitted) #
_gpu_flag="--cpu"
if has_cuda; then _gpu_flag="--gpu"; fi
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" whisper | while read -r _line; do
    echo "  official env (whisper): $_line"
done
if [[ -z "$MODEL" ]]; then
    MODEL="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" whisper_model "$_gpu_flag")"
    echo "[..] auto model tier ($(echo "$_gpu_flag" | tr -d '-')): '$MODEL'"
fi
    if [[ -n "$MODEL" ]]; then
    echo "[..] Ensuring whisper model '$MODEL' is downloaded ..."
    _wh_cache="${WHISPER_CACHE_DIR:-${CORE_NODE_CACHE_DIR:-/var/_core_node/cache}/whisper}"
    if install_whisper_model_weights "$MODEL" "$_wh_cache" "[install_whisper] "; then
        echo "[OK] model '$MODEL' is ready."
        repo_root="$(pycore_repo_root_from_install_shells "$SCRIPT_DIR")"
        PYTHONPATH="$repo_root" "$PYTHON" -c "from pycore.pyutils.common.model_tiers import persist_stt_models; persist_stt_models(whisper='$MODEL')" 2>/dev/null || true
    else
        echo "[!] model download did not complete; whisper will fetch it on first use."
    fi
fi

complete_prereq_step "$PYTHON" "[install_whisper] " whisper
