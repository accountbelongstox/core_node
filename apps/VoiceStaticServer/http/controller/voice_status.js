const { getWordStatus,ROLE,IS_CLIENT,IS_SERVER, initializeWatcher } = require('../../provider/index.js');
const { getSubmissionServerList, getSubmissionServerCount } = require('./dict_server.js');
const { getSubmissionClientList, getSubmissionClientCount } = require('./dict_client.js');

async function getVoiceStatus() {
    
    const { 
        DICT_SOUND_WATCHER,
        SENTENCES_SOUND_WATCHER 
    } = await initializeWatcher();
    const wordStatus = await getWordStatus();
    const submissionCount = IS_SERVER ? await getSubmissionServerCount() : await getSubmissionClientCount();
    // const submissionList = IS_SERVER ? getSubmissionServerList() : getSubmissionClientList();
    let clientStatus = null;
    let serverStatus = null;
    if(IS_CLIENT){
        const {file,index,loopCount} = DICT_SOUND_WATCHER.getNextFileAndIndex();
        clientStatus = {
            file,
            index,
            loopCount,
            submissionCount,
        }
    }
    if(IS_SERVER){
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
            // submissionList,
        }
    }
}

module.exports = {
    getVoiceStatus
};