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

const { getWordsByDB, 
    getCountByMainDB, 
    getAllContentByMainDB,
    refreshWordRecords,
    getAllNotLocalStaticWordsOrRecords
} = require('../middware/middb/wordQuery.js');
const { ITEM_TYPE } = require('../provider/types/data_types.js');
const { findLocalVoice } = require('../basetool/voice_tool/check_voice.js');
const { getOrGenerateAudioPy } = require('../basetool/ptools/edge_tts_py.js');
const { datetool,arrtool } = require('#@btools');
const logger = require('#@logger');
const { updateStaticIsExistsByMainDB } = require('../middware/middb/wordUpdate.js');
const { getVoiceGenerationThread } = require('../provider/ThreadProvider.js');
const { VOCABULARY_DIR } = require('../provider/baseDir/BaseDirProvider.js');
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

async function printDatabaseSummary() {
    const type = ITEM_TYPE.WORD;
    const typeName = type === ITEM_TYPE.WORD ? 'Word' : 'Sentence';

    logger.success('-------------------------------------------------------------------------------');
    logger.success(`Database Summary (Startup Statistics) - Type: ${typeName} [${type}]`);
    logger.success('-------------------------------------------------------------------------------');

    const totalCount = await getCountByMainDB(type);
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

    logger.clearRefresh();
    logger.success('-------------------------------------------------------------------------------');
    logger.success(`Final Database Statistics - Type: ${typeName} [${type}]`);
    logger.success(`Total ${typeName} Count: ${totalCount}`);
    logger.success(`${typeName} with Voice Files: ${totalWithVoice} (${((totalWithVoice / totalCount) * 100).toFixed(2)}%)`);
    logger.success(`${typeName} with Image Files: ${totalWithImage} (${((totalWithImage / totalCount) * 100).toFixed(2)}%)`);
    logger.success('-------------------------------------------------------------------------------');
}

async function start_check_voice() {
    const startTime = Date.now();

    const isLocalStaticWords = [];
    const notLocalStaticWords = [];
    const updateSuccessWords = [];
    const updateFailedWords = [];
    const needsUpdateWords = [];
    const notNeedsUpdateWords = [];

    const batchSize = 10000;
    let startIndex = 0;
    logger.info('Refreshing word records...');
    await refreshWordRecords();
    const allWords = await getAllContentByMainDB();
    const mainWordsCount = allWords.length;
    logger.success('-----------Cache refreshed-------------');
    logger.success(`Total words: ${mainWordsCount}`);
    await arrtool.smartDelayForEach(allWords).forEach(async (wordContent, index) => {
        const isExists = await findLocalVoice(wordContent);
        if (!isExists) {
            notLocalStaticWords.push(wordContent);
        } else {
            isLocalStaticWords.push(wordContent);
        }
        const batchEndTime = Date.now();
        const totalDuration = batchEndTime - startTime;
        const useTime = datetool.formatDurationToStr(totalDuration);
        startIndex ++ ;
        logger.progress(
            `Checking static words, Use time: ${useTime} | isExists: ${isLocalStaticWords.length} | notExists: ${notLocalStaticWords.length}`,
            startIndex,
            mainWordsCount
        );
    });

    if (notLocalStaticWords.length > 0) {
        logger.warn(`RealTime Update ${notLocalStaticWords.length} not exists local static words by Scanned...`);
        const updateResult = await updateStaticIsExistsByMainDB(notLocalStaticWords,false);
        logger.info(`updateResult`);
        logger.info(updateResult);
    }
    const notLocalStaticWordsOrRecords = await getAllNotLocalStaticWordsOrRecords(true);
    logger.info(`notLocalStaticWordsOrRecords`);
    logger.info(notLocalStaticWordsOrRecords.length);

    // const endTime = Date.now();
    // const totalDuration = endTime - startTime;

    // // Print processing summary with sample words
    // const sampleNotLocalStaticWords = notLocalStaticWords.slice(0, 100);
    // const sampleIsLocalStaticWords = isLocalStaticWords.slice(0, 100);
    // const sampleUpdateFailedWords = updateFailedWords.slice(0, 100);
    // const sampleNeedsUpdateWords = needsUpdateWords.slice(0, 100);
    // const sampleNotNeedsUpdateWords = notNeedsUpdateWords.slice(0, 100);

    // const sampleIsLocalStaticWordsStr = sampleIsLocalStaticWords.map(item => item.content).join(',');
    // const sampleNotLocalStaticWordsStr = sampleNotLocalStaticWords.map(item => item.content).join(',');
    // const sampleUpdateFailedWordsStr = sampleUpdateFailedWords.map(item => item.content).join(',');
    // const sampleNeedsUpdateWordsStr = sampleNeedsUpdateWords.map(item => item.content).join(',');
    // const sampleNotNeedsUpdateWordsStr = sampleNotNeedsUpdateWords.map(item => item.content).join(',');

    // logger.success(`-------------------------------------------------------------------------------`);
    // logger.success(`Sample of isLocalStaticWords: "${sampleIsLocalStaticWordsStr}"`);
    // logger.success(`-------------------------------------------------------------------------------`);
    // logger.warn(`Sample of notLocalStaticWords: "${sampleNotLocalStaticWordsStr}"`);
    // logger.warn(`-------------------------------------------------------------------------------`);
    // if (updateFailedWords.length > 0) {
    //     logger.error(`Sample of update failed words: "${sampleUpdateFailedWordsStr}"`);
    //     logger.error(`-------------------------------------------------------------------------------`);
    // }
    // logger.info(`Sample of words needing update: "${sampleNeedsUpdateWordsStr}"`);
    // logger.info(`-------------------------------------------------------------------------------`);
    // logger.info(`Sample of words already updated: "${sampleNotNeedsUpdateWordsStr}"`);
    // logger.info(`-------------------------------------------------------------------------------`);

    // logger.success(`Processing completed in ${datetool.formatDurationToStr(totalDuration)}`);
    // logger.success(`Total words processed: ${mainWordsCount}`);
    // logger.success(`Total generated words: ${generatedWords.length}`);
    // logger.warn(`Total not generated words: ${notGeneratedWords.length}`);
    // logger.success(`Total update success words: ${updateSuccessWords.length}`);
    // if (updateFailedWords.length > 0) {
    //     logger.error(`Total update failed words: ${updateFailedWords.length}`);
    // }
    // logger.info(`Total words needing update: ${needsUpdateWords.length}`);
    // logger.info(`Total words already updated: ${notNeedsUpdateWords.length}`);

    // // Add database summary at the end
    // logger.info('\nGenerating database summary...');
    // await printDatabaseSummary();
}

module.exports = {
    start_check_voice,
    startWordProcessingByServer,
    processNextWordByServer
};


