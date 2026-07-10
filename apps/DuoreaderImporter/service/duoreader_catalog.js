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

const https = require('https');
const http = require('http');

class DuoreaderCatalog {
    constructor(config) {
        this.config = config;
    }

    async loadShelf() {
        const shelfUrl = this.config.shelfUrl;
        const raw = await this._fetchText(shelfUrl);
        const data = JSON.parse(raw);
        return data;
    }

    listBooks(shelfData) {
        const myLang = this.config.myLang;
        const learnLang = this.config.learnLang;
        const skipSet = new Set(this.config.skipBookIds || []);
        const allowSet = new Set(this.config.bookIds || []);
        const hasAllowList = allowSet.size > 0;
        const books = [];

        for (const section of shelfData.sections || []) {
            for (const book of section.books || []) {
                if (!book || !book.id) {
                    continue;
                }
                if (skipSet.has(book.id)) {
                    continue;
                }
                if (hasAllowList && !allowSet.has(book.id)) {
                    continue;
                }
                const langs = book.langs || [];
                if (!langs.includes(myLang) || !langs.includes(learnLang)) {
                    continue;
                }
                books.push({
                    id: book.id,
                    titleEn: book.title?.en || book.title?.[learnLang] || book.id,
                    titleZh: book.title?.zh || book.title?.[myLang] || '',
                    authorEn: book.author?.name?.en || book.author?.en || '',
                    authorZh: book.author?.name?.zh || book.author?.zh || '',
                    coverUrl: book.coverUrl || '',
                    sectionTagEn: section.tag_name?.en || '',
                    sectionTagZh: section.tag_name?.zh || '',
                    langs,
                });
            }
        }

        const maxBooks = Number(this.config.maxBooks) || 0;
        if (maxBooks > 0) {
            return books.slice(0, maxBooks);
        }
        return books;
    }

    _fetchText(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            const req = client.get(url, (res) => {
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                    res.resume();
                    return;
                }
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            });
            req.on('error', reject);
            req.setTimeout(60000, () => {
                req.destroy(new Error(`Timeout fetching ${url}`));
            });
        });
    }
}

module.exports = DuoreaderCatalog;
