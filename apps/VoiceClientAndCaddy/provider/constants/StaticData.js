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