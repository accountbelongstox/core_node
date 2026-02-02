// ==UserScript==
// @name         D3Check 战网网易登录页 - 自动点登录并通知
// @namespace    d3check
// @version      1.0
// @description  监听 oauth.g.mkey.163.com，找到「登 录」按钮后点击，5秒后关闭标签并通知 D3Check（POST /api/login-try/oauth-done）
// @match        https://oauth.g.mkey.163.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const OAUTH_DONE_URL = 'http://127.0.0.1:8765/api/login-try/oauth-done';
  const OAUTH_PING_URL = 'http://127.0.0.1:8765/api/login-try/oauth-ping';
  const CLOSE_TAB_AFTER_SEC = 5;
  const POLL_MS = 500;
  const PING_INTERVAL_MS = 15000;

  function findLoginButton() {
    const buttons = document.querySelectorAll('button.ant-btn-primary, button.ant-btn.ant-btn-primary');
    for (const btn of buttons) {
      const text = (btn.innerText || btn.textContent || '').trim();
      if (/登\s*录/.test(text) || text === '登录') return btn;
      const span = btn.querySelector('span');
      if (span && (/登\s*录/.test(span.innerText || span.textContent || '') || (span.innerText || span.textContent || '').trim() === '登录')) return btn;
    }
    return null;
  }

  function notifyOauthDone() {
    fetch(OAUTH_DONE_URL, { method: 'POST', mode: 'cors' }).catch(() => {});
    fetch(OAUTH_DONE_URL, { method: 'GET', mode: 'cors' }).catch(() => {});
  }

  function run() {
    const btn = findLoginButton();
    if (!btn) return;
    btn.click();
    setTimeout(function () {
      notifyOauthDone();
      setTimeout(function () { window.close(); }, 200);
    }, CLOSE_TAB_AFTER_SEC * 1000);
  }

  function pingHealth() {
    fetch(OAUTH_PING_URL, { method: 'GET', mode: 'cors' }).catch(function () {});
  }
  pingHealth();
  setInterval(pingHealth, PING_INTERVAL_MS);

  let done = false;
  const t = setInterval(function () {
    if (done) return;
    if (findLoginButton()) {
      done = true;
      clearInterval(t);
      run();
    }
  }, POLL_MS);
  setTimeout(function () { clearInterval(t); }, 300000);
})();
