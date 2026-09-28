const { getSystemLoad, parseTopOutput } = require('../http_controller/system.js');
const { getVoiceStatus } = require('../http_controller/voice_status.js');
const { getRowWordByServer, submitAudio, submitAudioSimple } = require('../http_controller/dict_server.js');
const { getDiffAudioTable } = require('../http_controller/sync_audio.js');
const { queryWord, queryWordList } = require('../http_controller/word_query.js');

const log = require('#@logger');
const printLog = false;

class RouteInitializer {
    static initializeRoutes(routerManager) {
        if (!routerManager) {
            log.error('RouterManager is required');
            return;
        }

        routerManager.api('/systemload', async (req, res) => {
            const result = await getSystemLoad(req, res);
            return result;
        },printLog);

        routerManager.api('/query', async (req, res) => {
            const result = await queryWord(req, res);
            return result;
        },printLog);

        routerManager.api('/query_words', async (req, res) => {
            const result = await queryWordList(req, res);
            return result;
        },printLog);

        routerManager.api('/voice_status', async (req, res) => {
            const result = await getVoiceStatus(req, res);
            return result;
        },printLog);

        routerManager.api('/get_row_word', async (req, res) => {
            const result = await getRowWordByServer(req, res);
            return result;
        },printLog);

        routerManager.api('/submit_audio', async (req, res) => {
            const result = await submitAudio(req, res);
            return result;
        },printLog);

        routerManager.api('/submit_audio_simple', async (req, res) => {
            const result = await submitAudioSimple(req, res);
            return result;
        },printLog);

        routerManager.api('/get_diff_audio_table', async (req, res) => {
            const result = await getDiffAudioTable(req, res);
            return result;
        },printLog);

    }
}

module.exports = RouteInitializer;
