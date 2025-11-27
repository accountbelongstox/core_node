// Browser Bridge - Popup Script with Service Discovery

// DOM Elements
const elements = {
  // Status
  apiStatus: document.getElementById('apiStatus'),
  wsStatus: document.getElementById('wsStatus'),
  audioStatus: document.getElementById('audioStatus'),
  discoveryStatus: document.getElementById('discoveryStatus'),

  // Main buttons
  startAll: document.getElementById('startAll'),
  stopAll: document.getElementById('stopAll'),

  // Service discovery
  apiUrl: document.getElementById('apiUrl'),
  scanNetwork: document.getElementById('scanNetwork'),
  testConnection: document.getElementById('testConnection'),
  discoveredServices: document.getElementById('discoveredServices'),

  // Recording settings
  enableAudio: document.getElementById('enableAudio'),
  includeMic: document.getElementById('includeMic'),
  streamAudio: document.getElementById('streamAudio'),
  saveLocal: document.getElementById('saveLocal'),
  chunkInterval: document.getElementById('chunkInterval'),

  // Remote control
  enablePolling: document.getElementById('enablePolling'),
  pollingInterval: document.getElementById('pollingInterval'),
  wsUrl: document.getElementById('wsUrl'),

  // Auxiliary Features
  toggleAux: document.getElementById('toggleAux'),
  auxContent: document.getElementById('auxContent'),
  auxStatus: document.getElementById('auxStatus'),
  checkinStatus: document.getElementById('checkinStatus'),
  checkinSites: document.getElementById('checkinSites'),
  newSiteUrl: document.getElementById('newSiteUrl'),
  addSiteBtn: document.getElementById('addSiteBtn'),
  checkinAllBtn: document.getElementById('checkinAllBtn'),
  // Quick Actions
  clearCacheBtn: document.getElementById('clearCacheBtn'),
  reloadExtBtn: document.getElementById('reloadExtBtn'),
  closeOtherTabsBtn: document.getElementById('closeOtherTabsBtn'),
  screenshotBtn: document.getElementById('screenshotBtn'),

  // Log
  logArea: document.getElementById('logArea'),

  // Collapsible toggles
  toggleDiscovery: document.getElementById('toggleDiscovery'),
  toggleRecording: document.getElementById('toggleRecording'),
  toggleRemote: document.getElementById('toggleRemote'),
  discoveryContent: document.getElementById('discoveryContent'),
  recordingContent: document.getElementById('recordingContent'),
  remoteContent: document.getElementById('remoteContent'),

  // Links
  openFullPanel: document.getElementById('openFullPanel'),
};

// State
let isRunning = false;
let discoveredServices = [];
let pollingTimer = null;
let websocket = null;
let deviceId = null;
let checkinManager = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  deviceId = getDeviceId();
  loadConfig();
  setupCollapsibles();
  setupEventListeners();

  // Initialize daily check-in manager
  checkinManager = new DailyCheckinManager();
  renderCheckinSites();
  updateCheckinStatus();

  // Run scheduled checks
  checkinManager.runScheduledChecks().then(results => {
    results.forEach(r => {
      if (r.success) {
        addLog('success', `Auto check-in: ${r.siteName}`);
      }
    });
  });

  // Auto-discover on first load if no API URL set
  const config = loadConfig();
  if (!config.apiUrl) {
    addLog('info', 'Auto-discovering services...');
    setTimeout(scanNetwork, 500);
  } else {
    testConnection(config.apiUrl);
  }
});

function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = 'browser_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    localStorage.setItem('deviceId', id);
  }
  return id;
}

function loadConfig() {
  const saved = localStorage.getItem('bridgeConfig');
  const config = saved ? JSON.parse(saved) : {
    apiUrl: '',
    wsUrl: '',
    enableAudio: true,
    includeMic: true,
    streamAudio: true,
    saveLocal: false,
    chunkInterval: 1000,
    enablePolling: true,
    pollingInterval: 3000,
  };

  // Apply to UI
  elements.apiUrl.value = config.apiUrl || '';
  elements.wsUrl.value = config.wsUrl || '';
  elements.enableAudio.checked = config.enableAudio !== false;
  elements.includeMic.checked = config.includeMic !== false;
  elements.streamAudio.checked = config.streamAudio !== false;
  elements.saveLocal.checked = config.saveLocal || false;
  elements.chunkInterval.value = config.chunkInterval || 1000;
  elements.enablePolling.checked = config.enablePolling !== false;
  elements.pollingInterval.value = config.pollingInterval || 3000;

  return config;
}

