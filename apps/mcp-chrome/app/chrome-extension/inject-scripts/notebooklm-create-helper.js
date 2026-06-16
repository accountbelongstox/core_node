/**
 * NotebookLM Create Helper Content Script
 *
 * Drives Google NotebookLM (notebooklm.google.com) to: create a new notebook,
 * add a text/topic source, and start generation — then report progress. The app
 * is built from Angular web components with heavy Shadow DOM, so every lookup
 * pierces shadow roots (deepQueryAll) and matches by VISIBLE TEXT / aria-label
 * (the obfuscated class names are useless). Runs in the isolated world, so it is
 * exempt from the page CSP that blocks Runtime.evaluate.
 *
 * Actions (driven by the background NotebookLMCreateTool):
 *   - chrome_notebooklm_create_ping  -> {status:'pong'}
 *   - nblmClickCreate                -> find + click "Create new"; {clicked}
 *   - nblmAddSourceText {text}       -> open the text-source input, type, submit;
 *                                       {submitted, via}
 *   - nblmStatus                     -> {ready, generating, sourceCount, title, note}
 */

(() => {
  if (window.__nblmCreateHelperLoaded) {
    return;
  }
  window.__nblmCreateHelperLoaded = true;
  console.log('[NotebookLM Create Helper] loaded');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // ---- Shadow-DOM-piercing query --------------------------------------------
  function deepQueryAll(selectors, root) {
    const sels = Array.isArray(selectors) ? selectors : [selectors];
    const out = [];
    const seen = new Set();
    const visit = (node) => {
      if (!node || !node.querySelectorAll) return;
      for (const sel of sels) {
        let m = [];
        try {
          m = node.querySelectorAll(sel);
        } catch (_) {
          m = [];
        }
        m.forEach((el) => {
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

  const isVisible = (el) => {
    if (!el) return false;
    try {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const st = window.getComputedStyle(el);
      return !(st && (st.display === 'none' || st.visibility === 'hidden'));
    } catch (_) {
      return false;
    }
  };

  /** All clickable elements (buttons/links/role=button) across shadow roots. */
  const clickables = () =>
    deepQueryAll([
      'button',
      'a[href]',
      '[role="button"]',
      '[role="menuitem"]',
      'mat-chip',
      '.mat-mdc-button',
    ]).filter(isVisible);

  /** First visible clickable whose text or aria-label matches `re`. */
  function findByText(re) {
    for (const el of clickables()) {
      const label = `${el.getAttribute('aria-label') || ''} ${norm(el.textContent)}`;
      if (re.test(label)) return el;
    }
    return null;
  }

  /** Primary text input on the page (textarea or contenteditable), shadow-pierced. */
  function findTextInput() {
    const cands = deepQueryAll([
      'textarea',
      'div[contenteditable="true"]',
      'div.ql-editor[contenteditable="true"]',
      'input[type="text"]',
      '[role="textbox"]',
    ]).filter(isVisible);
    // Prefer the largest visible one (the main prompt/source box).
    cands.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    });
    return cands[0] || null;
  }

  function setText(el, text) {
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    }
  }

  // ---- Actions --------------------------------------------------------------

  function clickCreate() {
    const btn = findByText(/\bcreate new\b|\bnew notebook\b|^\s*\+?\s*create\b/i);
    if (!btn) return { clicked: false, error: 'Create-new control not found' };
    btn.click();
    return { clicked: true };
  }

  /**
   * Add a text/topic source: NotebookLM's add-source dialog offers tiles
   * (Paste text / Copied text, Website, YouTube, "Search the web"). We:
   *   1. If a big text box is already present, type into it.
   *   2. Else click a "paste/copied text"/"search the web" tile to reveal one.
   *   3. Type the text, then click a submit/insert/generate/search control.
   */
  async function addSourceText(text) {
    let input = findTextInput();
    let via = 'direct';
    if (!input) {
      const tile = findByText(/copied text|paste text|paste|search the web|new sources|text\b/i);
      if (tile) {
        tile.click();
        via = `tile:${norm(tile.textContent).slice(0, 24)}`;
        await sleep(700);
        input = findTextInput();
      }
    }
    if (!input) return { submitted: false, error: 'No text input found (add-source dialog DOM changed?)' };

    setText(input, text);
    await sleep(400);

    const submit = findByText(/\binsert\b|\badd\b|\bgenerate\b|\bcreate\b|\bsearch\b|\bsubmit\b|^\s*send\s*$/i);
    if (submit) {
      submit.click();
      return { submitted: true, via, submitVia: norm(submit.getAttribute('aria-label') || submit.textContent).slice(0, 24) };
    }
    // Fallback: Enter on the input.
    input.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }),
    );
    return { submitted: true, via, submitVia: 'enter' };
  }

  function getStatus() {
    const bodyText = (document.body && document.body.innerText) || '';
    const generating =
      /Generating|Creating|Loading sources|Processing|Analyzing|正在生成|生成中|加载/i.test(bodyText) ||
      deepQueryAll([
        'mat-progress-bar',
        'mat-spinner',
        '[role="progressbar"]',
        '.loading',
      ]).some(isVisible);
    // A rough "ready" signal: source items / studio panel present.
    const sourceCount = deepQueryAll([
      '[data-source-id]',
      'source-list-item',
      '.source-item',
      'mat-list-item',
    ]).filter(isVisible).length;
    const title = norm(document.title);
    return {
      ready: !generating && (sourceCount > 0 || /\/notebook\//.test(location.href)),
      generating,
      sourceCount,
      title,
      url: location.href,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const act = message && message.action;
    if (act === 'chrome_notebooklm_create_ping') {
      sendResponse({ status: 'pong' });
      return true;
    }
    if (act === 'nblmClickCreate') {
      try {
        sendResponse(clickCreate());
      } catch (e) {
        sendResponse({ clicked: false, error: String(e && e.message) });
      }
      return true;
    }
    if (act === 'nblmAddSourceText') {
      addSourceText(String(message.text || ''))
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ submitted: false, error: String(e && e.message) }));
      return true;
    }
    if (act === 'nblmStatus') {
      try {
        sendResponse(getStatus());
      } catch (e) {
        sendResponse({ ready: false, generating: false, error: String(e && e.message) });
      }
      return true;
    }
  });

  console.log('[NotebookLM Create Helper] listener registered');
})();
