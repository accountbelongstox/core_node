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
SCRIPT_INDEX="23"

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

# FIX RECORD 2026-09-18 (recurring "SSH session ended / Press any key to exit"):
# Diagnosis: journalctl showed authenticated sessions ending with only
# "pam_unix: session closed" and NO SSH disconnect message, and every session
# from the same client IP died at the same minute while the client egress IP
# rotated across 116.68.18.x/21.x/22.x. The TCP transport is broken by the
# client-side path (CGNAT/NAT rebinding, middlebox RST), not by sshd.
# Verified against the official sshd_config(5) manual
# (https://man.openbsd.org/sshd_config):
#   - ClientAliveCountMax 0 disables connection termination, so sshd never
#     kills idle or unresponsive clients (effective config confirmed:
#     clientaliveinterval 60 / clientalivecountmax 0).
#   - TCPKeepAlive no is kept on purpose: the manual warns that TCP keepalives
#     terminate connections on transient route disruptions.
#   - UnusedConnectionTimeout/ChannelTimeout are pinned to none.
# Conclusion: no sshd setting can prevent an externally RST/transport drop.
# Fix: ssh_server_ensure_session_persistence() now deploys an /etc/profile.d
# hook that lands interactive SSH logins inside a persistent tmux session, so
# a dropped connection no longer kills the running shell - reconnecting
# resumes exactly where the session left off. Client-side advice (cannot be
# deployed from here): set "ServerAliveInterval 30" in the SSH client config.
#
# FIX RECORD 2026-09-18 (two simultaneous SSH windows mirror each other):
# Symptom: with the hook above, every login ran "tmux new-session -A -s main",
# so two open windows attached to the SAME session and shared one current
# window - input typed in one window appeared in the other and both screens
# stayed in sync.
# Fix: the hook now picks the first session name (main, main-2, main-3, ...)
# that is missing or has no attached clients. A dropped connection leaves its
# session unattached, so a reconnect still resumes it, while a second
# simultaneous window gets its own session and no longer mirrors the first.
# Immediate manual disable for a user: touch ~/.ncore-no-auto-tmux and detach
# existing windows with Ctrl-b d (not exit, which would close the shell).
#
# FIX RECORD 2026-09-26 (SSH sessions still dropping):
# Diagnosis: sshd logged "Read error from remote host 116.68.18.105: Connection
# reset by peer" and the next login came from 116.68.18.40 - the client egress
# NAT mapping expired and was rebound to a new public IP, which RSTs the old
# TCP flow. sshd never initiated a disconnect (ClientAliveCountMax 0, no
# restart, no OOM, no TMOUT, no firewall). The host also rebooted at 19:13, but
# the volatile journal (no /var/log/journal) had erased every earlier boot, so
# neither the reboot nor older drops could be traced. PerSourcePenalties
# (OpenSSH 9.8+, man sshd_config) only refuses NEW connections from the single
# penalised address (PerSourceNetBlockSize 32) and never affects live sessions.
# Fix: ClientAliveInterval default lowered 60 -> 15 so the server keeps the
# client NAT mapping refreshed (each alive request forces a client reply; the
# 0 count max still never terminates a session), and
# ssh_server_ensure_persistent_journal() pins journald Storage=persistent so
# future drops and reboots stay diagnosable.

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
        ssh_server_reap_stale_preauth
        ssh_server_ensure_session_persistence
        ssh_server_ensure_persistent_journal
        detect_firewall false
        firewall_allow_port "$SSH_SERVER_PORT" "tcp" "SSH remote access"
    fi
fi

ssh_server_refresh_service
SSH_CONNECTION_USER="$(id -un 2>/dev/null)"
SSH_CONNECTION_IPS="$(hostname -I 2>/dev/null | awk '{$1=$1; print}')"

if [ "$SSH_SERVER_CONFIG_VALID" = true ] && [ "$SSH_SERVER_CONFIG_APPLIED" = true ] && [ "$SSH_SERVER_SERVICE_ACTIVE" = true ] && [ "$SSH_SERVER_SERVICE_ENABLED" = true ] && [ "$SSH_SERVER_RESTART_POLICY_READY" = true ]; then
    print_success_from_common_functions "SSH is configured, enabled, and running."
    print_info_from_common_functions "Idle sessions have no OpenSSH alive-message termination limit; alive requests every ${SSH_SERVER_CLIENT_ALIVE_INTERVAL}s keep client NAT mappings fresh."
    if [ "$SSH_SERVER_JOURNAL_PERSISTENT_READY" = true ]; then
        print_info_from_common_functions "The journal is persistent; trace past drops with: journalctl -u $SSH_SERVER_SERVICE_NAME -b -1"
    fi
    print_info_from_common_functions "Unauthenticated connections expire after ${SSH_SERVER_LOGIN_GRACE_TIME}s (LoginGraceTime) and are limited per source (PerSourceMaxStartups $SSH_SERVER_PER_SOURCE_MAX_STARTUPS, MaxStartups $SSH_SERVER_MAX_STARTUPS)."
    print_info_from_common_functions "Stale pre-auth connection holders are reaped on every run."
    print_info_from_common_functions "SSH restarts automatically after process termination."
    if [ "$SSH_SERVER_TMUX_PERSISTENCE_READY" = true ]; then
        print_info_from_common_functions "Interactive logins resume in persistent tmux sessions ('$SSH_SERVER_TMUX_SESSION_NAME', extra windows get numbered sessions); transport drops no longer kill the shell (opt out: touch ~/$SSH_SERVER_TMUX_OPTOUT_FILE)."
    fi
    print_info_from_common_functions "On the SSH client, set ServerAliveInterval 30 to detect dead paths faster (client-side only)."
    print_info_from_common_functions "Connect with: ssh -p $SSH_SERVER_PORT $SSH_CONNECTION_USER@${SSH_CONNECTION_IPS%% *}"
else
    print_error_from_common_functions "SSH convergence is incomplete. Review the messages above."
fi
