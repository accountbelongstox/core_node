#!/bin/bash

# Variables
SERVICE_DIR=$(cat /usr/local/.pcore_local/deploy/.SERVICE_DIR)
PARENT_DIR=$(dirname "$(dirname "$(readlink -f "$0")")")

# Setup nginx configuration
nginx_conf_dir="${SERVICE_DIR}/conf/nginx"
nginx_template_dir="${PARENT_DIR}/template/nginx"
if [ ! -d "$nginx_conf_dir" ]; then
    sudo mkdir -p "$nginx_conf_dir"
    sudo cp -R "$nginx_template_dir/"* "$nginx_conf_dir/"
fi