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

# Parallel group: the local LLM stack (DeepSeek / DeepSeek-OCR / Qwen2.5 / NLLB-200). Each
# installer runs in its OWN live terminal (tmux pane / pop-up window) so their model
# DOWNLOADS overlap while the shared pip lock serializes their pip steps so the one venv is
# never corrupted. REUSES base_libs/parallel_terminals.sh (same engine as tts_parallel_install.sh).
#
# Tasks: 97_install_deepseek, 98_install_deepseek_ocr, 99_install_qwen25, 100_install_nllb200.
#
# CAVEAT — transformers version conflict (pre-existing in the stack, NOT created here): these
# pin DIFFERENT transformers (96 -> ==4.46.3; 97 -> >=4.37.0; 95/98 -> unpinned/--upgrade =
# latest 5.x). They share ONE venv, so only one version survives. The pip lock prevents
# write-corruption but NOT the version race: in PARALLEL the surviving version is
# nondeterministic (sequentially 98 ran last and won). 4.46.3 actually satisfies all four,
# but 95/98 pull newer. The cross-group mutex (parallel_terminals.sh) stops this group from
# running at the same time as the TTS group (whose MeloTTS/GPT-SoVITS pin 4.27.4).
#
# Usage:
#   llm_parallel_install.sh [--mode auto|windows|tmux|bg] [--dry-run]

PT_MODE="auto"
PT_DRY_RUN=0
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
# gvar/venv before `set -u` (they test bare vars like SHELLS_DIR — see 22's note).
source "$SCRIPT_DIR/../../common/gvar_common.sh"
source "$SCRIPT_DIR/../../common/venv_python_common.sh"
set -uo pipefail
PT_COMMON_DIR="$SCRIPT_DIR/../../common"
GROUP="LLM stack"
GROUP_SLUG="llm_parallel"
PT_RUN_GUARDS=1
PT_PYTHON=""
# Resolve + export ONE shared pip-lock path so every pane serializes on the same lock.
[ -f "$PT_COMMON_DIR/base_libs/pip_lock.sh" ] && . "$PT_COMMON_DIR/base_libs/pip_lock.sh"
export PIP_LOCK_FILE
# The reusable parallel engine (pt_add_task / pt_run).
. "$PT_COMMON_DIR/base_libs/parallel_terminals.sh"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode)    PT_MODE="$2";   shift 2 ;;
        --dry-run) PT_DRY_RUN=1;   shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

# The LLM installers each resolve the shared venv python themselves (VENV_PYTHON3); we only
# need a value for the post-phase guards.
if command -v venv_python_from_common >/dev/null 2>&1; then
    PT_PYTHON="$(venv_python_from_common)"
fi
command -v "$PT_PYTHON" >/dev/null 2>&1 || PT_PYTHON="python3"

# --- LLM stack task list (95-98; each script self-resolves the venv) --------- #
pt_add_task "deepseek"     "97_install_deepseek"     "bash '$SCRIPT_DIR/97_install_deepseek.sh'"
pt_add_task "deepseek-ocr" "98_install_deepseek_ocr" "bash '$SCRIPT_DIR/98_install_deepseek_ocr.sh'"
pt_add_task "qwen25"       "99_install_qwen25"       "bash '$SCRIPT_DIR/99_install_qwen25.sh'"
pt_add_task "nllb200"      "100_install_nllb200"      "bash '$SCRIPT_DIR/100_install_nllb200.sh'"

pt_run
exit 0
