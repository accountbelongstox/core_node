#!/bin/bash
# ensure_docker_for_tts.sh <engine> - Unnumbered dispatch entry for the docker
# ensure chain. Used by:
#   * model install steps (indirectly, via common/docker_prereq_common.sh), and
#   * the Windows WSL bridge (win_common/DockerWslBridge.ps1), which runs this
#     entry inside the managed WSL distro so the SAME numbered chain converges
#     the in-WSL Docker Engine (wsl_engine provider).
# Force-enables START_DOCKER (the [^] Start Docker After Installation toggle)
# for the requesting engine, then runs 79_install_docker.sh per-component and
# verifies the compose plugin. Exit 0 = docker platform ready, 1 = failed
# (the failing phase reports its own concrete reason upstream).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE="${1:-}"

. "$SCRIPT_DIR/../../common/gvar_common.sh"
. "$SCRIPT_DIR/../../common/docker_prereq_common.sh"

if [[ -z "$ENGINE" ]]; then
    echo "[ensure-docker] usage: ensure_docker_for_tts.sh <engine>" >&2
    exit 1
fi

docker_prereq_ensure_for_engine "$ENGINE" "$SCRIPT_DIR"
