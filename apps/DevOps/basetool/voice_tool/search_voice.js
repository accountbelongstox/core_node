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

const { initializeWatcher } = require('../../provider/baseDir/BaseDirProvider.js');
const { ITEM_TYPE } = require('../../provider/types/data_types.js'); 
const {
    ensureWordQueueItem,
    generateAudioMa3Name,
    generateAudioMa3UsGbName,
} = require('../mate_libs/voice_tool');

const log = require('#@logger');

const searchVoiceByContent = async (content) => {
    content = content.trim();
    let type = content.includes(' ') ? ITEM_TYPE.SENTENCE : ITEM_TYPE.WORD;
    const { DICT_SOUND_WATCHER, SENTENCES_SOUND_WATCHER } = await initializeWatcher();
    const audioMapNames = await generateAudioMa3UsGbName(content);
    let watcher = type === ITEM_TYPE.WORD ? DICT_SOUND_WATCHER : SENTENCES_SOUND_WATCHER;
    for(const audioMapName of audioMapNames){
        const audioPath = await watcher.findAbsolutePathByName(audioMapName);
        if(audioPath){
            log.success(`Found audio file: ${audioPath}`);
            return audioPath;
        }else{
            log.error(`Audio file not found: ${audioMapName}`);
        }
    }
    return null;
}

module.exports = {
    searchVoiceByContent
}