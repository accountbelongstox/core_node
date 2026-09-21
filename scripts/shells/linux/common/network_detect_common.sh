#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Shared network environment detection. Single source of truth for:
# - enumerating local IPv4 interface addresses (the 175 IP_LIST probe)
# - resolving the public IPv4 through external echo services (the rustdesk
#   get_public_ip probe: api.ipify.org -> ifconfig.me -> icanhazip.com)
# - classifying addresses as LAN (RFC1918 / CGNAT 100.64.0.0/10, which is the
#   Tailscale range / loopback / link-local)
# - deciding whether this host is a public server (owns its public IP on a
#   local interface) or a LAN/desktop host (behind NAT, no public IP bound)
#
# Load-time side effect free; safe to source from any library or installer.

# Source-once guard: repeated `source` is a no-op.
if [ "${NETWORK_DETECT_COMMON_LOADED:-false}" = "true" ]; then
    return
fi
NETWORK_DETECT_COMMON_LOADED="true"

NET_ENV_PUBLIC_IP=""
NET_ENV_LOCAL_IPV4S=""
NET_ENV_TAILSCALE_IPV4=""
NET_ENV_IS_SERVER=""
NET_ENV_IS_LAN=""
NET_DETECT_IP=""

# Return 0 when the IPv4 argument is a LAN/non-public address:
# RFC1918, CGNAT 100.64.0.0/10 (Tailscale), loopback, link-local, 0.x.
net_ip_is_private() {
    local ip="$1"
    local second_octet=""
    case "$ip" in
        10.*|127.*|0.*) return 0 ;;
        192.168.*) return 0 ;;
        169.254.*) return 0 ;;
        100.6[4-9].*|100.[7-9][0-9].*|100.1[0-1][0-9].*|100.12[0-7].*) return 0 ;;
        172.*)
            second_octet="${ip#172.}"
            second_octet="${second_octet%%.*}"
            if [ -n "$second_octet" ] && [ "$second_octet" -ge 16 ] && [ "$second_octet" -le 31 ]; then
                return 0
            fi
            ;;
    esac
    return 1
}

# Echo every local IPv4 interface address (loopback excluded), one per line.
net_detect_local_ipv4s() {
    local ips=""
    if command -v ip >/dev/null 2>&1; then
        ips=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -vE '^127\.|^0\.')
    elif command -v ifconfig >/dev/null 2>&1; then
        ips=$(ifconfig 2>/dev/null | grep -E 'inet [0-9]' | grep -v 127.0.0.1 | awk '{print $2}' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$')
    else
        ips=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -vE '^127\.|^0\.|^$')
    fi
    printf '%s\n' "$ips" | sed '/^\s*$/d'
}

# Echo the public IPv4 seen by external echo services; return 1 when none
# answered with a valid address (no outbound connectivity is NOT an error).
net_detect_public_ip() {
    local public_ip=""
    public_ip=$(curl -s --max-time 4 https://api.ipify.org 2>/dev/null)
    if [ -z "$public_ip" ]; then
        public_ip=$(curl -s --max-time 4 https://ifconfig.me 2>/dev/null)
    fi
    if [ -z "$public_ip" ]; then
        public_ip=$(curl -s --max-time 4 https://icanhazip.com 2>/dev/null)
    fi
    public_ip=$(printf '%s' "$public_ip" | tr -d '[:space:]')
    if [[ "$public_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        printf '%s' "$public_ip"
        return 0
    fi
    return 1
}

# Echo the Tailscale IPv4 (100.64.0.0/10) when tailscaled is reachable; empty
# otherwise. Prefers the CLI, falls back to the tailscale0 interface probe.
net_detect_tailscale_ipv4() {
    local ts_ip=""
    if command -v tailscale >/dev/null 2>&1; then
        ts_ip=$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]')
    fi
    if [ -z "$ts_ip" ] && command -v ip >/dev/null 2>&1; then
        ts_ip=$(ip -4 addr show tailscale0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
    fi
    if [[ "$ts_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        printf '%s' "$ts_ip"
    fi
}

# Populate NET_ENV_* state. Server = the public IP is bound to a LOCAL
# interface (directly reachable from the internet); LAN = the public IP is
# only the NAT gateway's address (or is unresolvable), so no local interface
# owns a public address.
net_env_detect() {
    NET_ENV_PUBLIC_IP="$(net_detect_public_ip 2>/dev/null || true)"
    NET_ENV_LOCAL_IPV4S="$(net_detect_local_ipv4s)"
    NET_ENV_TAILSCALE_IPV4="$(net_detect_tailscale_ipv4)"
    NET_ENV_IS_SERVER="no"
    NET_ENV_IS_LAN="yes"

    if [ -n "$NET_ENV_PUBLIC_IP" ]; then
        while IFS= read -r NET_DETECT_IP; do
            [ -z "$NET_DETECT_IP" ] && continue
            if [ "$NET_DETECT_IP" = "$NET_ENV_PUBLIC_IP" ]; then
                NET_ENV_IS_SERVER="yes"
                NET_ENV_IS_LAN="no"
                break
            fi
        done <<< "$NET_ENV_LOCAL_IPV4S"
    fi
    # Fallback: a directly bound non-private interface address also proves
    # public reachability even when the echo services disagreed.
    if [ "$NET_ENV_IS_SERVER" = "no" ]; then
        while IFS= read -r NET_DETECT_IP; do
            [ -z "$NET_DETECT_IP" ] && continue
            if ! net_ip_is_private "$NET_DETECT_IP"; then
                NET_ENV_IS_SERVER="yes"
                NET_ENV_IS_LAN="no"
                break
            fi
        done <<< "$NET_ENV_LOCAL_IPV4S"
    fi
}
