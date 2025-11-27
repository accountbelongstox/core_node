// Command Handler Module
// Handles API polling and command execution

class CommandHandler {
  constructor() {
    this.config = null;
    this.pollingInterval = null;
    this.isExecutingTask = false;
    this.audioStreamActive = false;
    this.websocket = null;
    this.consoleBuffer = [];
    this.maxConsoleBuffer = 1000;
  }

  loadConfig() {
    const saved = localStorage.getItem('commandConfig');
    if (saved) {
      this.config = JSON.parse(saved);
    } else {
      this.config = {
        enabled: false,
        apiUrl: '',
        pollingInterval: 5000,
        realtimeUrl: '',
        authToken: '',
        deviceId: this.generateDeviceId(),
      };
    }
    return this.config;
  }

  saveConfig(config) {
    this.config = config;
    localStorage.setItem('commandConfig', JSON.stringify(config));
  }

  generateDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  start() {
    if (!this.config || !this.config.enabled || !this.config.apiUrl) {
      console.log('[CommandHandler] Not configured or disabled');
      return;
    }

    this.connectRealtime();
    this.startPolling();
    console.log('[CommandHandler] Started');
  }

  stop() {
    this.stopPolling();
    this.disconnectRealtime();
    console.log('[CommandHandler] Stopped');
  }

  startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollOnce();
    this.pollingInterval = setInterval(() => {
      if (!this.isExecutingTask) {
        this.pollOnce();
      }
    }, this.config.pollingInterval || 5000);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async pollOnce() {
    try {
      const response = await fetch(this.config.apiUrl + '/poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.authToken ? `Bearer ${this.config.authToken}` : '',
        },
        body: JSON.stringify({
          deviceId: this.config.deviceId,
          timestamp: Date.now(),
          status: this.getStatus(),
        }),
      });

      if (!response.ok) {
        console.error('[CommandHandler] Poll failed:', response.status);
        return;
      }

