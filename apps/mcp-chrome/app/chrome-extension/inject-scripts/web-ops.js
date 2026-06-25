/**
 * WebOps — shared human-simulation web-operation library (injected class).
 *
 * A single content-script library that fully simulates a human operating a page:
 * char-by-char typing with random delays, realistic focus/pointer/mouse/key
 * click sequences, randomized waits, selector polling, shadow-DOM piercing, and
 * in-page binary fetch. It is REUSED by every site helper (Bing dictionary,
 * ChatGPT, Gemini, …) so each stops hand-rolling its own input/click/poll code.
 *
 * Usage: injected as the FIRST file alongside a site helper, e.g.
 *   injectContentScript(tabId, ['inject-scripts/web-ops.js', 'inject-scripts/<helper>.js'])
 * Helpers then call `self.__WebOps.<method>` after a presence check:
 *   const W = self.__WebOps && self.__WebOps._ping && self.__WebOps._ping() === 'pong' ? self.__WebOps : null;
 *   if (W) await W.humanType(input, word); else <inline fallback>;
 *
 * It registers NO chrome.runtime.onMessage listener — it is a pure library; the
 * co-injected helper owns all messaging (and the file-aware ping). The
 * `self.__WebOps` presence (frozen) is the load-guard, so a re-injection is a
 * no-op and the library is never defined twice.
 *
 * NOTE on isTrusted: events are synthetic (isTrusted=false). Bing's search box
 * and ChatGPT/Gemini's editors accept synthetic input (the prior helpers already
 * relied on it). Sites that hard-gate on event.isTrusted are out of scope here;
 * helpers keep an inline fallback for safety.
 */

