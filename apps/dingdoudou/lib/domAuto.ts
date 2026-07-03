// Shared DOM-automation helpers for 订多多 content scripts.
//
// These power the page-automation ports (payment / address / invoice / batch
// checkout) that drive the Pinduoduo (mobile.yangkeduo.com) and Alipay
// (mclient.alipay.com) mobile web pages. The mobile pages are React/Preact
// single-page apps with obfuscated class names, so almost everything here is a
// best-effort heuristic: prefer stable attributes, then fall back to matching
// elements by their visible text.
//
// Hard rule: a content script must NEVER crash or block the host page. Every
// function below guards DOM and chrome.* access and swallows its own errors.

export interface ActionResult {
  success: boolean;
  detail?: string;
  // handlers may attach extra context (matched text, parsed rows, etc.)
  [key: string]: unknown;
}

export type ActionMessage = { action: string; [key: string]: unknown };
export type ActionHandler = (
  msg: ActionMessage,
  sender: chrome.runtime.MessageSender,
) => Promise<ActionResult | void> | ActionResult | void;

// --- timing ---------------------------------------------------------------

// Resolve after `ms` milliseconds.
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

// Resolve once the document body exists (content scripts can run at
// document_start, before <body> is parsed).
export function domReady(timeoutMs = 8000): Promise<boolean> {
  if (document.body) return Promise.resolve(true);
  return waitFor(() => !!document.body, timeoutMs).then((v) => !!v);
}

// --- querying -------------------------------------------------------------

// Safe querySelectorAll → array. Never throws on a malformed selector.
export function queryAll<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  try {
    return Array.from(root.querySelectorAll(selector)) as T[];
  } catch {
    return [];
  }
}

// Safe querySelector. Never throws.
export function query<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T | null {
  try {
    return root.querySelector(selector) as T | null;
  } catch {
    return null;
  }
}

// Normalized (collapsed-whitespace) text of an element.
export function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

// Best-effort visibility test. On any failure we assume visible so we never
// wrongly skip a real control.
export function isVisible(el: Element | null | undefined): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  try {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (cs.opacity !== '' && Number(cs.opacity) === 0) return false;
    return true;
  } catch {
    return true;
  }
}

// Default candidate selector for "something the user could tap".
export const CLICKABLE_SELECTOR =
  'button, a, [role="button"], [onclick], .btn, [class*="btn"], [class*="button"], [class*="Btn"], span, div, li, p';

function toRegExp(pattern: string | RegExp): RegExp {
  if (pattern instanceof RegExp) return pattern;
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
}

export interface FindOptions {
  root?: ParentNode;
  selector?: string;
  // require the element to be visible (default true)
  visibleOnly?: boolean;
}

// Find every visible element whose collapsed text matches `pattern`.
// Results are sorted most-specific-first (shortest text), so the first hit is
// usually the precise control rather than a wrapping container.
export function findAllByText(
  pattern: string | RegExp,
  opts: FindOptions = {},
): HTMLElement[] {
  const root = opts.root ?? document;
  const selector = opts.selector ?? CLICKABLE_SELECTOR;
  const visibleOnly = opts.visibleOnly !== false;
  const re = toRegExp(pattern);
  const seen = new Set<Element>();
  const out: HTMLElement[] = [];
  for (const el of queryAll<HTMLElement>(selector, root)) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (visibleOnly && !isVisible(el)) continue;
    const t = textOf(el);
    if (t && re.test(t)) out.push(el);
  }
  out.sort((a, b) => textOf(a).length - textOf(b).length);
  return out;
}

// First visible element whose text matches `pattern` (or null).
export function findByText(
  pattern: string | RegExp,
  opts: FindOptions = {},
): HTMLElement | null {
  return findAllByText(pattern, opts)[0] ?? null;
}

// --- waiting --------------------------------------------------------------

// Wait until `probe` is satisfied, then resolve with its value. `probe` is
// either a CSS selector (resolves with the matched element) or a predicate
// (resolves with its truthy return value). Backed by a MutationObserver plus a
// polling fallback, capped by `timeoutMs`. Resolves null on timeout.
export function waitFor<T>(
  probe: string | (() => T | null | undefined | false),
  timeoutMs = 8000,
  intervalMs = 200,
): Promise<T | null> {
  const evaluate = (): T | null => {
    try {
      if (typeof probe === 'string') {
        return (document.querySelector(probe) as unknown as T) ?? null;
      }
      const v = probe();
      return v == null || v === false ? null : (v as T);
    } catch {
      return null;
    }
  };

  return new Promise((resolve) => {
    const first = evaluate();
    if (first) return resolve(first);

    let done = false;
    let observer: MutationObserver | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (poll) clearInterval(poll);
      if (timer) clearTimeout(timer);
      if (observer) observer.disconnect();
    };
    const finish = (val: T | null) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(val);
    };

    poll = setInterval(() => {
      const v = evaluate();
      if (v) finish(v);
    }, Math.max(50, intervalMs));
    timer = setTimeout(() => finish(null), Math.max(0, timeoutMs));

    try {
      observer = new MutationObserver(() => {
        const v = evaluate();
        if (v) finish(v);
      });
      const target = document.documentElement || document.body;
      if (target) {
        observer.observe(target, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
      }
    } catch {
      // polling alone still covers it
    }
  });
}

// --- interaction ----------------------------------------------------------

