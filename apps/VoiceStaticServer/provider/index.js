const path = require('path');
const fs = require('fs');
const FWatcher = require('#@/ncore/utils/ftool/libs/fwatcher.js');
let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args),
        progressBar: (current, total, options) => logger.progressBar(current, total, options)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args),
        progressBar: (current, total, options) => `Progress: ${current / total * 100}%` 
    };
}

function mkdir(path) {
    return fs.mkdirSync(path, { recursive: true });
}

const { EdgeTTS } = require('@andresaya/edge-tts');
let TTS_NODE_VOICES = null;
const GET_TTS_NODE_VOICES = async (MS_TTS) => {
    if (TTS_NODE_VOICES) {
        return TTS_NODE_VOICES;
    }
    TTS_NODE_VOICES = await MS_TTS.getVoices();
    log.info(`support voices: `);
    for(const voice of TTS_NODE_VOICES){
        log.success(`\t- ${voice.ShortName}`);
    }
    log.info(`\n--------------------------------------------------------------------------------`)
    return TTS_NODE_VOICES;
};
const { APP_DATA_DIR, APP_OUTPUT_DIR, APP_METADATA_DIR } = require('#@/ncore/gvar/gdir.js');
const DICTIONARY_DIR = path.join(APP_METADATA_DIR, 'dictionary');
const LEMMAS_DIR = path.join(APP_METADATA_DIR, 'lemmas');
const SENTENCES_DIR = path.join(APP_METADATA_DIR, 'sentences');
const VOCABULARY_DIR = path.join(APP_METADATA_DIR, 'vocabulary');
const DICT_SOUND_DIR = path.join(APP_OUTPUT_DIR, 'dictSoundLib');
const DICT_SOUND_SUBTITLE_DIR = path.join(APP_OUTPUT_DIR, 'dictSoundSubtitle');
const SENTENCES_SOUND_DIR = path.join(APP_OUTPUT_DIR, 'sentenceSoundLib');
const SENTENCES_SOUND_SUBTITLE_DIR = path.join(APP_OUTPUT_DIR, 'sentenceSoundSubtitle');

const DICT_SOUND_WATCHER = new FWatcher(DICT_SOUND_DIR);
const SENTENCES_SOUND_WATCHER = new FWatcher(SENTENCES_SOUND_DIR);

const START_TIME = Date.now();
let WORD_TOTAL_COUNT = 0;
let WORD_COUNT = 0;
let WORD_COUNT_UPDATED = false;
let WORD_TIME = 0;
let WORD_SUCCESS_COUNT = 0;
let WORD_FAILED_COUNT = 0;
let WORD_AVERAGE_TIME = 0;
let WORD_WAITING_COUNT = 0;
let WORD_START_INDEX = 0;
let WORD_END_INDEX = 0;

let SENTENCE_COUNT = 0;
let SENTENCE_TIME = 0;
let SENTENCE_SUCCESS_COUNT = 0;
let SENTENCE_FAILED_COUNT = 0;
const updateWordSuccessCount = () => {
    WORD_SUCCESS_COUNT++;
    WORD_COUNT++;
    WORD_TIME += Date.now() - START_TIME;
    WORD_AVERAGE_TIME = WORD_TIME / WORD_SUCCESS_COUNT;
    updateWordWaitingCount('sub');
}
const updateWordFailedCount = () => {
    WORD_FAILED_COUNT++;
    WORD_COUNT++;
    WORD_TIME += Date.now() - START_TIME;
    WORD_AVERAGE_TIME = WORD_TIME / WORD_SUCCESS_COUNT;
    updateWordWaitingCount('add');
}

mkdir(DICT_SOUND_DIR)
mkdir(SENTENCES_SOUND_DIR)
mkdir(DICT_SOUND_SUBTITLE_DIR)
mkdir(SENTENCES_SOUND_SUBTITLE_DIR)

let TOTAL_TIME = START_TIME;

const setWordIndex = (start, end) => {
    WORD_START_INDEX = start;
    WORD_END_INDEX = end;
}
const updateTotalTime = () => {
    TOTAL_TIME = Date.now() - START_TIME;
}
const setWordTotalCount = (count) => {
    WORD_TOTAL_COUNT = count;
}
const setWordCount = (count) => {
    WORD_COUNT = count;
}
const addWordCount = (count) => {
    WORD_COUNT += count;
}
const updateWordWaitingCount = (operation) => {
    if (operation == 'add') {
        if (WORD_WAITING_COUNT < 0) {
            WORD_WAITING_COUNT = 0;
        }
        WORD_WAITING_COUNT++;
    } else {
        if (WORD_WAITING_COUNT > 0) {
            WORD_WAITING_COUNT--;
            WORD_COUNT++;
        }
    }
}
const printWordStatus = () => {
    log.success(`Word count: ${WORD_COUNT}`);
    log.success(`Word success count: ${WORD_SUCCESS_COUNT}`);
    if (WORD_FAILED_COUNT > 0) {
        log.warn(`Word failed count: ${WORD_FAILED_COUNT}`);
    }
    log.success(`Word waiting count: ${WORD_WAITING_COUNT}`);
    log.success(`Total time: ${TOTAL_TIME}ms`);
    log.success(`Word average time: ${WORD_AVERAGE_TIME}ms`);
    log.progressBar(WORD_SUCCESS_COUNT, WORD_COUNT, { width: 40 });
}

const updateWordCount = async () => {
    if (WORD_COUNT_UPDATED) {
        return;
    }
    WORD_COUNT_UPDATED = true;
    const dictSoundWatcher = await DICT_SOUND_WATCHER.getWatcherStatus();
    WORD_COUNT += dictSoundWatcher.fileNameSet;
}

const getWordStatus = async () => {
    await updateWordCount();
    return {
        success: true,
        data: {
            wordTotalCount: WORD_TOTAL_COUNT,
            wordCount: WORD_COUNT,
            wordSuccessCount: WORD_SUCCESS_COUNT,
            wordFailedCount: WORD_FAILED_COUNT,
            wordWaitingCount: WORD_WAITING_COUNT,
            totalTime: TOTAL_TIME,
            wordAverageTime: WORD_AVERAGE_TIME,
            wordStartIndex: WORD_START_INDEX,
            wordEndIndex: WORD_END_INDEX,
            dictSoundWatcher: await DICT_SOUND_WATCHER.getWatcherStatus(),
            sentencesSoundWatcher: await SENTENCES_SOUND_WATCHER.getWatcherStatus(),
        }
    }
}


module.exports = {
    DICTIONARY_DIR,
    LEMMAS_DIR,
    SENTENCES_DIR,
    VOCABULARY_DIR,
    DICT_SOUND_DIR,
    DICT_SOUND_SUBTITLE_DIR,
    SENTENCES_SOUND_SUBTITLE_DIR,
    SENTENCES_SOUND_DIR,
    EdgeTTS,
    updateTotalTime,
    printWordStatus,
    updateWordSuccessCount,
    updateWordFailedCount,
    setWordCount,
    addWordCount,
    setWordTotalCount,
    updateWordWaitingCount,
    setWordIndex,
    WORD_COUNT,
    WORD_TIME,
    TOTAL_TIME,
    WORD_SUCCESS_COUNT,
    WORD_FAILED_COUNT,
    START_TIME,
    DICT_SOUND_WATCHER,
    SENTENCES_SOUND_WATCHER,
    // MS_TTS_BINARY,
    getWordStatus,
    GET_TTS_NODE_VOICES,
};