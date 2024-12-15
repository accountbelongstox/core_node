#!/bin/bash
TMP_INFO_DIR="/usr/local/.pcore_local/deploy"
compose_yml=$(sudo cat "$TMP_INFO_DIR/.DOCKER_COMPOSE_FILE")

if [ -z "$compose_yml" ]; then
    echo "Error: docker-compose-yml output is empty."
    exit 1
fi

echo "docker-compose-yml: $compose_yml"
up_command="sudo docker-compose -f $compose_yml up -d"
echo "Docker-Up-CMD: $up_command"
$up_command
