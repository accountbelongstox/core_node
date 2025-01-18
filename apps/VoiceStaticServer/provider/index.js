const path = require('path');
const fs = require('fs');
const sysarg = require('#@ncore/utils/systool/libs/sysarg.js'); 
const gconfig = require('#@ncore/gvar/gconfig.js');
let log = require('#@/ncore/utils/logger/index.js');


function mkdir(path) {
    return fs.mkdirSync(path, { recursive: true });
}

const { EdgeTTS } = require('@andresaya/edge-tts');
const FMonitor = require('#@/ncore/utils/ftool/libs/fmonitor.js');

let TTS_NODE_VOICES = null;
const GET_TTS_NODE_VOICES = async (MS_TTS) => {
    if (TTS_NODE_VOICES) {
        return TTS_NODE_VOICES;
    }
    TTS_NODE_VOICES = await MS_TTS.getVoices();
    log.info(`support voices: `);
    for (const voice of TTS_NODE_VOICES) {
        log.success(`\t- ${voice.ShortName}`);
    }
    log.info(`\n--------------------------------------------------------------------------------`)
    return TTS_NODE_VOICES;
};
const { APP_DATA_DIR, APP_OUTPUT_DIR, APP_METADATA_DIR,APP_DATA_CACHE_DIR } = require('#@/ncore/gvar/gdir.js');
const ITEM_TYPE = {
    WORD: 'word',
    SENTENCE: 'sentence'
};

const DICTIONARY_DIR = path.join(APP_METADATA_DIR, 'dictionary');
const LEMMAS_DIR = path.join(APP_METADATA_DIR, 'lemmas');
const SENTENCES_DIR = path.join(APP_METADATA_DIR, 'sentences');
const VOCABULARY_DIR = path.join(APP_METADATA_DIR, 'vocabulary');
const VOCABULARY_TABLE_DIR = path.join(APP_DATA_CACHE_DIR, 'vocabulary_table');
const META_DIR = path.join(APP_METADATA_DIR, 'meta');
const DICT_SOUND_DIR = path.join(APP_OUTPUT_DIR, 'dictSoundLib');
const DICT_SOUND_SUBTITLE_DIR = path.join(APP_OUTPUT_DIR, 'dictSoundSubtitle');
const SENTENCES_SOUND_DIR = path.join(APP_OUTPUT_DIR, 'sentenceSoundLib');
const SENTENCES_SOUND_SUBTITLE_DIR = path.join(APP_OUTPUT_DIR, 'sentenceSoundSubtitle');


// const DICT_SOUND_WATCHER = new FWatcher(DICT_SOUND_DIR);
// const SENTENCES_SOUND_WATCHER = new FWatcher(SENTENCES_SOUND_DIR);
let DICT_SOUND_WATCHER = null;
let SENTENCES_SOUND_WATCHER = null;

const ARG_CLIENT = sysarg.getArg('client');
const ARG_SERVER = sysarg.getArg('server');
const ROLE = ARG_SERVER ? 'server' : 'client';
const IS_SERVER = ROLE == 'server';
const IS_CLIENT = !IS_SERVER;

const WORD_USED_START_TIME = Date.now();
let WORD_COUNT_NAMBER_INIT = false;
let WORD_TOTAL_COUNT = 0;
let WORD_GENERATED_AUDIO_COUNT = 0;

let WORD_GENERATED_SERVER_TOTAL_COUNT = 0;
let WORD_GENERATED_CLIENT_TOTAL_COUNT = 0;

let WORD_USED_TIME = 0;
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

const SERVER_URL = gconfig.getConfig(`SERVER_URL`);
const CLIENTS_URL = gconfig.getConfig(`CLIENTS_URL`).split(',');

console.log(`SERVER_URL`,SERVER_URL)
console.log(`CLIENTS_URL`,CLIENTS_URL)

const SUBMIT_AUDIO_URL = `${SERVER_URL}/submit_audio`;
const GET_ROW_WORD_URL = `${SERVER_URL}/get_row_word`;
const SUBMIT_AUDIO_SIMPLE_URL = `${SERVER_URL}/submit_audio_simple`;

const updateWordTatolCount = async (success,type) => {
    const { DICT_SOUND_WATCHER, SENTENCES_SOUND_WATCHER } = await initializeWatcher();
    if (type == ITEM_TYPE.WORD) {
        if (success) {
            WORD_SUCCESS_COUNT++;
            WORD_USED_TIME += Date.now() - WORD_USED_START_TIME;
            WORD_AVERAGE_TIME = WORD_USED_TIME / WORD_SUCCESS_COUNT;
            WORD_WAITING_COUNT--;
            if (WORD_WAITING_COUNT < 0) {
                WORD_WAITING_COUNT = 0;
            }
        } else {
            WORD_FAILED_COUNT++;
            WORD_USED_TIME += Date.now() - WORD_USED_START_TIME;
            WORD_AVERAGE_TIME = WORD_USED_TIME / WORD_SUCCESS_COUNT;
        }
        WORD_GENERATED_AUDIO_COUNT = await DICT_SOUND_WATCHER.getWatcherStatus().fileNameSet 
    } else{
        if (success) {
            WORD_SUCCESS_COUNT++;
            WORD_USED_TIME += Date.now() - WORD_USED_START_TIME;
            WORD_AVERAGE_TIME = WORD_USED_TIME / WORD_SUCCESS_COUNT;
            WORD_WAITING_COUNT--;
            if (WORD_WAITING_COUNT < 0) {
                WORD_WAITING_COUNT = 0;
            }
        } else {
            WORD_FAILED_COUNT++;
            WORD_USED_TIME += Date.now() - WORD_USED_START_TIME;
            WORD_AVERAGE_TIME = WORD_USED_TIME / WORD_SUCCESS_COUNT;
        }
    }
}

