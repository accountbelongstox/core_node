#!/usr/bin/env bash
# Pycore prerequisite orchestrator (caller: pyservice.sh).
# Runs numbered install_shells in dependency order; scripts in that dir never call each other.
#
# Prerequisite chain (after 13_ensure_python / venv):
#   UI & system -> ffmpeg -> light pip -> OCR -> STT -> TTS -> neural TTS (opt-in) -> melotts (opt-in, last) -> device tools
#
# Install-time environment shielding (see development-guides/cross-docs/
# TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §7). Every installer is IDEMPOTENT and
# self-REPAIRING, so re-running this whole sweep preserves installed packages and repairs missing artifacts:
#   * Bucket A (deepseek/qwen25/nllb/bark): shares the installed transformers distribution
#     and delegates compatibility to pip only when the package is absent.
#   * Bucket B (qwen3tts, melotts, gptsovits): incompatible transformer dependencies stay out
#     of the main interpreter — each installs into a DEDICATED per-engine venv
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
args=()

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
runtime_run_id="$(date +%s)_$$"
set_var "PYCORE_RUNTIME_STATE_RUN_ID" "$runtime_run_id" false
set_var "PYCORE_RUNTIME_STATE_PROCESS_ID" "$$" false

[[ "${NEURAL_TTS_INSTALL:-0}" == "1" ]] && NEURAL_BATCH_INSTALL=1

# Order = dependency order (also matches numeric 103-116 after 15/22/23 in dd.sh sweep).
# Central prerequisite manifest: key|script|skip environment variable|install mode|supports full.
PREREQ_ENTRIES=(
    "cuda_policy|13_cuda_nvidia_prereq.sh|||0"
    "python_prereqs|14_install_python_prereq_packages.sh|||0"
    "desktop_manager|104_install_desktop_manager.sh|||0"
    "launcher|105_install_launcher.sh|||0"
    "ffmpeg|103_install_ffmpeg.sh|||0"
    "document_parsing|106_install_document_parsing.sh|||0"
    "dictionaries|107_install_dictionaries.sh|||0"
    "ocr|108_install_ocr.sh|||0"
    "faster_whisper|15_install_faster_whisper.sh|||0"
    "whisper|109_install_whisper.sh|||0"
    "vosk|110_install_vosk.sh|||0"
    "edge_tts|22_install_edge_tts.sh|||0"
    "chattts|111_install_chattts.sh|CHATTTS_SKIP|neural|1"
    "cosyvoice|112_install_cosyvoice.sh|COSYVOICE_SKIP|neural|1"
    "fishspeech|117_install_fishspeech.sh|FISHSPEECH_SKIP|neural|1"
    "kokoro|118_install_kokoro.sh|KOKORO_SKIP|neural|0"
    "voxcpm2|119_install_voxcpm2.sh|VOXCPM2_SKIP|neural|1"
    "bark|116_install_bark.sh|BARK_SKIP|neural|1"
    "parler|139_install_parler.sh|PARLER_SKIP|neural|1"
    "qwen3tts|140_install_qwen3tts.sh|QWEN3TTS_SKIP|neural|1"
    "f5tts|113_install_f5tts.sh|F5TTS_SKIP|neural|1"
    "gptsovits|114_install_gptsovits.sh|GPTSOVITS_SKIP|explicit|1"
    "melotts|115_install_melotts.sh|MELOTTS_SKIP|explicit|1"
    "device_tools|120_install_device_tools.sh|||0"
)

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

    bash "$script_path" "${args[@]}"
done

GUARD_DIR="$COMMON_DIR"
echo "[..] torch CPU/GPU guard (repair-only)"
TCG_REPAIR_ONLY=1 bash "$GUARD_DIR/torch_cpu_guard.sh" --python "$PYTHON"
echo "[..] onnxruntime CPU/GPU guard (repair-only)"
OCG_REPAIR_ONLY=1 bash "$GUARD_DIR/onnxruntime_cpu_guard.sh" --python "$PYTHON"
echo "[..] sherpa-onnx CPU/GPU guard (repair-only)"
SOG_REPAIR_ONLY=1 bash "$GUARD_DIR/sherpa_onnx_cpu_guard.sh" --python "$PYTHON"
echo "[..] paddle CPU/GPU guard (repair-only)"
PCG_REPAIR_ONLY=1 bash "$GUARD_DIR/paddle_cpu_guard.sh" --python "$PYTHON"

echo "[OK] All prerequisites complete."
