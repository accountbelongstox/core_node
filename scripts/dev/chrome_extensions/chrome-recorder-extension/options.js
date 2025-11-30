// Management Panel JavaScript

let commandHandler = null;
let logBuffer = [];

// DOM Elements
const elements = {
  // Status
  apiStatus: document.getElementById('apiStatus'),
  wsStatus: document.getElementById('wsStatus'),
  audioStatus: document.getElementById('audioStatus'),

  // Config
  enableRemote: document.getElementById('enableRemote'),
  apiUrl: document.getElementById('apiUrl'),
  wsUrl: document.getElementById('wsUrl'),
  authToken: document.getElementById('authToken'),
  pollingInterval: document.getElementById('pollingInterval'),
  deviceId: document.getElementById('deviceId'),

  // Audio
  enableAudioStream: document.getElementById('enableAudioStream'),
  audioStreamUrl: document.getElementById('audioStreamUrl'),
  audioChunkInterval: document.getElementById('audioChunkInterval'),
  includeMic: document.getElementById('includeMic'),
  saveLocalCopy: document.getElementById('saveLocalCopy'),

  // Tabs
  urlInput: document.getElementById('urlInput'),
  tabsList: document.getElementById('tabsList'),

  // Command
  commandSelect: document.getElementById('commandSelect'),
  commandParams: document.getElementById('commandParams'),
  commandResult: document.getElementById('commandResult'),

  // Action result
  actionResult: document.getElementById('actionResult'),

  // Log
  logContainer: document.getElementById('logContainer'),
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  commandHandler = new CommandHandler();
  loadConfig();
  refreshTabs();
  updateStatus();

  setInterval(updateStatus, 3000);
  setInterval(refreshTabs, 10000);
});

function loadConfig() {
  const config = commandHandler.loadConfig();

  elements.enableRemote.checked = config.enabled || false;
  elements.apiUrl.value = config.apiUrl || '';
  elements.wsUrl.value = config.realtimeUrl || '';
  elements.authToken.value = config.authToken || '';
  elements.pollingInterval.value = config.pollingInterval || 5000;
  elements.deviceId.value = config.deviceId || '';

  // Audio config
  const audioConfig = JSON.parse(localStorage.getItem('audioStreamConfig') || '{}');
  elements.enableAudioStream.checked = audioConfig.enabled || false;
  elements.audioStreamUrl.value = audioConfig.url || '';
  elements.audioChunkInterval.value = audioConfig.chunkInterval || 1000;
  elements.includeMic.checked = audioConfig.includeMic !== false;
  elements.saveLocalCopy.checked = audioConfig.saveLocal || false;

  addLog('info', 'Configuration loaded');
}

function saveConfig() {
  const config = {
    enabled: elements.enableRemote.checked,
    apiUrl: elements.apiUrl.value.trim(),
    realtimeUrl: elements.wsUrl.value.trim(),
    authToken: elements.authToken.value.trim(),
    pollingInterval: parseInt(elements.pollingInterval.value) || 5000,
    deviceId: elements.deviceId.value,
  };

  commandHandler.saveConfig(config);

  // Save audio config
  const audioConfig = {
    enabled: elements.enableAudioStream.checked,
    url: elements.audioStreamUrl.value.trim(),
    chunkInterval: parseInt(elements.audioChunkInterval.value) || 1000,
    includeMic: elements.includeMic.checked,
    saveLocal: elements.saveLocalCopy.checked,
  };
  localStorage.setItem('audioStreamConfig', JSON.stringify(audioConfig));

  addLog('success', 'Configuration saved');
}

function updateStatus() {
  const status = commandHandler.getStatus();

  elements.apiStatus.className = 'status-dot ' + (commandHandler.pollingInterval ? 'online' : 'offline');
  elements.wsStatus.className = 'status-dot ' + (status.realtimeConnected ? 'online' : 'offline');
  elements.audioStatus.className = 'status-dot ' + (status.audioStreamActive ? 'online recording' : 'offline');
}

