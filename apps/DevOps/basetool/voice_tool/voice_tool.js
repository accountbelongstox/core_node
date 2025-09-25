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

const path = require('path');
const { file } = require('#@ftools');
const { DICT_SOUND_DIR, SENTENCES_SOUND_DIR, DICT_SOUND_SUBTITLE_DIR, SENTENCES_SOUND_SUBTITLE_DIR } = require('../../provider/baseDir/BaseDirProvider.js');
const { findEdgeTTSBinary } = require('../ptools/edgeTTSFinder.js');
const { toFileName } = require('#@ncore/foundation/utilities/strtool.js');
const log = require('#@logger');
const { ITEM_TYPE } = require('../../provider/types/data_types.js');
let edgeTTSBinary = null;

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

const generateAudioMa3Name = async (content, accent = "us") => {
    let audioMapName = await generateAudioMa3RawName(content, accent);
    audioMapName = await ensureAudioSuffixName(audioMapName);
    return audioMapName;
}

const generateAudioMa3UsGbName = async (queueItem) => {
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

const generateAudioMa3RawName = async (content, accent = "us") => {
    let audioMapName = `${accent}_${content.md5}_${toFileName(content)}_normal`;
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
    ensureAudioSuffixName,
    getEdgeTTSBinary,
    generateAudioMa3Name,
    generateAudioMa3RawName,
    getVoiceDir,
    getSubtitleDir,
    showGenerateInfo,
    generateAudioSubtitleName,
    generateAudioMa3UsGbName,
}
