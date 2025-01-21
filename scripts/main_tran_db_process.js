const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const logger = require('#@logger');
const { generateMd5, wordToFileName } = require('#@/ncore/utils/tool/libs/strtool.js');

const PRIMARY_DB_PATH = path.join(process.cwd(), 'public/VoiceStaticServer/.cache/mergedb/PRIMARY_DB.db');
const SECONDARY_DB_PATH = path.join(process.cwd(), 'public/VoiceStaticServer/.cache/mergedb/SECONDARY_DB.db');
const NEW_DB_PATH = path.join(process.cwd(), 'public/VoiceStaticServer/.cache/mergedb/dataMerged.db');
const CHUNK_SIZE = 100;

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
        let translation = record.translation;
        if (typeof translation === 'string') {
            translation = JSON.parse(translation);
        }

        if (translation && translation.translation) {
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
            us_phonetic: record.phonetic_us,        // US phonetic with symbols
            uk_phonetic: record.phonetic_uk,        // UK phonetic with symbols
            voice_files,
            phonetic_symbol,
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
 * Create new database table
 * @param {any} db - Database instance
 * @returns {Promise<void>}
 */
async function createNewTable(db) {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS dictionaries (
            content TEXT PRIMARY KEY NOT NULL UNIQUE,
            translation TEXT NULL,
            lastModified INTEGER NULL,
            us_phonetic TEXT NULL,
            uk_phonetic TEXT NULL,
            voice_files TEXT NULL,
            phonetic_symbol TEXT NULL,
            sample_images TEXT NULL
        )
    `;

    await runQuery(db, createTableSQL);
    logger.success('New table created successfully');
}

/**
 * Load database records into memory map
 * @param {any} db - Database instance
 * @param {string} dbName - Database name for logging
 * @returns {Promise<Map<string, Object>>} Map of words and their processed records
 */
async function loadDatabaseToMap(db, dbName) {
    logger.info(`Loading records from ${dbName}...`);
    const wordMap = new Map();
    const records = await getAllRows(db, 'SELECT * FROM dictionaries');
    logger.info(`Found ${records.length} records in ${dbName}`);

    let validCount = 0;
    let invalidCount = 0;

    for (const record of records) {
        const processedRecord = parseTranslationRecord(record);
        if (processedRecord) {
            wordMap.set(record.word, processedRecord);
            validCount++;
        } else {
            invalidCount++;
            logger.error(`Failed to process record from ${dbName}: ${record.word}`);
        }
    }

    logger.info(`${dbName} loading completed:`);
    logger.info(`- Valid records: ${validCount}`);
    logger.info(`- Invalid records: ${invalidCount}`);

    return wordMap;
}

/**
 * Main process function
 */
async function main() {
    let primaryDb;
    let secondaryDb;
    let newDb;

    try {
        // Open primary database
        logger.info('Opening primary database:', PRIMARY_DB_PATH);
        primaryDb = await openDatabase(PRIMARY_DB_PATH);

        // Open secondary database
        logger.info('Opening secondary database:', SECONDARY_DB_PATH);
        secondaryDb = await openDatabase(SECONDARY_DB_PATH);

        // Create and open new database
        logger.info('Creating new database:', NEW_DB_PATH);
        newDb = await openDatabase(NEW_DB_PATH);
        await createNewTable(newDb);

        // Load primary database into memory
        const primaryWordMap = await loadDatabaseToMap(primaryDb, 'Primary DB');

        // Load and merge secondary database
        logger.info('Processing secondary database records...');
        const records = await getAllRows(secondaryDb, 'SELECT * FROM dictionaries');

        let mergedCount = 0;
        let skippedCount = 0;
        let processedCount = 0;

        // Chunk statistics
        let chunkMerged = 0;
        let chunkSkipped = 0;
        let chunkStart = 1;

        // Process secondary database records
        for (const record of records) {
            processedCount++;

            try {
                const processedRecord = parseTranslationRecord(record);
                if (!processedRecord) {
                    skippedCount++;
                    chunkSkipped++;
                    continue;
                }

                const existingRecord = primaryWordMap.get(record.word);
                if (!existingRecord || !existingRecord.translation) {
                    primaryWordMap.set(record.word, processedRecord);
                    mergedCount++;
                    chunkMerged++;
                } else {
                    skippedCount++;
                    chunkSkipped++;
                }
            } catch (error) {
                logger.error(`Error processing record ${record.word}:`, error.message);
                skippedCount++;
                chunkSkipped++;
            }

            // Print chunk statistics
            if (processedCount % CHUNK_SIZE === 0) {
                logger.info(`\nChunk ${processedCount / CHUNK_SIZE} (records ${chunkStart}-${processedCount}):`);
                logger.info(`Merged: ${chunkMerged}, Skipped: ${chunkSkipped}`);
                // Reset chunk counters
                chunkMerged = 0;
                chunkSkipped = 0;
                chunkStart = processedCount + 1;
            }
        }

        // Print final chunk if there are remaining records
        if (processedCount % CHUNK_SIZE !== 0) {
            logger.info(`\nFinal chunk (records ${chunkStart}-${processedCount}):`);
            logger.info(`Merged: ${chunkMerged}, Skipped: ${chunkSkipped}`);
        }

        logger.info('\nMerging completed:');
        logger.info(`- Total records processed: ${processedCount}`);
        logger.info(`- Records merged: ${mergedCount}`);
        logger.info(`- Records skipped: ${skippedCount}`);
        logger.info(`- Final map size: ${primaryWordMap.size}`);

        // Write merged data to new database
        logger.info('\nWriting merged data to new database...');
        let writeCount = 0;
        let writeError = 0;
        let chunkSuccess = 0;
        let chunkError = 0;
        const TRANSACTION_SIZE = 1000;
        let batch = [];

        try {
            // Start initial transaction
            await runQuery(newDb, 'BEGIN TRANSACTION');

            for (const [word, record] of primaryWordMap) {
                writeCount++;

                try {
                    const insertFields = [
                        'content',
                        'translation',
                        'lastModified',
                        'us_phonetic',
                        'uk_phonetic',
                        'voice_files',
                        'phonetic_symbol',
                        'sample_images'
                    ];

                    const placeholders = insertFields.map(() => '?').join(', ');
                    const insertValues = [
                        record.content,
                        JSON.stringify(record.translation),
                        record.lastModified,
                        record.us_phonetic,
                        record.uk_phonetic,
                        record.voice_files ? JSON.stringify(record.voice_files) : null,
                        record.phonetic_symbol ? JSON.stringify(record.phonetic_symbol) : null,
                        record.sample_images ? JSON.stringify(record.sample_images) : null
                    ];

                    batch.push({
                        sql: `INSERT INTO dictionaries (${insertFields.join(', ')}) VALUES (${placeholders})`,
                        values: insertValues
                    });

                    chunkSuccess++;

                    // Commit transaction when batch size reaches TRANSACTION_SIZE
                    if (batch.length === TRANSACTION_SIZE) {
                        for (const query of batch) {
                            await runQuery(newDb, query.sql, query.values);
                        }
                        await runQuery(newDb, 'COMMIT');
                        await runQuery(newDb, 'BEGIN TRANSACTION');
                        logger.info(`Committed ${TRANSACTION_SIZE} records (${writeCount - TRANSACTION_SIZE + 1}-${writeCount})`);
                        batch = [];
                    }

                } catch (error) {
                    logger.error(`Error preparing record ${word}:`, error.message);
                    writeError++;
                    chunkError++;
                }

                // Print progress every CHUNK_SIZE records
                if (writeCount % CHUNK_SIZE === 0) {
                    logger.info(`\nProcessed ${writeCount} records`);
                    logger.info(`Success: ${chunkSuccess}, Errors: ${chunkError}`);
                    chunkSuccess = 0;
                    chunkError = 0;
                }
            }

            // Commit any remaining records
            if (batch.length > 0) {
                for (const query of batch) {
                    await runQuery(newDb, query.sql, query.values);
                }
                await runQuery(newDb, 'COMMIT');
                logger.info(`Committed final ${batch.length} records (${writeCount - batch.length + 1}-${writeCount})`);
            }

        } catch (error) {
            // If any error occurs during transaction, roll back
            await runQuery(newDb, 'ROLLBACK');
            throw error;
        }

        logger.success('\nProcess completed:');
        logger.info(`- Total records processed: ${writeCount}`);
        logger.info(`- Successfully written: ${writeCount - writeError}`);
        logger.info(`- Write errors: ${writeError}`);

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
        if (newDb) {
            logger.info('Closing new database...');
            newDb.close();
            logger.success('New database closed successfully');
        }
    }
}

// Run the script
main().catch(error => {
    logger.error('Script failed:', error);
    process.exit(1);
}); 