#!/bin/bash
# Shared helpers for hosts file: path, flush DNS. Used by github_host_refresh.sh and gitee_host_refresh.sh.

get_hosts_path() {
    HOSTS_PATH=""
    if [ -f "/etc/hosts" ]; then
        HOSTS_PATH="/etc/hosts"
    fi
}

flush_dns() {
    case "$(uname -s)" in
        Darwin)
            sudo killall -HUP mDNSResponder 2>/dev/null || true
            ;;
        Linux)
            command -v nscd >/dev/null 2>&1 && sudo nscd restart 2>/dev/null || sudo /etc/init.d/nscd restart 2>/dev/null || true
            command -v resolvectl >/dev/null 2>&1 && sudo resolvectl flush-caches 2>/dev/null || true
            command -v systemctl >/dev/null 2>&1 && systemctl is-active systemd-resolved >/dev/null 2>&1 && sudo systemctl restart systemd-resolved 2>/dev/null || true
            ;;
        *)
            command -v nscd >/dev/null 2>&1 && sudo nscd restart 2>/dev/null || true
            ;;
    esac
}
