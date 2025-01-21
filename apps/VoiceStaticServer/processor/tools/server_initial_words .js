const { getUniqueContentLines } = require('./word_unique_content_lines.js');
const { getWordsByDB, getContentCount } = require('../../db-apply/libs/db_query.js');
const { bulkUpdateContent } = require('../../db-apply/libs/db_update.js');
const { forceRefreshCache, getCachedItem } = require('../../db-apply/libs/db_content_check.js');
const { addWordBack, getWordFront, getWordCount, ITEM_TYPE } = require('../../provider/QueueManager.js');
const { VOCABULARY_DIR, META_DIR, initWordTotalCount } = require('../../provider/index');
const { checkVoice } = require('./libs/check_voice.js');
const { getOrGenerateAudioPy } = require('./edge_tts_py.js');
const { formatDurationToStr } = require('#@/ncore/utils/tool/libs/datetool.js');
const logger = require('#@logger');

async function startWordProcessingByServer() {
    const wordCount = getWordCount();
    if (wordCount > 0) {
        processNextWordByServer();
    } else {
        logger.success('All words are processed,waiting for new words');
        setTimeout(() => {
            startWordProcessingByServer();
        }, 500);
    }
}

async function processNextWordByServer() {
    try {
        const nextWord = getWordFront();
        await getOrGenerateAudioPy(nextWord, () => {

        });
    } catch (error) {
        logger.error('Error processing word:', error);
    } finally {
        setTimeout(() => {
            startWordProcessingByServer();
        }, 500);
    }
}

/**
 * Print database statistics summary
 */
async function printDatabaseSummary() {
    const type = ITEM_TYPE.WORD;
    const typeName = type === ITEM_TYPE.WORD ? 'Word' : 'Sentence';

    logger.success('-------------------------------------------------------------------------------');
    logger.success(`Database Summary (Startup Statistics) - Type: ${typeName} [${type}]`);
    logger.success('-------------------------------------------------------------------------------');

    const totalCount = await getContentCount(type);
    let startIndex = 0;
    const batchSize = 10000;

    let totalWithVoice = 0;
    let totalWithImage = 0;

    while (startIndex < totalCount) {
        const batch = await getWordsByDB(startIndex, startIndex + batchSize);
        if (!batch || batch.length === 0) break;

        // Count items with voice_files and image_files
        for (const item of batch) {
            if (item.voice_files && item.voice_files.length > 0) totalWithVoice++;
            if (item.image_files && item.image_files.length > 0) totalWithImage++;
        }

        // Show progress
        logger.progressBar(startIndex + batch.length, totalCount, {
            format: `Analyzing ${typeName} database: [{bar}] {percentage}% | ${startIndex + batch.length}/${totalCount} | ` +
                `With Voice: ${totalWithVoice} | With Image: ${totalWithImage}`
        });

        startIndex += batchSize;
    }

    // Clear progress bar and print final statistics
    logger.clearRefresh();
    logger.success('-------------------------------------------------------------------------------');
    logger.success(`Final Database Statistics - Type: ${typeName} [${type}]`);
    logger.success(`Total ${typeName} Count: ${totalCount}`);
    logger.success(`${typeName} with Voice Files: ${totalWithVoice} (${((totalWithVoice / totalCount) * 100).toFixed(2)}%)`);
    logger.success(`${typeName} with Image Files: ${totalWithImage} (${((totalWithImage / totalCount) * 100).toFixed(2)}%)`);
    logger.success('-------------------------------------------------------------------------------');
}

