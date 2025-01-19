const RouterManager = require('#@/ncore/utils/express/libs/RouterManager.js');
const { getSystemLoad, parseTopOutput } = require('../controller/system.js');
const { getVoiceStatus } = require('../controller/voice_status.js');
const { getRowWordByServer, submitAudio, submitAudioSimple } = require('../controller/dict_server.js');
const { getDiffAudioTable } = require('../controller/sync_audio.js');

const log = require('#@logger');

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
            const result = await getRowWordByServer();
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

        RouterManager.post('/get_diff_audio_table', async (req, res) => { 
            const result = await getDiffAudioTable(req, res);
            return result;
        });

    }
}

module.exports = RouteInitializer;
