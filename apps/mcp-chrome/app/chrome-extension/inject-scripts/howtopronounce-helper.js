/**
 * HowToPronounce Helper Content Script
 *
 * Extracts pronunciation audio URLs + IPA + phonetic spelling + wiki/sentences
 * from a zh.howtopronounce.com/<word> page. Two actions:
 *   - htpSearch: fill the on-page search box (#searchDropdown) and submit, used
 *     only as a fallback when a direct /<word> navigation does not resolve.
 *   - htpFetchPronunciation: parse the rendered result.
 *
 * AUDIO BYTE CAPTURE HAPPENS IN THE BACKGROUND, NOT HERE. howtopronounce serves
 * mp3s from a cross-origin CDN (en-audio.howtopronounce.com) that sends NO
 * Access-Control-Allow-Origin header, so an in-page fetch() is CORS-blocked
 * (unlike Bing's same-origin /dict/mediamp3). The extension background holds
 * <all_urls> host permission, so IT fetches the mp3 bytes cross-origin. This
 * helper only collects the URLs (from JSON-LD + <audio> tags) + metadata and
 * hands them back; the background downloads + base64-encodes the chosen clips.
 *
 * Modeled on bing-dictionary-helper.js (IIFE + load-guard + _ping handshake +
 * onMessage listener). Reuses self.__WebOps for the search-box fallback path.
 */

