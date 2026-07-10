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

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class PayloadBuilder {
    constructor(config) {
        this.config = config;
        this.myLang = config.myLang || 'zh';
        this.learnLang = config.learnLang || 'en';
        this.primaryLang = this.learnLang;
        this.selectedLanguages = [this.learnLang, this.myLang];
    }

    sourceKeyForBook(bookId) {
        const digest = crypto.createHash('sha1').update(`duoreader:${bookId}`).digest('hex');
        return `duoreader_${digest.slice(0, 40)}`;
    }

    buildSource(bookMeta) {
        const titleEn = bookMeta.titleEn || bookMeta.id;
        const titleZh = bookMeta.titleZh || '';
        const sourceKey = this.sourceKeyForBook(bookMeta.id);
        const fullContentParts = [];

        for (const chapter of bookMeta.chapters || []) {
            for (const paragraph of chapter.paragraphs || []) {
                if (paragraph.en) {
                    fullContentParts.push(paragraph.en);
                }
                if (paragraph.zh) {
                    fullContentParts.push(paragraph.zh);
                }
            }
        }

        return {
            source_key: sourceKey,
            title: titleEn,
            original_name: `${bookMeta.id}.duoreader`,
            ascii_name: bookMeta.id,
            language: this.primaryLang,
            selected_languages: this.selectedLanguages,
            full_content: fullContentParts.join('\n'),
            metadata: {
                duoreader_id: bookMeta.id,
                provider: 'duoreader',
                titles: {
                    [this.learnLang]: titleEn,
                    [this.myLang]: titleZh,
                },
                author: {
                    [this.learnLang]: bookMeta.authorEn || '',
                    [this.myLang]: bookMeta.authorZh || '',
                },
                cover_url: bookMeta.coverUrl || '',
                section: {
                    [this.learnLang]: bookMeta.sectionTagEn || '',
                    [this.myLang]: bookMeta.sectionTagZh || '',
                },
                seeded_languages: this.selectedLanguages,
            },
        };
    }

    buildChapterRows(bookMeta) {
        const chapters = [];
        for (const chapter of bookMeta.chapters || []) {
            chapters.push({
                chapter_index: chapter.chapterIndex,
                sentence_count: (chapter.paragraphs || []).length,
                titles: {
                    [this.learnLang]: chapter.titleEn || chapter.titleZh || `Chapter ${chapter.chapterIndex + 1}`,
                    [this.myLang]: chapter.titleZh || chapter.titleEn || `第${chapter.chapterIndex + 1}章`,
                },
            });
        }
        return chapters;
    }

    buildSlots(bookMeta, globalSeqStart = 0) {
        const sourceKey = this.sourceKeyForBook(bookMeta.id);
        const slots = [];
        let globalSeq = globalSeqStart;

        for (const chapter of bookMeta.chapters || []) {
            for (const paragraph of chapter.paragraphs || []) {
                const langs = {};
                langs[this.learnLang] = paragraph.en || null;
                langs[this.myLang] = paragraph.zh || null;
                if (!langs[this.learnLang] && !langs[this.myLang]) {
                    continue;
                }
                slots.push({
                    chapter_index: chapter.chapterIndex,
                    grain: 'sentence',
                    seq: globalSeq,
                    corr_id: this._corrId(sourceKey, 'sentence', globalSeq),
                    primary_language: this.primaryLang,
                    langs,
                    metadata: {
                        duoreader_article_index: chapter.articleIndex,
                        duoreader_segment_index: chapter.segmentIndex || 0,
                        duoreader_paragraph_seq: paragraph.seq,
                    },
                });
                globalSeq += 1;
            }
        }
        return slots;
    }

    buildSlotsForChapter(bookMeta, chapter, globalSeqStart) {
        const partial = {
            id: bookMeta.id,
            chapters: [chapter],
        };
        return this.buildSlots(partial, globalSeqStart);
    }

    _corrId(sourceKey, grain, seq) {
        return crypto.createHash('sha1').update(`${sourceKey}|${grain}|${seq}`).digest('hex');
    }

    normalizeText(text) {
        return String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    contentId(text) {
        return crypto.createHash('md5').update(this.normalizeText(text)).digest('hex');
    }
}

module.exports = PayloadBuilder;
