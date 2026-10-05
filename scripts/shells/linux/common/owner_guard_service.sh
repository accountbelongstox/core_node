#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# owner_guard_service.sh - root systemd unit (part of the pyservice family,
# installed with the pycore unit by pycore_service.sh) that hands every entry a
# root process creates in the repository and in the pycore data dir
# (CORE_NODE_DATA_DIR) back to the auto-detected real user.
#
# The watcher (owner_guard.py) implements no policy: it batches root-owned
# paths and applies fs_perm_helpers.sh (resolve_active_permission_owner +
# repair_owned_tree_777). The unit is converged through the central
# converge_systemd_service (restart only when ExecStart/User/... change); the
# name comes from runtime_service_policy.sh. Hot reload lives in the watcher:
# policy edits apply on the next batch, a saved owner_guard.py re-execs itself.
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
OWNER_GUARD_AI_TOOLS_INSTALLER="$OWNER_GUARD_REPO_ROOT/scripts/shells/linux/debian/install_shells/99_install_ai_tools.sh"
OWNER_GUARD_SHARED_LOGIN_DIRS=""
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

# Shared AI CLI config dirs (CLAUDE_CONFIG_DIR, CODEX_HOME, ...) in the real user's home: a root AI CLI
# session rewrites its login files there as root:root 0600, which locks the desktop user's own session
# out until the next sweep. Resolved from the catalog (99_install_ai_tools.sh, library mode).
owner_guard_shared_login_dirs() {
    [ -f "$OWNER_GUARD_AI_TOOLS_INSTALLER" ] || return 0
    (
        AI99_CATALOG_ONLY=1
        . "$OWNER_GUARD_AI_TOOLS_INSTALLER" >/dev/null 2>&1
        ai_shared_login_existing_config_dirs 2>/dev/null | tr '\n' ' ' | sed 's/ *$//'
    )
}

# System python3 only: the unit runs as root before any venv/user toolchain.
owner_guard_resolve_exec() {
    OWNER_GUARD_PYTHON="$(command -v /usr/bin/python3 2>/dev/null || command -v python3 2>/dev/null)"
    OWNER_GUARD_SHARED_LOGIN_DIRS="$(owner_guard_shared_login_dirs)"
    OWNER_GUARD_EXEC_START="$OWNER_GUARD_PYTHON $OWNER_GUARD_SCRIPT --root $OWNER_GUARD_REPO_ROOT ${CORE_NODE_DATA_DIR:-}"
    [ -z "$OWNER_GUARD_SHARED_LOGIN_DIRS" ] || OWNER_GUARD_EXEC_START="$OWNER_GUARD_EXEC_START --owner-only $OWNER_GUARD_SHARED_LOGIN_DIRS"
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
    owner_guard_log "Converging '$OWNER_GUARD_SERVICE' (roots: $OWNER_GUARD_REPO_ROOT ${CORE_NODE_DATA_DIR:-}) ..."
    converge_systemd_service \
        "$OWNER_GUARD_SERVICE" "$OWNER_GUARD_DESC" "$OWNER_GUARD_EXEC_START" "$OWNER_GUARD_REPO_ROOT" \
        "root" "always" "$OWNER_GUARD_RESTART_SEC" "$OWNER_GUARD_CPU_LIMIT" "$OWNER_GUARD_MEMORY_LIMIT"
    owner_guard_log "unit ${SYSTEMD_CONVERGE_STATE:-failed}, restarted=${SYSTEMD_CONVERGE_RESTARTED:-no} ${SYSTEMD_CONVERGE_REASON:-}"
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
