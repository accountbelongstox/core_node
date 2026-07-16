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

# OPTIONAL parallel driver (lives under linux/common, NOT in the numbered install_shells sweep).
# Invoked manually when overlapping downloads are wanted. Each task runs a single
# self-contained install_shells script; numbered scripts never call this file.
#
# Usage:
#   scripts/shells/linux/common/tts_parallel_install.sh [--python <py>] [--mode auto|windows|tmux|bg]
#                           [--melotts] [--gptsovits] [--chattts] [--cosyvoice] [--f5tts]
#                           [--fishspeech] [--kokoro] [--voxcpm2] [--bark] [--parler] [--qwen3tts] [--force] [--dry-run]

PYTHON="python3"
PT_MODE="auto"
MELOTTS=0
GPTSOVITS=0
CHATTTS=0
COSYVOICE=0
F5TTS=0
FISHSPEECH=0
KOKORO=0
VOXCPM2=0
BARK=0
PARLER=0
QWEN3TTS=0
FORCE=0
PT_DRY_RUN=0
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
REPO_ROOT=""
INSTALL_SHELLS_DIR=""
FORCE_ARG=""
PT_COMMON_DIR="$SCRIPT_DIR"
GROUP="TTS/STT"
GROUP_SLUG="tts_parallel"
PT_RUN_GUARDS=1
PT_PYTHON=""

source "$SCRIPT_DIR/gvar_common.sh"
source "$SCRIPT_DIR/venv_python_common.sh"
set -uo pipefail

[ -f "$PT_COMMON_DIR/base_libs/pip_lock.sh" ] && . "$PT_COMMON_DIR/base_libs/pip_lock.sh"
export PIP_LOCK_FILE
. "$PT_COMMON_DIR/base_libs/parallel_terminals.sh"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python)    PYTHON="$2";    shift 2 ;;
        --mode)      PT_MODE="$2";   shift 2 ;;
        --melotts)   MELOTTS=1;      shift   ;;
        --gptsovits) GPTSOVITS=1;    shift   ;;
        --chattts)   CHATTTS=1;      shift   ;;
        --cosyvoice) COSYVOICE=1;    shift   ;;
        --f5tts)     F5TTS=1;        shift   ;;
        --fishspeech) FISHSPEECH=1;  shift   ;;
        --kokoro)    KOKORO=1;       shift   ;;
        --voxcpm2)   VOXCPM2=1;      shift   ;;
        --bark)      BARK=1;         shift   ;;
        --parler)    PARLER=1;       shift   ;;
        --qwen3tts)  QWEN3TTS=1;     shift   ;;
        --force)     FORCE=1;        shift   ;;
        --dry-run)   PT_DRY_RUN=1;   shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

if [[ "$PYTHON" == "python3" ]] && command -v venv_python_from_common >/dev/null 2>&1; then
    PYTHON="$(venv_python_from_common)"
fi
command -v "$PYTHON" >/dev/null 2>&1 || PYTHON="python3"
PT_PYTHON="$PYTHON"

if [[ -n "${CORE_NODE_PROJECT_ROOT:-}" && -d "$CORE_NODE_PROJECT_ROOT/scripts/shells/linux/debian/install_shells" ]]; then
    REPO_ROOT="$CORE_NODE_PROJECT_ROOT"
else
    REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
fi
INSTALL_SHELLS_DIR="$REPO_ROOT/scripts/shells/linux/debian/install_shells"
[[ "$FORCE" -eq 1 ]] && FORCE_ARG="--force"

