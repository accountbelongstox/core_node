#!/bin/bash

# Service Manager registry: every menu item maps one install-shell lifecycle.
# Replacement stack (FrankenPHP plane):
#   frankenphp   -> 93_install_php.sh --only=runtime,config (FrankenPHP runtime, variant-aware)
#   composer     -> 93_install_php.sh --only=composer  (Composer phar + wrappers)
#   php85        -> 93_install_php.sh --only=config    (PHP 8.5 runtime configuration)
#   laravel_main -> 175_laravel_main_start.sh (ncore-laravel-* systemd service)
#   nexus_dash   -> 175_laravel_main_start.sh --ui-service (ncore-nexus-dash dashboard service)
# Retained legacy services:
#   redis / postgresql / docker / mysql / nginx / ssh / pycore (HTTP :59000)
# Project-installed units (Windows mirror: service_contract.json service_manager.windows):
#   mcp_chrome / laravel_rescue / rescue_httpd / natgateway / headscale / tailscale / gitea
#   unified_apps / core_services (aggregates owned by their own managers)

SERVICE_MANAGER_REGISTRY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_MANAGER_REGISTRY_LINUX_DIR="$(dirname "$SERVICE_MANAGER_REGISTRY_DIR")"
SERVICE_MANAGER_INSTALL_SHELLS_DIR="$SERVICE_MANAGER_REGISTRY_LINUX_DIR/debian/install_shells"
SERVICE_MANAGER_SERVER_MANAGER_DIR="$SERVICE_MANAGER_REGISTRY_LINUX_DIR/debian/server_manager"
SERVICE_MANAGER_LARAVEL_SERVICE_BASE="ncore-laravel"

SERVICES=(
    "frankenphp" "composer" "php85" "laravel_main" "nexus_dash"
    "redis" "postgresql" "docker" "mysql" "nginx" "ssh" "pycore"
    "mcp_chrome" "laravel_rescue" "rescue_httpd" "natgateway" "headscale" "tailscale" "gitea"
    "unified_apps" "core_services"
)

declare -A SERVICE_NAME
declare -A SERVICE_KIND
declare -A SERVICE_INSTALL_SCRIPT
declare -A SERVICE_INSTALL_ARGS
declare -A SERVICE_MANAGER_SCRIPT

SERVICE_NAME["frankenphp"]="FrankenPHP"
SERVICE_KIND["frankenphp"]="runtime"
SERVICE_INSTALL_SCRIPT["frankenphp"]="93_install_php.sh"
SERVICE_INSTALL_ARGS["frankenphp"]="--only=runtime,config"

SERVICE_NAME["composer"]="Composer"
SERVICE_KIND["composer"]="runtime"
SERVICE_INSTALL_SCRIPT["composer"]="93_install_php.sh"
SERVICE_INSTALL_ARGS["composer"]="--only=composer"

SERVICE_NAME["php85"]="PHP 8.5"
SERVICE_KIND["php85"]="runtime"
SERVICE_INSTALL_SCRIPT["php85"]="93_install_php.sh"
SERVICE_INSTALL_ARGS["php85"]="--only=config"

SERVICE_NAME["laravel_main"]="Laravel Main"
SERVICE_KIND["laravel_main"]="systemd"
SERVICE_INSTALL_SCRIPT["laravel_main"]="175_laravel_main_start.sh"
SERVICE_INSTALL_ARGS["laravel_main"]="--service"

SERVICE_NAME["nexus_dash"]="Nexus Dash UI"
SERVICE_KIND["nexus_dash"]="systemd"
SERVICE_INSTALL_SCRIPT["nexus_dash"]="175_laravel_main_start.sh"
SERVICE_INSTALL_ARGS["nexus_dash"]="--ui-service"

