const { initializeWatcher } = require('../../../provider/index.js');
const { ITEM_TYPE } = require('../../../provider/QueueManager.js'); 
const {
    ensureQueueItem,
    generateAudioMa3Name,
    generateAudioMa3UsGbName,
} = require('../mate_libs/voice_tool');

const log = require('#@/ncore/utils/logger/index.js');

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