async function initialize_server() {
    const startTime = Date.now();
    const vocabularyCountFromDb = Number(await getUniqueContentLines(VOCABULARY_DIR));
    const generatedWords = [];
    const notGeneratedWords = [];
    const updateSuccessWords = [];
    const updateFailedWords = [];
    const needsUpdateWords = [];      // Track words needing update
    const notNeedsUpdateWords = [];   // Track words not needing update

    const batchSize = 10000;
    let startIndex = 0;
    let vocabulary = [];
    let updateBatch = [];  // Collection for batch updates
    logger.log('Total vocabulary count:', vocabularyCountFromDb);
    await forceRefreshCache(ITEM_TYPE.WORD);
    logger.success('-----------Cache refreshed-------------');
    while (startIndex < vocabularyCountFromDb) {
        const batchStartTime = Date.now();
        const batch = await getWordsByDB(startIndex, startIndex + batchSize);
        if (!batch || batch.length === 0) {
            break;
        }
        vocabulary = Array.from(batch);

        for (const queueItem of vocabulary) {
            const validFile = await checkVoice(queueItem);
            if (!validFile) {
                addWordBack(queueItem);
                notGeneratedWords.push(queueItem);
            } else {
                queueItem.voice_files = validFile;
                // Get cached item and check voice_files
                const cachedItem = await getCachedItem(queueItem.content, ITEM_TYPE.WORD);
                const needsUpdate = !cachedItem || !cachedItem.voice_files || cachedItem.voice_files.length === 0;

                if (needsUpdate) {
                    updateBatch.push({
                        id: queueItem.id,
                        content: queueItem,
                        type: ITEM_TYPE.WORD
                    });
                    needsUpdateWords.push(queueItem);
                } else {
                    notNeedsUpdateWords.push(queueItem);
                }
                generatedWords.push(queueItem);
            }
        }

        // Execute batch update when reaching threshold or final batch
        if (updateBatch.length >= 1000 || startIndex + batch.length >= vocabularyCountFromDb) {
            if (updateBatch.length > 0) {
                const updateResult = await bulkUpdateContent(updateBatch);
                updateSuccessWords.push(...updateBatch.slice(0, updateResult.success));
                updateFailedWords.push(...updateBatch.slice(updateResult.success));
                updateBatch = []; // Clear the batch after processing
            }
        }

        const batchEndTime = Date.now();
        const batchDuration = batchEndTime - batchStartTime;
        const totalDuration = batchEndTime - startTime;

        // Update progress bar with needs update statistics
        logger.progressBar(startIndex + batch.length, vocabularyCountFromDb, {
            format: `Processing words: [{bar}] {percentage}% | ${startIndex + batch.length}/${vocabularyCountFromDb} | ` +
                `Batch time: ${formatDurationToStr(batchDuration)} | ` +
                `Total time: ${formatDurationToStr(totalDuration)} | ` +
                `Generated: ${generatedWords.length} | Not Generated: ${notGeneratedWords.length} | ` +
                `Update Success: ${updateSuccessWords.length} | Update Failed: ${updateFailedWords.length} | ` +
                `Needs Update: ${needsUpdateWords.length} | Already Updated: ${notNeedsUpdateWords.length}`
        });

        startIndex += batchSize;
    }

    // Process remaining items in the final batch
    if (updateBatch.length > 0) {
        const updateResult = await bulkUpdateContent(updateBatch);
        updateSuccessWords.push(...updateBatch.slice(0, updateResult.success));
        updateFailedWords.push(...updateBatch.slice(updateResult.success));
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    await initWordTotalCount(notGeneratedWords.length, notGeneratedWords.length, 0, notGeneratedWords.length);

    // Print processing summary with sample words
    const sampleNotGeneratedWords = notGeneratedWords.slice(0, 100);
    const sampleGeneratedWords = generatedWords.slice(0, 100);
    const sampleUpdateFailedWords = updateFailedWords.slice(0, 100);
    const sampleNeedsUpdateWords = needsUpdateWords.slice(0, 100);
    const sampleNotNeedsUpdateWords = notNeedsUpdateWords.slice(0, 100);

    const sampleGeneratedWordsStr = sampleGeneratedWords.map(item => item.content).join(',');
    const sampleNotGeneratedWordsStr = sampleNotGeneratedWords.map(item => item.content).join(',');
    const sampleUpdateFailedWordsStr = sampleUpdateFailedWords.map(item => item.content).join(',');
    const sampleNeedsUpdateWordsStr = sampleNeedsUpdateWords.map(item => item.content).join(',');
    const sampleNotNeedsUpdateWordsStr = sampleNotNeedsUpdateWords.map(item => item.content).join(',');

    logger.success(`-------------------------------------------------------------------------------`);
    logger.success(`Sample of generated words: "${sampleGeneratedWordsStr}"`);
    logger.success(`-------------------------------------------------------------------------------`);
    logger.warn(`Sample of not generated words: "${sampleNotGeneratedWordsStr}"`);
    logger.warn(`-------------------------------------------------------------------------------`);
    if (updateFailedWords.length > 0) {
        logger.error(`Sample of update failed words: "${sampleUpdateFailedWordsStr}"`);
        logger.error(`-------------------------------------------------------------------------------`);
    }
    logger.info(`Sample of words needing update: "${sampleNeedsUpdateWordsStr}"`);
    logger.info(`-------------------------------------------------------------------------------`);
    logger.info(`Sample of words already updated: "${sampleNotNeedsUpdateWordsStr}"`);
    logger.info(`-------------------------------------------------------------------------------`);

    logger.success(`Processing completed in ${formatDurationToStr(totalDuration)}`);
    logger.success(`Total words processed: ${vocabularyCountFromDb}`);
    logger.success(`Total generated words: ${generatedWords.length}`);
    logger.warn(`Total not generated words: ${notGeneratedWords.length}`);
    logger.success(`Total update success words: ${updateSuccessWords.length}`);
    if (updateFailedWords.length > 0) {
        logger.error(`Total update failed words: ${updateFailedWords.length}`);
    }
    logger.info(`Total words needing update: ${needsUpdateWords.length}`);
    logger.info(`Total words already updated: ${notNeedsUpdateWords.length}`);

    // Add database summary at the end
    logger.info('\nGenerating database summary...');
    await printDatabaseSummary();
}

module.exports = {
    initialize_server,
    startWordProcessingByServer,
    processNextWordByServer
};


