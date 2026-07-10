#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# prepare.sh - Prerequisite-install orchestrator for the Pycore service
#              (Linux / macOS / Git-Bash / WSL).
#
# This directory (scripts/shells/linux/common/iniscripts) holds the shell-managed prerequisite
# installers that run BEFORE pycore_module_caller.py launches. Their job is to set
# up the heavy / awkward third-party packages that are more convenient to install
# from a shell than from Python's import-time auto-installer
# (pycore/pyfoundations/third_party.py). third_party.py still fast-detects and
# installs the lighter packages; these scripts cover the rest (e.g. whisper).
#
# prepare.sh AUTO-DISCOVERS every install_*.sh next to it and runs each one,
# passing the resolved Python path. To add a new prerequisite, drop an
# install_<name>.sh here - no edit to this orchestrator is needed. Each installer
# MUST be idempotent (detect "already installed" and skip).
#
# Usage:
#   ./prepare.sh --python /usr/bin/python3
#   ./prepare.sh --include whisper --whisper-model base
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"

PYTHON="python3"
INCLUDE=()
WHISPER_MODEL=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python)        PYTHON="$2";        shift 2 ;;
        --include)       INCLUDE+=("$2");     shift 2 ;;
        --whisper-model) WHISPER_MODEL="$2";  shift 2 ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

# --- Shared install base vs project venv (single source of truth) ------------ #
# Where pip installs land is decided ONCE by pycore_export_python_env_from_common in
# common/venv_python_common.sh — the SAME helper pyservice.sh (and the systemd service)
# call — so the worker imports the very packages these installers write:
#   - a VENV interpreter targets itself (PIP_USER=0, NO PYTHONUSERBASE; a venv is
#     self-contained and PIP_USER=1 even ERRORS when UPGRADING a venv-resident package);
#   - a NON-venv system python uses the all-users shared base /opt/_core_node/pyuserbase
#     (PIP_USER=1, PIP_BREAK_SYSTEM_PACKAGES=1) so a different-user service still sees it.
SHARED_BASE_MSG=""
# shellcheck source=/dev/null
source "$SCRIPT_DIR/../venv_python_common.sh" 2>/dev/null || true
if type pycore_export_python_env_from_common >/dev/null 2>&1; then
    pycore_export_python_env_from_common "$PYTHON"
fi
if [[ "${PIP_USER:-}" == "0" ]]; then
    SHARED_BASE_MSG="[i] Installing into the project venv ($("$PYTHON" -c 'import sys; print(sys.prefix)' 2>/dev/null)); --no-user (PIP_USER=0)."
elif [[ -n "${PYTHONUSERBASE:-}" ]]; then
    SHARED_BASE_MSG="[i] Shared Python base (all users): $PYTHONUSERBASE (PIP_USER=1)"
elif [[ "$(uname -s)" == "Linux" ]]; then
    SHARED_BASE_MSG="[!] Shared base ${PYCORE_PYUSERBASE:-/opt/_core_node/pyuserbase} not writable — run once as root to create it 1777. Falling back to per-user installs."
fi

# Wire the ONE shared, all-users cache location so every pip / model download below
# lands in /var/_core_node/cache regardless of which user runs the install.
__scc_env="$SCRIPT_DIR/../shared_cache_env.sh"
[ -f "$__scc_env" ] && source "$__scc_env"

echo "------------------------------------------------------"
echo " Pycore prerequisites (iniscripts)"
echo "------------------------------------------------------"
[[ -n "$SHARED_BASE_MSG" ]] && echo "$SHARED_BASE_MSG"

# in_include <name> -> 0 if name is selected (or no -include filter given)
in_include() {
    [[ ${#INCLUDE[@]} -eq 0 ]] && return 0
    local n
    for n in "${INCLUDE[@]}"; do [[ "$n" == "$1" ]] && return 0; done
    return 1
}

shopt -s nullglob
installers=("$SCRIPT_DIR"/install_*.sh)
shopt -u nullglob

if [[ ${#installers[@]} -eq 0 ]]; then
    echo "[i] No install_*.sh prerequisite scripts found."
    exit 0
fi

# Tell 24_install_tts_offline.sh (reached via install_tts_offline.sh) to stand its
# umbrella down: this sweep already runs every sibling engine installer itself, so the
# umbrella would only re-do the same work. It still installs its CORE (sherpa + model).
export PYCORE_INISCRIPTS_SWEEP=1

failed=()
for installer in "${installers[@]}"; do
    base="$(basename "$installer" .sh)"   # install_whisper
    name="${base#install_}"               # whisper

    if ! in_include "$name"; then
        echo "[skip] $name (not in --include)"
        continue
    fi

    echo "[..] Prerequisite: $name"

    args=(--python "$PYTHON")
    if [[ ( "$name" == "whisper" || "$name" == "faster_whisper" ) && -n "$WHISPER_MODEL" ]]; then
        args+=(--model "$WHISPER_MODEL")
    fi

    if ! bash "$installer" "${args[@]}"; then
        echo "[!] $name did not complete cleanly."
        failed+=("$name")
    fi
done

# --- Post-install CPU/GPU guards (key point) ----------------------------------
# Any installer above can transitively pull CUDA builds (+~4.3G nvidia-*): the
# default CUDA torch (easyocr / faster-whisper) or onnxruntime-gpu (OCR). On a
# GPU-less host switch them back to the CPU builds. Repair-only: never install when
# a minimal box doesn't have them. Both idempotent. Single source of truth: the
# common/*_cpu_guard.sh "外挂" scripts.
GUARD_DIR="$SCRIPT_DIR/.."
if [[ -f "$GUARD_DIR/torch_cpu_guard.sh" ]]; then
    echo "[..] torch CPU/GPU guard (repair-only)"
    TCG_REPAIR_ONLY=1 bash "$GUARD_DIR/torch_cpu_guard.sh" --python "$PYTHON" || true
fi
if [[ -f "$GUARD_DIR/onnxruntime_cpu_guard.sh" ]]; then
    echo "[..] onnxruntime CPU/GPU guard (repair-only)"
    OCG_REPAIR_ONLY=1 bash "$GUARD_DIR/onnxruntime_cpu_guard.sh" --python "$PYTHON" || true
fi
if [[ -f "$GUARD_DIR/sherpa_onnx_cpu_guard.sh" ]]; then
    # Offline-TTS engine: a CPU host must never carry a stray '+cuda' sherpa-onnx.
    echo "[..] sherpa-onnx CPU/GPU guard (repair-only)"
    SOG_REPAIR_ONLY=1 bash "$GUARD_DIR/sherpa_onnx_cpu_guard.sh" --python "$PYTHON" || true
fi
if [[ -f "$GUARD_DIR/paddle_cpu_guard.sh" ]]; then
    echo "[..] paddle CPU/GPU guard (repair-only)"
    PCG_REPAIR_ONLY=1 bash "$GUARD_DIR/paddle_cpu_guard.sh" --python "$PYTHON" || true
fi

if [[ ${#failed[@]} -gt 0 ]]; then
    echo "[!] Some prerequisites did not complete cleanly: ${failed[*]}"
    # Non-fatal: the service can still start; affected features may be degraded.
    exit 0
fi

echo "[OK] All prerequisites complete."
exit 0
