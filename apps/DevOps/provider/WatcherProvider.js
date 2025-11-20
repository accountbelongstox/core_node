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
const { Fmonitor } = require('#@ftools');
const { DICT_SOUND_DIR, SENTENCES_SOUND_DIR, TEST_DIR,OLD_BING_VOICE_DIR } = require('./baseDir/BaseDirProvider.js');

let DICT_SOUND_WATCHER = null;
let SENTENCES_SOUND_WATCHER = null;
let OLD_BING_VOICE_WATCHER = null;
const options = {
    rescanInterval:1000 * 1000,
}
async function initializeWatcher() {
    if (!DICT_SOUND_WATCHER) {
        DICT_SOUND_WATCHER = new Fmonitor(DICT_SOUND_DIR,options);
        console.log('DICT_SOUND_WATCHER',DICT_SOUND_WATCHER)

        await DICT_SOUND_WATCHER.initialize();
    }
    if (!SENTENCES_SOUND_WATCHER) {
        SENTENCES_SOUND_WATCHER = new Fmonitor(SENTENCES_SOUND_DIR,options);
        await SENTENCES_SOUND_WATCHER.initialize();
    }
    if (!OLD_BING_VOICE_WATCHER) {
        OLD_BING_VOICE_WATCHER = new Fmonitor(OLD_BING_VOICE_DIR,options);
        await OLD_BING_VOICE_WATCHER.initialize();
    }
    return {
        DICT_SOUND_WATCHER,
        SENTENCES_SOUND_WATCHER,
        OLD_BING_VOICE_WATCHER
    }
}
async function getDICTSoundWatcher() {
    await initializeWatcher();
    return DICT_SOUND_WATCHER;
}
async function getSENTENCESSoundWatcher() {
    await initializeWatcher();
    return SENTENCES_SOUND_WATCHER;
}
async function getOLD_BING_VOICEWatcher() {
    await initializeWatcher();
    return OLD_BING_VOICE_WATCHER;
}
module.exports = {
    initializeWatcher,
    getDICTSoundWatcher,
    getSENTENCESSoundWatcher,
    getOLD_BING_VOICEWatcher
};