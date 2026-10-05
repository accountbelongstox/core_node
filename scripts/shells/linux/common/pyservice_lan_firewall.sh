#!/usr/bin/env bash
# Allows the pycore RPC port in the firewall present (UFW/firewalld/iptables)
# when the system setting rpcLanBind is on. Root runs it directly (the pycore
# unit's ExecStartPre=+); other callers use non-interactive sudo.
# Usage: pyservice_lan_firewall.sh [setting_user] [port] [python]
set -uo pipefail

PLF_SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
PLF_REPO_ROOT="$(cd "$PLF_SCRIPT_DIR/../../../.." && pwd)"
PLF_FIREWALL_MANAGER="$PLF_SCRIPT_DIR/firewall_manager.sh"
PLF_GUARD_MODULE="pycore.pyutils.common.local_rpc_guard"
PLF_ENABLED_VALUE="true"
PLF_DEFAULT_PORT="59000"
PLF_RULE_COMMENT="pycore RPC (rpcLanBind)"
PLF_LOG_TAG="[pyservice-lan-firewall]"
PLF_USER="${1:-}"
PLF_PORT="${2:-}"
PLF_PY="${3:-}"
PLF_LAN_BIND=""

[[ "$(uname -s 2>/dev/null)" == "Linux" ]] || exit 0

if [[ -z "$PLF_PORT" ]]; then
    PLF_PORT="$(
        set +uo pipefail
        source "$PLF_SCRIPT_DIR/service_contract_common.sh" >/dev/null 2>&1
        sc_get ports.pycore_backend 2>/dev/null
    )"
    PLF_PORT="${PLF_PORT:-$PLF_DEFAULT_PORT}"
fi

if [[ -z "$PLF_PY" ]]; then
    PLF_PY="$(
        set +uo pipefail
        source "$PLF_SCRIPT_DIR/gvar_common.sh" >/dev/null 2>&1
        source "$PLF_SCRIPT_DIR/venv_python_common.sh" >/dev/null 2>&1
        [ -n "${VENV_PYTHON3:-}" ] && [ -x "$VENV_PYTHON3" ] && printf '%s' "$VENV_PYTHON3"
    )"
    PLF_PY="${PLF_PY:-$(command -v python3 2>/dev/null)}"
fi
[[ -n "$PLF_PY" ]] || { echo "$PLF_LOG_TAG No Python 3 found; skipping."; exit 0; }

# The setting belongs to the user the worker runs as.
if [[ "$(id -u)" == "0" && -n "$PLF_USER" && "$PLF_USER" != "root" ]]; then
    PLF_LAN_BIND="$(cd "$PLF_REPO_ROOT" && runuser -u "$PLF_USER" -- "$PLF_PY" -m "$PLF_GUARD_MODULE" 2>/dev/null | tail -n 1)"
else
    PLF_LAN_BIND="$(cd "$PLF_REPO_ROOT" && "$PLF_PY" -m "$PLF_GUARD_MODULE" 2>/dev/null | tail -n 1)"
fi
[[ "$PLF_LAN_BIND" == "$PLF_ENABLED_VALUE" ]] || exit 0

if [[ "$(id -u)" == "0" ]]; then
    USE_SUDO=""
elif sudo -n true 2>/dev/null; then
    USE_SUDO="sudo -n"
elif [[ -n "${INVOCATION_ID:-}" ]]; then
    # systemd unit: its root ExecStartPre already allowed the port.
    exit 0
else
    echo "$PLF_LOG_TAG [!] Not root and no password-free sudo: port $PLF_PORT is not allowed in the firewall; run once as root: sudo bash $0 $PLF_USER $PLF_PORT"
    exit 0
fi

# shellcheck source=/dev/null
source "$PLF_FIREWALL_MANAGER"
firewall_allow_port "$PLF_PORT" tcp "$PLF_RULE_COMMENT" \
    || echo "$PLF_LOG_TAG [!] Could not open port $PLF_PORT in the firewall; LAN devices may not reach pycore."
exit 0
