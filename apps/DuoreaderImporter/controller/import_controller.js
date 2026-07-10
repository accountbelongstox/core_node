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
const DuoreaderCatalog = require('../service/duoreader_catalog.js');
const DuoreaderBrowser = require('../service/duoreader_browser.js');
const PayloadBuilder = require('../service/payload_builder.js');
const LaravelIngestClient = require('../service/laravel_client.js');
const StateStore = require('../service/state_store.js');

class ImportController {
    constructor(config) {
        this.config = config;
        this.catalog = new DuoreaderCatalog(config);
        this.browser = new DuoreaderBrowser(config);
        this.payloadBuilder = new PayloadBuilder(config);
        this.laravelClient = new LaravelIngestClient(config);
        this.stateStore = new StateStore();
    }

    async start() {
        this.stateStore.load();
        const shelf = await this.catalog.loadShelf();
        const books = this.catalog.listBooks(shelf);
        logger.info(`[DuoreaderImporter] Found ${books.length} bilingual book(s) to process`);

        if (books.length === 0) {
            logger.warn('[DuoreaderImporter] No matching books in shelf.json');
            return;
        }

        await this.browser.initialize();
        await this.browser.prepareSession();

        for (const book of books) {
            if (this.stateStore.isBookCompleted(book.id)) {
                logger.info(`[DuoreaderImporter] Skip completed book: ${book.id}`);
                continue;
            }
            try {
                await this._importBook(book);
            } catch (error) {
                logger.error(`[DuoreaderImporter] Book failed (${book.id}): ${error.message}`);
            }
            await this._sleep(Number(this.config.delayBetweenBooksMs) || 2000);
        }

        await this.browser.cleanup();
    }

    async stop() {
        await this.browser.cleanup();
    }

    async _importBook(book) {
        logger.info(`[DuoreaderImporter] Importing book: ${book.id} (${book.titleEn})`);
        const toc = await this.browser.openBookToc(book.id);
        if (!toc.length) {
            throw new Error(`No TOC chapters found for ${book.id}`);
        }

        const sourceKey = this.payloadBuilder.sourceKeyForBook(book.id);
        let globalSeq = this.stateStore.getGlobalSeq(book.id);
        let ingestedSlots = 0;
        const bookState = this.stateStore.getBook(book.id);
        let sourceSent = !!(bookState && (bookState.chapters_done || []).length > 0);

        for (const tocItem of toc) {
            const chapterIndex = tocItem.chapterIndex;
            if (this.stateStore.isChapterDone(book.id, chapterIndex)) {
                logger.info(`[DuoreaderImporter] Skip chapter ${chapterIndex + 1}/${toc.length} (${book.id})`);
                continue;
            }

            const chapter = await this.browser.loadChapter(book.id, chapterIndex, 0);
            if (!chapter.paragraphs.length) {
                logger.warn(`[DuoreaderImporter] Empty chapter ${chapterIndex} for ${book.id}, skipping`);
                continue;
            }

            chapter.titleZh = chapter.titleZh || tocItem.titleZh || '';
            chapter.titleEn = chapter.titleEn || tocItem.titleEn || '';

            const chapterRow = {
                chapter_index: chapterIndex,
                sentence_count: chapter.paragraphs.length,
                titles: {
                    [this.config.learnLang]: chapter.titleEn || `Chapter ${chapterIndex + 1}`,
                    [this.config.myLang]: chapter.titleZh || `第${chapterIndex + 1}章`,
                },
            };

            const slots = this.payloadBuilder.buildSlotsForChapter(book, chapter, globalSeq);
            globalSeq += slots.length;

            const source = sourceSent
                ? { source_key: sourceKey }
                : this.payloadBuilder.buildSource({
                    ...book,
                    chapters: [{
                        chapterIndex,
                        titleZh: chapter.titleZh,
                        titleEn: chapter.titleEn,
                        paragraphs: chapter.paragraphs,
                    }],
                });

            const ingestResult = await this.laravelClient.ingestBookStreaming(
                source,
                [chapterRow],
                slots,
            );
            sourceSent = true;
            if (!ingestResult.ok) {
                throw new Error(ingestResult.errors.join('; '));
            }

            ingestedSlots += slots.length;
            this.stateStore.markChapterDone(book.id, chapterIndex, slots.length, sourceKey);
            this.stateStore.setGlobalSeq(book.id, globalSeq);
            logger.info(`[DuoreaderImporter] Chapter ${chapterIndex + 1}/${toc.length} ingested (${slots.length} slots)`);

            await this._sleep(Number(this.config.delayBetweenChaptersMs) || 800);
        }

        if (this.config.enableTtsEnrich) {
            logger.info(`[DuoreaderImporter] Requesting Laravel TTS enrich for ${book.id}`);
            const enrichLearn = await this.laravelClient.enrichAudio(this.config.learnLang);
            const enrichMy = await this.laravelClient.enrichAudio(this.config.myLang);
            if (!enrichLearn.ok || !enrichMy.ok) {
                logger.warn(`[DuoreaderImporter] TTS enrich incomplete for ${book.id}`);
            }
        }

        this.stateStore.markBookCompleted(book.id, sourceKey, toc.length, ingestedSlots);
        logger.info(`[DuoreaderImporter] Completed ${book.id}: ${ingestedSlots} slots, ${toc.length} chapters`);
    }

    async _sleep(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
}

module.exports = ImportController;
