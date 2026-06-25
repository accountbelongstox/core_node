/**
 * Gemini Web Helper Content Script
 *
 * Drives gemini.google.com/app inside the page so the worker can send a prompt,
 * read the model response, and optionally capture the "Listen" TTS audio bytes.
 * Gemini is Angular web components with deep shadow DOM, so all lookups pierce
 * open shadow roots (deepQueryAll), mirroring gemini-image-helper.js.
 *
 * Actions:
 *   - chrome_gemini_ping             -> {status:'pong'}
 *   - geminiSubmitPrompt {prompt}    -> fill + send; {found, before, error}
 *   - geminiCollectReply {timeoutMs, before} -> {ready, answer, error}
 *   - geminiCollectAudio {timeoutMs} -> {ok, mime, bytes:number[], error}
 */

(() => {
  if (window.__geminiWebHelperLoaded) {
    return;
  }
  window.__geminiWebHelperLoaded = true;
  console.log('[Gemini Web Helper] Content script loaded');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Shared human-sim library (co-injected first) when present + responsive.
  function getWebOps() {
    const W = self.__WebOps;
    return W && typeof W._ping === 'function' && W._ping() === 'pong' ? W : null;
  }

  function deepQueryAll(selectors, root) {
    const sels = Array.isArray(selectors) ? selectors : [selectors];
    const out = [];
    const seen = new Set();
    const visit = (node) => {
      if (!node || !node.querySelectorAll) return;
      for (const sel of sels) {
        let matches = [];
        try {
          matches = node.querySelectorAll(sel);
        } catch (_) {
          matches = [];
        }
        matches.forEach((el) => {
          if (!seen.has(el)) {
            seen.add(el);
            out.push(el);
          }
        });
      }
      let hosts = [];
      try {
        hosts = node.querySelectorAll('*');
      } catch (_) {
        hosts = [];
      }
      hosts.forEach((el) => {
        if (el.shadowRoot) visit(el.shadowRoot);
      });
    };
    visit(root || document);
    return out;
  }
  const deepQueryOne = (selectors, root) => deepQueryAll(selectors, root)[0] || null;
  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  function findPromptInput() {
    return deepQueryOne([
      'rich-textarea .ql-editor[contenteditable="true"]',
      'div.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[aria-label]',
      'textarea',
    ]);
  }

  function findSendButton() {
    const direct = deepQueryAll([
      'button.send-button',
      'button[aria-label*="Send" i]',
      'button[mattooltip*="Send" i]',
      'button[aria-label*="发送" i]',
      'gem-icon-button[aria-label*="Send" i] button',
    ]).find((el) => el && !el.disabled && isVisible(el));
    if (direct) return direct;
    const icons = deepQueryAll(['button mat-icon', 'gem-icon-button mat-icon']);
    for (const ic of icons) {
      const txt = (ic.getAttribute('fonticon') || ic.textContent || '').toLowerCase();
      if (txt.includes('send')) {
        const btn = ic.closest('button');
        if (btn && !btn.disabled && isVisible(btn)) return btn;
      }
    }
    return null;
  }

  function setEditorText(el, text) {
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
  }

  function pressEnter(el) {
    const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  function responseBlocks() {
    return deepQueryAll(['message-content', '.model-response-text', 'model-response']);
  }

  async function submitPrompt(prompt) {
    const input = findPromptInput();
    if (!input) {
      return { found: false, error: 'Gemini prompt input not found (login or DOM change?)' };
    }
    const before = responseBlocks().length;
    setEditorText(input, prompt);
    await sleep(300);
    const btn = findSendButton();
    if (btn) {
      btn.click();
    } else {
      pressEnter(input);
    }
    return { found: true, before };
  }

  async function collectReply(timeoutMs, before) {
    const start = Date.now();
    let last = '';
    let stable = 0;
    while (Date.now() - start < timeoutMs) {
      await sleep(900);
      const blocks = responseBlocks();
      if (blocks.length <= before) continue;
      const el = blocks[blocks.length - 1];
      const txt = (el.innerText || '').trim();
      if (txt && txt === last) {
        stable += 1;
        if (stable >= 3) {
          return { ready: true, answer: txt };
        }
      } else {
        stable = 0;
        last = txt;
      }
    }
    return { ready: false, answer: last, error: 'Timed out waiting for Gemini reply' };
  }

  async function collectAudio(timeoutMs) {
    let listenBtn = deepQueryAll([
      'button[aria-label*="Listen" i]',
      'button[aria-label*="朗读" i]',
      'button[aria-label*="播放" i]',
    ]).find((el) => el && isVisible(el));
    if (!listenBtn) {
      const icons = deepQueryAll(['mat-icon[fonticon="volume_up"]', 'mat-icon[fonticon="play_arrow"]']);
      for (const ic of icons) {
        const btn = ic.closest('button');
        if (btn && isVisible(btn)) {
          listenBtn = btn;
          break;
        }
      }
    }
    if (!listenBtn) {
      return { ok: false, error: 'Listen button not found' };
    }
    const W = getWebOps();
    // Human-like click on Listen via the shared lib (fallback: native click).
    if (W) await W.humanClick(listenBtn);
    else listenBtn.click();

    const findSrc = () => {
      const audios = deepQueryAll('audio');
      const a = audios.find((x) => typeof x.src === 'string' && x.src.length > 0);
      return a ? a.src : null;
    };

    let src = '';
    if (W) {
      src = (await W.waitFor(findSrc, { timeout: timeoutMs, interval: 500 })) || '';
    } else {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        await sleep(500);
        const s = findSrc();
        if (s) {
          src = s;
          break;
        }
      }
    }
    if (!src) {
      return { ok: false, error: 'No audio source appeared' };
    }
    // Capture the audio bytes in-page via the shared fetch pipeline (fallback: fetch).
    if (W) {
      const r = await W.fetchBytes(src);
      if (r.ok) return { ok: true, mime: r.mime || 'audio/mpeg', bytes: r.bytes };
      return { ok: false, error: r.error || 'audio fetch failed' };
    }
    try {
      const resp = await fetch(src, { cache: 'no-store' });
      const buf = await resp.arrayBuffer();
      const mime = resp.headers.get('content-type') || 'audio/mpeg';
      return { ok: true, mime, bytes: Array.from(new Uint8Array(buf)) };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'chrome_gemini_ping') {
      sendResponse({ status: 'pong' });
      return true;
    }
    if (message.action === 'geminiSubmitPrompt') {
      submitPrompt(String(message.prompt || ''))
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ found: false, error: String(e && e.message) }));
      return true;
    }
    if (message.action === 'geminiCollectReply') {
      collectReply(Number(message.timeoutMs) || 120000, Number(message.before) || 0)
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ ready: false, error: String(e && e.message) }));
      return true;
    }
    if (message.action === 'geminiCollectAudio') {
      collectAudio(Number(message.timeoutMs) || 60000)
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;
    }
  });

  console.log('[Gemini Web Helper] Message listener registered');
})();
