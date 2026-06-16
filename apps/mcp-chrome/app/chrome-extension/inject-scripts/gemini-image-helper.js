/**
 * Gemini Image Helper Content Script
 *
 * Drives Google Gemini (gemini.google.com/app) to generate an image from a
 * prompt and capture the result as a base64 data URL — entirely inside the page
 * so the binary is fetched with the page's own origin/credentials (the rendered
 * image is usually a blob: or googleusercontent URL that the extension cannot
 * re-request directly).
 *
 * Actions (driven by the background GeminiImageTool):
 *   - chrome_gemini_image_ping   -> {status:'pong'} (so the base injector skips re-inject)
 *   - geminiSubmitPrompt {prompt}-> fill the chat box + send; {found, error}
 *   - geminiCollectImage         -> the latest generated image as a data URL:
 *                                   {ready, dataUrl, mime, src, width, height, generating, error}
 *
 * Selectors are intentionally redundant (Gemini's DOM is unstable / obfuscated);
 * each lookup tries several candidates and degrades gracefully.
 */

(() => {
  // Guard against duplicate injection re-registering listeners.
  if (window.__geminiImageHelperLoaded) {
    return;
  }
  window.__geminiImageHelperLoaded = true;
  console.log('[Gemini Image Helper] Content script loaded');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- Shadow-DOM-piercing query --------------------------------------------
  // Gemini is built from Angular web components (rich-textarea, gem-icon-button,
  // …) whose internals live in shadow roots, so a plain document.querySelector
  // misses them. deepQueryAll walks the document AND every open shadowRoot.
  function deepQueryAll(selectors, root) {
    const sels = Array.isArray(selectors) ? selectors : [selectors];
    const out = [];
    const seen = new Set();
    const visit = (node) => {
      if (!node || !node.querySelectorAll) return;
      for (const sel of sels) {
        let matches = [];
        try {
          matches = node.querySelectorAll(sel);
        } catch (_) {
          matches = [];
        }
        matches.forEach((el) => {
          if (!seen.has(el)) {
            seen.add(el);
            out.push(el);
          }
        });
      }
      // Descend into open shadow roots.
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

  const deepQueryOne = (selectors, root) => deepQueryAll(selectors, root)[0] || null;

  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // ---- Element lookups (resilient, multi-selector, shadow-piercing) ---------

  function findPromptInput() {
    return deepQueryOne([
      'rich-textarea .ql-editor[contenteditable="true"]',
      'div.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[aria-label]',
      'textarea',
    ]);
  }

  function findSendButton() {
    const direct = deepQueryAll([
      'button.send-button',
      'button[aria-label*="Send" i]',
      'button[mattooltip*="Send" i]',
      'button[aria-label*="发送" i]',
      'gem-icon-button[aria-label*="Send" i] button',
      'gem-icon-button[aria-label*="发送" i] button',
    ]).find((el) => el && !el.disabled && isVisible(el));
    if (direct) return direct;
    // Fallback: a button wrapping a "send" icon (mat-icon fonticon="send").
    const icons = deepQueryAll([
      'button mat-icon',
      'button .material-icons',
      'button .material-symbols-outlined',
      'gem-icon-button mat-icon',
    ]);
    for (const ic of icons) {
      const txt = (ic.getAttribute('fonticon') || ic.textContent || '').toLowerCase();
      if (txt.includes('send')) {
        const btn = ic.closest('button');
        if (btn && !btn.disabled && isVisible(btn)) return btn;
      }
    }
    return null;
  }

  function setEditorText(el, text) {
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    // contenteditable (Quill): replace content + fire input so the framework
    // model updates and the Send button enables.
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
  }

  function pressEnter(el) {
    const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  async function submitPrompt(prompt) {
    const input = findPromptInput();
    if (!input) {
      return { found: false, error: 'Gemini prompt input not found (login or DOM change?)' };
    }
    setEditorText(input, prompt);
    // Let the framework register the new value so the send button enables.
    await sleep(250);
    const btn = findSendButton();
    if (btn) {
      btn.click();
    } else {
      pressEnter(input);
    }
    return { found: true };
  }

  // ---- Generated-image detection + in-page binary capture -------------------

  /**
   * True while Gemini is still producing the image. Detected by the Stop button
   * OR the status copy Gemini shows during image generation. Gemini's UI may be
   * English ("Creating your image", "Generating image") or Chinese — match both
   * so the poll loop keeps waiting instead of giving up early.
   */
  function isGenerating() {
    const byEl =
      deepQueryAll([
        'button[aria-label*="Stop" i]',
        'button.stop',
        '[aria-label*="正在生成" i]',
        '.response-loading',
        '.generating',
        'gem-icon-button[aria-label*="Stop" i]',
      ]).length > 0;
    if (byEl) return true;
    const txt = (document.body && document.body.innerText) || '';
    return /Creating your image|Generating image|Creating image|Generating your image|正在生成图片|正在创建图片|正在生成图像|正在生成|图片生成中/i.test(
      txt,
    );
  }

  /**
   * Find the most recent generated image in the conversation. Prefers <img>
   * inside a model response / generated-image container, large enough to be a
   * real picture (not an avatar/icon), and fully loaded. Shadow-DOM aware.
   */
  function findLatestImage() {
    let candidates = deepQueryAll([
      'generated-image img',
      'single-image img',
      'image-element img',
      '.model-response-text img',
      'message-content img',
      'div[data-test-id] img',
    ]);
    if (candidates.length === 0) {
      // Fallback: any reasonably large image with a blob/data/googleusercontent src.
      candidates = deepQueryAll('img').filter((img) => {
        const src = img.currentSrc || img.src || '';
        return (
          src.startsWith('blob:') ||
          src.startsWith('data:image') ||
          src.includes('googleusercontent') ||
          src.includes('lh3.google')
        );
      });
    }
    // Keep loaded, large images; the LAST one is the newest response.
    const usable = candidates.filter((img) => {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      const src = img.currentSrc || img.src || '';
      return w >= 200 && h >= 200 && !!src;
    });
    return usable.length ? usable[usable.length - 1] : null;
  }

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
    if (url.startsWith('data:')) return url;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      return await blobToDataUrl(await res.blob());
    } catch (_) {
      return null;
    }
  }

  // Canvas fallback for images fetch() can't read but the browser can draw.
  function imageToDataUrl(img) {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function collectImage() {
    const img = findLatestImage();
    if (!img) {
      return { ready: false, generating: isGenerating(), error: null };
    }
    const src = img.currentSrc || img.src || '';
    let dataUrl = await fetchAsDataUrl(src);
    if (!dataUrl) dataUrl = await imageToDataUrl(img);
    if (!dataUrl) {
      return { ready: false, generating: isGenerating(), src, error: 'Image found but could not be captured' };
    }
    const mimeMatch = /^data:([^;,]+)[;,]/.exec(dataUrl);
    return {
      ready: true,
      dataUrl,
      mime: mimeMatch ? mimeMatch[1] : 'image/png',
      src,
      width: img.naturalWidth || img.width || 0,
      height: img.naturalHeight || img.height || 0,
      generating: false,
      error: null,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'chrome_gemini_image_ping') {
      sendResponse({ status: 'pong' });
      return true;
    }
    if (message.action === 'geminiSubmitPrompt') {
      submitPrompt(String(message.prompt || ''))
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ found: false, error: String(e && e.message) }));
      return true;
    }
    if (message.action === 'geminiCollectImage') {
      collectImage()
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ ready: false, error: String(e && e.message) }));
      return true;
    }
  });

  console.log('[Gemini Image Helper] Message listener registered');
})();
