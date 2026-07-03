/**
 * Microsoft Copilot Web Helper Content Script
 *
 * Drives copilot.microsoft.com inside the page. Selectors verified live via
 * MCP browser inspection (2026-07):
 *   - input:          #userInput (textarea)
 *   - assistant msg:  [data-testid="ai-message"]
 *   - canvas trigger:  a <button> inside the assistant message whose text
 *     contains "Open page" — Copilot sometimes renders a long structured
 *     reply as a separate "page" (canvas) instead of inline chat text.
 *   - canvas content:  div[aria-label="Page content"][contenteditable="true"]
 *     (present only after the trigger button is clicked; the page title is
 *     h1[aria-label^="Page title:"]).
 *
 * peekReply first requires a new turn for THIS job (assistantTurns().length >
 * before) — the provider tab is reused across jobs, so a canvas left open by
 * an earlier job must never be read as the current job's answer. Only once a
 * new turn exists does it check the canvas container (once opened, the
 * original inline chat DOM is gone), then fall back to the inline message; if
 * a canvas trigger is found, it human-clicks it and reports not-yet-ready for
 * this round so the NEXT poll picks up the now-mounted page content.
 *
 * copilotClosePage is fired (fire-and-forget) by the background once a job is
 * confirmed done, best-effort closing the canvas page so a later job reusing
 * this tab never has to reason about a page left open by this one. Its close
 * selector is an educated guess (not live-verified) and no-ops rather than
 * risk navigating away when no close control is found.
 *
 * Actions:
 *   - chrome_copilot_ping         -> {status:'pong'}
 *   - copilotSubmitPrompt {prompt}-> fill + send; {found, before, error}
 *   - copilotPeekReply {before}   -> {hasBlock, text} (instant, no wait)
 *   - copilotClosePage            -> {ok, error?} (best-effort, no-op safe)
 */

(() => {
  if (window.__copilotWebHelperLoaded) {
    return;
  }
  window.__copilotWebHelperLoaded = true;
  console.log('[Copilot Web Helper] Content script loaded');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (sel) => document.querySelector(sel);
  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // Shared human-sim library (co-injected first) when present + responsive.
  function getWebOps() {
    const W = self.__WebOps;
    return W && typeof W._ping === 'function' && W._ping() === 'pong' ? W : null;
  }

  function findPromptInput() {
    return q('#userInput') || q('textarea[aria-label*="Copilot" i]') || q('textarea');
  }

  function findSendButton(input) {
    const form = input && input.closest('form');
    const scope = form || document;
    return (
      scope.querySelector('button[aria-label*="Send" i]') ||
      scope.querySelector('button[data-testid*="submit" i]') ||
      scope.querySelector('button[type="submit"]')
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
    return document.querySelectorAll('[data-testid="ai-message"]');
  }

  function findCanvasPage() {
    return q('div[aria-label="Page content"][contenteditable="true"]');
  }

  function findOpenPageButton(scopeEl) {
    const scope = scopeEl || document;
    const buttons = Array.from(scope.querySelectorAll('button'));
    return buttons.find((b) => /open page/i.test(b.textContent || '') && isVisible(b));
  }

  // Best-effort: look for whatever control dismisses the canvas page, scoped
  // to its panel when a recognizable wrapper exists (falls back to the whole
  // document since the exact wrapper markup wasn't verified live). Matched by
  // aria-label/text against close/back/dismiss — never a guessed CSS class.
  function findCanvasCloseButton() {
    const page = findCanvasPage();
    if (!page) return null;
    const scope =
      page.closest('[role="dialog"], [role="complementary"], aside') || page.parentElement || document;
    const buttons = Array.from(scope.querySelectorAll('button'));
    return buttons.find((b) => {
      if (!isVisible(b)) return false;
      const label = `${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`.trim();
      return /close|dismiss|back to chat/i.test(label);
    });
  }

  // Fire-and-forget cleanup after a job is done: leaving the canvas open would
  // make it the ONLY thing visible in this (reused) tab until the next job's
  // own turn appears, and — should the site ever mount a second page node
  // instead of replacing the first — a stale node closed here can't linger to
  // confuse a later job's peekReply. No-op if no close control is found;
  // never falls back to history.back(), which risks navigating out of Copilot
  // entirely on a layout this wasn't verified against.
  async function closeCanvasPage() {
    const btn = findCanvasCloseButton();
    if (!btn) {
      return { ok: false, error: 'No close control found for the canvas page' };
    }
    const W = getWebOps();
    if (W) await W.humanClick(btn);
    else btn.click();
    return { ok: true };
  }

  async function submitPrompt(prompt) {
    const input = findPromptInput();
    if (!input) {
      return { found: false, error: 'Copilot prompt input not found (login or DOM change?)' };
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

  async function peekReply(before) {
    // The provider tab is reused across jobs (findOrCreateProviderTab), so a
    // canvas page opened by an EARLIER job can still be mounted here. Only
    // trust findCanvasPage() once THIS job's own turn has actually appeared
    // (blocks.length > before) — otherwise it is stale content left over from
    // a previous run, not this job's answer, and reporting it as "done"
    // immediately is what made the popup show a prior test's stale result.
    const blocks = assistantTurns();
    if (blocks.length <= before) {
      return { hasBlock: false, text: '' };
    }

    // Once on (or just entered) a canvas page for THIS turn, the original chat
    // DOM is gone once navigated in, so read from here once it exists.
    const existingPage = findCanvasPage();
    if (existingPage) {
      return { hasBlock: true, text: (existingPage.innerText || '').trim() };
    }

    const el = blocks[blocks.length - 1];

    const openBtn = findOpenPageButton(el);
    if (openBtn) {
      const W = getWebOps();
      if (W) await W.humanClick(openBtn);
      else openBtn.click();
      // Not ready this round — the next peek will find the mounted canvas page.
      return { hasBlock: false, text: '' };
    }

    return { hasBlock: true, text: (el.innerText || '').trim() };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'chrome_copilot_ping') {
      sendResponse({ status: 'pong' });
      return true;
    }
    if (message.action === 'copilotSubmitPrompt') {
      submitPrompt(String(message.prompt || ''))
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ found: false, error: String(e && e.message) }));
      return true;
    }
    if (message.action === 'copilotPeekReply') {
      peekReply(Number(message.before) || 0)
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ hasBlock: false, text: '', error: String(e && e.message) }));
      return true;
    }
    if (message.action === 'copilotClosePage') {
      closeCanvasPage()
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;
    }
  });

  console.log('[Copilot Web Helper] Message listener registered');
})();
