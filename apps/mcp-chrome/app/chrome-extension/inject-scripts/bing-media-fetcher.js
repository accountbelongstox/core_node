/**
 * Bing Media Fetcher — injected class library (runs INSIDE cn.bing.com/dict).
 *
 * Why: the dictionary's image thumbnails (*.bing.net) and pronunciation audio
 * (cn.bing.com/dict/mediamp3) cannot be fetched directly from the extension
 * popup/background — wrong referrer/origin/cookies → broken image or 403. The
 * ONLY context allowed to read them is the dictionary page itself.
 *
 * This library is injected into that page and fetches each media URL there
 * (same-origin for audio; CORS/canvas for the CDN images), returning the RAW
 * BINARY as a plain number[] (each item a 0–255 byte) so it survives the
 * chrome.runtime JSON message bridge (ArrayBuffer/Uint8Array do not). The
 * extension then caches those numbers and rebuilds a data URL for display —
 * never re-requesting the remote URL itself.
 *
 * Message API (chrome.tabs.sendMessage):
 *   { action: 'bingDictionaryFetchMedia', urls: string[] }
 *     -> { ok: true, results: [{ url, ok, mime, bytes: number[] }] }
 */

(() => {
  const ACTION = 'bingDictionaryFetchMedia';

  class BingMediaFetcher {
    /** Guess a MIME type from the URL when the response omits one. */
    static guessMime(url) {
      const u = (url || '').toLowerCase();
      if (u.includes('.mp3') || u.includes('mediamp3')) return 'audio/mpeg';
      if (u.includes('.png')) return 'image/png';
      if (u.includes('.gif')) return 'image/gif';
      if (u.includes('.webp')) return 'image/webp';
      if (u.includes('.jpg') || u.includes('.jpeg')) return 'image/jpeg';
      return 'application/octet-stream';
    }

    static isImageUrl(url) {
      return /\.(png|jpe?g|gif|webp|bmp)\b/i.test(url || '') || /bing\.net/i.test(url || '');
    }

    /** ArrayBuffer -> plain number[] (0–255), JSON-message-safe. */
    static toByteArray(buffer) {
      const view = new Uint8Array(buffer);
      const out = new Array(view.length);
      for (let i = 0; i < view.length; i++) out[i] = view[i];
      return out;
    }

    /**
     * Fetch one URL as binary in the page context.
     * Strategy: fetch() -> arrayBuffer (works same-origin for audio and for CDN
     * images that send ACAO:*). If that fails for an image, fall back to drawing
     * it on a canvas and reading the bytes back via toBlob.
     */
    async fetchOne(url) {
      const fail = { url, ok: false, mime: null, bytes: [] };
      if (!url) return fail;

      try {
        // credentials default 'same-origin': audio (same origin) gets cookies;
        // cross-origin CDN images send none (keeps their ACAO:* valid).
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          if (buf && buf.byteLength > 0) {
            const mime = (res.headers.get('content-type') || '').split(';')[0].trim();
            return {
              url,
              ok: true,
              mime: mime || BingMediaFetcher.guessMime(url),
              bytes: BingMediaFetcher.toByteArray(buf),
            };
          }
        }
      } catch (_) {
        /* fall through to canvas for images */
      }

      if (BingMediaFetcher.isImageUrl(url)) {
        const viaCanvas = await this._imageToBytes(url);
        if (viaCanvas) return { url, ok: true, mime: 'image/png', bytes: viaCanvas };
      }
      return fail;
    }

    /** Canvas fallback: draw the image, read it back as PNG bytes. */
    _imageToBytes(url) {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            canvas.toBlob(async (blob) => {
              if (!blob) return resolve(null);
              try {
                const buf = await blob.arrayBuffer();
                resolve(BingMediaFetcher.toByteArray(buf));
              } catch (_) {
                resolve(null);
              }
            }, 'image/png');
          } catch (_) {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }

    /** Fetch many URLs in parallel; preserves order. */
    async fetchMany(urls) {
      const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
      return Promise.all(list.map((u) => this.fetchOne(u)));
    }
  }

  // Expose the class on the isolated-world window so other injected scripts
  // from this extension can reuse it without re-injecting.
  self.__BingMediaFetcher = BingMediaFetcher;

  // Register the message handler once (re-injection guard).
  if (!self.__bingMediaFetcherListenerAdded) {
    self.__bingMediaFetcherListenerAdded = true;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      // Liveness probe: base-browser.injectContentScript sends `${toolName}_ping`
      // before every injection. Answering 'pong' lets it SKIP re-injecting this
      // library. It shares the Bing dictionary tool name with the dictionary
      // helper, so pong ONLY when THIS file is the injection target (the probe
      // carries the file list) — otherwise the helper's probe would be answered
      // here and the helper would never get injected (and vice versa).
      if (message && typeof message.action === 'string' && message.action.endsWith('_ping')) {
        const files = message.files;
        if (
          !Array.isArray(files) ||
          files.some((f) => typeof f === 'string' && f.includes('bing-media-fetcher'))
        ) {
          sendResponse({ status: 'pong' });
          return true;
        }
        return; // probe is for the dictionary helper — let it answer.
      }
      if (!message || message.action !== ACTION) return; // not ours
      (async () => {
        try {
          const fetcher = new BingMediaFetcher();
          const results = await fetcher.fetchMany(message.urls || []);
          sendResponse({ ok: true, results });
        } catch (error) {
          sendResponse({ ok: false, error: String(error && error.message), results: [] });
        }
      })();
      return true; // async sendResponse
    });
    console.log('[Bing Media Fetcher] class library ready');
  }
})();
