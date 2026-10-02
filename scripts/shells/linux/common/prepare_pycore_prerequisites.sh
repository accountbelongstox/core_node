#!/usr/bin/env bash
# Pycore prerequisite orchestrator (caller: pyservice.sh).
# Runs numbered install_shells in dependency order; scripts in that dir never call each other.
#
# Prerequisite chain (after 13_install_default_python.sh / venv):
#   UI & system -> ffmpeg -> light pip -> OCR -> STT -> TTS -> neural TTS (opt-in) -> melotts (opt-in, last) -> device tools
#
# Install-time environment shielding (see development-guides/cross-docs/
# TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md Section 7). Every installer is IDEMPOTENT and
# self-REPAIRING, so re-running this whole sweep preserves installed packages and repairs missing artifacts:
#   * Bucket A (deepseek/qwen25/nllb/bark): shares the installed transformers distribution
#     and delegates compatibility to pip only when the package is absent.
#   * Bucket B (qwen3tts, melotts, gptsovits): incompatible transformer dependencies stay out
#     of the main interpreter - each installs into a DEDICATED per-engine venv
#     (qwen3tts/melotts/gptsovits via isolated_venv.ensure_venv),
#     built --system-site-packages so it reuses the system CUDA torch and self-rebuilds on a
#     broken import; their transformer dependencies never touch the shared interpreter. melotts and
#     gptsovits keep an explicit --full opt-in only because the venv build + model download is
#     heavy (an already-built venv is still maintained + self-repaired on every sweep).
#   Sentinels (.deps_done / .model_installed) gate re-work; weight verification re-downloads
#   incomplete files; installed pip distributions are otherwise preserved.
#
# Usage:
#   scripts/shells/linux/common/prepare_pycore_prerequisites.sh --python /usr/bin/python3
#   scripts/shells/linux/common/prepare_pycore_prerequisites.sh --include whisper --whisper-model base
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
COMMON_DIR="$SCRIPT_DIR"
INSTALL_SHELLS_DIR="$(cd "$SCRIPT_DIR/../debian/install_shells" && pwd)"

PYTHON="python3"
INCLUDE=()
WHISPER_MODEL=""
FASTER_WHISPER_MODEL=""
VOSK_MODEL=""
NEURAL_BATCH_INSTALL=0
FORCE_ALL=0
FULL_ALL=0
entry=""
name=""
script=""
skip_env=""
skip_value=""
install_mode=""
supports_full="0"
script_path=""
shared_cache_env=""
gvar_common=""
runtime_run_id=""
python_resolved=""
gpu_cache_seeded=0
args=()
# Optional per-step wall-clock limit (seconds; empty = unlimited). A step that
# fails or times out is skipped, reported, and retried on the next run.
PREREQ_STEP_TIMEOUT="${PYCORE_PREREQ_STEP_TIMEOUT_SECONDS:-}"
PREREQ_TIMEOUT_EXIT=124
PREREQ_KILLED_EXIT=137
LOCAL_AI_INSTALL_ENV=""
step_rc=0
SKIPPED_PREREQS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python)        PYTHON="$2";        shift 2 ;;
        --include)       INCLUDE+=("$2");     shift 2 ;;
        --whisper-model)
            WHISPER_MODEL="$2"
            [[ -n "$FASTER_WHISPER_MODEL" ]] || FASTER_WHISPER_MODEL="$2"
            shift 2
            ;;
        --faster-whisper-model) FASTER_WHISPER_MODEL="$2"; shift 2 ;;
        --vosk-model) VOSK_MODEL="$2"; shift 2 ;;
        --force)         FORCE_ALL=1;          shift   ;;
        --full)          FULL_ALL=1;           shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

# shellcheck source=/dev/null
source "$COMMON_DIR/venv_python_common.sh"
pycore_export_python_env_from_common "$PYTHON"

shared_cache_env="$COMMON_DIR/shared_cache_env.sh"
source "$shared_cache_env"
gvar_common="$COMMON_DIR/gvar_common.sh"
source "$gvar_common"

# Canonicalize the interpreter handed to every child installer: PATH "python3"
# may be a /usr/local/bin SYMLINK into the project venv, and a venv python
# invoked through an outside symlink never reads pyvenv.cfg (sys.prefix becomes
# /usr -> "No module named pip"). Prefer the real venv interpreter.
python_resolved="$(venv_python_from_common)"
if [ -n "$python_resolved" ] && [ -x "$python_resolved" ]; then
    PYTHON="$python_resolved"
