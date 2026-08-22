#!/bin/bash

SSH_SERVER_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_SERVER_FILE_OPS_COMMON="$SSH_SERVER_COMMON_DIR/file_ops_common.sh"
SSH_SERVER_CONFIG_FILE="/etc/ssh/sshd_config"
SSH_SERVER_CONFIG_DIR="/etc/ssh/sshd_config.d"
SSH_SERVER_CONFIG_DROPIN="$SSH_SERVER_CONFIG_DIR/00-core-node-remote-access.conf"
SSH_SERVER_CONFIG_BACKUP_DIR="/etc/ssh/ncore-backups"
SSH_SERVER_INCLUDE_DIRECTIVE="Include /etc/ssh/sshd_config.d/*.conf"
SSH_SERVER_SYSTEMD_ROOT="/etc/systemd/system"
SSH_SERVER_SYSTEMD_DROPIN=""
SSH_SERVER_PORT="${SSH_SERVER_PORT:-22}"
SSH_SERVER_CLIENT_ALIVE_INTERVAL="${SSH_SERVER_CLIENT_ALIVE_INTERVAL:-60}"
SSH_SERVER_RESTART_DELAY="${SSH_SERVER_RESTART_DELAY:-5s}"
SSH_SERVER_DAEMON_PATH=""
SSH_SERVER_SERVICE_NAME=""
SSH_SERVER_INIT_SYSTEM=""
SSH_SERVER_INSTALLED=false
SSH_SERVER_CONFIG_READY=false
SSH_SERVER_CONFIG_VALID=false
SSH_SERVER_CONFIG_APPLIED=false
SSH_SERVER_CONFIG_CHANGED=false
SSH_SERVER_MAIN_CONFIG_CHANGED=false
SSH_SERVER_DROPIN_CHANGED=false
SSH_SERVER_MAIN_CONFIG_READY=false
SSH_SERVER_DROPIN_READY=false
SSH_SERVER_SERVICE_AVAILABLE=false
SSH_SERVER_SERVICE_ENABLED=false
SSH_SERVER_SERVICE_ACTIVE=false
SSH_SERVER_RESTART_POLICY_READY=false
SSH_SERVER_HOST_KEYS_READY=false
SSH_SERVER_SUPPORTED_CONFIG=""
SSH_SERVER_EFFECTIVE_CONFIG=""
SSH_SERVER_EFFECTIVE_PORT=""
SSH_SERVER_EFFECTIVE_ROOT_LOGIN=""
SSH_SERVER_EFFECTIVE_PUBKEY_AUTH=""
SSH_SERVER_EFFECTIVE_PASSWORD_AUTH=""
SSH_SERVER_EFFECTIVE_LOGIN_GRACE_TIME=""
SSH_SERVER_EFFECTIVE_TCP_KEEPALIVE=""
SSH_SERVER_EFFECTIVE_CLIENT_ALIVE_INTERVAL=""
SSH_SERVER_EFFECTIVE_CLIENT_ALIVE_COUNT_MAX=""
SSH_SERVER_EFFECTIVE_CHANNEL_TIMEOUT=""
SSH_SERVER_EFFECTIVE_UNUSED_CONNECTION_TIMEOUT=""
SSH_SERVER_CHANNEL_TIMEOUT_READY=false
SSH_SERVER_UNUSED_CONNECTION_TIMEOUT_READY=false
SSH_SERVER_CONFIG_ERRORS=""
SSH_SERVER_SYSTEMD_UNITS=""
SSH_SERVER_SYSTEMD_CANONICAL_NAME=""
SSH_SERVER_SYSTEMD_ENABLED_STATE=""
SSH_SERVER_SYSTEMD_ACTIVE_STATE=""
SSH_SERVER_SYSTEMD_RESTART_STATE=""
SSH_SERVER_SYSV_LINKS=""
SSH_SERVER_PROCESS_IDS=""
SSH_SERVER_MAIN_CONFIG_TEMP=""
SSH_SERVER_DROPIN_CONTENT=""

source "$SSH_SERVER_FILE_OPS_COMMON"

