const { VoiceGenerationThread } = require('../libs/start_voice_gen_thread.js');
const logger = require('#@logger');
let voiceGenerationThread = null;
async function getVoiceGenerationThread() {
    const threadName = `voice_generate`;
    if (!voiceGenerationThread) {
        logger.debug(`start voice generation thread`);
        voiceGenerationThread = new VoiceGenerationThread();
        await voiceGenerationThread.start(threadName);
        logger.debug(`thread name: ${threadName} already started`);
    }
    return {
        voiceGenerationThread,
        threadName
    };
}
module.exports = {
    getVoiceGenerationThread
}
