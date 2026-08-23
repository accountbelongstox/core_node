#!/bin/bash

SERVICE_MANAGER_REGISTRY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_MANAGER_REGISTRY_LINUX_DIR="$(dirname "$SERVICE_MANAGER_REGISTRY_DIR")"
SERVICE_MANAGER_REGISTRY_SHELLS_DIR="$(dirname "$SERVICE_MANAGER_REGISTRY_LINUX_DIR")"
SERVICE_MANAGER_REGISTRY_SCRIPTS_DIR="$(dirname "$SERVICE_MANAGER_REGISTRY_SHELLS_DIR")"
SERVICE_MANAGER_REPO_ROOT="$(dirname "$SERVICE_MANAGER_REGISTRY_SCRIPTS_DIR")"
SERVICE_MANAGER_INSTALL_SHELLS_DIR="$SERVICE_MANAGER_REGISTRY_LINUX_DIR/debian/install_shells"
SERVICE_MANAGER_SERVER_MANAGER_DIR="$SERVICE_MANAGER_REGISTRY_LINUX_DIR/debian/server_manager"
SERVICE_MANAGER_LARAVEL_DIR="$SERVICE_MANAGER_REPO_ROOT/poly_apps/laravel_main"
SERVICE_MANAGER_LARAVEL_START_SCRIPT="$SERVICE_MANAGER_LARAVEL_DIR/scripts/start.sh"
SERVICE_MANAGER_UNIFIED_MANAGER_SCRIPT="$SERVICE_MANAGER_REPO_ROOT/scripts/unified_manager/unified_manager.sh"
LARAVEL_SERVICE_PATTERN="ncore-laravel\|app-manager-laravel\|octane-.*"
SERVICES=("redis" "postgresql" "docker" "mysql" "nginx" "ssh" "pycore" "laravel" "unified_apps" "core_services")

declare -A SERVICE_NAME
declare -A SERVICE_SYSTEMD
declare -A SERVICE_INSTALL_SCRIPT
declare -A SERVICE_MANAGER_SCRIPT

SERVICE_NAME["redis"]="Redis"
SERVICE_SYSTEMD["redis"]="redis-server"
SERVICE_INSTALL_SCRIPT["redis"]="73_install_redis.sh"
SERVICE_MANAGER_SCRIPT["redis"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/redis_manager.sh"

SERVICE_NAME["postgresql"]="PostgreSQL"
SERVICE_SYSTEMD["postgresql"]="postgresql"
SERVICE_INSTALL_SCRIPT["postgresql"]="75_install_postgresql.sh"
SERVICE_MANAGER_SCRIPT["postgresql"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/postgresql_manager.sh"

SERVICE_NAME["docker"]="Docker"
SERVICE_SYSTEMD["docker"]="docker"
SERVICE_INSTALL_SCRIPT["docker"]="79_install_docker.sh"
SERVICE_MANAGER_SCRIPT["docker"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/docker_manager.sh"

SERVICE_NAME["mysql"]="MySQL"
SERVICE_SYSTEMD["mysql"]="mariadb"
SERVICE_INSTALL_SCRIPT["mysql"]="85_install_mysql.sh"
SERVICE_MANAGER_SCRIPT["mysql"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/mysql_manager.sh"

SERVICE_NAME["nginx"]="Nginx"
SERVICE_SYSTEMD["nginx"]="nginx"
SERVICE_INSTALL_SCRIPT["nginx"]="33_install_nginx.sh"
SERVICE_MANAGER_SCRIPT["nginx"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/nginx_manager.sh"

SERVICE_NAME["ssh"]="SSH Server"
SERVICE_SYSTEMD["ssh"]="ssh"
SERVICE_INSTALL_SCRIPT["ssh"]="23_setup_ssh_remote.sh"
SERVICE_MANAGER_SCRIPT["ssh"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/ssh_manager.sh"

SERVICE_NAME["pycore"]="Pycore HTTP"
SERVICE_SYSTEMD["pycore"]="$CORE_RUNTIME_PYCORE_SERVICE"
SERVICE_INSTALL_SCRIPT["pycore"]="189_install_pycore_http_service.sh"
SERVICE_MANAGER_SCRIPT["pycore"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/pycore_manager.sh"

SERVICE_NAME["laravel"]="Laravel Octane"
SERVICE_SYSTEMD["laravel"]="ncore-laravel-main"
SERVICE_INSTALL_SCRIPT["laravel"]="134_setup_api_domains.sh"
SERVICE_MANAGER_SCRIPT["laravel"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/laravel_octane_manager.sh"

SERVICE_NAME["unified_apps"]="Unified Apps"
SERVICE_SYSTEMD["unified_apps"]=""
SERVICE_INSTALL_SCRIPT["unified_apps"]=""
SERVICE_MANAGER_SCRIPT["unified_apps"]="$SERVICE_MANAGER_REGISTRY_DIR/unified_app_service_manager.sh"

SERVICE_NAME["core_services"]="Core Node Services"
SERVICE_SYSTEMD["core_services"]=""
SERVICE_INSTALL_SCRIPT["core_services"]=""
SERVICE_MANAGER_SCRIPT["core_services"]="$SERVICE_MANAGER_REGISTRY_DIR/core_service_manager.sh"