function saveConfig() {
  const config = {
    apiUrl: elements.apiUrl.value.trim(),
    wsUrl: elements.wsUrl.value.trim(),
    enableAudio: elements.enableAudio.checked,
    includeMic: elements.includeMic.checked,
    streamAudio: elements.streamAudio.checked,
    saveLocal: elements.saveLocal.checked,
    chunkInterval: parseInt(elements.chunkInterval.value) || 1000,
    enablePolling: elements.enablePolling.checked,
    pollingInterval: parseInt(elements.pollingInterval.value) || 3000,
  };
  localStorage.setItem('bridgeConfig', JSON.stringify(config));
  return config;
}

function setupCollapsibles() {
  const toggles = [
    { toggle: elements.toggleDiscovery, content: elements.discoveryContent },
    { toggle: elements.toggleRecording, content: elements.recordingContent },
    { toggle: elements.toggleRemote, content: elements.remoteContent },
    { toggle: elements.toggleAux, content: elements.auxContent },
  ];

  toggles.forEach(({ toggle, content }) => {
    if (toggle && content) {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('collapsed');
        content.classList.toggle('hidden');
      });
    }
  });
}

function setupEventListeners() {
  // Start/Stop all
  elements.startAll.addEventListener('click', startAllServices);
  elements.stopAll.addEventListener('click', stopAllServices);

  // Discovery
  elements.scanNetwork.addEventListener('click', scanNetwork);
  elements.testConnection.addEventListener('click', () => testConnection(elements.apiUrl.value));

  // Save config on change
  const configElements = [
    elements.apiUrl, elements.wsUrl, elements.enableAudio, elements.includeMic,
    elements.streamAudio, elements.saveLocal, elements.chunkInterval,
    elements.enablePolling, elements.pollingInterval
  ];
  configElements.forEach(el => {
    el.addEventListener('change', saveConfig);
    if (el.tagName === 'INPUT' && el.type === 'text') {
      el.addEventListener('input', saveConfig);
    }
  });

  // Full panel
  elements.openFullPanel.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Daily Check-in / Auto-Refresh
  if (elements.addSiteBtn) {
    elements.addSiteBtn.addEventListener('click', addCheckinSite);
  }
  if (elements.checkinAllBtn) {
    elements.checkinAllBtn.addEventListener('click', checkinAll);
  }
  if (elements.newSiteUrl) {
    elements.newSiteUrl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addCheckinSite();
    });
  }

  // Quick Actions
  if (elements.clearCacheBtn) {
    elements.clearCacheBtn.addEventListener('click', clearBrowsingCache);
  }
  if (elements.reloadExtBtn) {
    elements.reloadExtBtn.addEventListener('click', reloadExtension);
  }
  if (elements.closeOtherTabsBtn) {
    elements.closeOtherTabsBtn.addEventListener('click', closeOtherTabs);
  }
  if (elements.screenshotBtn) {
    elements.screenshotBtn.addEventListener('click', takeQuickScreenshot);
  }
}

// Daily Check-in Functions
function renderCheckinSites() {
  if (!checkinManager || !elements.checkinSites) return;

  const sites = checkinManager.getStatus();
  elements.checkinSites.innerHTML = '';

  if (sites.length === 0) {
    elements.checkinSites.innerHTML = '<div style="color:#888;font-size:10px;text-align:center;padding:8px;">No sites configured</div>';
    return;
  }

  sites.forEach(site => {
    const div = document.createElement('div');
    div.className = 'service-item' + (site.checkedToday ? ' selected' : '');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(255,255,255,0.05);border-radius:4px;margin-bottom:4px;font-size:10px;';
    
    const statusIcon = site.checkedToday ? '✓' : '○';
    const statusColor = site.checkedToday ? '#00ff88' : '#888';
    
    div.innerHTML = `
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${site.url}">
        <span style="color:${statusColor};margin-right:4px;">${statusIcon}</span>
        ${site.name}
      </span>
      <div style="display:flex;gap:4px;">
        <button class="btn btn-secondary" style="padding:2px 6px;font-size:9px;" onclick="checkinSite('${site.id}')">
          ${site.checkedToday ? 'Refresh' : 'Check-in'}
        </button>
        <button class="btn btn-danger" style="padding:2px 6px;font-size:9px;" onclick="removeSite('${site.id}')">×</button>
      </div>
    `;
    elements.checkinSites.appendChild(div);
  });
}

