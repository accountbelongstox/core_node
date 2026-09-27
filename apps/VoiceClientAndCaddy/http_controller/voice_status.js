const {
    ROLE, IS_CLIENT, IS_SERVER,
} = require('../provider/constants/StaticData.js');
const { getStaticData } = require('../provider/constants/WordDynamicData.js');
const { getDICTSoundWatcher, getOLD_BING_VOICEWatcher } = require('../provider/WatcherProvider.js');

async function getVoiceStatus() {
    const staticData = await getStaticData();
    const DICT_SOUND_WATCHER = await getDICTSoundWatcher();
    const OLD_BING_VOICE_WATCHER = await getOLD_BING_VOICEWatcher();
    let clientStatus = null;
    if (IS_CLIENT) {
        clientStatus = {}
    }
    const staticStatus = {
        wordSoundCount: DICT_SOUND_WATCHER.getFilesSet().size,
        oldVoiceCount: OLD_BING_VOICE_WATCHER.getFilesSet().size,
    };
    return {
        success: true,
        message: 'Get voiceStaticService status',
        data: {
            staticStatus,
            staticData
        }
    }
}

module.exports = {
    getVoiceStatus
};