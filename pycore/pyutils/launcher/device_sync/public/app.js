'use strict';

const contractUrl = new URL('../routes', document.currentScript.src).pathname;
const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function refresh(routes) {
  const status = await getJson(routes.status);
  const devices = await getJson(routes.devices);
  byId('connection').textContent = 'online';
  byId('connection').className = 'online';
  byId('status').innerHTML = `<div class="row">${escapeHtml(status.hostname || status.device_id || 'device')} · ${escapeHtml(status.mode || (status.is_primary ? 'primary' : 'secondary'))}</div>`;
  const rows = devices.devices || [];
  byId('devices').innerHTML = rows.length
    ? rows.map((device) => `<div class="row">${escapeHtml(device.hostname || device.ip || 'device')}</div>`).join('')
    : '<div class="row">No online devices.</div>';
}

async function start() {
  const routes = await getJson(contractUrl);
  await refresh(routes);
  window.setInterval(() => refresh(routes), 5000);
}

start().catch((error) => { byId('status').textContent = error.message || String(error); });