function updateCheckinStatus() {
  if (!checkinManager) return;

  const sites = checkinManager.getStatus();
  const total = sites.length;
  const checked = sites.filter(s => s.checkedToday).length;

  // Update checkin status tag
  if (elements.checkinStatus) {
    if (total === 0) {
      elements.checkinStatus.textContent = '0';
      elements.checkinStatus.style.background = 'rgba(255,255,255,0.1)';
      elements.checkinStatus.style.color = '#888';
    } else if (checked === total) {
      elements.checkinStatus.textContent = `${checked}/${total} ✓`;
      elements.checkinStatus.style.background = 'rgba(0,255,136,0.2)';
      elements.checkinStatus.style.color = '#00ff88';
    } else {
      elements.checkinStatus.textContent = `${checked}/${total}`;
      elements.checkinStatus.style.background = 'rgba(255,170,0,0.2)';
      elements.checkinStatus.style.color = '#ffaa00';
    }
  }

  // Update auxiliary features status tag
  if (elements.auxStatus) {
    if (total === 0) {
      elements.auxStatus.textContent = 'Ready';
      elements.auxStatus.style.background = 'rgba(255,255,255,0.1)';
      elements.auxStatus.style.color = '#888';
    } else if (checked === total) {
      elements.auxStatus.textContent = 'All Done ✓';
      elements.auxStatus.style.background = 'rgba(0,255,136,0.2)';
      elements.auxStatus.style.color = '#00ff88';
    } else {
      elements.auxStatus.textContent = `${total - checked} pending`;
      elements.auxStatus.style.background = 'rgba(255,170,0,0.2)';
      elements.auxStatus.style.color = '#ffaa00';
    }
  }
}

async function addCheckinSite() {
  const url = elements.newSiteUrl.value.trim();
  if (!url) {
    addLog('warn', 'Please enter a URL');
    return;
  }

  let fullUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    fullUrl = 'https://' + url;
  }

  try {
    const parsedUrl = new URL(fullUrl);
    checkinManager.addSite({
      name: parsedUrl.hostname,
      url: fullUrl,
    });
    elements.newSiteUrl.value = '';
    renderCheckinSites();
    updateCheckinStatus();
    addLog('success', 'Added site: ' + parsedUrl.hostname);
  } catch (e) {
    addLog('error', 'Invalid URL');
  }
}

async function checkinSite(siteId) {
  addLog('info', 'Checking in...');
  const result = await checkinManager.performCheckin(siteId, true);
  if (result.success) {
    addLog('success', 'Check-in: ' + result.site);
  } else {
    addLog('warn', result.error || 'Check-in failed');
  }
  renderCheckinSites();
  updateCheckinStatus();
}

async function checkinAll() {
  addLog('info', 'Checking in all sites...');
  const results = await checkinManager.checkAllSites(true);
  let successCount = 0;
  results.forEach(r => {
    if (r.success) {
      successCount++;
      addLog('success', 'Checked: ' + r.siteName);
    }
  });
  addLog('info', `Completed: ${successCount}/${results.length}`);
  renderCheckinSites();
  updateCheckinStatus();
}

function removeSite(siteId) {
  checkinManager.removeSite(siteId);
  renderCheckinSites();
  updateCheckinStatus();
  addLog('info', 'Site removed');
}

// Quick Action Functions
async function clearBrowsingCache() {
  try {
    await chrome.browsingData.removeCache({ since: 0 });
    addLog('success', 'Cache cleared');
  } catch (e) {
    addLog('error', 'Failed to clear cache: ' + e.message);
  }
}

function reloadExtension() {
  addLog('info', 'Reloading extension...');
  chrome.runtime.reload();
}

async function closeOtherTabs() {
  try {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const tabsToClose = allTabs.filter(t => t.id !== currentTab.id).map(t => t.id);
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
      addLog('success', `Closed ${tabsToClose.length} tabs`);
    } else {
      addLog('info', 'No other tabs to close');
    }
  } catch (e) {
    addLog('error', 'Failed: ' + e.message);
  }
}

