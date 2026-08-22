#!/bin/bash
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
DEBIAN_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
LINUX_DIR="$(dirname "$DEBIAN_DIR")"
COMMON_DIR="$LINUX_DIR/common"
GVAR_COMMON="$COMMON_DIR/gvar_common.sh"
COMMON_FUNCTIONS="$COMMON_DIR/common_functions.sh"
SSH_SERVER_COMMON="$COMMON_DIR/ssh_server_common.sh"
FIREWALL_MANAGER="$COMMON_DIR/firewall_manager.sh"
SSH_SERVER_PORT="${SSH_SERVER_PORT:-22}"
SSH_CONNECTION_USER=""
SSH_CONNECTION_IPS=""

source "$GVAR_COMMON"
source "$COMMON_FUNCTIONS"
source "$SSH_SERVER_COMMON"
source "$FIREWALL_MANAGER"

print_header_from_common_functions "Setup persistent SSH remote access"

ssh_server_ensure_package

if [ "$SSH_SERVER_INSTALLED" = true ] && [ "$SSH_SERVER_CONFIG_READY" = true ]; then
    ssh_server_ensure_host_keys
    ssh_server_ensure_config

    if [ "$SSH_SERVER_CONFIG_VALID" = true ] && [ "$SSH_SERVER_CONFIG_APPLIED" = true ]; then
        ssh_server_refresh_service
        ssh_server_ensure_systemd_restart_policy
        ssh_server_ensure_enabled
        ssh_server_apply_changed_config
        ssh_server_ensure_running
        detect_firewall false
        firewall_allow_port "$SSH_SERVER_PORT" "tcp" "SSH remote access"
    fi
fi

ssh_server_refresh_service
SSH_CONNECTION_USER="$(id -un 2>/dev/null)"
SSH_CONNECTION_IPS="$(hostname -I 2>/dev/null | awk '{$1=$1; print}')"

if [ "$SSH_SERVER_CONFIG_VALID" = true ] && [ "$SSH_SERVER_CONFIG_APPLIED" = true ] && [ "$SSH_SERVER_SERVICE_ACTIVE" = true ] && [ "$SSH_SERVER_SERVICE_ENABLED" = true ] && [ "$SSH_SERVER_RESTART_POLICY_READY" = true ]; then
    print_success_from_common_functions "SSH is configured, enabled, and running."
    print_info_from_common_functions "Idle sessions have no OpenSSH alive-message termination limit."
    print_info_from_common_functions "SSH restarts automatically after process termination."
    print_info_from_common_functions "Connect with: ssh -p $SSH_SERVER_PORT $SSH_CONNECTION_USER@${SSH_CONNECTION_IPS%% *}"
else
    print_error_from_common_functions "SSH convergence is incomplete. Review the messages above."
fi