(() => {
  console.log('[HowToPronounce Helper] Content script loaded');

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  function findSearchInput() {
    return document.querySelector('#searchDropdown, input[ng-model="pronounceSearchText"], input[type="text"][autofocus]');
  }

  function findSearchButton() {
    return document.querySelector('button[ng-click*="pronounceSearch"], button[ng-click*="searchPronounce"], #searchPronounce, button[type="submit"]');
  }

  /** The shared human-sim library when present + responsive, else null. */
  function getWebOps() {
    const W = self.__WebOps;
    return W && typeof W._ping === 'function' && W._ping() === 'pong' ? W : null;
  }

  function setNativeValue(el, value) {
    const proto = window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    el.focus();
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pressEnter(el) {
    const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  /**
   * Fill the search box and submit (fallback path). howtopronounce is an
   * AngularJS app bound to ng-model="pronounceSearchText"; setting the value
   * + dispatching input updates the scope, then submit/Enter triggers search.
   */
  async function doSearch(word) {
    const input = findSearchInput();
    if (!input) {
      return { found: false, error: 'HowToPronounce search box not found on this page' };
    }
    const btn = findSearchButton();
    const W = getWebOps();
    if (W) {
      await W.humanType(input, word, { clear: true });
      if (btn) await W.humanClick(btn);
      else W.submitForm(input);
      return { found: true, navigating: true };
    }
    setNativeValue(input, word);
    if (btn) btn.click();
    else if (input.form) input.form.submit();
    else pressEnter(input);
    return { found: true, navigating: true };
  }

  /**
   * Collect pronunciation audio URLs from the page. Primary source is the
   * JSON-LD <script type="application/ld+json"> blocks, whose top-level object
   * has an `audio` array of AudioObject {contentUrl, name, description}. The
   * description is "Pronounciation of <word> in <lang> by <contributor>".
   * Fallback: <audio> src / <source> src elements. Deduped by URL, order kept
   * (howtopronounce lists highest-voted pronunciations first).
   */
  function collectAudioUrls() {
    const out = [];
    const seen = new Set();
    const push = (url, description) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push({ url, description: description || '' });
    };
    // JSON-LD blocks (authoritative + carry the contributor description).
    document.querySelectorAll('script[type="application/ld+json"]').forEach((node) => {
      const raw = node.textContent || '';
      if (!raw.includes('contentUrl')) return; // quick filter
      try {
        const data = JSON.parse(raw);
        const arr = Array.isArray(data?.audio) ? data.audio : [];
        arr.forEach((a) => {
          if (a && typeof a.contentUrl === 'string') push(a.contentUrl, a.description || a.name || '');
        });
      } catch (_) {
        /* not JSON or not the audio block - skip */
      }
    });
    // Fallback: <audio> / <source> elements.
    document.querySelectorAll('audio').forEach((el) => {
      const src = el.currentSrc || el.getAttribute('src') || '';
      if (src) push(src, el.getAttribute('aria-label') || '');
      el.querySelectorAll('source').forEach((s) => {
        const u = s.getAttribute('src') || '';
        if (u) push(u, '');
      });
    });
    return out;
  }

  /**
   * Extract the IPA + phonetic spelling from the rendered page. howtopronounce
   * renders these inside a `.phonetic-box`; the IPA label ("IPA:") and the
   * phonetic-spelling label ("Phonetic Spelling:") are siblings. Best-effort:
   * grab the .phonetic-box text and split on the labels.
   */
  function extractPhonetics() {
    let ipa = '';
    let phoneticSpelling = '';
    const box = document.querySelector('.phonetic-box');
    const text = norm(box ? box.textContent : '');
    if (text) {
      // "IPA: sˈɜːtʃ Phonetic Spelling: surch(en-us)" style.
      const ipaMatch = text.match(/IPA:\s*([^\n]*?)(\s+Phonetic Spelling:|$)/i);
      if (ipaMatch) ipa = norm(ipaMatch[1]);
      const spellMatch = text.match(/Phonetic Spelling:\s*(.+)$/i);
      if (spellMatch) phoneticSpelling = norm(spellMatch[1]);
    }
    // Fallback: scan the IPA section heading area for an IPA-looking token.
    if (!ipa) {
      const headings = document.querySelectorAll('h2, h3, h4');
      for (const h of headings) {
        if (/IPA|国际音标|语音发音/.test(h.textContent)) {
          const sib = h.parentElement?.textContent || '';
          const m = sib.match(/IPA:\s*([^\n]*?)(\s+Phonetic|$)/i);
          if (m) { ipa = norm(m[1]); break; }
        }
      }
    }
    return { ipa, phoneticSpelling };
  }

  function extractWiki() {
    const wiki = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="wikipedia.org"]').forEach((a) => {
      const href = a.href;
      if (href && !seen.has(href)) {
        seen.add(href);
        wiki.push(href);
      }
    });
    return wiki.slice(0, 8);
  }

  function extractSentences() {
    // Best-effort: howtopronounce renders example sentences in a sentences
    // section; the English text + a speaker icon. We grab sentence-like text
    // nodes from the main content. Keep it cheap + tolerant of DOM changes.
    const out = [];
    const seen = new Set();
    document.querySelectorAll('.sentence, .example-sentence, [class*="sentence"]').forEach((el) => {
      const en = norm(el.textContent);
      if (en && en.length > 8 && !seen.has(en) && out.length < 10) {
        seen.add(en);
        out.push({ en });
      }
    });
    return out;
  }

  function extractWord() {
    // JSON-LD mainEntity.name or the visible headword heading.
    const ld = document.querySelector('script[type="application/ld+json"]');
    if (ld) {
      try {
        const data = JSON.parse(ld.textContent || '');
        const name = data?.mainEntity?.name || data?.name;
        if (typeof name === 'string' && name.trim()) return name.trim();
      } catch (_) {}
    }
    const h = document.querySelector('h1, h2.word, .pronounce-word');
    return h ? norm(h.textContent) : null;
  }

  /**
   * Wait until the page has rendered either pronunciation audio (JSON-LD or
   * <audio>) or a phonetic box - the signals a real result is present. Resolves
   * true once a signal is seen, false on timeout (extraction then proceeds
   * best-effort).
   */
  function waitForResult(maxMs) {
    const probe = () =>
      document.querySelector('.phonetic-box') ||
      document.querySelector('audio') ||
      document.querySelector('script[type="application/ld+json"]');
    const W = getWebOps();
    if (W) return W.waitFor(probe, { timeout: maxMs, interval: 150 }).then((v) => !!v);
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (probe()) return resolve(true);
        if (Date.now() - start >= maxMs) return resolve(false);
        setTimeout(check, 150);
      };
      check();
    });
  }

  function extractHowToPronounceData() {
    const result = {
      success: false,
      word: null,
      audio: [],
      ipa: '',
      phoneticSpelling: '',
      wiki: [],
      sentences: [],
      hasContent: false,
      error: null,
    };
    try {
      result.word = extractWord();
      result.audio = collectAudioUrls();
      const ph = extractPhonetics();
      result.ipa = ph.ipa;
      result.phoneticSpelling = ph.phoneticSpelling;
      result.wiki = extractWiki();
      result.sentences = extractSentences();
      result.hasContent =
        result.audio.length > 0 || !!result.ipa || !!result.phoneticSpelling || result.wiki.length > 0;
      if (!result.hasContent) {
        result.error = 'No pronunciation content found on this page';
      }
      result.success = result.hasContent;
    } catch (error) {
      console.error('[HowToPronounce Helper] Error extracting data:', error);
      result.error = error.message;
      result.success = false;
    }
    return result;
  }

  if (self.__howToPronounceHelperListenerAdded) {
    // Already registered (re-injection guard) - don't add a second listener.
    return;
  }
  self.__howToPronounceHelperListenerAdded = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Liveness probe (see bing-dictionary-helper.js): pong ONLY when this file
    // is the injection target.
    if (message && typeof message.action === 'string' && message.action.endsWith('_ping')) {
      const files = message.files;
      if (
        !Array.isArray(files) ||
        files.some((f) => typeof f === 'string' && f.includes('howtopronounce-helper'))
      ) {
        sendResponse({ status: 'pong' });
        return true;
      }
      return;
    }
    if (message.action === 'htpSearch') {
      (async () => {
        try {
          sendResponse(await doSearch(message.word || ''));
        } catch (error) {
          sendResponse({ found: false, error: String(error && error.message) });
        }
      })();
      return true;
    }
    if (message.action === 'htpFetchPronunciation') {
      (async () => {
        try {
          await waitForResult(typeof message.waitMs === 'number' ? message.waitMs : 8000);
          sendResponse(extractHowToPronounceData());
        } catch (error) {
          sendResponse({ success: false, error: String(error && error.message) });
        }
      })();
      return true;
    }
  });

  console.log('[HowToPronounce Helper] Message listener registered');
})();
