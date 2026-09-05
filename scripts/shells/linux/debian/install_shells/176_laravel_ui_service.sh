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

# pycore_laravel_wordnew_ui dashboard background service (ncore-nexus-dash).
# Fine-grained idempotent convergence, invoked by the 175 service-registration
# "y" branch and by the Service Manager install/reinstall action. File-state
# driven and safe to re-run at any time:
#   1. unit missing or ExecStart drifted -> rewrite unit (+ daemon-reload)
#   2. enable only when not enabled yet
#   3. start when inactive; restart only when the unit was rewritten
#   4. fully converged state -> report and touch nothing
# Runtime prerequisites (node/pnpm/deps) are owned by the unit's ExecStart
# (start.sh --serve), which self-heals them non-interactively under systemd.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
PARENT_DIR_LEVEL_3="$(dirname "$PARENT_DIR_LEVEL_2")"
PARENT_DIR_LEVEL_4="$(dirname "$PARENT_DIR_LEVEL_3")"
REPO_ROOT="$(dirname "$PARENT_DIR_LEVEL_4")"

UI_APP_ROOT="$REPO_ROOT/poly_apps/pycore_laravel_wordnew_ui"
UI_START="$UI_APP_ROOT/scripts/start.sh"
SERVICE_MANAGER="$REPO_ROOT/scripts/shells/linux/common/debian_service_manager.sh"
SYSTEMD_UNIT_FILE="/etc/systemd/system/ncore-nexus-dash.service"

SERVICE_NAME="ncore-nexus-dash"
SERVICE_DESC="Nexus Dash frontend (pycore_laravel_wordnew_ui)"
SERVICE_CPU="${SERVICE_CPU:-50%}"
SERVICE_MEM="${SERVICE_MEM:-}"
SERVICE_MEM_CAP_MB="${SERVICE_MEM_CAP_MB:-1024}"

RUN_MODE="dev"
FORCE_CONVERGE="no"
UNIT_REWRITTEN="no"
DESIRED_EXEC_CMD=""
CURRENT_EXEC_CMD=""
UNIT_ENABLED="no"
UNIT_ACTIVE="no"
USE_SUDO=""
SUDO_CMD=""
ARG=""

# Echo a systemd memory limit "<n>M" = min(total RAM / 4, cap_mb), floored at 128M.
compute_mem_limit() {
    local cap_mb="$1"
    local total_kb=0 total_mb=0 quarter=0
    total_kb="$(grep -m1 MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')"
    [ -n "$total_kb" ] || total_kb=0
    total_mb=$(( total_kb / 1024 ))
    quarter=$(( total_mb / 4 ))
    [ "$quarter" -lt 128 ] && quarter=128
    [ "$quarter" -gt "$cap_mb" ] && quarter="$cap_mb"
    echo "${quarter}M"
}

