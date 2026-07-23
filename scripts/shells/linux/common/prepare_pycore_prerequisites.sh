#!/usr/bin/env bash
# Pycore prerequisite orchestrator (caller: pyservice.sh).
# Runs numbered install_shells in dependency order; scripts in that dir never call each other.
#
# Prerequisite chain (after 13_ensure_python / venv):
#   UI & system -> ffmpeg -> light pip -> OCR -> STT -> TTS -> neural TTS (opt-in) -> melotts (opt-in, last) -> device tools
#
# Install-time environment shielding (see development-guides/cross-docs/
# TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §7). Every installer is IDEMPOTENT and
# self-REPAIRING, so re-running this whole sweep is always safe and heals drift:
#   * Bucket A (deepseek/qwen25/nllb/bark): SHARE one pinned transformers
#     ($LLM_TRANSFORMERS_SPEC) in the main interpreter — installed version-idempotently,
#     NEVER --upgrade (that is the race that clobbers the shared pin).
#   * Bucket B (qwen3tts, melotts, gptsovits): INCOMPATIBLE transformers pins are kept OUT
#     of the main interpreter — each installs into a DEDICATED per-engine venv
#     (qwen3tts via qwen3tts_venv.ensure_venv; melotts/gptsovits via isolated_venv.ensure_venv),
#     built --system-site-packages so it reuses the system CUDA torch and self-rebuilds on a
#     broken import; the pinned transformers never touches the shared interpreter. melotts and
#     gptsovits keep an explicit --full opt-in only because the venv build + model download is
#     heavy (an already-built venv is still maintained + self-repaired on every sweep).
#   Sentinels (.deps_done / .model_installed) gate re-work; weight verification re-downloads
#   incomplete files; a version-idempotent transformers install self-heals a clobbered pin.
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
NEURAL_BATCH_INSTALL=0
failed=()
entry=""
name=""
script=""
skip_env=""
skip_value=""
install_mode=""
script_path=""
args=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python)        PYTHON="$2";        shift 2 ;;
        --include)       INCLUDE+=("$2");     shift 2 ;;
        --whisper-model) WHISPER_MODEL="$2";  shift 2 ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

# shellcheck source=/dev/null
source "$COMMON_DIR/venv_python_common.sh" 2>/dev/null || true
if type pycore_export_python_env_from_common >/dev/null 2>&1; then
    pycore_export_python_env_from_common "$PYTHON"
fi

__scc_env="$COMMON_DIR/shared_cache_env.sh"
[[ -f "$__scc_env" ]] && source "$__scc_env"

[[ "${NEURAL_TTS_INSTALL:-0}" == "1" ]] && NEURAL_BATCH_INSTALL=1

# Order = dependency order (also matches numeric 103-116 after 15/22/23 in dd.sh sweep).
# Central prerequisite manifest: key|script|skip environment variable|install mode.
PREREQ_ENTRIES=(
    "cuda_policy|13_cuda_nvidia_prereq.sh||"
    "python_prereqs|14_install_python_prereq_packages.sh||"
    "desktop_manager|104_install_desktop_manager.sh||"
    "launcher|105_install_launcher.sh||"
    "ffmpeg|103_install_ffmpeg.sh||"
    "document_parsing|106_install_document_parsing.sh||"
    "dictionaries|107_install_dictionaries.sh||"
    "ocr|108_install_ocr.sh||"
    "faster_whisper|15_install_faster_whisper.sh||"
    "whisper|109_install_whisper.sh||"
    "vosk|110_install_vosk.sh||"
    "edge_tts|22_install_edge_tts.sh||"
    "chattts|111_install_chattts.sh|CHATTTS_SKIP|neural"
    "cosyvoice|112_install_cosyvoice.sh|COSYVOICE_SKIP|neural"
    "fishspeech|117_install_fishspeech.sh|FISHSPEECH_SKIP|neural"
    "kokoro|118_install_kokoro.sh|KOKORO_SKIP|neural"
    "voxcpm2|119_install_voxcpm2.sh|VOXCPM2_SKIP|neural"
    "bark|116_install_bark.sh|BARK_SKIP|neural"
    "parler|139_install_parler.sh|PARLER_SKIP|neural"
    "qwen3tts|140_install_qwen3tts.sh|QWEN3TTS_SKIP|neural"
    "f5tts|113_install_f5tts.sh|F5TTS_SKIP|neural"
    "gptsovits|114_install_gptsovits.sh|GPTSOVITS_SKIP|explicit"
    "melotts|115_install_melotts.sh|MELOTTS_SKIP|explicit"
    "device_tools|120_install_device_tools.sh||"
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
    IFS='|' read -r name script skip_env install_mode <<< "$entry"

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
    if [[ ! -s "$script_path" ]]; then
        echo "[!] $name missing: $script_path"
        failed+=("$name")
        continue
    fi

    args=(--python "$PYTHON")
    if [[ ( "$name" == "whisper" || "$name" == "faster_whisper" ) && -n "$WHISPER_MODEL" ]]; then
        args+=(--model "$WHISPER_MODEL")
    fi
    if [[ "$NEURAL_BATCH_INSTALL" -eq 1 && "$install_mode" == "neural" ]]; then
        args+=(--full)
    elif [[ "${MELOTTS_INSTALL:-0}" == "1" && "$name" == "melotts" ]]; then
        args+=(--full)
    fi

    if ! bash "$script_path" "${args[@]}"; then
        echo "[!] $name did not complete cleanly."
        failed+=("$name")
    fi
done

GUARD_DIR="$COMMON_DIR"
if [[ -f "$GUARD_DIR/torch_cpu_guard.sh" ]]; then
    echo "[..] torch CPU/GPU guard (repair-only)"
    TCG_REPAIR_ONLY=1 bash "$GUARD_DIR/torch_cpu_guard.sh" --python "$PYTHON" || true
fi
if [[ -f "$GUARD_DIR/onnxruntime_cpu_guard.sh" ]]; then
    echo "[..] onnxruntime CPU/GPU guard (repair-only)"
    OCG_REPAIR_ONLY=1 bash "$GUARD_DIR/onnxruntime_cpu_guard.sh" --python "$PYTHON" || true
fi
if [[ -f "$GUARD_DIR/sherpa_onnx_cpu_guard.sh" ]]; then
    echo "[..] sherpa-onnx CPU/GPU guard (repair-only)"
    SOG_REPAIR_ONLY=1 bash "$GUARD_DIR/sherpa_onnx_cpu_guard.sh" --python "$PYTHON" || true
fi
if [[ -f "$GUARD_DIR/paddle_cpu_guard.sh" ]]; then
    echo "[..] paddle CPU/GPU guard (repair-only)"
    PCG_REPAIR_ONLY=1 bash "$GUARD_DIR/paddle_cpu_guard.sh" --python "$PYTHON" || true
fi

if [[ ${#failed[@]} -gt 0 ]]; then
    echo "[!] Some prerequisites did not complete cleanly: ${failed[*]}"
    exit 1
fi

echo "[OK] All prerequisites complete."
exit 0