async function refreshTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    elements.tabsList.innerHTML = '';

    tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab-item' + (tab.active ? ' active' : '');
      tabEl.innerHTML = `
        <img src="${tab.favIconUrl || 'icons/not-recording.png'}" onerror="this.src='icons/not-recording.png'">
        <span class="tab-title" title="${tab.url}">${tab.title || 'Untitled'}</span>
        <div class="tab-actions">
          <button class="btn btn-secondary" onclick="switchToTab(${tab.id})">Switch</button>
          <button class="btn btn-danger" onclick="closeTab(${tab.id})">Close</button>
        </div>
      `;
      elements.tabsList.appendChild(tabEl);
    });
  } catch (error) {
    addLog('error', 'Failed to refresh tabs: ' + error.message);
  }
}

async function switchToTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    await chrome.tabs.update(tabId, { active: true });
    addLog('success', 'Switched to tab: ' + tabId);
    setTimeout(refreshTabs, 500);
  } catch (error) {
    addLog('error', 'Failed to switch tab: ' + error.message);
  }
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    addLog('success', 'Closed tab: ' + tabId);
    refreshTabs();
  } catch (error) {
    addLog('error', 'Failed to close tab: ' + error.message);
  }
}

async function openUrl() {
  const url = elements.urlInput.value.trim();
  if (!url) {
    addLog('warn', 'Please enter a URL');
    return;
  }

  try {
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = 'https://' + url;
    }
    await chrome.tabs.create({ url: fullUrl });
    addLog('success', 'Opened URL: ' + fullUrl);
    elements.urlInput.value = '';
    refreshTabs();
  } catch (error) {
    addLog('error', 'Failed to open URL: ' + error.message);
  }
}

async function checkTabAccessible(tab) {
  if (!tab) {
    return { accessible: false, reason: 'No active tab found' };
  }
  if (tab.url.startsWith('chrome://')) {
    return { accessible: false, reason: 'Cannot access Chrome system pages (chrome://)' };
  }
  if (tab.url.startsWith('chrome-extension://')) {
    return { accessible: false, reason: 'Cannot access extension pages. Please switch to a regular webpage.' };
  }
  if (tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
    return { accessible: false, reason: 'Cannot access browser internal pages' };
  }
  return { accessible: true };
}

async function takeScreenshot() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const check = await checkTabAccessible(tab);
    if (!check.accessible) {
      addLog('warn', check.reason);
      showActionResult(check.reason + '\n\nPlease switch to a regular webpage (http:// or https://) and try again.');
      return;
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    showActionResult('Screenshot captured (base64 length: ' + dataUrl.length + ')');

    // Open in new tab to view
    const newTab = await chrome.tabs.create({ url: dataUrl });
    addLog('success', 'Screenshot captured and opened in new tab');
  } catch (error) {
    addLog('error', 'Failed to capture screenshot: ' + error.message);
    showActionResult('Error: ' + error.message);
  }
}

async function getHtml() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const check = await checkTabAccessible(tab);
    if (!check.accessible) {
      addLog('warn', check.reason);
      showActionResult(check.reason + '\n\nPlease switch to a regular webpage (http:// or https://) and try again.');
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML,
    });

    const html = results[0]?.result || '';
    showActionResult('HTML length: ' + html.length + ' characters\n\n' + html.substring(0, 2000) + '...');
    addLog('success', 'Got page HTML (' + html.length + ' chars)');
  } catch (error) {
    addLog('error', 'Failed to get HTML: ' + error.message);
    showActionResult('Error: ' + error.message);
  }
}

async function getConsole() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const check = await checkTabAccessible(tab);
    if (!check.accessible) {
      addLog('warn', check.reason);
      showActionResult(check.reason + '\n\nPlease switch to a regular webpage (http:// or https://) and try again.');
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        if (!window._consoleLogs) return [];
        return window._consoleLogs;
      },
    });

    const logs = results[0]?.result || [];
    if (logs.length === 0) {
      showActionResult('No console logs captured yet.\nNote: Console capture starts when you first call this action.');
    } else {
      const formatted = logs.map(l => `[${l.type}] ${l.message}`).join('\n');
      showActionResult('Console logs (' + logs.length + '):\n\n' + formatted);
    }
    addLog('success', 'Got console logs (' + logs.length + ' entries)');
  } catch (error) {
    addLog('error', 'Failed to get console: ' + error.message);
    showActionResult('Error: ' + error.message);
  }
}

async function reloadPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.reload(tab.id);
    addLog('success', 'Page reloaded');
  } catch (error) {
    addLog('error', 'Failed to reload: ' + error.message);
  }
}