# True (0) when systemd is the active init and systemctl can actually operate.
systemd_available() {
    [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1
}

# Extract the current ExecStart command from the on-disk unit file (empty when absent).
read_current_exec_start() {
    if [ -f "$SYSTEMD_UNIT_FILE" ]; then
        grep '^ExecStart=' "$SYSTEMD_UNIT_FILE" 2>/dev/null | head -n 1 | cut -d= -f2-
    fi
}

# Write (or rewrite) the unit via the shared systemd service manager.
# restart_existing="no" keeps restart ownership HERE so a drifted unit is
# restarted exactly once by the converge flow below.
write_unit() {
    if [ "$(id -u)" -eq 0 ]; then
        (
            # Isolate the manager's top-level side effects (it sources gvar_common.sh).
            # shellcheck disable=SC1090
            source "$SERVICE_MANAGER"
            create_systemd_service "$SERVICE_NAME" "$SERVICE_DESC" "$DESIRED_EXEC_CMD" "$UI_APP_ROOT" "root" "always" "10s" "$SERVICE_CPU" "$SERVICE_MEM" "" "" "no"
        )
        return
    fi
    if [ -n "$SUDO_CMD" ]; then
        $SUDO_CMD bash -c '
            source "$1"
            create_systemd_service "$2" "$3" "$4" "$5" root always 10s "$6" "$7" "" "" no
        ' _ "$SERVICE_MANAGER" "$SERVICE_NAME" "$SERVICE_DESC" "$DESIRED_EXEC_CMD" "$UI_APP_ROOT" "$SERVICE_CPU" "$SERVICE_MEM"
        return
    fi
    echo "[ERROR] Need root (or sudo) to write $SYSTEMD_UNIT_FILE"
    return 1
}

converge_dashboard_service() {
    local probe=""

    if [ ! -f "$UI_START" ]; then
        echo "[ERROR] UI start script not found: $UI_START"
        return 1
    fi
    if ! systemd_available; then
        echo "[ERROR] systemd is not the active init (no /run/systemd/system); cannot register $SERVICE_NAME."
        return 1
    fi
    if [ ! -f "$SERVICE_MANAGER" ]; then
        echo "[ERROR] systemd service manager not found: $SERVICE_MANAGER"
        return 1
    fi

    if [ -z "$SERVICE_MEM" ]; then
        SERVICE_MEM="$(compute_mem_limit "$SERVICE_MEM_CAP_MB")"
    fi
    DESIRED_EXEC_CMD="bash ${UI_START} --serve --${RUN_MODE}"
    echo "[INFO] Service: $SERVICE_NAME (mode=$RUN_MODE, CPU=$SERVICE_CPU, Memory=$SERVICE_MEM, cap ${SERVICE_MEM_CAP_MB}M)"
    echo "[INFO] Desired ExecStart: $DESIRED_EXEC_CMD"

    CURRENT_EXEC_CMD="$(read_current_exec_start)"
    if [ "$FORCE_CONVERGE" != "yes" ] && [ -f "$SYSTEMD_UNIT_FILE" ] && [ "$CURRENT_EXEC_CMD" = "$DESIRED_EXEC_CMD" ]; then
        echo "[INFO] Unit file already matches (no rewrite)."
    else
        echo "[INFO] Writing unit file: $SYSTEMD_UNIT_FILE"
        write_unit || return 1
        UNIT_REWRITTEN="yes"
    fi

    probe="$($SUDO_CMD systemctl is-enabled "$SERVICE_NAME" 2>/dev/null)"
    if [ "$probe" = "enabled" ]; then
        UNIT_ENABLED="yes"
    else
        echo "[INFO] Enabling auto-start for $SERVICE_NAME"
        $SUDO_CMD systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
    fi

    if systemctl is-active --quiet "$SERVICE_NAME"; then
        UNIT_ACTIVE="yes"
        if [ "$UNIT_REWRITTEN" = "yes" ]; then
            echo "[INFO] Unit changed -> restarting $SERVICE_NAME"
            $SUDO_CMD systemctl restart "$SERVICE_NAME" || return 1
        else
            echo "[INFO] $SERVICE_NAME already running and converged (no restart)."
        fi
    else
        echo "[INFO] Starting $SERVICE_NAME"
        $SUDO_CMD systemctl start "$SERVICE_NAME" || return 1
    fi

    echo "[INFO] Service $SERVICE_NAME converged (enabled=$UNIT_ENABLED active=$UNIT_ACTIVE rewritten=$UNIT_REWRITTEN)."
    systemctl status "$SERVICE_NAME" --no-pager -l || true
    return 0
}

while [ "$#" -gt 0 ]; do
    ARG="$1"
    case "$ARG" in
        --dev) RUN_MODE="dev" ;;
        --dist) RUN_MODE="dist" ;;
        --force) FORCE_CONVERGE="yes" ;;
        -h|--help)
            echo "Usage: bash 176_laravel_ui_service.sh [--dev|--dist] [--force]"
            echo "  Idempotently converge the ncore-nexus-dash background service."
            echo "  --dev    ExecStart runs the Vite dev server (default)."
            echo "  --dist   ExecStart runs the production dist build."
            echo "  --force  Rewrite + restart the unit even when it already matches."
            exit 0
            ;;
        *)
            echo "[ERROR] Unknown argument: $ARG (see --help)"
            exit 2
            ;;
    esac
    shift
done

if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
    SUDO_CMD="sudo"
fi

converge_dashboard_service
