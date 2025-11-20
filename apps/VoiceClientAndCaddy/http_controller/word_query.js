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

const { findLocalVoice } = require('../basetool/voice_tool/check_voice.js');
const {
    getContentsFromMainDBByWordsArray,
    getContentFromMainDBByContent
} = require('../middware/middb/wordQuery.js');
const { getAnyParam } = require('#@ncore/utils/rpc/http_rpc/libs/res_helper.js');
const { queryWordQueryCache, putWordQueryCache } = require('../middware/cacheMainMid.js');
const gconfig = require('#@gconfig');
function formatResponse(records, success = true, message = '') {
    return {
        success,
        static_path:gconfig.getConfig(`DICT_SOUND_STATIC_NAME`),
        message: message || (success ? 'Operation successful' : 'Operation failed'),
        data: Array.isArray(records) ? records : (records ? [records] : [])
    };
}

async function queryWord(req, res, next) {
    const word = getAnyParam(req, 'word');
    const result = await queryWordsFromList([word]);
    return result;
}


async function queryWordList(req, res, next) {
    const word = getAnyParam(req, 'word');
    const words = getAnyParam(req, 'words');
    const queryList = word ? word : words;
    const result = await queryWordsFromList(queryList);
    return result;
}

async function queryWordsFromList(queryList) {
    let message = '';
    if (queryList) {
        queryList = Array.isArray(queryList) ? queryList : queryList.split(',');
        let cacheRecords = [];
        let needQueryList = [];
        for (let i = 0; i < queryList.length; i++) {
            const word = queryList[i];
            const cacheRecord = await queryWordQueryCache(word);
            if (cacheRecord) {
                cacheRecord.isCache = true;
                cacheRecords.push(cacheRecord);
            } else {
                needQueryList.push(word);
            }
        }

        const DBRecords = await getContentsFromMainDBByWordsArray(needQueryList);
        if (DBRecords && DBRecords.length > 0) {
            for (let i = 0; i < DBRecords.length; i++) {
                const record = DBRecords[i];
                record.voice_files = await findLocalVoice(record.content);
                if (record.voice_files) {
                    await putWordQueryCache(record.md5, record.content, record);
                }
            }
        }
        return formatResponse(cacheRecords.concat(DBRecords), true, message);
    } else {
        message = 'Missing required fields: word';
        return formatResponse(null, false, message);
    }
}


module.exports = {
    queryWord,
    queryWordList
};