async function takeQuickScreenshot() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `screenshot_${Date.now()}.png`;
    link.click();
    addLog('success', 'Screenshot saved');
  } catch (e) {
    addLog('error', 'Screenshot failed: ' + e.message);
  }
}

function addPresetSite(url, name) {
  if (!checkinManager) return;
  
  // Check if already exists
  const sites = checkinManager.getSites();
  const exists = sites.some(s => s.url.includes(url) || s.name === name);
  if (exists) {
    addLog('warn', name + ' already added');
    return;
  }

  const fullUrl = url.startsWith('http') ? url : 'https://' + url;
  checkinManager.addSite({ name, url: fullUrl });
  renderCheckinSites();
  updateCheckinStatus();
  addLog('success', 'Added: ' + name);
}

// Make functions available globally for onclick handlers
window.checkinSite = checkinSite;
window.removeSite = removeSite;
window.addPresetSite = addPresetSite;

// Service Discovery
async function scanNetwork() {
  elements.discoveryStatus.textContent = 'Scanning...';
  elements.discoveryStatus.style.background = 'rgba(255,170,0,0.2)';
  elements.discoveryStatus.style.color = '#ffaa00';
  elements.scanNetwork.disabled = true;
  discoveredServices = [];
  elements.discoveredServices.innerHTML = '';

  addLog('info', 'Starting network scan...');

  // Get possible network segments
  const segments = await detectNetworkSegments();
  addLog('info', `Found ${segments.length} network segment(s) to scan`);

  const port = 9000;
  const promises = [];

  for (const segment of segments) {
    // Scan common addresses in each segment
    const addressesToScan = [
      `${segment}.1`,    // Gateway
      `${segment}.100`,
      `${segment}.101`,
      `${segment}.102`,
      `${segment}.200`,
      `${segment}.2`,
      `${segment}.10`,
      `${segment}.50`,
    ];

    // Also scan .1 to .20 for small networks
    for (let i = 1; i <= 20; i++) {
      if (!addressesToScan.includes(`${segment}.${i}`)) {
        addressesToScan.push(`${segment}.${i}`);
      }
    }

    for (const addr of addressesToScan) {
      promises.push(probeService(`http://${addr}:${port}`));
    }
  }

  // Also try localhost
  promises.push(probeService('http://localhost:9000'));
  promises.push(probeService('http://127.0.0.1:9000'));

  const results = await Promise.allSettled(promises);

  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      discoveredServices.push(result.value);
    }
  });

  elements.scanNetwork.disabled = false;

  if (discoveredServices.length > 0) {
    elements.discoveryStatus.textContent = `Found ${discoveredServices.length}`;
    elements.discoveryStatus.style.background = 'rgba(0,255,136,0.2)';
    elements.discoveryStatus.style.color = '#00ff88';
    addLog('success', `Found ${discoveredServices.length} service(s)`);

    // Display discovered services
    renderDiscoveredServices();

    // Auto-select first service if no URL set
    if (!elements.apiUrl.value && discoveredServices.length > 0) {
      selectService(discoveredServices[0].url);
    }
  } else {
    elements.discoveryStatus.textContent = 'No services';
    elements.discoveryStatus.style.background = 'rgba(255,68,68,0.2)';
    elements.discoveryStatus.style.color = '#ff4444';
    addLog('warn', 'No services found on port 9000');
  }
}

async function detectNetworkSegments() {
  const segments = new Set();

  // Try WebRTC to get local IPs
  try {
    const ips = await getLocalIPs();
    ips.forEach(ip => {
      const parts = ip.split('.');
      if (parts.length === 4) {
        segments.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
      }
    });
  } catch (e) {
    addLog('warn', 'WebRTC IP detection failed');
  }

  // Add common private network segments as fallback
  if (segments.size === 0) {
    segments.add('192.168.1');
    segments.add('192.168.0');
    segments.add('192.168.31');
    segments.add('10.0.0');
    segments.add('172.16.0');
  }

  return Array.from(segments);
}

function getLocalIPs() {
  return new Promise((resolve) => {
    const ips = [];
    const RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;

    if (!RTCPeerConnection) {
      resolve(ips);
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');

    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        pc.close();
        resolve(ips);
        return;
      }
      const parts = e.candidate.candidate.split(' ');
      const ip = parts[4];
      if (ip && ip.match(/^(\d{1,3}\.){3}\d{1,3}$/) && !ip.startsWith('0.')) {
        if (!ips.includes(ip)) {
          ips.push(ip);
        }
      }
    };

    pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {
      resolve(ips);
    });

    // Timeout
    setTimeout(() => {
      pc.close();
      resolve(ips);
    }, 1000);
  });
}

