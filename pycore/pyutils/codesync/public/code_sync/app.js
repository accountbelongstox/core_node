'use strict';

const state = { routes: null, self: null, logs: [], minutes: 60 };
const contractUrl = new URL('../routes', document.currentScript.src).pathname;
const byId = (id) => document.getElementById(id);
const endpoint = (name) => state.routes[name];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

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
  state.self = self;
  byId('node-name').textContent = self.name || self.hostname || '-';
  byId('role').textContent = self.role || '-';
  byId('files').textContent = Number(self.code?.files || 0).toLocaleString();
  byId('phase').textContent = self.sync_phase?.phase || 'idle';
  byId('transport').textContent = self.transport?.label || '-';
  const detail = self.role === 'client'
    ? `${sessions} inbound DEV SSE session(s)`
    : `${status.distributing ? 'Distribution enabled' : 'Distribution stopped'}`;
  setConnection(true, detail);
  byId('toggle-sync').textContent = self.role === 'dev'
    ? (status.distributing ? 'Stop distribution' : 'Start distribution')
    : (status.skip_update ? 'Resume updates' : 'Pause updates');
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
    const reachable = Boolean(peer.reachable);
    return `<div class="row"><span>${escapeHtml(peer.name || peer.host)}<br><small>${escapeHtml(peer.host)}:${escapeHtml(peer.port)} · ${escapeHtml(peer.role)} · ${escapeHtml(phase)}</small></span><strong class="${reachable ? 'ok' : 'bad'}">${reachable ? 'reachable' : 'offline'}</strong></div>`;
  }).join('');
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
