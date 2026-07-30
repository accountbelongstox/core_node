# -*- coding: utf-8 -*-
"""
Standalone control panel for Code Sync (stdlib only).

A single self-contained control panel served at GET / in standalone mode. Pure
HTML + vanilla JS (no build, no CDN), talking to the same /code-sync/* API the
desktop React app uses - so a headless box (cloud/VPS) has a browser UI too.

ZERO Python logic: this module is just a raw HTML string assignment, so it cannot
violate the codesync stdlib-only / no-pycore-import invariant. Served by
http_server._Handler.do_GET (standalone mode only; full pycore serves its React
UI instead and never starts this server).

No third-party dependencies.
"""

from pycore.pyfoundations.pygvar import PYCORE_HTTP_PORT

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
      <div class="stat"><div class="k">Transport</div><div class="v" id="s-transport">-</div></div>
    </div>
    <div class="iconstrip" id="self-strip"></div>
    <div class="row" id="self-toggle" style="margin-top:12px"></div>
    <div class="sub" id="self-watch" style="margin-top:10px"></div>
  </div>

  <div class="card">
    <div class="row"><strong>Peers</strong>
      <div class="actions">
        <span class="toggle"><span>Scan LAN</span></span>
        <button class="switch" id="scan-lan-switch" onclick="toggleScanLan()"><i></i></button>
        <button id="discover-btn" onclick="discover()">⊚ Discover LAN</button>
      </div></div>
    <ul id="peers"></ul>
    <div class="addform">
      <input id="a-name" placeholder="name">
      <input id="a-host" placeholder="host / ip">
      <input id="a-port" placeholder="__PYCORE_HTTP_PORT__" value="__PYCORE_HTTP_PORT__">
      <select id="a-role"><option value="dev">dev</option><option value="client" selected>client</option></select>
      <button class="primary" onclick="addPeer()">+ Add</button>
    </div>
  </div>

  <div class="card">
    <div class="row" style="cursor:pointer" onclick="toggleTreePanel()">
      <strong>📁 File structure <span class="badge b-violet" id="tree-count" style="display:none"></span></strong>
      <div class="actions">
        <button id="tree-refresh" onclick="event.stopPropagation();loadTree()" style="display:none">↻ Refresh</button>
        <span id="tree-caret" style="font-size:12px;color:#64748b">▸</span>
      </div>
    </div>
    <div class="sub" id="tree-roots" style="margin:6px 0 0;display:none"></div>
    <div id="tree-body" style="display:none;margin-top:10px;max-height:420px;overflow:auto"></div>
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

