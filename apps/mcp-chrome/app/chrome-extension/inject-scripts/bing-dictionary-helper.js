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

  /** Fill the search box with the word and submit it like a human would. */
  function doSearch(word) {
    const input = findSearchInput();
    if (!input) {
      return { found: false, error: 'Bing search box not found on this page' };
    }
    setNativeValue(input, word);
    const btn = findSearchButton();
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
      voiceUrls: [],
      hasContent: false,
      // 'dict'  -> a real Bing dictionary page
      // 'non-dict' -> not a dictionary page (e.g. region-redirected web search)
      pageType: 'non-dict',
      error: null,
    };

    try {
      result.pageType = isDictPage() ? 'dict' : 'non-dict';

      const wordElement = document.querySelector('.hd_div strong');
      if (wordElement) {
        result.word = wordElement.textContent.trim();
      }

      const noResultElement = document.querySelector('.no_results');
      if (noResultElement && result.pageType === 'dict') {
        result.error = 'No results found for this word';
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

      // Bing serves pronunciation audio via <a class="bigaud" data-mp3link="...">,
      // NOT <audio> tags, and the link is a RELATIVE path (/dict/mediamp3?blob=...).
      const audioOf = (el) => {
        if (!el) return null;
        const a =
          el.matches && el.matches('a.bigaud, .bigaud[data-mp3link]')
            ? el
            : el.querySelector && el.querySelector('a.bigaud, .bigaud[data-mp3link]');
        if (!a) return null;
        const link = a.getAttribute('data-mp3link') || a.getAttribute('href');
        return link && link !== 'javascript:void(0)' ? absUrl(link) : null;
      };
      const pushVoice = (url) => {
        if (url && !result.voiceUrls.includes(url)) result.voiceUrls.push(url);
      };

      // Phonetics + audio: each label (.hd_prUS / .hd_pr, both .b_primtxt) is
      // immediately followed by a .hd_tf wrapper holding the audio link.
      document.querySelectorAll('.hd_p1_1 .b_primtxt').forEach((label) => {
        const audioUrl = audioOf(label.nextElementSibling);
        result.phonetics.push({
          text: norm(label.textContent),
          audioUrl,
          lang: label.classList.contains('hd_prUS') ? 'en-US' : 'en-GB',
        });
        pushVoice(audioUrl);
      });
      // Belt-and-suspenders: grab the two headword audios by id if pairing missed them.
      pushVoice(audioOf(document.querySelector('#bigaud_us')));
      pushVoice(audioOf(document.querySelector('#bigaud_uk')));

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

      // Synonyms / antonyms blocks (best-effort; layout varies by word).
      document.querySelectorAll('.wd_div .tb_div, .df_div .tb_div').forEach((div) => {
        const typeElement = div.querySelector('h2');
        const contentElement = div.nextElementSibling;
        if (typeElement && contentElement) {
          result.synonyms.push({
            type: norm(typeElement.textContent),
            words: norm(contentElement.textContent),
          });
        }
      });

      result.hasContent =
        result.translations.length > 0 ||
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

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'bingDictionarySearch') {
      try {
        sendResponse(doSearch(message.word || ''));
      } catch (error) {
        sendResponse({ found: false, error: String(error && error.message) });
      }
      return true;
    }
    if (message.action === 'bingDictionaryFetchTranslation') {
      try {
        sendResponse(extractBingDictionaryData());
      } catch (error) {
        sendResponse({ success: false, error: String(error && error.message) });
      }
      return true;
    }
  });

  console.log('[Bing Dictionary Helper] Message listener registered');
})();
