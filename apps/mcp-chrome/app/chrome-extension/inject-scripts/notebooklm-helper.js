/**
 * NotebookLM Helper Content Script
 *
 * Automates the chat box on https://notebooklm.google.com. NotebookLM is an
 * obfuscated Angular Material app, so we locate elements by stable, semantic
 * heuristics (role / aria-label / placeholder / element type) with several
 * fallbacks rather than brittle generated class names. Two actions:
 *   - notebooklmAsk:     type a question, submit, wait for a fresh answer, return it
 *   - notebooklmExtract: return the latest answer text without asking
 */

(() => {
  console.log('[NotebookLM Helper] Content script loaded');

  const TICK_MS = 500;

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  /** Find the question input (textarea or contenteditable). */
  function findInput() {
    const candidates = [
      'textarea[aria-label*="query" i]',
      'textarea[placeholder*="ask" i]',
      'textarea[placeholder*="type" i]',
      'div[contenteditable="true"][aria-label*="query" i]',
      'div[contenteditable="true"]',
      'textarea',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  }

  /** Find the send/submit button near the input. */
  function findSendButton() {
    const candidates = [
      'button[aria-label*="send" i]',
      'button[aria-label*="submit" i]',
      'button[type="submit"]',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && !el.disabled && el.offsetParent !== null) return el;
    }
    // Fallback: a button containing a "send" material icon.
    const icons = document.querySelectorAll('button .material-icons, button [class*="icon"]');
    for (const icon of icons) {
      if (/send/i.test(icon.textContent || '')) {
        const btn = icon.closest('button');
        if (btn && !btn.disabled) return btn;
      }
    }
    return null;
  }

  /** Set value on a textarea or contenteditable and fire the right events. */
  function setInputValue(el, text) {
    if (el.isContentEditable) {
      el.focus();
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
      return;
    }
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    el.focus();
    if (setter) {
      setter.call(el, text);
    } else {
      el.value = text;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Collect candidate answer/message blocks, newest last. */
  function collectMessages() {
    const sels = [
      '[class*="response" i]',
      '[class*="message" i]',
      '[class*="answer" i]',
      'chat-message',
      '[role="article"]',
    ];
    const seen = new Set();
    const blocks = [];
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach((el) => {
        const text = norm(el.innerText || el.textContent);
        if (text && text.length > 1 && !seen.has(text)) {
          seen.add(text);
          blocks.push(text);
        }
      });
      if (blocks.length) break; // first selector that matches wins
    }
    return blocks;
  }

  function latestAnswer() {
    const blocks = collectMessages();
    return blocks.length ? blocks[blocks.length - 1] : '';
  }

  function pressEnter(el) {
    const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keypress', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  async function ask(question, timeoutMs) {
    const result = { success: false, question, answer: '', error: null };
    const input = findInput();
    if (!input) {
      result.error = 'Could not find the NotebookLM question input on this page';
      return result;
    }

    const before = collectMessages().length;

    setInputValue(input, question);
    await new Promise((r) => setTimeout(r, 200));

    const btn = findSendButton();
    if (btn) {
      btn.click();
    } else {
      pressEnter(input);
    }

    // Poll for a new answer block, stable across two consecutive ticks.
    const deadline = Date.now() + (timeoutMs || 60000);
    let lastText = '';
    let stableCount = 0;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, TICK_MS));
      const blocks = collectMessages();
      const text = blocks.length ? blocks[blocks.length - 1] : '';
      if (blocks.length > before && text) {
        if (text === lastText) {
          stableCount++;
          if (stableCount >= 3) {
            result.success = true;
            result.answer = text;
            return result;
          }
        } else {
          stableCount = 0;
          lastText = text;
        }
      }
    }

    // Timed out — return whatever is latest as a best-effort answer.
    result.answer = lastText || latestAnswer();
    result.success = !!result.answer;
    if (!result.success) result.error = 'No answer detected before timeout';
    return result;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'notebooklmAsk') {
      ask(message.question || '', message.timeoutMs)
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ success: false, error: String(e && e.message) }));
      return true; // async
    }
    if (message.action === 'notebooklmExtract') {
      try {
        const answer = latestAnswer();
        sendResponse({ success: !!answer, answer, error: answer ? null : 'No answer found' });
      } catch (e) {
        sendResponse({ success: false, error: String(e && e.message) });
      }
      return true;
    }
  });

  console.log('[NotebookLM Helper] Message listener registered');
})();
