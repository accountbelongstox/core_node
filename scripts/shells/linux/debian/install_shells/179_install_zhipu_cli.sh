#!/bin/bash

# Zhipu publishes a Python SDK but no first-party CLI binary. Thin delegate to
# install_shells/99_install_ai_tools.sh --only zhipuai, the single source of
# truth for every AI CLI/SDK (see common/ai_tools_catalog.sh).

SCRIPT_INDEX="179"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[$SCRIPT_INDEX] ============================================================"
echo "[$SCRIPT_INDEX] Install Zhipu AI SDK -> delegating to 99_install_ai_tools.sh --only zhipuai"
echo "[$SCRIPT_INDEX] ============================================================"

bash "$SCRIPT_CURRENT_DIR/99_install_ai_tools.sh" --only zhipuai
exit $?
