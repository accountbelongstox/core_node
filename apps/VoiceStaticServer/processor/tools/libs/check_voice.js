const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const file = require('#@/ncore/utils/ftool/libs/file.js');
const { DICT_SOUND_DIR, SENTENCES_SOUND_DIR, updateTotalTime,
    printWordStatus,
    WORD_COUNT,
    WORD_TIME,
    TOTAL_TIME,
    DICT_SOUND_WATCHER,
    SENTENCES_SOUND_WATCHER,
    updateWordSuccessCount,
    updateWordFailedCount,
    START_TIME,
    DICT_SOUND_SUBTITLE_DIR,SENTENCES_SOUND_SUBTITLE_DIR } = require('../../../provider/index');
const { findEdgeTTSBinary } = require('./edgeTTSFinder');
const { getAmericanVoice, getEnglishVoice } = require('./soundQuality');
const { execCommand } = require('#@utils_commander');
const { toFileName } = require('./string');
const log = require('#@/ncore/utils/logger/index.js');
let edgeTTSBinary = null;

const updateWordCount = (ma3Path, type) => {
    const validFile = checkValidFile(ma3Path,type);
    let isSuccess = false;
    if (validFile) {
        log.success(`Generated and checked file: ${ma3Path}`);
        updateWordSuccessCount();
        isSuccess = true;
    } else {
        log.error(`Failed to generate valid audio file for '${ma3Path}'`);
        updateWordFailedCount();
    }
    printWordStatus();
    return isSuccess;
}


function getMd5(word) {
    if (typeof word === 'string') {
        word = word.trim();
    } else {
        word = ``;
    }
    word = word.replace(/\W+/g, '');
    try {
        return crypto.createHash('md5').update(word).digest('hex');
    } catch (error) {
        log.error('Error generating MD5:', error);
        return '';
    }
}

const ITEM_TYPE = {
    WORD: 'word',
    SENTENCE: 'sentence'
};


const ensureQueueItem = (input) => {
    try {
        // If input is already a valid queue item, return it
        if (input &&
            typeof input === 'object' &&
            'content' in input &&
            'type' in input &&
            'md5' in input) {
            return input;
        }

        // If input is an object but not a valid queue item
        if (input && typeof input === 'object') {
            // Try to extract content from various possible properties
            const content = input.content || input.text || input.word || input.sentence || input.value;
            if (!content) {
                log.error('Could not extract content from object:', input);
                return null;
            }

            const trimmedContent = content.trim();
            const type = trimmedContent.includes(' ') ? ITEM_TYPE.SENTENCE : ITEM_TYPE.WORD;

            return {
                content: trimmedContent,
                addedTime: Date.now(),
                type,
                md5: getMd5(trimmedContent),
                retries: 0
            };
        }

        if (typeof input === 'string') {
            const trimmedContent = input.trim();
            if (!trimmedContent) {
                log.error('Empty content after trimming');
                return null;
            }

            const type = trimmedContent.includes(' ') ? ITEM_TYPE.SENTENCE : ITEM_TYPE.WORD;

            return {
                content: trimmedContent,
                addedTime: Date.now(),
                type,
                md5: getMd5(trimmedContent),
                retries: 0
            };
        }

        log.error('Invalid input type:', typeof input);
        return null;
    } catch (error) {
        log.error('Error ensuring queue item:', error);
        return null;
    }
};

const ensureAudioSuffixName = (input, suffix = `.mp3`) => {
    if (input.endsWith(suffix)) {
        return input;
    }
    return `${input}${suffix}`;
}


const checkVoice = async (input) => {
    try {
        const queueItem = ensureQueueItem(input);
        if (!queueItem) {
            log.error('Failed to create valid queue item from input');
            return false;
        }
        const audioMapName = await generateAudioMapName(queueItem);
        return await checkValidFile(audioMapName, queueItem.type);
    } catch (e) {
        log.error(`Error checking MP3 file: ${e.message} ${e.stack}`);  
        return false;
    }
};

const getEdgeTTSBinary = async () => {
    if (edgeTTSBinary) {
        return edgeTTSBinary;
    }
    edgeTTSBinary = await findEdgeTTSBinary();
    return edgeTTSBinary;
}

const generateAudioMapName = async (queueItem, accent = "us") => {
    let audioMapName = await generateAudioMa3RawName(queueItem, accent);
    audioMapName = await ensureAudioSuffixName(audioMapName);
    return audioMapName;
}

const generateAudioSubtitleName = async (queueItem, accent = "us") => {
    let audioMapName = await generateAudioMa3RawName(queueItem, accent);
    audioMapName = await ensureAudioSuffixName(audioMapName, ".vtt");
    return audioMapName;
}

const generateAudioMa3RawName = async (queueItem, accent = "us") => {
    let audioMapName = `${accent}_${queueItem.md5}_${toFileName(queueItem.content)}_normal`;
    return audioMapName;
}

const getVoiceDir = (queueItem) => {
    return queueItem.type === ITEM_TYPE.WORD ? DICT_SOUND_DIR : SENTENCES_SOUND_DIR;
}

const getSubtitleDir = (queueItem) => {
    return queueItem.type === ITEM_TYPE.WORD ? DICT_SOUND_SUBTITLE_DIR : SENTENCES_SOUND_SUBTITLE_DIR;
}

const showGenerateInfo = (queueItem,SoundQuality,mediaFilename,command) => {
    log.info(`\n--------------------------------------------------------------------------------`)
    log.info(`Content : ${queueItem.content} / ${SoundQuality} / ${queueItem.type}`)
    log.info(`At : ${mediaFilename}`)
    log.info(`rate : 0% / volume : 100% / pitch : 100Hz`)
    if(command){
        log.info(`${command}`)
    }
}

const checkValidFile = async (filePath, type) => {
    const watcher = type === ITEM_TYPE.WORD ? DICT_SOUND_WATCHER : SENTENCES_SOUND_WATCHER;
    const absoluteFilePath = file.isAbsulutePath(filePath) ? filePath : path.join(getVoiceDir(type), filePath);
    const validFile = await watcher.findValidFile(absoluteFilePath);
    if(validFile){
        return validFile;
    }
    return null;
}

// const checkValidFile = async (filePath, type) => {
//     const LIB_DIR = type === ITEM_TYPE.WORD ? DICT_SOUND_DIR : SENTENCES_SOUND_DIR;
//     const absoluteFilePath = file.isAbsulutePath(filePath) ? filePath : path.join(LIB_DIR, filePath);
//     const validFile = file.isValideFile(absoluteFilePath);
//     if(validFile){
//         return validFile;
//     }
//     return null;
// }

module.exports = {
    checkVoice,
    ensureQueueItem,
    ensureAudioSuffixName,
    getMd5,
    getEdgeTTSBinary,
    generateAudioMapName,
    generateAudioMa3RawName,
    ITEM_TYPE,
    getVoiceDir,
    updateWordCount,
    getSubtitleDir,
    showGenerateInfo,
    generateAudioSubtitleName,
    checkValidFile
}