(() => {
  // Load-guard: if a prior injection already published the library, do nothing.
  if (self.__WebOps) {
    return;
  }

  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms | 0)));
  // The single human-cadence jitter used everywhere (per-char + inter-action).
  const randomDelay = (min = 40, max = 140) => sleep(rand(min, max));

  /** Poll predicate() until truthy or timeout. Resolves the last value / false. */
  async function waitFor(predicate, opts) {
    const timeout = (opts && opts.timeout) || 8000;
    const interval = (opts && opts.interval) || 150;
    const start = Date.now();
    for (;;) {
      let value = null;
      try {
        value = predicate();
      } catch (_) {
        value = null;
      }
      if (value) return value;
      if (Date.now() - start >= timeout) return value || false;
      await sleep(interval);
    }
  }

  /** Wait for a selector to appear; resolves the Element or null on timeout. */
  function waitForSelector(selector, opts) {
    const root = (opts && opts.root) || document;
    return waitFor(() => root.querySelector(selector), opts).then((v) => v || null);
  }

  /** Recursive open-shadow-root-piercing query (for web-component sites, e.g. Gemini). */
  function queryDeep(selector, opts) {
    const root = (opts && opts.root) || document;
    const direct = root.querySelector(selector);
    if (direct) return direct;
    const walker = root.querySelectorAll('*');
    for (const el of walker) {
      if (el.shadowRoot) {
        const found = queryDeep(selector, { root: el.shadowRoot });
        if (found) return found;
      }
    }
    return null;
  }

  function queryDeepAll(selector, opts) {
    const root = (opts && opts.root) || document;
    const out = [];
    out.push(...root.querySelectorAll(selector));
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) out.push(...queryDeepAll(selector, { root: el.shadowRoot }));
    }
    return out;
  }

  /** Visible = rendered, non-zero, in viewport, and the top element at its center. */
  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) {
      return false;
    }
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return hit === el || el.contains(hit) || (hit && hit.contains(el));
  }

  function centerOf(el) {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  async function scrollIntoViewCenter(el) {
    try {
      el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
    } catch (_) {
      /* ignore */
    }
    await randomDelay(80, 160);
  }

  function pointerEvent(type, x, y) {
    return new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerdown' ? 1 : 0,
    });
  }
  function mouseEvent(type, x, y) {
    return new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === 'mousedown' ? 1 : 0,
    });
  }

  /** Move/hover/press toward an element like a human before acting on it. */
  async function humanFocus(el) {
    await scrollIntoViewCenter(el);
    const { x, y } = centerOf(el);
    el.dispatchEvent(pointerEvent('pointerover', x, y));
    el.dispatchEvent(mouseEvent('mouseover', x, y));
    el.dispatchEvent(pointerEvent('pointermove', x, y));
    await randomDelay(20, 60);
    try {
      if (typeof el.focus === 'function') el.focus({ preventScroll: true });
    } catch (_) {
      /* ignore */
    }
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  }

  async function resolveTarget(target, opts) {
    if (typeof target === 'string') return waitForSelector(target, opts);
    if (target instanceof Element) return target;
    if (target && typeof target.x === 'number') return document.elementFromPoint(target.x, target.y);
    return null;
  }

  /** Full human click: hover/focus, then pointer/mouse/click sequence at center. */
  async function humanClick(target, opts) {
    const el = await resolveTarget(target, opts);
    if (!el) return { success: false, error: 'target not found' };
    await humanFocus(el);
    const { x, y } = centerOf(el);
    el.dispatchEvent(pointerEvent('pointerdown', x, y));
    el.dispatchEvent(mouseEvent('mousedown', x, y));
    await randomDelay(30, 90);
    el.dispatchEvent(pointerEvent('pointerup', x, y));
    el.dispatchEvent(mouseEvent('mouseup', x, y));
    el.dispatchEvent(mouseEvent('click', x, y));
    return { success: true };
  }

  // --- key events -----------------------------------------------------------
  function keyEvent(type, key, opts) {
    const o = opts || {};
    return new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      key,
      code: o.code || key,
      keyCode: o.keyCode || 0,
      which: o.keyCode || 0,
    });
  }
  function pressEnter(el) {
    const o = { code: 'Enter', keyCode: 13 };
    el.dispatchEvent(keyEvent('keydown', 'Enter', o));
    el.dispatchEvent(keyEvent('keypress', 'Enter', o));
    el.dispatchEvent(keyEvent('keyup', 'Enter', o));
  }

  /** Submit a field's form the most reliable way available. */
  function submitForm(el) {
    const form = el && el.form;
    if (form) {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
        return true;
      }
      form.submit();
      return true;
    }
    pressEnter(el);
    return false;
  }

  // --- value setters --------------------------------------------------------
  // React-safe native value setter (updates the internal _valueTracker so
  // controlled inputs register the change).
  function nativeSet(el, value) {
    const proto =
      el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(el, value);
    else el.value = value;
  }

  function isContentEditable(el) {
    return !!el && (el.isContentEditable || el.getAttribute('contenteditable') === 'true');
  }

  /**
   * Type into a contenteditable / ProseMirror / Quill (.ql-editor) / Lexical
   * editor. Uses execCommand('insertText') per char (which fires the editor's
   * OWN native beforeinput+input) — NO synthetic beforeinput before it, so the
   * editor never sees a doubled event. Falls back to a text node + input event
   * if execCommand is unavailable. keydown/keyup wrap each char for cadence.
   */
  async function insertContentEditable(el, text, perCharMin, perCharMax) {
    el.focus();
    // Caret to end.
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {
      /* ignore */
    }
    for (const ch of text) {
      el.dispatchEvent(keyEvent('keydown', ch));
      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, ch);
      } catch (_) {
        inserted = false;
      }
      if (!inserted) {
        el.dispatchEvent(
          new InputEvent('beforeinput', { inputType: 'insertText', data: ch, bubbles: true, cancelable: true }),
        );
        el.appendChild(document.createTextNode(ch));
        el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: ch, bubbles: true }));
      }
      el.dispatchEvent(keyEvent('keyup', ch));
      await randomDelay(perCharMin, perCharMax);
    }
  }

  /** Type into an INPUT/TEXTAREA char-by-char via the native setter + input events. */
  async function typeNativeInput(el, text, perCharMin, perCharMax, clear) {
    let acc = clear ? '' : (el.value || '');
    if (clear) {
      nativeSet(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    for (const ch of text) {
      el.dispatchEvent(keyEvent('keydown', ch));
      el.dispatchEvent(
        new InputEvent('beforeinput', { inputType: 'insertText', data: ch, bubbles: true, cancelable: true }),
      );
      acc += ch;
      nativeSet(el, acc);
      el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: ch, bubbles: true }));
      el.dispatchEvent(keyEvent('keyup', ch));
      await randomDelay(perCharMin, perCharMax);
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * The headline human typer. Resolves the target, focuses it, and types text
   * char-by-char with random delays. Auto-detects INPUT/TEXTAREA vs
   * contenteditable vs SELECT. opts: {perCharMin=20, perCharMax=120, clear=true,
   * submit=false}.
   */
  async function humanType(target, text, opts) {
    const o = opts || {};
    const perCharMin = o.perCharMin == null ? 20 : o.perCharMin;
    const perCharMax = o.perCharMax == null ? 120 : o.perCharMax;
    const clear = o.clear !== false;
    const el = await resolveTarget(target, o);
    if (!el) return { ok: false, error: 'target not found' };
    await humanFocus(el);

    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'SELECT') {
      const want = String(text);
      for (const opt of el.options) {
        if (opt.value === want || (opt.textContent || '').trim() === want) {
          el.value = opt.value;
          break;
        }
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, mode: 'select' };
    }

    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      await typeNativeInput(el, String(text), perCharMin, perCharMax, clear);
      if (o.submit) submitForm(el);
      return { ok: true, mode: 'input' };
    }

    if (isContentEditable(el)) {
      if (clear) {
        try {
          el.textContent = '';
        } catch (_) {
          /* ignore */
        }
      }
      await insertContentEditable(el, String(text), perCharMin, perCharMax);
      if (o.submit) pressEnter(el);
      return { ok: true, mode: 'contenteditable' };
    }

    return { ok: false, error: 'unsupported element ' + tag };
  }

  /**
   * In-page fetch → bytes (number[]), the shared media-capture pipeline (audio
   * for ChatGPT/Gemini, images/audio for Bing). Runs in the page origin so
   * referrer/cookie-bound media is readable. Returns {ok,mime,bytes:number[]}.
   */
  async function fetchBytes(url, init) {
    try {
      const res = await fetch(url, Object.assign({ cache: 'no-store' }, init || {}));
      if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
      const buf = await res.arrayBuffer();
      if (!buf || buf.byteLength === 0) return { ok: false, error: 'empty' };
      const view = new Uint8Array(buf);
      const bytes = new Array(view.length);
      for (let i = 0; i < view.length; i++) bytes[i] = view[i];
      const mime = (res.headers.get('content-type') || '').split(';')[0].trim() || null;
      return { ok: true, mime, bytes };
    } catch (error) {
      return { ok: false, error: String(error && error.message) };
    }
  }

  self.__WebOps = Object.freeze({
    version: 1,
    _ping: () => 'pong',
    rand,
    randInt,
    sleep,
    randomDelay,
    waitFor,
    waitForSelector,
    queryDeep,
    queryDeepAll,
    isVisible,
    centerOf,
    scrollIntoViewCenter,
    humanFocus,
    humanClick,
    humanType,
    nativeSet,
    pressEnter,
    submitForm,
    fetchBytes,
  });

  console.log('[WebOps] human-sim library ready (v1)');
})();
