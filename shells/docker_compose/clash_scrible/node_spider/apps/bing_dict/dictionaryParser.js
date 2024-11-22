const { Queue } = require('queue-fifo');
const Util = require('../../node_provider/utils.js');
const { setTimeout } = require('node:timers/promises');

class DictionaryParser {
    constructor(browser, options = {}) {
        this.browser = browser;
        this.task = new Queue();
        this.result = new Queue();
        this.threadLock = new (require('async-lock'))();
        this.saveDb = options.saveDb || false;
        this.type = options.type || 'translate';
        this.info = options.info !== undefined ? options.info : true;
        this.language = options.language || 'zh-CN';
        this.headless = options.headless !== undefined ? options.headless : true;
        this.debug = options.debug || false;
        this.callback = options.callback;
    }

    async run() {
        if (this.type === 'translate') {
            await this.runTranslate();
        } else if (this.type === 'voice') {
            await this.runMicrosoftVoice();
        }
    }

    async runTranslate() {
        const url = `https://www.bing.com/dict?mkt=${this.language}`;
        const page = await this.browser.page.open_single(url, { width: 600, height: 400, mobile: false, headless: this.headless });

        await page.waitForSelector('#sb_form_q');

        while (true) {
            const word = await this.getItem();
            if (!word) {
                // If translation is complete, update the list
                // Implement notTranslatedToQueue() method
                await this.notTranslatedToQueue();
                if (!await this.getItem()) {
                    // If there are still no translation tasks after updating the list, sleep
                    await setTimeout(60000);
                    continue;
                }
            }

            console.log(`${word}, task: ${this.task.size()}`);
            if (word === '') continue;

            await this.browser.handle.type('#sb_form_q', word);
            await this.browser.handle.clickElementBySelector('#sb_form_go');
            await setTimeout(200);

            const wordTrans = await this.bingEngineHtmlExtractToJson(word, this.debug);
            this.remainingMessages(word, wordTrans);

            if (this.saveDb) {
                if (wordTrans === null) {
                    // Implement deleteWord method
                    await this.deleteWord(word, false);
                } else {
                    // Implement updateTranslateDb method
                    await this.updateTranslateDb({ word, translate_bing: wordTrans });
                }
            }

            if (this.callback) {
                this.callback(word, wordTrans);
            }

            await page.close();
        }
    }

    async getItem() {
        return new Promise((resolve) => {
            this.threadLock.acquire('task', (done) => {
                if (this.task.size() > 0) {
                    const item = this.task.dequeue();
                    done();
                    resolve(item);
                } else {
                    done();
                    resolve(null);
                }
            });
        });
    }

    async bingEngineHtmlExtractToJson(word, debug = true) {
        const page = await this.browser.page.getCurrentPage();
        const noResult = await this.noResultWait('.lf_area');
        if (noResult === true) return null;
        if (noResult !== false) {
            return { word, translate_text: noResult };
        }

        const wordTrans = {};
        wordTrans.word = await page.$eval('.hd_div strong', el => el.textContent.trim());
        if (debug) console.log(wordTrans.word);

        wordTrans.word_translation = await page.$$eval('.qdef .hd_area', elements => 
            elements.map(el => el.nextElementSibling?.textContent.trim()).filter(Boolean)
        );
        if (debug) console.log('word_translation', wordTrans.word_translation);

        // Implement the rest of the parsing logic here, similar to the Python version
        // This includes parsing phonetics, voice files, plural forms, sample images, synonyms, etc.

        return wordTrans;
    }

    async noResultWait(transArea) {
        const page = await this.browser.page.getCurrentPage();
        const noResultSelector = '.no_results';
        const headStrongSelector = '.hd_div strong';
        let noResult, word;
        let index = 0;
        const waitMax = 30;

        while (index < waitMax) {
            noResult = await page.$(noResultSelector);
            word = await page.$(headStrongSelector);

            if (word || noResult) break;

            if (index >= 2) {
                const transText = await page.$$eval(transArea, els => els.map(el => el.textContent.trim()));
                if (transText.length > 0) return transText;

                const transElement = await page.$(transArea);
                if (transElement) return true;
            }

            await setTimeout(500);
            index++;
        }

        if (index >= waitMax) return true;
        if (!noResult) return false;
        return true;
    }

    remainingMessages(word, transResult) {
        const qsize = this.task.size();
        if (transResult !== null) {
            console.log(`${word} translation successful, also ${qsize} words that are not translated.`);
        } else {
            if (this.saveDb) {
                console.warn(`${word} not-translated and delete. also ${qsize} task-queue.`);
            } else {
                console.warn(`${word} not-translated. also ${qsize} task-queue.`);
            }
        }
    }

    // Implement other necessary methods like runMicrosoftVoice, updateTranslateDb, deleteWord, etc.
}

module.exports = DictionaryParser;