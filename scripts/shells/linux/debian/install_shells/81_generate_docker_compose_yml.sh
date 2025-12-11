#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
START_DOCKER=$(get_var "START_DOCKER" "false")
INSTALL_MODE=$(get_var "INSTALL_MODE")

# Check if Docker is installed
if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed. Skipping docker-compose generation."
    exit 0
fi

# Check if Docker should be running
if [ "$START_DOCKER" = "false" ]; then
    echo "START_DOCKER is false. Skipping docker-compose generation."
    echo "START_DOCKER: $START_DOCKER, INSTALL_MODE: $INSTALL_MODE"
    exit 0
fi

docker_compose_selector="$SHELLS_SCRIPTS_DIR/docker-compose-selector.js"
commande="node $docker_compose_selector"
echo "docker-compose-selector: $commande"
"$commande"
    





# echo "docker-compose-yml: $compose_yml"
# up_command="$USE_SUDO docker-compose -f $compose_yml up -d"
# echo "Docker-Up-CMD: $up_command"
# $up_command