      const data = await response.json();
      if (data.command) {
        await this.executeCommand(data.command, data.params);
      }
    } catch (error) {
      console.error('[CommandHandler] Poll error:', error);
    }
  }

  getStatus() {
    return {
      isExecutingTask: this.isExecutingTask,
      audioStreamActive: this.audioStreamActive,
      realtimeConnected: this.websocket?.readyState === WebSocket.OPEN,
    };
  }

  connectRealtime() {
    if (!this.config.realtimeUrl) return;

    try {
      this.websocket = new WebSocket(this.config.realtimeUrl);
      this.websocket.binaryType = 'arraybuffer';

      this.websocket.onopen = () => {
        console.log('[CommandHandler] Realtime connected');
        this.sendRealtimeMessage({ type: 'register', deviceId: this.config.deviceId });
      };

      this.websocket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.command) {
            await this.executeCommand(data.command, data.params);
          }
        } catch (e) {
          // Binary data (audio response, etc.)
        }
      };

      this.websocket.onclose = () => {
        console.log('[CommandHandler] Realtime disconnected, reconnecting in 5s...');
        setTimeout(() => this.connectRealtime(), 5000);
      };

      this.websocket.onerror = (error) => {
        console.error('[CommandHandler] Realtime error:', error);
      };
    } catch (error) {
      console.error('[CommandHandler] Failed to connect realtime:', error);
    }
  }

  disconnectRealtime() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  sendRealtimeMessage(data) {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(data));
    }
  }

  sendRealtimeBinary(data) {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(data);
    }
  }

  async executeCommand(command, params = {}) {
    console.log('[CommandHandler] Executing:', command, params);
    this.isExecutingTask = true;

    let result = { success: false, error: null, data: null };

    try {
      switch (command) {
        case 'open_url':
          result = await this.cmdOpenUrl(params);
          break;
        case 'close_url':
          result = await this.cmdCloseUrl(params);
          break;
        case 'close_tab':
          result = await this.cmdCloseTab(params);
          break;
        case 'switch_tab':
          result = await this.cmdSwitchTab(params);
          break;
        case 'screenshot':
          result = await this.cmdScreenshot(params);
          break;
        case 'get_html':
          result = await this.cmdGetHtml(params);
          break;
        case 'get_console':
          result = await this.cmdGetConsole(params);
          break;
        case 'execute_script':
          result = await this.cmdExecuteScript(params);
          break;
        case 'get_tabs':
          result = await this.cmdGetTabs(params);
          break;
        case 'start_audio':
          result = await this.cmdStartAudio(params);
          break;
        case 'stop_audio':
          result = await this.cmdStopAudio(params);
          break;
        case 'navigate':
          result = await this.cmdNavigate(params);
          break;
        case 'reload':
          result = await this.cmdReload(params);
          break;
        case 'click':
          result = await this.cmdClick(params);
          break;
        case 'input':
          result = await this.cmdInput(params);
          break;
        default:
          result = { success: false, error: `Unknown command: ${command}` };
      }
    } catch (error) {
      result = { success: false, error: error.message };
    }

    this.isExecutingTask = false;

    // Report result
    await this.reportResult(command, result);

    return result;
  }

  async reportResult(command, result) {
    // Send via realtime if connected
    this.sendRealtimeMessage({
      type: 'command_result',
      command: command,
      result: result,
      timestamp: Date.now(),
    });

    // Also send via HTTP if configured
    if (this.config.apiUrl) {
      try {
        await fetch(this.config.apiUrl + '/result', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.config.authToken ? `Bearer ${this.config.authToken}` : '',
          },
          body: JSON.stringify({
            deviceId: this.config.deviceId,
            command: command,
            result: result,
            timestamp: Date.now(),
          }),
        });
      } catch (error) {
        console.error('[CommandHandler] Failed to report result:', error);
      }
    }
  }

  // Helper: Check if tab is accessible for scripting
  async checkTabAccessible(tabId) {
    try {
      const tab = tabId ? await chrome.tabs.get(tabId) : 
        (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
      
      if (!tab) {
        return { accessible: false, error: 'No active tab found' };
      }
      if (tab.url.startsWith('chrome://')) {
        return { accessible: false, error: 'Cannot access Chrome system pages (chrome://)' };
      }
      if (tab.url.startsWith('chrome-extension://')) {
        return { accessible: false, error: 'Cannot access extension pages' };
      }
      if (tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        return { accessible: false, error: 'Cannot access browser internal pages' };
      }
      return { accessible: true, tab };
    } catch (error) {
      return { accessible: false, error: error.message };
    }
  }

  // Command implementations

  async cmdOpenUrl(params) {
    const { url, newTab = true, active = true } = params;
    if (!url) return { success: false, error: 'URL required' };

    if (newTab) {
      const tab = await chrome.tabs.create({ url, active });
      return { success: true, data: { tabId: tab.id } };
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.update(tab.id, { url });
      return { success: true, data: { tabId: tab.id } };
    }
  }

  async cmdCloseUrl(params) {
    const { url, pattern } = params;
    if (!url && !pattern) return { success: false, error: 'URL or pattern required' };

    const queryPattern = pattern || `*://*${new URL(url).hostname}*/*`;
    const tabs = await chrome.tabs.query({ url: queryPattern });

    if (tabs.length === 0) {
      return { success: false, error: 'No matching tabs found' };
    }

    const tabIds = tabs.map(t => t.id);
    await chrome.tabs.remove(tabIds);
    return { success: true, data: { closedCount: tabIds.length } };
  }

  async cmdCloseTab(params) {
    const { tabId } = params;
    if (tabId) {
      await chrome.tabs.remove(tabId);
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.remove(tab.id);
    }
    return { success: true };
  }

  async cmdSwitchTab(params) {
    const { tabId, url } = params;

    if (tabId) {
      await chrome.tabs.update(tabId, { active: true });
      return { success: true };
    }

    if (url) {
      const tabs = await chrome.tabs.query({ url: `*://*${new URL(url).hostname}*/*` });
      if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, { active: true });
        await chrome.windows.update(tabs[0].windowId, { focused: true });
        return { success: true, data: { tabId: tabs[0].id } };
      }
      return { success: false, error: 'Tab not found' };
    }

    return { success: false, error: 'tabId or url required' };
  }

  async cmdScreenshot(params) {
    const { format = 'png', quality = 92, fullPage = false } = params;

    const check = await this.checkTabAccessible(params.tabId);
    if (!check.accessible) {
      return { success: false, error: check.error };
    }

    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: format === 'jpg' ? 'jpeg' : 'png',
        quality: quality,
      });

      // Send screenshot via realtime
      this.sendRealtimeMessage({
        type: 'screenshot',
        data: dataUrl,
        timestamp: Date.now(),
      });

      return { success: true, data: { screenshot: dataUrl } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async cmdGetHtml(params) {
    const { tabId, selector } = params;

    const check = await this.checkTabAccessible(tabId);
    if (!check.accessible) {
      return { success: false, error: check.error };
    }

    const targetTabId = check.tab.id;

    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (sel) => {
        if (sel) {
          const el = document.querySelector(sel);
          return el ? el.outerHTML : null;
        }
        return document.documentElement.outerHTML;
      },
      args: [selector],
    });

    const html = results[0]?.result;
    return { success: true, data: { html } };
  }

  async cmdGetConsole(params) {
    const { tabId, clear = false } = params;

    const check = await this.checkTabAccessible(tabId);
    if (!check.accessible) {
      return { success: false, error: check.error };
    }

    const targetTabId = check.tab.id;

    // Inject console capture script
    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (shouldClear) => {
        if (!window._consoleLogs) {
          window._consoleLogs = [];
          const originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
          };

          ['log', 'warn', 'error', 'info'].forEach(method => {
            console[method] = function(...args) {
              window._consoleLogs.push({
                type: method,
                message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
                timestamp: Date.now(),
              });
              if (window._consoleLogs.length > 500) {
                window._consoleLogs.shift();
              }
              originalConsole[method].apply(console, args);
            };
          });
        }

        const logs = [...window._consoleLogs];
        if (shouldClear) {
          window._consoleLogs = [];
        }
        return logs;
      },
      args: [clear],
    });

    return { success: true, data: { logs: results[0]?.result || [] } };
  }

  async cmdExecuteScript(params) {
    const { tabId, code, func } = params;

    const check = await this.checkTabAccessible(tabId);
    if (!check.accessible) {
      return { success: false, error: check.error };
    }

    const targetTabId = check.tab.id;

    if (code) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: new Function(code),
      });
      return { success: true, data: { result: results[0]?.result } };
    }

    return { success: false, error: 'code required' };
  }

  async cmdGetTabs(params) {
    const tabs = await chrome.tabs.query({});
    const tabInfo = tabs.map(t => ({
      id: t.id,
      url: t.url,
      title: t.title,
      active: t.active,
      windowId: t.windowId,
    }));
    return { success: true, data: { tabs: tabInfo } };
  }

  async cmdStartAudio(params) {
    // This will be handled by the existing audio recording system
    chrome.runtime.sendMessage({
      type: 'start-audio-stream',
      target: 'service-worker',
      params: params,
    });
    this.audioStreamActive = true;
    return { success: true };
  }

  async cmdStopAudio(params) {
    chrome.runtime.sendMessage({
      type: 'stop-audio-stream',
      target: 'service-worker',
    });
    this.audioStreamActive = false;
    return { success: true };
  }

  async cmdNavigate(params) {
    const { tabId, url } = params;
    if (!url) return { success: false, error: 'URL required' };

    const targetTabId = tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id;
    await chrome.tabs.update(targetTabId, { url });
    return { success: true };
  }

  async cmdReload(params) {
    const { tabId, bypassCache = false } = params;
    const targetTabId = tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id;
    await chrome.tabs.reload(targetTabId, { bypassCache });
    return { success: true };
  }

  async cmdClick(params) {
    const { tabId, selector, x, y } = params;

    const check = await this.checkTabAccessible(tabId);
    if (!check.accessible) {
      return { success: false, error: check.error };
    }

    const targetTabId = check.tab.id;

    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (sel, posX, posY) => {
        let element;
        if (sel) {
          element = document.querySelector(sel);
        } else if (posX !== undefined && posY !== undefined) {
          element = document.elementFromPoint(posX, posY);
        }

        if (element) {
          element.click();
          return { clicked: true, tagName: element.tagName };
        }
        return { clicked: false, error: 'Element not found' };
      },
      args: [selector, x, y],
    });

    return { success: results[0]?.result?.clicked, data: results[0]?.result };
  }

  async cmdInput(params) {
    const { tabId, selector, value, clear = true } = params;
    if (!selector || value === undefined) {
      return { success: false, error: 'selector and value required' };
    }

    const check = await this.checkTabAccessible(tabId);
    if (!check.accessible) {
      return { success: false, error: check.error };
    }

    const targetTabId = check.tab.id;

    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (sel, val, shouldClear) => {
        const element = document.querySelector(sel);
        if (element) {
          if (shouldClear) element.value = '';
          element.value = val;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        }
        return { success: false, error: 'Element not found' };
      },
      args: [selector, value, clear],
    });

    return results[0]?.result || { success: false };
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.CommandHandler = CommandHandler;
}

