#!/bin/bash
# apply_tts_docker_for_engine.sh <engine> [staging_dir]
# Thin wrapper: docker_model_runner.sh ensure, then up, for one engine. Each
# runner call prints its own RESULT line; the exit status only signals success.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="$SCRIPT_DIR/docker_model_runner.sh"
ENGINE="${1:-}"
STAGING="${2:-}"

if [[ -z "$ENGINE" ]]; then
    echo "[apply-tts-docker] usage: apply_tts_docker_for_engine.sh <engine> [staging_dir]" >&2
    exit 1
fi
bash "$RUNNER" ensure "$ENGINE" "$STAGING" || exit 1
bash "$RUNNER" up "$ENGINE" "$STAGING" || exit 1
exit 0