async function probeService(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      return { url, status: 'online' };
    }
  } catch (e) {
    // Try poll endpoint as fallback
    try {
      const response2 = await fetch(`${url}/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'probe', timestamp: Date.now() }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response2.ok) {
        return { url, status: 'online' };
      }
    } catch (e2) {
      // Service not available
    }
  }
  clearTimeout(timeout);
  return null;
}

function renderDiscoveredServices() {
  elements.discoveredServices.innerHTML = '';
  discoveredServices.forEach(service => {
    const div = document.createElement('div');
    div.className = 'service-item' + (elements.apiUrl.value === service.url ? ' selected' : '');
    div.innerHTML = `
      <span>${service.url}</span>
      <button class="btn btn-secondary" style="padding:2px 6px;font-size:9px;" onclick="selectService('${service.url}')">Select</button>
    `;
    elements.discoveredServices.appendChild(div);
  });
}

function selectService(url) {
  elements.apiUrl.value = url;
  // Auto-set WebSocket URL
  const wsUrl = url.replace('http://', 'ws://').replace(':9000', ':9001');
  elements.wsUrl.value = wsUrl;
  saveConfig();
  addLog('success', 'Selected: ' + url);
  renderDiscoveredServices();
  testConnection(url);
}

// Make selectService available globally for onclick
window.selectService = selectService;

async function testConnection(url) {
  if (!url) {
    addLog('warn', 'No URL to test');
    return false;
  }

  addLog('info', 'Testing connection to ' + url);
  elements.apiStatus.className = 'status-dot scanning';

  try {
    const response = await fetch(`${url}/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, timestamp: Date.now(), status: {} }),
    });

    if (response.ok) {
      elements.apiStatus.className = 'status-dot online';
      addLog('success', 'API connection OK');
      return true;
    } else {
      elements.apiStatus.className = 'status-dot';
      addLog('error', 'API returned error: ' + response.status);
      return false;
    }
  } catch (error) {
    elements.apiStatus.className = 'status-dot';
    addLog('error', 'Connection failed: ' + error.message);
    return false;
  }
}

// Start/Stop Services
async function startAllServices() {
  const config = saveConfig();

  if (!config.apiUrl) {
    addLog('warn', 'No API URL configured. Running scan...');
    await scanNetwork();
    if (!elements.apiUrl.value) {
      addLog('error', 'Please configure API URL or ensure server is running');
      return;
    }
  }

  addLog('info', 'Starting all services...');
  isRunning = true;
  elements.startAll.style.display = 'none';
  elements.stopAll.style.display = 'block';

  // Start polling
  if (config.enablePolling) {
    startPolling(config);
  }

  // Connect WebSocket
  const wsUrl = config.wsUrl || config.apiUrl.replace('http://', 'ws://').replace(':9000', ':9001');
  connectWebSocket(wsUrl);

  // Start audio if enabled
  if (config.enableAudio) {
    await startAudioCapture(config);
  }

  addLog('success', 'All services started');
}

function stopAllServices() {
  addLog('info', 'Stopping all services...');
  isRunning = false;
  elements.startAll.style.display = 'block';
  elements.stopAll.style.display = 'none';

  // Stop polling
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  elements.apiStatus.className = 'status-dot';

  // Disconnect WebSocket
  if (websocket) {
    websocket.close();
    websocket = null;
  }
  elements.wsStatus.className = 'status-dot';

  // Stop audio
  chrome.runtime.sendMessage({ type: 'stop-recording', target: 'offscreen' });
  elements.audioStatus.className = 'status-dot';

  addLog('info', 'All services stopped');
}