pt_add_task "sherpa-core"     "23_install_tts_offline"    "bash '$INSTALL_SHELLS_DIR/23_install_tts_offline.sh' --python '$PYTHON' $FORCE_ARG"
pt_add_task "edge-tts"        "22_install_edge_tts"       "bash '$INSTALL_SHELLS_DIR/22_install_edge_tts.sh' --python '$PYTHON' $FORCE_ARG"
pt_add_task "faster-whisper"  "15_install_faster_whisper" "bash '$INSTALL_SHELLS_DIR/15_install_faster_whisper.sh' --python '$PYTHON' $FORCE_ARG"
pt_add_task "openai-whisper"  "109_install_whisper"       "bash '$INSTALL_SHELLS_DIR/109_install_whisper.sh' --python '$PYTHON' $FORCE_ARG"
pt_add_task "vosk"            "110_install_vosk"          "bash '$INSTALL_SHELLS_DIR/110_install_vosk.sh' --python '$PYTHON' $FORCE_ARG"
pt_add_task "azure-sdk"       "pip azure-speech"          ". '$PT_COMMON_DIR/base_libs/pip_lock.sh' 2>/dev/null || true; if ! command -v vpip >/dev/null 2>&1; then vpip(){ \"\$@\"; }; fi; vpip '$PYTHON' -m pip install --upgrade azure-cognitiveservices-speech"
[[ "$MELOTTS" -eq 1 ]]   && pt_add_task "melotts"   "115_install_melotts"   "bash '$INSTALL_SHELLS_DIR/115_install_melotts.sh' --python '$PYTHON' --full $FORCE_ARG"
[[ "$GPTSOVITS" -eq 1 ]] && pt_add_task "gptsovits" "114_install_gptsovits" "bash '$INSTALL_SHELLS_DIR/114_install_gptsovits.sh' --python '$PYTHON' --full $FORCE_ARG"
[[ "$CHATTTS" -eq 1 ]]   && pt_add_task "chattts"   "111_install_chattts"   "bash '$INSTALL_SHELLS_DIR/111_install_chattts.sh' --python '$PYTHON' --full $FORCE_ARG"
[[ "$COSYVOICE" -eq 1 ]] && pt_add_task "cosyvoice" "112_install_cosyvoice" "bash '$INSTALL_SHELLS_DIR/112_install_cosyvoice.sh' --python '$PYTHON' --full $FORCE_ARG"
[[ "$FISHSPEECH" -eq 1 ]] && pt_add_task "fishspeech" "117_install_fishspeech" "bash '$INSTALL_SHELLS_DIR/117_install_fishspeech.sh' --python '$PYTHON' --full $FORCE_ARG"
[[ "$KOKORO" -eq 1 ]]    && pt_add_task "kokoro"    "118_install_kokoro"    "bash '$INSTALL_SHELLS_DIR/118_install_kokoro.sh' --python '$PYTHON' --full $FORCE_ARG"
[[ "$VOXCPM2" -eq 1 ]]   && pt_add_task "voxcpm2"   "119_install_voxcpm2"   "bash '$INSTALL_SHELLS_DIR/119_install_voxcpm2.sh' --python '$PYTHON' --full $FORCE_ARG"
[[ "$BARK" -eq 1 ]]      && pt_add_task "bark"      "116_install_bark"      "bash '$INSTALL_SHELLS_DIR/116_install_bark.sh' --python '$PYTHON' --full $FORCE_ARG"
[[ "$PARLER" -eq 1 ]]    && pt_add_task "parler"    "139_install_parler"    "bash '$INSTALL_SHELLS_DIR/139_install_parler.sh' --python '$PYTHON' --full $FORCE_ARG"
[[ "$QWEN3TTS" -eq 1 ]]  && pt_add_task "qwen3tts"  "140_install_qwen3tts"  "bash '$INSTALL_SHELLS_DIR/140_install_qwen3tts.sh' --python '$PYTHON' --full $FORCE_ARG"
[[ "$F5TTS" -eq 1 ]]     && pt_add_task "f5tts"     "113_install_f5tts"     "bash '$INSTALL_SHELLS_DIR/113_install_f5tts.sh' --python '$PYTHON' --full $FORCE_ARG"

pt_run
exit 0
