# -*- coding: utf-8 -*-
"""
Standalone HTTP server for Code Sync (stdlib `http.server` only).

Exposes the SAME `/code-sync/*` routes the in-process FastAPI router
(pycore/callmodule/routers/code_sync_router.py) serves, each a thin call into the
shared manager. Used ONLY in standalone mode (`pyservice.sh codesync run`); when
the full pycore runtime is up, its FastAPI app serves these routes instead and
this server is not started (so port 59000 is never double-bound).

No third-party deps; no pycore import.
"""

import json
import os
import shlex
import shutil
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .runtime import log as ColorPrint, get_core_node_root
from .manager import get_manager
from . import ws_proto

SERVICE_NAME = "codesync"

# A client that disconnects mid-response raises one of these on write; they mean
# "the caller went away", not a server bug, so we drop them quietly. (BrokenPipe /
# ConnectionReset / ConnectionAborted are all subclasses of ConnectionError; OSError
# covers the rest, e.g. EPIPE surfacing as a bare OSError.)
_CONN_ERRORS = (ConnectionError, OSError)


def _manager():
    return get_manager()


# --------------------------------------------------------------------------- #
# Service self-management (Linux/systemd only)                                #
#                                                                             #
# The standalone panel can reinstall/restart the codesync systemd service via #
# the SAME idempotent path as `pyservice.sh codesync` -> codesync_service.sh  #
# (install rewrites the unit + restart; restart = systemctl restart). Because #
# THIS daemon IS that service, the op is spawned detached and OUTSIDE the      #
# unit's cgroup (prefer systemd-run; else setsid) with a 1s delay so the HTTP  #
# reply flushes before systemd kills us — the panel then shows the log-view    #
# commands to inspect the (re)start from the machine if it does not come back. #
# --------------------------------------------------------------------------- #
def _service_log_commands() -> List[str]:
    return [
        f"journalctl -u {SERVICE_NAME} -f",
        f"journalctl -u {SERVICE_NAME} -n 200 --no-pager",
        f"systemctl status {SERVICE_NAME} --no-pager",
    ]


def _systemctl_available() -> bool:
    return shutil.which("systemctl") is not None


def _is_root() -> bool:
    geteuid = getattr(os, "geteuid", None)
    return geteuid() == 0 if geteuid else False


def _run_service_op_detached(op: str) -> Tuple[bool, str, str]:
    """Spawn `pyservice.sh codesync <op>` fully detached so it survives THIS
    daemon being restarted by the very operation it triggers. `op` is allow-listed
    (restart|install). Returns (ok, command, error)."""
    if op not in ("restart", "install"):
        return False, "", f"unsupported op: {op}"
    if not _systemctl_available():
        return False, "", "systemctl not found; service ops are Linux/systemd only"
    root = get_core_node_root()
    script = Path(root) / "pyservice.sh"
    if not script.exists():
        return False, "", f"pyservice.sh not found at {script}"
    # 1s delay lets the HTTP response flush before systemd stops this process.
    inner = f"sleep 1; bash {shlex.quote(str(script))} codesync {op}"
    sudo = (not _is_root() and shutil.which("sudo") is not None)
    # If we'll need sudo, verify passwordless sudo NOW so a missing NOPASSWD turns
    # into a real error the panel can show — instead of a detached process that
    # silently dies on a password prompt while we report "triggered".
    if not _is_root() and not sudo:
        return False, inner, ("not root and sudo not found; run the command "
                              "manually on the machine")
    if sudo:
        try:
            chk = subprocess.run(["sudo", "-n", "true"], stdout=subprocess.DEVNULL,
                                 stderr=subprocess.DEVNULL, timeout=5)
            if chk.returncode != 0:
                return False, inner, ("passwordless sudo required (sudo -n failed); "
                                      "run the command manually on the machine")
        except Exception as exc:
            return False, inner, f"sudo preflight failed: {exc}"
    try:
        sysrun = shutil.which("systemd-run")
        if sysrun:
            # A transient unit runs OUTSIDE this service's cgroup, so the restart
            # completes even after systemd kills us. --collect reaps it after exit.
            # Unique name (pid + monotonic ns) so a rapid double-trigger never hits
            # an "--unit already exists" failure.
            unit = f"codesync-self-{op}-{os.getpid()}-{time.monotonic_ns()}"
            argv = [sysrun, "--quiet", "--collect", f"--unit={unit}",
                    "bash", "-lc", inner]
            if sudo:
                argv = ["sudo", "-n", *argv]
            subprocess.Popen(argv, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)
            return True, " ".join(shlex.quote(a) for a in argv), ""
        # Fallback: detached session shell (best-effort if KillMode reaps it).
        shell_cmd = f"sudo -n {inner}" if sudo else inner
        argv = ["setsid", "bash", "-lc", shell_cmd]
        subprocess.Popen(argv, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, start_new_session=True)
        return True, shell_cmd, ""
    except Exception as exc:
        return False, inner, str(exc)


def _service_status() -> Dict[str, Any]:
    out: Dict[str, Any] = {"success": True, "available": _systemctl_available(),
                           "service": SERVICE_NAME,
                           "log_commands": _service_log_commands()}
    if not out["available"]:
        out["success"] = False
        out["error"] = "systemctl not found (Linux/systemd only)"
        return out
    for key, args in (("active", ["systemctl", "is-active", SERVICE_NAME]),
                      ("enabled", ["systemctl", "is-enabled", SERVICE_NAME])):
        try:
            r = subprocess.run(args, capture_output=True, text=True, timeout=5)
            out[key] = (r.stdout or r.stderr or "").strip() or "unknown"
        except Exception as exc:
            out[key] = f"unknown ({exc})"
    return out