fi
pycore_export_python_env_from_common "$PYTHON"
runtime_run_id="$(date +%s)_$$"
set_var "PYCORE_RUNTIME_STATE_RUN_ID" "$runtime_run_id" false
set_var "PYCORE_RUNTIME_STATE_PROCESS_ID" "$$" false

# shellcheck source=/dev/null
source "$COMMON_DIR/base_libs/cuda_index.sh"

# Run-scoped GPU/CUDA detection cache: probe ONCE and export the results so every
# later child installer (15 / whisper / TTS / the CPU-GPU guards ...) reuses them
# instead of re-spawning nvidia-smi / re-scanning sysfs on every cuda_policy_tag
# call. Seeded AFTER the cuda_policy entry because that step can add the nvidia-smi
# provider package or upgrade the driver mid-run. A child run STANDALONE finds these
# unset and detects on its own (lib_gpu.sh / cuda_index.sh fallback), so no script
# ever requires these variables.
seed_detection_cache() {
    if gpu_present; then PYCORE_GPU_PRESENT=1; else PYCORE_GPU_PRESENT=0; fi
    if gpu_hardware_present; then PYCORE_GPU_HARDWARE_PRESENT=1; else PYCORE_GPU_HARDWARE_PRESENT=0; fi
    PYCORE_CUDA_DRIVER_VERSION="$(cuda_driver_version)"
    PYCORE_CUDA_POLICY_TAG="$(cuda_policy_tag)"
    export PYCORE_GPU_PRESENT PYCORE_GPU_HARDWARE_PRESENT
    export PYCORE_CUDA_DRIVER_VERSION PYCORE_CUDA_DRIVER_VERSION_SET=1
    export PYCORE_CUDA_POLICY_TAG PYCORE_CUDA_POLICY_TAG_SET=1
    export PYCORE_CUDA_POLICY_TAG_SIG="${CORE_CUDA_TAG:-}|${PYTORCH_CUDA_INDEX_URL:-}|${PADDLE_CUDA_INDEX_URL:-}"
}

[[ "${NEURAL_TTS_INSTALL:-0}" == "1" ]] && NEURAL_BATCH_INSTALL=1
source "$COMMON_DIR/service_contract_common.sh"
LOCAL_AI_INSTALL_ENV="$(sc_get local_ai.install_env)"