ssh_server_refresh_installation() {
    SSH_SERVER_DAEMON_PATH=""
    SSH_SERVER_INSTALLED=false
    SSH_SERVER_CONFIG_READY=false

    if [ -x /usr/sbin/sshd ]; then
        SSH_SERVER_DAEMON_PATH="/usr/sbin/sshd"
    elif [ -x /usr/local/sbin/sshd ]; then
        SSH_SERVER_DAEMON_PATH="/usr/local/sbin/sshd"
    fi

    if [ -n "$SSH_SERVER_DAEMON_PATH" ]; then
        SSH_SERVER_INSTALLED=true
    fi
    if [ -f "$SSH_SERVER_CONFIG_FILE" ]; then
        SSH_SERVER_CONFIG_READY=true
    fi
}

ssh_server_ensure_package() {
    ssh_server_refresh_installation

    if [ "$SSH_SERVER_INSTALLED" = false ]; then
        echo "[SSH] Installing the missing openssh-server package..."
        $USE_SUDO apt-get update
        $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y openssh-server
        ssh_server_refresh_installation
    fi

    if [ "$SSH_SERVER_INSTALLED" = true ] && [ "$SSH_SERVER_CONFIG_READY" = false ]; then
        echo "[SSH] Repairing the missing OpenSSH server configuration..."
        $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install --reinstall -y openssh-server
        ssh_server_refresh_installation
    fi

    if [ "$SSH_SERVER_INSTALLED" = true ] && [ "$SSH_SERVER_CONFIG_READY" = true ]; then
        echo "[SSH] OpenSSH server package is ready."
    else
        echo "[SSH] OpenSSH server package is unavailable."
    fi
}

ssh_server_refresh_host_keys() {
    SSH_SERVER_HOST_KEYS_READY=false
    if compgen -G "/etc/ssh/ssh_host_*_key" >/dev/null; then
        SSH_SERVER_HOST_KEYS_READY=true
    fi
}

ssh_server_ensure_host_keys() {
    ssh_server_refresh_host_keys
    if [ -x /usr/bin/ssh-keygen ]; then
        echo "[SSH] Ensuring all SSH host keys exist..."
        $USE_SUDO /usr/bin/ssh-keygen -A
        ssh_server_refresh_host_keys
    fi
}

ssh_server_refresh_supported_config() {
    SSH_SERVER_SUPPORTED_CONFIG=""
    if [ -n "$SSH_SERVER_DAEMON_PATH" ]; then
        SSH_SERVER_SUPPORTED_CONFIG="$($USE_SUDO "$SSH_SERVER_DAEMON_PATH" -T 2>/dev/null)"
    fi
}

ssh_server_render_dropin() {
    SSH_SERVER_DROPIN_CONTENT="Port $SSH_SERVER_PORT
PermitRootLogin yes
PubkeyAuthentication yes
PasswordAuthentication yes
LoginGraceTime 0
TCPKeepAlive no
ClientAliveInterval $SSH_SERVER_CLIENT_ALIVE_INTERVAL
ClientAliveCountMax 0"

    if printf '%s\n' "$SSH_SERVER_SUPPORTED_CONFIG" | awk '$1 == "channeltimeout" { found = 1 } END { if (found) print "yes" }' | grep -q '^yes$'; then
        SSH_SERVER_DROPIN_CONTENT="$SSH_SERVER_DROPIN_CONTENT
ChannelTimeout none"
    fi
    if printf '%s\n' "$SSH_SERVER_SUPPORTED_CONFIG" | awk '$1 == "unusedconnectiontimeout" { found = 1 } END { if (found) print "yes" }' | grep -q '^yes$'; then
        SSH_SERVER_DROPIN_CONTENT="$SSH_SERVER_DROPIN_CONTENT
UnusedConnectionTimeout none"
    fi
}

