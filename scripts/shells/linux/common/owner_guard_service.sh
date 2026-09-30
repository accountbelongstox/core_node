#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# owner_guard_service.sh - root systemd unit that hands every entry a root
# process creates inside the repository back to the auto-detected real user.
#
# The watcher (owner_guard.py) implements no policy: it batches root-owned
# paths and applies fs_perm_helpers.sh (resolve_active_permission_owner +
# repair_owned_tree_777). The unit is written through the central
# create_systemd_service (systemd_service_manager.sh); the name comes from
# runtime_service_policy.sh. Every action is idempotent.
#
# Usage: owner_guard_service.sh install|status|restart|uninstall
# ---------------------------------------------------------------------------

OWNER_GUARD_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
OWNER_GUARD_REPO_ROOT="$(cd "$OWNER_GUARD_DIR/../../../.." && pwd)"
OWNER_GUARD_SCRIPT="$OWNER_GUARD_DIR/owner_guard.py"
OWNER_GUARD_GVAR_COMMON="$OWNER_GUARD_DIR/gvar_common.sh"
OWNER_GUARD_SYSTEMD_MANAGER="$OWNER_GUARD_DIR/systemd_service_manager.sh"
OWNER_GUARD_RUNTIME_POLICY="$OWNER_GUARD_DIR/runtime_service_policy.sh"
OWNER_GUARD_DESC="Core Node owner guard (hands root-created repo entries to the real user)"
OWNER_GUARD_CPU_LIMIT="20%"
OWNER_GUARD_MEMORY_LIMIT="256M"
OWNER_GUARD_RESTART_SEC="10s"
OWNER_GUARD_PYTHON=""
OWNER_GUARD_EXEC_START=""
OWNER_GUARD_ACTION="${1:-install}"

type detect_system_user >/dev/null 2>&1 || source "$OWNER_GUARD_GVAR_COMMON"
type create_systemd_service >/dev/null 2>&1 || source "$OWNER_GUARD_SYSTEMD_MANAGER"
source "$OWNER_GUARD_RUNTIME_POLICY"
OWNER_GUARD_SERVICE="$CORE_RUNTIME_OWNER_GUARD_SERVICE"
if [ -z "${USE_SUDO+x}" ]; then
    if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then USE_SUDO="sudo"; else USE_SUDO=""; fi
fi

owner_guard_log() { printf '[owner-guard-service] %s\n' "$1"; }

# System python3 only: the unit runs as root before any venv/user toolchain.
owner_guard_resolve_exec() {
    OWNER_GUARD_PYTHON="$(command -v /usr/bin/python3 2>/dev/null || command -v python3 2>/dev/null)"
    OWNER_GUARD_EXEC_START="$OWNER_GUARD_PYTHON $OWNER_GUARD_SCRIPT --root $OWNER_GUARD_REPO_ROOT"
}

owner_guard_service_install() {
    owner_guard_resolve_exec
    if ! command -v systemctl >/dev/null 2>&1; then
        owner_guard_log "systemctl not found; the owner guard needs systemd (skipped)."
        return
    fi
    if [ -z "$OWNER_GUARD_PYTHON" ]; then
        owner_guard_log "python3 not found; install it first (13_install_default_python.sh)."
        return
    fi
    owner_guard_log "Installing '$OWNER_GUARD_SERVICE' for $OWNER_GUARD_REPO_ROOT ..."
    create_systemd_service \
        "$OWNER_GUARD_SERVICE" "$OWNER_GUARD_DESC" "$OWNER_GUARD_EXEC_START" "$OWNER_GUARD_REPO_ROOT" \
        "root" "always" "$OWNER_GUARD_RESTART_SEC" "$OWNER_GUARD_CPU_LIMIT" "$OWNER_GUARD_MEMORY_LIMIT" \
        "" "" "yes"
    $USE_SUDO systemctl enable "$OWNER_GUARD_SERVICE" >/dev/null 2>&1 || true
    systemctl is-active --quiet "$OWNER_GUARD_SERVICE" || $USE_SUDO systemctl start "$OWNER_GUARD_SERVICE"
    owner_guard_service_status
}

owner_guard_service_status() {
    systemctl --no-pager --lines=5 status "$OWNER_GUARD_SERVICE" 2>/dev/null || owner_guard_log "'$OWNER_GUARD_SERVICE' is not installed."
}

owner_guard_service_restart() {
    $USE_SUDO systemctl restart "$OWNER_GUARD_SERVICE"
    owner_guard_service_status
}

owner_guard_service_uninstall() {
    $USE_SUDO systemctl disable --now "$OWNER_GUARD_SERVICE" >/dev/null 2>&1 || true
    $USE_SUDO rm -f "/etc/systemd/system/${OWNER_GUARD_SERVICE}.service"
    $USE_SUDO systemctl daemon-reload
    owner_guard_log "'$OWNER_GUARD_SERVICE' removed."
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "$OWNER_GUARD_ACTION" in
        install) owner_guard_service_install ;;
        status) owner_guard_service_status ;;
        restart) owner_guard_service_restart ;;
        uninstall) owner_guard_service_uninstall ;;
        *) owner_guard_log "Usage: $(basename "$0") install|status|restart|uninstall" ;;
    esac
fi
