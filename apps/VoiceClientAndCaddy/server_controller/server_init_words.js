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

const { getUniqueContentLines } = require('../libs/analyze_unique_line.js');
const { VOCABULARY_DIR } = require('../provider/baseDir/BaseDirProvider.js');
const logger = require('#@logger');
const { refreshWordRecords, getCountByMainDB, getContentsFromMainDBByWordsArray, getWordsByDB, getAllContentByMainDB } = require('../middware/middb/wordQuery.js');
const { getMainWordsSetCountObject } = require('../provider/constants/WordCounter.js');
const { WrapWordTransItemNotKeepIdKey } = require('../basetool/db-tool/trans_item_wrap.js');
const { insertContentArray } = require('../middware/middb/wordInsert.js');
const { diffToMainWordsSet } = require('../provider/constants/WordCounter.js');
const { canAccess } = require('#@ncore/utils/net/libs/nettest.js');
const { USER_API_URL, USER_SERVER_URL, USER_API_CLIENT_TOKEN } = require('#@gconfig');
const { isServer } = require('#@global_vars');
const { post } = require('#@ncore/utils/net/libs/requests.js');
const { serverSyncStatus } = require('../provider/constants/WordDynamicData.js');
let isProcessingByApi = false;

async function initialize_by_local() {
    const wordsArray = await getUniqueContentLines(VOCABULARY_DIR)
    await refreshWordRecords();
    const diffWords = diffToMainWordsSet(wordsArray, true);
    const insertedItems = [];
    for (const content of diffWords) {
        const wordQueueItem = await WrapWordTransItemNotKeepIdKey(content);
        insertedItems.push(wordQueueItem);
    }
    await insertContentArray(insertedItems);
    const mainWordsSetCountObject = getMainWordsSetCountObject();
    const vocabularyCountFromDb = mainWordsSetCountObject.size;
    await refreshWordRecords();
    logger.success(`Total words processed: ${vocabularyCountFromDb}`);

}

async function initialize_by_api() {
    let success_count = 0;
    let rate = 0;
    let userServerAllRecords = -1;
    let userServerHasTranslation = -1;
    let userServerHasVoice = -1;
    try {
        // Update status to in progress
        serverSyncStatus.updateSyncStatus('in_progress');

        if (isProcessingByApi) {
            logger.warn('Already processing by api, skip');
            return;
        }
        isProcessingByApi = true;
        let contents = await getAllContentByMainDB();
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Client-Token': `${USER_API_CLIENT_TOKEN}`
        }
        const add_dictionary_url = `${USER_API_URL}/add_dictionary`
        const find_non_existing_dictionary_url = `${USER_API_URL}/find_non_existing_dictionary`
        logger.success(`post to ${find_non_existing_dictionary_url}, contents: ${contents.length}`);
        const getData = await post(find_non_existing_dictionary_url, { contents }, { headers });
        logger.success(`getData Response`);
        console.log(getData);
        const missing_count = getData?.missing_count || 0;
        const missing_entries = getData?.missing_entries || [];
        userServerAllRecords = getData?.all_records || 0;
        userServerHasTranslation = getData?.has_translation || 0;
        userServerHasVoice = getData?.has_voice || 0;
        logger.warn(`Total missing words: ${missing_count}`);
        logger.warn(`Total missing entries: ${missing_entries.length}`);
        logger.warn(`Total all records: ${userServerAllRecords}`);
        logger.warn(`Total has translation: ${userServerHasTranslation}`);
        logger.warn(`Total has voice: ${userServerHasVoice}`);

        const BATCH_SIZE = 2000;
        let processed_count = 0;

        while (processed_count < missing_entries.length) {
            const current_batch = missing_entries.slice(processed_count, processed_count + BATCH_SIZE);

            const updating_entries = await getContentsFromMainDBByWordsArray(current_batch);
            logger.warn(`Fetched ${updating_entries.length} entries for processing`);

            if (updating_entries.length > 0) {
                try {
                    const response = await post(
                        add_dictionary_url,
                        { entries: updating_entries },
                        { headers }
                    );

                    const data = response?.data;
                    console.log(response);
                    success_count += updating_entries.length;
                    logger.success(`Processed batch: ${updating_entries.length} entries | Total: ${success_count}/${missing_entries.length}`);
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (error) {
                    logger.error(`Failed to process batch: ${error.message}`);
                }
            }

            processed_count += BATCH_SIZE;
        }

        if (success_count == 0 && missing_entries.length == 0) {
            rate = 0;
        } else {
            rate = ((success_count / missing_entries.length) * 100).toFixed(2);
        }
        // Calculate completion rate
        const totalEntries = missing_entries.length;
        const processedEntries = success_count;
        const completionRate = totalEntries > 0 ? (processedEntries / totalEntries) * 100 : 0;

        // Update status on success
        serverSyncStatus.updateSyncStatus(
            'success',
            processedEntries,
            completionRate,
            null,
            userServerAllRecords,
            userServerHasTranslation,
            userServerHasVoice
        );

        logger.info(`Server sync completed successfully. Total entries processed: ${processedEntries}, Completion rate: ${completionRate.toFixed(2)}%`);

        return {
            success: true,
            message: 'Initialization completed successfully',
            data: {
                totalProcessed: processedEntries,
                completionRate: completionRate,
                lastSyncTime: serverSyncStatus.lastSyncTime,
                userServerAllRecords: userServerAllRecords,
                userServerHasTranslation: userServerHasTranslation,
                userServerHasVoice: userServerHasVoice
            }
        };
    } catch (error) {
        // Update status on failure
        serverSyncStatus.updateSyncStatus(
            'failed',
            0,
            0,
            error.message,
            userServerAllRecords,
            userServerHasTranslation,
            userServerHasVoice
        );

        logger.error('Server sync failed:', error);

        return {
            success: false,
            message: 'Initialization failed',
            error: error.message
        };
    } finally {
        isProcessingByApi = false;

        logger.success(`
            🎉 Batch processing complete!
            ➤ Total entries processed: ${success_count}
            ➤ Completion rate: ${rate}%
        `);

    }
}

async function initialize_server() {
    const canAccessResult = await canAccess(USER_SERVER_URL);
    await initialize_by_local();
    if (canAccessResult) {
        logger.success(`Can access user server`);
        logger.success(`Initialize by api isServer: ${isServer} / url: ${USER_SERVER_URL}`);
    } else {
        logger.warn(`Cannot access user server isServer: ${isServer} / url: ${USER_SERVER_URL}`);
    }
}

module.exports = {
    initialize_server,
    initialize_by_local,
    initialize_by_api
};


