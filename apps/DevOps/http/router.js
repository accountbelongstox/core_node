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

const rpc = require('#@ncore/utils/rpc');
const { getSystemLoad, parseTopOutput, getSystemMetrics } = require('../http_controller/system.js');
const { getVoiceStatus } = require('../http_controller/voice_status.js');
const { getRowWordByServer, submitAudio, submitAudioSimple } = require('../http_controller/dict_server.js');
const { getDiffAudioTable } = require('../http_controller/sync_audio.js');
const { queryWord, queryWordList } = require('../http_controller/word_query.js');
const { getDevTools, getDevTool, launchDevTool, stopDevTool, getDevToolStats } = require('../http_controller/dev_tools.js');
const { getDevEnvironments, getDevEnvironment, createDevEnvironment, startDevEnvironment, stopDevEnvironment, deleteDevEnvironment, getDevEnvironmentStats } = require('../http_controller/dev_environments.js');
const { executeCode, getSupportedLanguages, getExecutionEnvironment, validateCode } = require('../http_controller/code_executor.js');
const { getPythonStatus, setupPython } = require('../http_controller/python_env.js');

const log = require('#@logger');
const printLog = false;

class RouteInitializer {
    static initializeRoutes() {
        const routerManager = rpc.getRouterManager();

        routerManager.api('/systemload', async (req, res) => {
            const result = await getSystemLoad(req, res);
            return result;
        },printLog);

        routerManager.api('/system/metrics', async (req, res) => {
            const result = await getSystemMetrics(req, res);
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

        routerManager.post('/submit_audio', async (req, res) => {
            const result = await submitAudio(req, res);
            return result;
        },printLog);

        routerManager.post('/submit_audio_simple', async (req, res) => {
            const result = await submitAudioSimple(req, res);
            return result;
        },printLog);

        routerManager.post('/get_diff_audio_table', async (req, res) => {
            const result = await getDiffAudioTable(req, res);
            return result;
        },printLog);

        // Development Tools API
        routerManager.api('/api/devops/tools', async (req, res) => {
            const result = await getDevTools(req, res);
            return result;
        },printLog);

        routerManager.api('/api/devops/tools/:id', async (req, res) => {
            const result = await getDevTool(req, res);
            return result;
        },printLog);

        routerManager.post('/api/devops/tools/:id/launch', async (req, res) => {
            const result = await launchDevTool(req, res);
            return result;
        },printLog);

        routerManager.post('/api/devops/tools/:id/stop', async (req, res) => {
            const result = await stopDevTool(req, res);
            return result;
        },printLog);

        routerManager.api('/api/devops/tools/stats', async (req, res) => {
            const result = await getDevToolStats(req, res);
            return result;
        },printLog);

        // Development Environments API
        routerManager.api('/api/devops/environments', async (req, res) => {
            const result = await getDevEnvironments(req, res);
            return result;
        },printLog);

        routerManager.api('/api/devops/environments/:id', async (req, res) => {
            const result = await getDevEnvironment(req, res);
            return result;
        },printLog);

        routerManager.post('/api/devops/environments', async (req, res) => {
            const result = await createDevEnvironment(req, res);
            return result;
        },printLog);

        routerManager.post('/api/devops/environments/:id/start', async (req, res) => {
            const result = await startDevEnvironment(req, res);
            return result;
        },printLog);

        routerManager.post('/api/devops/environments/:id/stop', async (req, res) => {
            const result = await stopDevEnvironment(req, res);
            return result;
        },printLog);

        routerManager.delete('/api/devops/environments/:id', async (req, res) => {
            const result = await deleteDevEnvironment(req, res);
            return result;
        },printLog);

        routerManager.api('/api/devops/environments/stats', async (req, res) => {
            const result = await getDevEnvironmentStats(req, res);
            return result;
        },printLog);

        // Code Execution API
        routerManager.post('/api/devops/execute', async (req, res) => {
            const result = await executeCode(req, res);
            return result;
        },printLog);

        routerManager.api('/api/devops/execute/languages', async (req, res) => {
            const result = await getSupportedLanguages(req, res);
            return result;
        },printLog);

        routerManager.api('/api/devops/execute/environment', async (req, res) => {
            const result = await getExecutionEnvironment(req, res);
            return result;
        },printLog);

        routerManager.post('/api/devops/execute/validate', async (req, res) => {
            const result = await validateCode(req, res);
            return result;
        },printLog);

        // Python Environment API
        routerManager.api('/python/status', async (req, res) => {
            const result = await getPythonStatus(req, res);
            return result;
        },printLog);

        routerManager.post('/python/setup', async (req, res) => {
            const result = await setupPython(req, res);
            return result;
        },printLog);

    }
}

module.exports = RouteInitializer;
