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

 从ubuntu转为centos7的脚本，注意是centos7，不是centos9,支持的软件也要降为合适centos7的对应版本，以免出错。