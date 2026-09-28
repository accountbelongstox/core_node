#!/bin/bash

# Pi and OMP coding harnesses (plus their Bun prerequisite). Thin delegate to
# install_shells/99_install_ai_tools.sh --only bun,pi,omp, the single source
# of truth for every AI CLI/tool (see common/ai_tools_catalog.sh).
#
# Historical bug fixed by this move: the settings-merge script path used to
# point at scripts/shells/linux/common/pi_harness_settings.js, which does not
# exist; the real file is scripts/shells/common/pi_harness_settings.js. The
# fixed path now lives in 99_install_ai_tools.sh (PI_HARNESS_SETTINGS_SCRIPT).

SCRIPT_INDEX="185"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[$SCRIPT_INDEX] ============================================================"
echo "[$SCRIPT_INDEX] Install Pi + OMP harnesses -> delegating to 99_install_ai_tools.sh --only bun,pi,omp"
echo "[$SCRIPT_INDEX] ============================================================"

bash "$SCRIPT_CURRENT_DIR/99_install_ai_tools.sh" --only bun,pi,omp
exit $?
