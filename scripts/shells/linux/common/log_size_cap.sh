#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# log_size_cap.sh - Bound the size of append-only files under /var/_core_node.
#
# /var/_core_node is the shared Linux runtime base (pycore
# system_paths.get_system_cache_dir() -> /var/_core_node; shell CORE_NODE_DATA_DIR).
# Several components append logs there with NO built-in cap (xrdp_monitor's
# monitor/connections/disconnects/errors/analysis logs, the mcp_chrome native-host
# logs, ...). This guard trims every *.log under the tree to a per-file byte cap,
# IN PLACE - it keeps the most recent tail and rewrites the SAME inode (O_TRUNC then
# write), so a process holding the file open with O_APPEND keeps writing at the new
# end and the freed disk is reclaimed.
#
# Idempotent; safe to SOURCE (use cap_log_file / cap_log_dir) or RUN directly, and can
# install a systemd timer so the cap holds continuously regardless of the writer.
#
# Usage:
#   bash log_size_cap.sh                       # cap *.log under /var/_core_node (10MB each)
#   bash log_size_cap.sh /var/_core_node 10485760
#   bash log_size_cap.sh --install-timer       # install + enable the 30-min cap timer
#   source log_size_cap.sh; cap_log_file <f> [bytes]; cap_log_dir <dir> [bytes]
# ---------------------------------------------------------------------------

LSC_DEFAULT_DIR="/var/_core_node"
LSC_DEFAULT_MAX=$((10 * 1024 * 1024))
LSC_TIMER_INTERVAL=1800

# Trim file $1 to its last ${2:-10MB} bytes, preserving the inode. No-op if small.
cap_log_file() {
    local f="$1" max="${2:-$LSC_DEFAULT_MAX}" sz tmp
    [ -f "$f" ] || return 0
    sz="$(stat -c %s "$f" 2>/dev/null || echo 0)"
    [ "${sz:-0}" -gt "$max" ] 2>/dev/null || return 0
    tmp="${f}.cap.$$"
    if tail -c "$max" "$f" > "$tmp" 2>/dev/null; then
        cat "$tmp" > "$f" 2>/dev/null || true
    fi
    rm -f "$tmp" 2>/dev/null || true
}

# Cap every *.log under dir $1 to ${2:-10MB} bytes.
cap_log_dir() {
    local dir="${1:-$LSC_DEFAULT_DIR}" max="${2:-$LSC_DEFAULT_MAX}" f
    [ -d "$dir" ] || return 0
    while IFS= read -r -d '' f; do
        cap_log_file "$f" "$max"
    done < <(find "$dir" -type f -name '*.log' -print0 2>/dev/null)
}

# Install a systemd timer that caps /var/_core_node logs every LSC_TIMER_INTERVAL.
lsc_install_timer() {
    command -v systemctl >/dev/null 2>&1 || { echo "[log-cap] systemctl not available."; return 0; }
    [ -w /etc/systemd/system ] || { echo "[log-cap] need root to install the timer."; return 0; }
    local self
    self="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
    cat > /etc/systemd/system/core-node-log-cap.service <<EOF
[Unit]
Description=Cap /var/_core_node log file sizes
[Service]
Type=oneshot
ExecStart=/usr/bin/env bash $self $LSC_DEFAULT_DIR $LSC_DEFAULT_MAX
EOF
    cat > /etc/systemd/system/core-node-log-cap.timer <<EOF
[Unit]
Description=Periodic /var/_core_node log size cap
[Timer]
OnBootSec=5min
OnUnitActiveSec=${LSC_TIMER_INTERVAL}s
AccuracySec=30s
Persistent=true
[Install]
WantedBy=timers.target
EOF
    systemctl daemon-reload 2>/dev/null || true
    systemctl enable --now core-node-log-cap.timer 2>/dev/null || true
    echo "[log-cap] installed core-node-log-cap.timer (every ${LSC_TIMER_INTERVAL}s; cap ${LSC_DEFAULT_MAX} bytes/file)."
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ "${1:-}" == "--install-timer" ]]; then
        lsc_install_timer
    else
        cap_log_dir "${1:-$LSC_DEFAULT_DIR}" "${2:-$LSC_DEFAULT_MAX}"
    fi
fi
