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

const logger = require('#@logger');
const { WrapWordTransItemNotKeepIdKey } = require('../../basetool/db-tool/trans_item_wrap.js');
const { getProviderWordData } = require('../../provider/DataProvider.js');
const { addToMainWordsSet } = require('../../provider/constants/WordCounter.js');
const { dbInsertBulk, dbInsert, dbQuery } = require('#@dbtools');
const prefix = 'WordInsert';
async function insertWordRecords(wordsArray, name = '') {
    const { sequelize, wordModel } = await getProviderWordData();
    try {

        if (!wordsArray || wordsArray.length === 0) {
            logger.warn('No words to insert.');
        }
        await dbInsertBulk(sequelize, {
            model: wordModel,
            prefix: prefix,
            data: wordsArray,
            chunkSize: 10000
        });
        addToMainWordsSet(wordsArray);
        logger.success(`Successfully inserted ${wordsArray.length} records.`);
    } catch (error) {
        logger.error('Error inserting word records:', error);
    }
}
async function insertWordRecordsSafe(wordsArrayOrObject) {
    const { sequelize, wordModel } = await getProviderWordData();
    if (typeof wordsArrayOrObject === 'string') {
        wordsArrayOrObject = [wordsArrayOrObject]
    }
    wordsArrayOrObject = WrapWordTransItemNotKeepIdKey(wordsArrayOrObject);

    try {
        const alreadyContents = await dbQuery(sequelize, {
            model: wordModel,
            attributes: ['content'],
            prefix: prefix,
        });
        if (Array.isArray(wordsArrayOrObject)) {
            wordsArrayOrObject.forEach(async (item) => {
                try {
                    await dbInsert(sequelize, {
                        model: wordModel,
                        data: item
                    });
                    addToMainWordsSet(item.content);
                } catch (error) {
                    logger.error('Error inserting word records:', error);
                }
            });
        } else {
            try {
                await dbInsert(sequelize, {
                    model: wordModel,
                    data: wordsArrayOrObject
                });
                addToMainWordsSet(wordsArrayOrObject.content);
            } catch (error) {
                logger.error('Error inserting word records:', error);
            }
        }
        logger.success(`Successfully inserted ${wordsArray.length} records.`);
    } catch (error) {
        logger.error('Error inserting word records:', error);
    }
}

async function insertContent(contentOrObject) {
    return await insertWordRecordsSafe(contentOrObject);
}

async function insertContentArrayWithRetry(contentArray) {
    return await insertWordRecords(contentArray);
}

async function insertContentArray(contentArray) {
    return await insertWordRecords(contentArray);
}

async function closeWordData() {
    const { close } = await getProviderWordData();
    try {
        await close();
        logger.debug('Word data closed');
    } catch (error) {
        logger.error('Error closing word data:', error);
    }
}
module.exports = {
    insertContent,
    insertContentArray,
    insertContentArrayWithRetry,
    insertWordRecords,
    insertWordRecordsSafe,
    closeWordData
};

