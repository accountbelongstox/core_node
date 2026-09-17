#!/bin/bash
# apply_tts_docker_for_engine.sh <engine> <staging_dir>
# Unnumbered entry point (same role as ensure_docker_for_tts.sh): converges one
# engine's compose service from any caller - the linux model installers' docker
# branch, or the Windows WSL bridge via wsl.exe --exec with translated paths.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"

ENGINE="${1:-}"
STAGING="${2:-}"
if [[ -z "$ENGINE" || -z "$STAGING" ]]; then
    echo "[apply-tts-docker] usage: apply_tts_docker_for_engine.sh <engine> <staging_dir>" >&2
    exit 1
fi

# shellcheck source=../common/tts_docker_compose_common.sh
. "$COMMON_DIR/tts_docker_compose_common.sh"
tts_docker_apply_engine "$ENGINE" "$STAGING"