<div id="drift-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:50;align-items:center;justify-content:center;padding:16px" onclick="if(event.target===this)closeDrift()">
  <div class="card" style="max-width:760px;width:100%;max-height:88vh;overflow:auto;margin:0">
    <div class="row"><strong>📁 Client received tree · drift</strong>
      <div class="actions"><button id="drift-refresh">↻ Refresh</button><button onclick="closeDrift()">✕ Close</button></div>
    </div>
    <div id="drift-body" style="margin-top:10px"></div>
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
  $('#s-transport').textContent = (s.transport && s.transport.label) || '-';
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
  const amDev = SELF && SELF.role === 'dev';
  ul.innerHTML = peers.map(function(p){
    const st = p.status || {};
    const code = st.code || (st.summary && st.summary.code);
    const seen = p.reachable
      ? (p.via==='heartbeat' && p.last_checkin ? 'last contact '+relTime(p.last_checkin) : '')
      : 'last seen '+relTime(p.last_seen);
    const driftBtn = (amDev && p.role === 'client')
      ? '<button onclick="openDrift(\''+esc(p.id).replace(/'/g,"\\'")+'\')">📁 Drift</button>' : '';
    return '<li class="peer">'
      + '<span class="dot '+(p.reachable?'on':'off')+'"></span>'
      + '<div class="grow"><div>'+esc(p.name||p.host)+' '+roleBadge(p.role)+' '+viaBadge(p.via)
      +   (p.pending?' <span class="badge b-pending">pending</span>':'')+phasePill(peerPhase(p))+'</div>'
      + '<div class="meta"><span class="mono">'+esc(p.host)+':'+esc(p.port)+'</span>'
      +   (seen?'<span>· '+seen+'</span>':'')+'<span>· '+codeLine(code)+'</span></div></div>'
      + '<div class="actions">'+driftBtn+'<button class="danger" onclick="removePeer(\''+esc(p.id)+'\')">Remove</button></div>'
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
  loadTree();  // refreshes the file tree only while its panel is open
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

// ---- file structure tree ----
// Collapsible, hidden by default. Per-dir expand state + panel-open state persist
// in localStorage; default shows only the first level (all dirs collapsed).
let TREE = null;
const TREE_OPEN_KEY = 'cs_tree_open', TREE_EXP_KEY = 'cs_tree_expanded';
function treeOpen(){ try{ return localStorage.getItem(TREE_OPEN_KEY)==='1'; }catch(e){ return false; } }
function treeExpanded(){ try{ return JSON.parse(localStorage.getItem(TREE_EXP_KEY)||'{}')||{}; }catch(e){ return {}; } }
function setTreeExpanded(m){ try{ localStorage.setItem(TREE_EXP_KEY, JSON.stringify(m)); }catch(e){} }
function applyTreePanel(){
  const open = treeOpen();
  $('#tree-body').style.display   = open ? '' : 'none';
  $('#tree-roots').style.display  = open ? '' : 'none';
  const rf = $('#tree-refresh'); if(rf) rf.style.display = open ? '' : 'none';
  $('#tree-caret').textContent = open ? '▾' : '▸';
}
function toggleTreePanel(){
  const next = !treeOpen();
  try{ localStorage.setItem(TREE_OPEN_KEY, next?'1':'0'); }catch(e){}
  applyTreePanel();
  if(next) loadTree();
}
function toggleDir(path){
  const m = treeExpanded();
  if(m[path]) delete m[path]; else m[path] = 1;
  setTreeExpanded(m); renderTree();
}
async function loadTree(){
  if(!treeOpen()) return;
  const d = await api('/code-sync/file-tree');
  TREE = (d && d.success) ? d : null;
  renderTree();
}
function treeRows(nodes, depth){
  return '<ul style="margin:0;padding-left:'+(depth?14:0)+'px;list-style:none">' + nodes.map(function(n){
    const pid = esc(n.path).replace(/'/g, "\\'");
    if(n.type==='dir'){
      const exp = !!treeExpanded()[n.path];
      const head = '<li><div style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:2px 0" onclick="toggleDir(\''+pid+'\')">'
        + '<span style="width:12px;display:inline-block;color:#64748b">'+(exp?'▾':'▸')+'</span>'
        + '<span>📁</span><span class="mono">'+esc(n.name)+'</span>'
        + '<span class="muted" style="font-size:11px">'+(n.count||0)+' · '+fmtBytes(n.size||0)+'</span></div>';
      const kids = exp ? treeRows(n.children||[], depth+1) : '';
      return head + kids + '</li>';
    }
    return '<li><div style="display:flex;align-items:center;gap:6px;padding:2px 0">'
      + '<span style="width:12px;display:inline-block"></span>'
      + '<span>📄</span><span class="mono">'+esc(n.name)+'</span>'
      + '<span class="muted" style="font-size:11px">'+fmtBytes(n.size||0)+'</span></div></li>';
  }).join('') + '</ul>';
}
function renderTree(){
  applyTreePanel();
  const body = $('#tree-body'); if(!body) return;
  const cnt = $('#tree-count');
  if(!TREE){ body.innerHTML = '<div class="muted" style="padding:8px">Loading…</div>'; if(cnt) cnt.style.display='none'; return; }
  if(cnt){ cnt.textContent = (TREE.count||0)+' files · '+fmtBytes(TREE.size||0); cnt.style.display=''; }
  const roots = TREE.roots||[];
  $('#tree-roots').innerHTML = '📂 Roots: <span class="mono">'+esc(roots.join(' · ')||'-')+'</span>'
    + (TREE.truncated ? ' <span class="badge b-pending">truncated</span>' : '');
  const nodes = TREE.children||[];
  body.innerHTML = nodes.length ? treeRows(nodes, 0) : '<div class="muted" style="padding:8px">No files in the synced set</div>';
}

// ---- client drift viewer (dev side) ----
// Fetch a specific client's received tree and diff it against this dev's set.
let DRIFT = null, DRIFT_PID = null, DRIFT_TAB = 'missing';
async function openDrift(pid){
  DRIFT_PID = pid; DRIFT = null; DRIFT_TAB = 'missing';
  $('#drift-modal').style.display = 'flex';
  $('#drift-refresh').onclick = function(){ openDrift(DRIFT_PID); };
  $('#drift-body').innerHTML = '<div class="muted" style="padding:16px">Fetching the client’s tree…</div>';
  const d = await api('/code-sync/peer-file-tree?peer_id=' + encodeURIComponent(pid));
  DRIFT = d; renderDrift();
}
function closeDrift(){ $('#drift-modal').style.display = 'none'; DRIFT = null; }
function driftTab(t){ DRIFT_TAB = t; renderDrift(); }
function driftRows(){
  if(DRIFT_TAB === 'tree'){
    const nodes = (DRIFT.tree && DRIFT.tree.children) || [];
    return nodes.length ? treeRows(nodes, 0) : '<div class="muted" style="padding:8px">Client reports no files</div>';
  }
  const rows = (DRIFT.drift && DRIFT.drift[DRIFT_TAB]) || [];
  if(!rows.length) return '<div class="muted" style="padding:8px">Nothing here — this set is clean.</div>';
  return '<ul style="margin:0;padding:0;list-style:none;font-family:monospace;font-size:11px">' + rows.map(function(r){
    const sz = DRIFT_TAB==='changed' ? (fmtBytes(r.size_dev)+' → '+fmtBytes(r.size_client)) : fmtBytes(r.size);
    return '<li style="display:flex;gap:8px;padding:2px 4px"><span class="grow" style="word-break:break-all">'+esc(r.path)+'</span><span class="muted">'+sz+'</span></li>';
  }).join('') + '</ul>';
}
function renderDrift(){
  const body = $('#drift-body'); if(!body || !DRIFT) return;
  if(!DRIFT.success){
    body.innerHTML = '<span class="badge b-pending">unreachable</span>'
      + '<div class="sub" style="margin-top:8px">'+esc(DRIFT.error||'error')+'</div>';
    return;
  }
  const dr = DRIFT.drift || {}, peer = DRIFT.peer || {};
  const tabs = [['missing','Missing',(dr.missing||[]).length],['changed','Changed',(dr.changed||[]).length],
                ['extra','Extra',(dr.extra||[]).length],['tree','Client tree',(DRIFT.tree&&DRIFT.tree.count)||0]];
  body.innerHTML =
      '<div class="sub"><span class="mono">'+esc(peer.name||'')+' · '+esc(peer.host)+':'+esc(peer.port)+'</span></div>'
    + '<div class="iconstrip" style="margin-top:8px">'
    +   '<span>✅ in sync <b>'+(dr.in_sync||0)+'</b></span>'
    +   '<span>➖ missing <b style="color:#f87171">'+((dr.missing||[]).length)+'</b></span>'
    +   '<span>⚠️ changed <b style="color:#fbbf24">'+((dr.changed||[]).length)+'</b></span>'
    +   '<span>➕ extra <b style="color:#38bdf8">'+((dr.extra||[]).length)+'</b></span>'
    +   '<span class="muted">dev '+(dr.dev_count||0)+' · client '+(dr.client_count||0)+'</span>'
    + '</div>'
    + '<div class="rangebtns" style="margin-top:10px;flex-wrap:wrap">'
    +   tabs.map(function(t){ return '<button class="'+(DRIFT_TAB===t[0]?'active':'')+'" onclick="driftTab(\''+t[0]+'\')">'+t[1]+' '+t[2]+'</button>'; }).join('')
    + '</div>'
    + '<div style="max-height:52vh;overflow:auto;margin-top:10px">'+driftRows()+'</div>';
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
  const scanOn = !!FILTERS.scan_lan;
  const scanSw = $('#scan-lan-switch');
  if (scanSw) scanSw.className = 'switch' + (scanOn ? ' on' : '');
  const disc = $('#discover-btn');
  if (disc) disc.disabled = !scanOn || !(SELF && SELF.role === 'dev');
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
async function toggleScanLan(){
  if(!FILTERS) return;
  const enabled = !FILTERS.scan_lan;
  const d = await api('/code-sync/settings', {scan_lan: enabled});
  if(d && d.success){
    FILTERS = d.settings;
    FILTERS_DIRTY = false;
    renderFilters();
  }
}
async function discover(){
  if(!FILTERS || !FILTERS.scan_lan) return;
  const d = await api('/code-sync/discover');
  if(d && d.candidates && d.candidates.length){
    for(const c of d.candidates){ await api('/code-sync/peers/add',
      {name:c.name||c.host, host:c.host, port:c.port, role:c.role||'client'}); }
  }
  load();
}
async function setRole(r){
  await api('/code-sync/role', {role:r});
  load();
}
async function toggleDistribute(on){ await api('/code-sync/distribute', {enabled:on}); load(); }
async function toggleSkip(on){ await api('/code-sync/skip-update', {enabled:on}); load(); }
async function removePeer(id){ await api('/code-sync/peers/remove', {id:id}); load(); }
async function addPeer(){
  const host = $('#a-host').value.trim(); if(!host){ $('#a-host').focus(); return; }
  await api('/code-sync/peers/add', { name: $('#a-name').value.trim() || host, host: host,
    port: parseInt($('#a-port').value,10) || __PYCORE_HTTP_PORT__, role: $('#a-role').value });
  $('#a-name').value=''; $('#a-host').value=''; load();
}
applyTreePanel(); load(); setInterval(load, 5000);
</script>
</body>
</html>
"""
PANEL_HTML = PANEL_HTML.replace("__PYCORE_HTTP_PORT__", str(PYCORE_HTTP_PORT))
