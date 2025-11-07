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
const SentenceBuffer = require('./SentenceBuffer.js');
const CodeDetector = require('./CodeDetector.js');
const TranslatorAPI = require('./TranslatorAPI.js');
const TriggerWordsDetector = require('./TriggerWordsDetector.js');
const config = require('../config/index.js');
const logger = require('./Logger.js');

class StreamTranslatorManager extends EventEmitter {
    constructor() {
        super();
        this.sessions = new Map();
        this.codeDetector = new CodeDetector();
        this.translatorAPI = new TranslatorAPI();
        this.triggerDetectors = new Map();
        this.maxCacheSize = config.maxCacheSize;
    }

    createSession(id, options = {}) {
        if (this.sessions.has(id)) {
            return this.sessions.get(id);
        }

        const buffer = new SentenceBuffer(id);

        buffer.on('sentenceReady', async (data) => {
            await this.processSentence(data);
        });

        buffer.on('translationReady', (data) => {
            this.emit('translationReady', data);
        });

        this.sessions.set(id, buffer);

        if (options.triggerWords) {
            const triggerDetector = new TriggerWordsDetector(options.triggerWords);
            this.triggerDetectors.set(id, triggerDetector);
        } else {
            const triggerDetector = new TriggerWordsDetector();
            this.triggerDetectors.set(id, triggerDetector);
        }

        if (this.sessions.size > this.maxCacheSize) {
            this.cleanupOldSessions();
        }

        return buffer;
    }

    async processSentence(data) {
        const buffer = this.sessions.get(data.id);
        if (!buffer) {
            return;
        }

        const sentence = data.sentence;
        const index = data.index;

        const triggerDetector = this.triggerDetectors.get(data.id);
        let triggerCheckPassed = true;

        if (triggerDetector && triggerDetector.isEnabled()) {
            triggerCheckPassed = triggerDetector.checkContext(buffer.sentences);
            if (!triggerCheckPassed) {
                buffer.setTranslation(index, sentence);
                return;
            }
        }

        const commentInfo = this.codeDetector.detectCommentType(sentence);
        const isInCodeBlock = this.codeDetector.isInCodeBlock(sentence, buffer.codeBlockState);

        if (!buffer.isCodeContext) {
            buffer.isCodeContext = this.codeDetector.isCodeContext(buffer.sentences);
        }

        const context = {
            isCodeContext: buffer.isCodeContext,
            inCodeBlock: isInCodeBlock,
            isComment: commentInfo.isComment
        };

        const shouldTranslate = this.codeDetector.shouldTranslate(sentence, context);

        if (shouldTranslate && triggerCheckPassed) {
            try {
                const translation = await this.translatorAPI.translate(sentence);
                buffer.setTranslation(index, translation);
            } catch (error) {
                logger.error('Translation error for ID ' + data.id + ': ' + error.message);
                buffer.setTranslation(index, sentence);
            }
        } else {
            buffer.setTranslation(index, sentence);
        }
    }

    appendData(id, chunk) {
        const buffer = this.createSession(id);
        buffer.append(chunk);
    }

    flushSession(id) {
        const buffer = this.sessions.get(id);
        if (buffer) {
            buffer.flush();
        }
    }

    getFullText(id) {
        const buffer = this.sessions.get(id);
        if (buffer) {
            return buffer.getFullText();
        }
        return [];
    }

    getTranslationMap(id) {
        const buffer = this.sessions.get(id);
        if (buffer) {
            return buffer.getTranslationMap();
        }
        return {};
    }

    getStreamOutput(id) {
        const buffer = this.sessions.get(id);
        if (buffer) {
            return buffer.getStreamOutput();
        }
        return '';
    }

    hasUnprocessed(id) {
        const buffer = this.sessions.get(id);
        if (buffer) {
            return buffer.hasUnprocessed();
        }
        return false;
    }

    getSessionInfo(id) {
        const buffer = this.sessions.get(id);
        if (buffer) {
            return {
                id: id,
                totalSentences: buffer.getTotalSentences(),
                processedCount: buffer.getProcessedCount(),
                isCodeContext: buffer.isCodeContext,
                inCodeBlock: buffer.codeBlockState.inBlock
            };
        }
        return null;
    }

    getAllSessions() {
        const sessions = [];
        let iterator = this.sessions.keys();
        let current = iterator.next();

        while (!current.done) {
            const id = current.value;
            sessions.push(this.getSessionInfo(id));
            current = iterator.next();
        }

        return sessions;
    }

    clearSession(id) {
        const buffer = this.sessions.get(id);
        if (buffer) {
            buffer.clear();
            this.sessions.delete(id);
        }

        const triggerDetector = this.triggerDetectors.get(id);
        if (triggerDetector) {
            this.triggerDetectors.delete(id);
        }
    }

    cleanupOldSessions() {
        const entries = Array.from(this.sessions.entries());
        const toRemove = Math.floor(entries.length * 0.2);
        let i;

        for (i = 0; i < toRemove && i < entries.length; i++) {
            this.sessions.delete(entries[i][0]);
        }

        logger.info('Cleaned up ' + toRemove + ' old translation sessions');
    }

    clearAllSessions() {
        this.sessions.clear();
        this.triggerDetectors.clear();
    }

    setTriggerWords(id, words) {
        let triggerDetector = this.triggerDetectors.get(id);
        if (!triggerDetector) {
            triggerDetector = new TriggerWordsDetector();
            this.triggerDetectors.set(id, triggerDetector);
        }
        triggerDetector.setTriggerWords(words);
    }

    addTriggerWord(id, word) {
        let triggerDetector = this.triggerDetectors.get(id);
        if (!triggerDetector) {
            triggerDetector = new TriggerWordsDetector();
            this.triggerDetectors.set(id, triggerDetector);
        }
        triggerDetector.addTriggerWord(word);
    }

    enableTriggerWords(id) {
        const triggerDetector = this.triggerDetectors.get(id);
        if (triggerDetector) {
            triggerDetector.enable();
        }
    }

    disableTriggerWords(id) {
        const triggerDetector = this.triggerDetectors.get(id);
        if (triggerDetector) {
            triggerDetector.disable();
        }
    }

    getTriggerWordsStatus(id) {
        const triggerDetector = this.triggerDetectors.get(id);
        if (triggerDetector) {
            return triggerDetector.getStatus();
        }
        return null;
    }

    setTranslationProvider(provider, options = {}) {
        if (provider === 'azure') {
            this.translatorAPI.azureConfig = {
                ...this.translatorAPI.azureConfig,
                ...options
            };
        }
    }
}

module.exports = StreamTranslatorManager;
