// const { addWordBack, getWordFront, getWordCount, ITEM_TYPE } = require('../../provider/QueueManager.js');
const { OLD_DB_DIR, TRANSLATE_TMP_DIR, TRANSLATE_DIR } = require('../../provider/index');
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
const { smartDelayForEach, delayForEach } = require('#@/ncore/utils/tool/libs/arrtool.js');
const { readJson } = require('#@/ncore/basic/libs/freader.js');
const { generateMd5, wordToFileName } = require('#@/ncore/utils/tool/libs/strtool.js');
const zipTool = require('#@/ncore/utils/tool/zip-tool/task_index.js');
const { generateWorkerTimer } = require('#@/ncore/utils/tool/thread/timer_worker.js');
const { replaceExtension } = require('#@/ncore/utils/ftool/libs/fpath.js');
const { decompress } = require('#@/ncore/utils/tool/zip-tool/best_decompressor.js');
const { scanDirectory } = require('#@/ncore/utils/ftool/libs/fdir.js');

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

        let voice_files = translation.voice_files ? translation.voice_files : null
        if (voice_files) {
            delete translation.voice_files
            if (voice_files.tts) {
                delete voice_files.tts
            }
            if (voice_files.save_filename) voice_files.save_filename = voice_files.save_filename.replace(`/static/translate_wave/bing/voice/`, ``)
            if (voice_files.content_len) delete voice_files.content_len
            let new_voice_files = null
            if (Object.keys(voice_files).length > 0) {
                new_voice_files = {}
                for (const key in voice_files) {
                    const valueAsObject = voice_files[key]

                    if (valueAsObject.save_filename) valueAsObject.save_filename = valueAsObject.save_filename.replace(`/static/translate_wave/bing/voice/`, ``)
                    if (valueAsObject.dynamic_url) delete valueAsObject.dynamic_url
                    if (valueAsObject.content_len) delete valueAsObject.content_len
                    const newKey = valueAsObject.iterate_name ? valueAsObject.iterate_name : generateMd5(valueAsObject.save_filename)
                    new_voice_files[newKey] = valueAsObject
                    if (valueAsObject.save_filename) {
                        new_voice_files[key] = valueAsObject
                    }
                }
            }
            voice_files = new_voice_files
        }
        let phonetic_symbol = translation.phonetic_symbol ? translation.phonetic_symbol : null
        if (phonetic_symbol) {
            delete translation.phonetic_symbol
            if (phonetic_symbol.phonetic_us) delete phonetic_symbol.phonetic_us
            if (phonetic_symbol.phonetic_us_sort) delete phonetic_symbol.phonetic_us_sort
            if (phonetic_symbol.phonetic_uk) delete phonetic_symbol.phonetic_uk
            if (phonetic_symbol.phonetic_uk_sort) delete phonetic_symbol.phonetic_uk_sort
            if (phonetic_symbol.phonetic_us_length) delete phonetic_symbol.phonetic_us_length
            if (phonetic_symbol.phonetic_uk_length) delete phonetic_symbol.phonetic_uk_length
            let new_phonetic_symbol = null
            if (Object.keys(phonetic_symbol).length > 0) {
                new_phonetic_symbol = {
                    // content: record.word,
                }
                for (const key in phonetic_symbol) {
                    const value = phonetic_symbol[key]
                    if (value && value.url) {
                        new_phonetic_symbol[value.phonetic] = value.url
                    }
                }
            }
            phonetic_symbol = new_phonetic_symbol
        }
        const word_sort = translation.word_sort ? translation.word_sort : null
        if (word_sort) delete translation.word_sort
        let sample_images = translation.sample_images ? translation.sample_images : null
        if (sample_images) {
            delete translation.sample_images
            let new_sample_images = null
            if (typeof sample_images === 'object' && Object.keys(sample_images).length > 0) {
                new_sample_images = []
                for (const key in sample_images) {
                    const value = sample_images[key]
                    if (value.url) {
                        if (value.save_filename) value.save_filename = value.save_filename.replace(`/static/translate_wave/bing/images/`, ``)
                        if (value.content_len) delete value.content_len
                        new_sample_images.push({
                            ...value
                        })
                    }
                }
            }
            sample_images = new_sample_images
        }
        translation = processH2Content(translation)

        return {
            content: record.word,
            translation,                            // Translation data
            lastModified: record.last_time,        // Last modification time
            usPhonetic: record.phonetic_us,        // US phonetic with symbols
            usPhoneticRaw: record.phonetic_us_sort,// US phonetic without symbols
            ukPhonetic: record.phonetic_uk,        // UK phonetic with symbols
            ukPhoneticRaw: record.phonetic_uk_sort, // UK phonetic without symbols
            voice_files,
            phonetic_symbol,
            word_sort,
            sample_images
        };
    } catch (error) {
        logger.error('Error parsing record:', error);
        return null;
    }
}

