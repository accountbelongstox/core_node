/**
 * ChatGPT Web Helper Content Script
 *
 * Drives chatgpt.com inside the page (page origin / credentials) so the worker
 * can send a prompt, read the streamed reply, and optionally capture the
 * "Read aloud" TTS audio as raw bytes.
 *
 * Actions (driven by the background ChatGptWebTool):
 *   - chrome_chatgpt_ping            -> {status:'pong'} (base injector skips re-inject)
 *   - chatgptSubmitPrompt {prompt}   -> fill + send; {found, before, error}
 *   - chatgptCollectReply {timeoutMs, before} -> stabilized reply; {ready, answer, error}
 *   - chatgptPeekReply {before}      -> {hasBlock, text} (instant, no wait)
 *   - chatgptCollectAudio {timeoutMs}-> read-aloud bytes; {ok, mime, bytes:number[], error}
 *
 * Selectors are redundant (data-testid / aria-label / role / contenteditable),
 * never obfuscated generated classes.
 */

(() => {
  if (window.__chatgptWebHelperLoaded) {
    return;
  }
  window.__chatgptWebHelperLoaded = true;
  console.log('[ChatGPT Web Helper] Content script loaded');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (sel) => document.querySelector(sel);

  // Shared human-sim library (co-injected first) when present + responsive.
  function getWebOps() {
    const W = self.__WebOps;
    return W && typeof W._ping === 'function' && W._ping() === 'pong' ? W : null;
  }

  function findPromptInput() {
    return (
      q('#prompt-textarea[contenteditable="true"]') ||
      q('div#prompt-textarea') ||
      q('textarea#prompt-textarea') ||
      q('textarea[data-id]') ||
      q('main textarea') ||
      q('textarea')
    );
  }

  function findSendButton() {
    return (
      q('button[data-testid="send-button"]') ||
      q('button[aria-label*="Send" i]') ||
      q('button[data-testid="fruitjuice-send-button"]')
    );
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
    // ProseMirror contenteditable.
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, text);
    } catch (_) {
      inserted = false;
    }
    if (!inserted || !(el.innerText || '').trim()) {
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    }
  }

  function pressEnter(el) {
    const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  function assistantTurns() {
    return document.querySelectorAll('[data-message-author-role="assistant"]');
  }

  async function submitPrompt(prompt) {
    const input = findPromptInput();
    if (!input) {
      return { found: false, error: 'ChatGPT prompt input not found (login or DOM change?)' };
    }
    const before = assistantTurns().length;
    setEditorText(input, prompt);
    await sleep(250);
    const btn = findSendButton();
    if (btn && !btn.disabled) {
      btn.click();
    } else {
      pressEnter(input);
    }
    return { found: true, before };
  }

  /** Instant, non-blocking read — used by the job-based status poll (cross-poll stability). */
  function peekReply(before) {
    const blocks = assistantTurns();
    if (blocks.length <= before) {
      return { hasBlock: false, text: '' };
    }
    const el = blocks[blocks.length - 1];
    return { hasBlock: true, text: (el.innerText || '').trim() };
  }

  async function collectReply(timeoutMs, before) {
    const start = Date.now();
    let last = '';
    let stable = 0;
    while (Date.now() - start < timeoutMs) {
      await sleep(800);
      const blocks = assistantTurns();
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
    return { ready: false, answer: last, error: 'Timed out waiting for ChatGPT reply' };
  }

  async function collectAudio(timeoutMs) {
    const btns = document.querySelectorAll(
      'button[data-testid="voice-play-turn-action-button"], button[aria-label*="Read aloud" i], button[aria-label*="朗读" i]',
    );
    if (btns.length === 0) {
      return { ok: false, error: 'Read-aloud button not found' };
    }
    const W = getWebOps();
    const btn = btns[btns.length - 1];
    // Human-like click on Read-aloud via the shared lib (fallback: native click).
    if (W) await W.humanClick(btn);
    else btn.click();

    const findSrc = () => {
      const audios = Array.from(document.querySelectorAll('audio'));
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
      return { ok: false, error: 'No audio source appeared (TTS may stream via MSE)' };
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
    if (message.action === 'chrome_chatgpt_ping') {
      sendResponse({ status: 'pong' });
      return true;
    }
    if (message.action === 'chatgptSubmitPrompt') {
      submitPrompt(String(message.prompt || ''))
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ found: false, error: String(e && e.message) }));
      return true;
    }
    if (message.action === 'chatgptCollectReply') {
      collectReply(Number(message.timeoutMs) || 120000, Number(message.before) || 0)
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ ready: false, error: String(e && e.message) }));
      return true;
    }
    if (message.action === 'chatgptPeekReply') {
      try {
        sendResponse(peekReply(Number(message.before) || 0));
      } catch (e) {
        sendResponse({ hasBlock: false, text: '', error: String(e && e.message) });
      }
      return true;
    }
    if (message.action === 'chatgptCollectAudio') {
      collectAudio(Number(message.timeoutMs) || 60000)
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;
    }
  });

  console.log('[ChatGPT Web Helper] Message listener registered');
})();
