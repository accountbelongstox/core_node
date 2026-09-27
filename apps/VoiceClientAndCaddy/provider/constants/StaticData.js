const sysarg = require('#@ncore/utils/systool/libs/sysarg.js');
const gconfig = require('#@gconfig');
const START_TIME = Date.now();
const ARG_CLIENT = sysarg.getArg('client');
const ARG_SERVER = sysarg.getArg('server');
const REBUILD_MAIN_DB = sysarg.getArg('rebuildmaindb');
const ROLE = ARG_SERVER ? 'server' : 'client';
const IS_SERVER = ROLE == 'server';
const IS_CLIENT = !IS_SERVER;
const SERVER_URL = gconfig.getConfig(`SERVER_URL`);
const CLIENTS_URL = gconfig.getConfig(`CLIENTS_URL`).split(',');

const SUBMIT_AUDIO_URL = `${SERVER_URL}/submit_audio`;
const GET_ROW_WORD_URL = `${SERVER_URL}/get_row_word`;
const SUBMIT_AUDIO_SIMPLE_URL = `${SERVER_URL}/submit_audio_simple`;

module.exports = {
    ARG_CLIENT,
    ARG_SERVER,
    ROLE,
    IS_SERVER,
    IS_CLIENT,
    START_TIME,
    SERVER_URL,
    CLIENTS_URL,
    SUBMIT_AUDIO_URL,
    GET_ROW_WORD_URL,
    SUBMIT_AUDIO_SIMPLE_URL,
    REBUILD_MAIN_DB
};