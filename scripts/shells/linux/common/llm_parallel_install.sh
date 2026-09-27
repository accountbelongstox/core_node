#!/bin/bash

# OPTIONAL parallel driver (linux/common). Invoked manually - not part of install_shells sweep.

PT_MODE="auto"
PT_DRY_RUN=0
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
REPO_ROOT=""
INSTALL_SHELLS_DIR=""
PT_COMMON_DIR="$SCRIPT_DIR"
GROUP="LLM stack"
GROUP_SLUG="llm_parallel"
PT_RUN_GUARDS=1
PT_PYTHON=""

source "$SCRIPT_DIR/gvar_common.sh"
source "$SCRIPT_DIR/venv_python_common.sh"
set -uo pipefail

. "$PT_COMMON_DIR/base_libs/pip_lock.sh"
export PIP_LOCK_FILE
. "$PT_COMMON_DIR/base_libs/parallel_terminals.sh"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode)    PT_MODE="$2";   shift 2 ;;
        --dry-run) PT_DRY_RUN=1;   shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

PT_PYTHON="$(venv_python_from_common)"

if [[ -n "${CORE_NODE_PROJECT_ROOT:-}" && -d "$CORE_NODE_PROJECT_ROOT/scripts/shells/linux/debian/install_shells" ]]; then
    REPO_ROOT="$CORE_NODE_PROJECT_ROOT"
else
    REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
fi
INSTALL_SHELLS_DIR="$REPO_ROOT/scripts/shells/linux/debian/install_shells"

pt_add_task "deepseek"     "96_install_deepseek"     "bash '$INSTALL_SHELLS_DIR/105_install_deepseek.sh'"
pt_add_task "deepseek-ocr" "97_install_deepseek_ocr" "bash '$INSTALL_SHELLS_DIR/107_install_deepseek_ocr.sh'"
pt_add_task "qwen25"       "98_install_qwen25"       "bash '$INSTALL_SHELLS_DIR/109_install_qwen25.sh'"
pt_add_task "nllb200"      "99_install_nllb200"      "bash '$INSTALL_SHELLS_DIR/111_install_nllb200.sh'"

pt_run
exit 0
