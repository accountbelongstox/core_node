/**
 * Web search helper — extracts Google/Bing web & image results from live tabs.
 * DOM selectors last verified: 2026-07-11
 */
(() => {
  if (self.__webSearchHelperListenerAdded) {
    return;
  }
  self.__webSearchHelperListenerAdded = true;

  const LAST_VERIFIED = '2026-07-11';

  function pageHost() {
    return (location.hostname || '').toLowerCase();
  }

  function pageText() {
    return (document.body && document.body.innerText) || '';
  }

  function detectVerification() {
    const host = pageHost();
    const url = location.href || '';
    const text = pageText().toLowerCase();
    const reasons = [];

    if (url.includes('/sorry/') || url.includes('/challenge/') || /captcha/i.test(url)) {
      reasons.push('url');
    }
    if (document.querySelector('#recaptcha, iframe[src*="recaptcha"], .g-recaptcha, #captcha-form')) {
      reasons.push('recaptcha');
    }
    if (document.querySelector('#turnstile, iframe[src*="challenges.cloudflare"]')) {
      reasons.push('turnstile');
    }
    if (/unusual traffic|not a robot|verify you are human|before you continue to google/i.test(text)) {
      reasons.push('google_text');
    }
    if (/one last step|help us protect|automated requests/i.test(text)) {
      reasons.push('bing_text');
    }
    if (host.includes('google.') && document.title.toLowerCase().includes('sorry')) {
      reasons.push('google_title');
    }

    return {
      required: reasons.length > 0,
      reasons,
      host,
      url,
      title: document.title || '',
    };
  }

  function parseBingTileMeta(anchor) {
    const raw = anchor.getAttribute('m') || '';
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function extractBingImages(maxResults) {
    const out = [];
    const seen = new Set();
    const tiles = Array.from(document.querySelectorAll('a.iusc, a[data-m]'));
    for (const tile of tiles) {
      const meta = parseBingTileMeta(tile);
      const imageUrl = meta?.murl || meta?.turl || '';
      if (!imageUrl || seen.has(imageUrl)) continue;
      seen.add(imageUrl);
      const thumb = tile.querySelector('img');
      out.push({
        title: meta?.t || meta?.desc || (thumb && thumb.alt) || '',
        imageUrl,
        thumbnailUrl: (thumb && thumb.src) || meta?.turl || imageUrl,
        pageUrl: meta?.purl || tile.href || '',
        width: Number(meta?.exph || 0) || 0,
        height: Number(meta?.expw || 0) || 0,
        engine: 'bing',
      });
      if (out.length >= maxResults) break;
    }
    return out;
  }

  function extractGoogleImages(maxResults) {
    const out = [];
    const seen = new Set();
    const imgs = Array.from(document.querySelectorAll('img[src], img[data-src]'));
    for (const img of imgs) {
      const src = img.getAttribute('data-src') || img.src || '';
      if (!src || src.startsWith('data:') || seen.has(src)) continue;
      if (!/gstatic|googleusercontent|ggpht|encrypted/i.test(src) && !/\.(jpg|jpeg|png|webp)/i.test(src)) {
        continue;
      }
      seen.add(src);
      const link = img.closest('a[href]');
      out.push({
        title: img.alt || (link && link.getAttribute('aria-label')) || '',
        imageUrl: src,
        thumbnailUrl: src,
        pageUrl: (link && link.href) || location.href,
        width: Number(img.naturalWidth || img.width || 0) || 0,
        height: Number(img.naturalHeight || img.height || 0) || 0,
        engine: 'google',
      });
      if (out.length >= maxResults) break;
    }
    return out;
  }

  function extractBingWeb(maxResults) {
    const out = [];
    const seen = new Set();
    const rows = Array.from(document.querySelectorAll('li.b_algo, #b_results > li'));
    for (const row of rows) {
      const link = row.querySelector('h2 a, .b_title a, a[href]');
      if (!link || !link.href) continue;
      const url = link.href;
      if (seen.has(url)) continue;
      seen.add(url);
      const snippetNode = row.querySelector('.b_caption p, p, .b_lineclamp2, .b_lineclamp3, .b_lineclamp4');
      out.push({
        title: (link.textContent || '').trim(),
        url,
        snippet: snippetNode ? (snippetNode.textContent || '').trim() : '',
        engine: 'bing',
        mode: 'web',
      });
      if (out.length >= maxResults) break;
    }
    return out;
  }

  function extractGoogleWeb(maxResults) {
    const out = [];
    const seen = new Set();
    const blocks = Array.from(document.querySelectorAll('#search .g, #rso .g, div[data-sokoban-container]'));
    for (const block of blocks) {
      const link = block.querySelector('a[href^="http"] h3, a[href^="http"]');
      if (!link) continue;
      const anchor = link.closest('a[href^="http"]') || link;
      const url = anchor.href;
      if (!url || seen.has(url) || /google\./i.test(url)) continue;
      seen.add(url);
      const titleNode = block.querySelector('h3') || link;
      const snippetNode = block.querySelector('.VwiC3b, .IsZvec, .st, span[data-sncf]');
      out.push({
        title: (titleNode.textContent || '').trim(),
        url,
        snippet: snippetNode ? (snippetNode.textContent || '').trim() : '',
        engine: 'google',
        mode: 'web',
      });
      if (out.length >= maxResults) break;
    }
    return out;
  }

  function extract(mode, maxResults) {
    const verification = detectVerification();
    if (verification.required) {
      return {
        ok: false,
        status: 'verification_required',
        message: 'Search engine verification detected — solve CAPTCHA in the tab',
        verification,
        textResults: [],
        imageResults: [],
        lastVerified: LAST_VERIFIED,
      };
    }

    const host = pageHost();
    const isGoogle = host.includes('google.');
    const isBing = host.includes('bing.com');
    let textResults = [];
    let imageResults = [];

    if (mode === 'images') {
      imageResults = isBing
        ? extractBingImages(maxResults)
        : isGoogle
          ? extractGoogleImages(maxResults)
          : [];
    } else {
      textResults = isBing
        ? extractBingWeb(maxResults)
        : isGoogle
          ? extractGoogleWeb(maxResults)
          : [];
    }

    const hasResults = mode === 'images' ? imageResults.length > 0 : textResults.length > 0;
    return {
      ok: hasResults,
      status: hasResults ? 'ok' : 'no_results',
      message: hasResults ? 'Results extracted' : 'No results found on page',
      verification,
      textResults,
      imageResults,
      lastVerified: LAST_VERIFIED,
      pageUrl: location.href,
      pageTitle: document.title || '',
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && typeof message.action === 'string' && message.action.endsWith('_ping')) {
      if (typeof message.action === 'string' && message.action.includes('chrome_web_search')) {
        sendResponse({ status: 'pong' });
        return true;
      }
      return;
    }

    const run = async () => {
      switch (message.action) {
        case 'webSearchDetectVerification':
          sendResponse({ ok: true, ...detectVerification(), lastVerified: LAST_VERIFIED });
          break;
        case 'webSearchExtract': {
          const mode = message.mode === 'images' ? 'images' : 'web';
          const maxResults = Math.max(1, Math.min(30, Number(message.maxResults) || 10));
          sendResponse(extract(mode, maxResults));
          break;
        }
        default:
          sendResponse({ ok: false, error: `Unknown action: ${message.action}` });
      }
    };

    run().catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
    return true;
  });

  console.log('[WebSearch Helper] Listener registered (verified', LAST_VERIFIED + ')');
})();