// Click an element with a realistic pointer/mouse sequence followed by a native
// click(). Mobile PDD/Alipay controls are often non-<button> divs that bind
// touch/pointer handlers, so the synthetic down/up events matter. Returns
// whether the element was actionable.
export function clickEl(el: Element | null | undefined): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  try {
    el.scrollIntoView({ block: 'center', inline: 'center' });
  } catch {
    /* ignore scroll failures */
  }
  try {
    let cx = 1;
    let cy = 1;
    try {
      const rect = el.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
    } catch {
      /* keep defaults */
    }
    const base: PointerEventInit & MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: cx,
      clientY: cy,
      button: 0,
    };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', base));
    } catch {
      /* PointerEvent may be unavailable */
    }
    try {
      el.dispatchEvent(new MouseEvent('mousedown', base));
    } catch {
      /* ignore */
    }
    try {
      el.dispatchEvent(new PointerEvent('pointerup', base));
    } catch {
      /* ignore */
    }
    try {
      el.dispatchEvent(new MouseEvent('mouseup', base));
    } catch {
      /* ignore */
    }
    // Native click() fires a trusted-shaped click that React's delegated
    // listeners pick up; avoids double-firing a synthetic 'click'.
    if (typeof el.click === 'function') {
      el.click();
    } else {
      el.dispatchEvent(new MouseEvent('click', base));
    }
    return true;
  } catch {
    return false;
  }
}

// Set an <input>/<textarea> value through React's native value setter so the
// framework's onChange actually fires.
export function setInputValue(
  el: HTMLInputElement | HTMLTextAreaElement | null | undefined,
  value: string,
): boolean {
  if (!el) return false;
  try {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    try {
      el.focus();
    } catch {
      /* ignore */
    }
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch {
    try {
      el.value = value;
      return true;
    } catch {
      return false;
    }
  }
}

// Type a passcode/PIN digit-by-digit, dispatching keyboard + input events for
// each character. Works for both a single password <input> and the segmented
// ".my-passcode-input-cell" style fields PDD/Alipay use. Best-effort.
export function typeDigits(
  el: HTMLInputElement | HTMLElement | null | undefined,
  digits: string,
): boolean {
  if (!el) return false;
  try {
    try {
      (el as HTMLElement).focus?.();
    } catch {
      /* ignore */
    }
    let accumulated = '';
    for (const ch of String(digits)) {
      accumulated += ch;
      const keyInit: KeyboardEventInit = { key: ch, bubbles: true, cancelable: true };
      try {
        el.dispatchEvent(new KeyboardEvent('keydown', keyInit));
      } catch {
        /* ignore */
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        setInputValue(el, accumulated);
      }
      try {
        el.dispatchEvent(new KeyboardEvent('keyup', keyInit));
      } catch {
        /* ignore */
      }
    }
    return true;
  } catch {
    return false;
  }
}

// --- messaging ------------------------------------------------------------

// Proactively report page state to the background. Errors (e.g. no receiver,
// invalidated context) are swallowed and lastError is consumed to avoid the
// "Unchecked runtime.lastError" console noise.
export function sendDdEvent(name: string, payload: Record<string, unknown> = {}): void {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    chrome.runtime.sendMessage(
      { ddEvent: name, href: safeHref(), ts: Date.now(), ...payload },
      () => void chrome.runtime?.lastError,
    );
  } catch {
    /* never throw on the host page */
  }
}

// Register a map of action-string handlers on chrome.runtime.onMessage. Unknown
// actions are ignored (return false) so other content scripts sharing the tab
// can still answer them. Handler results are normalized to ActionResult.
export function onAction(handlers: Record<string, ActionHandler>): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const action =
      msg && typeof msg === 'object' ? (msg as { action?: unknown }).action : undefined;
    if (typeof action !== 'string') return false;
    const fn = handlers[action];
    if (!fn) return false; // not ours — let another listener respond
    Promise.resolve()
      .then(() => fn(msg as ActionMessage, sender))
      .then((res) => sendResponse(normalizeResult(res)))
      .catch((e) =>
        sendResponse({
          success: false,
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    return true; // keep the channel open for the async sendResponse
  });
}

function normalizeResult(res: ActionResult | void): ActionResult {
  if (!res) return { success: true };
  return res;
}

function safeHref(): string {
  try {
    return location.href;
  } catch {
    return '';
  }
}

// --- on-page feedback -----------------------------------------------------

// Lightweight non-blocking toast (used by the 'showAlert' action instead of
// window.alert, which would freeze the automation loop).
export function toast(message: string, ms = 3200): void {
  try {
    if (!document.body) return;
    const id = '__dd_toast__';
    let host = document.getElementById(id);
    if (!host) {
      host = document.createElement('div');
      host.id = id;
      host.style.cssText = [
        'position:fixed',
        'left:50%',
        'top:18%',
        'transform:translateX(-50%)',
        'z-index:2147483647',
        'max-width:80vw',
        'padding:10px 16px',
        'border-radius:10px',
        'background:rgba(20,20,20,.92)',
        'color:#fff',
        'font-size:14px',
        'line-height:1.4',
        'box-shadow:0 6px 24px rgba(0,0,0,.35)',
        'pointer-events:none',
        'text-align:center',
        'white-space:pre-wrap',
      ].join(';');
      document.body.appendChild(host);
    }
    host.textContent = message;
    host.style.opacity = '1';
    const el = host;
    window.setTimeout(() => {
      try {
        el.style.transition = 'opacity .4s';
        el.style.opacity = '0';
      } catch {
        /* ignore */
      }
    }, Math.max(400, ms));
  } catch {
    /* ignore — feedback is non-critical */
  }
}
