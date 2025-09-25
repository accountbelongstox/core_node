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

const RouterManager = require('#@/ncore/foundation/express_utils/libs/RouterManager.js');
const { getSystemLoad, parseTopOutput } = require('../http_controller/system.js');
const { getVoiceStatus } = require('../http_controller/voice_status.js');
const { getRowWordByServer, submitAudio, submitAudioSimple } = require('../http_controller/dict_server.js');
const { getDiffAudioTable } = require('../http_controller/sync_audio.js');
const { queryWord, queryWordList } = require('../http_controller/word_query.js');

const log = require('#@logger');
const printLog = false;

class RouteInitializer {
    static initializeRoutes() {
        RouterManager.api('/systemload', async (req, res) => {
            const result = await getSystemLoad(req, res);
            return result;
        },printLog);

        RouterManager.api('/query', async (req, res) => {
            const result = await queryWord(req, res);
            return result;
        },printLog);

        RouterManager.api('/query_words', async (req, res) => {
            const result = await queryWordList(req, res);
            return result;
        },printLog);

        RouterManager.api('/voice_status', async (req, res) => {
            const result = await getVoiceStatus(req, res);
            return result;
        },printLog);

        RouterManager.api('/get_row_word', async (req, res) => {
            const result = await getRowWordByServer(req, res);
            return result;
        },printLog);

        RouterManager.post('/submit_audio', async (req, res) => {
            const result = await submitAudio(req, res);
            return result;
        },printLog);

        RouterManager.post('/submit_audio_simple', async (req, res) => {
            const result = await submitAudioSimple(req, res);
            return result;
        },printLog);

        RouterManager.post('/get_diff_audio_table', async (req, res) => { 
            const result = await getDiffAudioTable(req, res);
            return result;
        },printLog);

    }
}

module.exports = RouteInitializer;
