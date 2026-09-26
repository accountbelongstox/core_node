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
SSH_SERVER_CLIENT_ALIVE_INTERVAL="${SSH_SERVER_CLIENT_ALIVE_INTERVAL:-15}"
SSH_SERVER_LOGIN_GRACE_TIME="${SSH_SERVER_LOGIN_GRACE_TIME:-30}"
SSH_SERVER_PASSWORD_AUTH="${SSH_SERVER_PASSWORD_AUTH:-no}"
SSH_SERVER_MAX_STARTUPS="${SSH_SERVER_MAX_STARTUPS:-100:30:200}"
SSH_SERVER_PER_SOURCE_MAX_STARTUPS="${SSH_SERVER_PER_SOURCE_MAX_STARTUPS:-10}"
SSH_SERVER_PREAUTH_REAP_SECONDS="${SSH_SERVER_PREAUTH_REAP_SECONDS:-120}"
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
SSH_SERVER_EFFECTIVE_MAX_STARTUPS=""
SSH_SERVER_EFFECTIVE_PER_SOURCE_MAX_STARTUPS=""
SSH_SERVER_CHANNEL_TIMEOUT_READY=false
SSH_SERVER_UNUSED_CONNECTION_TIMEOUT_READY=false
SSH_SERVER_PER_SOURCE_MAX_STARTUPS_SUPPORTED=false
SSH_SERVER_PER_SOURCE_MAX_STARTUPS_READY=false
SSH_SERVER_STALE_PREAUTH_PIDS=""
SSH_SERVER_STALE_PREAUTH_REAPED=0
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
SSH_SERVER_CONFIG_RELOAD_NEEDED=false
SSH_SERVER_LISTENER_PID=""
SSH_SERVER_LISTENER_AGE_SECONDS=0
SSH_SERVER_LISTENER_TITLE=""
SSH_SERVER_CONFIG_MTIME_EPOCH=0
SSH_SERVER_NOW_EPOCH=0
SSH_SERVER_RELOAD_STAMP="/run/ncore-sshd-config-reload.stamp"
SSH_SERVER_LOADED_EPOCH=0
SSH_SERVER_TMUX_PERSISTENCE_ENABLED="${SSH_SERVER_TMUX_PERSISTENCE_ENABLED:-true}"
SSH_SERVER_TMUX_SESSION_NAME="${SSH_SERVER_TMUX_SESSION_NAME:-main}"
SSH_SERVER_TMUX_PROFILE_HOOK="/etc/profile.d/ncore_ssh_tmux_persistence.sh"
SSH_SERVER_TMUX_OPTOUT_FILE=".ncore-no-auto-tmux"
SSH_SERVER_TMUX_PERSISTENCE_READY=false
SSH_SERVER_JOURNALD_DROPIN="/etc/systemd/journald.conf.d/00-core-node-persistent.conf"
SSH_SERVER_JOURNAL_DIR="/var/log/journal"
SSH_SERVER_JOURNAL_MACHINE_ID=""
SSH_SERVER_JOURNAL_PERSISTENT_READY=false

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
    SSH_SERVER_PER_SOURCE_MAX_STARTUPS_SUPPORTED=false
    SSH_SERVER_DROPIN_CONTENT="Port $SSH_SERVER_PORT
PermitRootLogin yes
PubkeyAuthentication yes
PasswordAuthentication $SSH_SERVER_PASSWORD_AUTH
LoginGraceTime $SSH_SERVER_LOGIN_GRACE_TIME
TCPKeepAlive no
ClientAliveInterval $SSH_SERVER_CLIENT_ALIVE_INTERVAL
ClientAliveCountMax 0
MaxStartups $SSH_SERVER_MAX_STARTUPS"

    if printf '%s\n' "$SSH_SERVER_SUPPORTED_CONFIG" | awk '$1 == "persourcemaxstartups" { found = 1 } END { if (found) print "yes" }' | grep -q '^yes$'; then
        SSH_SERVER_PER_SOURCE_MAX_STARTUPS_SUPPORTED=true
        SSH_SERVER_DROPIN_CONTENT="$SSH_SERVER_DROPIN_CONTENT
