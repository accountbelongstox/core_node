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