/**
 * Grok Web Helper Content Script
 *
 * Drives grok.com inside the page so the worker can send a prompt and read the
 * reply. Selectors verified live via MCP browser inspection (2026-07):
 *   - input:  div[contenteditable="true"][role="textbox"][aria-label="Ask Grok anything"]
 *   - user msg:      [data-testid="user-message"]
 *   - assistant msg: [data-testid="assistant-message"]
 * No dedicated Send button appears while the input is empty; Enter is the
 * reliable submit path (with a best-effort button search first).
 *
 * Actions:
 *   - chrome_grok_ping         -> {status:'pong'}
 *   - grokSubmitPrompt {prompt}-> fill + send; {found, before, error}
 *   - grokPeekReply {before}   -> {hasBlock, text} (instant, no wait)
 */

(() => {
  if (window.__grokWebHelperLoaded) {
    return;
  }
  window.__grokWebHelperLoaded = true;
  console.log('[Grok Web Helper] Content script loaded');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (sel) => document.querySelector(sel);

  function findPromptInput() {
    return (
      q('div[data-testid="chat-input"] [contenteditable="true"][role="textbox"]') ||
      q('div[contenteditable="true"][role="textbox"][aria-label*="Grok" i]') ||
      q('div[contenteditable="true"][role="textbox"]')
    );
  }

  function findSendButton(input) {
    const form = input && input.closest('form');
    const scope = form || document;
    return (
      scope.querySelector('button[aria-label*="Submit" i]') ||
      scope.querySelector('button[type="submit"]') ||
      scope.querySelector('button[aria-label*="Send" i]')
    );
  }

  function setEditorText(el, text) {
    el.focus();
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
    return document.querySelectorAll('[data-testid="assistant-message"]');
  }

  async function submitPrompt(prompt) {
    const input = findPromptInput();
    if (!input) {
      return { found: false, error: 'Grok prompt input not found (login or DOM change?)' };
    }
    const before = assistantTurns().length;
    setEditorText(input, prompt);
    await sleep(300);
    const btn = findSendButton(input);
    if (btn && !btn.disabled) {
      btn.click();
    } else {
      pressEnter(input);
    }
    return { found: true, before };
  }

  function peekReply(before) {
    const blocks = assistantTurns();
    if (blocks.length <= before) {
      return { hasBlock: false, text: '' };
    }
    const el = blocks[blocks.length - 1];
    return { hasBlock: true, text: (el.innerText || '').trim() };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'chrome_grok_ping') {
      sendResponse({ status: 'pong' });
      return true;
    }
    if (message.action === 'grokSubmitPrompt') {
      submitPrompt(String(message.prompt || ''))
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ found: false, error: String(e && e.message) }));
      return true;
    }
    if (message.action === 'grokPeekReply') {
      try {
        sendResponse(peekReply(Number(message.before) || 0));
      } catch (e) {
        sendResponse({ hasBlock: false, text: '', error: String(e && e.message) });
      }
      return true;
    }
  });

  console.log('[Grok Web Helper] Message listener registered');
})();
