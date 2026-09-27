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