ssh_server_ensure_include_precedence() {
    SSH_SERVER_MAIN_CONFIG_CHANGED=false
    SSH_SERVER_MAIN_CONFIG_READY=false
    SSH_SERVER_MAIN_CONFIG_TEMP="$(mktemp)"

    awk -v include_line="$SSH_SERVER_INCLUDE_DIRECTIVE" '
        BEGIN {
            in_match = 0
            print include_line
        }
        {
            normalized = tolower($0)
            sub(/^[[:space:]]+/, "", normalized)
            sub(/[[:space:]]+$/, "", normalized)
            if (normalized ~ /^match[[:space:]]/) {
                in_match = 1
            }
            if (!in_match && normalized ~ /^include[[:space:]]+\/etc\/ssh\/sshd_config\.d\/\*\.conf$/) {
                next
            }
            print
        }
    ' "$SSH_SERVER_CONFIG_FILE" > "$SSH_SERVER_MAIN_CONFIG_TEMP"

    write_file_if_changed "$SSH_SERVER_CONFIG_FILE" "$SSH_SERVER_CONFIG_BACKUP_DIR" 644 root root < "$SSH_SERVER_MAIN_CONFIG_TEMP"
    SSH_SERVER_MAIN_CONFIG_CHANGED="$WRITE_FILE_CHANGED"
    SSH_SERVER_MAIN_CONFIG_READY="$WRITE_FILE_READY"
    rm -f "$SSH_SERVER_MAIN_CONFIG_TEMP"
    SSH_SERVER_MAIN_CONFIG_TEMP=""
}

ssh_server_ensure_config_dropin() {
    SSH_SERVER_DROPIN_CHANGED=false
    SSH_SERVER_DROPIN_READY=false
    printf '%s\n' "$SSH_SERVER_DROPIN_CONTENT" | write_file_if_changed "$SSH_SERVER_CONFIG_DROPIN" "$SSH_SERVER_CONFIG_BACKUP_DIR" 644 root root
    SSH_SERVER_DROPIN_CHANGED="$WRITE_FILE_CHANGED"
    SSH_SERVER_DROPIN_READY="$WRITE_FILE_READY"
}