async function executeManualCommand() {
  const command = elements.commandSelect.value;
  let params = {};

  try {
    const paramsText = elements.commandParams.value.trim();
    if (paramsText) {
      params = JSON.parse(paramsText);
    }
  } catch (e) {
    addLog('error', 'Invalid JSON parameters');
    showCommandResult('Error: Invalid JSON parameters');
    return;
  }

  try {
    addLog('info', 'Executing command: ' + command);
    const result = await commandHandler.executeCommand(command, params);
    showCommandResult(JSON.stringify(result, null, 2));
    addLog(result.success ? 'success' : 'error', 'Command result: ' + (result.success ? 'Success' : result.error));
  } catch (error) {
    addLog('error', 'Command failed: ' + error.message);
    showCommandResult('Error: ' + error.message);
  }
}

function showActionResult(text) {
  elements.actionResult.style.display = 'block';
  elements.actionResult.textContent = text;
}

function showCommandResult(text) {
  elements.commandResult.style.display = 'block';
  elements.commandResult.textContent = text;
}

function addLog(type, message) {
  const time = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry ' + type;
  logEntry.innerHTML = `<span class="log-time">${time}</span>${message}`;

  elements.logContainer.insertBefore(logEntry, elements.logContainer.firstChild);

  // Keep only last 100 logs
  while (elements.logContainer.children.length > 100) {
    elements.logContainer.removeChild(elements.logContainer.lastChild);
  }

  logBuffer.push({ time, type, message });
}

function clearLogs() {
  elements.logContainer.innerHTML = '';
  logBuffer = [];
  addLog('info', 'Logs cleared');
}

function startService() {
  saveConfig();
  commandHandler.loadConfig();
  commandHandler.start();
  addLog('success', 'Service started');
  updateStatus();
}

function stopService() {
  commandHandler.stop();
  addLog('info', 'Service stopped');
  updateStatus();
}

async function startAudio() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      addLog('error', 'Cannot record Chrome system pages');
      return;
    }

    // Create offscreen document if needed
    const contexts = await chrome.runtime.getContexts({});
    const offscreenDocument = contexts.find(c => c.contextType === 'OFFSCREEN_DOCUMENT');

    if (!offscreenDocument) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Recording audio',
      });
    }

    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });

    const audioConfig = {
      enabled: elements.enableAudioStream.checked,
      mode: 'websocket',
      url: elements.audioStreamUrl.value.trim(),
      chunkInterval: parseInt(elements.audioChunkInterval.value) || 1000,
      includeMicrophone: elements.includeMic.checked,
      saveLocal: elements.saveLocalCopy.checked,
    };

    chrome.runtime.sendMessage({
      type: 'start-recording',
      target: 'offscreen',
      data: streamId,
      streamingConfig: audioConfig,
    });

    addLog('success', 'Audio streaming started');
    updateStatus();
  } catch (error) {
    addLog('error', 'Failed to start audio: ' + error.message);
  }
}

function stopAudio() {
  chrome.runtime.sendMessage({
    type: 'stop-recording',
    target: 'offscreen',
  });
  addLog('info', 'Audio streaming stopped');
  updateStatus();
}

// Event Listeners
document.getElementById('saveConfig').addEventListener('click', saveConfig);
document.getElementById('startService').addEventListener('click', startService);
document.getElementById('stopService').addEventListener('click', stopService);
document.getElementById('openUrl').addEventListener('click', openUrl);
document.getElementById('refreshTabs').addEventListener('click', refreshTabs);
document.getElementById('takeScreenshot').addEventListener('click', takeScreenshot);
document.getElementById('getHtml').addEventListener('click', getHtml);
document.getElementById('getConsole').addEventListener('click', getConsole);
document.getElementById('reloadPage').addEventListener('click', reloadPage);
document.getElementById('executeCommand').addEventListener('click', executeManualCommand);
document.getElementById('clearLogs').addEventListener('click', clearLogs);
document.getElementById('startAudio').addEventListener('click', startAudio);
document.getElementById('stopAudio').addEventListener('click', stopAudio);

elements.urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') openUrl();
});

// Make functions available globally for inline onclick handlers
window.switchToTab = switchToTab;
window.closeTab = closeTab;

