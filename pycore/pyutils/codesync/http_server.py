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
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional

from .runtime import log as ColorPrint
from .manager import get_manager


def _manager():
    return get_manager()


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
    <div class="row" id="self-toggle" style="margin-top:12px"></div>
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

let SELF = null;
function renderSelf(s){
  SELF = s || {};
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
      +   (p.pending?' <span class="badge b-pending">pending</span>':'')+'</div>'
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
  renderSelf(d.self); renderPeers(d.peers || []);
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

    def _send_json(self, obj: Any, status: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, data: bytes, status: int = 200,
                    content_type: str = "application/octet-stream") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_html(self, html: str, status: int = 200) -> None:
        body = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # silence default stderr access log
        return

    # ---- routing ---------------------------------------------------------- #
    def do_GET(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        try:
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
            file_path = server.root_dir / normalized
            if not file_path.exists():
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


class CodeSyncHTTPServer:
    """Thin lifecycle wrapper around a ThreadingHTTPServer bound to /code-sync/*."""

    def __init__(self, host: str = "0.0.0.0", port: int = 59000):
        self.host = host
        self.port = port
        self._httpd: Optional[ThreadingHTTPServer] = None
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._httpd = ThreadingHTTPServer((self.host, self.port), _Handler)
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