ssh_server_validate_config() {
    SSH_SERVER_CONFIG_VALID=false
    SSH_SERVER_CONFIG_APPLIED=false
    SSH_SERVER_CONFIG_ERRORS=""
    SSH_SERVER_EFFECTIVE_CONFIG=""
    SSH_SERVER_EFFECTIVE_PORT=""
    SSH_SERVER_EFFECTIVE_ROOT_LOGIN=""
    SSH_SERVER_EFFECTIVE_PUBKEY_AUTH=""
    SSH_SERVER_EFFECTIVE_PASSWORD_AUTH=""
    SSH_SERVER_EFFECTIVE_LOGIN_GRACE_TIME=""
    SSH_SERVER_EFFECTIVE_TCP_KEEPALIVE=""
    SSH_SERVER_EFFECTIVE_CLIENT_ALIVE_INTERVAL=""
    SSH_SERVER_EFFECTIVE_CLIENT_ALIVE_COUNT_MAX=""
    SSH_SERVER_EFFECTIVE_CHANNEL_TIMEOUT=""
    SSH_SERVER_EFFECTIVE_UNUSED_CONNECTION_TIMEOUT=""
    SSH_SERVER_CHANNEL_TIMEOUT_READY=false
    SSH_SERVER_UNUSED_CONNECTION_TIMEOUT_READY=false
    if [ -n "$SSH_SERVER_DAEMON_PATH" ]; then
        SSH_SERVER_CONFIG_ERRORS="$($USE_SUDO "$SSH_SERVER_DAEMON_PATH" -t 2>&1)"
    fi
    if [ -n "$SSH_SERVER_DAEMON_PATH" ] && [ -z "$SSH_SERVER_CONFIG_ERRORS" ] && [ "$SSH_SERVER_MAIN_CONFIG_READY" = true ] && [ "$SSH_SERVER_DROPIN_READY" = true ]; then
        SSH_SERVER_CONFIG_VALID=true
        SSH_SERVER_EFFECTIVE_CONFIG="$($USE_SUDO "$SSH_SERVER_DAEMON_PATH" -T 2>/dev/null)"
        SSH_SERVER_EFFECTIVE_PORT="$(printf '%s\n' "$SSH_SERVER_EFFECTIVE_CONFIG" | awk '$1 == "port" { print $2; exit }')"
        SSH_SERVER_EFFECTIVE_ROOT_LOGIN="$(printf '%s\n' "$SSH_SERVER_EFFECTIVE_CONFIG" | awk '$1 == "permitrootlogin" { print $2; exit }')"
        SSH_SERVER_EFFECTIVE_PUBKEY_AUTH="$(printf '%s\n' "$SSH_SERVER_EFFECTIVE_CONFIG" | awk '$1 == "pubkeyauthentication" { print $2; exit }')"
        SSH_SERVER_EFFECTIVE_PASSWORD_AUTH="$(printf '%s\n' "$SSH_SERVER_EFFECTIVE_CONFIG" | awk '$1 == "passwordauthentication" { print $2; exit }')"
        SSH_SERVER_EFFECTIVE_LOGIN_GRACE_TIME="$(printf '%s\n' "$SSH_SERVER_EFFECTIVE_CONFIG" | awk '$1 == "logingracetime" { print $2; exit }')"
        SSH_SERVER_EFFECTIVE_TCP_KEEPALIVE="$(printf '%s\n' "$SSH_SERVER_EFFECTIVE_CONFIG" | awk '$1 == "tcpkeepalive" { print $2; exit }')"
        SSH_SERVER_EFFECTIVE_CLIENT_ALIVE_INTERVAL="$(printf '%s\n' "$SSH_SERVER_EFFECTIVE_CONFIG" | awk '$1 == "clientaliveinterval" { print $2; exit }')"
        SSH_SERVER_EFFECTIVE_CLIENT_ALIVE_COUNT_MAX="$(printf '%s\n' "$SSH_SERVER_EFFECTIVE_CONFIG" | awk '$1 == "clientalivecountmax" { print $2; exit }')"
        SSH_SERVER_EFFECTIVE_CHANNEL_TIMEOUT="$(printf '%s\n' "$SSH_SERVER_EFFECTIVE_CONFIG" | awk '$1 == "channeltimeout" { print $2; exit }')"
        SSH_SERVER_EFFECTIVE_UNUSED_CONNECTION_TIMEOUT="$(printf '%s\n' "$SSH_SERVER_EFFECTIVE_CONFIG" | awk '$1 == "unusedconnectiontimeout" { print $2; exit }')"
    fi
    if [ -z "$SSH_SERVER_EFFECTIVE_CHANNEL_TIMEOUT" ] || [ "$SSH_SERVER_EFFECTIVE_CHANNEL_TIMEOUT" = "none" ]; then
        SSH_SERVER_CHANNEL_TIMEOUT_READY=true
    fi
    if [ -z "$SSH_SERVER_EFFECTIVE_UNUSED_CONNECTION_TIMEOUT" ] || [ "$SSH_SERVER_EFFECTIVE_UNUSED_CONNECTION_TIMEOUT" = "none" ]; then
        SSH_SERVER_UNUSED_CONNECTION_TIMEOUT_READY=true
    fi
    if [ "$SSH_SERVER_EFFECTIVE_PORT" = "$SSH_SERVER_PORT" ] && [ "$SSH_SERVER_EFFECTIVE_ROOT_LOGIN" = "yes" ] && [ "$SSH_SERVER_EFFECTIVE_PUBKEY_AUTH" = "yes" ] && [ "$SSH_SERVER_EFFECTIVE_PASSWORD_AUTH" = "yes" ] && [ "$SSH_SERVER_EFFECTIVE_LOGIN_GRACE_TIME" = "0" ] && [ "$SSH_SERVER_EFFECTIVE_TCP_KEEPALIVE" = "no" ] && [ "$SSH_SERVER_EFFECTIVE_CLIENT_ALIVE_INTERVAL" = "$SSH_SERVER_CLIENT_ALIVE_INTERVAL" ] && [ "$SSH_SERVER_EFFECTIVE_CLIENT_ALIVE_COUNT_MAX" = "0" ] && [ "$SSH_SERVER_CHANNEL_TIMEOUT_READY" = true ] && [ "$SSH_SERVER_UNUSED_CONNECTION_TIMEOUT_READY" = true ]; then
        SSH_SERVER_CONFIG_APPLIED=true
    fi
}

ssh_server_ensure_config() {
    SSH_SERVER_CONFIG_CHANGED=false
    ssh_server_refresh_supported_config
    ssh_server_render_dropin
    ssh_server_ensure_include_precedence
    ssh_server_ensure_config_dropin

    if [ "$SSH_SERVER_MAIN_CONFIG_CHANGED" = true ] || [ "$SSH_SERVER_DROPIN_CHANGED" = true ]; then
        SSH_SERVER_CONFIG_CHANGED=true
    fi

    ssh_server_validate_config
    if [ "$SSH_SERVER_CONFIG_VALID" = true ] && [ "$SSH_SERVER_CONFIG_APPLIED" = true ]; then
        echo "[SSH] OpenSSH server configuration is valid and effective."
    elif [ "$SSH_SERVER_CONFIG_VALID" = true ]; then
        echo "[SSH] OpenSSH server configuration is valid but the required values are not effective."
    else
        echo "[SSH] OpenSSH server configuration is invalid: $SSH_SERVER_CONFIG_ERRORS"
    fi
}

