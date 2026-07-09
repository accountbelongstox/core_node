/* eslint-disable */
// accessibility-tree-helper.js
// Injected into the page to build a compact accessibility/interaction tree and
// to resolve stable element references ("refs") back to coordinates/selectors.
//
// Actions handled (see common/message-types.ts):
//   - generateAccessibilityTree : walk the DOM, return an indented text tree of
//       meaningful elements + a refMap. Supports { filter, depth, refId }.
//   - resolveRef                : ref -> { center:{x,y}, selector, rect }
//   - ensureRefForSelector      : selector -> { ref }
//   - <toolName>_ping           : liveness probe used by BaseBrowserToolExecutor
//
// Refs are kept in a page-session registry so a refId returned by one call still
// resolves on later calls (e.g. read_page -> computer click). The registry is
// rebuilt fresh on navigation because the injected script re-runs on a new page.

(function () {
  // Reuse the existing instance if already injected: re-initializing would wipe
  // the ref registry and invalidate refs the caller is still holding.
  if (window.__ACCESSIBILITY_TREE_HELPER_INITIALIZED__) {
    return;
  }
  window.__ACCESSIBILITY_TREE_HELPER_INITIALIZED__ = true;

  // --- Ref registry (persists for the lifetime of this document) ---
  const registry = (window.__A11Y_REF_REGISTRY__ = window.__A11Y_REF_REGISTRY__ || {
    byRef: new Map(), // ref string -> Element
    byEl: new WeakMap(), // Element -> ref string
    counter: 0,
  });

  function refFor(el) {
    const existing = registry.byEl.get(el);
    if (existing) return existing;
    const ref = 'e' + ++registry.counter;
    registry.byRef.set(ref, el);
    registry.byEl.set(el, ref);
    return ref;
  }

  // byRef is a strong Map (only byEl is a WeakMap), so detached elements would
  // be pinned for the page-session lifetime. Sweep disconnected entries on each
  // tree generation so long-lived SPAs that re-render frequently do not
  // accumulate detached Element leaks.
  function sweepDetachedRefs() {
    for (const [ref, el] of registry.byRef) {
      if (!el.isConnected) {
        registry.byRef.delete(ref);
        registry.byEl.delete(el);
      }
    }
  }

  // --- Element classification ---
  const INTERACTIVE_SELECTOR = [
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="option"]',
    '[role="switch"]',
    '[role="slider"]',
    '[role="textbox"]',
    '[onclick]',
    '[tabindex]:not([tabindex^="-"])',
    '[contenteditable="true"]',
  ].join(', ');

  const LANDMARK_TAGS = new Set(['MAIN', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'SECTION', 'FORM']);
  const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

  function isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 || el.tagName === 'A';
  }

  function isInteractive(el) {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    return el.matches(INTERACTIVE_SELECTOR);
  }

  /** Semantic role used for the tree label. */
  function roleOf(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName;
    if (tag === 'A' && el.hasAttribute('href')) return 'link';
    if (tag === 'BUTTON') return 'button';
    if (tag === 'SELECT') return 'select';
    if (tag === 'TEXTAREA') return 'textbox';
    if (tag === 'INPUT') return (el.getAttribute('type') || 'text').toLowerCase();
    if (tag === 'IMG') return 'img';
    if (HEADING_TAGS.has(tag)) return 'heading';
    if (LANDMARK_TAGS.has(tag)) return tag.toLowerCase();
    return tag.toLowerCase();
  }

  function getAccessibleName(el) {
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const parts = labelledby
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() || '')
        .filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return label.textContent?.trim() || '';
    }
    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.contains(el)) {
      const t = parentLabel.textContent?.trim();
      if (t) return t;
    }
    if (el.tagName === 'IMG') return el.getAttribute('alt') || '';
    return (
      el.getAttribute('placeholder') ||
      el.getAttribute('value') ||
      el.textContent?.trim() ||
      el.getAttribute('title') ||
      ''
    );
  }

  function generateSelector(el) {
    if (!(el instanceof Element)) return '';
    if (el.id) {
      const idSelector = `#${CSS.escape(el.id)}`;
      if (document.querySelectorAll(idSelector).length === 1) return idSelector;
    }
    for (const attr of ['data-testid', 'data-cy', 'name']) {
      const value = el.getAttribute(attr);
      if (value) {
        const sel = `[${attr}="${CSS.escape(value)}"]`;
        if (document.querySelectorAll(sel).length === 1) return sel;
      }
    }
    let path = '';
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName !== 'BODY') {
      let selector = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === current.tagName);
        if (siblings.length > 1) {
          selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
      }
      path = path ? `${selector} > ${path}` : selector;
      current = parent;
    }
    return path ? `body > ${path}` : 'body';
  }

  /** An element is "meaningful" if it carries interaction or structural meaning. */
  function isMeaningful(el, interactiveOnly) {
    if (isInteractive(el)) return true;
    if (interactiveOnly) return false;
    const tag = el.tagName;
    if (HEADING_TAGS.has(tag) || LANDMARK_TAGS.has(tag)) return true;
    if (tag === 'IMG' && el.getAttribute('alt')) return true;
    return false;
  }

  const MAX_NODES = 500; // hard cap so huge pages can't produce unbounded output
  const MAX_NAME = 120;

  function clip(text) {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    return t.length > MAX_NAME ? t.slice(0, MAX_NAME) + '…' : t;
  }

  /**
   * Depth-first walk producing { lines, refMap, stats }.
   * @param {Element} root
   * @param {boolean} interactiveOnly
   * @param {number|undefined} maxDepth  undefined = unlimited
   */
  function buildTree(root, interactiveOnly, maxDepth) {
    const lines = [];
    const refMap = [];
    let processed = 0;
    let included = 0;
    let truncated = false;

    function walk(el, depth) {
      if (included >= MAX_NODES) {
        truncated = true;
        return;
      }
      for (const child of el.children) {
        processed++;
        if (!isElementVisible(child)) continue;

        const meaningful = isMeaningful(child, interactiveOnly);
        let childDepth = depth;
        if (meaningful) {
          const ref = refFor(child);
          const role = roleOf(child);
          const name = clip(getAccessibleName(child));
          const href = child.tagName === 'A' ? child.getAttribute('href') : null;
          const namePart = name ? ` "${name.replace(/"/g, '\\"')}"` : '';
          const hrefPart = href ? ` -> ${href}` : '';
          lines.push(`${'  '.repeat(depth)}[${ref}] ${role}${namePart}${hrefPart}`);
          refMap.push({ ref, role, name, selector: generateSelector(child) });
          included++;
          childDepth = depth + 1;
          if (included >= MAX_NODES) {
            truncated = true;
            return;
          }
        }
        if (maxDepth === undefined || childDepth <= maxDepth) {
          walk(child, childDepth);
          if (truncated) return;
        }
      }
    }

    walk(root, 0);
    return { lines, refMap, processed, included, truncated };
  }

  function handleGenerate(request) {
    sweepDetachedRefs();
    const started = performance.now();
    const interactiveOnly = request.filter === 'interactive';
    const maxDepth = Number.isInteger(request.depth) ? request.depth : undefined;

    let root = document.body;
    if (request.refId) {
      const focus = registry.byRef.get(request.refId);
      if (!focus || !focus.isConnected) {
        return { success: false, error: `refId "${request.refId}" not found or expired` };
      }
      root = focus;
    }
    if (!root) return { success: false, error: 'Document body is not available' };

    const { lines, refMap, processed, included, truncated } = buildTree(
      root,
      interactiveOnly,
      maxDepth,
    );

    return {
      success: true,
      pageContent: lines.join('\n'),
      refMap,
      truncated,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
      },
      stats: {
        processed,
        included,
        durationMs: Math.round(performance.now() - started),
      },
    };
  }

  function handleResolveRef(request) {
    const el = registry.byRef.get(request.ref);
    if (!el || !el.isConnected) {
      return { success: false, error: `ref "${request.ref}" not found or expired` };
    }
    const rect = el.getBoundingClientRect();
    return {
      success: true,
      center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      selector: generateSelector(el),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  }

  function handleEnsureRef(request) {
    let el = null;
    try {
      el = document.querySelector(request.selector);
    } catch (e) {
      return { success: false, error: `Invalid selector: ${e.message}` };
    }
    if (!el) return { success: false, error: `No element matches selector: ${request.selector}` };
    return { success: true, ref: refFor(el), selector: generateSelector(el) };
  }

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    const action = request && request.action;
    try {
      switch (action) {
        case 'generateAccessibilityTree':
          sendResponse(handleGenerate(request));
          return false;
        case 'resolveRef':
          sendResponse(handleResolveRef(request));
          return false;
        case 'ensureRefForSelector':
          sendResponse(handleEnsureRef(request));
          return false;
        // Liveness probe: BaseBrowserToolExecutor pings as `${toolName}_ping`.
        // This helper backs both chrome_read_page and chrome_computer.
        case 'chrome_read_page_ping':
        case 'chrome_computer_ping':
          sendResponse({ status: 'pong' });
          return false;
        default:
          return false; // not ours; let other listeners respond
      }
    } catch (error) {
      sendResponse({ success: false, error: error && error.message ? error.message : String(error) });
      return false;
    }
  });

  console.log('Accessibility tree helper script loaded');
})();