//parameter: totalCount,waitingCount,audioCount,startIndex,endIndes
const initWordTotalCount = async (totalCount,waitingCount,startIndex,endIndes,serverAudioCount=0) => {
    const { DICT_SOUND_WATCHER, SENTENCES_SOUND_WATCHER } = await initializeWatcher();
    WORD_TOTAL_COUNT = totalCount;
    WORD_WAITING_COUNT = waitingCount;
    WORD_GENERATED_AUDIO_COUNT = await DICT_SOUND_WATCHER.getWatcherStatus().fileNameSet //+ SENTENCES_SOUND_WATCHER.getWatcherStatus().fileNameSet;
    WORD_START_INDEX = startIndex
    WORD_END_INDEX = endIndes
    WORD_COUNT_NAMBER_INIT=true
    WORD_GENERATED_SERVER_TOTAL_COUNT = serverAudioCount;
}

async function initializeWatcher() {
    if (!DICT_SOUND_WATCHER) {
        DICT_SOUND_WATCHER = new FMonitor(DICT_SOUND_DIR);
        await DICT_SOUND_WATCHER.initialize();
    }
    if (!SENTENCES_SOUND_WATCHER) {
        SENTENCES_SOUND_WATCHER = new FMonitor(SENTENCES_SOUND_DIR);
        await SENTENCES_SOUND_WATCHER.initialize();
    }
    return {
        DICT_SOUND_WATCHER,
        SENTENCES_SOUND_WATCHER
    }
}

mkdir(DICT_SOUND_DIR)
mkdir(SENTENCES_SOUND_DIR)
mkdir(DICT_SOUND_SUBTITLE_DIR)
mkdir(SENTENCES_SOUND_SUBTITLE_DIR)
mkdir(META_DIR)
mkdir(VOCABULARY_TABLE_DIR)

const printWordStatus = () => {
    log.success(`Word count: ${WORD_TOTAL_COUNT}`);
    log.success(`Word success count: ${WORD_SUCCESS_COUNT}`);
    if (WORD_FAILED_COUNT > 0) {
        log.warn(`Word failed count: ${WORD_FAILED_COUNT}`);
    }
    log.success(`Word waiting count: ${WORD_WAITING_COUNT}`);
    log.success(`Total time: ${WORD_USED_TIME}ms`);
    log.success(`Word average time: ${WORD_AVERAGE_TIME}ms`);
    log.progressBar(WORD_SUCCESS_COUNT, WORD_WAITING_COUNT, { width: 40 });
}

const getWordStatus = async () => {
    return {
        wordCountNumberInit: WORD_COUNT_NAMBER_INIT,
        wordUsedTime: WORD_USED_TIME,
        wordTotalCount: WORD_TOTAL_COUNT,
        wordGeneratedAudioCount: WORD_GENERATED_AUDIO_COUNT,
        wordSuccessCount: WORD_SUCCESS_COUNT,
        wordFailedCount: WORD_FAILED_COUNT,
        wordWaitingCount: WORD_WAITING_COUNT,
        wordAverageTime: WORD_AVERAGE_TIME,
        wordStartIndex: WORD_START_INDEX,
        wordEndIndex: WORD_END_INDEX,
        wordGeneratedServerTotalCount: WORD_GENERATED_SERVER_TOTAL_COUNT,
        isServer: IS_SERVER,
        isClient: IS_CLIENT,
        role: ROLE,
        dictSoundWatcher: DICT_SOUND_WATCHER ? await DICT_SOUND_WATCHER.getWatcherStatus() : { fileNameSet: 0 },
        sentencesSoundWatcher: SENTENCES_SOUND_WATCHER ? await SENTENCES_SOUND_WATCHER.getWatcherStatus() : { fileNameSet: 0 },
    }
}

module.exports = {
    DICTIONARY_DIR,
    LEMMAS_DIR,
    SENTENCES_DIR,
    VOCABULARY_DIR,
    VOCABULARY_TABLE_DIR,
    META_DIR,
    DICT_SOUND_DIR,
    DICT_SOUND_SUBTITLE_DIR,
    SENTENCES_SOUND_SUBTITLE_DIR,
    SENTENCES_SOUND_DIR,
    EdgeTTS,
    printWordStatus,
    initializeWatcher,
    IS_SERVER,
    IS_CLIENT,
    ROLE,
    SERVER_URL,
    SUBMIT_AUDIO_URL,
    GET_ROW_WORD_URL,
    SUBMIT_AUDIO_SIMPLE_URL,
    updateWordTatolCount,
    initWordTotalCount,
    WORD_SUCCESS_COUNT,
    WORD_FAILED_COUNT,
    DICT_SOUND_WATCHER,
    SENTENCES_SOUND_WATCHER,
    getWordStatus,
    GET_TTS_NODE_VOICES,
};