# Order = dependency order. The ONE manifest is config/service_contract.json `prerequisites`
# (shared with Windows PycorePrerequisitesList.ps1 and pyutils/common/prerequisite_steps.py);
# rows are: key|script|skip environment variable|install mode|supports full.
PREREQ_ENTRIES=()
mapfile -t PREREQ_ENTRIES < <(python3 -c 'import json, sys
for step in json.load(open(sys.argv[1], encoding="utf-8"))["prerequisites"]["steps"]:
    for script in step["linux"]:
        print("|".join([step["id"], script, step["skip_env"], step["mode"], "1" if step["full"] else "0"]))' "$SERVICE_CONTRACT_FILE")
if [[ "${#PREREQ_ENTRIES[@]}" -eq 0 ]]; then
    echo "[!] prerequisite manifest unreadable (prerequisites.steps in $SERVICE_CONTRACT_FILE)." >&2
    exit 1
fi

in_include() {
    [[ ${#INCLUDE[@]} -eq 0 ]] && return 0
    local n
    for n in "${INCLUDE[@]}"; do [[ "$n" == "$1" ]] && return 0; done
    return 1
}

echo "------------------------------------------------------"
echo " Pycore prerequisites (prepare_pycore_prerequisites)"
echo "------------------------------------------------------"

for entry in "${PREREQ_ENTRIES[@]}"; do
    IFS='|' read -r name script skip_env install_mode supports_full <<< "$entry"

    if ! in_include "$name"; then
        echo "[skip] $name (not in --include)"
        continue
    fi

    # Local AI runtime (Ollama + translation model, GBs): opt-in on regular hosts,
    # enabled by default on notebook VMs (notebook_runtime.sh).
    if [[ "$install_mode" == "local_ai" && ${#INCLUDE[@]} -eq 0 ]]         && [[ -z "$LOCAL_AI_INSTALL_ENV" || "${!LOCAL_AI_INSTALL_ENV:-0}" != "1" ]]; then
        echo "[skip] $name (opt-in: $LOCAL_AI_INSTALL_ENV=1 or --include $name; default on Colab/Kaggle)"
        continue
    fi

    if [[ -n "$skip_env" ]]; then
        skip_value="${!skip_env:-0}"
        if [[ "$skip_value" == "1" ]]; then
            echo "[skip] $name ($skip_env=1)"
            continue
        fi
    fi

    echo "[..] Prerequisite: $name"
    script_path="$INSTALL_SHELLS_DIR/$script"
    args=(--python "$PYTHON")
    if [[ "$FORCE_ALL" -eq 1 ]]; then
        args+=(--force)
    fi
    if [[ "$name" == "whisper" && -n "$WHISPER_MODEL" ]]; then
        args+=(--model "$WHISPER_MODEL")
    fi
    if [[ "$name" == "faster_whisper" && -n "$FASTER_WHISPER_MODEL" ]]; then
        args+=(--model "$FASTER_WHISPER_MODEL")
    fi
    if [[ "$name" == "vosk" && -n "$VOSK_MODEL" ]]; then
        args+=(--model "$VOSK_MODEL")
    fi
    if [[ "$FULL_ALL" -eq 1 && "$supports_full" == "1" ]]; then
        args+=(--full)
    elif [[ "$NEURAL_BATCH_INSTALL" -eq 1 && "$install_mode" == "neural" && "$supports_full" == "1" ]]; then
        args+=(--full)
    elif [[ "${MELOTTS_INSTALL:-0}" == "1" && "$name" == "melotts" ]]; then
        args+=(--full)
    fi

    step_rc=0
    if [[ -n "$PREREQ_STEP_TIMEOUT" ]] && command -v timeout >/dev/null 2>&1; then
        timeout --kill-after=30 "$PREREQ_STEP_TIMEOUT" bash "$script_path" "${args[@]}" || step_rc=$?
    else
        bash "$script_path" "${args[@]}" || step_rc=$?
    fi
    if [[ -n "$PREREQ_STEP_TIMEOUT" && ( "$step_rc" -eq "$PREREQ_TIMEOUT_EXIT" || "$step_rc" -eq "$PREREQ_KILLED_EXIT" ) ]]; then
        echo "[skip] $name did not finish within ${PREREQ_STEP_TIMEOUT}s (exit $step_rc); skipped, retried on the next run."
        SKIPPED_PREREQS+=("$name (timeout)")
    elif [[ "$step_rc" -ne 0 ]]; then
        echo "[skip] $name could not be installed (exit $step_rc); skipped, retried on the next run."
        SKIPPED_PREREQS+=("$name (exit $step_rc)")
    fi
    if [[ "$name" == "cuda_policy" && "$gpu_cache_seeded" -eq 0 ]]; then
        seed_detection_cache
        gpu_cache_seeded=1
    fi
done

GUARD_DIR="$COMMON_DIR"
# --include runs may have filtered cuda_policy out; seed before the guard sweep so
# the four guards still inherit one shared probe instead of re-detecting each.
if [[ "$gpu_cache_seeded" -eq 0 ]]; then
    seed_detection_cache
    gpu_cache_seeded=1
fi
echo "[..] torch CPU/GPU guard (repair-only)"
TCG_REPAIR_ONLY=1 bash "$GUARD_DIR/torch_cpu_guard.sh" --python "$PYTHON"
echo "[..] onnxruntime CPU/GPU guard (repair-only)"
OCG_REPAIR_ONLY=1 bash "$GUARD_DIR/onnxruntime_cpu_guard.sh" --python "$PYTHON"
echo "[..] sherpa-onnx CPU/GPU guard (repair-only)"
SOG_REPAIR_ONLY=1 bash "$GUARD_DIR/sherpa_onnx_cpu_guard.sh" --python "$PYTHON"
echo "[..] paddle CPU/GPU guard (repair-only)"
PCG_REPAIR_ONLY=1 bash "$GUARD_DIR/paddle_cpu_guard.sh" --python "$PYTHON"

if [[ "${#SKIPPED_PREREQS[@]}" -gt 0 ]]; then
    echo "[!] Prerequisites skipped this run (${#SKIPPED_PREREQS[@]}): ${SKIPPED_PREREQS[*]}"
    echo "[OK] Remaining prerequisites complete."
else
    echo "[OK] All prerequisites complete."
fi