SERVICE_NAME["redis"]="Redis"
SERVICE_KIND["redis"]="systemd"
SERVICE_INSTALL_SCRIPT["redis"]="73_install_redis.sh"
SERVICE_MANAGER_SCRIPT["redis"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/redis_manager.sh"

SERVICE_NAME["postgresql"]="PostgreSQL"
SERVICE_KIND["postgresql"]="systemd"
SERVICE_INSTALL_SCRIPT["postgresql"]="75_install_postgresql.sh"
SERVICE_MANAGER_SCRIPT["postgresql"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/postgresql_manager.sh"

SERVICE_NAME["docker"]="Docker"
SERVICE_KIND["docker"]="systemd"
SERVICE_INSTALL_SCRIPT["docker"]="79_install_docker.sh"
SERVICE_MANAGER_SCRIPT["docker"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/docker_manager.sh"

SERVICE_NAME["mysql"]="MySQL"
SERVICE_KIND["mysql"]="systemd"
SERVICE_INSTALL_SCRIPT["mysql"]="85_install_mysql.sh"
SERVICE_MANAGER_SCRIPT["mysql"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/mysql_manager.sh"

SERVICE_NAME["nginx"]="Nginx"
SERVICE_KIND["nginx"]="systemd"
SERVICE_INSTALL_SCRIPT["nginx"]="33_install_nginx.sh"
SERVICE_MANAGER_SCRIPT["nginx"]="$SERVICE_MANAGER_REGISTRY_LINUX_DIR/common/nginx_manager.sh"

SERVICE_NAME["ssh"]="SSH Server"
SERVICE_KIND["ssh"]="systemd"
SERVICE_INSTALL_SCRIPT["ssh"]="23_setup_ssh_remote.sh"
SERVICE_MANAGER_SCRIPT["ssh"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/ssh_manager.sh"

SERVICE_NAME["pycore"]="Pycore HTTP"
SERVICE_KIND["pycore"]="systemd"
SERVICE_INSTALL_SCRIPT["pycore"]="189_install_pycore_http_service.sh"
SERVICE_MANAGER_SCRIPT["pycore"]="$SERVICE_MANAGER_SERVER_MANAGER_DIR/pycore_manager.sh"

SERVICE_NAME["mcp_chrome"]="MCP Chrome"
SERVICE_KIND["mcp_chrome"]="systemd"
SERVICE_INSTALL_SCRIPT["mcp_chrome"]=""

SERVICE_NAME["laravel_rescue"]="Laravel Rescue Watcher"
SERVICE_KIND["laravel_rescue"]="systemd"
SERVICE_INSTALL_SCRIPT["laravel_rescue"]="3_setting_base.sh"

SERVICE_NAME["rescue_httpd"]="Laravel Rescue HTTPD"
SERVICE_KIND["rescue_httpd"]="systemd"
SERVICE_INSTALL_SCRIPT["rescue_httpd"]="3_setting_base.sh"

SERVICE_NAME["natgateway"]="NAT Gateway"
SERVICE_KIND["natgateway"]="systemd"
SERVICE_INSTALL_SCRIPT["natgateway"]="113_natgateway.sh"

SERVICE_NAME["headscale"]="Headscale"
SERVICE_KIND["headscale"]="systemd"
SERVICE_INSTALL_SCRIPT["headscale"]="98_install_headscale_server.sh"

SERVICE_NAME["tailscale"]="Tailscale"
SERVICE_KIND["tailscale"]="systemd"
SERVICE_INSTALL_SCRIPT["tailscale"]="97_install_tailscale.sh"

SERVICE_NAME["gitea"]="Gitea"
SERVICE_KIND["gitea"]="systemd"
SERVICE_INSTALL_SCRIPT["gitea"]="159_install_gitea.sh"

SERVICE_NAME["unified_apps"]="Unified Apps"
SERVICE_KIND["unified_apps"]="aggregate"
SERVICE_INSTALL_SCRIPT["unified_apps"]=""
SERVICE_MANAGER_SCRIPT["unified_apps"]="$SERVICE_MANAGER_REGISTRY_DIR/unified_app_service_manager.sh"

SERVICE_NAME["core_services"]="Core Node Services"
SERVICE_KIND["core_services"]="aggregate"
SERVICE_INSTALL_SCRIPT["core_services"]=""
SERVICE_MANAGER_SCRIPT["core_services"]="$SERVICE_MANAGER_REGISTRY_DIR/core_service_manager.sh"
