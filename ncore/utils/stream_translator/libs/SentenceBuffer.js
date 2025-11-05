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

const { EventEmitter } = require('events');
const logger = require('./Logger.js');

class SentenceBuffer extends EventEmitter {
    constructor(id) {
        super();
        this.id = id;
        this.buffer = '';
        this.sentences = [];
        this.translations = [];
        this.codeBlockState = {
            inBlock: false,
            marker: null
        };
        this.multiLineCommentState = {
            inComment: false,
            type: null
        };
        this.isCodeContext = false;
        this.processedCount = 0;
        this.pendingOutput = [];
    }

    append(chunk) {
        this.buffer += chunk;
        this.processPendingSentences();
    }

    processPendingSentences() {
        let lines = this.buffer.split('\n');
        let i;

        if (lines.length <= 1) {
            return;
        }

        for (i = 0; i < lines.length - 1; i++) {
            const sentence = lines[i];
            this.addSentence(sentence);
        }

        this.buffer = lines[lines.length - 1];
    }

    addSentence(sentence) {
        const index = this.sentences.length;
        this.sentences.push(sentence);
        this.translations.push('');

        this.emit('sentenceReady', {
            id: this.id,
            index: index,
            sentence: sentence
        });
    }

    setTranslation(index, translation) {
        if (index >= 0 && index < this.translations.length) {
            this.translations[index] = translation;
            this.emit('translationReady', {
                id: this.id,
                index: index,
                translation: translation
            });
        }
    }

    flush() {
        if (this.buffer.length > 0) {
            this.addSentence(this.buffer);
            this.buffer = '';
        }
    }

    getFullText() {
        let result = [];
        let i;

        for (i = 0; i < this.sentences.length; i++) {
            result.push({
                index: i,
                original: this.sentences[i],
                translation: this.translations[i]
            });
        }

        return result;
    }

    getTranslationMap() {
        let map = {};
        let i;

        for (i = 0; i < this.sentences.length; i++) {
            if (this.translations[i]) {
                map[i] = {
                    original: this.sentences[i],
                    translation: this.translations[i]
                };
            }
        }

        return map;
    }

    getStreamOutput() {
        let output = [];
        let i;

        for (i = this.processedCount; i < this.sentences.length; i++) {
            const translation = this.translations[i];
            if (translation) {
                output.push(translation);
                this.processedCount = i + 1;
            } else {
                break;
            }
        }

        return output.join('\n');
    }

    hasUnprocessed() {
        return this.processedCount < this.sentences.length;
    }

    getTotalSentences() {
        return this.sentences.length;
    }

    getProcessedCount() {
        return this.processedCount;
    }

    clear() {
        this.buffer = '';
        this.sentences = [];
        this.translations = [];
        this.processedCount = 0;
        this.codeBlockState = {
            inBlock: false,
            marker: null
        };
        this.multiLineCommentState = {
            inComment: false,
            type: null
        };
        this.isCodeContext = false;
    }
}

module.exports = SentenceBuffer;