# A single self-contained control panel served at GET / in standalone mode. Pure
# HTML + vanilla JS (no build, no CDN), talking to the same /code-sync/* API the
# desktop React app uses — so a headless box (cloud/VPS) has a browser UI too.
PANEL_HTML = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Code Sync</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         background: #0b1120; color: #e2e8f0; padding: 20px; }
  .wrap { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0; display: flex; align-items: center; gap: 8px; }
  .sub { color: #94a3b8; font-size: 12px; }
  .card { background: #111a2e; border: 1px solid #1e293b; border-radius: 16px; padding: 18px; margin-top: 16px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); gap: 10px; margin-top: 12px; }
  .stat { background: #0b1424; border: 1px solid #1e293b; border-radius: 10px; padding: 10px; }
  .stat .k { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
  .stat .v { font-weight: 700; margin-top: 2px; word-break: break-all; }
  button { font: inherit; cursor: pointer; border: 1px solid #334155; background: #1e293b; color: #e2e8f0;
           border-radius: 9px; padding: 7px 12px; transition: .15s; }
  button:hover { background: #334155; }
  button.primary { background: #0284c7; border-color: #0284c7; color: #fff; }
  button.primary:hover { background: #0369a1; }
  button.active { background: rgba(2,132,199,.15); border-color: #0284c7; color: #38bdf8; }
  button.danger:hover { background: #7f1d1d; border-color: #b91c1c; color: #fff; }
  input, select { font: inherit; background: #0b1424; border: 1px solid #334155; color: #e2e8f0;
                  border-radius: 9px; padding: 7px 9px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex: 0 0 auto; }
  .on { background: #10b981; } .off { background: #64748b; }
  .badge { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 6px; }
  .b-dev { background: rgba(139,92,246,.15); color: #a78bfa; }
  .b-client { background: rgba(56,189,248,.15); color: #38bdf8; }
  .b-probe { background: rgba(139,92,246,.15); color: #a78bfa; }
  .b-heartbeat { background: rgba(56,189,248,.15); color: #38bdf8; }
  .b-both { background: rgba(16,185,129,.15); color: #34d399; }
  .b-pending { background: rgba(245,158,11,.15); color: #fbbf24; }
  .b-violet { background: rgba(139,92,246,.15); color: #a78bfa; }
  .iconstrip { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 12px; font-size: 12px; color: #cbd5e1; }
  .iconstrip span b { color: #e2e8f0; }
  .delta-up { color: #34d399; } .delta-dn { color: #f87171; }
  .rangebtns { display: flex; gap: 4px; }
  .rangebtns button { padding: 3px 8px; font-size: 11px; }
  .chart { width: 100%; height: 54px; display: block; margin-top: 8px; }
  ul { list-style: none; margin: 12px 0 0; padding: 0; }
  li.peer { background: #0b1424; border: 1px solid #1e293b; border-radius: 10px; padding: 11px;
            margin-bottom: 8px; display: flex; align-items: center; gap: 10px; }
  .peer .meta { font-size: 12px; color: #94a3b8; margin-top: 2px; display: flex; gap: 8px; flex-wrap: wrap; }
  .grow { min-width: 0; flex: 1; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .muted { color: #64748b; }
  .actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .toggle { display: inline-flex; align-items: center; gap: 8px; }
  .switch { width: 44px; height: 24px; border-radius: 999px; background: #334155; position: relative; border: none; padding: 0; }
  .switch.on { background: #10b981; }
  .switch i { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: .15s; }
  .switch.on i { transform: translateX(20px); }
  .addform { display: grid; grid-template-columns: 1fr 1.4fr .6fr .8fr auto; gap: 8px; margin-top: 12px; }
  @media (max-width: 640px){ .addform { grid-template-columns: 1fr 1fr; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="row">
    <div><h1>🧩 Code Sync <span class="badge" id="conn">…</span></h1>
      <div class="sub">Standalone control panel · config v<span id="ver">-</span></div></div>
    <button onclick="load()">↻ Refresh</button>
  </div>

  <div class="card" id="self-card">
    <div class="row"><strong>This device</strong>
      <div class="actions">
        <button id="role-dev"  onclick="setRole('dev')">Dev</button>
        <button id="role-client" onclick="setRole('client')">Client</button>
      </div>
    </div>
    <div class="grid">
      <div class="stat"><div class="k">Name</div><div class="v" id="s-name">-</div></div>
      <div class="stat"><div class="k">Hostname</div><div class="v" id="s-host">-</div></div>
      <div class="stat"><div class="k">LAN IP</div><div class="v mono" id="s-ip">-</div></div>
      <div class="stat"><div class="k">Code</div><div class="v" id="s-code">-</div></div>
    </div>
    <div class="iconstrip" id="self-strip"></div>
    <div class="row" id="self-toggle" style="margin-top:12px"></div>
    <div class="sub" id="self-watch" style="margin-top:10px"></div>
  </div>

  <div class="card">
    <div class="row"><strong>Peers</strong>
      <button onclick="discover()">⊚ Discover LAN</button></div>
    <ul id="peers"></ul>
    <div class="addform">
      <input id="a-name" placeholder="name">
      <input id="a-host" placeholder="host / ip">
      <input id="a-port" placeholder="59000" value="59000">
      <select id="a-role"><option value="dev">dev</option><option value="client" selected>client</option></select>
      <button class="primary" onclick="addPeer()">+ Add</button>
    </div>
  </div>

  <div class="card">
    <div class="row">
      <strong>Filter settings <span class="badge b-heartbeat" id="filters-src" style="display:none">.data</span></strong>
      <div class="actions">
        <button onclick="resetFilters()">↺ Reset to defaults</button>
        <button class="primary" id="filters-save" onclick="saveFilters()" disabled>✓ Save</button>
      </div>
    </div>
    <div class="sub" style="margin:4px 0 10px">Folders / files matching these are never synced or counted. Edits save to this machine only (.data), not the code.</div>
    <div id="filters-body" class="muted">loading…</div>
    <div class="row" style="margin-top:12px">
      <span class="toggle"><span>Apply repo .gitignore</span></span>
      <button class="switch" id="gi-switch" onclick="toggleGitignore()"><i></i></button>
    </div>
  </div>

  <div class="card">
    <div class="row">
      <strong>Service <span class="badge" id="svc-state">…</span></strong>
      <div class="actions">
        <button id="svc-restart" onclick="svcOp('restart')">↻ Restart service</button>
        <button id="svc-reinstall" class="primary" onclick="svcOp('reinstall')">⤓ Reinstall service</button>
      </div>
    </div>
    <div class="sub" style="margin:4px 0 0">Reinstall is idempotent (same path as <span class="mono">pyservice.sh codesync</span>): it rewrites the unit and restarts. The panel will briefly disconnect during a (re)start.</div>
    <div id="svc-result" style="display:none;margin-top:12px"></div>
  </div>

  <div class="card">
    <div class="row"><strong>Sync log</strong>
      <div class="rangebtns" id="range-btns">
        <button data-r="5" onclick="setRange(5)">5m</button>
        <button data-r="30" onclick="setRange(30)">30m</button>
        <button data-r="60" onclick="setRange(60)">1h</button>
        <button data-r="1440" onclick="setRange(1440)">24h</button>
      </div>
    </div>
    <div id="chart-wrap"></div>
    <ul id="synclog" style="max-height:260px;overflow:auto;margin-top:10px"></ul>
  </div>
</div>

<script>
const $ = (s) => document.querySelector(s);
async function api(path, body){
  const opt = body !== undefined
    ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }
    : {};
  try { const r = await fetch(path, opt); return await r.json(); }
  catch(e){ return null; }
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function fmtBytes(n){ if(!n||n<=0) return '0 B'; const u=['B','KB','MB','GB','TB']; let i=0,v=n;
  while(v>=1024 && i<u.length-1){ v/=1024; i++; } return (i?v.toFixed(1):v)+' '+u[i]; }
function relTime(ts){ if(!ts) return 'never'; const ms = ts<1e12 ? ts*1000 : ts;
  let s=Math.floor((Date.now()-ms)/1000); if(s<0)s=0; if(s<60)return s+'s';
  const m=Math.floor(s/60); if(m<60)return m+'m'; const h=Math.floor(m/60);
  if(h<24)return h+'h'; return Math.floor(h/24)+'d'; }
function codeLine(code){ if(!code || (!code.files && !code.bytes)) return '<span class="muted">no code stats</span>';
  let t = '📄 '+code.files+' · 💾 '+fmtBytes(code.bytes);
  if(code.last_modified>0) t += ' · updated '+relTime(code.last_modified); return t; }
function roleBadge(r){ return '<span class="badge '+(r==='dev'?'b-dev':'b-client')+'">'+esc(r)+'</span>'; }
function viaBadge(v){ if(!v) return ''; const map={probe:'via probe',heartbeat:'via heartbeat',both:'probe + heartbeat'};
  return '<span class="badge b-'+v+'">'+map[v]+'</span>'; }
function setConn(ok){ const c=$('#conn'); c.textContent = ok?'online':'offline';
  c.className = 'badge '+(ok?'b-both':'b-pending'); }

let SELF = null, PEERS = [], LOGS = [], RANGE_MIN = 60;
function renderSelf(s){
  SELF = s || {};
  renderWatch(SELF);
  $('#s-name').textContent = s.name || '-';
  $('#s-host').textContent = s.hostname || '-';
  $('#s-ip').textContent   = s.lan_ip || '-';
  $('#s-code').innerHTML    = codeLine(s.code || (s.summary && s.summary.code));
  $('#role-dev').className    = s.role==='dev' ? 'active' : '';
  $('#role-client').className = s.role==='client' ? 'active' : '';
  const t = $('#self-toggle');
  if(s.role==='dev'){
    const on = !!s.distributing;
    t.innerHTML = '<div class="toggle"><span>Distribute code'+(on?' · <b style="color:#34d399">ON</b>':'')+'</span></div>'
      + '<button class="switch '+(on?'on':'')+'" onclick="toggleDistribute('+(!on)+')"><i></i></button>';
  } else {
    const sk = !!(s.skip_update || (s.summary && s.summary.skip_update));
    t.innerHTML = '<div class="toggle"><span>Skip updates'+(sk?' · <b style="color:#fbbf24">PAUSED</b>':' · receiving')+'</span></div>'
      + '<button class="switch '+(sk?'on':'')+'" onclick="toggleSkip('+(!sk)+')"><i></i></button>';
  }
}
function phasePill(ph){
  if(!ph || !ph.phase || ph.phase==='idle') return '';
  const cls = (ph.phase==='retrying') ? 'b-pending' : 'b-probe';
  return ' <span class="badge '+cls+'">'+esc(ph.phase)+(ph.count?(' '+ph.count):'')+'</span>';
}
function peerPhase(p){
  const ch = (SELF && SELF.sync_phase && SELF.sync_phase.channels) || {};
  if(p.id && ch[p.id]) return ch[p.id];
  const st = p.status || {};
  return st.sync_phase || null;
}
function renderPeers(peers){
  const ul = $('#peers');
  if(!peers || !peers.length){ ul.innerHTML = '<li class="muted" style="padding:12px">No peers yet.</li>'; return; }
  ul.innerHTML = peers.map(function(p){
    const st = p.status || {};
    const code = st.code || (st.summary && st.summary.code);
    const seen = p.reachable
      ? (p.via==='heartbeat' && p.last_checkin ? 'last contact '+relTime(p.last_checkin) : '')
      : 'last seen '+relTime(p.last_seen);
    return '<li class="peer">'
      + '<span class="dot '+(p.reachable?'on':'off')+'"></span>'
      + '<div class="grow"><div>'+esc(p.name||p.host)+' '+roleBadge(p.role)+' '+viaBadge(p.via)
      +   (p.pending?' <span class="badge b-pending">pending</span>':'')+phasePill(peerPhase(p))+'</div>'
      + '<div class="meta"><span class="mono">'+esc(p.host)+':'+esc(p.port)+'</span>'
      +   (seen?'<span>· '+seen+'</span>':'')+'<span>· '+codeLine(code)+'</span></div></div>'
      + '<div class="actions"><button class="danger" onclick="removePeer(\''+esc(p.id)+'\')">Remove</button></div>'
      + '</li>';
  }).join('');
}
async function load(){
  const d = await api('/code-sync/peers');
  if(!d || !d.success){ setConn(false); return; }
  setConn(true);
  $('#ver').textContent = d.version;
  PEERS = d.peers || [];
  renderSelf(d.self); renderPeers(PEERS);
  loadFilters(); await loadLogs();
  renderStrip(); renderChart(); loadSvcStatus();
}
// ---- service self-management (restart / reinstall via pyservice.sh) ----
async function loadSvcStatus(){
  const el = $('#svc-state'); if(!el) return;
  const d = await api('/code-sync/service/status');
  if(!d || !d.available){
    el.textContent = 'n/a'; el.className = 'badge b-pending';
    el.title = (d && d.error) || 'systemd only';
    return;
  }
  const up = d.active === 'active';
  el.textContent = d.active + (d.enabled ? ' · '+d.enabled : '');
  el.className = 'badge ' + (up ? 'b-both' : 'b-pending');
}
function copyText(btn, text){
  const done = () => { const o = btn.textContent; btn.textContent = '✓ Copied';
    setTimeout(()=>{ btn.textContent = o; }, 1200); };
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done, done); }
  else { try{ const t=document.createElement('textarea'); t.value=text; document.body.appendChild(t);
    t.select(); document.execCommand('copy'); document.body.removeChild(t); }catch(e){} done(); }
}
function renderSvcResult(d){
  const box = $('#svc-result'); if(!box) return;
  const ok = d && d.success;
  const cmds = (d && d.log_commands) || [];
  const cmdRow = (c) => '<li class="peer" style="font-family:monospace;font-size:11px;padding:6px 10px">'
    + '<span class="grow" style="word-break:break-all">'+esc(c)+'</span>'
    + '<button onclick="copyText(this,\''+esc(c).replace(/'/g,"\\'")+'\')">Copy</button></li>';
  box.style.display = '';
  box.innerHTML =
    '<div class="badge '+(ok?'b-both':'b-pending')+'">'+(ok?'triggered':'failed')+'</div>'
    + (d && d.command ? '<div class="sub" style="margin:6px 0 2px">Ran: <span class="mono">'+esc(d.command)+'</span></div>' : '')
    + (d && d.error ? '<div class="sub" style="color:#fbbf24">'+esc(d.error)+'</div>' : '')
    + (d && d.note ? '<div class="sub" style="margin:6px 0">'+esc(d.note)+'</div>' : '')
    + (cmds.length ? '<div class="sub" style="margin:8px 0 4px">View the logs on the machine:</div><ul style="margin:0;padding:0">'
        + cmds.map(cmdRow).join('') + '</ul>' : '');
}
async function svcOp(which){
  const path = which === 'reinstall' ? '/code-sync/service/reinstall' : '/code-sync/service/restart';
  const br = $('#svc-restart'), bi = $('#svc-reinstall');
  if(br) br.disabled = true; if(bi) bi.disabled = true;
  const d = await api(path, {});
  renderSvcResult(d || {success:false, error:'request failed (the service may already be restarting)',
    log_commands:['journalctl -u codesync -f','systemctl status codesync --no-pager']});
  if(br) br.disabled = false; if(bi) bi.disabled = false;
}
// ---- icon stat strip ----
function logCount(action){ let n=0; for(const l of LOGS){ const a=l.action||'sync';
  if(Array.isArray(action) ? action.indexOf(a)>=0 : a===action) n++; } return n; }
function renderStrip(){
  const el = $('#self-strip'); if(!el) return;
  const s = SELF || {};
  const ph = s.sync_phase || {};
  const ch = ph.channels || {};
  let queued = 0;
  for(const k in ch){ if(ch[k] && ch[k].phase==='pushing') queued += (ch[k].count||0); }
  const total = PEERS.length;
  let reach = 0; for(const p of PEERS){ if(p.reachable) reach++; }
  const synced = logCount(['sent','received']);
  const errors = logCount('error');
  const stateTxt = s.role==='dev'
    ? (s.distributing ? '<b style="color:#34d399">distributing</b>' : 'idle')
    : ((s.skip_update||(s.summary&&s.summary.skip_update)) ? '<b style="color:#fbbf24">paused</b>' : 'receiving');
  el.innerHTML =
      '<span>🧭 role <b>'+esc(s.role||'-')+'</b></span>'
    + '<span>'+(s.role==='dev'?'📡':'📥')+' '+stateTxt+'</span>'
    + '<span>👥 peers <b>'+total+'</b></span>'
    + '<span>🟢 reachable <b>'+reach+'</b></span>'
    + '<span>📤 queued <b>'+queued+'</b></span>'
    + '<span>🔄 synced <b>'+synced+'</b></span>'
    + '<span>⚠️ errors <b>'+errors+'</b></span>';
}
// ---- activity chart ----
function setRange(m){ RANGE_MIN = m; renderChart(); }
function logMs(l){ const ts=l.timestamp||0; return ts<1e12 ? ts*1000 : ts; }
function renderChart(){
  const wrap = $('#chart-wrap'); if(!wrap) return;
  $('#range-btns').querySelectorAll('button').forEach(function(b){
    b.className = (parseInt(b.dataset.r,10)===RANGE_MIN) ? 'active' : ''; });
  const now = Date.now(), span = RANGE_MIN*60*1000, start = now - span, N = 24;
  const ok = new Array(N).fill(0), err = new Array(N).fill(0);
  let any = false;
  for(const l of LOGS){
    const ms = logMs(l); if(!ms || ms < start || ms > now) continue;
    any = true;
    let i = Math.floor((ms - start) / span * N); if(i<0)i=0; if(i>=N)i=N-1;
    const a = l.action||'sync';
    if(a==='error') err[i]++; else if(a==='sent'||a==='received'||a==='skipped'||a==='deleted') ok[i]++;
  }
  if(!any){ wrap.innerHTML = '<div class="muted" style="font-size:11px;padding:10px 2px">No activity in this range</div>'; return; }
  let max = 1; for(let i=0;i<N;i++){ const t=ok[i]+err[i]; if(t>max) max=t; }
  const W=820, H=48, gap=2, bw=(W-(N-1)*gap)/N;
  let bars = '';
  for(let i=0;i<N;i++){
    const x = i*(bw+gap);
    const okh = Math.round(ok[i]/max*H), eh = Math.round(err[i]/max*H);
    if(okh>0) bars += '<rect x="'+x.toFixed(1)+'" y="'+(H-okh)+'" width="'+bw.toFixed(1)+'" height="'+okh+'" fill="#34d399" rx="1"></rect>';
    if(eh>0)  bars += '<rect x="'+x.toFixed(1)+'" y="'+(H-okh-eh)+'" width="'+bw.toFixed(1)+'" height="'+eh+'" fill="#f87171" rx="1"></rect>';
  }
  wrap.innerHTML = '<svg class="chart" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+bars+'</svg>';
}

// ---- filter settings ----
let FILTERS = null, FILTERS_DIRTY = false;
const FKEYS = [
  ['watch_dirs','Watched directories (empty = project root)','project root'],
  ['excluded_dirs','Excluded folders','node_modules'],
  ['excluded_files','Excluded files','secret.json'],
  ['excluded_extensions','Excluded extensions','.log'],
  ['excluded_path_substrings','Excluded if path contains','/cache/'],
];
async function loadFilters(){
  const d = await api('/code-sync/settings');
  if(!d || !d.success) return;
  if(!FILTERS_DIRTY) FILTERS = d.settings;
  $('#filters-src').style.display = d.overridden ? '' : 'none';
  renderFilters();
}
function renderFilters(){
  if(!FILTERS) return;
  $('#filters-body').innerHTML = FKEYS.map(function(f){
    const key=f[0], label=f[1], ph=f[2], items=FILTERS[key]||[];
    const chips = items.map(function(it,idx){
      return '<span class="badge" style="background:#1e293b;color:#cbd5e1;font-family:monospace;text-transform:none">'
        + esc(it) + ' <a href="#" onclick="rmChip(\''+key+'\','+idx+');return false" style="color:#94a3b8;text-decoration:none">×</a></span>';
    }).join(' ');
    return '<div style="margin-bottom:10px"><div class="muted" style="font-size:11px;text-transform:uppercase;margin-bottom:4px">'+label
      + '</div><div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">' + chips
      + '<input id="chip-'+key+'" placeholder="'+ph+'" style="width:140px" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addChip(\''+key+'\')}">'
      + '<button onclick="addChip(\''+key+'\')">+ Add</button></div></div>';
  }).join('');
  $('#gi-switch').className = 'switch' + (FILTERS.apply_gitignore ? ' on' : '');
  $('#filters-save').disabled = !FILTERS_DIRTY;
}
function renderWatch(s){
  const wd = (s.watch_dirs && s.watch_dirs.length) ? s.watch_dirs.join(' · ') : (s.watch_root || '-');
  const ph = s.sync_phase || {};
  const phTxt = (ph.phase && ph.phase !== 'idle')
    ? ' · <b style="color:#818cf8;text-transform:uppercase">' + esc(ph.phase) + (ph.count ? (' ' + ph.count) : '') + '</b>'
    : '';
  $('#self-watch').innerHTML = '📂 Watching: <span class="mono">' + esc(wd) + '</span>' + phTxt;
}
function addChip(key){
  const el = document.getElementById('chip-'+key); const v=(el.value||'').trim();
  if(v){ if(!FILTERS[key]) FILTERS[key]=[]; if(FILTERS[key].indexOf(v)<0){ FILTERS[key]=FILTERS[key].concat([v]); FILTERS_DIRTY=true; } }
  el.value=''; renderFilters();
}
function rmChip(key, idx){ (FILTERS[key]||[]).splice(idx,1); FILTERS_DIRTY=true; renderFilters(); }
function toggleGitignore(){ if(!FILTERS) return; FILTERS.apply_gitignore=!FILTERS.apply_gitignore; FILTERS_DIRTY=true; renderFilters(); }
async function saveFilters(){
  if(!FILTERS) return;
  const d = await api('/code-sync/settings', FILTERS);
  if(d && d.success){ FILTERS=d.settings; FILTERS_DIRTY=false; $('#filters-src').style.display=''; renderFilters(); }
}
async function resetFilters(){
  const d = await api('/code-sync/settings/reset', {});
  if(d && d.success){ FILTERS=d.settings; FILTERS_DIRTY=false; $('#filters-src').style.display='none'; renderFilters(); }
}

// ---- sync log ----
function actionClass(a){
  if(a==='error'||a==='deleted') return 'b-pending';
  if(a==='skipped') return 'b-pending';
  if(a==='reconnect') return 'b-violet';
  if(a==='sent'||a==='received') return 'b-both';
  return 'b-both';
}
function sizeCell(l){
  if(typeof l.diff === 'number' && l.diff !== 0){
    const up = l.diff > 0;
    return '<span class="'+(up?'delta-up':'delta-dn')+'">'+(up?'+':'-')+fmtBytes(Math.abs(l.diff))+'</span>';
  }
  if(l.details) return '<span class="muted">'+esc(l.details)+'</span>';
  return '<span class="muted">'+fmtBytes(l.size||0)+'</span>';
}
function peerCell(l){
  if(!l.peer) return '';
  const arrow = l.direction==='push' ? '→ ' : (l.direction==='receive' ? '← ' : '');
  return '<span class="muted" style="margin-left:8px">'+esc(arrow)+esc(l.peer)+'</span>';
}
async function loadLogs(){
  const d = await api('/code-sync/logs?limit=100');
  LOGS = (d && d.success && Array.isArray(d.logs)) ? d.logs : [];
  const ul = $('#synclog');
  if(!LOGS.length){ ul.innerHTML = '<li class="muted" style="padding:8px">No recent sync activity</li>'; return; }
  ul.innerHTML = LOGS.slice().reverse().map(function(l){
    const a = l.action || 'sync';
    return '<li class="peer" style="font-family:monospace;font-size:11px;padding:6px 10px">'
      + '<span class="badge '+actionClass(a)+'">'+esc(a)+'</span>'
      + '<span class="grow" style="margin-left:8px">'+esc(l.file_path||'')
      +   (l.reason ? ' <span class="muted">'+esc(l.reason)+'</span>' : '') + '</span>'
      + '<span style="margin-left:8px">'+sizeCell(l)+'</span>'
      + peerCell(l)
      + '<span class="muted" style="margin-left:8px">'+relTime(l.timestamp)+'</span>'
      + '</li>';
  }).join('');
}
async function setRole(r){ await api('/code-sync/role', {role:r}); load(); }
async function toggleDistribute(on){ await api('/code-sync/distribute', {enabled:on}); load(); }
async function toggleSkip(on){ await api('/code-sync/skip-update', {enabled:on}); load(); }
async function removePeer(id){ await api('/code-sync/peers/remove', {id:id}); load(); }
async function addPeer(){
  const host = $('#a-host').value.trim(); if(!host){ $('#a-host').focus(); return; }
  await api('/code-sync/peers/add', { name: $('#a-name').value.trim() || host, host: host,
    port: parseInt($('#a-port').value,10) || 59000, role: $('#a-role').value });
  $('#a-name').value=''; $('#a-host').value=''; load();
}
async function discover(){
  const d = await api('/code-sync/discover');
  if(d && d.candidates && d.candidates.length){
    for(const c of d.candidates){ await api('/code-sync/peers/add',
      {name:c.name||c.host, host:c.host, port:c.port, role:c.role||'client'}); }
  }
  load();
}
load(); setInterval(load, 5000);
</script>
</body>
</html>
"""


class _Handler(BaseHTTPRequestHandler):
    server_version = "CodeSync/1.0"

    # ---- low-level helpers ------------------------------------------------ #
    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0:
            return {}
        try:
            raw = self.rfile.read(length)
            return json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            return {}

    def _write_response(self, body: bytes, status: int, content_type: str) -> None:
        """Write a full response, tolerating a client that disconnected mid-flight.
        A broken pipe / reset just means the caller went away — drop it quietly
        instead of letting the exception escape and spam a traceback (and, in the
        error paths, double-fault when the fallback 500 also can't be written)."""
        try:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()
        except _CONN_ERRORS:
            pass

    def _send_json(self, obj: Any, status: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8")
        self._write_response(body, status, "application/json; charset=utf-8")

    def _send_bytes(self, data: bytes, status: int = 200,
                    content_type: str = "application/octet-stream") -> None:
        self._write_response(data, status, content_type)

    def _send_html(self, html: str, status: int = 200) -> None:
        self._write_response(html.encode("utf-8"), status, "text/html; charset=utf-8")

    def log_message(self, fmt, *args):  # silence default stderr access log
        return

    # ---- WebSocket push receiver (this node accepts; the dev pushes) ------ #
    def _serve_ws(self) -> None:
        key = self.headers.get("Sec-WebSocket-Key", "")
        if not key:
            return self._send_json({"detail": "missing Sec-WebSocket-Key"}, status=400)
        try:
            self.wfile.write(ws_proto.server_handshake_response(key))
            self.wfile.flush()
        except _CONN_ERRORS:
            return  # client dropped before the upgrade completed

        def send(text: str) -> None:
            self.wfile.write(ws_proto.encode_frame(text.encode("utf-8"),
                                                   ws_proto.OP_TEXT, mask=False))
            self.wfile.flush()

        receiver = _manager().push_receiver
        try:
            while True:
                op, payload = ws_proto.read_message(self.rfile.read)
                if op == ws_proto.OP_CLOSE:
                    break
                if op == ws_proto.OP_PING:
                    self.wfile.write(ws_proto.encode_frame(payload, ws_proto.OP_PONG, mask=False))
                    self.wfile.flush()
                    continue
                if not receiver.handle_text(payload.decode("utf-8"), send):
                    break
        except (ConnectionError, OSError):
            pass
        except Exception as exc:
            ColorPrint.yellow(f"[CodeSync WS] receiver error: {exc}")

    # ---- routing ---------------------------------------------------------- #
    def do_GET(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        try:
            # WS push channel: the dev dials in here and pushes files (this node is
            # the WS server / receiver). Upgrade then loop applying pushed frames.
            # NOTE: full pycore does NOT run this standalone server — it serves the
            # SAME /code-sync/ws receiver on its rpc_v2 app (:59000) via
            # callmodule/config.py::_register_code_sync_ws. Keep both in sync.
            if path == "/code-sync/ws" and "websocket" in self.headers.get("Upgrade", "").lower():
                return self._serve_ws()
            if path == "/":
                # Standalone mode only: a self-contained, build-free control panel.
                # (Full pycore serves its React UI instead and never starts this server.)
                return self._send_html(PANEL_HTML)
            if path == "/favicon.ico":
                return self._send_bytes(b"", status=204, content_type="image/x-icon")
            if path == "/code-sync/ping":
                return self._send_json({"status": "ok", "service": "code-sync"})
            if path == "/code-sync/status":
                return self._send_json(_manager().get_status())
            if path == "/code-sync/peer/status":
                try:
                    return self._send_json(_manager().get_local_peer_status())
                except Exception as exc:
                    return self._send_json({"role": "client", "distributing": False, "error": str(exc)})
            if path == "/code-sync/peers":
                return self._send_json(_manager().get_peers())
            if path == "/code-sync/settings":
                return self._send_json(_manager().get_sync_settings())
            if path == "/code-sync/logs":
                limit = 100
                try:
                    from urllib.parse import urlparse, parse_qs
                    q = parse_qs(urlparse(self.path).query)
                    limit = int((q.get("limit") or ["100"])[0])
                except Exception:
                    pass
                return self._send_json(_manager().get_sync_logs(limit))
            if path == "/code-sync/service/status":
                return self._send_json(_service_status())
            return self._send_json({"detail": "Not found"}, status=404)
        except Exception as exc:
            return self._send_json({"detail": str(exc)}, status=500)

    def do_POST(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        body = self._read_json()
        try:
            return self._dispatch_post(path, body)
        except Exception as exc:
            return self._send_json({"detail": str(exc)}, status=500)

    def _dispatch_post(self, path: str, body: Dict[str, Any]):
        m = _manager()

        # ---- mesh / control ---------------------------------------------- #
        if path == "/code-sync/peer/config":
            return self._send_json(m.apply_remote_config(
                body.get("peers", []), body.get("version", 0), body.get("updated_at", 0.0)))
        if path == "/code-sync/peer/heartbeat":
            src = self.client_address[0] if self.client_address else None
            return self._send_json(m.receive_heartbeat(body, src))
        if path == "/code-sync/settings":
            return self._send_json(m.set_sync_settings(body))
        if path == "/code-sync/settings/reset":
            return self._send_json(m.reset_sync_settings())
        if path == "/code-sync/peers/add":
            return self._send_json(m.add_peer(
                body.get("name", ""), body.get("host", ""),
                int(body.get("port", 59000) or 59000), body.get("role", "client")))
        if path == "/code-sync/peers/remove":
            return self._send_json(m.remove_peer(body.get("id", "")))
        if path == "/code-sync/peers/update":
            fields = {k: v for k, v in body.items() if k != "id" and v is not None}
            return self._send_json(m.update_peer(body.get("id", ""), fields))
        if path == "/code-sync/role":
            return self._send_json({"success": True, "role": m.set_role(body.get("role", "client"))})
        if path == "/code-sync/distribute":
            return self._send_json(m.set_distributing(bool(body.get("enabled", False))))
        if path == "/code-sync/skip-update":
            return self._send_json(m.set_skip_update(bool(body.get("enabled", False))))
        if path == "/code-sync/discover":
            return self._send_json(m.discover())

        # ---- service self-management (Linux/systemd; reuses pyservice.sh) - #
        # restart   -> `pyservice.sh codesync restart` (systemctl restart)
        # reinstall -> `pyservice.sh codesync install` (idempotent: rewrite unit
        #              + daemon-reload + enable + restart, same path as the
        #              `pyservice.sh codesync` prompt-YES flow).
        # Detached + 1s-delayed, so this reply reaches the panel before systemd
        # stops this very process; the panel then shows the log-view commands.
        if path in ("/code-sync/service/restart", "/code-sync/service/reinstall"):
            op = "restart" if path.endswith("restart") else "install"
            ok, command, err = _run_service_op_detached(op)
            resp = {
                "success": ok,
                "op": op,
                "command": command,
                "log_commands": _service_log_commands(),
                "note": ("The Code Sync service is restarting; this panel will "
                         "disconnect briefly. If it does not come back, run the "
                         "log commands on the machine to inspect the (re)start."),
            }
            if err:
                resp["error"] = err
            return self._send_json(resp, status=200 if ok else 503)

        # ---- file transfer (dev AND distributing) ------------------------ #
        if path == "/code-sync/register":
            if not m.is_server_mode():
                return self._send_json({"detail": "Not in server mode"}, status=503)
            server = m.get_server()
            if not server:
                return self._send_json({"detail": "Server not available"}, status=503)
            client_ip = self.client_address[0] if self.client_address else "unknown"
            needs = server.register_client(body.get("client_id", ""), client_ip)
            return self._send_json({"success": True, "needs_initial_sync": needs,
                                    "message": f"Client registered: {body.get('client_id', '')}"})
        if path == "/code-sync/initial-sync":
            if not m.is_server_mode():
                return self._send_json({"detail": "Not in server mode"}, status=503)
            server = m.get_server()
            if not server:
                return self._send_json({"detail": "Server not available"}, status=503)
            return self._send_json({"success": True,
                                    "files": server.get_initial_sync_files(body.get("client_id", ""))})
        if path == "/code-sync/changes":
            if not m.is_server_mode():
                return self._send_json({"detail": "Not in server mode"}, status=503)
            server = m.get_server()
            if not server:
                return self._send_json({"detail": "Server not available"}, status=503)
            cid = body.get("client_id", "")
            rc = int(body.get("received_count", 0) or 0)
            sc = int(body.get("skipped_count", 0) or 0)
            if rc > 0 or sc > 0:
                server.update_client_stats(cid, received_count=rc, skipped_count=sc)
            return self._send_json({"success": True, "files": server.get_changed_files(cid)})
        if path == "/code-sync/download":
            if not m.is_server_mode():
                return self._send_json({"detail": "Not in server mode"}, status=503)
            server = m.get_server()
            if not server:
                return self._send_json({"detail": "Server not available"}, status=503)
            normalized = str(body.get("file_path", "")).replace("\\", "/")
            # Contain the read strictly under root_dir: reject "../" traversal and
            # absolute paths (pathlib drops the left side when the right is absolute,
            # which would otherwise serve any file on disk to an unauthenticated peer).
            base = Path(server.root_dir).resolve()
            try:
                file_path = (base / normalized).resolve()
            except Exception:
                return self._send_json({"detail": "Invalid path"}, status=400)
            if file_path != base and base not in file_path.parents:
                return self._send_json({"detail": "Invalid path"}, status=400)
            if not file_path.is_file():
                return self._send_json({"detail": f"File not found: {normalized}"}, status=404)
            with open(file_path, "rb") as fh:
                return self._send_bytes(fh.read())
        if path == "/code-sync/toggle-backup":
            if not m.is_client_mode():
                return self._send_json({"detail": "Not in client mode"}, status=503)
            client = m.get_client()
            if not client:
                return self._send_json({"detail": "Client not available"}, status=503)
            enabled = bool(body.get("enabled", True))
            client.enable_backup = enabled
            return self._send_json({"success": True, "enabled": enabled})

        # ---- deprecated back-compat shims -------------------------------- #
        if path == "/code-sync/set-server":
            m.set_server_mode()
            return self._send_json({"success": True, "message": "Switched to server mode"})
        if path == "/code-sync/set-client":
            m.set_client_mode()
            return self._send_json({"success": True, "message": "Switched to client mode"})
        if path == "/code-sync/stop":
            m.stop()
            return self._send_json({"success": True, "message": "Code sync stopped"})

        return self._send_json({"detail": "Not found"}, status=404)


class _QuietThreadingHTTPServer(ThreadingHTTPServer):
    """ThreadingHTTPServer that swallows client-disconnect errors instead of
    dumping a traceback per dropped request (frequent with health probes / the WS
    push link). Real server errors are still surfaced."""

    def handle_error(self, request, client_address):
        exc = sys.exc_info()[1]
        if isinstance(exc, _CONN_ERRORS):
            return  # client went away — not a server fault, stay quiet
        super().handle_error(request, client_address)


class CodeSyncHTTPServer:
    """Thin lifecycle wrapper around a ThreadingHTTPServer bound to /code-sync/*."""

    def __init__(self, host: str = "0.0.0.0", port: int = 59000):
        self.host = host
        self.port = port
        self._httpd: Optional[ThreadingHTTPServer] = None
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._httpd = _QuietThreadingHTTPServer((self.host, self.port), _Handler)
        self._httpd.daemon_threads = True
        self._thread = threading.Thread(target=self._httpd.serve_forever,
                                        daemon=True, name="CodeSync-HTTP")
        self._thread.start()
        ColorPrint.green(f"[CodeSync HTTP] Listening on http://{self.host}:{self.port}/code-sync/")

    def stop(self) -> None:
        if self._httpd is not None:
            try:
                self._httpd.shutdown()
                self._httpd.server_close()
            except Exception:
                pass
        ColorPrint.yellow("[CodeSync HTTP] Stopped")
