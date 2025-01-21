const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const logger = require('#@logger');

const DB_PATH = path.join(process.cwd(), 'public/VoiceStaticServer/.cache/mergedb/dataOld.db');
const KEEP_TABLE = 'dictionaries';

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
        db.run(sql, params, function(err) {
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
 * Get all table names from the database
 * @param {any} db - Database instance
 * @returns {Promise<string[]>} Array of table names
 */
async function getAllTables(db) {
    const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;
    const rows = await getAllRows(db, sql);
    return rows.map(row => row.name);
}

/**
 * Main process function
 */
async function main() {
    let db;

    try {
        logger.info('Opening database:', DB_PATH);
        db = await openDatabase(DB_PATH);

        // Get all tables
        const tables = await getAllTables(db);
        logger.info(`Found ${tables.length} tables:`, tables);

        // Delete all tables except KEEP_TABLE
        let deletedCount = 0;
        for (const table of tables) {
            if (table !== KEEP_TABLE) {
                logger.info(`Dropping table: ${table}`);
                try {
                    await runQuery(db, `DROP TABLE IF EXISTS ${table}`);
                    deletedCount++;
                    logger.success(`Successfully dropped table: ${table}`);
                } catch (error) {
                    logger.error(`Error dropping table ${table}:`, error.message);
                }
            } else {
                logger.info(`Keeping table: ${table}`);
            }
        }

        logger.success('Process completed:');
        logger.info(`- Total tables found: ${tables.length}`);
        logger.info(`- Tables deleted: ${deletedCount}`);
        logger.info(`- Tables kept: ${tables.length - deletedCount}`);

    } catch (error) {
        logger.error('Error during process:', error);
    } finally {
        // Close database
        if (db) {
            logger.info('Closing database...');
            db.close();
        }
    }
}

// Run the script
main().catch(error => {
    logger.error('Script failed:', error);
    process.exit(1);
}); 