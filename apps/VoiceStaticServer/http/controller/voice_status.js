const { getWordStatus, ROLE, IS_CLIENT, IS_SERVER, initializeWatcher } = require('../../provider/index.js');
const { getSystemLoadRaw } = require('./system.js');
const { getSubmissionServerCount } = require('./dict_server.js');
const { getSubmissionClientCount } = require('./dict_client.js');

async function getVoiceStatus() {
    // const {
    //     DICT_SOUND_WATCHER,
    //     SENTENCES_SOUND_WATCHER
    // } = await initializeWatcher();
    const wordStatus = await getWordStatus();
    const summary = await getSystemLoadRaw();
    const submissionCount = IS_SERVER ? await getSubmissionServerCount() : await getSubmissionClientCount();
    let clientStatus = null;
    let serverStatus = null;
    if (IS_CLIENT) {
        clientStatus = {
            submissionCount,
        }
    }
    if (IS_SERVER) {
        serverStatus = {
        }
    }
    return {
        success: true,
        message: 'Get voice status',
        data: {
            ...wordStatus,
            role: ROLE,
            isServer: IS_SERVER,
            isClient: IS_CLIENT,
            clientStatus,
            serverStatus,
            summary,
        }
    }
}

module.exports = {
    getVoiceStatus
};