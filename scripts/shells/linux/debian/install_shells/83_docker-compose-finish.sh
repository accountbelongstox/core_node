#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

SCRIPT_INDEX="83"

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Source global variables
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Check if Docker installation is enabled
START_DOCKER=$(get_var "START_DOCKER" "false")

# Check if Docker is installed
if ! command -v docker >/dev/null 2>&1; then
    echo "[83] Docker is not installed. Skipping Docker finish."
    exit 0
fi

# Check if Docker should be running
if [ "$START_DOCKER" != "true" ]; then
    echo "[83] Skipping Docker finish (START_DOCKER: $START_DOCKER)"
    exit 0
fi

# This chain only installs Docker; it no longer builds any images, so the old
# /usr/local/.pcore_local/deploy marker-file contract (.DOCKER_COMPOSE_SELECT
# and friends) and the docker_after service dispatch were removed. All that
# remains to "finish" is a healthy daemon: verify it, with one self-heal
# restart attempt when the unit is enabled but down.
if ! $USE_SUDO systemctl is-active --quiet docker.service 2>/dev/null; then
    if $USE_SUDO systemctl is-enabled --quiet docker.service 2>/dev/null; then
        echo "[83] Docker service is enabled but not active; attempting restart..."
        $USE_SUDO systemctl reset-failed docker.service 2>/dev/null || true
        $USE_SUDO systemctl restart docker 2>/dev/null || true
    fi
fi

if $USE_SUDO systemctl is-active --quiet docker.service 2>/dev/null; then
    echo "[83] Docker is installed and running: $(docker --version 2>/dev/null)"
    exit 0
fi

echo "[83] WARNING: Docker is installed but the daemon is not running. See: journalctl -xeu docker.service"
exit 1
