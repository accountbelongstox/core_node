#!/bin/bash

# Qwen Code (qwen CLI) installation. Official Alibaba/QwenLM coding agent CLI.
# Thin delegate to install_shells/99_install_ai_tools.sh --only qwen, the
# single source of truth for every AI CLI (see common/ai_tools_catalog.sh).
#
# Historical note: this step used to run its own npm-install logic with a
# top-level `return` (invalid outside a function when this script runs as a
# child process, e.g. via install_test_menu.sh) which silently failed to skip
# and reinstalled @qwen-code/qwen-code on every run. The fixed logic now lives
# in 99_install_ai_tools.sh's ai99_ensure_qwen() function, where `return` is
# valid and idempotency actually works.

SCRIPT_INDEX="177"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[$SCRIPT_INDEX] ============================================================"
echo "[$SCRIPT_INDEX] Install Qwen Code -> delegating to 99_install_ai_tools.sh --only qwen"
echo "[$SCRIPT_INDEX] ============================================================"

bash "$SCRIPT_CURRENT_DIR/99_install_ai_tools.sh" --only qwen
exit $?
