const RouterManager = require('#@/ncore/utils/express/libs/RouterManager.js');
const { getSystemLoad, parseTopOutput } = require('../controller/system.js');
const { getVoiceStatus } = require('../controller/voice_status.js');
const { getRowWord, submitAudio, submitAudioSimple } = require('../controller/dict_server.js');

let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args)
    };
}

class RouteInitializer {
    static initializeRoutes() {
        RouterManager.api('/systemload', async (req, res) => {
            const result = await getSystemLoad();
            return result;
        });

        RouterManager.api('/voice_status', async (req, res) => {
            const result = await getVoiceStatus();
            return result;
        });

        
        RouterManager.api('/get_row_word', async (req, res) => {
            const result = await getRowWord();
            return result;
        });

        RouterManager.post('/submit_audio', async (req, res) => {
            const result = await submitAudio(req, res);
            return result;
        });

        RouterManager.post('/submit_audio_simple', async (req, res) => {
            const result = await submitAudioSimple(req, res);
            return result;
        });

    }
}

module.exports = RouteInitializer;
