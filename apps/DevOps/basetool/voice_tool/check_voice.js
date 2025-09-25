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
const { strtool } = require('#@btools');
const {
    generateGbNormalName,
    generateUsNormalName,
} = require('./voice_name_gen');
const {
    generateUKName,
    generateUSName,
    generateTTSName,
} = require('./voice_oldname_gen');
const { getDICTSoundWatcher, getOLD_BING_VOICEWatcher } = require('../../provider/WatcherProvider');

const generateVoiceName = async (content,md5) => {
    const audioMap = {
        gbEdge: await generateGbNormalName(content,md5),
        usEdge: await generateUsNormalName(content,md5),
        tts: await generateTTSName(content,md5),
        ukBing: await generateUKName(content,md5),
        usBing: await generateUSName(content,md5),
    };
    return audioMap;
};

const findLocalVoice = async (content,md5) => {
    const DWatcher = await getDICTSoundWatcher();
    const OVWatcher = await getOLD_BING_VOICEWatcher();
    try {
        if(!md5)md5 = strtool.generateMd5(content);
        let findVoiceMap = null
        const audioMap = await generateVoiceName(content,md5);
        for (const [key, value] of Object.entries(audioMap)) {
            if (key.includes('Bing') || key.includes('tts')) {
                const findVoiceFile = await OVWatcher.find(value, false);
                if (findVoiceFile) {
                    if (!findVoiceMap) findVoiceMap = {}
                    findVoiceMap[key] = findVoiceFile;
                }
            } else {
                const findVoiceFile = await DWatcher.find(value, false);
                if (findVoiceFile) {
                    if (!findVoiceMap) findVoiceMap = {}
                    findVoiceMap[key] = findVoiceFile;
                }
            }
        }
        return findVoiceMap;
    } catch (e) {
        logger.error(`Error checking MP3 file: ${e.message} ${e.stack}`);
        return null;
    }
};

module.exports = {
    findLocalVoice,
}
