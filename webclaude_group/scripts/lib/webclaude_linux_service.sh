#!/usr/bin/env bash
# Shared helpers: optional systemd install + firewall allow (sources core_node firewall/service libs).
# Sourced by webclaude component start.sh scripts on Linux only.

wc_lib_resolve_paths() {
    local here=""
    here="${BASH_SOURCE[0]}"
    local lib_dir=""
    lib_dir="$(cd "$(dirname "$here")" && pwd)"
    local scripts_dir=""
    scripts_dir="$(cd "$lib_dir/.." && pwd)"
    local group_root=""
    group_root="$(cd "$scripts_dir/.." && pwd)"
    WC_CORE_NODE="$(cd "$group_root/.." && pwd)"
    WC_FIREWALL_SH="$WC_CORE_NODE/scripts/shells/linux/common/firewall_manager.sh"
    WC_SERVICE_SH="$WC_CORE_NODE/scripts/shells/linux/common/debian_service_manager.sh"
}

# Offer systemd install + firewall for a listening TCP port (skipped if no firewall / inactive).
# Args: service_name description workdir exec_command [tcp_port]
# Returns 0 if user chose y and install succeeded (caller should exit without starting foreground).
# Returns 1 to continue with normal foreground start.
wc_offer_systemd_service() {
    local service_name=""
    local description=""
    local workdir=""
    local exec_command=""
    local tcp_port=""
    service_name="${1:-}"
    description="${2:-}"
    workdir="${3:-}"
    exec_command="${4:-}"
    tcp_port="${5:-}"

    wc_lib_resolve_paths

    if [[ "$(uname -s)" != "Linux" ]]; then
        return 1
    fi
    if ! command -v systemctl >/dev/null 2>&1; then
        return 1
    fi
    if ! systemctl is-system-running >/dev/null 2>&1; then
        return 1
    fi
    if [[ ! -f "$WC_SERVICE_SH" ]] || [[ ! -f "$WC_FIREWALL_SH" ]]; then
        return 1
    fi
    if [[ -n "${WEBCLAUDE_SKIP_SERVICE_PROMPT:-}" ]]; then
        return 1
    fi
    if [[ ! -t 0 ]]; then
        return 1
    fi
    if ! command -v sudo >/dev/null 2>&1; then
        return 1
    fi

    local ans=""
    read -r -p "Install as systemd service (requires sudo)? [y/N] " ans || true
    ans="${ans,,}"
    if [[ "$ans" != "y" ]]; then
        return 1
    fi

    if [[ -n "$tcp_port" ]] && [[ "$tcp_port" =~ ^[0-9]+$ ]]; then
        # shellcheck source=/dev/null
        source "$WC_FIREWALL_SH"
        detect_firewall false
        firewall_allow_port "$tcp_port" tcp "WebClaude ${service_name}"
    fi

    local b64=""
    b64=$(printf '%s' "$exec_command" | base64 -w0 2>/dev/null || printf '%s' "$exec_command" | base64 | tr -d '\n')

    local install_script=""
    install_script="$(mktemp)"
    {
        echo '#!/bin/bash'
        echo 'set -euo pipefail'
        printf 'source %q\n' "$WC_SERVICE_SH"
        echo "exec_cmd=\$(printf '%s' '${b64}' | base64 -d)"
        printf 'create_systemd_service %q %q "$exec_cmd" %q root always 10s\n' "$service_name" "$description" "$workdir"
        printf 'systemctl enable --now %q\n' "$service_name"
    } > "$install_script"
    chmod +x "$install_script"

    if ! sudo bash "$install_script"; then
        rm -f "$install_script"
        echo "[WARN] systemd service install failed; starting in foreground."
        return 1
    fi
    rm -f "$install_script"

    echo ""
    echo "[OK] Service installed and started: ${service_name}.service"
    echo "[INFO] Follow logs:"
    echo "       sudo journalctl -u ${service_name} -f"
    echo ""
    return 0
}
