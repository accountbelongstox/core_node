// ==UserScript==
// @name         Proton Mail inbox — mock Claude Code row (demo)
// @namespace    local.proton-inbox-demo
// @version      1.5.4
// @description  Scheme C body + promos; detail: Claude Team→Anthropic in header; body text sessionKey/IP.
// @match        https://mail.proton.me/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const LIST_SENDER = 'Anthropic';
  const LIST_SUBJECT = 'Regarding Your Account Suspension Appeal';

  const TARGET_MESSAGE_PATH =
    '/u/4/inbox/9AtXOuD7HhofKZtpn7cCu9TgopFbvM4aX9TGzWsUx_BAViCwkzJlITIAPOvTImPC5vM3IWR8NU138E7xmVBd2g==';

  /** Opened message “From” area: two lines; do not touch To/Cc (recipients). */
  const MESSAGE_SENDER_STORAGE = 'Stored with zero-access encryption';
  const MESSAGE_SENDER_FROM = 'Anthropic <no-reply@email.claude.com>';
  const MESSAGE_SUBJECT = 'Regarding Your Account Suspension Appeal';
  const MESSAGE_BODY = `Bo Regueiro,

Thank you for contacting Anthropic Support.

We confirm that we have received your appeal regarding the suspension of your account. After reviewing the available information and associated activity logs, we would like to provide clarification on the factors that led to this action.

The suspension is directly related to two categories of policy and security findings:

1) sessionKey and non-standard authentication
Your account activity shows use of a sessionKey and/or session-based access outside Anthropic’s officially supported sign-in surfaces (for example: unofficial clients, scripted access, or tooling that replays or injects session material). That is not an approved way to authenticate, and it violates our Terms of Service and Usage Policy when used to access the service.

2) IP switching and login patterns that do not match legitimate use
Our systems recorded multiple logins from different IP addresses within a short period, together with authentication behavior that does not match expected patterns for normal interactive use. That combination triggered automated risk controls and contributed to the enforcement decision.

These items are assessed together: improper sessionKey-style access and rapid multi-IP / non-standard login behavior are both treated as serious signals.

According to Anthropic's Usage Policy and Terms of Service:

Access to services must occur through authorized interfaces, such as official applications or API keys where applicable.

Automated or programmatic access without proper authorization mechanisms may result in enforcement actions.

Violations of the Terms of Service or Usage Policy can lead to account suspension or termination.

At this time, the suspension decision has been applied in accordance with our policies.

If you believe there are additional details that may be relevant to your case, you are welcome to submit a follow-up appeal with supporting information. Please note that repeated appeals without new information may not result in a different outcome.

We appreciate your understanding and cooperation.

Kind regards,
Anthropic Support Team`;

  /** Locate body by this Claude marketing sentence (stable in HTML mail). */
  const BODY_MARKER_TEXT =
    "Claude Code speeds up shipping larger features from days to minutes. Here's your guide to building faster:";
  const BODY_MARKER_TEXT_ALT =
    'Claude Code speeds up shipping larger features from days to minutes. Here\u2019s your guide to building faster:';

  /** Nearest block ancestor of the anchor text node (scheme C — no class-hash hosts, no leaf guess). */
  const MARKER_BLOCK_TAGS = new Set(['div', 'td', 'th', 'p', 'section', 'article', 'li', 'blockquote', 'body']);

  const TM_BODY_ROOT = 'data-tm-proton-body-root';
  const TM_BODY_PRE = 'data-tm-proton-body-pre';
  const OVERLAY_LEGACY_ID = 'tm-proton-message-body-overlay';
  /** CDN id in proxied img URL (emaillove-assets) — remove wrapping <a>…</a>. */
  const PROMO_EMAIL_IMAGE_ASSET_ID = '796c7909-0287-4d82-b86a-befa499beb1d';

  function textIncludesBodyMarker(s) {
    if (!s) return false;
    return s.includes(BODY_MARKER_TEXT) || s.includes(BODY_MARKER_TEXT_ALT);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Replace inner HTML only for a subtree that still shows the anchor (or already our injected <pre>).
   * Scheme C: never write into a container that did not contain the marketing anchor on first patch.
   */
  function fillBodyInMarkerContainer(target) {
    if (!target) return;
    const existing = target.querySelector('pre[' + TM_BODY_PRE + ']');
    if (existing) {
      if (existing.textContent.trim() === MESSAGE_BODY.trim()) return;
      existing.textContent = MESSAGE_BODY;
      return;
    }
    if (!textIncludesBodyMarker(target.textContent || '')) return;
    target.innerHTML =
      '<pre ' +
      TM_BODY_PRE +
      '="" style="display:block;margin:0;white-space:pre-wrap;font:inherit;line-height:1.45">' +
      escapeHtml(MESSAGE_BODY) +
      '</pre>';
    target.setAttribute(TM_BODY_ROOT, '');
  }

  /**
   * Scheme C — anchor only: find TEXT containing BODY_MARKER_TEXT, walk up to nearest block (smallest enclosing block).
   * Traversal: TreeWalker + SHOW_TEXT (see MDN createTreeWalker).
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker
   */
  function tryPatchBodyByMarkerText(root) {
    if (!root) return false;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = walker.nextNode())) {
      if (!textIncludesBodyMarker(n.nodeValue)) continue;
      let el = n.parentElement;
      while (el && el !== root) {
        const tag = el.tagName.toLowerCase();
        if (MARKER_BLOCK_TAGS.has(tag)) {
          fillBodyInMarkerContainer(el);
          return true;
        }
        el = el.parentElement;
      }
    }
    return false;
  }

  function removeLegacyOverlay() {
    const layer = document.getElementById(OVERLAY_LEGACY_ID);
    if (layer) {
      try {
        layer.remove();
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * Remove Claude marketing hero image: <a href="https://links.email.claude.com/..."> + proxied img (emaillove asset id).
   */
  function removeClaudeMarketingImageLinks(root) {
    if (!root || !root.querySelectorAll) return;
    const skip = (el) => !!(el && el.closest && el.closest('[' + TM_BODY_ROOT + ']'));
    const asset = PROMO_EMAIL_IMAGE_ASSET_ID;

    root.querySelectorAll('a[href*="links.email.claude.com"]').forEach((a) => {
      if (skip(a)) return;
      if (!a.querySelector('img[src*="' + asset + '"]')) return;
      try {
        a.remove();
      } catch (e) {
        // ignore
      }
    });

    root.querySelectorAll('img[src*="' + asset + '"]').forEach((img) => {
      if (skip(img)) return;
      const wrap = img.closest('a[href*="links.email.claude.com"]') || img.closest('a');
      if (wrap) {
        try {
          wrap.remove();
        } catch (e) {
          // ignore
        }
      } else {
        try {
          img.remove();
        } catch (e) {
          // ignore
        }
      }
    });
  }

  /** Remove known marketing blocks by class (Proton email HTML). Skips nodes that host our injected body. */
  function removePromoMailBlocks(root) {
    if (!root || !root.querySelectorAll) return;
    const sels = [
      '.da9-51.text.mj-t',
      '[class*="da9-51"][class*="text"][class*="mj-t"]',
      '.c9b-64.r.mj-w',
      '.ab5-ba.r.mj-w',
      '.eb2-80.r.mj-w',
      '[class*="c9b-64"][class*="mj-w"]',
      '[class*="ab5-ba"][class*="mj-w"]',
      '[class*="eb2-80"][class*="mj-w"]',
    ];
    sels.forEach((sel) => {
      root.querySelectorAll(sel).forEach((el) => {
        if (el.closest('[' + TM_BODY_ROOT + ']')) return;
        if (el.querySelector && el.querySelector('pre[' + TM_BODY_PRE + ']')) return;
        try {
          el.remove();
        } catch (e) {
          // ignore
        }
      });
    });
  }

  function patchMessageBodyAll(pane) {
    removeLegacyOverlay();

    const iframes = pane.querySelectorAll('iframe');
    for (let i = 0; i < iframes.length; i++) {
      try {
        const doc = iframes[i].contentDocument;
        if (!doc || !doc.body) continue;
        removeClaudeMarketingImageLinks(doc.body);
        removePromoMailBlocks(doc.body);
        if (tryPatchBodyByMarkerText(doc.body)) return true;
      } catch (e) {
        /* cross-origin iframe */
      }
    }

    removeClaudeMarketingImageLinks(pane);
    removePromoMailBlocks(pane);
    return tryPatchBodyByMarkerText(pane);
  }

  function isPlaceholderMailRow(el) {
    const id = el.getAttribute('data-element-id') || '';
    return /placeholder/i.test(id);
  }

  /** Mail list root — Proton layout / class names vary by build and view. */
  function findMailListRoot() {
    return (
      document.querySelector('.items-column-list-inner') ||
      document.querySelector('[class*="items-column-list-inner"]') ||
      document.querySelector('.delight-items-column-list-inner') ||
      document.querySelector('[class*="delight-items-column-list-inner"]') ||
      document.querySelector('.enhanced-list-container') ||
      document.querySelector('.items-column-list') ||
      document.querySelector('[class*="items-column-list"]:not([class*="detail"])') ||
      document.querySelector('[data-testid="message-list"]') ||
      document.querySelector('.items-column-list-container')
    );
  }

  /** First real message row (DOM order), skipping skeleton / placeholder rows. */
  function findFirstListItemContainer() {
    const root = findMailListRoot();
    const selectors =
      '[data-shortcut-target="item-container"][data-element-id], .item-container[data-element-id]';

    if (root) {
      const rows = root.querySelectorAll(selectors);
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!isPlaceholderMailRow(row)) return row;
      }
    }

    const main = document.querySelector('main');
    if (main) {
      const rows = main.querySelectorAll(selectors);
      for (let j = 0; j < rows.length; j++) {
        const row = rows[j];
        if (isPlaceholderMailRow(row)) continue;
        const inSidebar = row.closest('[class*="sidebar"], [class*="navigation"], nav[aria-label]');
        if (inSidebar) continue;
        return row;
      }
    }

    const fallback = document.querySelector(selectors);
    return fallback && !isPlaceholderMailRow(fallback) ? fallback : null;
  }

  function patchRow(root) {
    const sender =
      root.querySelector('[data-testid="message-column:sender-address"]') ||
      root.querySelector('[data-testid="message-row:sender-address"]');
    if (sender && sender.textContent !== LIST_SENDER) {
      sender.textContent = LIST_SENDER;
      sender.setAttribute('title', LIST_SENDER);
    }

    const subject =
      root.querySelector('[data-testid="message-column:subject"][role="heading"]') ||
      root.querySelector('[data-testid="message-column:subject"]') ||
      root.querySelector('[data-testid="message-row:subject"]');
    if (subject && subject.textContent !== LIST_SUBJECT) {
      subject.textContent = LIST_SUBJECT;
      subject.setAttribute('title', LIST_SUBJECT);
    }
  }

  function patchInboxList() {
    if (!/\/inbox(\/|$)/.test(location.pathname)) return;
    const row = findFirstListItemContainer();
    if (row) patchRow(row);
  }

  /** Reading pane only — avoid document.body so we do not touch sidebars / modals. */
  function readingPane() {
    return (
      document.querySelector('.items-column-detail') ||
      document.querySelector('[class*="view-column-detail"]') ||
      document.querySelector('main')
    );
  }

  /** Replace the longest text node under el (keeps React child elements intact). */
  function replaceDominantTextNode(el, text) {
    if (!el) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let best = null;
    let bestLen = 0;
    let n;
    while ((n = walker.nextNode())) {
      const v = (n.nodeValue || '').trim();
      if (v.length > bestLen) {
        bestLen = v.length;
        best = n;
      }
    }
    if (best && bestLen > 0) {
      best.nodeValue = text;
    }
  }

  function patchSubjectLine(pane) {
    const el =
      pane.querySelector('[data-testid="message-view:subject"]') ||
      pane.querySelector('[data-testid*="message-view"][data-testid*="subject"]') ||
      pane.querySelector('h1');
    if (!el) return;
    replaceDominantTextNode(el, MESSAGE_SUBJECT);
  }

  /**
   * Only the From block — never walk [class*="recipients"] (that matches To/Cc and wipes addresses).
   */
  function findFromScope(pane) {
    return (
      pane.querySelector('[data-testid="message-view:sender-address"]') ||
      pane.querySelector('[data-testid*="message-view"][data-testid*="sender-address"]') ||
      pane.querySelector('[class*="message-header"] .item-senders') ||
      pane.querySelector('[class*="message-header"] [class*="item-senders"]') ||
      pane.querySelector('[class*="message-header"] [class*="sender"]:not([class*="recipient"])') ||
      pane.querySelector('[class*="message-meta"] .item-senders') ||
      null
    );
  }

  function isTextUnderSvgOrLockDecoration(n) {
    const el = n.parentElement;
    if (!el) return true;
    if (el.closest('svg')) return true;
    if (el.closest('[class*="icon"]') && (n.nodeValue || '').trim().length < 2) return true;
    return false;
  }

  function patchSenderLine(pane) {
    const scope = findFromScope(pane);
    if (scope) {
      const direct = scope.matches('[data-testid*="sender-address"]')
        ? scope
        : scope.querySelector('[data-testid*="sender-address"]');
      if (direct) {
        direct.textContent = MESSAGE_SENDER_FROM;
        direct.setAttribute('title', MESSAGE_SENDER_FROM);
      }
    }

    const header = pane.querySelector('[class*="message-header"]');
    if (!header) return;

    const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.nodeValue || isTextUnderSvgOrLockDecoration(n)) continue;
      const p = n.parentElement;
      if (p && p.closest('[class*="recipients"]')) continue;

      if (/\bClaude Team\b/.test(n.nodeValue)) {
        n.nodeValue = n.nodeValue.replace(/\bClaude Team\b/g, 'Anthropic');
        continue;
      }

      const t = n.nodeValue.trim();
      if (!t) continue;

      if (
        t.includes('zero-access') ||
        t.includes('encryption') ||
        /stored/i.test(t) ||
        /^from\s+stored/i.test(t)
      ) {
        n.nodeValue = MESSAGE_SENDER_STORAGE;
      }
    }
  }

  function patchOpenedMessage() {
    if (location.pathname !== TARGET_MESSAGE_PATH) return;

    const pane = readingPane();
    if (!pane) return;

    if (document.title !== MESSAGE_SUBJECT) {
      document.title = MESSAGE_SUBJECT;
    }

    try {
      patchSubjectLine(pane);
    } catch (e) {
      /* ignore */
    }
    try {
      patchSenderLine(pane);
    } catch (e) {
      /* ignore */
    }
    try {
      patchMessageBodyAll(pane);
    } catch (e) {
      /* ignore */
    }
  }

  let mo = null;
  let debounceTimer = null;

  function run() {
    if (mo) {
      mo.disconnect();
    }
    try {
      patchInboxList();
      patchOpenedMessage();
    } finally {
      if (mo) {
        mo.observe(document.documentElement, { childList: true, subtree: true });
      }
    }
  }

  function scheduleRun() {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      run();
    }, 120);
  }

  mo = new MutationObserver(() => {
    scheduleRun();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  run();
  window.setInterval(run, 4000);
})();
