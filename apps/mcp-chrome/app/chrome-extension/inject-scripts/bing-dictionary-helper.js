/**
 * Bing Dictionary Helper Content Script
 *
 * Extracts translation/phonetics/audio/images from Bing dictionary (必应词典,
 * cn.bing.com/dict). Two actions:
 *   - bingDictionarySearch: fill the on-page search box and click search
 *     (human-like; keeps the dictionary session/market context, unlike hitting
 *     the /dict/search?q= URL directly which can region-redirect to web search).
 *   - bingDictionaryFetchTranslation: extract the rendered result.
 *
 * pageType distinguishes a real dictionary page ('dict') from a non-dictionary
 * page ('non-dict', e.g. a region-redirected web-search result). The worker
 * only marks a word invalid on a confirmed 'dict' page with no entry — never on
 * 'non-dict', so a regional outage can't mass-invalidate the queue.
 */

(() => {
  console.log('[Bing Dictionary Helper] Content script loaded');

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  function findSearchInput() {
    return document.querySelector(
      '#sb_form_q, input[name="q"].b_searchbox, input.b_searchbox, input[name="q"], textarea[name="q"]',
    );
  }

  function findSearchButton() {
    return document.querySelector(
      '#sb_form_go, .b_searchboxSubmit, input[type="submit"][name="go"], button[type="submit"]',
    );
  }

  function isDictPage() {
    return !!document.querySelector('.lf_area, .qdef, .cdef, .df_div, .hd_div');
  }

  /**
   * Detect Bing dictionary's definitive "no entry" page. Bing renders either a
   * `.no_results` node or the copy "No results found for <word>" (followed by
   * "Search tips:"). This is a CONFIRMED dictionary response with no entry — the
   * word is genuinely invalid — distinct from a region-redirect / web-search
   * fallback. We surface it explicitly so the worker can mark the word invalid.
   */
  function detectNoEntry() {
    if (document.querySelector('.no_results')) return true;
    // Scope the text probe to the main content area so an unrelated page-chrome
    // string can't false-positive; fall back to body if the area isn't present.
    const area = document.querySelector('#content, .lf_area, #smt, .b_content') || document.body;
    const text = norm(area && area.textContent).slice(0, 4000);
    return /No results found for\b/i.test(text);
  }

  /**
   * Detect a "computer translation only" page (Bing's machine-translation
   * fallback, `.lf_area .smt_hw`) that has NO real dictionary entry (`.qdef`).
   * The reference scraper treats this exactly like a no-entry — the word has no
   * genuine Bing dictionary record (only an auto-translation), so it must be
   * marked invalid rather than re-queued forever. `.smt_hw` only appears when
   * there is no real entry, so requiring the absence of `.qdef` is just a guard.
   */
  function detectComputerTranslate() {
    return !!document.querySelector('.lf_area .smt_hw') && !document.querySelector('.qdef');
  }

  /**
   * Detect Bing's SOFT OUTAGE page — a normal 200 that loads fine but says Bing
   * is unavailable: "It's not you, it's us" / "Bing isn't available right now,
   * but everything should be back to normal very soon." Apostrophe-tolerant
   * (straight ' and curly ’). Caller MUST gate this on a NON-dict page so a real
   * dictionary entry whose example sentence happens to contain the phrase is
   * never mis-flagged.
   */
  function detectOutage() {
    const area = document.querySelector('#content, .lf_area, #smt, .b_content') || document.body;
    const text = norm(area && area.textContent).slice(0, 4000);
    return /It['’]s not you, it['’]s us|Bing isn['’]t available right now/i.test(text);
  }

  /**
   * Wait until the dictionary page has rendered one of its DEFINITIVE states —
   * a real entry (`.hd_div strong` / `.qdef`), a confirmed no-entry
   * (`.no_results`), or the machine-translation fallback (`.lf_area .smt_hw`) —
   * before extracting. Mirrors the reference scraper's translate_type() poll:
   * extracting too early (mid-render) is what made slow pages look like an empty
   * non-dict result and get wrongly retried. Resolves true once a state is seen,
   * false on timeout (extraction then proceeds best-effort).
   */
  function waitForResult(maxMs) {
    const probe = () =>
      document.querySelector('.hd_div strong, .qdef, .no_results, .lf_area .smt_hw');
    const W = getWebOps();
    if (W) {
      return W.waitFor(probe, { timeout: maxMs, interval: 150 }).then((v) => !!v);
    }
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

  function setNativeValue(el, value) {
    const proto =
      el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    el.focus();
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pressEnter(el) {
    const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  /** The shared human-sim library when present + responsive, else null. */
  function getWebOps() {
    const W = self.__WebOps;
    return W && typeof W._ping === 'function' && W._ping() === 'pong' ? W : null;
  }

  /**
   * Fill the search box with the word and submit it like a human would. Prefers
   * the shared WebOps lib (char-by-char humanType + humanClick on the search
   * button); falls back to the inline instant-set + click when WebOps is absent.
   */
  async function doSearch(word) {
    const input = findSearchInput();
    if (!input) {
      return { found: false, error: 'Bing search box not found on this page' };
    }
    const btn = findSearchButton();
    const W = getWebOps();
    if (W) {
      await W.humanType(input, word, { clear: true });
      if (btn) await W.humanClick(btn);
      else W.submitForm(input);
      return { found: true, navigating: true };
    }
    // Inline fallback (WebOps not injected): instant set + click.
    setNativeValue(input, word);
    if (btn) {
      btn.click();
    } else if (input.form) {
      input.form.submit();
    } else {
      pressEnter(input);
    }
    return { found: true, navigating: true };
  }

  function extractBingDictionaryData() {
    const result = {
      success: false,
      word: null,
      phonetics: [],
      translations: [],
      pluralForms: [],
      sampleImages: [],
      synonyms: [],
      advancedTranslations: [],
      detailedDefinitions: [],
      examples: [],
      voiceUrls: [],
      hasContent: false,
      // 'dict'  -> a real Bing dictionary page
      // 'non-dict' -> not a dictionary page (e.g. region-redirected web search)
      pageType: 'non-dict',
      // True only on a CONFIRMED Bing "No results found for <word>" page — a
      // definitive no-entry the worker should mark invalid (placeholder word).
      noEntry: false,
      // True on a machine-translation-only page (.lf_area .smt_hw, no .qdef) —
      // no real Bing dictionary entry; the worker marks it invalid too.
      computerTranslate: false,
      // True on Bing's SOFT OUTAGE page ("It's not you, it's us" / "Bing isn't
      // available right now"). A GLOBAL transient — the worker pauses 30s and
      // probes for recovery; words are NEVER invalidated by an outage.
      outage: false,
      error: null,
    };

    try {
      result.pageType = isDictPage() ? 'dict' : 'non-dict';

      const wordElement = document.querySelector('.hd_div strong');
      if (wordElement) {
        result.word = wordElement.textContent.trim();
      }

      // Bing SOFT OUTAGE: a non-dict page that says Bing is unavailable. Gated on
      // a NON-dict page so a real entry mentioning the phrase can't false-positive.
      // success=false + outage=true + pageType='non-dict' => classify maps it to a
      // transient 'error' (never 'invalid'); the worker enters 30s outage mode.
      if (result.pageType !== 'dict' && detectOutage()) {
        result.outage = true;
        result.hasContent = false;
        result.error = 'Bing outage / service unavailable';
        result.success = false;
        return result;
      }

      // A "No results found for <word>" page is a definitive dictionary no-entry
      // (keyword: "No results"). Treat it as a confirmed dict page with no entry
      // so the word is reported invalid — even though it lacks .qdef/.hd_div and
      // would otherwise be misread as a non-dict region redirect.
      if (detectNoEntry()) {
        result.pageType = 'dict';
        result.noEntry = true;
        result.hasContent = false;
        // NOT an error: a confirmed no-entry is a VALID, definitive answer
        // (the word is invalid). Keep `error` null so it is never mistaken for a
        // transport/extraction failure — `noEntry`/`noEntryReason` carry the
        // meaning, and the worker's classify() maps noEntry -> invalid.
        result.noEntryReason = 'No results found for this word';
        result.error = null;
        result.success = true;
        return result;
      }

      // A machine-translation-only page (.lf_area .smt_hw with no real .qdef
      // entry) means Bing has no genuine dictionary record — only an auto
      // translation. The reference scraper deletes such words; we report it as a
      // definitive no-entry (invalid) so it is not re-queued forever.
      if (detectComputerTranslate()) {
        result.pageType = 'dict';
        result.computerTranslate = true;
        result.hasContent = false;
        result.noEntryReason = 'Computer-translation only (no Bing dictionary entry)';
        result.error = null;
        result.success = true;
        return result;
      }

      // Resolve a possibly-relative media URL to an absolute one.
      const absUrl = (u) => {
        if (!u) return null;
        try {
          return new URL(u, location.origin).href;
        } catch (_) {
          return u;
        }
      };

      // Bing serves pronunciation audio via <a class="bigaud">; the mp3 link
      // lives in data-mp3link / href / or an onclick("...mp3") call, and is often
      // a RELATIVE path (/dict/mediamp3?...). Extract it from whichever is present.
      const mp3From = (a) => {
        if (!a) return null;
        let link = a.getAttribute('data-mp3link') || a.getAttribute('data-mp3') || a.getAttribute('href');
        const onclick = a.getAttribute('onclick') || '';
        if ((!link || link === 'javascript:void(0)') && onclick) {
          const m =
            onclick.match(/https?:\/\/[^'")]+\.mp3[^'")]*/i) ||
            onclick.match(/\/dict\/mediamp3[^'")]*/i);
          if (m) link = m[0];
        }
        return link && link !== 'javascript:void(0)' ? absUrl(link) : null;
      };
      const audioOf = (el) => {
        if (!el) return null;
        const a =
          el.matches && el.matches('a.bigaud, .bigaud')
            ? el
            : el.querySelector && el.querySelector('a.bigaud, .bigaud');
        return mp3From(a);
      };
      const pushVoice = (url) => {
        if (url && !result.voiceUrls.includes(url)) result.voiceUrls.push(url);
      };

      // Phonetics + audio. Bing's header shows US (.hd_prUS) and UK (.hd_pr)
      // phonetics, each followed by a .hd_tf wrapper with the speaker <a.bigaud>.
      // Collect them robustly: dedupe by element, classify by class/text, and as
      // a fallback zip the header's bigaud audios (in order) onto any phonetic
      // that didn't pair an audio — so we reliably get BOTH pronunciations.
      const labelEls = [];
      document.querySelectorAll('.hd_prUS, .hd_pr').forEach((el) => {
        if (el.closest('.hd_area, .hd_p1_1, .qdef') && !labelEls.includes(el)) labelEls.push(el);
      });
      labelEls.forEach((label, idx) => {
        const text = norm(label.textContent);
        if (!text) return;
        const isUS = label.classList.contains('hd_prUS') || /美|\bus\b/i.test(text) || idx === 0;
        let audioUrl = audioOf(label.nextElementSibling);
        if (!audioUrl && label.parentElement) {
          audioUrl = audioOf(label.parentElement.querySelector('.hd_tf'));
        }
        result.phonetics.push({ text, audioUrl, lang: isUS ? 'en-US' : 'en-GB' });
        pushVoice(audioUrl);
      });
      // Fallback: all header speaker links, in DOM order, zipped onto phonetics
      // missing an audio (covers layouts where the per-label pairing misses).
      const headerAuds = [];
      document
        .querySelectorAll('.hd_area a.bigaud, .hd_p1_1 a.bigaud, #bigaud_1, #bigaud_2, #bigaud_us, #bigaud_uk')
        .forEach((a) => {
          const u = mp3From(a);
          if (u && !headerAuds.includes(u)) headerAuds.push(u);
        });
      result.phonetics.forEach((p, i) => {
        if (!p.audioUrl && headerAuds[i]) p.audioUrl = headerAuds[i];
      });
      headerAuds.forEach(pushVoice);

      // Definitions: .qdef > ul > li, each li has a .pos (part of speech) + .def.
      document.querySelectorAll('.qdef > ul > li').forEach((li) => {
        const pos = li.querySelector('.pos');
        const def = li.querySelector('.def');
        const definition = norm((def || li).textContent);
        if (definition) {
          result.translations.push({
            partOfSpeech: norm(pos && pos.textContent) || '',
            definition,
          });
        }
      });

      // Inflected forms (plural / tense), when present.
      document.querySelectorAll('.qdef .hd_if, .hd_if').forEach((el) => {
        const text = norm(el.textContent);
        if (text) result.pluralForms.push(text);
      });

      // Sample images: under .img_area .simg; src is a real URL (some lazy-loaded).
      document.querySelectorAll('.img_area img, .simg img').forEach((img) => {
        const url = img.getAttribute('src') || img.getAttribute('data-src');
        if (url && !result.sampleImages.some((s) => s.url === absUrl(url))) {
          result.sampleImages.push({ url: absUrl(url), alt: img.alt || '' });
        }
      });

      // Sentence-level audio (example sentences), collected into voiceUrls.
      document.querySelectorAll('a.bdsen_audio.bigaud, .sen_en a.bigaud').forEach((a) => {
        pushVoice(audioOf(a));
      });

      // Synonyms / antonyms blocks (`.wd_div`).
      document.querySelectorAll('.wd_div .tb_div').forEach((div) => {
        const typeElement = div.querySelector('h2');
        const contentElement = div.nextElementSibling;
        if (typeElement && contentElement) {
          result.synonyms.push({
            type: norm(typeElement.textContent),
            words: norm(contentElement.textContent),
          });
        }
      });

      // Web definitions (`.df_div` — advanced E-C / web-meaning blocks).
      document.querySelectorAll('.df_div .tb_div').forEach((div) => {
        const typeElement = div.querySelector('h2');
        const contentElement = div.nextElementSibling;
        if (typeElement && contentElement) {
          result.advancedTranslations.push({
            type: norm(typeElement.textContent),
            content: norm(contentElement.textContent),
          });
        }
      });

      // Detailed Collins/Oxford definitions (`.se_lis` rows): Chinese gloss
      // (`.bil`) + English explanation (`.val`). This is the long-form data.
      document.querySelectorAll('.se_lis tr.def_row').forEach((row) => {
        const bil = row.querySelector('.bil');
        const val = row.querySelector('.val');
        const cn = norm(bil && bil.textContent);
        const en = norm(val && val.textContent);
        if ((cn || en) && result.detailedDefinitions.length < 30) {
          result.detailedDefinitions.push({ cn, en });
        }
      });

      // Example sentences: `.sen_en` (English) zipped with `.sen_cn` (Chinese).
      const senEn = document.querySelectorAll('.sen_en');
      const senCn = document.querySelectorAll('.sen_cn');
      for (let i = 0; i < senEn.length && result.examples.length < 20; i++) {
        const en = norm(senEn[i].textContent);
        const cn = senCn[i] ? norm(senCn[i].textContent) : '';
        if (en) result.examples.push({ en, cn });
      }

      result.hasContent =
        result.translations.length > 0 ||
        result.detailedDefinitions.length > 0 ||
        result.examples.length > 0 ||
        result.phonetics.length > 0 ||
        result.sampleImages.length > 0;

      if (result.pageType === 'dict' && !result.hasContent && !result.error) {
        result.error = 'No usable dictionary content for this word';
      }
      if (result.pageType !== 'dict' && !result.error) {
        result.error = 'Not a Bing dictionary page (region/redirect issue)';
      }

      result.success = true;
    } catch (error) {
      console.error('[Bing Dictionary Helper] Error extracting data:', error);
      result.error = error.message;
      result.success = false;
    }

    return result;
  }

  // --- In-page binary capture -------------------------------------------------
  // The image thumbnails (*.bing.net) and pronunciation audio (cn.bing.com/dict
  // /mediamp3) fail or look wrong when hot-linked from the extension popup
  // (referrer/CORS). Instead we fetch them HERE, inside the bing.com/dict page
  // (correct origin/referrer + cookies for same-origin audio), turn them into
  // base64 data URLs, and hand those back so the extension can cache + display
  // them directly without ever re-requesting the remote URL.

  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(typeof fr.result === 'string' ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  }

  async function fetchAsDataUrl(url) {
    if (!url) return null;
    try {
      // Default credentials = 'same-origin': audio (same origin) gets cookies,
      // cross-origin CDN images don't (keeps their ACAO:* response valid).
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      return await blobToDataUrl(await res.blob());
    } catch (_) {
      return null;
    }
  }

  // Canvas fallback for images the CDN won't let us fetch() but will draw.
  function imageToDataUrl(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (_) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function enrichWithBinaries(result) {
    // Images: first few only, fetch() then canvas-fallback.
    const imgs = (result.sampleImages || []).slice(0, 6);
    await Promise.all(
      imgs.map(async (img) => {
        let dataUrl = await fetchAsDataUrl(img.url);
        if (!dataUrl) dataUrl = await imageToDataUrl(img.url);
        if (dataUrl) img.dataUrl = dataUrl;
      }),
    );
    // Pronunciation audio (same-origin /dict/mediamp3).
    await Promise.all(
      (result.phonetics || []).map(async (p) => {
        if (p.audioUrl) {
          const dataUrl = await fetchAsDataUrl(p.audioUrl);
          if (dataUrl) p.audioDataUrl = dataUrl;
        }
      }),
    );
    return result;
  }

  if (self.__bingDictionaryHelperListenerAdded) {
    // Already registered in this page (re-injection guard) — don't add a second
    // onMessage listener, which would make every message get TWO sendResponse
    // calls ("message port closed before a response was received").
    return;
  }
  self.__bingDictionaryHelperListenerAdded = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Liveness probe. base-browser.injectContentScript sends `${toolName}_ping`
    // (300ms timeout) BEFORE every injection; a 'pong' tells it the script is
    // already loaded so it SKIPS re-injecting (avoids latency + a window where
    // messaging the not-yet-ready script throws "Could not establish
    // connection"). The Bing tool injects TWO files under one tool name, so pong
    // ONLY when this file is the injection target (or when no files are given,
    // for single-file callers).
    if (message && typeof message.action === 'string' && message.action.endsWith('_ping')) {
      const files = message.files;
      if (
        !Array.isArray(files) ||
        files.some((f) => typeof f === 'string' && f.includes('bing-dictionary-helper'))
      ) {
        sendResponse({ status: 'pong' });
        return true;
      }
      return; // probe is for the other co-injected file — let it answer.
    }
    if (message.action === 'bingDictionarySearch') {
      (async () => {
        try {
          sendResponse(await doSearch(message.word || ''));
        } catch (error) {
          sendResponse({ found: false, error: String(error && error.message) });
        }
      })();
      return true;
    }
    if (message.action === 'bingDictionaryFetchTranslation') {
      // Async: wait for a definitive render state, parse the DOM, then (only when
      // asked) fetch image/audio binaries in-page as base64.
      (async () => {
        try {
          // Don't extract a half-rendered page: wait for a real entry / no-entry
          // / machine-translation state first (mirrors the reference scraper).
          await waitForResult(typeof message.waitMs === 'number' ? message.waitMs : 8000);
          const data = extractBingDictionaryData();
          if (message.includeBinaries) {
            await enrichWithBinaries(data);
          }
          sendResponse(data);
        } catch (error) {
          sendResponse({ success: false, error: String(error && error.message) });
        }
      })();
      return true;
    }
  });

  console.log('[Bing Dictionary Helper] Message listener registered');
})();
