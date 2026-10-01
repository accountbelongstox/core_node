#!/bin/bash
# docker_model_runner.sh <ensure|up|test|down|status> <model> [staging_dir]
# Unnumbered entry point for one Docker model (scripts/shells/docker_compose/tts/<model>/model.sh):
#   ensure  Docker Engine + compose, image (built only when missing or stale),
#           weights and an import check; never starts the service container.
#   up      start the service from the existing image (never builds).
#   test    pre-flight, up, health, model smoke, then down (always).
#   down    stop and remove the model's container; image and staging are kept.
#   status  read-only report.
# Callers: the Linux model installers (139/143 docker branch), the
# apply_tts_docker_for_engine.sh wrapper and the Windows bridge
# (DockerWslBridge.ps1 Invoke-DockerModelRunner via wsl.exe --exec, which passes
# the translated staging path). The default staging is
# ${CORE_NODE_CACHE_DIR}/pycore/<model>. Prints exactly one line
# "[docker-model] RESULT <action> <model> PASS|FAIL|SKIP <reason>"; the exit
# status only signals PASS (0) or not (1).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(cd "$SCRIPT_DIR/../../common" && pwd)"
ACTION="${1:-}"
MODEL="${2:-}"
STAGING="${3:-}"

. "$COMMON_DIR/shared_cache_env.sh"
# shellcheck source=../../common/tts_docker_compose_common.sh
. "$COMMON_DIR/tts_docker_compose_common.sh"

if tts_docker_run_action "$ACTION" "$MODEL" "$STAGING"; then
    exit 0
fi
exit 1
