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

const logger = require('#@logger');
const { ITEM_TYPE } = require('../types/data_types.js');
const { getDICTSoundWatcher } = require('../WatcherProvider.js');
const { START_TIME, ROLE, IS_SERVER,
    IS_CLIENT,
} = require('./StaticData.js');


let WORD_COUNT_NAMBER_INIT = false;
let WORD_TOTAL_COUNT = 0;
const WORDS_MAIN_SET = new Set();
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
let SERVER_STATUS = "closed";

class ServerSyncStatus {
    constructor() {
        this.lastSyncTime = null;
        this.syncStatus = 'idle'; // idle, in_progress, success, failed
        this.totalProcessed = 0;
        this.completionRate = 0;
        this.lastError = null;
        this.userServerAllRecords = 0;
        this.userServerHasTranslation = 0;
        this.userServerHasVoice = 0;
    }

    updateSyncStatus(status, totalProcessed = 0, completionRate = 0, error = null, userServerAllRecords = 0, userServerHasTranslation = 0, userServerHasVoice = 0) {
        this.lastSyncTime = new Date();
        this.syncStatus = status;
        this.totalProcessed = totalProcessed;
        this.completionRate = completionRate;
        this.lastError = error;
        this.userServerAllRecords = userServerAllRecords;
        this.userServerHasTranslation = userServerHasTranslation;
        this.userServerHasVoice = userServerHasVoice;
    }

    getStatus() {
        return {
            lastSyncTime: this.lastSyncTime,
            syncStatus: this.syncStatus,
            totalProcessed: this.totalProcessed,
            completionRate: this.completionRate,
            lastError: this.lastError,
            userServerAllRecords: this.userServerAllRecords,
            userServerHasTranslation: this.userServerHasTranslation,
            userServerHasVoice: this.userServerHasVoice,
        };
    }
}

// Create a singleton instance
const serverSyncStatus = new ServerSyncStatus();

const addWordToMainSet = (wordOrItem) => {
    if (typeof wordOrItem == 'object') {
        wordOrItem = wordOrItem.content;
    }
    if (WORDS_MAIN_SET.has(wordOrItem)) {
        return;
    }
    WORDS_MAIN_SET.add(wordOrItem);
}
const hasWordInMainSet = (wordOrItem) => {
    if (typeof wordOrItem == 'object') {
        wordOrItem = wordOrItem.content;
    }
    return WORDS_MAIN_SET.has(wordOrItem);
}
const getMainSet = () => {
    return WORDS_MAIN_SET;
}
const setServerStatus = (status) => {
    SERVER_STATUS = status;
}
const updateWordTatolCount = async (success, type) => {
    const DICT_SOUND_WATCHER = await getDICTSoundWatcher();
    if (type == ITEM_TYPE.WORD) {
        if (success) {
            WORD_SUCCESS_COUNT++;
            WORD_USED_TIME = Date.now() - START_TIME;
            WORD_AVERAGE_TIME = WORD_USED_TIME / WORD_SUCCESS_COUNT;
            WORD_WAITING_COUNT--;
            if (WORD_WAITING_COUNT < 0) {
                WORD_WAITING_COUNT = 0;
            }
        } else {
            WORD_FAILED_COUNT++;
            WORD_USED_TIME = Date.now() - START_TIME;
            WORD_AVERAGE_TIME = WORD_USED_TIME / WORD_SUCCESS_COUNT;
        }
        WORD_GENERATED_AUDIO_COUNT = await DICT_SOUND_WATCHER.getWatcherStatus().fileNameSet
    } else {
        if (success) {
            WORD_SUCCESS_COUNT++;
            WORD_USED_TIME = Date.now() - START_TIME;
            WORD_AVERAGE_TIME = WORD_USED_TIME / WORD_SUCCESS_COUNT;
            WORD_WAITING_COUNT--;
            if (WORD_WAITING_COUNT < 0) {
                WORD_WAITING_COUNT = 0;
            }
        } else {
            WORD_FAILED_COUNT++;
            WORD_USED_TIME = Date.now() - START_TIME;
            WORD_AVERAGE_TIME = WORD_USED_TIME / WORD_SUCCESS_COUNT;
        }
    }
}

const initWordTotalCount = async (totalCount, waitingCount, startIndex, endIndes, serverAudioCount = 0) => {
    const DICT_SOUND_WATCHER = await getDICTSoundWatcher();
    WORD_TOTAL_COUNT = totalCount;
    WORD_WAITING_COUNT = waitingCount;
    WORD_GENERATED_AUDIO_COUNT = await DICT_SOUND_WATCHER.getWatcherStatus().fileNameSet //+ SENTENCES_SOUND_WATCHER.getWatcherStatus().fileNameSet;
    WORD_START_INDEX = startIndex
    WORD_END_INDEX = endIndes
    WORD_COUNT_NAMBER_INIT = true
    WORD_GENERATED_SERVER_TOTAL_COUNT = serverAudioCount;
}

const printWordStatus = () => {
    logger.success(`Word count: ${WORD_TOTAL_COUNT}`);
    logger.success(`Word success count: ${WORD_SUCCESS_COUNT}`);
    if (WORD_FAILED_COUNT > 0) {
        logger.warn(`Word failed count: ${WORD_FAILED_COUNT}`);
    }
    logger.success(`Word waiting count: ${WORD_WAITING_COUNT}`);
    logger.success(`Total time: ${WORD_USED_TIME}ms`);
    logger.success(`Word average time: ${WORD_AVERAGE_TIME}ms`);
    logger.progressBar(WORD_SUCCESS_COUNT, WORD_WAITING_COUNT, { width: 40 });
}
const getStaticData = async () => {
    return {
        system: {
            isServer: IS_SERVER,
            isClient: IS_CLIENT,
            role: ROLE,
            serverStatus: SERVER_STATUS
        },
        static: {
            wordCountNumberInit: WORDS_MAIN_SET.size,
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
        },
        serverSync: serverSyncStatus.getStatus()
    }
}

module.exports = {
    printWordStatus,
    updateWordTatolCount,
    initWordTotalCount,
    getStaticData,
    addWordToMainSet,
    hasWordInMainSet,
    getMainSet,
    setServerStatus,
    serverSyncStatus,
};