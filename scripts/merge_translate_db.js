const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const logger = require('#@logger');

const PRIMARY_DB_PATH = path.join(process.cwd(), 'public/VoiceStaticServer/.cache/mergedb/dataOld.db');
const SECONDARY_DB_PATH = path.join(process.cwd(), 'public/VoiceStaticServer/.cache/mergedb/dataOldTranslateControl.db');
const CHUNK_SIZE = 100; // Size of each processing chunk

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
                return trimmed; // No closing bracket found, encode and return
            }

            // Check for </h2> at the end
            if (!trimmed.endsWith('</h2>')) {
                return trimmed; // Not a complete h2 tag, encode and return
            }

            // Extract content between first '>' and '</h2>'
            const content = trimmed.substring(firstCloseBracketIndex + 1, trimmed.length - 5);
            if (!content.trim()) {
                return trimmed; // Empty content, encode and return
            }

            return trimmed;
        }
        // For non-h2 strings, still encode to ensure consistency
        return trimmed;
    }

    // Return other types as is
    return input;
}
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

/**
 * Open SQLite database with promise wrapper
 * @param {string} dbPath - Path to database file
 * @returns {Promise<any>} Database instance
 */
function openDatabase(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(db);
            }
        });
    });
}

/**
 * Run SQL query with promise wrapper
 * @param {any} db - Database instance
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<any>} Query result
 */
function runQuery(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
}

/**
 * Get all rows from query with promise wrapper
 * @param {any} db - Database instance
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
function getAllRows(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Process translation data
 * @param {string} translation - Translation data to process
 * @returns {Object|null} Processed translation or null if invalid
 */
function processTranslation(translation) {
    if (!translation) return null;

    try {
        if (typeof translation === 'string') {
            return JSON.parse(translation);
        }
        if (typeof translation === 'object' && translation !== null) {
            return translation;
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Load primary database records into memory
 * @param {any} db - Database instance
 * @returns {Promise<Map<string, Object>>} Map of words and their translations
 */
async function loadPrimaryDatabase(db) {
    logger.info('Loading primary database records...');
    const wordMap = new Map();

    const records = await getAllRows(db, 'SELECT word, translation FROM dictionaries');
    let validTranslations = 0;
    let invalidTranslations = 0;

    records.forEach(record => {
        const translation = processTranslation(record.translation);
        wordMap.set(record.word, translation); // Store null if translation is invalid
        if (translation) {
            validTranslations++;
        } else {
            invalidTranslations++;
        }
    });

    logger.success(`Loaded ${wordMap.size} words from primary database`);
    logger.info(`- Valid translations: ${validTranslations}`);
    logger.info(`- Invalid translations: ${invalidTranslations}`);
    return wordMap;
}

/**
 * Main process function
 */
async function main() {
    let primaryDb;
    let secondaryDb;

    try {
        // Open primary database
        logger.info('Opening primary database:', PRIMARY_DB_PATH);
        primaryDb = await openDatabase(PRIMARY_DB_PATH);

        // Load primary database words into memory
        const primaryWordMap = await loadPrimaryDatabase(primaryDb);

        // Open secondary database
        logger.info('Opening secondary database:', SECONDARY_DB_PATH);
        secondaryDb = await openDatabase(SECONDARY_DB_PATH);

        // Get records from secondary database
        logger.info('Reading records from secondary database...');
        const secondaryRecords = await getAllRows(secondaryDb, 'SELECT word, translation FROM dictionaries');
        logger.info(`Found ${secondaryRecords.length} records in secondary database`);

        // Process records
        let processedCount = 0;
        let skippedCount = 0;
        let addedCount = 0;
        let updatedCount = 0;
        let invalidCount = 0;

        // Chunk statistics
        let chunkAdded = 0;
        let chunkUpdated = 0;
        let chunkSkipped = 0;
        let chunkInvalid = 0;
        let chunkStart = 1;






        for (const record of secondaryRecords) {
            processedCount++;

            // Check if translation is valid
            const translation = processTranslation(record.translation);
            if (!translation) {
                invalidCount++;
                chunkInvalid++;
                continue;
            }

            const translationJson = JSON.stringify(translation);
            const existingTranslation = primaryWordMap.get(record.word);

            if (!primaryWordMap.has(record.word)) {
                // Word doesn't exist in primary database, add it
                try {
                    await runQuery(primaryDb,
                        'INSERT INTO dictionaries (word, translation) VALUES (?, ?)',
                        [record.word, translationJson]
                    );
                    addedCount++;
                    chunkAdded++;
                    primaryWordMap.set(record.word, translation);
                } catch (error) {
                    logger.error(`Error inserting word "${record.word}":`, error.message);
                    skippedCount++;
                    chunkSkipped++;
                }
            } else if (!existingTranslation) {
                // Word exists but has no valid translation, update it
                try {
                    await runQuery(primaryDb,
                        'UPDATE dictionaries SET translation = ? WHERE word = ?',
                        [translationJson, record.word]
                    );
                    updatedCount++;
                    chunkUpdated++;
                    primaryWordMap.set(record.word, translation);
                } catch (error) {
                    logger.error(`Error updating word "${record.word}":`, error.message);
                    skippedCount++;
                    chunkSkipped++;
                }
            } else {
                skippedCount++;
                chunkSkipped++;
            }

            // Print chunk statistics
            if (processedCount % CHUNK_SIZE === 0) {
                logger.info(`\nChunk ${processedCount / CHUNK_SIZE} (records ${chunkStart}-${processedCount}):`);
                logger.info(`Added: ${chunkAdded}, Updated: ${chunkUpdated}, Skipped: ${chunkSkipped}, Invalid: ${chunkInvalid}`);
                // Reset chunk counters
                chunkAdded = 0;
                chunkUpdated = 0;
                chunkSkipped = 0;
                chunkInvalid = 0;
                chunkStart = processedCount + 1;
            }
        }

        // Print final chunk if there are remaining records
        if (processedCount % CHUNK_SIZE !== 0) {
            logger.info(`\nFinal chunk (records ${chunkStart}-${processedCount}):`);
            logger.info(`Added: ${chunkAdded}, Updated: ${chunkUpdated}, Skipped: ${chunkSkipped}, Invalid: ${chunkInvalid}`);
        }

        logger.success('\nProcess completed:');
        logger.info(`- Total records in primary database: ${primaryWordMap.size}`);
        logger.info(`- Total records processed from secondary: ${processedCount}`);
        logger.info(`- Invalid translations found: ${invalidCount}`);
        logger.info(`- Records skipped (already exists with translation): ${skippedCount}`);
        logger.info(`- New records added: ${addedCount}`);
        logger.info(`- Existing records updated: ${updatedCount}`);

    } catch (error) {
        logger.error('Error during process:', error);
    } finally {
        // Close databases
        if (primaryDb) {
            logger.info('Closing primary database...');
            primaryDb.close();
            logger.success('Primary database closed successfully');
        }
        if (secondaryDb) {
            logger.info('Closing secondary database...');
            secondaryDb.close();
            logger.success('Secondary database closed successfully');
        }
    }
}

// Run the script
main().catch(error => {
    logger.error('Script failed:', error);
    process.exit(1);
}); 