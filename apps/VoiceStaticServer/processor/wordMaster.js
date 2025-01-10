const logger = require('#@/ncore/utils/logger/index.js');
const { getSubDirectories } = require('../tool/folder');
const { getUniqueContentLines } = require('./tools/content.js');
const { VOCABULARY_DIR, setWordCount, updateWordWaitingCount, addWordCount } = require('../provider/index');
const { addWordBack, getWordCount, getWordFront } = require('../provider/QueueManager.js');
const { getOrGenerateAudioPy } = require('./tools/edge_tts_py');
const { getOrGenerateAudioNode } = require('./tools/edge-tts-node');
const { getMd5, ensureQueueItem, checkVoice, generateAudioMapName, generateAudioMa3RawName, ITEM_TYPE, updateWordCount } = require('./tools/libs/check_voice');
const { getArg } = require('#@/ncore/utils/systool/libs/sysarg.js');


class DictInitController {
    constructor() {
        this.isProcessing = false;
    }

    async initialize() {
        let word_segmentation = getArg('word_segmentation');
        let vocabulary = getUniqueContentLines(VOCABULARY_DIR);

        let vocabulary_start = 0;
        let vocabulary_end = vocabulary.length;
        if (word_segmentation) {
            word_segmentation = word_segmentation.split('-');
            vocabulary_start = parseInt(word_segmentation[0]);
            vocabulary_end = parseInt(word_segmentation[1]);
        }

        vocabulary = vocabulary.slice(vocabulary_start, vocabulary_end);

        const generatedWords = []
        const notGeneratedWords = []
        for (const item of vocabulary) {
            const validFile = await checkVoice(item);
            if (!validFile) {
                addWordBack(item);
                notGeneratedWords.push(item);
                updateWordWaitingCount('add');
            } else {
                generatedWords.push(item);
            }
        }
        for (const word of generatedWords) {
            logger.success(`${word} is already generated`);
        }
        for (const word of notGeneratedWords) {
            logger.warn(`"${word}" is not generated, adding to queue`);
        }
        logger.success(`Total words: ${vocabulary.length}`);
        logger.success(`Generated words: ${generatedWords.length}`);
        logger.warn(`Not generated words: ${notGeneratedWords.length}`);
        console.log(`word_segmentation: ${word_segmentation}`);
        addWordCount(notGeneratedWords.length);
    }

    startWordProcessing() {
        setInterval(() => {
            this.processNextWord();
        }, 1000);
    }

    async processNextWord() {
        if (this.isProcessing) {
            return;
        }
        try {
            this.isProcessing = true;
            const wordCount = getWordCount();
            if (wordCount > 0) {
                const nextWord = getWordFront();
                await getOrGenerateAudioPy(nextWord);
            }
        } catch (error) {
            logger.error('Error processing word:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    async start() {
        try {
            await this.initialize();
            this.startWordProcessing();
        } catch (error) {
            logger.error('Error initializing dictionary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}


module.exports = new DictInitController();

