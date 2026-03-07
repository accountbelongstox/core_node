// ==UserScript==
// @name         D3Check Battle.net 163 Login - Auto click and notify
// @namespace    d3check
// @version      1.4
// @description  Ping backend on all pages; only WORK_HOSTS URLs run login/EULA/close logic
// @match        https://oauth.g.mkey.163.com/*
// @match        https://account.battlenet.com.cn/*
// @match        https://*/*
// @match        http://*/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants (URLs, timing, storage). Page-match strings kept for DOM.
  // ---------------------------------------------------------------------------
  var WORK_HOSTS = ['oauth.g.mkey.163.com', 'account.battlenet.com.cn'];
  var OAUTH_DONE_URL = 'http://127.0.0.1:8765/api/login-try/oauth-done';
  var OAUTH_PING_URL = 'http://127.0.0.1:8765/api/login-try/oauth-ping';
  var OAUTH_STEP1_RECEIVED_URL = 'http://127.0.0.1:8765/api/login-try/oauth-step1-received';
  var CLOSE_TAB_AFTER_SEC = 5;
  var PING_INTERVAL_MS = 15000;
  var SERVER_WAIT_MS = 30000;
  var PING_POLL_MS = 1000;
  var LOG_STORE_KEY = 'd3check_tampermonkey_logs';
  var LOG_MAX = 100;
  var ACCOUNT_PAGE_CLOSE_AFTER_SEC = 10;
  var WAIT_POLL_MS = 500;
  var TIMER_LOG_INTERVAL = 6;

  // Page text to match (DOM / i18n)
  var EULA_LABEL_SUBSTR = '我接受暴雪战网最终用户许可协议';
  var AGREE_BTN_SUBSTR = '同意';
  var CANCEL_BTN_SUBSTR = '取消';
  var ACCOUNT_CLOSE_TEXT_1 = '现在可以返回战网游戏或应用程序';
  var ACCOUNT_CLOSE_TEXT_2 = '请求已超时，请重试';
  var LOGIN_BTN_TEXT_REGEX = /登\s*录/;
  var LOGIN_BTN_TEXT_EXACT = '登录';

  // UI copy (panel)
  var PANEL_TITLE = 'D3 TM';
  var STATUS_CHECKING = 'Checking...';
  var STATUS_CONNECTED = 'Connected';
  var STATUS_DISCONNECTED = 'Disconnected';
  var LOG_HEADER = 'Recent logs ';
  var ARROW_DOWN = '\u25BC';
  var ARROW_UP = '\u25B2';

  // ---------------------------------------------------------------------------
  // State (extracted to top; used by runAccountBattlenetPage / runOauth163Page / injectUI)
  // ---------------------------------------------------------------------------
  var lastPingOk = null;
  var accountPageInjected = false;
  var accountPageCloseScheduled = false;
  var accountPageTickCount = 0;
  var accountPageLastLogTick = 0;
  var accountPageLastDetect = false;
  var oauth163Injected = false;
  var bodyCollapsed = false;
  var logCollapsed = true;

  function isWorkPage() {
    var h = location.hostname || '';
    for (var i = 0; i < WORK_HOSTS.length; i++) {
      if (h.indexOf(WORK_HOSTS[i]) !== -1) return true;
    }
    return false;
  }

  function loadLogs() {
    try {
      var raw = localStorage.getItem(LOG_STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLogs(arr) {
    var trimmed = arr.slice(-LOG_MAX);
    try {
      localStorage.setItem(LOG_STORE_KEY, JSON.stringify(trimmed));
    } catch (e) {}
    return trimmed;
  }

  function addLog(type, msg) {
    var logs = loadLogs();
    logs.push({ t: Date.now(), type: type, msg: msg });
    saveLogs(logs);
    if (window._d3checkRefreshLogList) window._d3checkRefreshLogList();
  }

  function isAccountBattlenetPage() {
    return location.hostname === 'account.battlenet.com.cn';
  }

  function isOauth163Page() {
    return location.hostname.indexOf('oauth.g.mkey.163.com') !== -1;
  }

  function injectUI() {
    if (document.getElementById('d3check-tm-panel')) return;
    var container = document.createElement('div');
    container.id = 'd3check-tm-panel';
    container.style.cssText = 'position:fixed;right:12px;bottom:12px;width:260px;background:#1e1e1e;color:#d4d4d4;font-family:Consolas,monospace;font-size:12px;border:1px solid #444;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.4);z-index:2147483647;user-select:none;';

    var header = document.createElement('div');
    header.style.cssText = 'padding:8px 10px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #333;';
    var title = document.createElement('span');
    title.textContent = PANEL_TITLE;
    title.style.cssText = 'font-weight:bold;';
    var connDot = document.createElement('span');
    connDot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#666;display:inline-block;margin-left:6px;';
    var connText = document.createElement('span');
    connText.style.cssText = 'margin-left:4px;font-size:11px;color:#888;';
    connText.textContent = STATUS_CHECKING;
    header.appendChild(title);
    var connWrap = document.createElement('span');
    connWrap.style.cssText = 'display:flex;align-items:center;';
    connWrap.appendChild(connDot);
    connWrap.appendChild(connText);
    header.appendChild(connWrap);

    window._d3checkSetConnection = function (connected) {
      connDot.style.background = connected ? '#0a0' : '#c00';
      connText.textContent = connected ? STATUS_CONNECTED : STATUS_DISCONNECTED;
      connText.style.color = connected ? '#8f8' : '#f88';
    };

    var body = document.createElement('div');
    body.style.cssText = 'border-bottom:1px solid #333;';
    var logToggle = document.createElement('div');
    logToggle.style.cssText = 'padding:6px 10px;cursor:pointer;display:flex;justify-content:space-between;background:#252526;';
    logToggle.innerHTML = LOG_HEADER + '<span style="color:#666;">' + ARROW_DOWN + '</span>';
    var logListWrap = document.createElement('div');
    logListWrap.style.cssText = 'max-height:160px;overflow-y:auto;padding:6px;background:#1e1e1e;display:none;';
    logListWrap.id = 'd3check-tm-loglist';

    function renderLogList() {
      var logs = loadLogs();
      logListWrap.innerHTML = '';
      logs.slice().reverse().slice(0, 50).forEach(function (entry) {
        var line = document.createElement('div');
        line.style.cssText = 'font-size:11px;padding:2px 0;border-bottom:1px solid #2a2a2a;word-break:break-all;';
        var time = new Date(entry.t).toLocaleTimeString();
        var color = '#888';
        if (entry.type === 'click') color = '#4af';
        if (entry.type === 'notify_ok') color = '#8f8';
        if (entry.type === 'notify_fail') color = '#f88';
        if (entry.type === 'ping_ok') color = '#8f8';
        if (entry.type === 'ping_fail') color = '#f88';
        if (entry.type === 'step1_received') color = '#8f8';
        if (entry.type === 'timer') color = '#888';
        if (entry.type === 'close_check') color = '#fa0';
        if (entry.type === 'close_scheduled') color = '#8f8';
        if (entry.type === 'close_attempt') color = '#4af';
        if (entry.type === 'close_failed') color = '#f88';
        line.innerHTML = '<span style="color:#666;">' + time + '</span> <span style="color:' + color + '">[' + entry.type + ']</span> ' + (entry.msg || '');
        logListWrap.appendChild(line);
      });
    }

    window._d3checkRefreshLogList = renderLogList;

    logToggle.addEventListener('click', function () {
      logCollapsed = !logCollapsed;
      logListWrap.style.display = logCollapsed ? 'none' : 'block';
      logToggle.querySelector('span').textContent = logCollapsed ? ARROW_DOWN : ARROW_UP;
      if (!logCollapsed) renderLogList();
    });

    body.appendChild(logToggle);
    body.appendChild(logListWrap);

    var bodyWrap = document.createElement('div');
    bodyWrap.style.cssText = 'display:block;';
    bodyWrap.appendChild(body);

    header.addEventListener('click', function () {
      bodyCollapsed = !bodyCollapsed;
      bodyWrap.style.display = bodyCollapsed ? 'none' : 'block';
    });

    container.appendChild(header);
    container.appendChild(bodyWrap);
    document.body.appendChild(container);

    renderLogList();
  }

  function hasAccountPageCloseText() {
    var el = document.body || document.documentElement;
    if (!el) return false;
    var raw = (el.innerText || el.textContent || '') + '';
    var text = raw.replace(/\s+/g, ' ');
    return text.indexOf(ACCOUNT_CLOSE_TEXT_1) !== -1 || text.indexOf(ACCOUNT_CLOSE_TEXT_2) !== -1;
  }

  function handleBattlenetEulaIfPresent() {
    var nodes = document.querySelectorAll('label, span, div, p');
    var root = null;
    var i, el, raw, text;
    for (i = 0; i < nodes.length; i++) {
      el = nodes[i];
      raw = (el.innerText || el.textContent || '') + '';
      text = raw.replace(/\s+/g, '');
      if (text.indexOf(EULA_LABEL_SUBSTR) !== -1) {
        root = el.closest('form') || el.closest('div') || document;
        break;
      }
    }
    if (!root) return false;

    var checkbox = root.querySelector('input[type="checkbox"]');
    if (checkbox && !checkbox.checked && !checkbox.disabled) {
      checkbox.click();
      addLog('click', 'EULA checkbox checked');
    }

    var buttons = root.querySelectorAll('button, input[type="submit"], a');
    var agreeBtn = null;
    var j, btn, txt;
    for (j = 0; j < buttons.length; j++) {
      btn = buttons[j];
      txt = ((btn.innerText || btn.textContent || btn.value) || '').trim();
      if (!txt) continue;
      if (txt.indexOf(AGREE_BTN_SUBSTR) !== -1 && txt.indexOf(CANCEL_BTN_SUBSTR) === -1) {
        agreeBtn = btn;
        break;
      }
    }
    if (agreeBtn && !agreeBtn.disabled) {
      simulateHumanClick(agreeBtn);
      addLog('click', 'EULA agree button clicked');
      return true;
    }
    return false;
  }

  function runAccountBattlenetPage() {
    var t = setInterval(function () {
      accountPageTickCount++;
      if (!document.body) {
        if (accountPageTickCount - accountPageLastLogTick >= TIMER_LOG_INTERVAL) {
          addLog('timer', 'URL2 tick=' + accountPageTickCount + ' body=no');
          accountPageLastLogTick = accountPageTickCount;
        }
        return;
      }
      if (accountPageTickCount - accountPageLastLogTick >= TIMER_LOG_INTERVAL) {
        addLog('timer', 'URL2 tick=' + accountPageTickCount + ' body=yes');
        accountPageLastLogTick = accountPageTickCount;
      }
      if (!accountPageInjected) {
        accountPageInjected = true;
        injectUI();
        addLog('timer', 'URL2 UI injected, polling close text');
        fetch(OAUTH_STEP1_RECEIVED_URL, { method: 'GET', mode: 'cors' })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data && data.received === true) addLog('step1_received', 'URL1 submitted; URL2 logged');
          })
          .catch(function () {});
        fetch(OAUTH_PING_URL, { method: 'GET', mode: 'cors' })
          .then(function (r) { if (window._d3checkSetConnection) window._d3checkSetConnection(r.ok); })
          .catch(function () { if (window._d3checkSetConnection) window._d3checkSetConnection(false); });
      }
      if (handleBattlenetEulaIfPresent()) return;

      var detected = hasAccountPageCloseText();
      if (detected !== accountPageLastDetect) {
        accountPageLastDetect = detected;
        addLog('close_check', detected ? 'Close text found' : 'Close text not found');
      }
      if (accountPageCloseScheduled) return;
      if (!detected) return;
      accountPageCloseScheduled = true;
      clearInterval(t);
      addLog('close_scheduled', 'Close text found, closing tab in ' + ACCOUNT_PAGE_CLOSE_AFTER_SEC + 's');
      setTimeout(function () {
        addLog('close_attempt', 'window.close()');
        window.close();
        setTimeout(function () {
          addLog('close_failed', 'Close denied by browser');
        }, 1000);
      }, ACCOUNT_PAGE_CLOSE_AFTER_SEC * 1000);
    }, WAIT_POLL_MS);
  }

  function simulateHumanClick(element) {
    if (!element || !element.getBoundingClientRect) return;
    var box = element.getBoundingClientRect();
    var coordX = box.left + (box.right - box.left) / 2;
    var coordY = box.top + (box.bottom - box.top) / 2;
    function dispatchMouseEvent(el, eventName) {
      var ev = new MouseEvent(eventName, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: coordX,
        clientY: coordY,
        button: 0
      });
      el.dispatchEvent(ev);
    }
    dispatchMouseEvent(element, 'mousedown');
    dispatchMouseEvent(element, 'mouseup');
    dispatchMouseEvent(element, 'click');
  }

  function findLoginButton() {
    var buttons = document.querySelectorAll('button.ant-btn-primary, button.ant-btn.ant-btn-primary');
    var i, btn, text, span;
    for (i = 0; i < buttons.length; i++) {
      btn = buttons[i];
      text = (btn.innerText || btn.textContent || '').trim();
      if (LOGIN_BTN_TEXT_REGEX.test(text) || text === LOGIN_BTN_TEXT_EXACT) return btn;
      span = btn.querySelector('span');
      if (span && (LOGIN_BTN_TEXT_REGEX.test(span.innerText || span.textContent || '') || (span.innerText || span.textContent || '').trim() === LOGIN_BTN_TEXT_EXACT)) return btn;
    }
    return null;
  }

  function checkPing() {
    return fetch(OAUTH_PING_URL, { method: 'GET', mode: 'cors' }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  function notifyOauthDone() {
    return Promise.all([
      fetch(OAUTH_DONE_URL, { method: 'POST', mode: 'cors' }).then(function (r) { return { method: 'POST', status: r.status, ok: r.ok }; }).catch(function (e) { return { method: 'POST', error: (e && e.message) || 'fail' }; }),
      fetch(OAUTH_DONE_URL, { method: 'GET', mode: 'cors' }).then(function (r) { return { method: 'GET', status: r.status, ok: r.ok }; }).catch(function (e) { return { method: 'GET', error: (e && e.message) || 'fail' }; })
    ]);
  }

  function performClickAndNotify(btn) {
    simulateHumanClick(btn);
    addLog('click', 'Login button clicked');
    setTimeout(function () {
      notifyOauthDone().then(function (results) {
        results.forEach(function (r) {
          if (r.error) addLog('notify_fail', r.method + ' ' + r.error);
          else addLog('notify_ok', r.method + ' ' + r.status);
        });
      });
      setTimeout(function () { window.close(); }, 200);
    }, CLOSE_TAB_AFTER_SEC * 1000);
  }

  function pingHealth() {
    fetch(OAUTH_PING_URL, { method: 'GET', mode: 'cors' })
      .then(function (r) {
        var ok = r.ok;
        window._d3checkConnected = ok;
        if (window._d3checkSetConnection) window._d3checkSetConnection(true);
        if (lastPingOk !== true) { lastPingOk = true; addLog('ping_ok', 'Backend connected'); }
      })
      .catch(function () {
        window._d3checkConnected = false;
        if (window._d3checkSetConnection) window._d3checkSetConnection(false);
        if (lastPingOk !== false) { lastPingOk = false; addLog('ping_fail', 'Backend disconnected'); }
      });
  }

  function runOauth163Page() {
    var t = setInterval(function () {
      if (!document.body) return;
      if (!oauth163Injected) {
        oauth163Injected = true;
        injectUI();
        pingHealth();
        setInterval(pingHealth, PING_INTERVAL_MS);
      }
      if (handleBattlenetEulaIfPresent()) return;
      var btn = findLoginButton();
      if (!btn) return;
      clearInterval(t);
      addLog('click', 'Login button found, waiting backend (max 30s)');
      var deadline = Date.now() + SERVER_WAIT_MS;
      function tryClick() {
        checkPing().then(function (connected) {
          if (window._d3checkSetConnection) window._d3checkSetConnection(connected);
          if (connected) {
            addLog('notify_ok', 'Backend connected, clicking login');
            performClickAndNotify(btn);
            return;
          }
          if (Date.now() >= deadline) {
            addLog('notify_fail', '30s timeout, clicking login anyway');
            performClickAndNotify(btn);
            return;
          }
          setTimeout(tryClick, PING_POLL_MS);
        });
      }
      tryClick();
    }, WAIT_POLL_MS);
  }

  setInterval(function () {
    fetch(OAUTH_PING_URL, { method: 'GET', mode: 'cors' })
      .then(function (r) { if (window._d3checkSetConnection) window._d3checkSetConnection(r.ok); })
      .catch(function () { if (window._d3checkSetConnection) window._d3checkSetConnection(false); });
  }, PING_INTERVAL_MS);

  if (!isWorkPage()) return;
  if (isAccountBattlenetPage()) {
    runAccountBattlenetPage();
  } else if (isOauth163Page()) {
    runOauth163Page();
  }
})();
