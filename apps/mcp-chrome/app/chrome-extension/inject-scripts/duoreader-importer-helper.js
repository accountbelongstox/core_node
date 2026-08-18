/**
 * Duoreader viewer helper — injected into web.duoreader.cn tabs.
 * Extracts bilingual chapter data via DOM; can fetch same-origin assets as binary.
 */
(() => {
  if (self.__duoreaderImporterHelperListenerAdded) {
    return;
  }
  self.__duoreaderImporterHelperListenerAdded = true;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms | 0)));

  async function waitForChapter(timeoutMs = 45000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const paras = document.querySelectorAll('.reader-virtual-item--paragraph').length;
      const title = document.querySelector('.reader-chapter-title, h1');
      const hasTitle = !!(title && (title.textContent || '').trim());
      if (paras > 0 || hasTitle) {
        return { ready: true, paragraphs: paras, hasTitle };
      }
      await sleep(400);
    }
    return { ready: false, paragraphs: 0, hasTitle: false };
  }

  function dismissLanguageSheet() {
    const sheet = document.querySelector('ion-action-sheet');
    if (!sheet) return { dismissed: false, reason: 'no_sheet' };
    const zhBtn = Array.from(sheet.querySelectorAll('.action-sheet-button'))
      .find((btn) => (btn.textContent || '').trim() === '中文');
    if (zhBtn) {
      zhBtn.click();
      return { dismissed: true, reason: 'clicked_zh' };
    }
    const backdrop = document.querySelector('ion-backdrop');
    if (backdrop) backdrop.click();
    return { dismissed: true, reason: 'backdrop' };
  }

  async function openTocPanel() {
    const btn = Array.from(document.querySelectorAll('button'))
      .find((node) => (node.getAttribute('aria-label') || node.textContent || '').includes('Contents'));
    if (btn) btn.click();
    await sleep(1200);
  }

  async function closeTocPanel() {
    const btn = Array.from(document.querySelectorAll('button'))
      .find((node) => (node.getAttribute('aria-label') || node.textContent || '').trim() === 'Close');
    if (btn) btn.click();
    await sleep(300);
  }

  function extractToc() {
    return Array.from(document.querySelectorAll('.reader-structure-item')).map((el, idx) => ({
      chapterIndex: idx,
      titleZh: (el.textContent || '').trim(),
      titleEn: (el.textContent || '').trim(),
    }));
  }

  function extractChapter() {
    const chapterTitle =
      (document.querySelector('.reader-chapter-title, h1.reader-chapter-title') || {}).innerText || '';
    const paragraphs = [];
    const items = Array.from(document.querySelectorAll('.reader-virtual-item--paragraph'));
    items.forEach((item, idx) => {
      const enBlocks = Array.from(item.querySelectorAll('.block.lang-en'))
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean);
      const zhBlocks = Array.from(item.querySelectorAll('.block.lang-zh'))
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean);
      const en = enBlocks.join(' ').trim();
      const zh = zhBlocks.join(' ').trim();
      if (en || zh) paragraphs.push({ seq: idx, en, zh });
    });
    return { chapterTitle: chapterTitle.trim(), paragraphCount: paragraphs.length, paragraphs };
  }

  /** Ask background service worker to XOR+decompress .pz bytes (WASM bzip2). */
  async function unpackPzBytes(bytes) {
    const resp = await chrome.runtime.sendMessage({
      type: 'duoreader_importer',
      action: 'unpack_pz',
      bytes,
    });
    if (!resp?.success) {
      return { ok: false, error: resp?.error || 'unpack_pz failed' };
    }
    return { ok: true, decoded: Uint8Array.from(resp.decoded || []), size: resp.size || 0 };
  }

  async function fetchBinary(url) {
    try {
      const resp = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` };
      const buf = await resp.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buf));
      const mime = resp.headers.get('content-type') || 'application/octet-stream';
      return { ok: true, mime, bytes, size: bytes.length };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && typeof message.action === 'string' && message.action.endsWith('_ping')) {
      const files = message.files;
      if (
        !Array.isArray(files) ||
        files.some((f) => typeof f === 'string' && f.includes('duoreader-importer-helper'))
      ) {
        sendResponse({ status: 'pong' });
        return true;
      }
      return;
    }

    const run = async () => {
      switch (message.action) {
        case 'duoreaderDismissLanguage':
          sendResponse(dismissLanguageSheet());
          break;
        case 'duoreaderWaitChapter':
          sendResponse(await waitForChapter(typeof message.timeoutMs === 'number' ? message.timeoutMs : 45000));
          break;
        case 'duoreaderExtractToc':
          await openTocPanel();
          sendResponse({ ok: true, items: extractToc() });
          await closeTocPanel();
          break;
        case 'duoreaderExtractChapter':
          sendResponse({ ok: true, chapter: extractChapter() });
          break;
        case 'duoreaderFetchBinary':
        case 'duoreaderApiFetchPz':
          sendResponse(await fetchBinary(message.url || ''));
          break;
        case 'duoreaderDecodePz': {
          const raw = await fetchBinary(message.url || '');
          if (!raw.ok) {
            sendResponse(raw);
            break;
          }
          const unpacked = await unpackPzBytes(raw.bytes);
          if (!unpacked.ok) {
            sendResponse({ ok: false, error: unpacked.error, rawSize: raw.size });
            break;
          }
          sendResponse({
            ok: true,
            decoded: unpacked.decoded,
            size: unpacked.size,
            rawSize: raw.size,
          });
          break;
        }
        case 'duoreaderApiTest': {
          const bookId = message.bookId || 'pride_and_prejudice';
          const myLang = message.myLang || 'zh';
          const learnLang = message.learnLang || 'en';
          const cdnBase = 'https://dl-public.xiangyin.mobi/multi_lang_read/';
          const bookUrl = `${cdnBase}${bookId}/book.pz`;
          const bookFetch = await fetchBinary(bookUrl);
          if (!bookFetch.ok) {
            sendResponse({ ok: false, error: bookFetch.error || 'book.pz fetch failed', bookUrl });
            break;
          }
          const bookUnpack = await unpackPzBytes(bookFetch.bytes);
          if (!bookUnpack.ok) {
            sendResponse({ ok: false, error: `book.pz decode failed: ${bookUnpack.error}`, bookUrl });
            break;
          }
          const bookDecoded = bookUnpack.decoded;
          const text = new TextDecoder('utf-8', { fatal: false }).decode(bookDecoded);
          const match = text.match(/part_(\d+)_art_(\d+)/);
          if (!match) {
            sendResponse({
              ok: false,
              error: 'No article ids in book.pz',
              bookPzBytes: bookFetch.size,
              bookUrl,
            });
            break;
          }
          const seg = Number(match[1]);
          const art = Number(match[2]);
          const articleUrl = `${cdnBase}${bookId}/article_part_${seg}_art_${art}__${myLang}_${learnLang}.pz`;
          const artFetch = await fetchBinary(articleUrl);
          if (!artFetch.ok) {
            sendResponse({ ok: false, error: artFetch.error, articleUrl, bookDecoded });
            break;
          }
          const artUnpack = await unpackPzBytes(artFetch.bytes);
          if (!artUnpack.ok) {
            sendResponse({
              ok: false,
              error: `article.pz decode failed: ${artUnpack.error}`,
              articleUrl,
              bookDecoded,
            });
            break;
          }
          const articleDecoded = artUnpack.decoded;
          sendResponse({
            ok: true,
            bookId,
            bookUrl,
            bookPzBytes: bookFetch.size,
            articleUrl,
            articlePzBytes: artFetch.size,
            sampleArticleId: `part_${seg}_art_${art}`,
            bookDecoded,
            articleDecoded,
          });
          break;
        }
        default:
          sendResponse({ ok: false, error: `Unknown action: ${message.action}` });
      }
    };

    run().catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
    return true;
  });

  console.log('[DuoreaderImporter Helper] Listener registered');
})();
