const { getWordStatus } = require('../../provider/index.js');

async function getVoiceStatus() {
    return await getWordStatus();
}

module.exports = {
    getVoiceStatus
};