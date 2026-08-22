#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
POSTFIX_CLEANUP_COMMON="$COMMON_DIR/postfix_cleanup_common.sh"
source "$COMMON_DIR/common_functions.sh"

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
#
# Merged cloud-monitor removal: Aliyun (Aegis/CloudMonitor), Huawei (Hostguard),
# Tencent (Sgagent/BaradAgent/YunJing/TAT). Replaces former index 3/4/5 scripts.
# Every step is idempotent: components that are absent are detected and skipped.

# Variable Declarations (declared at top per project rules)
SCRIPT_INDEX="1"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
ALIYUN_WORK_DIR=""
TENCENT_TEMP_DIR=""
TENCENT_REMOVE_SCRIPT=""
POSTFIX_LOG_PREFIX="[$SCRIPT_INDEX] [POSTFIX]"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$POSTFIX_CLEANUP_COMMON"

# -----------------------------------------------------------------------------
# Aliyun: Aegis / CloudMonitor / assist-daemon
# -----------------------------------------------------------------------------
stop_aliyun_cloudmonitor() {
    echo "[$SCRIPT_INDEX] === Aliyun (Aegis / CloudMonitor) ==="

    # Skip entirely when no aliyun/aegis footprint exists (idempotent skip).
    if ! systemctl list-units --full -all 2>/dev/null | grep -Fqi "aliyun" \
        && ! systemctl list-units --full -all 2>/dev/null | grep -Fqi "aegis" \
        && [ ! -d /usr/local/aegis ] \
        && [ ! -e /usr/sbin/aliyun-service ] \
        && [ ! -f /etc/init.d/aliyun ]; then
        echo "[$SCRIPT_INDEX] No Aliyun monitor components found, skipping."
        return 0
    fi

    if systemctl is-active --quiet aliyun.service 2>/dev/null; then
        echo "[$SCRIPT_INDEX] aliyun.service is running, downloading official uninstallers..."
        ALIYUN_WORK_DIR="$(create_script_temp_dir "3_stop_aliyun_cloudmonitor" 2>/dev/null || echo "/tmp/_core_node_aliyun")"
        mkdir -p "$ALIYUN_WORK_DIR"
        (
            cd "$ALIYUN_WORK_DIR" || exit 0
            $USE_SUDO wget -q "http://update2.aegis.aliyun.com/download/uninstall.sh" -O uninstall.sh && chmod +x uninstall.sh && $USE_SUDO ./uninstall.sh
            $USE_SUDO wget -q "http://update.aegis.aliyun.com/download/quartz_uninstall.sh" -O quartz_uninstall.sh && chmod +x quartz_uninstall.sh && $USE_SUDO ./quartz_uninstall.sh
        )
    fi

    # Stop/disable services if present.
    if systemctl list-units --full -all 2>/dev/null | grep -Fqi "aliyun"; then
        echo "[$SCRIPT_INDEX] Stopping/disabling aliyun service..."
        $USE_SUDO systemctl stop aliyun 2>/dev/null || true
        $USE_SUDO systemctl disable aliyun 2>/dev/null || true
    fi
    if systemctl list-units --full -all 2>/dev/null | grep -Fqi "aegis"; then
        echo "[$SCRIPT_INDEX] Stopping/disabling aegis service..."
        $USE_SUDO systemctl stop aegis 2>/dev/null || true
        $USE_SUDO systemctl disable aegis 2>/dev/null || true
    fi

    # Process and file cleanup (each guarded, safe to re-run).
    pgrep -f aliyun-service >/dev/null 2>&1 && $USE_SUDO pkill aliyun-service 2>/dev/null || true
    [ -e /etc/init.d/agentwatch ] && $USE_SUDO rm -f /etc/init.d/agentwatch || true
    [ -e /usr/sbin/aliyun-service ] && $USE_SUDO rm -f /usr/sbin/aliyun-service || true
    [ -e /etc/init.d/aliyun ] && $USE_SUDO rm -f /etc/init.d/aliyun || true
    ls -d /usr/local/aegis* >/dev/null 2>&1 && $USE_SUDO rm -rf /usr/local/aegis* || true
    [ -d /usr/local/share/assist-daemon ] && $USE_SUDO rm -rf /usr/local/share/assist-daemon || true
    [ -d /usr/local/share/aliyun-assist ] && $USE_SUDO rm -rf /usr/local/share/aliyun-assist || true

    echo "[$SCRIPT_INDEX] Aliyun cleanup completed."
}

