#!/usr/bin/env bash
# Standalone helper: open the TCP port used by server.py in the local firewall.
# Targets Ubuntu/Debian-style stacks (UFW, firewalld, iptables). Reads port from
# server_config.json in this directory. If no firewall is active, does nothing.
# All privileged operations are prefixed with sudo when not root.
# This file intentionally does not source other project scripts.

set +e

SCRIPT_DIR=""
CONFIG_JSON=""
LISTEN_PORT=""
SUDO_CMD=""
OS_LINE=""
UNAME_S=""
ACTION_TAKEN="none"
IPT_COARSE_ACTIVE="no"
IPT_RULE_PRESENT="no"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
CONFIG_JSON="$SCRIPT_DIR/server_config.json"

log() { printf '%s\n' "$*"; }
log_section() {
  log ""
  log "============================================================"
  log " $1"
  log "============================================================"
}

# Resolve sudo: always print what we use (no reliance on exit codes for flow).
resolve_privilege_escalation() {
  SUDO_CMD=""
  local uid_line
  uid_line="$(id -u 2>&1)" || true
  log "[DETAIL] id -u raw output: ${uid_line:-<empty>}"
  if [[ "$uid_line" == "0" ]]; then
    log "[INFO] Running as root; commands will not use sudo."
    SUDO_CMD=""
    return
  fi
  if command -v sudo >/dev/null 2>&1; then
    SUDO_CMD="sudo"
    log "[INFO] Non-root user; will prefix privileged commands with: sudo"
  else
    SUDO_CMD=""
    log "[WARN] Non-root and sudo not found; firewall changes may fail or be skipped."
  fi
}

# Build argv with optional sudo at the front.
with_priv() {
  if [[ -n "$SUDO_CMD" ]]; then
    "$SUDO_CMD" "$@"
  else
    "$@"
  fi
}

# Run a privileged command via with_priv; print full combined stdout/stderr.
run_priv_capture() {
  local title="$1"
  shift
  log "[RUN] $title"
  if [[ -n "$SUDO_CMD" ]]; then
    log "[CMD] sudo $*"
  else
    log "[CMD] $*"
  fi
  local buf
  buf="$(with_priv "$@" 2>&1)" || true
  log "[STDOUT+STDERR]"
  printf '%s\n' "$buf"
  log "[END]"
}

# Read listen port from server_config.json (default 18765, same as server.py).
read_listen_port() {
  LISTEN_PORT=""
  if [[ ! -f "$CONFIG_JSON" ]]; then
    log "[WARN] Config missing: $CONFIG_JSON - using default port 18765."
    LISTEN_PORT="18765"
    return
  fi
  local py_out
  py_out="$(python3 -c "
import json, sys
path = sys.argv[1]
with open(path, encoding='utf-8') as f:
    cfg = json.load(f)
print(int(cfg.get('port', 18765)))
" "$CONFIG_JSON" 2>&1)" || true
  log "[DETAIL] python port reader output: ${py_out:-<empty>}"
  if [[ "$py_out" =~ ^[1-9][0-9]*$ ]] && [[ "$py_out" -le 65535 ]]; then
    LISTEN_PORT="$py_out"
    log "[OK] Listen port from config: $LISTEN_PORT (TCP)"
    return
  fi
  local fallback
  fallback="$(grep -Eo '"port"[[:space:]]*:[[:space:]]*[0-9]+' "$CONFIG_JSON" 2>/dev/null | grep -Eo '[0-9]+$' | head -1)" || true
  log "[DETAIL] grep fallback port token: ${fallback:-<none>}"
  if [[ "$fallback" =~ ^[1-9][0-9]*$ ]] && [[ "$fallback" -le 65535 ]]; then
    LISTEN_PORT="$fallback"
    log "[OK] Listen port from grep fallback: $LISTEN_PORT (TCP)"
    return
  fi
  LISTEN_PORT="18765"
  log "[WARN] Could not parse port; using default 18765."
}

probe_os() {
  UNAME_S="$(uname -s 2>&1)" || true
  log "[DETAIL] uname -s: ${UNAME_S:-<empty>}"
  if [[ -r /etc/os-release ]]; then
    OS_LINE="$(grep -E '^(NAME|VERSION|ID)=' /etc/os-release 2>/dev/null | tr '\n' ' ')" || true
    log "[DETAIL] /etc/os-release (subset): ${OS_LINE:-<empty>}"
  else
    log "[DETAIL] /etc/os-release not readable; continuing anyway."
  fi
}

