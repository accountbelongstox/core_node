// const { addWordBack, getWordFront, getWordCount, ITEM_TYPE } = require('../../provider/QueueManager.js');
const { OLD_DB_DIR, TRANSLATE_TMP_DIR,TRANSLATE_DIR } = require('../../provider/index');
const { query } = require('#@/ncore/utils/db_tool/sequelize-oporate/sequelize_query.js');
const { hardDelete } = require('#@/ncore/utils/db_tool/sequelize-oporate/sequelize_delete.js');
const path = require('path');
const fs = require('fs').promises;
const { downloadFile } = require('#@/ncore/basic/libs/downloader.js');
const { formatDurationToStr } = require('#@/ncore/utils/tool/libs/datetool.js');
const { getOldDatabase } = require('#@/ncore/utils/db_tool/sequelize_db.js');
const logger = require('#@logger');
const FileMonitor = require('#@/ncore/utils/ftool/libs/fmonitor.js');
const gconfig = require('#@/ncore/gvar/gconfig.js');
const dbUrl = gconfig.getConfig(`OLD_DB_URL`);
const { writeJson, exists } = require('#@/ncore/basic/libs/fwriter.js');
const dataOldName = gconfig.getConfig(`OLD_DB_NAME`);
const dbPath = path.join(OLD_DB_DIR, dataOldName);
const { sequelize_init_tables } = require('../../provider/types/old_data_types.js');
const { smartDelayForEach } = require('#@/ncore/utils/tool/libs/arrtool.js');
const { generateMd5, wordToFileName } = require('#@/ncore/utils/tool/libs/strtool.js');
const zipTool = require('#@/ncore/utils/tool/zip-tool/index.js');

/**
 * Parse record and its translate_bing field
 * @param {Object} record - Database record
 * @returns {Object} Parsed record with word, translate_bing and last_time
 */
function parseTranslationRecord(record) {
    try {
        let translation = record.translate_bing;
        if (typeof translation === 'string') {
            translation = JSON.parse(translation);
        }

        if (translation.translation) {
            translation = translation.translation;
        }

        return {
            content: record.word,
            translation,                            // Translation data
            lastModified: record.last_time,        // Last modification time
            usPhonetic: record.phonetic_us,        // US phonetic with symbols
            usPhoneticRaw: record.phonetic_us_sort,// US phonetic without symbols
            ukPhonetic: record.phonetic_uk,        // UK phonetic with symbols
            ukPhoneticRaw: record.phonetic_uk_sort // UK phonetic without symbols
        };
    } catch (error) {
        logger.error('Error parsing record:', error);
        return null;
    }
}

async function startInputOldDataTranslate() {
    const monitor = new FileMonitor(OLD_DB_DIR, (file) => {
        console.log(file);
    });
    await monitor.initialize();
    // const isValideDbFile = await compareFileSize(dbPath,dbUrl,true)
    if (!fs.access(dbPath)) {
        await downloadFile(dbUrl, dbPath);
    }
    if (dbPath) {
        const { sequelize: oldDataSequelize, models: oldDataModel } = await getOldDatabase(dbPath, sequelize_init_tables)

        try {
            const deleteResult = await hardDelete(oldDataSequelize, {
                model: oldDataModel.translation_dictionary,
                where: {
                    is_delete: {
                        $ne: 0
                    }
                }
            });
            if (deleteResult.success) {
                logger.success(`Deleted ${deleteResult.success} records from translation_dictionary`);
            }

            const records = await query(oldDataSequelize, {
                model: oldDataModel.translation_dictionary,
                where: {
                    is_delete: 0
                }
            });

            const parsedRecords = []
            const notTranslatedRecords = []
            const isTranslatedRecords = []
            records.forEach((record, index) => {
                const parsedRecord = parseTranslationRecord(record);
                parsedRecords.push(parsedRecord)
                if (!parsedRecord.translation) {
                    notTranslatedRecords.push(parsedRecord)
                } else {
                    isTranslatedRecords.push(parsedRecord)
                }
            });

            logger.info(`Found ${records.length} records in translation_dictionary`);
            logger.warn(`Not translated records: ${notTranslatedRecords.length}`)
            logger.warn(`Is translated records: ${isTranslatedRecords.length}`)

            const sliceNotTranslatedRecords = notTranslatedRecords.slice(0, 100)
            const sliceIsTranslatedRecords = isTranslatedRecords.slice(0, 100)
            smartDelayForEach(sliceNotTranslatedRecords, 0.1).forEach((record, index) => {
                logger.info_skip(`Record ${index + 1}:`, JSON.stringify(record, null, 2));
            });
            smartDelayForEach(isTranslatedRecords, 0.1).forEach((record, index) => {
                const result = generateTranslationFile(record)
                logger.info_skip(`Record ${index + 1}:`, JSON.stringify(result, null, 2));
            });

        } catch (error) {
            logger.error('Error querying translation_dictionary:', error);
        }
    }
}

/**
 * Generate and save translation file from transparseTranslationRecord result
 * @param {Object} transRecord - Result from transparseTranslationRecord
 * @returns {Object} Result with success flag and file path
 */
function generateTranslationFile(transRecord) {
    try {
        if (!transRecord || !transRecord.content) {
            return { success: false, error: 'Invalid translation record' };
        }

        // Generate filename
        const baseFileName = wordToFileName(transRecord.content);
        const md5 = generateMd5(transRecord.content)
        const fileName = `${baseFileName}_pv_bing_${md5}.json`;
        const filePath = path.join(TRANSLATE_TMP_DIR, fileName);

        // Check if file exists
        if (exists(filePath)) {
            return {
                success: true,
                exists: true,
                filePath,
                message: 'Translation file already exists'
            };
        }

        // Write JSON file
        const writeResult = writeJson(filePath, transRecord, {
            createDir: true,
            pretty: true,
            forceEmpty: false
        });

        if (writeResult) {
            const { fpath, size, content } = writeResult;
            
            // Add compression task with improved configuration
            const compressTargetPath = path.join(TRANSLATE_DIR, path.basename(fpath).replace('.json', '.j7son'));
            zipTool.addFileCompressionTask(fpath, compressTargetPath, {
                removeSource: true,
                sourceSize: size,
                extension: '.j7son',
                groupName: 'translation',
                groupCallback: (success, error) => {
                    if (success) {
                        logger.info(`Compression completed for ${fpath}`);
                    } else {
                        logger.error(`Compression failed for ${fpath}:`, error);
                    }
                }
            });

            logger.info(`Created translation file: ${fileName}`);
            return {
                success: true,
                exists: false,
                filePath,
                message: 'Translation file created successfully'
            };
        } else {
            return {
                success: false,
                error: 'Failed to write translation file'
            };
        }
    } catch (error) {
        logger.error('Error generating translation file:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    startInputOldDataTranslate,
    generateTranslationFile
}