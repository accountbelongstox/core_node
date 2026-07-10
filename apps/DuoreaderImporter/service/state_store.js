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
const globalDir = require('#@global_dir');

class StateStore {
    constructor() {
        this.stateDir = path.join(globalDir.rootdir, '.data', 'duoreader_importer');
        this.statePath = path.join(this.stateDir, 'state.json');
        this.state = { books: {}, global_slot_seq: {} };
    }

    load() {
        fs.mkdirSync(this.stateDir, { recursive: true });
        if (!fs.existsSync(this.statePath)) {
            this._save();
            return this.state;
        }
        try {
            const raw = fs.readFileSync(this.statePath, 'utf8');
            const parsed = JSON.parse(raw);
            this.state = {
                books: parsed.books || {},
                global_slot_seq: parsed.global_slot_seq || {},
            };
        } catch (error) {
            this.state = { books: {}, global_slot_seq: {} };
        }
        return this.state;
    }

    getBook(bookId) {
        return this.state.books[bookId] || null;
    }

    isBookCompleted(bookId) {
        const row = this.getBook(bookId);
        return !!(row && row.status === 'completed');
    }

    isChapterDone(bookId, chapterIndex) {
        const row = this.getBook(bookId);
        if (!row || !Array.isArray(row.chapters_done)) {
            return false;
        }
        return row.chapters_done.includes(chapterIndex);
    }

    markChapterDone(bookId, chapterIndex, slotsAdded, sourceKey) {
        const existing = this.getBook(bookId) || {
            status: 'in_progress',
            chapters_done: [],
            slots_ingested: 0,
            source_key: sourceKey || '',
            updated_at: null,
        };
        if (!existing.chapters_done.includes(chapterIndex)) {
            existing.chapters_done.push(chapterIndex);
            existing.chapters_done.sort((a, b) => a - b);
        }
        existing.slots_ingested = (existing.slots_ingested || 0) + slotsAdded;
        existing.source_key = sourceKey || existing.source_key;
        existing.status = 'in_progress';
        existing.updated_at = new Date().toISOString();
        this.state.books[bookId] = existing;
        this._save();
        return existing;
    }

    markBookCompleted(bookId, sourceKey, chapterCount, slotsIngested) {
        const existing = this.getBook(bookId) || {};
        this.state.books[bookId] = {
            ...existing,
            status: 'completed',
            source_key: sourceKey || existing.source_key || '',
            chapter_count: chapterCount,
            slots_ingested: slotsIngested,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        this._save();
    }

    getGlobalSeq(bookId) {
        return Number(this.state.global_slot_seq[bookId] || 0);
    }

    setGlobalSeq(bookId, seq) {
        this.state.global_slot_seq[bookId] = seq;
        this._save();
    }

    _save() {
        fs.mkdirSync(this.stateDir, { recursive: true });
        fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf8');
    }
}

module.exports = StateStore;
