const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');
const { APP_METADATA_SQLITE_DIR } = require('#@/ncore/gvar/gdir.js');
const fs = require('fs');
const logger = require('#@/ncore/utils/logger/index.js');
let dbConnections = {};

async function getDatabase(dbName) {
    if (dbConnections[dbName]) {
        return dbConnections[dbName];
    }
    if (!fs.existsSync(APP_METADATA_SQLITE_DIR)) {
        fs.mkdirSync(APP_METADATA_SQLITE_DIR, { recursive: true });
    }
    const dbPath = path.join(APP_METADATA_SQLITE_DIR, `${dbName}.sqlitemate`);
    try {
        const sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: dbPath,
        });
        await sequelize.authenticate();
        dbConnections[dbName] = sequelize;
        logger.info(`Successfully connected to database: ${dbName}`);
        return sequelize;
    } catch (error) {
        logger.error(`Error connecting to database ${dbName}:`, error);
        throw error;
    }
}

async function closeDatabase(dbName) {
    const sequelize = dbConnections[dbName];
    if (sequelize) {
        await sequelize.close();
        delete dbConnections[dbName];
        logger.info(`Closed connection to database: ${dbName}`);
    }
}

async function closeAllDatabases() {
    for (const dbName in dbConnections) {
        const sequelize = dbConnections[dbName];
        if (sequelize) {
            await sequelize.close();
            logger.info(`Closed connection to database: ${dbName}`);
        }
    }
    dbConnections = {};
}

module.exports = {
    getDatabase,
    closeDatabase,
    closeAllDatabases,
    DataTypes,
    Model
};
