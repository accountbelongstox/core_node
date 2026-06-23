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

# Parallel group: the TTS/STT engine collection. Each engine runs in its OWN live terminal
# (tmux pane / pop-up window) so model DOWNLOADS overlap while the shared pip lock serializes
# their pip steps. The generic machinery lives in base_libs/parallel_terminals.sh (REUSED by
# the LLM group, llm_parallel_install.sh) — this file only declares the TTS task list.
#
# Default engines (conflict-free): sherpa-core (22 --core-only), edge-tts, faster-whisper,
# openai-whisper, vosk, azure-sdk. OPT-IN (old-transformers conflict): --melotts / --gptsovits.
#
# Usage:
#   tts_parallel_install.sh [--python <py>] [--mode auto|windows|tmux|bg]
#                           [--melotts] [--gptsovits] [--force] [--dry-run]

PYTHON="python3"
PT_MODE="auto"
MELOTTS=0
GPTSOVITS=0
FORCE=0
PT_DRY_RUN=0
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
# gvar/venv before `set -u` (they test bare vars like SHELLS_DIR — see 22's note).
source "$SCRIPT_DIR/../../common/gvar_common.sh"
source "$SCRIPT_DIR/../../common/venv_python_common.sh"
set -uo pipefail
PT_COMMON_DIR="$SCRIPT_DIR/../../common"
GROUP="TTS/STT"
GROUP_SLUG="tts_parallel"
PT_RUN_GUARDS=1
PT_PYTHON=""
REPO_ROOT=""
INISCRIPTS_DIR=""
FORCE_ARG=""
# Resolve + export ONE shared pip-lock path so every pane serializes on the same lock.
[ -f "$PT_COMMON_DIR/base_libs/pip_lock.sh" ] && . "$PT_COMMON_DIR/base_libs/pip_lock.sh"
export PIP_LOCK_FILE
# The reusable parallel engine (pt_add_task / pt_run).
. "$PT_COMMON_DIR/base_libs/parallel_terminals.sh"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python)    PYTHON="$2";    shift 2 ;;
        --mode)      PT_MODE="$2";   shift 2 ;;
        --melotts)   MELOTTS=1;      shift   ;;
        --gptsovits) GPTSOVITS=1;    shift   ;;
        --force)     FORCE=1;        shift   ;;
        --dry-run)   PT_DRY_RUN=1;   shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

# Resolve interpreter + the (relocated) iniscripts dir, resilient to the move.
if [[ "$PYTHON" == "python3" ]] && command -v venv_python_from_common >/dev/null 2>&1; then
    PYTHON="$(venv_python_from_common)"
fi
command -v "$PYTHON" >/dev/null 2>&1 || PYTHON="python3"
PT_PYTHON="$PYTHON"
if [[ -n "${CORE_NODE_PROJECT_ROOT:-}" && -d "$CORE_NODE_PROJECT_ROOT/scripts/shells/linux/common/iniscripts" ]]; then
    REPO_ROOT="$CORE_NODE_PROJECT_ROOT"
else
    REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
fi
if [[ -d "$REPO_ROOT/scripts/shells/linux/common/iniscripts" ]]; then
    INISCRIPTS_DIR="$REPO_ROOT/scripts/shells/linux/common/iniscripts"
else
    INISCRIPTS_DIR="$REPO_ROOT/pycore/scripts/iniscripts"
fi
[[ "$FORCE" -eq 1 ]] && FORCE_ARG="--force"

# --- TTS/STT task list ------------------------------------------------------- #
pt_add_task "sherpa-core"     "22 --core-only"            "bash '$SCRIPT_DIR/22_install_tts_offline.sh' --core-only --python '$PYTHON' $FORCE_ARG"
pt_add_task "edge-tts"        "21_install_edge_tts"       "bash '$SCRIPT_DIR/21_install_edge_tts.sh' --python '$PYTHON' $FORCE_ARG"
pt_add_task "faster-whisper"  "14_install_faster_whisper" "bash '$SCRIPT_DIR/14_install_faster_whisper.sh' --python '$PYTHON' $FORCE_ARG"
pt_add_task "openai-whisper"  "install_whisper"           "bash '$INISCRIPTS_DIR/install_whisper.sh' --python '$PYTHON' $FORCE_ARG"
pt_add_task "vosk"            "install_vosk"              "bash '$INISCRIPTS_DIR/install_vosk.sh' --python '$PYTHON' $FORCE_ARG"
pt_add_task "azure-sdk"       "pip azure-speech"          ". '$PT_COMMON_DIR/base_libs/pip_lock.sh' 2>/dev/null || true; if ! command -v vpip >/dev/null 2>&1; then vpip(){ \"\$@\"; }; fi; vpip '$PYTHON' -m pip install --upgrade azure-cognitiveservices-speech"
[[ "$MELOTTS" -eq 1 ]]   && pt_add_task "melotts"   "install_melotts --full"   "bash '$INISCRIPTS_DIR/install_melotts.sh' --python '$PYTHON' --full $FORCE_ARG"
[[ "$GPTSOVITS" -eq 1 ]] && pt_add_task "gptsovits" "install_gptsovits --full" "bash '$INISCRIPTS_DIR/install_gptsovits.sh' --python '$PYTHON' --full $FORCE_ARG"

pt_run
exit 0
