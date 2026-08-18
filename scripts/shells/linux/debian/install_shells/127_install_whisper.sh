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
# Serialize pip into the shared venv.
PIPLOCK_LIB="$SCRIPT_DIR/../../common/base_libs/pip_lock.sh"
. "$PIPLOCK_LIB"
. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
source "$SCRIPT_DIR/../../common/common_functions.sh"

PYTHON="python3"
MODEL=""
FORCE=0
WHISPER_METADATA=""
WHISPER_READY=0

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

# NVIDIA CUDA GPU usable through the shared policy helper.
has_cuda() {
    gpu_present
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
    if [ "$(get_global_var "SKIP_LARGE_MODELS" "false")" = "true" ]; then
        echo "[skip] Headless server (non-desktop) with no CUDA GPU; skipping whisper install. Use --force to override."
        complete_prereq_step "$PYTHON" "[install_whisper] " --absent-ok "headless CPU host" whisper
        exit 0
    fi
fi

# --- 1) openai-whisper --------------------------------------------------- #
WHISPER_METADATA="$("$PYTHON" -m pip show openai-whisper 2>/dev/null || true)"
if [[ "$WHISPER_METADATA" == *"Name:"* ]]; then
    WHISPER_READY=1
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "openai-whisper metadata is present"
else
    echo "[..] pip install openai-whisper ..."
    PIP_ARGS=(openai-whisper)
    # On externally-managed Linux Pythons (PEP 668) this flag avoids a hard error.
    if [[ "$(uname -s)" != "Darwin" ]]; then PIP_ARGS=(--break-system-packages "${PIP_ARGS[@]}"); fi
    vpip "$PYTHON" -m pip install "${PIP_ARGS[@]}" || true
    WHISPER_METADATA="$("$PYTHON" -m pip show openai-whisper 2>/dev/null || true)"
    if [[ "$WHISPER_METADATA" == *"Name:"* ]]; then
        WHISPER_READY=1
        echo "[OK] openai-whisper installed."
    else
        echo "[!] openai-whisper metadata is still missing; retrying next run."
    fi
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
if [[ "$WHISPER_READY" -eq 1 && -z "$MODEL" ]]; then
    MODEL="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" whisper_model "$_gpu_flag")"
    echo "[..] auto model tier ($(echo "$_gpu_flag" | tr -d '-')): '$MODEL'"
fi
if [[ "$WHISPER_READY" -eq 1 && -n "$MODEL" ]]; then
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
