const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3').verbose();
const logger = require('#@logger');

const DB_PATH = path.join(process.cwd(), 'public/VoiceStaticServer/.cache/mergedb/dataMerged.db');
const OUTPUT_PATH = path.join(process.cwd(), 'public/VoiceStaticServer/.cache/mergedb/merged_data.txt');

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
 * Clean empty objects in database
 * @param {any} db - Database instance
 */
async function cleanEmptyObjects(db) {
    const fields = ['us_phonetic', 'uk_phonetic', 'voice_files', 'phonetic_symbol', 'sample_images'];
    
    for (const field of fields) {
        logger.info(`Cleaning empty ${field}...`);
        const sql = `UPDATE dictionaries SET ${field} = NULL WHERE ${field} = '{}'`;
        const result = await runQuery(db, sql);
        logger.info(`- Updated ${result.changes} records`);
    }
    
    logger.success('Empty objects cleaned successfully');
}

/**
 * Export database records to JSON file
 * @param {any} db - Database instance
 */
async function exportToJson(db) {
    logger.info('Reading all records from database...');
    const records = await getAllRows(db, 'SELECT * FROM dictionaries');
    logger.info(`Found ${records.length} records`);

    const processedRecords = records.map(record => {
        try {
            // Parse JSON fields
            const translation = record.translation ? JSON.parse(record.translation) : null;
            const voice_files = record.voice_files ? JSON.parse(record.voice_files) : null;
            const phonetic_symbol = record.phonetic_symbol ? JSON.parse(record.phonetic_symbol) : null;
            const sample_images = record.sample_images ? JSON.parse(record.sample_images) : null;

            return {
                content: record.content,
                translation,
                us_phonetic: record.us_phonetic,
                uk_phonetic: record.uk_phonetic,
                voice_files,
                phonetic_symbol,
                sample_images
            };
        } catch (error) {
            logger.error(`Error processing record ${record.content}:`, error.message);
            return null;
        }
    }).filter(record => record !== null);

    logger.info(`Successfully processed ${processedRecords.length} records`);
    logger.info(`Failed to process ${records.length - processedRecords.length} records`);

    // Save to file
    logger.info('Saving to file...');
    const json_text_arr = []
    processedRecords.forEach(record => {
        json_text_arr.push(JSON.stringify(record, null, 2))
    })
    await fs.writeFile(OUTPUT_PATH, json_text_arr.join('\n------------------------------TokenLine-----------------------------\n'), { encoding: 'utf-8' });
    logger.success(`Data saved to ${OUTPUT_PATH}`);
}

/**
 * Main process function
 */
async function main() {
    let db;

    try {
        // Open database
        logger.info('Opening database:', DB_PATH);
        db = await openDatabase(DB_PATH);

        // Clean empty objects
        // await cleanEmptyObjects(db);
        // Export to JSON
        await exportToJson(db);

        logger.success('Process completed successfully');

    } catch (error) {
        logger.error('Error during process:', error);
    } finally {
        // Close database
        if (db) {
            logger.info('Closing database...');
            db.close();
            logger.success('Database closed successfully');
        }
    }
}

// Run the script
main().catch(error => {
    logger.error('Script failed:', error);
    process.exit(1);
}); 