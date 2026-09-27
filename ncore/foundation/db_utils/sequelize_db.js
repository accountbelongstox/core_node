const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');
const fs = require('fs');
const logger = require('#@logger');
const { fpath } = require('#@btools');
const { printTableStructure } = require('./sequelize-libs/sequelize_pring');
const { syncTableStructure } = require('./sequelize-libs/sequelize_sync');
const ExitOn = require('#@/ncore/foundation/utilities/process_on.js');
const GlobalDBMaps = {};

function getDBPathFromDBName(dbNameOrPath, sqliteDir) {
    const dbNameIsAbsolute = path.isAbsolute(dbNameOrPath);
    if (!dbNameIsAbsolute && !sqliteDir) {
        logger.error(`SequelizeDB: ${dbNameOrPath} is not an absolute path and no sqliteDir was given`);
        return null;
    }
    const dbPath = dbNameIsAbsolute ? dbNameOrPath : path.join(sqliteDir, `${dbNameOrPath}.sqlitemate`);
    const dbName = fpath.getBasenameWithoutExt(dbPath);
    return {
        dbPath,
        dbName
    }
}

async function obtainInstantiationSequelize(dbPath, dbName, debugPrint = false, dbDialect = 'sqlite') {
    if (logger.isDebug) {
        const alreadyExists = Object.keys(GlobalDBMaps);
        console.log(`SequelizeDB Connected alreadyExists:${alreadyExists.join(',')}`);
    }
    logger.debug(`Successfully create new database: ${dbName}`);
    try {
        if (path.isAbsolute(dbPath)) {
            fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        }
        const sequelize = new Sequelize({
            dialect: dbDialect,
            storage: dbPath,
            logging: debugPrint ? (msg) => logger.debug(`[Sequelize] ${msg}`) : false,
            retry: {
                max: 5,
                match: [
                    'SQLITE_BUSY',
                    Sequelize.DatabaseError
                ],
                backoffBase: 100,
                backoffExponent: 1.5
            }
        });
        await sequelize.authenticate();
        logger.debug(`Successfully connected to database: ${dbName},authenticate ${await sequelize.authenticate()}`);
        return sequelize;
    } catch (error) {
        logger.error(`Error connecting to database ${dbName}:`, error);
        return null;
    }
}

async function defineSequelizeModelByDefinition(sequelize, modelDefinition, options = { printStructure: true }, dbName, sync = true) {
    const dbTableModels = {};
    for (const [tableName, tableDefinition] of Object.entries(modelDefinition)) {
        const model = sequelize.define(tableName, {
            ...tableDefinition
        }, {
            timestamps: false,
            freezeTableName: true
        });
        try {
            if (sync) {
                await syncTableStructure(sequelize, model, tableName);
            }
            if (options.printStructure) {
                await printTableStructure(sequelize, tableName, dbName);
            }
            dbTableModels[tableName] = model;
        } catch (error) {
            logger.error(`Error during model definition/sync for table ${tableName}:`, error);
        }
    }
    return dbTableModels;
}

async function destroyDatabase(dbName) {
    if (!GlobalDBMaps[dbName]) {
        const sequelize = GlobalDBMaps[dbName]
        try {
            await sequelize.close();
        } catch (e) {
            logger.warn(`${dbName} already closed,`)
        }
        delete GlobalDBMaps[dbName];
    }
}

async function getDatabase(dbNameOrPath, modelDefinition, options = { printStructure: true }) {
    const resolved = getDBPathFromDBName(dbNameOrPath, options.sqliteDir);
    if (!resolved) {
        return null;
    }
    const { dbPath, dbName } = resolved;
    if (!GlobalDBMaps[dbName]) {
        const sequelize = await obtainInstantiationSequelize(dbPath, dbName);
        if (!sequelize) {
            return null;
        }
        let tableModels = null;
        try {
            tableModels = await defineSequelizeModelByDefinition(sequelize, modelDefinition, options, dbName);
        } catch (error) {
            logger.error('Error defining models:', error);
        }
        const close = () => sequelize.close();
        if (!modelDefinition) {
            logger.error(`modelDefinition is null for dbName:${dbName}`);
        }
        GlobalDBMaps[dbName] = {
            sequelize: sequelize,
            tableModels,
            close,
        }
    }
    return GlobalDBMaps[dbName]
}

async function closeDatabase(dbNameOrSequelize) {
    let sequelize;
    if (typeof dbNameOrSequelize !== 'string') {
        sequelize = dbNameOrSequelize;
    } else {
        const dbName = fpath.getBasenameWithoutExt(dbNameOrSequelize);
        sequelize = GlobalDBMaps[dbName].sequelize;
    }
    if (sequelize) {
        await sequelize.close();
        delete GlobalDBMaps[dbName];
        logger.info(`Closed connection to database: ${dbName}`);
    }
}

async function closeAllDatabases() {
    for (const dbName in GlobalDBMaps) {
        const sequelize = GlobalDBMaps[dbName].sequelize;
        if (sequelize) {
            await sequelize.close();
            logger.info(`Closed connection to database: ${dbName}`);
        }
    }
    logger.success('All database connections closed successfully');
    for (const dbName of Object.keys(GlobalDBMaps)) {
        delete GlobalDBMaps[dbName];
    }
}
ExitOn.addShutdownHandler(closeAllDatabases);
module.exports = {
    getDatabase,
    closeDatabase,
    closeAllDatabases,
    obtainInstantiationSequelize,
    DataTypes,
    destroyDatabase,
    Model,
    defineSequelizeModelByDefinition
};