tool_path() {
  local name="$1"
  local p
  p="$(command -v "$name" 2>/dev/null)" || true
  if [[ -n "$p" ]]; then
    log "[PROBE] Found $name at: $p"
  else
    log "[PROBE] $name: not in PATH"
  fi
}

probe_firewall_tools() {
  log_section "Software probe (firewall-related)"
  tool_path ufw
  tool_path firewall-cmd
  tool_path iptables
  tool_path iptables-save
  tool_path nft
  tool_path netfilter-persistent
}

# --- UFW (Ubuntu/Debian default metapackage) ---
try_ufw() {
  local ufw_bin
  ufw_bin="$(command -v ufw 2>/dev/null)" || true
  if [[ -z "$ufw_bin" ]]; then
    log "[UFW] Not installed; skipping UFW branch."
    return
  fi
  local st
  st="$(with_priv ufw status 2>&1)" || true
  log "[UFW] Full status output:"
  printf '%s\n' "$st"
  if printf '%s' "$st" | grep -q "Status: active"; then
    log "[UFW] Firewall is active - adding rule for TCP $LISTEN_PORT."
    run_priv_capture "ufw allow" ufw allow "$LISTEN_PORT"/tcp comment "file_sync_v2 server"
    ACTION_TAKEN="ufw"
    return
  fi
  if printf '%s' "$st" | grep -q "Status: inactive"; then
    log "[UFW] Installed but inactive - skip (no rule added; port already unrestricted by UFW)."
    return
  fi
  log "[UFW] Could not classify status string - no UFW rule added."
}

# --- firewalld (less common on Debian but supported) ---
try_firewalld() {
  if [[ "$ACTION_TAKEN" != "none" ]]; then
    return
  fi
  local fwc
  fwc="$(command -v firewall-cmd 2>/dev/null)" || true
  if [[ -z "$fwc" ]]; then
    log "[firewalld] Not installed; skipping."
    return
  fi
  local st
  st="$(with_priv firewall-cmd --state 2>&1)" || true
  log "[firewalld] firewall-cmd --state output: ${st:-<empty>}"
  if [[ "$st" == "running" ]]; then
    log "[firewalld] Running - adding permanent TCP port $LISTEN_PORT."
    run_priv_capture "firewall-cmd permanent add-port" firewall-cmd --permanent --add-port="$LISTEN_PORT"/tcp
    run_priv_capture "firewall-cmd reload" firewall-cmd --reload
    ACTION_TAKEN="firewalld"
    return
  fi
  log "[firewalld] Not running - skip."
}

# Count filter table chain headers as a coarse "iptables in use" signal.
iptables_chain_count() {
  local listing
  listing="$(with_priv iptables -L -n 2>&1)" || true
  printf '%s' "$listing" | grep -c "^Chain" || true
}

# Heuristic: many chains usually means a real ruleset (not only empty defaults).
iptables_eval_coarse_active() {
  IPT_COARSE_ACTIVE="no"
  local n
  n="$(iptables_chain_count)"
  log "[iptables] Chain header count (coarse activity signal): $n"
  if [[ "$n" =~ ^[0-9]+$ ]] && [[ "$n" -gt 3 ]]; then
    log "[iptables] Treating netfilter/iptables ruleset as active."
    IPT_COARSE_ACTIVE="yes"
    return
  fi
  log "[iptables] Ruleset looks minimal - skip iptables modifications."
}

iptables_eval_rule_present_tcp() {
  IPT_RULE_PRESENT="no"
  local save_out
  save_out="$(with_priv iptables-save -t filter 2>&1)" || true
  if printf '%s' "$save_out" | grep -qE -- "-A INPUT .* -p tcp .*--dport ${LISTEN_PORT}( |).* -j ACCEPT"; then
    log "[iptables] A matching ACCEPT rule for tcp dport $LISTEN_PORT appears to exist."
    IPT_RULE_PRESENT="yes"
    return
  fi
  if printf '%s' "$save_out" | grep -qE -- "--dport ${LISTEN_PORT}"; then
    log "[DETAIL] iptables-save mentions dport $LISTEN_PORT but pattern may differ; inspect rules manually if needed."
  fi
}