# -----------------------------------------------------------------------------
# Huawei: Hostguard
# -----------------------------------------------------------------------------
stop_huawei_hostguard() {
    echo "[$SCRIPT_INDEX] === Huawei (Hostguard) ==="

    if [ ! -f /etc/init.d/hostguard ] \
        && [ ! -d /usr/local/hostguard ] \
        && ! dpkg -l 2>/dev/null | grep -q hostguard \
        && ! pgrep -f hostguard >/dev/null 2>&1 \
        && ! systemctl list-units --full -all 2>/dev/null | grep -qi hostguard; then
        echo "[$SCRIPT_INDEX] No Hostguard components found, skipping."
        return 0
    fi

    # Stop the service via init script or systemd.
    if [ -f /etc/init.d/hostguard ]; then
        echo "[$SCRIPT_INDEX] Stopping Hostguard via init script..."
        $USE_SUDO /etc/init.d/hostguard stop 2>/dev/null || true
    elif systemctl list-units --full -all 2>/dev/null | grep -qi hostguard; then
        echo "[$SCRIPT_INDEX] Stopping Hostguard via systemctl..."
        $USE_SUDO systemctl stop hostguard 2>/dev/null || true
    fi

    # Uninstall package if installed.
    if dpkg -l 2>/dev/null | grep -q hostguard; then
        echo "[$SCRIPT_INDEX] Removing Hostguard package..."
        $USE_SUDO dpkg -P hostguard 2>/dev/null || true
    fi

    # Kill residual processes and remove leftover files.
    if pgrep -f hostguard >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Killing residual Hostguard processes..."
        $USE_SUDO pkill -9 -f hostguard 2>/dev/null || true
    fi
    [ -d /usr/local/hostguard ] && $USE_SUDO rm -rf /usr/local/hostguard || true
    [ -f /etc/init.d/hostguard ] && $USE_SUDO rm -f /etc/init.d/hostguard || true

    echo "[$SCRIPT_INDEX] Hostguard cleanup completed."
}

