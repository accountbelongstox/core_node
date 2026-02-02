// ==UserScript==
// @name         D3Check 战网网易登录页 - 自动点登录并通知
// @namespace    d3check
// @version      1.2
// @description  URL1=网易页：点击+wait 后通知 D3；URL2=account 页：无其它功能，仅查询「上一页是否已提交成功」并记录日志（点后会跳转到此页）
// @match        https://oauth.g.mkey.163.com/*
// @match        https://account.battlenet.com.cn/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------- 两个 URL 分工（务必分清）----------
  // URL1 oauth.g.mkey.163.com：wait 按钮出现 → wait 服务器连接成功（超时 30s，与检测服务器一致）→ 连接则点击 / 超时则直接点击 → 再 wait 5s → 通知 oauth-done → 关标签。
  // URL2 account.battlenet.com.cn：无任何其它功能。仅进入该页后向后端查询「URL1 是否已点击并提交成功」，有则本页记录成功日志。不找按钮、不点击。

  const OAUTH_DONE_URL = 'http://127.0.0.1:8765/api/login-try/oauth-done';
  const OAUTH_PING_URL = 'http://127.0.0.1:8765/api/login-try/oauth-ping';
  const OAUTH_STEP1_RECEIVED_URL = 'http://127.0.0.1:8765/api/login-try/oauth-step1-received';
  const CLOSE_TAB_AFTER_SEC = 5;
  const POLL_MS = 500;
  const PING_INTERVAL_MS = 15000;
  const SERVER_WAIT_MS = 30000;   // URL1：发现按钮后等待服务器连接成功的超时（30s），超时则直接点击
  const PING_POLL_MS = 1000;      // URL1：等待服务器时每秒 ping 一次
  const LOG_STORE_KEY = 'd3check_tampermonkey_logs';
  const LOG_MAX = 100;
  const ACCOUNT_PAGE_CLOSE_AFTER_SEC = 10;  // URL2：发现「现在可以返回…」或「请求已超时…」后 10s 关 tab
  const WAIT_POLL_MS = 500;                // 两个 URL 共用：单一定时器轮询间隔，一直 wait 到各元素出现

  function loadLogs() {
    try {
      const raw = localStorage.getItem(LOG_STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLogs(arr) {
    const trimmed = arr.slice(-LOG_MAX);
    try {
      localStorage.setItem(LOG_STORE_KEY, JSON.stringify(trimmed));
    } catch (e) {}
    return trimmed;
  }

  function addLog(type, msg) {
    const logs = loadLogs();
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
    const container = document.createElement('div');
    container.id = 'd3check-tm-panel';
    container.style.cssText = 'position:fixed;right:12px;bottom:12px;width:260px;background:#1e1e1e;color:#d4d4d4;font-family:Consolas,monospace;font-size:12px;border:1px solid #444;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.4);z-index:2147483647;user-select:none;';

    var bodyCollapsed = false;
    var logCollapsed = true;

    const header = document.createElement('div');
    header.style.cssText = 'padding:8px 10px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #333;';
    const title = document.createElement('span');
    title.textContent = 'D3 油猴';
    title.style.cssText = 'font-weight:bold;';
    const connDot = document.createElement('span');
    connDot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#666;display:inline-block;margin-left:6px;';
    const connText = document.createElement('span');
    connText.style.cssText = 'margin-left:4px;font-size:11px;color:#888;';
    connText.textContent = '检测中…';
    header.appendChild(title);
    const connWrap = document.createElement('span');
    connWrap.style.cssText = 'display:flex;align-items:center;';
    connWrap.appendChild(connDot);
    connWrap.appendChild(connText);
    header.appendChild(connWrap);

    window._d3checkSetConnection = function (connected) {
      connDot.style.background = connected ? '#0a0' : '#c00';
      connText.textContent = connected ? '已连接 D3' : '未连接';
      connText.style.color = connected ? '#8f8' : '#f88';
    };

    const body = document.createElement('div');
    body.style.cssText = 'border-bottom:1px solid #333;';

    const logToggle = document.createElement('div');
    logToggle.style.cssText = 'padding:6px 10px;cursor:pointer;display:flex;justify-content:space-between;background:#252526;';
    logToggle.innerHTML = '最近日志 <span style="color:#666;">▼</span>';
    const logListWrap = document.createElement('div');
    logListWrap.style.cssText = 'max-height:160px;overflow-y:auto;padding:6px;background:#1e1e1e;display:none;';
    logListWrap.id = 'd3check-tm-loglist';

    function renderLogList() {
      const logs = loadLogs();
      logListWrap.innerHTML = '';
      logs.slice().reverse().slice(0, 50).forEach(function (entry) {
        const line = document.createElement('div');
        line.style.cssText = 'font-size:11px;padding:2px 0;border-bottom:1px solid #2a2a2a;word-break:break-all;';
        const time = new Date(entry.t).toLocaleTimeString();
        var color = '#888';
        if (entry.type === 'click') color = '#4af';
        if (entry.type === 'notify_ok') color = '#8f8';
        if (entry.type === 'notify_fail') color = '#f88';
        if (entry.type === 'ping_ok') color = '#8f8';
        if (entry.type === 'ping_fail') color = '#f88';
        if (entry.type === 'step1_received') color = '#8f8';
        line.innerHTML = '<span style="color:#666;">' + time + '</span> <span style="color:' + color + '">[' + entry.type + ']</span> ' + (entry.msg || '');
        logListWrap.appendChild(line);
      });
    }

    window._d3checkRefreshLogList = renderLogList;

    logToggle.addEventListener('click', function () {
      logCollapsed = !logCollapsed;
      logListWrap.style.display = logCollapsed ? 'none' : 'block';
      logToggle.querySelector('span').textContent = logCollapsed ? '▼' : '▲';
      if (!logCollapsed) renderLogList();
    });

    body.appendChild(logToggle);
    body.appendChild(logListWrap);

    const bodyWrap = document.createElement('div');
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
    if (!document.body) return false;
    var text = (document.body.innerText || document.body.textContent || '') + '';
    return text.indexOf('现在可以返回战网游戏或应用程序') !== -1 || text.indexOf('请求已超时，请重试') !== -1;
  }

  // ----- URL2 account.battlenet.com.cn：单一定时器一直 wait（body → inject/查询 → 关 tab 文案），两个 URL 都要有定时器 -----
  function runAccountBattlenetPage() {
    var injected = false;
    var closeScheduled = false;
    var t = setInterval(function () {
      if (!document.body) return;
      if (!injected) {
        injected = true;
        injectUI();
        fetch(OAUTH_STEP1_RECEIVED_URL, { method: 'GET', mode: 'cors' })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data && data.received === true) addLog('step1_received', '上一页(URL1 网易页)已提交成功，本页(URL2)记录');
          })
          .catch(function () {});
        fetch(OAUTH_PING_URL, { method: 'GET', mode: 'cors' })
          .then(function (r) { if (window._d3checkSetConnection) window._d3checkSetConnection(r.ok); })
          .catch(function () { if (window._d3checkSetConnection) window._d3checkSetConnection(false); });
      }
      if (closeScheduled) return;
      if (!hasAccountPageCloseText()) return;
      closeScheduled = true;
      clearInterval(t);
      setTimeout(function () { window.close(); }, ACCOUNT_PAGE_CLOSE_AFTER_SEC * 1000);
    }, WAIT_POLL_MS);
  }

  // ----- 模拟人工点击：先取按钮位置，再按坐标派发 mousedown → mouseup → click，避免传统 .click() 被识别为脚本失败 -----
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
    const buttons = document.querySelectorAll('button.ant-btn-primary, button.ant-btn.ant-btn-primary');
    for (var i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const text = (btn.innerText || btn.textContent || '').trim();
      if (/登\s*录/.test(text) || text === '登录') return btn;
      const span = btn.querySelector('span');
      if (span && (/登\s*录/.test(span.innerText || span.textContent || '') || (span.innerText || span.textContent || '').trim() === '登录')) return btn;
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
    addLog('click', '已点击登录按钮');
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

  var _lastPingOk = null;
  function pingHealth() {
    fetch(OAUTH_PING_URL, { method: 'GET', mode: 'cors' })
      .then(function (r) {
        var ok = r.ok;
        window._d3checkConnected = ok;
        if (window._d3checkSetConnection) window._d3checkSetConnection(true);
        if (_lastPingOk !== true) { _lastPingOk = true; addLog('ping_ok', 'D3 服务器连接正常'); }
      })
      .catch(function () {
        window._d3checkConnected = false;
        if (window._d3checkSetConnection) window._d3checkSetConnection(false);
        if (_lastPingOk !== false) { _lastPingOk = false; addLog('ping_fail', 'D3 服务器未连接'); }
      });
  }

  // ----- URL1 oauth.g.mkey.163.com：单一定时器一直 wait（body → inject/ping → 登录按钮），两个 URL 都要有定时器 -----
  function runOauth163Page() {
    var injected = false;
    var t = setInterval(function () {
      if (!document.body) return;
      if (!injected) {
        injected = true;
        injectUI();
        pingHealth();
        setInterval(pingHealth, PING_INTERVAL_MS);
      }
      var btn = findLoginButton();
      if (!btn) return;
      clearInterval(t);
      addLog('click', '已发现登录按钮，等待 D3 服务器连接（最多 30s）');
      var deadline = Date.now() + SERVER_WAIT_MS;
      function tryClick() {
        checkPing().then(function (connected) {
          if (window._d3checkSetConnection) window._d3checkSetConnection(connected);
          if (connected) {
            addLog('notify_ok', '已连接 D3，点击登录按钮');
            performClickAndNotify(btn);
            return;
          }
          if (Date.now() >= deadline) {
            addLog('notify_fail', '30s 未连接，直接点击登录按钮');
            performClickAndNotify(btn);
            return;
          }
          setTimeout(tryClick, PING_POLL_MS);
        });
      }
      tryClick();
    }, WAIT_POLL_MS);
  }

  if (isAccountBattlenetPage()) {
    runAccountBattlenetPage();
  } else if (isOauth163Page()) {
    runOauth163Page();
  }
})();