function startPolling(config) {
  if (pollingTimer) {
    clearInterval(pollingTimer);
  }

  const poll = async () => {
    if (!isRunning) return;

    try {
      const response = await fetch(`${config.apiUrl}/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          timestamp: Date.now(),
          status: { isRunning, audioActive: elements.audioStatus.classList.contains('online') },
        }),
      });

      if (response.ok) {
        elements.apiStatus.className = 'status-dot online';
        const data = await response.json();
        if (data.command) {
          addLog('info', 'Received command: ' + data.command);
          executeCommand(data.command, data.params);
        }
      } else {
        elements.apiStatus.className = 'status-dot';
      }
    } catch (error) {
      elements.apiStatus.className = 'status-dot';
    }
  };

  poll();
  pollingTimer = setInterval(poll, config.pollingInterval);
}

function connectWebSocket(url) {
  if (websocket) {
    websocket.close();
  }

  try {
    websocket = new WebSocket(url);
    websocket.binaryType = 'arraybuffer';

    websocket.onopen = () => {
      elements.wsStatus.className = 'status-dot online';
      addLog('success', 'WebSocket connected');
      websocket.send(JSON.stringify({ type: 'register', deviceId }));
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.command) {
          addLog('info', 'WS command: ' + data.command);
          executeCommand(data.command, data.params);
        }
      } catch (e) {
        // Binary data
      }
    };

    websocket.onclose = () => {
      elements.wsStatus.className = 'status-dot';
      if (isRunning) {
        addLog('warn', 'WebSocket disconnected, reconnecting...');
        setTimeout(() => connectWebSocket(url), 3000);
      }
    };

    websocket.onerror = () => {
      elements.wsStatus.className = 'status-dot';
    };
  } catch (error) {
    addLog('error', 'WebSocket error: ' + error.message);
  }
}

async function startAudioCapture(config) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      addLog('warn', 'Cannot capture audio from this page. Please switch to a regular webpage.');
      return;
    }

    // Create offscreen document
    const contexts = await chrome.runtime.getContexts({});
    const offscreenDoc = contexts.find(c => c.contextType === 'OFFSCREEN_DOCUMENT');

    if (!offscreenDoc) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Audio capture',
      });
    }

    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });

    const streamingConfig = {
      enabled: config.streamAudio,
      mode: 'websocket',
      url: config.wsUrl || config.apiUrl.replace('http://', 'ws://').replace(':9000', ':9001'),
      chunkInterval: config.chunkInterval,
      includeMicrophone: config.includeMic,
      saveLocal: config.saveLocal,
    };

    chrome.runtime.sendMessage({
      type: 'start-recording',
      target: 'offscreen',
      data: streamId,
      streamingConfig,
    });

    elements.audioStatus.className = 'status-dot online';
    addLog('success', 'Audio capture started');
  } catch (error) {
    addLog('error', 'Audio capture failed: ' + error.message);
  }
}

async function executeCommand(command, params = {}) {
  // Forward command to command handler or handle locally
  switch (command) {
    case 'open_url':
      if (params.url) {
        await chrome.tabs.create({ url: params.url, active: params.active !== false });
        reportResult(command, { success: true });
      }
      break;
    case 'close_tab':
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (params.tabId) {
        await chrome.tabs.remove(params.tabId);
      } else if (currentTab) {
        await chrome.tabs.remove(currentTab.id);
      }
      reportResult(command, { success: true });
      break;
    case 'screenshot':
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        reportResult(command, { success: true, data: { screenshot: dataUrl } });
      } catch (e) {
        reportResult(command, { success: false, error: e.message });
      }
      break;
    case 'get_tabs':
      const tabs = await chrome.tabs.query({});
      reportResult(command, { success: true, data: { tabs: tabs.map(t => ({ id: t.id, url: t.url, title: t.title })) } });
      break;
    default:
      addLog('warn', 'Unknown command: ' + command);
  }
}

function reportResult(command, result) {
  const config = loadConfig();

  // Report via HTTP
  if (config.apiUrl) {
    fetch(`${config.apiUrl}/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, command, result, timestamp: Date.now() }),
    }).catch(() => {});
  }

  // Report via WebSocket
  if (websocket?.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({ type: 'command_result', command, result, timestamp: Date.now() }));
  }
}

function addLog(type, message) {
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + type;
  entry.textContent = new Date().toLocaleTimeString() + ' - ' + message;
  elements.logArea.insertBefore(entry, elements.logArea.firstChild);

  // Keep only last 20 entries
  while (elements.logArea.children.length > 20) {
    elements.logArea.removeChild(elements.logArea.lastChild);
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message) => {
  if (message.target === 'popup') {
    switch (message.type) {
      case 'recording-error':
        addLog('error', message.error);
        elements.audioStatus.className = 'status-dot';
        break;
      case 'recording-stopped':
        elements.audioStatus.className = 'status-dot';
        break;
    }
  }
});
