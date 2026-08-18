'use strict';

const state = { routes: null, self: null, logs: [], minutes: 60 };
const contractUrl = new URL('../routes', document.currentScript.src).pathname;
const byId = (id) => document.getElementById(id);
const endpoint = (name) => state.routes[name];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const escapeAttr = (value) => encodeURIComponent(String(value ?? ''));
const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const suffixes = ['B', 'KB', 'MB', 'GB'];
  let magnitude = size;
  let index = 0;
  while (magnitude >= 1024 && index < suffixes.length - 1) {
    magnitude /= 1024;
    index += 1;
  }
  return `${magnitude.toFixed(index === 0 ? 0 : 1)} ${suffixes[index]}`;
};

async function request(path, body) {
  const options = body === undefined
    ? {}
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function setConnection(online, detail) {
  const badge = byId('connection');
  badge.textContent = online ? 'online' : 'offline';
  badge.className = `badge ${online ? 'online' : 'offline'}`;
  byId('connection-detail').textContent = detail;
}

function renderStatus(status) {
  const self = status.self || status;
  const receiver = status.client || {};
  const sessions = Number(receiver.connected_sessions || 0);
  const pending = status.pending_updates || self.pending_updates || { count: 0, files: [] };
  state.self = self;
  byId('node-name').textContent = self.name || self.hostname || '-';
  byId('role').textContent = self.role || '-';
  byId('files').textContent = Number(self.code?.files || 0).toLocaleString();
  byId('phase').textContent = self.sync_phase?.phase || 'idle';
  byId('transport').textContent = self.transport?.label || '-';
  const detail = self.role === 'client'
    ? `${sessions} inbound DEV SSE session(s)`
    : `${Number(status.server?.connected_clients || self.summary?.clients || 0)} client(s) online · ${status.distributing ? 'distribution enabled' : 'distribution stopped'}`;
  setConnection(true, detail);
  byId('toggle-sync').textContent = self.role === 'dev'
    ? (status.distributing ? 'Stop distribution' : 'Start distribution')
    : (status.skip_update ? 'Resume updates' : 'Pause updates');
  renderPendingUpdates(pending);
}

function renderPeers(peers) {
  const root = byId('peers');
  if (!peers.length) {
    root.className = 'list empty';
    root.textContent = 'No peers.';
    return;
  }
  root.className = 'list';
  root.innerHTML = peers.map((peer) => {
    const phase = peer.status?.sync_phase?.phase || 'idle';
    const connected = Boolean(peer.transport_connected);
    const reachable = connected || Boolean(peer.reachable);
    const connectionLabel = connected ? 'online · HTTP SSE' : (reachable ? 'reachable' : 'offline');
    return `<div class="row"><span>${escapeHtml(peer.name || peer.host)}<br><small>${escapeHtml(peer.host)}:${escapeHtml(peer.port)} · ${escapeHtml(peer.role)} · ${escapeHtml(phase)}</small></span><strong class="${reachable ? 'ok' : 'bad'}">${connectionLabel}</strong></div>`;
  }).join('');
}

function renderPendingUpdates(pending) {
  const root = byId('pending-updates');
  const rows = Array.isArray(pending?.files) ? pending.files : [];
  if (!rows.length) {
    root.className = 'list empty';
    root.textContent = 'No pending updates.';
    return;
  }
  root.className = 'list';
  root.innerHTML = rows.map((item) => {
    const cachedAt = Number(item.cached_at || 0);
    const cachedText = cachedAt ? new Date(cachedAt * 1000).toLocaleString() : '-';
    const rel = String(item.rel || '');
    const relAttr = escapeAttr(rel);
    return `<div class="row"><span>${escapeHtml(item.rel)}<br><small>${escapeHtml(item.source_name || item.source_id || 'source unknown')} · cached ${cachedText} · ${formatBytes(item.size)}</small></span><span class="pending-actions"><button class="mini" type="button" data-action="apply" data-rel="${relAttr}">Apply</button><button class="mini bad" type="button" data-action="clear" data-rel="${relAttr}">Clear</button></span><strong class="ok">${escapeHtml((item.hash || '').slice(0, 12))}</strong></div>`;
  }).join('');
}

function pendingUpdateAction(action, encodedRel) {
  let rel = '';
  try {
    rel = decodeURIComponent(encodedRel || '');
  } catch (error) {
    rel = String(encodedRel || '');
  }
  const actionKey = action === 'apply' ? 'applyPendingUpdate' : action === 'clear' ? 'clearPendingUpdate' : '';
  if (!actionKey || !endpoint(actionKey)) {
    return Promise.reject(new Error('Endpoint not available'));
  }
  return request(endpoint(actionKey), { rel });
}

async function onPendingUpdateClick(event) {
  const button = event.target.closest('button[data-action][data-rel]');
  if (!button || !button.closest('#pending-updates')) return;
  const action = button.getAttribute('data-action');
  const rel = button.getAttribute('data-rel');
  try {
    const response = await pendingUpdateAction(action, rel);
    if (response && response.success === false) {
      throw new Error(response.error || 'Unable to process pending update');
    }
    await refresh();
  } catch (error) {
    setConnection(false, error.message || String(error));
  }
}

function renderLogs() {
  const root = byId('activity');
  const threshold = Date.now() / 1000 - state.minutes * 60;
  const rows = state.logs.filter((entry) => Number(entry.timestamp || 0) >= threshold);
  if (!rows.length) {
    root.className = 'list empty';
    root.textContent = `No activity in the last ${state.minutes < 60 ? `${state.minutes}m` : `${state.minutes / 60}h`}.`;
    return;
  }
  root.className = 'list';
  root.innerHTML = rows.slice().reverse().map((entry) => (
    `<div class="row"><span>${escapeHtml(entry.file_path || entry.reason || entry.action || 'sync')}<br><small>${escapeHtml(entry.details || entry.reason || '')}</small></span><small>${new Date(Number(entry.timestamp || 0) * 1000).toLocaleString()}</small></div>`
  )).join('');
}

async function refresh() {
  try {
    const [status, peers, logs] = await Promise.all([
      request(endpoint('status')),
      request(endpoint('peers')),
      request(`${endpoint('logs')}?limit=300`),
    ]);
    renderStatus(status);
    renderPeers(peers.peers || []);
    state.logs = logs.logs || [];
    renderLogs();
  } catch (error) {
    setConnection(false, error.message || String(error));
  }
}

async function setRole(role) {
  await request(endpoint('role'), { role });
  await refresh();
}

async function toggleSync() {
  const self = state.self || {};
  if (self.role === 'dev') {
    await request(endpoint('distribute'), { enabled: !Boolean(self.distributing) });
  } else {
    await request(endpoint('skipUpdate'), { enabled: !Boolean(self.skip_update) });
  }
  await refresh();
}

async function start() {
  state.routes = await request(contractUrl);
  byId('role-dev').addEventListener('click', () => setRole('dev'));
  byId('role-client').addEventListener('click', () => setRole('client'));
  byId('toggle-sync').addEventListener('click', toggleSync);
  byId('pending-updates').addEventListener('click', onPendingUpdateClick);
  document.querySelectorAll('[data-minutes]').forEach((button) => {
    button.addEventListener('click', () => {
      state.minutes = Number(button.dataset.minutes);
      document.querySelectorAll('[data-minutes]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      renderLogs();
    });
  });
  await refresh();
  window.setInterval(refresh, 5000);
}

start().catch((error) => setConnection(false, error.message || String(error)));
