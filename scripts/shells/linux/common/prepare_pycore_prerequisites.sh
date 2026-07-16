#!/usr/bin/env bash
# Pycore prerequisite orchestrator (caller: pyservice.sh).
# Runs numbered install_shells in dependency order; scripts in that dir never call each other.
#
# Prerequisite chain (after 13_ensure_python / venv):
#   UI & system -> ffmpeg -> light pip -> OCR -> STT -> TTS -> neural TTS (opt-in) -> melotts (opt-in, last) -> device tools
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
PREREQ_SCRIPTS=(
    "104_install_desktop_manager.sh"
    "105_install_launcher.sh"
    "103_install_ffmpeg.sh"
    "106_install_document_parsing.sh"
    "107_install_dictionaries.sh"
    "108_install_ocr.sh"
    "15_install_faster_whisper.sh"
    "109_install_whisper.sh"
    "110_install_vosk.sh"
    "22_install_edge_tts.sh"
    "111_install_chattts.sh"
    "112_install_cosyvoice.sh"
    "117_install_fishspeech.sh"
    "118_install_kokoro.sh"
    "119_install_voxcpm2.sh"
    "116_install_bark.sh"
    "139_install_parler.sh"
    "140_install_qwen3tts.sh"
    "113_install_f5tts.sh"
    "114_install_gptsovits.sh"
    "115_install_melotts.sh"
    "120_install_device_tools.sh"
)

PREREQ_KEYS=(
    "desktop_manager"
    "launcher"
    "ffmpeg"
    "document_parsing"
    "dictionaries"
    "ocr"
    "faster_whisper"
    "whisper"
    "vosk"
    "edge_tts"
    "chattts"
    "cosyvoice"
    "fishspeech"
    "kokoro"
    "voxcpm2"
    "bark"
    "parler"
    "qwen3tts"
    "f5tts"
    "gptsovits"
    "melotts"
    "device_tools"
)

in_include() {
    [[ ${#INCLUDE[@]} -eq 0 ]] && return 0
    local n
    for n in "${INCLUDE[@]}"; do [[ "$n" == "$1" ]] && return 0; done
    return 1
}

is_neural_key() {
    case "$1" in
        chattts|cosyvoice|f5tts|gptsovits|fishspeech|kokoro|voxcpm2|bark|parler|qwen3tts) return 0 ;;
        *) return 1 ;;
    esac
}

echo "------------------------------------------------------"
echo " Pycore prerequisites (prepare_pycore_prerequisites)"
echo "------------------------------------------------------"

idx=0
for script in "${PREREQ_SCRIPTS[@]}"; do
    name="${PREREQ_KEYS[$idx]}"
    idx=$((idx + 1))

    if ! in_include "$name"; then
        echo "[skip] $name (not in --include)"
        continue
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
    if [[ "$NEURAL_BATCH_INSTALL" -eq 1 ]] && is_neural_key "$name"; then
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
    exit 0
fi

echo "[OK] All prerequisites complete."
exit 0