save_iptables_persistent() {
  local nfp
  nfp="$(command -v netfilter-persistent 2>/dev/null)" || true
  if [[ -n "$nfp" ]]; then
    run_priv_capture "netfilter-persistent save" netfilter-persistent save
    return
  fi
  local ipt_save
  ipt_save="$(command -v iptables-save 2>/dev/null)" || true
  if [[ -n "$ipt_save" ]]; then
    run_priv_capture "mkdir /etc/iptables" mkdir -p /etc/iptables
    run_priv_capture "iptables-save to rules.v4" sh -c "iptables-save > /etc/iptables/rules.v4"
    return
  fi
  log "[iptables] No netfilter-persistent or iptables-save in PATH; rules may not survive reboot."
}

try_iptables() {
  if [[ "$ACTION_TAKEN" != "none" ]]; then
    return
  fi
  local ipt_bin
  ipt_bin="$(command -v iptables 2>/dev/null)" || true
  if [[ -z "$ipt_bin" ]]; then
    log "[iptables] iptables not installed; skipping."
    return
  fi
  iptables_eval_coarse_active
  if [[ "$IPT_COARSE_ACTIVE" != "yes" ]]; then
    return
  fi
  iptables_eval_rule_present_tcp
  if [[ "$IPT_RULE_PRESENT" == "yes" ]]; then
    log "[iptables] Rule already present - nothing inserted."
    ACTION_TAKEN="iptables-already"
    return
  fi
  log "[iptables] Inserting INPUT ACCEPT for tcp dport $LISTEN_PORT."
  run_priv_capture "iptables -I INPUT" iptables -I INPUT -p tcp --dport "$LISTEN_PORT" -j ACCEPT -m comment --comment "file_sync_v2 server"
  save_iptables_persistent
  ACTION_TAKEN="iptables"
}

note_nft() {
  local nft_bin
  nft_bin="$(command -v nft 2>/dev/null)" || true
  if [[ -z "$nft_bin" ]]; then
    return
  fi
  local ruleset
  ruleset="$(with_priv nft list ruleset 2>&1)" || true
  log "[nft] ruleset listing (first 40 lines, if any):"
  printf '%s\n' "$ruleset" | head -40
  local nft_err
  nft_err="no"
  if printf '%s' "$ruleset" | grep -qi "No such file"; then
    nft_err="yes"
  fi
  if [[ "$ACTION_TAKEN" == "none" ]] && [[ -n "$ruleset" ]] && [[ "$nft_err" == "no" ]]; then
    log "[nft] nftables is present on the system. On Ubuntu/Debian, UFW usually drives nftables; if UFW is inactive, this script left the ruleset unchanged."
  fi
}

# --- main ---
log_section "file_sync_v2 - firewall port opener (standalone)"
log "[INFO] Script directory: $SCRIPT_DIR"
log "[INFO] Config file: $CONFIG_JSON"

if [[ "$UNAME_S" != "Linux" ]]; then
  UNAME_S="$(uname -s 2>&1)" || true
fi
probe_os

if [[ "$UNAME_S" != "Linux" ]]; then
  log "[WARN] This script is intended for Linux (Ubuntu/Debian). Detected: $UNAME_S - exiting without changes."
  log "[SUMMARY] action=skipped reason=non-linux"
  exit 0
fi

resolve_privilege_escalation
read_listen_port
probe_firewall_tools

log_section "Applying firewall logic (only if a supported firewall is active)"
try_ufw
try_firewalld
try_iptables
note_nft

log_section "Final summary"
log "[SUMMARY] listen_tcp_port=$LISTEN_PORT"
log "[SUMMARY] firewall_action=$ACTION_TAKEN"
case "$ACTION_TAKEN" in
  ufw) log "[SUMMARY] UFW was active; allow rule requested for tcp/$LISTEN_PORT." ;;
  firewalld) log "[SUMMARY] firewalld was running; permanent port and reload requested." ;;
  iptables) log "[SUMMARY] iptables ruleset looked active; INPUT rule inserted (see logs above)." ;;
  iptables-already) log "[SUMMARY] iptables already had a matching rule; no insert." ;;
  *) log "[SUMMARY] No active managed firewall matched, or tools missing - no port change performed." ;;
esac
log "[DONE] Script finished (always exit 0; rely on log lines above, not exit status)."
exit 0