ssh_server_refresh_service() {
    SSH_SERVER_SERVICE_NAME=""
    SSH_SERVER_INIT_SYSTEM=""
    SSH_SERVER_SERVICE_AVAILABLE=false
    SSH_SERVER_SERVICE_ENABLED=false
    SSH_SERVER_SERVICE_ACTIVE=false
    SSH_SERVER_SYSTEMD_UNITS=""
    SSH_SERVER_SYSTEMD_CANONICAL_NAME=""
    SSH_SERVER_SYSTEMD_ENABLED_STATE=""
    SSH_SERVER_SYSTEMD_ACTIVE_STATE=""
    SSH_SERVER_SYSV_LINKS=""
    SSH_SERVER_PROCESS_IDS=""

    if [ -d /run/systemd/system ] && [ -x /usr/bin/systemctl ]; then
        SSH_SERVER_INIT_SYSTEM="systemd"
        SSH_SERVER_SYSTEMD_UNITS="$(systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}')"
        if printf '%s\n' "$SSH_SERVER_SYSTEMD_UNITS" | grep -q '^ssh\.service$'; then
            SSH_SERVER_SERVICE_NAME="ssh"
        elif printf '%s\n' "$SSH_SERVER_SYSTEMD_UNITS" | grep -q '^sshd\.service$'; then
            SSH_SERVER_SERVICE_NAME="sshd"
        fi
        if [ -n "$SSH_SERVER_SERVICE_NAME" ]; then
            SSH_SERVER_SYSTEMD_CANONICAL_NAME="$(systemctl show --property=Id --value "$SSH_SERVER_SERVICE_NAME.service" 2>/dev/null)"
            if [ -n "$SSH_SERVER_SYSTEMD_CANONICAL_NAME" ]; then
                SSH_SERVER_SERVICE_NAME="${SSH_SERVER_SYSTEMD_CANONICAL_NAME%.service}"
            fi
            SSH_SERVER_SERVICE_AVAILABLE=true
            SSH_SERVER_SYSTEMD_ENABLED_STATE="$(systemctl is-enabled "$SSH_SERVER_SERVICE_NAME.service" 2>/dev/null)"
            SSH_SERVER_SYSTEMD_ACTIVE_STATE="$(systemctl is-active "$SSH_SERVER_SERVICE_NAME.service" 2>/dev/null)"
            if [ "$SSH_SERVER_SYSTEMD_ENABLED_STATE" = "enabled" ]; then
                SSH_SERVER_SERVICE_ENABLED=true
            fi
            if [ "$SSH_SERVER_SYSTEMD_ACTIVE_STATE" = "active" ]; then
                SSH_SERVER_SERVICE_ACTIVE=true
            fi
        fi
    elif [ -x /etc/init.d/ssh ]; then
        SSH_SERVER_INIT_SYSTEM="sysv"
        SSH_SERVER_SERVICE_NAME="ssh"
        SSH_SERVER_SERVICE_AVAILABLE=true
        SSH_SERVER_SYSV_LINKS="$(find /etc/rc2.d /etc/rc3.d /etc/rc4.d /etc/rc5.d -maxdepth 1 -type l -name 'S*ssh' -print 2>/dev/null)"
        SSH_SERVER_PROCESS_IDS="$(pgrep -x sshd 2>/dev/null)"
        if [ -n "$SSH_SERVER_SYSV_LINKS" ]; then
            SSH_SERVER_SERVICE_ENABLED=true
        fi
        if [ -n "$SSH_SERVER_PROCESS_IDS" ]; then
            SSH_SERVER_SERVICE_ACTIVE=true
        fi
    fi
}