# -----------------------------------------------------------------------------
# Tencent: Sgagent / BaradAgent / YunJing / TAT Agent
# -----------------------------------------------------------------------------
stop_tencent_agents() {
    echo "[$SCRIPT_INDEX] === Tencent (Sgagent / BaradAgent / YunJing / TAT) ==="

    if [ ! -d /usr/local/qcloud ] \
        && ! systemctl list-unit-files 2>/dev/null | grep -q "tat_agent.service" \
        && ! pgrep -f "tat_agent|sgagent|baradagent|yunjing" >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] No Tencent monitor components found, skipping."
        return 0
    fi

    # TAT Agent (systemd + processes).
    if systemctl list-unit-files 2>/dev/null | grep -q "tat_agent.service"; then
        echo "[$SCRIPT_INDEX] Stopping/disabling TAT Agent..."
        $USE_SUDO systemctl stop tat_agent 2>/dev/null || true
        $USE_SUDO systemctl disable tat_agent 2>/dev/null || true
        if [ -f /etc/systemd/system/tat_agent.service ]; then
            $USE_SUDO rm -f /etc/systemd/system/tat_agent.service
            $USE_SUDO systemctl daemon-reload 2>/dev/null || true
        fi
    fi
    if pgrep -f tat_agent >/dev/null 2>&1; then
        $USE_SUDO pkill -9 -f tat_agent 2>/dev/null || true
    fi

    # Sgagent.
    if [ -d /usr/local/qcloud/stargate/admin ]; then
        echo "[$SCRIPT_INDEX] Stopping/uninstalling Sgagent..."
        ( cd /usr/local/qcloud/stargate/admin && [ -x ./stop.sh ] && $USE_SUDO ./stop.sh ) 2>/dev/null || true
        ( cd /usr/local/qcloud/stargate/admin && [ -x ./uninstall.sh ] && $USE_SUDO ./uninstall.sh ) 2>/dev/null || true
    fi
    [ -f /etc/cron.d/sgagenttask ] && $USE_SUDO rm -f /etc/cron.d/sgagenttask || true
    if crontab -l 2>/dev/null | grep -q "stargate"; then
        crontab -l 2>/dev/null | grep -v "stargate" | crontab - 2>/dev/null || true
    fi

    # BaradAgent.
    if [ -d /usr/local/qcloud/monitor/barad/admin ]; then
        echo "[$SCRIPT_INDEX] Stopping/uninstalling BaradAgent..."
        ( cd /usr/local/qcloud/monitor/barad/admin && [ -x ./stop.sh ] && $USE_SUDO ./stop.sh ) 2>/dev/null || true
        ( cd /usr/local/qcloud/monitor/barad/admin && [ -x ./uninstall.sh ] && $USE_SUDO ./uninstall.sh ) 2>/dev/null || true
    fi

    # YunJing.
    if [ -d /usr/local/qcloud/YunJing ]; then
        echo "[$SCRIPT_INDEX] Stopping/uninstalling YunJing..."
        ( cd /usr/local/qcloud/YunJing && [ -x ./stop.sh ] && $USE_SUDO ./stop.sh ) 2>/dev/null || true
        ( cd /usr/local/qcloud/YunJing && [ -x ./uninst.sh ] && $USE_SUDO ./uninst.sh ) 2>/dev/null || true
    fi

    # Best-effort external remove script (only when a footprint remains).
    if [ -d /usr/local/qcloud ]; then
        TENCENT_TEMP_DIR="$(create_script_temp_dir "3_stop_tencent_cloudmonitor" 2>/dev/null || echo "/tmp/_core_node_tencent")"
        mkdir -p "$TENCENT_TEMP_DIR"
        TENCENT_REMOVE_SCRIPT="$TENCENT_TEMP_DIR/remove.sh"
        if [ ! -f "$TENCENT_REMOVE_SCRIPT" ]; then
            if command -v wget >/dev/null 2>&1; then
                wget -qO "$TENCENT_REMOVE_SCRIPT" "https://cdn.jsdelivr.net/gh/lufei/TencentAgentRemove@master/remove.sh" 2>/dev/null || true
            elif command -v curl >/dev/null 2>&1; then
                curl -sL "https://cdn.jsdelivr.net/gh/lufei/TencentAgentRemove@master/remove.sh" -o "$TENCENT_REMOVE_SCRIPT" 2>/dev/null || true
            fi
        fi
        if [ -s "$TENCENT_REMOVE_SCRIPT" ]; then
            echo "[$SCRIPT_INDEX] Running external Tencent remove script..."
            $USE_SUDO bash "$TENCENT_REMOVE_SCRIPT" 2>/dev/null || echo "[$SCRIPT_INDEX] External remove script finished (errors expected if components absent)."
        fi
    fi

    echo "[$SCRIPT_INDEX] Tencent cleanup completed."
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
echo "[$SCRIPT_INDEX] Stopping, disabling, and cleaning Postfix..."
postfix_stop_disable_and_cleanup
echo ""
echo "[$SCRIPT_INDEX] Stopping cloud-provider monitoring agents (Aliyun / Huawei / Tencent)..."
echo ""
stop_aliyun_cloudmonitor
echo ""
stop_huawei_hostguard
echo ""
stop_tencent_agents
echo ""
echo "[$SCRIPT_INDEX] All cloud-monitor components have been processed."