PerSourceMaxStartups $SSH_SERVER_PER_SOURCE_MAX_STARTUPS"
    fi
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

    awk -v include_line="$SSH_SERVER_INCLUDE_DIRECTIVE" -v dropin_name="$(basename "$SSH_SERVER_CONFIG_DROPIN")" '
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
            if (!in_match && normalized ~ /^(logingracetime|maxstartups|persourcemaxstartups|tcpkeepalive|clientaliveinterval|clientalivecountmax|passwordauthentication)[[:space:]]/) {
                print "# core-node managed by " dropin_name ": " $0
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
    write_file_if_changed "$SSH_SERVER_CONFIG_DROPIN" "$SSH_SERVER_CONFIG_BACKUP_DIR" 644 root root <<< "$SSH_SERVER_DROPIN_CONTENT"
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
    SSH_SERVER_EFFECTIVE_MAX_STARTUPS=""
    SSH_SERVER_EFFECTIVE_PER_SOURCE_MAX_STARTUPS=""
    SSH_SERVER_CHANNEL_TIMEOUT_READY=false
    SSH_SERVER_UNUSED_CONNECTION_TIMEOUT_READY=false
    SSH_SERVER_PER_SOURCE_MAX_STARTUPS_READY=false
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
        SSH_SERVER_EFFECTIVE_MAX_STARTUPS="$(printf '%s\n' "$SSH_SERVER_EFFECTIVE_CONFIG" | awk '$1 == "maxstartups" { print $2; exit }')"
        SSH_SERVER_EFFECTIVE_PER_SOURCE_MAX_STARTUPS="$(printf '%s\n' "$SSH_SERVER_EFFECTIVE_CONFIG" | awk '$1 == "persourcemaxstartups" { print $2; exit }')"
    fi
    if [ -z "$SSH_SERVER_EFFECTIVE_CHANNEL_TIMEOUT" ] || [ "$SSH_SERVER_EFFECTIVE_CHANNEL_TIMEOUT" = "none" ]; then
        SSH_SERVER_CHANNEL_TIMEOUT_READY=true
    fi
    if [ -z "$SSH_SERVER_EFFECTIVE_UNUSED_CONNECTION_TIMEOUT" ] || [ "$SSH_SERVER_EFFECTIVE_UNUSED_CONNECTION_TIMEOUT" = "none" ]; then
        SSH_SERVER_UNUSED_CONNECTION_TIMEOUT_READY=true
    fi
    if [ "$SSH_SERVER_PER_SOURCE_MAX_STARTUPS_SUPPORTED" = false ]; then
        SSH_SERVER_PER_SOURCE_MAX_STARTUPS_READY=true
    elif [ "$SSH_SERVER_EFFECTIVE_PER_SOURCE_MAX_STARTUPS" = "$SSH_SERVER_PER_SOURCE_MAX_STARTUPS" ]; then
        SSH_SERVER_PER_SOURCE_MAX_STARTUPS_READY=true
    fi
    if [ "$SSH_SERVER_EFFECTIVE_PORT" = "$SSH_SERVER_PORT" ] && [ "$SSH_SERVER_EFFECTIVE_ROOT_LOGIN" = "yes" ] && [ "$SSH_SERVER_EFFECTIVE_PUBKEY_AUTH" = "yes" ] && [ "$SSH_SERVER_EFFECTIVE_PASSWORD_AUTH" = "$SSH_SERVER_PASSWORD_AUTH" ] && [ "$SSH_SERVER_EFFECTIVE_LOGIN_GRACE_TIME" = "$SSH_SERVER_LOGIN_GRACE_TIME" ] && [ "$SSH_SERVER_EFFECTIVE_TCP_KEEPALIVE" = "no" ] && [ "$SSH_SERVER_EFFECTIVE_CLIENT_ALIVE_INTERVAL" = "$SSH_SERVER_CLIENT_ALIVE_INTERVAL" ] && [ "$SSH_SERVER_EFFECTIVE_CLIENT_ALIVE_COUNT_MAX" = "0" ] && [ "$SSH_SERVER_EFFECTIVE_MAX_STARTUPS" = "$SSH_SERVER_MAX_STARTUPS" ] && [ "$SSH_SERVER_CHANNEL_TIMEOUT_READY" = true ] && [ "$SSH_SERVER_UNUSED_CONNECTION_TIMEOUT_READY" = true ] && [ "$SSH_SERVER_PER_SOURCE_MAX_STARTUPS_READY" = true ]; then
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

# Detect whether the running sshd listener still uses an older config. A
# SIGHUP reload re-execs sshd in place, so the PID start time and systemd
# timestamps never change, and the "N of BEGIN-END startups" title only
# reflects MaxStartups (other changed keys stayed unloaded behind it). The
# load time is the later of the listener start and the reload stamp in /run
# (tmpfs, cleared with the listener on reboot); any config file newer than it
# needs a reload. This makes convergence self-healing instead of
# change-triggered: a previous run that wrote the config but never reloaded
# (crash, manual edit, interrupted run) is caught and reloaded here.
ssh_server_refresh_reload_needed() {
    SSH_SERVER_CONFIG_RELOAD_NEEDED=false
    SSH_SERVER_LISTENER_PID=""
    SSH_SERVER_LISTENER_AGE_SECONDS=0
    SSH_SERVER_LISTENER_TITLE=""
    SSH_SERVER_CONFIG_MTIME_EPOCH=0
    SSH_SERVER_NOW_EPOCH="$(date +%s)"
    SSH_SERVER_LOADED_EPOCH=0

    if [ "$SSH_SERVER_INIT_SYSTEM" = "systemd" ] && [ -n "$SSH_SERVER_SERVICE_NAME" ]; then
        SSH_SERVER_LISTENER_PID="$(systemctl show --property=MainPID --value "$SSH_SERVER_SERVICE_NAME.service" 2>/dev/null)"
    fi
    if ! [ "$SSH_SERVER_LISTENER_PID" -gt 0 ] 2>/dev/null; then
        SSH_SERVER_LISTENER_PID="$(pgrep -xo sshd 2>/dev/null)"
    fi
    if ! [ "$SSH_SERVER_LISTENER_PID" -gt 0 ] 2>/dev/null; then
        SSH_SERVER_LISTENER_PID=""
        return
    fi

    SSH_SERVER_LISTENER_TITLE="$(ps -o args= -p "$SSH_SERVER_LISTENER_PID" 2>/dev/null)"
    SSH_SERVER_LISTENER_AGE_SECONDS="$(ps -o etimes= -p "$SSH_SERVER_LISTENER_PID" 2>/dev/null | tr -d '[:space:]')"
    SSH_SERVER_CONFIG_MTIME_EPOCH="$(stat -c %Y "$SSH_SERVER_CONFIG_FILE" "$SSH_SERVER_CONFIG_DIR"/*.conf 2>/dev/null | sort -rn | head -1)"
    if [ -n "$SSH_SERVER_LISTENER_AGE_SECONDS" ]; then
        SSH_SERVER_LOADED_EPOCH=$((SSH_SERVER_NOW_EPOCH - SSH_SERVER_LISTENER_AGE_SECONDS))
    fi
    if [ -f "$SSH_SERVER_RELOAD_STAMP" ] && [ "$(stat -c %Y "$SSH_SERVER_RELOAD_STAMP" 2>/dev/null)" -gt "$SSH_SERVER_LOADED_EPOCH" ] 2>/dev/null; then
        SSH_SERVER_LOADED_EPOCH="$(stat -c %Y "$SSH_SERVER_RELOAD_STAMP")"
    fi
    if [ -n "$SSH_SERVER_CONFIG_MTIME_EPOCH" ] && [ "$SSH_SERVER_LOADED_EPOCH" -lt "$SSH_SERVER_CONFIG_MTIME_EPOCH" ]; then
        SSH_SERVER_CONFIG_RELOAD_NEEDED=true
    fi
}

ssh_server_apply_changed_config() {
    ssh_server_refresh_service
    ssh_server_refresh_reload_needed
    if [ "$SSH_SERVER_SERVICE_ACTIVE" = true ]; then
        if [ "$SSH_SERVER_CONFIG_CHANGED" = true ] || [ "$SSH_SERVER_CONFIG_RELOAD_NEEDED" = true ]; then
            echo "[SSH] Reloading the SSH configuration (files changed: $SSH_SERVER_CONFIG_CHANGED, listener older than config: $SSH_SERVER_CONFIG_RELOAD_NEEDED)..."
            if [ "$SSH_SERVER_INIT_SYSTEM" = "systemd" ]; then
                $USE_SUDO systemctl reload "$SSH_SERVER_SERVICE_NAME.service"
            elif [ "$SSH_SERVER_INIT_SYSTEM" = "sysv" ]; then
                $USE_SUDO service "$SSH_SERVER_SERVICE_NAME" reload
            fi
            $USE_SUDO touch "$SSH_SERVER_RELOAD_STAMP"
            ssh_server_refresh_service
        else
            echo "[SSH] Running sshd listener already matches the newest configuration."
        fi
    fi
}

# Transport-level drops (client NAT rebinding, roaming, middlebox RST) kill
# the TCP connection regardless of any sshd keepalive setting; the server-side
# cure is a persistent shell. This deploys an /etc/profile.d hook attaching
# interactive SSH logins to a stable tmux session, so reconnecting resumes the
# same shell. Session selection: a login attaches to the first session that is
# missing or has no attached clients (a dropped connection leaves its session
# unattached, so a reconnect resumes it); a second simultaneous window takes
# the next free name (main, main-2, main-3, ...) instead of mirroring the
# first window's input and screen. Non-interactive ssh/sftp/scp never source
# /etc/profile.d and the tty guards double-protect them; a tmux failure falls
# through to a plain login shell, so the hook can never lock users out.
ssh_server_ensure_session_persistence() {
    SSH_SERVER_TMUX_PERSISTENCE_READY=false
    if [ "$SSH_SERVER_TMUX_PERSISTENCE_ENABLED" != true ]; then
        return
    fi
    if ! command -v tmux >/dev/null 2>&1; then
        echo "[SSH] Installing the missing tmux package for persistent sessions..."
        $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y tmux
    fi
    if ! command -v tmux >/dev/null 2>&1; then
        echo "[SSH] tmux is unavailable; session persistence hook skipped."
        return
    fi
    write_file_if_changed "$SSH_SERVER_TMUX_PROFILE_HOOK" "" 644 root root <<EOF
# Managed by 23_setup_ssh_remote.sh (core_node). Do not edit by hand.
# Reconnect-resilient SSH: attach interactive logins to a persistent tmux
# session so a dropped transport no longer kills the running shell.
# A dropped connection leaves its session with no attached clients, so a
# reconnect resumes it; a second simultaneous window takes the next free
# session name instead of sharing (mirroring) the first window.
# Opt out per user: touch ~/$SSH_SERVER_TMUX_OPTOUT_FILE
if [ -n "\$SSH_CONNECTION" ] && [ -z "\$TMUX" ] && [ -t 0 ] && [ -t 1 ]; then
    if command -v tmux >/dev/null 2>&1 && [ ! -e "\$HOME/$SSH_SERVER_TMUX_OPTOUT_FILE" ]; then
        _ncore_tmux_session=""
        _ncore_tmux_index=1
        while [ -z "\$_ncore_tmux_session" ]; do
            _ncore_tmux_candidate="$SSH_SERVER_TMUX_SESSION_NAME"
            if [ "\$_ncore_tmux_index" -gt 1 ]; then
                _ncore_tmux_candidate="$SSH_SERVER_TMUX_SESSION_NAME-\$_ncore_tmux_index"
            fi
            if ! tmux has-session -t "\$_ncore_tmux_candidate" 2>/dev/null; then
                _ncore_tmux_session="\$_ncore_tmux_candidate"
            elif [ -z "\$(tmux list-clients -t "\$_ncore_tmux_candidate" 2>/dev/null)" ]; then
                _ncore_tmux_session="\$_ncore_tmux_candidate"
            else
                _ncore_tmux_index=\$((\$_ncore_tmux_index + 1))
            fi
        done
        unset _ncore_tmux_index _ncore_tmux_candidate
        tmux new-session -A -s "\$_ncore_tmux_session" && exit
    fi
fi
EOF
    if [ "$WRITE_FILE_READY" = true ]; then
        SSH_SERVER_TMUX_PERSISTENCE_READY=true
        echo "[SSH] Persistent tmux login hook is in place (base session: $SSH_SERVER_TMUX_SESSION_NAME, extra windows get numbered sessions, opt-out: touch ~/$SSH_SERVER_TMUX_OPTOUT_FILE)."
    else
        echo "[SSH] Failed to deploy the persistent tmux login hook."
    fi
}

# Reap unauthenticated sshd connection processes that outlived the login
# grace time. Reloaded sshd only applies LoginGraceTime to new connections,
# so pre-reload unauthenticated processes can hold MaxStartups slots forever.
# Pre-auth connections appear as "sshd: [accepted]" / "sshd: [net]" process
# pairs ("sshd-session:" on OpenSSH 9.8+); authenticated sessions always carry
# a user name and are never matched. Repeated runs are no-ops once none remain.
ssh_server_reap_stale_preauth() {
    SSH_SERVER_STALE_PREAUTH_PIDS=""
    SSH_SERVER_STALE_PREAUTH_REAPED=0

    SSH_SERVER_STALE_PREAUTH_PIDS="$(ps -eo pid=,etimes=,args= 2>/dev/null | awk -v max_age="$SSH_SERVER_PREAUTH_REAP_SECONDS" '$2 > max_age && /sshd(-session)?: (\[accepted\]|\[net\]|\[preauth\]|.*\[preauth\])/ { print $1 }')"

    if [ -n "$SSH_SERVER_STALE_PREAUTH_PIDS" ]; then
        SSH_SERVER_STALE_PREAUTH_REAPED="$(printf '%s\n' "$SSH_SERVER_STALE_PREAUTH_PIDS" | grep -c .)"
        echo "[SSH] Reaping $SSH_SERVER_STALE_PREAUTH_REAPED stale unauthenticated connection(s) older than ${SSH_SERVER_PREAUTH_REAP_SECONDS}s..."
        printf '%s\n' "$SSH_SERVER_STALE_PREAUTH_PIDS" | xargs -r $USE_SUDO kill 2>/dev/null
    else
        echo "[SSH] No stale unauthenticated connections to reap."
    fi
}

# Keep the systemd journal on disk. With the Debian default (Storage=auto and
# no /var/log/journal) every reboot erases the sshd/kernel history, so the
# reason a session or the whole host went down can no longer be traced.
# Size limits stay with journald.conf; this drop-in only pins the storage.
ssh_server_ensure_persistent_journal() {
    SSH_SERVER_JOURNAL_PERSISTENT_READY=false
    if [ ! -d /run/systemd/system ] || [ ! -x /usr/bin/journalctl ]; then
        return
    fi
    write_file_if_changed "$SSH_SERVER_JOURNALD_DROPIN" "" 644 root root <<EOF
[Journal]
Storage=persistent
EOF
    SSH_SERVER_JOURNAL_MACHINE_ID="$(cat /etc/machine-id 2>/dev/null)"
    if [ "$WRITE_FILE_CHANGED" = true ] || [ ! -d "$SSH_SERVER_JOURNAL_DIR/$SSH_SERVER_JOURNAL_MACHINE_ID" ]; then
        echo "[SSH] Enabling persistent journal storage..."
        $USE_SUDO mkdir -p "$SSH_SERVER_JOURNAL_DIR"
        $USE_SUDO systemd-tmpfiles --create --prefix "$SSH_SERVER_JOURNAL_DIR" 2>/dev/null
        $USE_SUDO systemctl restart systemd-journald
        $USE_SUDO journalctl --flush 2>/dev/null
    fi
    if [ "$WRITE_FILE_READY" = true ] && [ -d "$SSH_SERVER_JOURNAL_DIR/$SSH_SERVER_JOURNAL_MACHINE_ID" ]; then
        SSH_SERVER_JOURNAL_PERSISTENT_READY=true
        echo "[SSH] Persistent journal is active ($SSH_SERVER_JOURNAL_DIR)."
    else
        echo "[SSH] Persistent journal could not be enabled."
    fi
}
