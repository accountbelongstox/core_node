const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');
const { APP_METADATA_SQLITE_DIR } = require('#@/ncore/gvar/gdir.js');
const fs = require('fs');
const logger = require('#@logger');
const { printTableStructure } = require('./sequelize-libs/sequelize_pring');
const { syncTableStructure } = require('./sequelize-libs/sequelize_sync');
const { generateModelCode } = require('./sequelize-libs/sequelize_generate_model');
let dbConnections = {};

async function getDBConnection(dbNameOrPath, debugPrint = false, dbDialect = 'sqlite') {
    const dbNameIsAbsolute = path.isAbsolute(dbNameOrPath);
    const dbPath = dbNameIsAbsolute ? dbNameOrPath : path.join(APP_METADATA_SQLITE_DIR, `${dbNameOrPath}.sqlitemate`);
    const dbName = dbNameIsAbsolute ? path.basename(dbNameOrPath).replace(path.extname(dbNameOrPath), '') : dbNameOrPath;
    if (dbConnections[dbName]) {
        return dbConnections[dbName];
    }
    if (!fs.existsSync(APP_METADATA_SQLITE_DIR)) {
        fs.mkdirSync(APP_METADATA_SQLITE_DIR, { recursive: true });
    }
    try {
        const sequelize = new Sequelize({
            dialect: dbDialect,
            storage: dbPath,
            logging: debugPrint ? (msg) => logger.debug(`[Sequelize] ${msg}`) : false,
        });
        await sequelize.authenticate();
        dbConnections[dbName] = sequelize;
        logger.info(`Successfully connected to database: ${dbName}`);
        return sequelize;
    } catch (error) {
        logger.error(`Error connecting to database ${dbName}:`, error);
        return null;
    }
}

async function defineSequelizeModelByDefinition(sequelize, modelDefinition, options = { printStructure: true }, dbName,sync=true) {
    const models = {};
    
    // Iterate through each table definition
    for (const [tableName, tableDefinition] of Object.entries(modelDefinition)) {
        const model = sequelize.define(tableName, {
            ...tableDefinition
        }, {
            timestamps: false,
            freezeTableName: true
        });

        try {
            // Sync table structure with the correct parameters
            if(sync){
                await syncTableStructure(sequelize, model, tableName);
            }

            // Print final table structure if enabled
            if (options.printStructure) {
                logger.info(`\nFinal table structure for ${tableName} after sync:`);
                await printTableStructure(sequelize, tableName, dbName);
            }

            models[tableName] = model;
        } catch (error) {
            logger.error(`Error during model definition/sync for table ${tableName}:`, error);
            throw error;
        }
    }

    return models;
}

/**
 * Get a database connection and optionally define a model
 * @param {string} dbName - Database name or absolute path
 * @param {Object} [modelDefinition] - Optional model definition with table namespaces
 * @param {Object} [options] - Additional options
 * @returns {Promise<{sequelize: Sequelize, models: Object|null}>} Database connection and models
 */
async function getDatabase(dbName, modelDefinition, options = { printStructure: true }) {
    const sequelize = await getDBConnection(dbName);
    if (!sequelize) {
        return { sequelize: null, models: null };
    }

    // If no model definition is provided, return only the connection
    if (!modelDefinition) {
        try {
            await generateModelCode(sequelize);
        } catch (error) {
            logger.error('Error generating models:', error);
        }
        return { sequelize, models: null };
    }

    try {
        const models = await defineSequelizeModelByDefinition(sequelize, modelDefinition, options, dbName);
        return { sequelize, models };
    } catch (error) {
        logger.error('Error defining models:', error);
        return { sequelize, models: null };
    }
}

async function getOldDatabase(dbName, modelDefinition, options = { printStructure: true }) {
    const sequelize = await getDBConnection(dbName);
    if (!sequelize) {
        return { sequelize: null, models: null };
    }

    // If no model definition is provided, return only the connection
    if (!modelDefinition) {
        try {
            await generateModelCode(sequelize);
        } catch (error) {
            logger.error('Error generating models:', error);
        }
        return { sequelize, models: null };
    }

    try {
        const models = await defineSequelizeModelByDefinition(sequelize, modelDefinition, options, dbName,false);
        return { sequelize, models };
    } catch (error) {
        logger.error('Error defining models:', error);
        return { sequelize, models: null };
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
    logger.success('All database connections closed successfully');
    dbConnections = {};
}

module.exports = {
    getDatabase,
    getOldDatabase,
    closeDatabase,
    closeAllDatabases,
    DataTypes,
    Model,
    defineSequelizeModelByDefinition
};