async function startInputProcessOldDataTranslate() {
    let tfiles = scanDirectory(TRANSLATE_TMP_DIR, {
        onlyFiles: true,
        withStats: false
    });

    if (tfiles.length == 0) {
        if (!exists(dbPath)) {
            const zipFile = replaceExtension(dbPath, `.7z`);
            await downloadFile(dbUrl, zipFile);
            const decompressResult = await decompress(zipFile, path.dirname(dbPath));
            if (!decompressResult.success) {
                logger.error('Decompress olddb failed');
                return;
            }
            logger.success('Decompress olddb success');
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
                logger.info(`Querying translation_dictionary...`);
                let timer = generateWorkerTimer()
                const records = await query(oldDataSequelize, {
                    model: oldDataModel.translation_dictionary,
                    where: {
                        is_delete: 0
                    }
                });
                timer.stopTimer()
                logger.success(`Query translation_dictionary success ${records.length} records`);

                const parsedRecords = {}
                const notTranslatedRecords = []
                const isTranslatedRecords = []
                logger.info(`Start parsing records`);
                timer = generateWorkerTimer()
                records.forEach((record, index) => {
                    const parsedRecord = parseTranslationRecord(record);
                    // console.log(`parsedRecord.translation`)
                    // console.log(parsedRecord.translation)
                    // console.log(`parsedRecord.voice_files`)
                    // console.log(parsedRecord.voice_files)
                    // console.log(`parsedRecord.phonetic_symbol`)
                    // console.log(parsedRecord.phonetic_symbol)
                    // console.log(`parsedRecord.sample_images`)
                    // console.log(parsedRecord.sample_images)
                    parsedRecords[parsedRecord.content] = parsedRecord
                    if (!parsedRecord.translation) {
                        notTranslatedRecords.push(parsedRecord)
                    } else {
                        isTranslatedRecords.push(parsedRecord)
                    }
                    if (index % 1000 === 0) {
                        logger.info(`Processing record ${index + 1} of ${records.length} word: ${parsedRecord.content}`);
                    }
                });
                timer.stopTimer()
                logger.info(`Parsing records completed, parsedRecord Size: ${Object.keys(parsedRecords).length}`);

                logger.info(`Start writing isTranslatedRecords`);
                timer = generateWorkerTimer()
                const filePath = path.join(TRANSLATE_TMP_DIR, '../translation_dictionary.json');
                if (exists(filePath)) {
                    try {
                        await fs.unlink(filePath)
                    } catch (error) {
                        logger.error(`Failed to delete existing file ${filePath}:`, error);
                    }
                }
                const writeResult = writeJson(filePath, parsedRecords, {
                    createDir: true,
                    pretty: true,
                    forceEmpty: false
                });
                timer.stopTimer()
                logger.info(`Writing isTranslatedRecords completed`);

                logger.info(`Found ${records.length} records in translation_dictionary`);
                logger.warn(`Not translated records: ${notTranslatedRecords.length}`)
                logger.warn(`Is translated records: ${isTranslatedRecords.length}`)
                const translationDictionary = readJson(filePath);
                logger.success(`read translationDictionary success len ${Object.keys(translationDictionary).length}`);

                // const sliceNotTranslatedRecords = notTranslatedRecords.slice(0, 100)
                // const sliceIsTranslatedRecords = isTranslatedRecords.slice(0, 100)
                // smartDelayForEach(sliceNotTranslatedRecords, 0.1).forEach((record, index) => {
                //     logger.info_skip(`Record ${index + 1}:`, JSON.stringify(record, null, 2));
                // });
                smartDelayForEach(isTranslatedRecords, 0.1).forEach((record, index) => {
                    const result = generateTranslationFile(record)
                    logger.info_skip(`Record ${index + 1}:`, JSON.stringify(result, null, 2));
                });

            } catch (error) {
                logger.error('Error querying translation_dictionary:', error);
            }
        }
    }
    tfiles = scanDirectory(TRANSLATE_TMP_DIR, {
        onlyFiles: true,
        withStats: false
    });
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
            // zipTool.addFileCompressionTask(fpath, compressTargetPath, {
            //     removeSource: false,
            //     sourceSize: size,
            //     extension: '.j7son',
            //     groupName: 'translation',
            //     groupCallback: (success, error) => {
            //         if (success) {
            //             logger.info(`Compression completed for ${fpath}`);
            //         } else {
            //             logger.error(`Compression failed for ${fpath}:`, error);
            //         }
            //     }
            // });

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

/**
 * Encode string to ensure proper Unicode representation
 * @param {string} str - String to encode
 * @returns {string} Encoded string
 */
function encodeToUnicode(str) {
    return str
    // return str.replace(/[^\u0000-\u007F]/g, char => {
    //     const hex = char.charCodeAt(0).toString(16).padStart(4, '0');
    //     return `\\u${hex}`;
    // });
}

/**
 * Process content within h2 tags and handle special characters
 * @param {*} input - Input to process
 * @returns {*} Processed input
 */
function processH2Content(input) {
    // Handle null/undefined
    if (input == null) {
        return input;
    }

    // Handle arrays
    if (Array.isArray(input)) {
        return input.map(item => processH2Content(item));
    }

    // Handle objects
    if (typeof input === 'object') {
        const result = {};
        for (const key in input) {
            if (Object.prototype.hasOwnProperty.call(input, key)) {
                result[key] = processH2Content(input[key]);
            }
        }
        return result;
    }

    // Handle strings
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.startsWith('<h2')) {
            // Find the first closing bracket
            const firstCloseBracketIndex = trimmed.indexOf('>');
            if (firstCloseBracketIndex === -1) {
                return encodeToUnicode(trimmed); // No closing bracket found, encode and return
            }

            // Check for </h2> at the end
            if (!trimmed.endsWith('</h2>')) {
                return encodeToUnicode(trimmed); // Not a complete h2 tag, encode and return
            }

            // Extract content between first '>' and '</h2>'
            const content = trimmed.substring(firstCloseBracketIndex + 1, trimmed.length - 5);
            if (!content.trim()) {
                return encodeToUnicode(trimmed); // Empty content, encode and return
            }

            return encodeToUnicode(content);
        }
        // For non-h2 strings, still encode to ensure consistency
        return encodeToUnicode(trimmed);
    }

    // Return other types as is
    return input;
}

module.exports = {
    startInputProcessOldDataTranslate,
    generateTranslationFile,
    processH2Content
}