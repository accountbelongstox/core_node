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