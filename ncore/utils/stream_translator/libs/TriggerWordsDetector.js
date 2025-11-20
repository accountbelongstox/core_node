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

const config = require('../config/index.js');
const logger = require('./Logger.js');

class TriggerWordsDetector {
    constructor(customTriggerWords = null) {
        this.triggerWords = customTriggerWords || config.triggerWords || [];
        this.enabled = config.enableTriggerWords || false;
        this.matchMode = config.triggerWordsMatchMode || 'any';
        this.triggerFound = false;
        this.triggerCache = new Map();
    }

    setTriggerWords(words) {
        if (typeof words === 'string') {
            this.triggerWords = [words];
        } else if (Array.isArray(words)) {
            this.triggerWords = words;
        } else {
            logger.error('Trigger words must be a string or array');
            return;
        }

        this.enabled = this.triggerWords.length > 0;
        this.triggerCache.clear();
        logger.info('Trigger words set: ' + this.triggerWords.join(', '));
    }

    addTriggerWord(word) {
        if (typeof word === 'string' && word.length > 0) {
            if (this.triggerWords.indexOf(word) === -1) {
                this.triggerWords.push(word);
                this.enabled = true;
                logger.info('Added trigger word: ' + word);
            }
        }
    }

    removeTriggerWord(word) {
        const index = this.triggerWords.indexOf(word);
        if (index !== -1) {
            this.triggerWords.splice(index, 1);
            this.triggerCache.clear();
            this.enabled = this.triggerWords.length > 0;
            logger.info('Removed trigger word: ' + word);
        }
    }

    clearTriggerWords() {
        this.triggerWords = [];
        this.enabled = false;
        this.triggerCache.clear();
        this.triggerFound = false;
        logger.info('Cleared all trigger words');
    }

    enable() {
        this.enabled = true;
        logger.info('Trigger words detection enabled');
    }

    disable() {
        this.enabled = false;
        logger.info('Trigger words detection disabled');
    }

    isEnabled() {
        return this.enabled;
    }

    getTriggerWords() {
        return this.triggerWords;
    }

    checkSentence(sentence) {
        if (!this.enabled || this.triggerWords.length === 0) {
            return true;
        }

        const cacheKey = sentence;
        if (this.triggerCache.has(cacheKey)) {
            return this.triggerCache.get(cacheKey);
        }

        let found = false;
        let i;

        for (i = 0; i < this.triggerWords.length; i++) {
            const triggerWord = this.triggerWords[i];
            if (sentence.includes(triggerWord)) {
                found = true;
                break;
            }
        }

        this.triggerCache.set(cacheKey, found);
        return found;
    }

    checkContext(previousSentences) {
        if (!this.enabled || this.triggerWords.length === 0) {
            return true;
        }

        if (this.triggerFound) {
            return true;
        }

        let i, j;
        for (i = 0; i < previousSentences.length; i++) {
            const sentence = previousSentences[i];
            for (j = 0; j < this.triggerWords.length; j++) {
                const triggerWord = this.triggerWords[j];
                if (sentence.includes(triggerWord)) {
                    this.triggerFound = true;
                    logger.info('Trigger word found: ' + triggerWord + ' in sentence: ' + sentence.substring(0, 50));
                    return true;
                }
            }
        }

        return false;
    }

    checkAllSentences(sentences) {
        if (!this.enabled || this.triggerWords.length === 0) {
            return true;
        }

        let i, j;
        for (i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            for (j = 0; j < this.triggerWords.length; j++) {
                const triggerWord = this.triggerWords[j];
                if (sentence.includes(triggerWord)) {
                    return true;
                }
            }
        }

        return false;
    }

    resetTriggerState() {
        this.triggerFound = false;
        this.triggerCache.clear();
    }

    getStatus() {
        return {
            enabled: this.enabled,
            triggerWordsCount: this.triggerWords.length,
            triggerWords: this.triggerWords,
            triggerFound: this.triggerFound,
            matchMode: this.matchMode
        };
    }
}

module.exports = TriggerWordsDetector;
