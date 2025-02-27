const path = require('path');
const { fsexists,isAbsolutePath } = require('#@/ncore/utils/ftool/libs/file.js');
const { DICT_SOUND_DIR, SENTENCES_SOUND_DIR, initializeWatcher, DICT_SOUND_SUBTITLE_DIR, SENTENCES_SOUND_SUBTITLE_DIR } = require('../../../provider/index');
const { findEdgeTTSBinary } = require('./edgeTTSFinder');
const { toFileName } = require('#@ncore/utils/tool/libs/strtool.js');
const { ensureQueueItem } = require('../../../provider/QueueManager');
const log = require('#@logger');
let edgeTTSBinary = null;

const ITEM_TYPE = {
    WORD: 'word',
    SENTENCE: 'sentence'
};

const ensureAudioSuffixName = (input, suffix = `.mp3`) => {
    if (input.endsWith(suffix)) {
        return input;
    }
    return `${input}${suffix}`;
}


const getEdgeTTSBinary = async () => {
    if (edgeTTSBinary) {
        return edgeTTSBinary;
    }
    edgeTTSBinary = await findEdgeTTSBinary();
    return edgeTTSBinary;
}

const generateAudioMa3Name = async (queueItem, accent = "us") => {
    let audioMapName = await generateAudioMa3RawName(queueItem, accent);
    audioMapName = await ensureAudioSuffixName(audioMapName);
    return audioMapName;
}

const generateAudioMa3UsGbName = async (content) => {
    const queueItem = ensureQueueItem(content);
    const accents = [`us`, `gb`];
    const audioMapNames = [];
    for(const accent of accents){
        let audioMapName = await generateAudioMa3RawName(queueItem, accent);
        audioMapName = await ensureAudioSuffixName(audioMapName);
        audioMapNames.push(audioMapName);
    }
    return audioMapNames;
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
    return queueItem.type == ITEM_TYPE.WORD ? DICT_SOUND_DIR : SENTENCES_SOUND_DIR;
}

const getSubtitleDir = (queueItem) => {
    return queueItem.type == ITEM_TYPE.WORD ? DICT_SOUND_SUBTITLE_DIR : SENTENCES_SOUND_SUBTITLE_DIR;
}

const showGenerateInfo = (queueItem, SoundQuality, mediaFilename, command) => {
    log.info(`\n--------------------------------------------------------------------------------`)
    log.info(`Content : ${queueItem.content} / ${SoundQuality} / ${queueItem.type}`)
    log.info(`At : ${mediaFilename}`)
    log.info(`rate : 0% / volume : 100% / pitch : 100Hz`)
    if (command) {
        log.info(`${command}`)
    }
}

const checkValidFile = async (filePath, type) => {
    const { DICT_SOUND_WATCHER, SENTENCES_SOUND_WATCHER } = await initializeWatcher();
    const watcher = type == ITEM_TYPE.WORD ? DICT_SOUND_WATCHER : SENTENCES_SOUND_WATCHER;
    const dir = type == ITEM_TYPE.WORD ? DICT_SOUND_DIR : SENTENCES_SOUND_DIR;
    const absoluteFilePath = isAbsolutePath(filePath) ? filePath : path.join(dir, filePath);
    const validFile = await watcher.findValidFile(absoluteFilePath);
    if (validFile) {
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
    ensureQueueItem,
    ensureAudioSuffixName,
    getEdgeTTSBinary,
    generateAudioMa3Name,
    generateAudioMa3RawName,
    getVoiceDir,
    getSubtitleDir,
    showGenerateInfo,
    generateAudioSubtitleName,
    checkValidFile,
    generateAudioMa3UsGbName,
    ITEM_TYPE
}
