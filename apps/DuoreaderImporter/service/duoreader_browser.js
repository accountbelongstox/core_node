// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');
const { getInstance } = require('#@singleton_browser');

const EXTRACT_TOC_SCRIPT = `(() => {
  const items = Array.from(document.querySelectorAll('.reader-structure-item'));
  return items.map((el, idx) => ({
    chapterIndex: idx,
    titleZh: (el.textContent || '').trim(),
    titleEn: (el.textContent || '').trim(),
  }));
})()`;

const EXTRACT_CHAPTER_SCRIPT = `(() => {
  const chapterTitle = (document.querySelector('.reader-chapter-title, h1.reader-chapter-title') || {}).innerText || '';
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
    if (en || zh) {
      paragraphs.push({ seq: idx, en, zh });
    }
  });
  return {
    chapterTitle: chapterTitle.trim(),
    paragraphCount: paragraphs.length,
    paragraphs,
  };
})()`;

const DISMISS_LANGUAGE_SHEET_SCRIPT = `(() => {
  const sheet = document.querySelector('ion-action-sheet');
  if (!sheet) {
    return { dismissed: false, reason: 'no_sheet' };
  }
  const zhBtn = Array.from(sheet.querySelectorAll('.action-sheet-button'))
    .find((btn) => (btn.textContent || '').trim() === '中文');
  if (zhBtn) {
    zhBtn.click();
    return { dismissed: true, reason: 'clicked_zh' };
  }
  const backdrop = document.querySelector('ion-backdrop');
  if (backdrop) {
    backdrop.click();
  }
  return { dismissed: true, reason: 'backdrop' };
})()`;

class DuoreaderBrowser {
    constructor(config) {
        this.config = config;
        this.browser = getInstance();
        this.page = null;
    }

    async initialize() {
        await this.browser.initialize();
        this.page = await this.browser.createPage();
        await this.page.setViewport({ width: 1400, height: 900 });
        return this.page;
    }

    async prepareSession() {
        const homeUrl = `${this.config.webBaseUrl}/home?utm_source=importer&tab=discover`;
        await this._goto(homeUrl);
        await this._sleep(2500);
        await this.page.evaluate(DISMISS_LANGUAGE_SHEET_SCRIPT);
        await this._sleep(1000);
        logger.info('[DuoreaderImporter] Browser session prepared (zh/en)');
    }

    async openBookToc(bookId) {
        const viewerUrl = `${this.config.webBaseUrl}/viewer/${bookId}?segmentIndex=0&articleIndex=0&paragraphIndex=0`;
        await this._goto(viewerUrl);
        await this._waitForChapterReady();
        await this.page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button'))
                .find((node) => (node.getAttribute('aria-label') || node.textContent || '').includes('Contents'));
            if (btn) {
                btn.click();
            }
        });
        await this._sleep(1200);
        const toc = await this.page.evaluate(EXTRACT_TOC_SCRIPT);
        await this.page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button'))
                .find((node) => (node.getAttribute('aria-label') || node.textContent || '').trim() === 'Close');
            if (btn) {
                btn.click();
            }
        });
        return Array.isArray(toc) ? toc : [];
    }

    async loadChapter(bookId, articleIndex, segmentIndex = 0) {
        const viewerUrl = `${this.config.webBaseUrl}/viewer/${bookId}?segmentIndex=${segmentIndex}&articleIndex=${articleIndex}&paragraphIndex=0`;
        await this._goto(viewerUrl);
        await this._waitForChapterReady();
        const chapter = await this.page.evaluate(EXTRACT_CHAPTER_SCRIPT);
        return {
            segmentIndex,
            articleIndex,
            chapterIndex: articleIndex,
            titleZh: chapter.chapterTitle || '',
            titleEn: chapter.chapterTitle || '',
            paragraphs: chapter.paragraphs || [],
            paragraphCount: chapter.paragraphCount || 0,
        };
    }

    async cleanup() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            await this.browser.cleanup();
        } catch (error) {
            logger.warn(`[DuoreaderImporter] Browser cleanup warning: ${error.message}`);
        }
    }

    async _waitForChapterReady() {
        const timeoutMs = Number(this.config.chapterLoadTimeoutMs) || 45000;
        await this.page.waitForFunction(
            `(() => {
                const paras = document.querySelectorAll('.reader-virtual-item--paragraph').length;
                const title = document.querySelector('.reader-chapter-title, h1');
                return paras > 0 || (title && (title.textContent || '').trim().length > 0);
            })()`,
            { timeout: timeoutMs },
        );
        await this._sleep(500);
    }

    async _goto(url) {
        const timeoutMs = Number(this.config.pageLoadTimeoutMs) || 60000;
        await this.page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: timeoutMs,
        });
    }

    async _sleep(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
}

module.exports = DuoreaderBrowser;