ssh_server_ensure_systemd_restart_policy() {
    SSH_SERVER_SYSTEMD_DROPIN=""
    SSH_SERVER_RESTART_POLICY_READY=false
    if [ "$SSH_SERVER_INIT_SYSTEM" = "systemd" ] && [ -n "$SSH_SERVER_SERVICE_NAME" ]; then
        SSH_SERVER_SYSTEMD_DROPIN="$SSH_SERVER_SYSTEMD_ROOT/$SSH_SERVER_SERVICE_NAME.service.d/00-core-node-availability.conf"
        write_file_if_changed "$SSH_SERVER_SYSTEMD_DROPIN" "" 644 root root <<EOF
[Unit]
StartLimitIntervalSec=0

[Service]
Restart=always
RestartSec=$SSH_SERVER_RESTART_DELAY
EOF
        SSH_SERVER_SYSTEMD_RESTART_STATE="$(systemctl show --property=Restart --value "$SSH_SERVER_SERVICE_NAME.service" 2>/dev/null)"
        if [ "$WRITE_FILE_CHANGED" = true ] || [ "$SSH_SERVER_SYSTEMD_RESTART_STATE" != "always" ]; then
            SSH_SERVER_CONFIG_CHANGED=true
            $USE_SUDO systemctl daemon-reload
        fi
        SSH_SERVER_SYSTEMD_RESTART_STATE="$(systemctl show --property=Restart --value "$SSH_SERVER_SERVICE_NAME.service" 2>/dev/null)"
        if [ "$WRITE_FILE_READY" = true ] && [ "$SSH_SERVER_SYSTEMD_RESTART_STATE" = "always" ]; then
            SSH_SERVER_RESTART_POLICY_READY=true
        fi
    elif [ "$SSH_SERVER_INIT_SYSTEM" = "sysv" ]; then
        SSH_SERVER_RESTART_POLICY_READY=false
    fi
}

ssh_server_ensure_enabled() {
    ssh_server_refresh_service
    if [ "$SSH_SERVER_INIT_SYSTEM" = "systemd" ] && [ "$SSH_SERVER_SYSTEMD_ENABLED_STATE" = "masked" ]; then
        echo "[SSH] Unmasking the SSH service..."
        $USE_SUDO systemctl unmask "$SSH_SERVER_SERVICE_NAME.service"
        ssh_server_refresh_service
    fi
    if [ "$SSH_SERVER_SERVICE_AVAILABLE" = true ] && [ "$SSH_SERVER_SERVICE_ENABLED" = false ]; then
        echo "[SSH] Enabling the SSH service at boot..."
        if [ "$SSH_SERVER_INIT_SYSTEM" = "systemd" ]; then
            $USE_SUDO systemctl enable "$SSH_SERVER_SERVICE_NAME.service"
        elif [ "$SSH_SERVER_INIT_SYSTEM" = "sysv" ]; then
            $USE_SUDO update-rc.d "$SSH_SERVER_SERVICE_NAME" defaults
        fi
        ssh_server_refresh_service
    fi
}

ssh_server_ensure_running() {
    ssh_server_refresh_service
    if [ "$SSH_SERVER_SERVICE_AVAILABLE" = true ] && [ "$SSH_SERVER_SERVICE_ACTIVE" = false ]; then
        echo "[SSH] Starting the SSH service..."
        if [ "$SSH_SERVER_INIT_SYSTEM" = "systemd" ]; then
            $USE_SUDO systemctl start "$SSH_SERVER_SERVICE_NAME.service"
        elif [ "$SSH_SERVER_INIT_SYSTEM" = "sysv" ]; then
            $USE_SUDO service "$SSH_SERVER_SERVICE_NAME" start
        fi
        ssh_server_refresh_service
    fi
}

ssh_server_apply_changed_config() {
    ssh_server_refresh_service
    if [ "$SSH_SERVER_CONFIG_CHANGED" = true ] && [ "$SSH_SERVER_SERVICE_ACTIVE" = true ]; then
        echo "[SSH] Reloading the changed SSH configuration..."
        if [ "$SSH_SERVER_INIT_SYSTEM" = "systemd" ]; then
            $USE_SUDO systemctl reload "$SSH_SERVER_SERVICE_NAME.service"
        elif [ "$SSH_SERVER_INIT_SYSTEM" = "sysv" ]; then
            $USE_SUDO service "$SSH_SERVER_SERVICE_NAME" reload
        fi
        ssh_server_refresh_service
    fi
}
